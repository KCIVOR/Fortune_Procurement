import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/auth';
import type { PORequest, POWithItems, POFormValues, POGenerationCandidate } from '@/types/po';

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

// ─── Fetch PO(s) by PR2 ID ─────────────────────────────────────────────────────

/** All POs created from a given PR2 (one per supplier when multi-supplier awards). */
export async function fetchPOsByPR2Id(pr2Id: string): Promise<PORequest[]> {
  const { data, error } = await db
    .from('po_requests')
    .select('*')
    .eq('pr2_id', pr2Id)
    .order('generated_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(normalizePO);
}

export async function fetchPOByPR2AndSupplier(
  pr2Id: string,
  supplierProfileId: string
): Promise<PORequest | null> {
  const { data, error } = await db
    .from('po_requests')
    .select('*')
    .eq('pr2_id', pr2Id)
    .eq('supplier_id', supplierProfileId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return normalizePO(data);
}

/** @deprecated Multiple POs per PR2 exist when several suppliers are awarded; prefer fetchPOsByPR2Id. */
export async function fetchPOByPR2Id(pr2Id: string): Promise<PORequest | null> {
  const rows = await fetchPOsByPR2Id(pr2Id);
  return rows[0] ?? null;
}

// ─── PO generation candidates (approved PR2 × supplier groups) ────────────────

export async function fetchPOGenerationCandidates(): Promise<POGenerationCandidate[]> {
  const { data: pr2s, error: pr2Err } = await db
    .from('pr2_requests')
    .select('id, pr2_number, purpose, department_name_snapshot, requisitioner_name_snapshot, date_required')
    .eq('status', 'phase2_approved')
    .order('generated_at', { ascending: false });
  if (pr2Err) throw pr2Err;
  if (!pr2s?.length) return [];

  const pr2Ids = (pr2s as any[]).map((p: any) => p.id);

  const { data: allPOs } = await db
    .from('po_requests')
    .select('id, pr2_id, supplier_id')
    .in('pr2_id', pr2Ids);

  const poByPr2Supplier = new Map<string, string>();
  for (const po of (allPOs ?? []) as any[]) {
    if (po.supplier_id) {
      poByPr2Supplier.set(`${po.pr2_id}:${po.supplier_id}`, po.id);
    }
  }

  const { data: allItems, error: itemsErr } = await db
    .from('pr2_items')
    .select(
      'pr2_id, selected_rfq_supplier_id, supplier_name_snapshot, unit_price, quantity_to_purchase'
    )
    .in('pr2_id', pr2Ids);
  if (itemsErr) throw itemsErr;

  const rfqSupIds = new Set<string>();
  for (const it of (allItems ?? []) as any[]) {
    if (it.selected_rfq_supplier_id) rfqSupIds.add(it.selected_rfq_supplier_id);
  }

  let rsById: Record<string, { supplier_id: string; supplier_name_snapshot: string }> = {};
  if (rfqSupIds.size > 0) {
    const { data: rsRows, error: rsErr } = await db
      .from('rfq_suppliers')
      .select('id, supplier_id, supplier_name_snapshot')
      .in('id', Array.from(rfqSupIds));
    if (rsErr) throw rsErr;
    for (const r of (rsRows ?? []) as any[]) {
      rsById[r.id as string] = {
        supplier_id:            r.supplier_id as string,
        supplier_name_snapshot: r.supplier_name_snapshot as string,
      };
    }
  }

  type GroupAcc = {
    name:     string;
    rfqSids:  Set<string>;
    count:    number;
    total:    number;
  };

  const groupsByPr2 = new Map<string, Map<string, GroupAcc>>();
  for (const pr2 of pr2s as any[]) {
    groupsByPr2.set(pr2.id, new Map());
  }

  for (const it of (allItems ?? []) as any[]) {
    const sid = it.selected_rfq_supplier_id as string | null;
    if (!sid || !rsById[sid]) continue;
    const profileId = rsById[sid].supplier_id;
    const name =
      String(it.supplier_name_snapshot ?? '').trim() ||
      rsById[sid].supplier_name_snapshot;
    const pr2Map = groupsByPr2.get(it.pr2_id);
    if (!pr2Map) continue;

    if (!pr2Map.has(profileId)) {
      pr2Map.set(profileId, { name, rfqSids: new Set(), count: 0, total: 0 });
    }
    const g = pr2Map.get(profileId)!;
    g.rfqSids.add(sid);
    g.count += 1;
    g.total += Number(it.unit_price) * Number(it.quantity_to_purchase);
  }

  const candidates: POGenerationCandidate[] = [];
    for (const pr2 of pr2s as any[]) {
      const pr2Map = groupsByPr2.get(pr2.id)!;
      for (const [supplierId, g] of Array.from(pr2Map.entries())) {
      const existingPoId = poByPr2Supplier.get(`${pr2.id}:${supplierId}`) ?? null;
      candidates.push({
        candidateKey:              `${pr2.id}:${supplierId}`,
        pr2_id:                    pr2.id,
        pr2_number:                pr2.pr2_number,
        purpose:                   pr2.purpose,
        department_name_snapshot:  pr2.department_name_snapshot,
        requisitioner_name_snapshot: pr2.requisitioner_name_snapshot,
        date_required:             pr2.date_required,
        supplier_id:               supplierId,
        supplier_name_snapshot:      g.name,
        selected_rfq_supplier_ids:   Array.from(g.rfqSids),
        item_count:                  g.count,
        grand_total:                 g.total,
        has_po:                      !!existingPoId,
        existing_po_id:              existingPoId,
      });
    }
  }

  return candidates;
}

// ─── Supplier payment terms ────────────────────────────────────────────────────

export async function fetchSupplierPaymentTermsBySupplierName(supplierName: string): Promise<string | null> {
  const name = String(supplierName ?? '').trim();
  if (!name) return null;

  const { data: supplierProfile, error: profErr } = await db
    .from('profiles')
    .select('payment_terms')
    .eq('full_name', name)
    .maybeSingle();
  if (profErr) throw profErr;
  const raw = supplierProfile?.payment_terms;
  if (raw == null || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed || null;
}

/** @deprecated Use fetchSupplierPaymentTermsBySupplierName with the supplier for the PO candidate. */
export async function fetchSupplierPaymentTermsForPR2(pr2Id: string): Promise<string | null> {
  const { data: items, error: itemsErr } = await db
    .from('pr2_items')
    .select('supplier_name_snapshot')
    .eq('pr2_id', pr2Id)
    .order('item_order', { ascending: true })
    .limit(1);
  if (itemsErr) throw itemsErr;
  const supplierName = items?.[0]?.supplier_name_snapshot ?? '';
  return fetchSupplierPaymentTermsBySupplierName(String(supplierName));
}

// ─── Generate PO from approved PR2 (one supplier slice) ───────────────────────

export async function generatePOFromPR2(
  pr2Id: string,
  supplierProfileId: string,
  formValues: POFormValues,
  profile: UserProfile
): Promise<string> {
  const now = new Date().toISOString();

  if (!supplierProfileId?.trim()) {
    throw new Error('Supplier is required to generate a PO.');
  }

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

  // Guard: no duplicate PO for this PR2 + supplier
  const { data: existing } = await db
    .from('po_requests')
    .select('id, po_number')
    .eq('pr2_id', pr2Id)
    .eq('supplier_id', supplierProfileId)
    .maybeSingle();
  if (existing?.id) {
    throw new Error(`A PO already exists for this PR2 and supplier: ${existing.po_number}`);
  }

  // Guard: PO number must be unique across all POs
  const { data: dupNum } = await db
    .from('po_requests')
    .select('id')
    .eq('po_number', poNumber)
    .maybeSingle();
  if (dupNum?.id) throw new Error(`PO number "${poNumber}" is already in use. Please enter a unique PO number.`);

  // Fetch PR2 items (line-level supplier via selected_rfq_supplier_id → rfq_suppliers.supplier_id)
  const { data: pr2ItemsRaw, error: itemsErr } = await db
    .from('pr2_items')
    .select(
      'id, item_order, item_code, description, unit_of_measure, quantity_to_purchase, unit_price, total_price, supplier_name_snapshot, selected_rfq_supplier_id'
    )
    .eq('pr2_id', pr2Id)
    .order('item_order', { ascending: true });
  if (itemsErr) throw itemsErr;
  if (!pr2ItemsRaw || pr2ItemsRaw.length === 0) throw new Error('PR2 has no items to include in PO.');

  const rfqSids = Array.from(
    new Set(
      (pr2ItemsRaw as any[])
        .map((i: any) => i.selected_rfq_supplier_id)
        .filter(Boolean)
    )
  ) as string[];

  let profileByRfqSid: Record<string, string> = {};
  if (rfqSids.length > 0) {
    const { data: rsRows, error: rsErr } = await db
      .from('rfq_suppliers')
      .select('id, supplier_id')
      .in('id', rfqSids);
    if (rsErr) throw rsErr;
    profileByRfqSid = Object.fromEntries(
      ((rsRows ?? []) as any[]).map((r: any) => [r.id as string, r.supplier_id as string])
    );
  }

  const pr2Items = (pr2ItemsRaw as any[]).filter(
    (item: any) => profileByRfqSid[item.selected_rfq_supplier_id] === supplierProfileId
  );

  if (pr2Items.length === 0) {
    throw new Error('No PR2 lines are awarded to this supplier. Nothing to include in the PO.');
  }

  const supplierName = String(pr2Items[0]?.supplier_name_snapshot ?? '').trim();
  if (!supplierName) {
    throw new Error('Supplier name is missing on PR2 lines; cannot create PO header.');
  }

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
      supplier_id:                 supplierProfileId,
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

  // Insert PO items — only this supplier's PR2 lines; total_price recomputed
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
      supplier_name_snapshot: String(item.supplier_name_snapshot ?? '').trim() || supplierName,
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
      po_number:     po.po_number,
      pr2_id:        pr2Id,
      pr2_number:    pr2.pr2_number,
      supplier_id:   supplierProfileId,
      generated_by:  profile.full_name,
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
