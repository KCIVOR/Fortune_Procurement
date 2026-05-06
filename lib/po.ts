import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/auth';
import type { PORequest, POWithItems, POFormValues } from '@/types/po';

const db = supabase as any;

// ─── Fetch all POs ────────────────────────────────────────────────────────────

export async function fetchPOs(): Promise<PORequest[]> {
  const { data, error } = await db
    .from('po_requests')
    .select('*')
    .order('generated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalizePO);
}

// ─── Fetch POs with pagination, filtering, and sorting ────────────────────────

export interface POFilters {
  search?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export async function listPOsWithCount(filters: POFilters = {}): Promise<{ pos: PORequest[]; total_count: number }> {
  const { limit = 25, offset = 0, search, status } = filters;

  const buildBaseQuery = () => {
    let query = db
      .from('po_requests')
      .select('*')
      .order('generated_at', { ascending: false });

    if (search && search.trim()) {
      const searchTerm = `%${search}%`;
      query = query.or(`po_number.ilike.${searchTerm},purpose.ilike.${searchTerm}`);
    }

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    return query;
  };

  const posQuery = buildBaseQuery().range(offset, offset + limit - 1);
  const countQuery = buildBaseQuery().select('id', { count: 'exact' });

  const [posRes, countRes] = await Promise.all([posQuery, countQuery]);

  if (posRes.error) throw posRes.error;
  if (countRes.error) throw countRes.error;

  return {
    pos: (posRes.data ?? []).map(normalizePO),
    total_count: countRes.count ?? 0,
  };
}

// ─── Global status-breakdown counts (for stat cards, filter-independent) ─────

export interface POStatusCounts {
  total: number;
  draft: number;
  for_approval: number;
  approved: number; // includes 'sent'
}

export async function fetchPOStatusCounts(): Promise<POStatusCounts> {
  const [totalRes, draftRes, forApprovalRes, approvedRes] = await Promise.all([
    db.from('po_requests').select('id', { count: 'exact', head: true }),
    db.from('po_requests').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
    db.from('po_requests').select('id', { count: 'exact', head: true }).eq('status', 'for_approval'),
    db.from('po_requests').select('id', { count: 'exact', head: true }).in('status', ['approved', 'sent']),
  ]);

  if (totalRes.error) throw totalRes.error;
  if (draftRes.error) throw draftRes.error;
  if (forApprovalRes.error) throw forApprovalRes.error;
  if (approvedRes.error) throw approvedRes.error;

  return {
    total:        totalRes.count ?? 0,
    draft:        draftRes.count ?? 0,
    for_approval: forApprovalRes.count ?? 0,
    approved:     approvedRes.count ?? 0,
  };
}

// ─── Fetch PO by ID with items ────────────────────────────────────────────────

export async function fetchPOById(id: string): Promise<POWithItems | null> {
  const [poRes, itemsRes] = await Promise.all([
    db.from('po_requests').select('*').eq('id', id).maybeSingle(),
    db.from('po_items')
      .select('*')
      .eq('po_id', id)
      .order('item_order', { ascending: true }),
  ]);
  if (poRes.error) throw poRes.error;
  if (!poRes.data) return null;
  return {
    ...normalizePO(poRes.data),
    items: (itemsRes.data ?? []).map(normalizeItem),
  };
}

// ─── Fetch PO by PR2 ID ───────────────────────────────────────────────────────

export async function fetchPOByPR2Id(pr2Id: string): Promise<PORequest | null> {
  const { data, error } = await db
    .from('po_requests')
    .select('*')
    .eq('pr2_id', pr2Id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return normalizePO(data);
}

// ─── Supplier payment terms (same resolution as generatePOFromPR2) ───────────

export async function fetchSupplierPaymentTermsForPR2(pr2Id: string): Promise<string | null> {
  const { data: items, error: itemsErr } = await db
    .from('pr2_items')
    .select('supplier_name_snapshot')
    .eq('pr2_id', pr2Id)
    .order('item_order', { ascending: true })
    .limit(1);
  if (itemsErr) throw itemsErr;
  const supplierName = items?.[0]?.supplier_name_snapshot ?? '';
  if (!String(supplierName).trim()) return null;

  const { data: supplierProfile, error: profErr } = await db
    .from('profiles')
    .select('payment_terms')
    .eq('full_name', supplierName)
    .maybeSingle();
  if (profErr) throw profErr;
  const raw = supplierProfile?.payment_terms;
  if (raw == null || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed || null;
}

// ─── Generate PO from approved PR2 ───────────────────────────────────────────

export async function generatePOFromPR2(
  pr2Id: string,
  formValues: POFormValues,
  profile: UserProfile
): Promise<string> {
  const now = new Date().toISOString();

  // Guard: PR2 must be phase2_approved
  const { data: pr2, error: pr2Err } = await db
    .from('pr2_requests')
    .select('id, status, pr2_number, pr1_number_snapshot, rfq_number_snapshot, requisitioner_name_snapshot, department_name_snapshot, purpose, date_required')
    .eq('id', pr2Id)
    .maybeSingle();
  if (pr2Err) throw pr2Err;
  if (!pr2) throw new Error('PR2 not found.');
  if (pr2.status !== 'phase2_approved') throw new Error('PO can only be generated from a fully approved PR2.');

  // Guard: buyer must supply a PO number
  const poNumber = formValues.po_number.trim();
  if (!poNumber) throw new Error('PO number is required.');

  // Guard: no duplicate PO for this PR2
  const { data: existing } = await db
    .from('po_requests')
    .select('id, po_number')
    .eq('pr2_id', pr2Id)
    .maybeSingle();
  if (existing?.id) throw new Error(`A PO already exists for this PR2: ${existing.po_number}`);

  // Guard: PO number must be unique across all POs
  const { data: dupNum } = await db
    .from('po_requests')
    .select('id')
    .eq('po_number', poNumber)
    .maybeSingle();
  if (dupNum?.id) throw new Error(`PO number "${poNumber}" is already in use. Please enter a unique PO number.`);

  // Fetch PR2 items
  const { data: pr2Items, error: itemsErr } = await db
    .from('pr2_items')
    .select('id, item_order, item_code, description, unit_of_measure, quantity_to_purchase, unit_price, total_price, supplier_name_snapshot')
    .eq('pr2_id', pr2Id)
    .order('item_order', { ascending: true });
  if (itemsErr) throw itemsErr;
  if (!pr2Items || pr2Items.length === 0) throw new Error('PR2 has no items to include in PO.');

  // Derive supplier from first item (all items share same supplier in current flow)
  const supplierName = pr2Items[0]?.supplier_name_snapshot ?? '';

  // Resolve supplier_id by matching full_name in profiles (supplier role)
  const { data: supplierProfile } = await db
    .from('profiles')
    .select('id, roles:role_id(name)')
    .eq('full_name', supplierName)
    .maybeSingle();
  const supplierId = supplierProfile?.id ?? null;

  // Insert PO header with buyer-supplied po_number
  const { data: po, error: poErr } = await db
    .from('po_requests')
    .insert({
      po_number:                   poNumber,
      pr2_id:                      pr2Id,
      pr2_number_snapshot:         pr2.pr2_number,
      pr1_number_snapshot:         pr2.pr1_number_snapshot,
      rfq_number_snapshot:         pr2.rfq_number_snapshot,
      supplier_name_snapshot:      supplierName,
      supplier_id:                 supplierId,
      requisitioner_name_snapshot: pr2.requisitioner_name_snapshot,
      department_name_snapshot:    pr2.department_name_snapshot,
      purpose:                     pr2.purpose,
      date_required:               pr2.date_required,
      po_date:                     formValues.po_date || new Date().toISOString().slice(0, 10),
      delivery_address:            formValues.delivery_address.trim(),
      warehouse:                   formValues.warehouse.trim(),
      payment_terms:               formValues.payment_terms.trim(),
      packing:                     formValues.packing.trim(),
      remarks:                     formValues.remarks.trim() || null,
      status:                      'draft',
      generated_by:                profile.id,
      generated_at:                now,
    })
    .select('id, po_number')
    .single();
  if (poErr) throw poErr;

  // Insert PO items — total_price recomputed from qty × unit_price (not copied from PR2)
  const poItems = pr2Items.map((item: any) => {
    const qty   = Number(item.quantity_to_purchase);
    const price = Number(item.unit_price);
    return {
      po_id:                  po.id,
      pr2_item_id:            item.id,
      item_order:             item.item_order,
      item_code:              item.item_code ?? '',
      description:            item.description,
      unit_of_measure:        item.unit_of_measure,
      quantity_to_purchase:   qty,
      unit_price:             price,
      total_price:            qty * price,
      supplier_name_snapshot: item.supplier_name_snapshot ?? supplierName,
    };
  });

  const { error: itemsInsertErr } = await db.from('po_items').insert(poItems);
  if (itemsInsertErr) throw itemsInsertErr;

  // Audit log
  await db.from('audit_logs').insert({
    actor_id:      profile.id,
    action:        'PO_GENERATED',
    document_type: 'PO',
    document_id:   po.id,
    payload: {
      po_number:   po.po_number,
      pr2_id:      pr2Id,
      pr2_number:  pr2.pr2_number,
      generated_by: profile.full_name,
    },
  });

  return po.id;
}

// ─── Normalize helpers ────────────────────────────────────────────────────────

function normalizePO(row: any): PORequest {
  return {
    id:                          row.id,
    po_number:                   row.po_number,
    pr2_id:                      row.pr2_id,
    pr2_number_snapshot:         row.pr2_number_snapshot,
    pr1_number_snapshot:         row.pr1_number_snapshot,
    rfq_number_snapshot:         row.rfq_number_snapshot,
    supplier_name_snapshot:      row.supplier_name_snapshot,
    supplier_id:                 row.supplier_id ?? null,
    requisitioner_name_snapshot: row.requisitioner_name_snapshot,
    department_name_snapshot:    row.department_name_snapshot,
    purpose:                     row.purpose,
    date_required:               row.date_required,
    po_date:                     row.po_date,
    delivery_address:            row.delivery_address,
    warehouse:                   row.warehouse,
    payment_terms:               row.payment_terms,
    packing:                     row.packing,
    remarks:                     row.remarks,
    status:                      row.status,
    generated_by:                row.generated_by,
    generated_at:                row.generated_at,
    created_at:                  row.created_at,
    updated_at:                  row.updated_at,
  };
}

function normalizeItem(row: any) {
  return {
    id:                    row.id,
    po_id:                 row.po_id,
    pr2_item_id:           row.pr2_item_id,
    item_order:            row.item_order,
    item_code:             row.item_code,
    description:           row.description,
    unit_of_measure:       row.unit_of_measure,
    quantity_to_purchase:  Number(row.quantity_to_purchase),
    unit_price:            Number(row.unit_price),
    total_price:           Number(row.total_price),
    supplier_name_snapshot: row.supplier_name_snapshot,
    remarks:               row.remarks,
    created_at:            row.created_at,
  };
}

export function calcPOGrandTotal(items: { unit_price: number; quantity_to_purchase: number }[]): number {
  return items.reduce((sum, i) => sum + i.unit_price * i.quantity_to_purchase, 0);
}
