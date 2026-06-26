import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/auth';
import type { PORequest, POWithItems, POFormValues, POGenerationCandidate } from '@/types/po';
import { fetchRfqQuoteAttachmentsByQuoteIds } from '@/lib/canvassing';
import type { RfqQuoteAttachment } from '@/types/canvassing';

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
  departmentId?: string;
  ids?: string[];
  limit?: number;
  offset?: number;
}

export async function listPOsWithCount(filters: POFilters = {}): Promise<{ pos: PORequest[]; total_count: number }> {
  const { limit = 25, offset = 0, search, status, departmentId, ids } = filters;

  const buildBaseQuery = () => {
    let query = db
      .from('po_requests')
      .select('*')
      .order('generated_at', { ascending: false });

    if (ids && ids.length > 0) {
      query = query.in('id', ids);
    }

    if (search && search.trim()) {
      const searchTerm = `%${search}%`;
      query = query.or(`po_number.ilike.${searchTerm},purpose.ilike.${searchTerm}`);
    }

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (departmentId) {
      query = query.eq('department_id', departmentId);
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

export async function fetchRevisionDraftPOIds(): Promise<string[]> {
  const db2 = supabase as any;
  const { data, error } = await db2
    .from('approval_instances')
    .select('document_id')
    .eq('document_type', 'PO')
    .eq('status', 'cancelled');
  if (error) throw error;
  if (!data || data.length === 0) return [];

  const cancelledPoIds = (data as any[]).map((r: any) => r.document_id as string);

  const { data: drafts, error: draftErr } = await db2
    .from('po_requests')
    .select('id')
    .eq('status', 'draft')
    .in('id', cancelledPoIds);
  if (draftErr) throw draftErr;

  return ((drafts ?? []) as any[]).map((r: any) => r.id as string);
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
      .select('*, pr2_items:pr2_item_id ( is_raw_material, quote_justification, rfq_item_quote_id )')
      .eq('po_id', id)
      .order('item_order', { ascending: true }),
  ]);
  if (poRes.error) throw poRes.error;
  if (!poRes.data) return null;

  const po = normalizePO(poRes.data);

  const rawItems: any[] = itemsRes.data ?? [];
  const quoteIds = rawItems
    .map((r: any) => r.pr2_items?.rfq_item_quote_id)
    .filter((id: string | null | undefined): id is string => !!id);

  const [quoteAttachmentsByQuote, pr2Res] = await Promise.all([
    quoteIds.length > 0
      ? fetchRfqQuoteAttachmentsByQuoteIds(quoteIds).catch(() => ({} as Record<string, RfqQuoteAttachment[]>))
      : Promise.resolve({} as Record<string, RfqQuoteAttachment[]>),
    db.from('pr2_requests').select('pr1_id').eq('id', po.pr2_id).maybeSingle(),
  ]);

  let request_type: 'goods' | 'services' = 'goods';
  if (pr2Res.data?.pr1_id) {
    const { data: pr1Data } = await db.from('pr1_requests').select('request_type').eq('id', pr2Res.data.pr1_id).maybeSingle();
    request_type = (pr1Data as any)?.request_type ?? 'goods';
  }

  return {
    ...po,
    request_type,
    items: rawItems.map(r => normalizeItem(r, quoteAttachmentsByQuote)),
  };
}

// ─── Fetch PO(s) by PR2 ID ─────────────────────────────────────────────────────

/** All POs created from a given PR2 (one per supplier when multi-supplier awards). */
export async function fetchPOsByPR2Id(pr2Id: string): Promise<PORequest[]> {
  const { data, error } = await db
    .from('po_requests')
    .select('*')
    .eq('pr2_id', pr2Id)
    .order('generated_at', { ascending: false });
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
    .eq('status', 'approved')
    .order('generated_at', { ascending: false });
  if (pr2Err) throw pr2Err;
  if (!pr2s?.length) return [];

  const pr2Ids = (pr2s as any[]).map((p: any) => p.id);

  const { data: allPOs } = await db
    .from('po_requests')
    .select('id, pr2_id, supplier_id')
    .in('pr2_id', pr2Ids);

  // Existing-PO dedup map, keyed by `${pr2_id}:${groupKey}` where groupKey is the
  // supplier profile id, or `ext:<rfq_supplier_id>` for external vendors.
  const poByPr2Supplier = new Map<string, string>();
  for (const po of (allPOs ?? []) as any[]) {
    if (po.supplier_id) {
      poByPr2Supplier.set(`${po.pr2_id}:${po.supplier_id}`, po.id);
    }
  }

  // External POs have a null supplier_id — resolve their group via their items'
  // pr2_items.selected_rfq_supplier_id so they dedup against external candidates.
  const externalPoIds = ((allPOs ?? []) as any[]).filter(po => !po.supplier_id).map(po => po.id);
  if (externalPoIds.length > 0) {
    const { data: extPoItems } = await db
      .from('po_items')
      .select('po_id, pr2_item_id')
      .in('po_id', externalPoIds);
    const extPr2ItemIds = Array.from(
      new Set(((extPoItems ?? []) as any[]).map(i => i.pr2_item_id).filter(Boolean))
    ) as string[];
    if (extPr2ItemIds.length > 0) {
      const { data: extPr2Items } = await db
        .from('pr2_items')
        .select('id, pr2_id, selected_rfq_supplier_id')
        .in('id', extPr2ItemIds);
      const pr2ItemById: Record<string, { pr2_id: string; selected_rfq_supplier_id: string | null }> =
        Object.fromEntries(((extPr2Items ?? []) as any[]).map(r => [r.id, r]));
      for (const it of (extPoItems ?? []) as any[]) {
        const row = pr2ItemById[it.pr2_item_id];
        if (row?.selected_rfq_supplier_id) {
          poByPr2Supplier.set(`${row.pr2_id}:ext:${row.selected_rfq_supplier_id}`, it.po_id);
        }
      }
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

  let rsById: Record<string, { supplier_id: string | null; supplier_name_snapshot: string; is_external: boolean }> = {};
  if (rfqSupIds.size > 0) {
    const { data: rsRows, error: rsErr } = await db
      .from('rfq_suppliers')
      .select('id, supplier_id, supplier_name_snapshot, is_external')
      .in('id', Array.from(rfqSupIds));
    if (rsErr) throw rsErr;
    for (const r of (rsRows ?? []) as any[]) {
      rsById[r.id as string] = {
        supplier_id:            (r.supplier_id as string | null) ?? null,
        supplier_name_snapshot: r.supplier_name_snapshot as string,
        is_external:            r.is_external === true,
      };
    }
  }

  type GroupAcc = {
    name:        string;
    supplier_id: string | null;
    is_external: boolean;
    rfqSids:     Set<string>;
    count:       number;
    total:       number;
  };

  const groupsByPr2 = new Map<string, Map<string, GroupAcc>>();
  for (const pr2 of pr2s as any[]) {
    groupsByPr2.set(pr2.id, new Map());
  }

  for (const it of (allItems ?? []) as any[]) {
    const sid = it.selected_rfq_supplier_id as string | null;
    if (!sid || !rsById[sid]) continue;
    const { supplier_id, is_external } = rsById[sid];
    // Group key: profile id for registered suppliers (unchanged), or a
    // per-vendor-slot key for external vendors so distinct external vendors on
    // the same PR2 never collapse under a shared null key.
    const groupKey = supplier_id ?? `ext:${sid}`;
    const name =
      String(it.supplier_name_snapshot ?? '').trim() ||
      rsById[sid].supplier_name_snapshot;
    const pr2Map = groupsByPr2.get(it.pr2_id);
    if (!pr2Map) continue;

    if (!pr2Map.has(groupKey)) {
      pr2Map.set(groupKey, { name, supplier_id, is_external, rfqSids: new Set(), count: 0, total: 0 });
    }
    const g = pr2Map.get(groupKey)!;
    g.rfqSids.add(sid);
    g.count += 1;
    g.total += Number(it.unit_price) * Number(it.quantity_to_purchase);
  }

  const candidates: POGenerationCandidate[] = [];
    for (const pr2 of pr2s as any[]) {
      const pr2Map = groupsByPr2.get(pr2.id)!;
      for (const [groupKey, g] of Array.from(pr2Map.entries())) {
      const existingPoId = poByPr2Supplier.get(`${pr2.id}:${groupKey}`) ?? null;
      candidates.push({
        candidateKey:              `${pr2.id}:${groupKey}`,
        pr2_id:                    pr2.id,
        pr2_number:                pr2.pr2_number,
        purpose:                   pr2.purpose,
        department_name_snapshot:  pr2.department_name_snapshot,
        requisitioner_name_snapshot: pr2.requisitioner_name_snapshot,
        date_required:             pr2.date_required,
        supplier_id:               g.supplier_id,
        supplier_name_snapshot:      g.name,
        is_external:                 g.is_external,
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

export async function fetchSupplierPaymentTermsBySupplierId(
  supplierProfileId: string,
): Promise<string | null> {
  const id = String(supplierProfileId ?? '').trim();
  if (!id) return null;

  const { data: supplierProfile, error: profErr } = await db
    .from('profiles')
    .select('payment_terms')
    .eq('id', id)
    .maybeSingle();
  if (profErr) throw profErr;
  const raw = supplierProfile?.payment_terms;
  if (raw == null || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed || null;
}

/** @deprecated Prefer fetchSupplierPaymentTermsBySupplierId — name matching is fragile. */
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

/** @deprecated Use fetchSupplierPaymentTermsBySupplierId with the PO candidate supplier_id. */
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

/** Next 4-digit suffix for PO-{year}-#### (e.g. 0001). Guide only — not reserved. */
export async function fetchSuggestedPOSequence(year?: number): Promise<string> {
  const y = year ?? new Date().getFullYear();
  const prefix = `PO-${y}-`;

  const { data, error } = await db
    .from('po_requests')
    .select('po_number')
    .ilike('po_number', `${prefix}%`);

  if (error) throw error;

  let max = 0;
  const re = new RegExp(`^PO-${y}-(\\d+)`, 'i');
  for (const row of data ?? []) {
    const num = String((row as { po_number?: string }).po_number ?? '');
    const match = num.match(re);
    if (!match) continue;
    const parsed = parseInt(match[1], 10);
    if (!Number.isNaN(parsed) && parsed > max) max = parsed;
  }

  return String(max + 1).padStart(4, '0');
}

// ─── Generate PO from approved PR2 (one supplier slice) ───────────────────────

export async function generatePOFromPR2(
  pr2Id: string,
  supplierProfileId: string | null,
  formValues: POFormValues,
  profile: UserProfile,
  // The exact winning rfq_supplier slots for this candidate. Required for
  // external vendors (null supplier_id); optional for registered suppliers,
  // where the legacy supplier_id filter still applies if omitted.
  selectedRfqSupplierIds?: string[],
): Promise<string> {
  const now = new Date().toISOString();

  const isExternal = !supplierProfileId;
  if (isExternal && (!selectedRfqSupplierIds || selectedRfqSupplierIds.length === 0)) {
    throw new Error('Cannot generate PO: no awarded vendor slot identified.');
  }

  // Guard: PR2 must be approved
  const { data: pr2, error: pr2Err } = await db
    .from('pr2_requests')
    .select('id, status, pr2_number, pr1_number_snapshot, rfq_number_snapshot, requisitioner_name_snapshot, department_name_snapshot, department_id, purpose, date_required')
    .eq('id', pr2Id)
    .maybeSingle();
  if (pr2Err) throw pr2Err;
  if (!pr2) throw new Error('PR2 not found.');
  if (pr2.status !== 'approved') throw new Error('PO can only be generated from a fully approved PR2.');

  // Guard: buyer must supply a PO number
  const poNumber = formValues.po_number.trim();
  if (!poNumber) throw new Error('PO number is required.');

  // Guard: no duplicate PO for this PR2 + supplier.
  // Registered suppliers dedup on supplier_id. External vendors (null
  // supplier_id) dedup by checking whether an existing PO already contains the
  // same awarded vendor slots.
  if (!isExternal) {
    const { data: existing } = await db
      .from('po_requests')
      .select('id, po_number')
      .eq('pr2_id', pr2Id)
      .eq('supplier_id', supplierProfileId)
      .maybeSingle();
    if (existing?.id) {
      throw new Error(`A PO already exists for this PR2 and supplier: ${existing.po_number}`);
    }
  } else {
    const { data: existingExtPOs } = await db
      .from('po_requests')
      .select('id, po_number, po_items:po_items ( pr2_item:pr2_item_id ( selected_rfq_supplier_id ) )')
      .eq('pr2_id', pr2Id)
      .is('supplier_id', null);
    const winning = new Set(selectedRfqSupplierIds);
    for (const epo of (existingExtPOs ?? []) as any[]) {
      const overlaps = (epo.po_items ?? []).some(
        (pi: any) => pi.pr2_item?.selected_rfq_supplier_id && winning.has(pi.pr2_item.selected_rfq_supplier_id)
      );
      if (overlaps) {
        throw new Error(`A PO already exists for this external vendor on this PR2: ${epo.po_number}`);
      }
    }
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

  // Filter to this candidate's PR2 lines.
  // Preferred: filter by the exact awarded vendor slots (works for both external
  // and registered, and is the precise set the candidate was built from).
  // Fallback (legacy callers that omit selectedRfqSupplierIds): match by the
  // supplier profile resolved from each line's rfq_supplier.
  let pr2Items: any[];
  if (selectedRfqSupplierIds && selectedRfqSupplierIds.length > 0) {
    const winning = new Set(selectedRfqSupplierIds);
    pr2Items = (pr2ItemsRaw as any[]).filter(
      (item: any) => item.selected_rfq_supplier_id && winning.has(item.selected_rfq_supplier_id)
    );
  } else {
    let profileByRfqSid: Record<string, string | null> = {};
    if (rfqSids.length > 0) {
      const { data: rsRows, error: rsErr } = await db
        .from('rfq_suppliers')
        .select('id, supplier_id')
        .in('id', rfqSids);
      if (rsErr) throw rsErr;
      profileByRfqSid = Object.fromEntries(
        ((rsRows ?? []) as any[]).map((r: any) => [r.id as string, (r.supplier_id as string | null) ?? null])
      );
    }
    pr2Items = (pr2ItemsRaw as any[]).filter(
      (item: any) => profileByRfqSid[item.selected_rfq_supplier_id] === supplierProfileId
    );
  }

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
      supplier_id:                 supplierProfileId ?? null,
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
      department_id:               pr2.department_id ?? null,
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
    department_id:               row.department_id ?? null,
    request_type:                (row.request_type ?? 'goods') as 'goods' | 'services',
    status:                      row.status,
    generated_by:                row.generated_by,
    generated_at:                row.generated_at,
    created_at:                  row.created_at,
    updated_at:                  row.updated_at,
  };
}

function normalizeItem(row: any, quoteAttachmentsByQuote: Record<string, RfqQuoteAttachment[]> = {}) {
  const pr2Item = row.pr2_items ?? null;
  const rfqItemQuoteId: string | null = pr2Item?.rfq_item_quote_id ?? null;
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
    is_raw_material:       pr2Item?.is_raw_material === true,
    quote_justification:   pr2Item?.quote_justification ?? null,
    rfq_item_quote_id:     rfqItemQuoteId,
    quote_attachments:     rfqItemQuoteId ? (quoteAttachmentsByQuote[rfqItemQuoteId] ?? []) : [],
    created_at:            row.created_at,
  };
}

export function calcPOGrandTotal(items: { unit_price: number; quantity_to_purchase: number }[]): number {
  return items.reduce((sum, i) => sum + i.unit_price * i.quantity_to_purchase, 0);
}

export async function updatePODraft(
  poId: string,
  values: { po_date: string; delivery_address: string; warehouse: string; payment_terms: string; packing: string; remarks: string }
): Promise<void> {
  const { error } = await db
    .from('po_requests')
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq('id', poId)
    .eq('status', 'draft');
  if (error) throw error;
}
