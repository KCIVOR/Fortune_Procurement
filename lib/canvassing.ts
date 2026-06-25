import { supabase } from '@/lib/supabase';
import { authFetch } from '@/lib/authenticated-fetch';
import type { UserProfile } from '@/types/auth';
import { fetchPR1Attachments } from './pr1';
import type { PR1Attachment } from '@/types/pr1';
import { createNotification, notifyByRole } from '@/lib/notifications';
import type {
  RfqBatch,
  RfqSupplier,
  RfqItemQuote,
  CanvassingQueueRow,
  RfqDetailView,
  QuoteMatrixRow,
  SupplierRfqInboxRow,
  SubstituteDecisionRow,
  SubstituteDecision,
  SubstituteReviewItem,
  SubstituteReviewBundle,
  CatalogProductSummary,
  CanvassSupplierCandidate,
  RfqQuoteResponseStatus,
  RfqQuoteAttachment,
} from '@/types/canvassing';

const db = supabase as any;

// ─── Warehouse-routed RFQ lines (Phase 2) ─────────────────────────────────────
// When warehouse validation is complete, only lines with procurement_qty > 0 appear in
// RFQ/canvassing; quantity_requested on each row is the procurement quantity. Historical
// RFQs may still have quotes on other lines — those pr1_item_ids are included for display.

type Pr1ItemRfqRow = {
  id: string;
  pr1_id: string;
  item_order: number;
  item_code: string;
  description: string;
  unit_of_measure: string;
  quantity_requested: number;
  /** Phase 4 (Raw Mats): forwarded from pr1_items so RFQ surfaces can render the badge. */
  is_raw_material?: boolean;
  attachments?: PR1Attachment[];
};

export async function fetchWarehouseProcurementByPr1Item(
  pr1Id: string
): Promise<{ validated: boolean; byPr1ItemId: Record<string, number> }> {
  const { data: wv } = await db
    .from('warehouse_validations')
    .select('id, validated_at')
    .eq('pr1_id', pr1Id)
    .maybeSingle();

  const validated = Boolean(wv?.validated_at);
  const byPr1ItemId: Record<string, number> = {};
  if (validated && wv?.id) {
    const { data: rows } = await db
      .from('warehouse_validation_items')
      .select('pr1_item_id, procurement_qty')
      .eq('validation_id', wv.id);
    for (const r of rows ?? []) {
      const id = (r as any).pr1_item_id as string;
      byPr1ItemId[id] = Number((r as any).procurement_qty ?? 0);
    }
  }
  return { validated, byPr1ItemId };
}

/** RFQ matrix / supplier quotation line list. */
function buildRfqLineItems(
  pr1Items: Pr1ItemRfqRow[],
  warehouse: { validated: boolean; byPr1ItemId: Record<string, number> },
  legacyReferencedPr1ItemIds: Set<string>,
): RfqDetailView['items'] {
  const pr1Qty = (i: Pr1ItemRfqRow) => Number(i.quantity_requested) || 0;

  if (!warehouse.validated) {
    return pr1Items.map(i => ({
      id:                 i.id,
      item_order:         i.item_order,
      item_code:          i.item_code,
      description:        i.description,
      unit_of_measure:    i.unit_of_measure,
      quantity_requested: pr1Qty(i),
      is_raw_material:    i.is_raw_material === true,
      attachments:        i.attachments,
    }));
  }

  const procurementIdSet = new Set(
    pr1Items.filter(i => (warehouse.byPr1ItemId[i.id] ?? 0) > 0).map(i => i.id),
  );

  const out: RfqDetailView['items'] = [];

  for (const i of pr1Items) {
    const procQty = warehouse.byPr1ItemId[i.id] ?? 0;
    if (procQty > 0) {
      out.push({
        id:                     i.id,
        item_order:             i.item_order,
        item_code:              i.item_code,
        description:            i.description,
        unit_of_measure:        i.unit_of_measure,
        quantity_requested:      procQty,
        pr1_quantity_requested: pr1Qty(i),
        is_raw_material:        i.is_raw_material === true,
        attachments:            i.attachments,
      });
    }
  }

  for (const i of pr1Items) {
    if (legacyReferencedPr1ItemIds.has(i.id) && !procurementIdSet.has(i.id)) {
      const q = pr1Qty(i);
      out.push({
        id:                     i.id,
        item_order:             i.item_order,
        item_code:              i.item_code,
        description:            i.description,
        unit_of_measure:        i.unit_of_measure,
        quantity_requested:      q,
        pr1_quantity_requested: q,
        is_raw_material:        i.is_raw_material === true,
        attachments:            i.attachments,
      });
    }
  }

  out.sort((a, b) => a.item_order - b.item_order);

  const seen = new Set<string>();
  return out.filter(row => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

async function collectLegacyPr1ItemIdsForRfq(rfqId: string): Promise<Set<string>> {
  const { data: rsRows } = await db.from('rfq_suppliers').select('id').eq('rfq_id', rfqId);
  const supplierIds = (rsRows ?? []).map((r: any) => r.id as string);
  const ids = new Set<string>();
  if (supplierIds.length > 0) {
    const { data: quoteRows } = await db
      .from('rfq_item_quotes')
      .select('pr1_item_id')
      .in('rfq_supplier_id', supplierIds);
    for (const q of quoteRows ?? []) ids.add((q as any).pr1_item_id as string);
  }
  const { data: selRows } = await db
    .from('supplier_item_selections')
    .select('pr1_item_id')
    .eq('rfq_id', rfqId);
  for (const s of selRows ?? []) ids.add((s as any).pr1_item_id as string);
  return ids;
}

/** Count of RFQ lines per PR1 (procurement-only when warehouse validated). */
async function fetchRfqLineCountsByPr1Id(pr1Ids: string[]): Promise<Record<string, number>> {
  if (pr1Ids.length === 0) return {};
  const { data: itemRows } = await db.from('pr1_items').select('pr1_id').in('pr1_id', pr1Ids);
  const rawCount: Record<string, number> = {};
  for (const r of itemRows ?? []) {
    const pid = (r as any).pr1_id as string;
    rawCount[pid] = (rawCount[pid] ?? 0) + 1;
  }
  const { data: wvs } = await db
    .from('warehouse_validations')
    .select('id, pr1_id, validated_at')
    .in('pr1_id', pr1Ids);

  const valIdByPr1: Record<string, string> = {};
  for (const w of (wvs ?? []) as any[]) {
    if (w.validated_at) valIdByPr1[w.pr1_id as string] = w.id as string;
  }
  const validationIds = Array.from(new Set(Object.values(valIdByPr1)));
  let wvis: any[] = [];
  if (validationIds.length > 0) {
    const { data } = await db
      .from('warehouse_validation_items')
      .select('validation_id, procurement_qty')
      .in('validation_id', validationIds);
    wvis = data ?? [];
  }
  const procurementCountByValidation: Record<string, number> = {};
  for (const w of wvis) {
    if (Number(w.procurement_qty ?? 0) <= 0) continue;
    procurementCountByValidation[w.validation_id] =
      (procurementCountByValidation[w.validation_id] ?? 0) + 1;
  }

  const out: Record<string, number> = { ...rawCount };
  for (const pid of pr1Ids) {
    const vid = valIdByPr1[pid];
    if (!vid) continue;
    out[pid] = procurementCountByValidation[vid] ?? 0;
  }
  return out;
}

// ─── Canvassing queue (procurement) ──────────────────────────────────────────
// Returns PR1s with status=for_canvassing, joined with their RFQ if one exists.

export async function fetchCanvassingQueue(): Promise<CanvassingQueueRow[]> {
  const { data: pr1s, error: pr1Err } = await db
    .from('pr1_requests')
    .select('id, pr1_number, requisitioner_name_snapshot, department_name_snapshot, purpose, priority, request_type, date_required, submitted_at')
    .in('status', ['for_canvassing', 'canvassing_complete'])
    .order('submitted_at', { ascending: true });

  if (pr1Err) throw pr1Err;
  if (!pr1s || pr1s.length === 0) return [];

  const pr1Ids = (pr1s as any[]).map((r: any) => r.id);

  const { data: rfqs, error: rfqErr } = await db
    .from('rfq_batches')
    .select('id, pr1_id, rfq_number, status')
    .in('pr1_id', pr1Ids);

  if (rfqErr) throw rfqErr;

  const rfqMap: Record<string, any> = {};
  for (const rfq of (rfqs ?? []) as any[]) {
    rfqMap[rfq.pr1_id] = rfq;
  }

  return (pr1s as any[]).map((pr1: any) => {
    const rfq = rfqMap[pr1.id] ?? null;
    return {
      pr1_id:                      pr1.id,
      pr1_number:                  pr1.pr1_number,
      requisitioner_name_snapshot: pr1.requisitioner_name_snapshot,
      department_name_snapshot:    pr1.department_name_snapshot,
      purpose:                     pr1.purpose,
      priority:                    pr1.priority ?? 'normal',
      date_required:               pr1.date_required,
      submitted_at:                pr1.submitted_at,
      rfq_id:                      rfq?.id ?? null,
      rfq_number:                  rfq?.rfq_number ?? null,
      rfq_status:                  rfq?.status ?? null,
      request_type:                (pr1.request_type ?? 'goods') as 'goods' | 'services',
    };
  });
}

// ─── Canvassing queue: paginated ─────────────────────────────────────────────

const CANVASSING_QUEUE_PR1_SELECT =
  'id, pr1_number, requisitioner_name_snapshot, department_name_snapshot, purpose, priority, request_type, date_required, submitted_at';

export async function fetchCanvassingQueuePaged(options: {
  limit: number;
  offset: number;
  search?: string;
  departmentId?: string;
}): Promise<{ rows: CanvassingQueueRow[]; total_count: number }> {
  const { limit, offset, search, departmentId } = options;
  const term = search?.trim();

  let pr1IdsMatchingRfqNumber: string[] = [];
  if (term) {
    const pattern = `%${term}%`;
    const { data: rfqHits, error: rfqSearchErr } = await db
      .from('rfq_batches')
      .select('pr1_id')
      .ilike('rfq_number', pattern);
    if (rfqSearchErr) throw rfqSearchErr;
    pr1IdsMatchingRfqNumber = Array.from(
      new Set((rfqHits ?? []).map((r: any) => r.pr1_id).filter(Boolean))
    );
  }

  const applyFilters = (q: any) => {
    q = q.in('status', ['for_canvassing', 'canvassing_complete']);
    if (term) {
      const p = `%${term}%`;
      const orParts = [
        `pr1_number.ilike.${p}`,
        `purpose.ilike.${p}`,
        `department_name_snapshot.ilike.${p}`,
        `requisitioner_name_snapshot.ilike.${p}`,
      ];
      if (pr1IdsMatchingRfqNumber.length > 0) {
        orParts.push(`id.in.(${pr1IdsMatchingRfqNumber.join(',')})`);
      }
      q = q.or(orParts.join(','));
    }
    if (departmentId) {
      q = q.eq('department_id', departmentId);
    }
    return q;
  };

  const [pr1sRes, countRes] = await Promise.all([
    applyFilters(db.from('pr1_requests').select(CANVASSING_QUEUE_PR1_SELECT))
      .order('submitted_at', { ascending: true })
      .range(offset, offset + limit - 1),
    applyFilters(db.from('pr1_requests').select('id', { count: 'exact', head: true })),
  ]);

  if (pr1sRes.error) throw pr1sRes.error;
  if (countRes.error) throw countRes.error;

  const pr1s = pr1sRes.data ?? [];
  if (pr1s.length === 0) return { rows: [], total_count: countRes.count ?? 0 };

  const pr1Ids = (pr1s as any[]).map((r: any) => r.id);

  const { data: rfqs, error: rfqErr } = await db
    .from('rfq_batches')
    .select('id, pr1_id, rfq_number, status')
    .in('pr1_id', pr1Ids);

  if (rfqErr) throw rfqErr;

  const rfqMap: Record<string, any> = {};
  for (const rfq of (rfqs ?? []) as any[]) {
    rfqMap[rfq.pr1_id] = rfq;
  }

  return {
    rows: (pr1s as any[]).map((pr1: any) => {
      const rfq = rfqMap[pr1.id] ?? null;
      return {
        pr1_id:                      pr1.id,
        pr1_number:                  pr1.pr1_number,
        requisitioner_name_snapshot: pr1.requisitioner_name_snapshot,
        department_name_snapshot:    pr1.department_name_snapshot,
        purpose:                     pr1.purpose,
        priority:                    pr1.priority ?? 'normal',
        date_required:               pr1.date_required,
        submitted_at:                pr1.submitted_at,
        rfq_id:                      rfq?.id ?? null,
        rfq_number:                  rfq?.rfq_number ?? null,
        rfq_status:                  rfq?.status ?? null,
        request_type:                (pr1.request_type ?? 'goods') as 'goods' | 'services',
      };
    }),
    total_count: countRes.count ?? 0,
  };
}

// ─── RFQ detail (procurement) ─────────────────────────────────────────────────

export async function fetchRfqDetail(rfqId: string): Promise<RfqDetailView | null> {
  const { data: rfq, error: rfqErr } = await db
    .from('rfq_batches')
    .select('*')
    .eq('id', rfqId)
    .maybeSingle();

  if (rfqErr) throw rfqErr;
  if (!rfq) return null;

  const [pr1Res, itemsRes, suppliersRes, attachments] = await Promise.all([
    db.from('pr1_requests')
      .select('id, pr1_number, requisitioner_name_snapshot, department_name_snapshot, purpose, date_required, request_type')
      .eq('id', rfq.pr1_id)
      .maybeSingle(),
    db.from('pr1_items')
      .select('id, pr1_id, item_order, item_code, description, unit_of_measure, quantity_requested, is_raw_material')
      .eq('pr1_id', rfq.pr1_id)
      .order('item_order', { ascending: true }),
    db.from('rfq_suppliers')
      .select('*')
      .eq('rfq_id', rfqId),
    fetchPR1Attachments(rfq.pr1_id).catch(() => []),
  ]);

  if (pr1Res.error) throw pr1Res.error;
  if (!pr1Res.data) return null;
  if (itemsRes.error) throw itemsRes.error;

  const rawItems = (itemsRes.data ?? []) as any[];
  const attachmentsByItem: Record<string, PR1Attachment[]> = {};
  for (const att of attachments) {
    if (!attachmentsByItem[att.pr1_item_id]) attachmentsByItem[att.pr1_item_id] = [];
    attachmentsByItem[att.pr1_item_id].push(att);
  }
  const pr1Items = rawItems.map((item) => ({
    ...item,
    attachments: attachmentsByItem[item.id] ?? [],
  })) as Pr1ItemRfqRow[];

  const warehouse = await fetchWarehouseProcurementByPr1Item(rfq.pr1_id);
  const legacyIds = await collectLegacyPr1ItemIdsForRfq(rfqId);
  const items = buildRfqLineItems(pr1Items, warehouse, legacyIds);

  const assignedSuppliers: any[] = suppliersRes.data ?? [];
  const supplierIds = assignedSuppliers.map((s: any) => s.id);

  // Optional data — never throw, fall back to empty
  let quotes: any[] = [];
  let selections: any[] = [];

  const [selectionsRes, quotesRes] = await Promise.all([
    db.from('supplier_item_selections').select('*').eq('rfq_id', rfqId),
    supplierIds.length > 0
      ? db.from('rfq_item_quotes').select('*').in('rfq_supplier_id', supplierIds)
      : Promise.resolve({ data: [] }),
  ]);
  quotes     = quotesRes.data ?? [];
  selections = selectionsRes.data ?? [];

  // Fetch substitute decisions for this PR1 (covers all alternative quotes in the RFQ)
  let substituteDecisions: SubstituteDecisionRow[] = [];
  const { data: decisionData } = await db
    .from('substitute_decisions')
    .select('*')
    .eq('pr1_id', rfq.pr1_id);
  substituteDecisions = (decisionData ?? []) as SubstituteDecisionRow[];

  // All supplier profiles for canvassing + assign name snapshots — enrichment for modal
  const { data: roles } = await db.from('roles').select('id').eq('name', 'supplier');
  const supplierRoleId = (roles ?? [])[0]?.id ?? null;
  let allSuppliers: CanvassSupplierCandidate[] = [];
  if (supplierRoleId) {
    const { data: profileRows } = await db
      .from('profiles')
      .select('id, full_name, email')
      .eq('role_id', supplierRoleId)
      .order('full_name', { ascending: true });

    const profiles = (profileRows ?? []) as {
      id: string;
      full_name: string;
      email: string | null;
    }[];

    const candidateUserIds = profiles.map(p => p.id);
    const latestAccBySupplier: Record<string, string | null> = {};
    const countsBySupplier: Record<
      string,
      { v: number; vg: number; vs: number; p: number; r: number; w: number }
    > = {};

    for (const id of candidateUserIds) {
      latestAccBySupplier[id] = null;
      countsBySupplier[id] = { v: 0, vg: 0, vs: 0, p: 0, r: 0, w: 0 };
    }

    if (candidateUserIds.length > 0) {
      const [accRes, prodRes] = await Promise.all([
        db
          .from('supplier_accreditations')
          .select('supplier_id, status, created_at')
          .in('supplier_id', candidateUserIds),
        db
          .from('supplier_products')
          .select('supplier_id, status, item_type')
          .in('supplier_id', candidateUserIds),
      ]);

      const accRows = (accRes.data ?? []) as {
        supplier_id: string;
        status: string;
        created_at: string;
      }[];
      const bySupplierAcc: Record<string, typeof accRows> = {};
      for (const row of accRows) {
        if (!bySupplierAcc[row.supplier_id]) bySupplierAcc[row.supplier_id] = [];
        bySupplierAcc[row.supplier_id].push(row);
      }

      for (const sid of candidateUserIds) {
        const rows = bySupplierAcc[sid];
        if (!rows?.length) {
          latestAccBySupplier[sid] = null;
        } else {
          rows.sort(
            (a, b) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          latestAccBySupplier[sid] = rows[0].status;
        }
      }

      for (const row of (prodRes.data ?? []) as {
        supplier_id: string;
        status: string;
        item_type: string;
      }[]) {
        const bucket = countsBySupplier[row.supplier_id];
        if (!bucket) continue;
        const st = row.status;
        const isService = (row.item_type ?? 'goods') === 'services';
        if (st === 'verified') {
          bucket.v++;
          if (isService) bucket.vs++; else bucket.vg++;
        } else if (
          st === 'submitted' ||
          st === 'under_review' ||
          st === 'pending_tsqa'
        ) {
          bucket.p++;
        } else if (st === 'rejected') bucket.r++;
        else if (st === 'withdrawn') bucket.w++;
      }
    }

    allSuppliers = profiles.map(p => ({
      id:                      p.id,
      full_name:               p.full_name,
      email:                   p.email ?? null,
      accreditation_status:    latestAccBySupplier[p.id] ?? null,
      verified_product_count:  countsBySupplier[p.id]?.v  ?? 0,
      verified_goods_count:    countsBySupplier[p.id]?.vg ?? 0,
      verified_service_count:  countsBySupplier[p.id]?.vs ?? 0,
      pending_product_count:   countsBySupplier[p.id]?.p  ?? 0,
      rejected_product_count:  countsBySupplier[p.id]?.r  ?? 0,
      withdrawn_product_count: countsBySupplier[p.id]?.w  ?? 0,
    }));
  }

  // Enrich quotes with supplier-uploaded attachments
  const quoteAttachmentsByQuote = await fetchRfqQuoteAttachmentsByRfq(rfqId).catch(() => ({} as Record<string, RfqQuoteAttachment[]>));
  quotes = (quotes as any[]).map((q: any) => ({
    ...q,
    attachments: quoteAttachmentsByQuote[q.id] ?? [],
  }));

  // Phase 7: build a product lookup map for quotes that carry a supplier_product_id
  const productLookup: Record<string, CatalogProductSummary> = {};
  const linkedProductIds = Array.from(
    new Set(
      (quotes as any[])
        .map((q: any) => q.supplier_product_id as string | null)
        .filter((id): id is string => !!id)
    )
  );
  if (linkedProductIds.length > 0) {
    const { data: products } = await db
      .from('supplier_products')
      .select('id, product_name, product_code, status, item_type')
      .in('id', linkedProductIds);
    for (const p of (products ?? []) as any[]) {
      productLookup[p.id as string] = {
        product_name: p.product_name as string,
        product_code: p.product_code as string | null,
        status:       p.status as string,
        item_type:    ((p.item_type ?? 'goods') as 'goods' | 'services'),
      };
    }
  }

  return {
    rfq,
    pr1:        pr1Res.data,
    items,
    suppliers:  assignedSuppliers,
    quotes,
    selections,
    substituteDecisions,
    allSuppliers,
    productLookup,
  };
}

// ─── Build quote comparison matrix ───────────────────────────────────────────

export function buildQuoteMatrix(detail: RfqDetailView): QuoteMatrixRow[] {
  const decisionByQuoteId: Record<string, SubstituteDecision> = {};
  for (const d of detail.substituteDecisions) {
    decisionByQuoteId[d.rfq_item_quote_id] = d.decision;
  }

  return detail.items.map(item => {
    const selection = detail.selections.find(s => s.pr1_item_id === item.id);

    const quotes = detail.suppliers.map(supplier => {
      const quote = detail.quotes.find(
        q => q.rfq_supplier_id === supplier.id && q.pr1_item_id === item.id
      );

      // Phase 7: enrich with catalog product data from the lookup map
      const productId   = quote?.supplier_product_id ?? null;
      const productInfo = productId ? (detail.productLookup[productId] ?? null) : null;

      const responseStatus: RfqQuoteResponseStatus =
        quote?.response_status === 'no_quote' ? 'no_quote' : 'quoted';
      const noQuoteReason =
        responseStatus === 'no_quote' ? (quote?.no_quote_reason?.trim() || null) : null;

      // Phase 6 (Raw Mats): coarse verification state for the comparison pill.
      // Independent from the `is_alternative` substitute workflow.
      let verificationStatus: 'verified' | 'unverified' | 'manual' | undefined;
      if (quote && responseStatus !== 'no_quote') {
        if (!productId) {
          verificationStatus = 'manual';
        } else if (productInfo?.status === 'verified') {
          verificationStatus = 'verified';
        } else {
          verificationStatus = 'unverified';
        }
      }

      return {
        rfq_supplier_id:         supplier.id,
        quote_id:                quote?.id ?? null,
        supplier_name:           supplier.supplier_name_snapshot,
        quoted_description:      quote?.quoted_description ?? '',
        is_alternative:          quote?.is_alternative ?? false,
        unit_price:              quote ? Number(quote.unit_price) : 0,
        lead_time_days:          quote?.lead_time_days ?? 0,
        remarks:                 quote?.remarks ?? null,
        total_price:             quote ? Number(quote.unit_price) * item.quantity_requested : 0,
        is_selected:             selection?.selected_rfq_supplier_id === supplier.id,
        substitute_decision:     quote ? decisionByQuoteId[quote.id] ?? null : null,
        supplier_product_id:        productId,
        supplier_product_name:      productInfo?.product_name  ?? null,
        supplier_product_code:      productInfo?.product_code  ?? null,
        supplier_product_status:    productInfo?.status        ?? null,
        supplier_product_item_type: productInfo?.item_type     ?? null,
        verification_status:     verificationStatus,
        response_status:         responseStatus,
        no_quote_reason:         noQuoteReason,
        attachments:             quote?.attachments ?? [],
      };
    });

    return {
      item,
      quotes,
      selected_rfq_supplier_id: selection?.selected_rfq_supplier_id ?? null,
    };
  });
}

// ─── Create RFQ ───────────────────────────────────────────────────────────────

export async function createRfq(
  pr1Id: string,
  deadline: string | null,
  notes: string,
  profile: UserProfile
): Promise<string> {
  // Idempotency: return existing RFQ if one already exists for this PR1.
  const { data: existing } = await db
    .from('rfq_batches')
    .select('id')
    .eq('pr1_id', pr1Id)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: pr1ItemsRows, error: piErr } = await db
    .from('pr1_items')
    .select('id, pr1_id, item_order, item_code, description, unit_of_measure, quantity_requested, is_raw_material')
    .eq('pr1_id', pr1Id)
    .order('item_order', { ascending: true });
  if (piErr) throw piErr;

  const warehouse = await fetchWarehouseProcurementByPr1Item(pr1Id);
  const rfqLines = buildRfqLineItems(
    (pr1ItemsRows ?? []) as Pr1ItemRfqRow[],
    warehouse,
    new Set(),
  );
  if (warehouse.validated && rfqLines.length === 0) {
    throw new Error(
      'This request has no items requiring procurement (warehouse resolved all lines internally). ' +
      'An RFQ is not applicable.',
    );
  }

  const now = new Date().toISOString();

  // Generate rfq_number via DB sequence function — collision-safe.
  const { data: rfqNum, error: numErr } = await (supabase as any).rpc('generate_rfq_number');
  if (numErr) throw numErr;
  const rfq_number = rfqNum as string;

  const { data, error } = await db
    .from('rfq_batches')
    .insert({
      pr1_id:     pr1Id,
      rfq_number,
      status:     'draft',
      issued_by:  profile.id,
      deadline:   deadline || null,
      notes:      notes.trim() || null,
      updated_at: now,
    })
    .select('id')
    .single();

  // Race condition: another request inserted between our check and insert.
  // The UNIQUE(pr1_id) constraint fires — fetch and return the winner.
  if (error) {
    if (error.code === '23505') {
      const { data: race } = await db
        .from('rfq_batches')
        .select('id')
        .eq('pr1_id', pr1Id)
        .maybeSingle();
      if (race?.id) return race.id;
    }
    throw error;
  }

  await db.from('audit_logs').insert({
    actor_id:      profile.id,
    action:        'RFQ_CREATED',
    document_type: 'RFQ',
    document_id:   data.id,
    payload:       { rfq_number, pr1_id: pr1Id },
  });

  return data.id;
}

// ─── Assign suppliers to RFQ ─────────────────────────────────────────────────

export async function assignSuppliers(
  rfqId: string,
  supplierIds: string[],
  allSuppliers: Pick<CanvassSupplierCandidate, 'id' | 'full_name'>[],
  profile: UserProfile,
): Promise<void> {
  const nameMap = Object.fromEntries(allSuppliers.map(s => [s.id, s.full_name]));

  // Dedup guard: skip suppliers already assigned to this RFQ so retries /
  // double-clicks can't create duplicate invitations.
  const { data: existing, error: existingErr } = await db
    .from('rfq_suppliers')
    .select('supplier_id')
    .eq('rfq_id', rfqId)
    .not('supplier_id', 'is', null);
  if (existingErr) throw existingErr;

  const alreadyAssigned = new Set(
    (existing ?? []).map((r: { supplier_id: string }) => r.supplier_id),
  );
  const toInsert = supplierIds.filter(id => !alreadyAssigned.has(id));

  if (toInsert.length === 0) return;

  const rows = toInsert.map(id => ({
    rfq_id:                 rfqId,
    supplier_id:            id,
    supplier_name_snapshot: nameMap[id] ?? '',
    status:                 'invited',
    invited_at:             new Date().toISOString(),
  }));

  const { error } = await db.from('rfq_suppliers').insert(rows);
  if (error) throw error;

  try {
    await db.from('audit_logs').insert({
      actor_id:      profile.id,
      action:        'RFQ_SUPPLIERS_ASSIGNED',
      document_type: 'RFQ',
      document_id:   rfqId,
      payload:       { supplier_ids: toInsert, count: toInsert.length },
    });
  } catch {}
}

// ─── Add external vendor (no supplier account) ────────────────────────────────
// Procurement adds an off-system vendor (e.g. Shopee, Lazada, a walk-in store)
// to an RFQ. There is no invite/response cycle — Procurement enters the quote on
// the vendor's behalf in the canvassing matrix — so the row is created directly
// in 'submitted' status with a null supplier_id and is_external = true.
export async function addExternalVendorToRfq(
  rfqId: string,
  vendorName: string,
  profile: UserProfile,
): Promise<void> {
  const name = vendorName.trim();
  if (!name) throw new Error('Vendor name is required.');

  // Dedup guard: reject an external vendor name already on this RFQ
  // (case-insensitive) so retries / double-clicks don't duplicate it.
  const { data: existing, error: existingErr } = await db
    .from('rfq_suppliers')
    .select('id')
    .eq('rfq_id', rfqId)
    .eq('is_external', true)
    .ilike('supplier_name_snapshot', name);
  if (existingErr) throw existingErr;
  if (existing && existing.length > 0) {
    throw new Error(`"${name}" is already added to this RFQ.`);
  }

  const { error } = await db.from('rfq_suppliers').insert({
    rfq_id:                 rfqId,
    supplier_id:            null,
    supplier_name_snapshot: name,
    is_external:            true,
    status:                 'submitted',
    invited_at:             new Date().toISOString(),
  });
  if (error) throw error;

  try {
    await db.from('audit_logs').insert({
      actor_id:      profile.id,
      action:        'RFQ_EXTERNAL_VENDOR_ADDED',
      document_type: 'RFQ',
      document_id:   rfqId,
      payload:       { vendor_name: name },
    });
  } catch {}
}

// ─── Fetch quote ID for a specific supplier+item combination ─────────────────
// Used by the external quote modal to resolve the rfq_item_quote id after
// submitSupplierQuotation so that file attachments can be linked to it.
export async function fetchQuoteIdForSupplierItem(
  rfqSupplierId: string,
  pr1ItemId: string,
): Promise<string | null> {
  const { data } = await db
    .from('rfq_item_quotes')
    .select('id')
    .eq('rfq_supplier_id', rfqSupplierId)
    .eq('pr1_item_id', pr1ItemId)
    .maybeSingle();
  return (data as any)?.id ?? null;
}

// ─── Remove external vendor (draft RFQ only, no quotes) ──────────────────────
// Blocked if the RFQ is no longer draft, the slot belongs to a registered
// supplier, or any rfq_item_quotes rows already exist (FK is NO ACTION —
// the DB would reject the delete anyway; we surface a clear message instead).
export async function removeExternalVendorFromRfq(
  rfqSupplierId: string,
): Promise<void> {
  // Fetch the slot and its RFQ status in one join
  const { data: rs, error: rsErr } = await db
    .from('rfq_suppliers')
    .select('id, is_external, rfq_id, rfq_batches!rfq_id ( status )')
    .eq('id', rfqSupplierId)
    .maybeSingle();
  if (rsErr) throw rsErr;
  if (!rs) throw new Error('Vendor slot not found.');
  if (!rs.is_external) throw new Error('Only external vendors can be removed this way.');

  const rfqStatus = (rs.rfq_batches as any)?.status ?? null;
  if (rfqStatus !== 'draft') {
    throw new Error('External vendors can only be removed while the RFQ is still a draft.');
  }

  // Guard: no quotes entered yet (FK is NO ACTION; this gives a clear error)
  const { count } = await db
    .from('rfq_item_quotes')
    .select('id', { count: 'exact', head: true })
    .eq('rfq_supplier_id', rfqSupplierId);
  if ((count ?? 0) > 0) {
    throw new Error(
      'This vendor already has quotes entered. Remove the quotes first, or leave the vendor on the RFQ.',
    );
  }

  const { error } = await db.from('rfq_suppliers').delete().eq('id', rfqSupplierId);
  if (error) throw error;
}

// ─── Issue RFQ (draft → open) ─────────────────────────────────────────────────

export async function issueRfq(rfqId: string, profile: UserProfile): Promise<void> {
  const now = new Date().toISOString();

  // 1. Update status
  const { error } = await db
    .from('rfq_batches')
    .update({ status: 'open', issued_at: now, updated_at: now })
    .eq('id', rfqId)
    .eq('status', 'draft');

  if (error) throw error;

  // 2. Audit log
  await db.from('audit_logs').insert({
    actor_id:      profile.id,
    action:        'RFQ_ISSUED',
    document_type: 'RFQ',
    document_id:   rfqId,
    payload:       { issued_by: profile.full_name },
  });

  // 3. Notify each invited supplier (best-effort)
  try {
    // Fetch RFQ + PR1 details for the email
    const { data: rfq } = await db
      .from('rfq_batches')
      .select('rfq_number, deadline, notes, pr1_id')
      .eq('id', rfqId)
      .single();
    
    if (!rfq) return;

    const { data: pr1 } = await db
      .from('pr1_requests')
      .select('department_name_snapshot, purpose')
      .eq('id', rfq.pr1_id)
      .single();

    if (!pr1) return;

    // Fetch assigned suppliers
    const { data: suppliers } = await db
      .from('rfq_suppliers')
      .select('id, supplier_id')
      .eq('rfq_id', rfqId);

    // External vendors have supplier_id = null — exclude them from all notification
    // and email paths (they have no portal account to notify).
    const supplierRows: { id: string; supplier_id: string }[] =
      ((suppliers ?? []) as { id: string; supplier_id: string | null }[])
        .filter((s): s is { id: string; supplier_id: string } => !!s.supplier_id);
    if (supplierRows.length === 0) return;

    const supplierUserIds = supplierRows.map(s => s.supplier_id);

    // Fetch supplier emails
    const { data: profiles } = await db
      .from('profiles')
      .select('id, email')
      .in('id', supplierUserIds);
    
    const emailMap = Object.fromEntries(
      ((profiles ?? []) as { id: string; email: string | null }[]).map(p => [p.id, p.email])
    );

    // Internal Notifications
    const { data: existing } = await db
      .from('notifications')
      .select('user_id')
      .eq('document_id', rfqId)
      .eq('type', 'action_required')
      .eq('read', false)
      .in('user_id', supplierUserIds);

    const notifiedSet = new Set<string>((existing ?? []).map((n: any) => n.user_id as string));

    await Promise.all(
      supplierRows
        .filter(s => !notifiedSet.has(s.supplier_id))
        .map(s =>
          createNotification({
            user_id:       s.supplier_id,
            title:         'RFQ Issued',
            body:          'You have been invited to submit a quotation.',
            type:          'action_required',
            document_type: 'rfq',
            document_id:   rfqId,
            action_url:    `/supplier/quotations/${s.id}`,
          })
        )
    );

    // External Email via Resend API Route
    const emailTargets = supplierRows
      .filter(s => emailMap[s.supplier_id])
      .map(s => ({
        email: emailMap[s.supplier_id],
        actionUrl: `/supplier/quotations/${s.id}`
      }));

    if (emailTargets.length > 0) {
      await authFetch('/api/rfq/send-email', {
        method: 'POST',
        body: JSON.stringify({
          rfqId,
          rfqNumber: rfq.rfq_number,
          department: pr1.department_name_snapshot,
          purpose: pr1.purpose,
          deadline: rfq.deadline,
          supplierEmails: emailTargets.map(t => t.email),
          actionUrls: emailTargets.map(t => t.actionUrl),
        }),
      });
    }
  } catch (err) {
    console.error('IssueRfq notifications error:', err);
    // Notifications are best-effort; do not fail issueRfq
  }
}


// ─── Close RFQ ────────────────────────────────────────────────────────────────

export async function closeRfq(rfqId: string, pr1Id: string, profile: UserProfile): Promise<void> {
  const now = new Date().toISOString();

  const { error: rfqErr } = await db
    .from('rfq_batches')
    .update({ status: 'closed', updated_at: now })
    .eq('id', rfqId)
    .eq('status', 'open');

  if (rfqErr) throw rfqErr;

  const { error: pr1Err } = await db
    .from('pr1_requests')
    .update({ status: 'canvassing_complete', updated_at: now })
    .eq('id', pr1Id);

  if (pr1Err) throw pr1Err;

  await db.from('audit_logs').insert({
    actor_id:      profile.id,
    action:        'RFQ_CLOSED',
    document_type: 'RFQ',
    document_id:   rfqId,
    payload:       { closed_by: profile.full_name, pr1_id: pr1Id },
  });

  try {
    const [{ data: pr1 }, { data: rfq }] = await Promise.all([
      db.from('pr1_requests').select('pr1_number, requisitioner_id').eq('id', pr1Id).maybeSingle(),
      db.from('rfq_batches').select('rfq_number').eq('id', rfqId).maybeSingle(),
    ]);

    const pr1Label = pr1?.pr1_number ?? 'PR1';

    await notifyByRole(
      'procurement',
      {
        title:         'Canvassing Complete',
        body:          `RFQ for ${pr1Label} is closed. Review quotes and proceed to PR2.`,
        type:          'action_required',
        document_type: 'rfq',
        document_id:   rfqId,
        action_url:    `/rfq/${rfqId}`,
      },
      { dedupeUnreadForDocument: true }
    );

    if (pr1?.requisitioner_id) {
      await createNotification({
        user_id:       pr1.requisitioner_id,
        title:         'Canvassing Complete',
        body:          `Canvassing is complete for your request ${pr1Label}.`,
        type:          'info',
        document_type: 'pr1',
        document_id:   pr1Id,
        action_url:    `/pr1/${pr1Id}`,
      });
    }
  } catch {
    // Notifications are best-effort; do not fail closeRfq
  }
}

// ─── Save supplier selection ──────────────────────────────────────────────────

/**
 * Phase 7 (Raw Mats): structured result of a selection attempt.
 * - `{ ok: true }` — selection persisted.
 * - `{ ok: false, reason: 'needs_justification', context }` — caller must
 *   open the justification modal and re-invoke with `justification` filled.
 *
 * Other failures still throw (existing behaviour) so the call site can keep
 * its single-error toast path.
 */
export type SaveItemSelectionResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'needs_justification';
      context: {
        rfqId: string;
        pr1ItemId: string;
        rfqSupplierId: string;
        verification: 'unverified' | 'manual';
        productName: string | null;
        productStatus: string | null;
      };
    };

/** Phase 7 (Raw Mats): minimum justification length enforced at the app layer. */
export const QUOTE_JUSTIFICATION_MIN_LENGTH = 10;

export async function saveItemSelection(
  rfqId: string,
  pr1ItemId: string,
  selectedRfqSupplierId: string,
  notes: string,
  profile: UserProfile,
  /**
   * Phase 7 (Raw Mats): optional. Provide on the second call when the first
   * call returned `{ ok: false, reason: 'needs_justification' }`. Ignored
   * when justification is not required.
   */
  justification?: string,
): Promise<SaveItemSelectionResult> {
  const now = new Date().toISOString();

  // Fetch the quote row — used for both the substitute guard and the
  // catalog-product / raw-mats logic below.
  const { data: quote } = await db
    .from('rfq_item_quotes')
    .select('id, is_alternative, supplier_product_id, response_status')
    .eq('rfq_supplier_id', selectedRfqSupplierId)
    .eq('pr1_item_id', pr1ItemId)
    .maybeSingle();

  if (!quote) {
    throw new Error('Cannot select quote: no quote found for that supplier on this line.');
  }

  // Guard 0 (Phase 5): explicit no-quote rows can never be awarded.
  if (quote.response_status === 'no_quote') {
    throw new Error('This supplier marked the line as “No Quote” and cannot be awarded.');
  }

  // Guard 1 (existing): alternative quotes require requestor acceptance.
  if (quote.is_alternative) {
    const { data: decision } = await db
      .from('substitute_decisions')
      .select('decision')
      .eq('rfq_item_quote_id', quote.id)
      .maybeSingle();

    if (!decision) {
      throw new Error('This is a substitute item. Requestor must approve before selection.');
    }
    if (decision.decision === 'rejected') {
      throw new Error('Requestor rejected this substitute. Choose a different supplier.');
    }
  }

  // Guard 2 (Phase 7 refactor): determine whether the quote is verified,
  // unverified (linked but not 'verified'), or manual (no link).
  let verification: 'verified' | 'unverified' | 'manual';
  let productName: string | null = null;
  let productStatus: string | null = null;

  if (!quote.supplier_product_id) {
    verification = 'manual';
  } else {
    const { data: product, error: productErr } = await db
      .from('supplier_products')
      .select('product_name, status')
      .eq('id', quote.supplier_product_id)
      .maybeSingle();

    if (productErr) throw productErr;
    if (!product) {
      throw new Error('Cannot select quote: the linked catalog product could not be found.');
    }

    productName   = (product as any).product_name as string;
    productStatus = (product as any).status as string;
    verification  = productStatus === 'verified' ? 'verified' : 'unverified';
  }

  // Guard 3 (Phase 7): raw-mats lines awarded against an unverified or
  // manual quote require a written justification. Look up the PR1 line
  // to determine the raw-mats flag.
  const { data: pr1Item } = await db
    .from('pr1_items')
    .select('is_raw_material')
    .eq('id', pr1ItemId)
    .maybeSingle();

  const isRawMaterial = (pr1Item as any)?.is_raw_material === true;
  const requiresJustification =
    isRawMaterial && (verification === 'unverified' || verification === 'manual');

  if (requiresJustification) {
    const trimmed = (justification ?? '').trim();
    if (trimmed.length < QUOTE_JUSTIFICATION_MIN_LENGTH) {
      // Signal the caller to open the justification modal. We deliberately
      // do not throw — the call site already handles thrown errors via toast,
      // but a justification request is a workflow signal, not an error.
      // `verification` here is narrowed to 'unverified' | 'manual' by the
      // requiresJustification predicate above; cast for the narrower type.
      return {
        ok: false,
        reason: 'needs_justification',
        context: {
          rfqId,
          pr1ItemId,
          rfqSupplierId: selectedRfqSupplierId,
          verification: verification as 'unverified' | 'manual',
          productName,
          productStatus,
        },
      };
    }
  }

  const finalJustification = requiresJustification
    ? (justification ?? '').trim()
    : null;

  const { error } = await db
    .from('supplier_item_selections')
    .upsert(
      {
        rfq_id:                   rfqId,
        pr1_item_id:              pr1ItemId,
        selected_rfq_supplier_id: selectedRfqSupplierId,
        selected_by:              profile.id,
        selected_at:              now,
        selection_notes:          notes.trim() || null,
        quote_justification:      finalJustification,
        requires_justification:   requiresJustification,
      },
      { onConflict: 'rfq_id,pr1_item_id' }
    );

  if (error) throw error;

  return { ok: true };
}

/** Clear procurement's winner selection for one RFQ line (RFQ must still be open). */
export async function clearItemSelection(
  rfqId: string,
  pr1ItemId: string,
  profile: UserProfile,
): Promise<void> {
  const { data: rfq, error: rfqErr } = await db
    .from('rfq_batches')
    .select('status')
    .eq('id', rfqId)
    .maybeSingle();

  if (rfqErr) throw rfqErr;
  if (!rfq) throw new Error('RFQ not found.');
  if (rfq.status !== 'open') {
    throw new Error('Cannot change selection — this RFQ is no longer open.');
  }

  const { error } = await db
    .from('supplier_item_selections')
    .delete()
    .eq('rfq_id', rfqId)
    .eq('pr1_item_id', pr1ItemId);

  if (error) throw error;

  await db.from('audit_logs').insert({
    actor_id:      profile.id,
    action:        'RFQ_SELECTION_CLEARED',
    document_type: 'RFQ',
    document_id:   rfqId,
    payload:       { pr1_item_id: pr1ItemId },
  });
}

// ─── Substitute item review (requestor) ─────────────────────────────────────

/**
 * Fetch all alternative-flagged quotes across every PR1 the given requestor owns,
 * plus each decision state. Used by the requestor inbox / notification count.
 */
export async function fetchSubstitutesForRequestor(
  requisitionerId: string
): Promise<SubstituteReviewBundle[]> {
  const { data: pr1s, error: pr1Err } = await db
    .from('pr1_requests')
    .select('id, pr1_number, purpose, department_name_snapshot, requisitioner_id')
    .eq('requisitioner_id', requisitionerId);

  if (pr1Err || !pr1s || pr1s.length === 0) return [];

  const pr1Ids = (pr1s as any[]).map((r: any) => r.id);

  const bundles = await Promise.all(
    (pr1s as any[]).map((pr1: any) => loadSubstitutesForPr1(pr1))
  );

  return bundles.filter(b => b !== null && b.substitutes.length > 0) as SubstituteReviewBundle[];
}

/**
 * Load the substitute-review bundle for a single PR1. Returns null if the
 * requestor has no permission (RLS will zero-fill), or no PR1 exists.
 */
export async function fetchSubstituteBundleForPr1(
  pr1Id: string
): Promise<SubstituteReviewBundle | null> {
  const { data: pr1 } = await db
    .from('pr1_requests')
    .select('id, pr1_number, purpose, department_name_snapshot, requisitioner_id')
    .eq('id', pr1Id)
    .maybeSingle();

  if (!pr1) return null;
  return loadSubstitutesForPr1(pr1);
}

async function loadSubstitutesForPr1(pr1: any): Promise<SubstituteReviewBundle | null> {
  // Find all RFQ batches linked to this PR1
  const { data: rfqs } = await db
    .from('rfq_batches')
    .select('id, rfq_number')
    .eq('pr1_id', pr1.id);

  const rfqArr: any[] = rfqs ?? [];
  if (rfqArr.length === 0) {
    return { pr1, substitutes: [] };
  }

  const rfqIds = rfqArr.map(r => r.id);

  // rfq_suppliers for these RFQs
  const { data: rfqSuppliers } = await db
    .from('rfq_suppliers')
    .select('id, rfq_id, supplier_name_snapshot')
    .in('rfq_id', rfqIds);

  const supplierArr: any[] = rfqSuppliers ?? [];
  if (supplierArr.length === 0) {
    return { pr1, substitutes: [] };
  }

  const rfqSupplierIds = supplierArr.map(rs => rs.id);

  // All alternative quotes
  const { data: quotes } = await db
    .from('rfq_item_quotes')
    .select('*')
    .in('rfq_supplier_id', rfqSupplierIds)
    .eq('is_alternative', true)
    .not('submitted_at', 'is', null);

  const quoteArr: any[] = quotes ?? [];
  if (quoteArr.length === 0) {
    return { pr1, substitutes: [] };
  }

  // Items + decisions in parallel
  const itemIds = Array.from(new Set(quoteArr.map(q => q.pr1_item_id)));
  const quoteIds = quoteArr.map(q => q.id);

  const [itemsRes, decisionsRes, attachmentsByQuote] = await Promise.all([
    db.from('pr1_items')
      .select('id, item_order, item_code, description, unit_of_measure, quantity_requested')
      .in('id', itemIds),
    db.from('substitute_decisions')
      .select('*')
      .in('rfq_item_quote_id', quoteIds),
    fetchRfqQuoteAttachmentsByQuoteIds(quoteIds).catch(() => ({} as Record<string, RfqQuoteAttachment[]>)),
  ]);

  const itemMap: Record<string, any> = Object.fromEntries(((itemsRes.data ?? []) as any[]).map((i: any) => [i.id, i]));
  const supplierMap: Record<string, any> = Object.fromEntries(supplierArr.map(rs => [rs.id, rs]));
  const rfqMap: Record<string, any> = Object.fromEntries(rfqArr.map(r => [r.id, r]));
  const decisionMap: Record<string, SubstituteDecisionRow> = Object.fromEntries(
    ((decisionsRes.data ?? []) as SubstituteDecisionRow[]).map(d => [d.rfq_item_quote_id, d])
  );

  const wh = await fetchWarehouseProcurementByPr1Item(pr1.id);
  const rfqQtyForItem = (pr1ItemId: string, pr1LineQty: number) => {
    if (!wh.validated) return pr1LineQty;
    const p = wh.byPr1ItemId[pr1ItemId];
    return p !== undefined && p > 0 ? p : pr1LineQty;
  };

  const substitutes: SubstituteReviewItem[] = quoteArr
    .map((q: any): SubstituteReviewItem | null => {
      const item     = itemMap[q.pr1_item_id];
      const supplier = supplierMap[q.rfq_supplier_id];
      if (!item || !supplier) return null;
      const rfq = rfqMap[supplier.rfq_id];
      const decision = decisionMap[q.id] ?? null;
      return {
        quote_id:             q.id,
        rfq_id:               supplier.rfq_id,
        rfq_number:           rfq?.rfq_number ?? '',
        rfq_supplier_id:      supplier.id,
        supplier_name:        supplier.supplier_name_snapshot,
        pr1_item_id:          item.id,
        item_order:           item.item_order,
        item_code:            item.item_code,
        original_description: item.description,
        original_quantity: rfqQtyForItem(item.id, Number(item.quantity_requested) || 0),
        unit_of_measure:      item.unit_of_measure,
        quoted_description:   q.quoted_description,
        unit_price:           Number(q.unit_price),
        lead_time_days:       q.lead_time_days,
        remarks:              q.remarks,
        submitted_at:         q.submitted_at,
        decision:             decision?.decision ?? null,
        decided_at:           decision?.decided_at ?? null,
        decision_notes:       decision?.notes ?? null,
        attachments:          attachmentsByQuote[q.id] ?? [],
      };
    })
    .filter((s): s is SubstituteReviewItem => s !== null)
    .sort((a, b) => a.item_order - b.item_order);

  return { pr1, substitutes };
}

export async function saveSubstituteDecision(
  quoteId: string,
  pr1Id: string,
  decision: SubstituteDecision,
  notes: string,
  profile: UserProfile
): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await db
    .from('substitute_decisions')
    .upsert(
      {
        rfq_item_quote_id: quoteId,
        pr1_id:            pr1Id,
        decision,
        decided_by:        profile.id,
        decided_at:        now,
        notes:             notes.trim() || null,
      },
      { onConflict: 'rfq_item_quote_id' }
    );

  if (error) throw error;

  await db.from('audit_logs').insert({
    actor_id:      profile.id,
    action:        decision === 'accepted' ? 'SUBSTITUTE_ACCEPTED' : 'SUBSTITUTE_REJECTED',
    document_type: 'RFQ_QUOTE',
    document_id:   quoteId,
    payload:       { pr1_id: pr1Id, notes },
  });

  try {
    const { data: quote } = await db
      .from('rfq_item_quotes')
      .select('quoted_description, rfq_supplier_id')
      .eq('id', quoteId)
      .maybeSingle();

    const [{ data: pr1 }, { data: rs }] = await Promise.all([
      db.from('pr1_requests').select('pr1_number').eq('id', pr1Id).maybeSingle(),
      quote?.rfq_supplier_id
        ? db
            .from('rfq_suppliers')
            .select('rfq_id, supplier_name_snapshot')
            .eq('id', quote.rfq_supplier_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    if (!rs?.rfq_id) return;

    const pr1Label     = pr1?.pr1_number ?? 'PR1';
    const supplierName = rs.supplier_name_snapshot ?? 'A supplier';
    const itemDesc     = (quote?.quoted_description ?? 'substitute item').trim();
    const accepted     = decision === 'accepted';

    await notifyByRole('procurement', {
      title:         accepted ? 'Substitute Item Accepted' : 'Substitute Item Rejected',
      body:          `Requestor ${accepted ? 'accepted' : 'rejected'} ${supplierName}'s substitute offer "${itemDesc}" for ${pr1Label}.`,
      type:          'info',
      document_type: 'rfq',
      document_id:   rs.rfq_id,
      action_url:    `/rfq/${rs.rfq_id}`,
    });
  } catch {
    // Notifications are best-effort; do not fail substitute decision
  }
}

export async function fetchPendingSubstituteCount(requisitionerId: string): Promise<number> {
  const bundles = await fetchSubstitutesForRequestor(requisitionerId);
  return bundles.reduce(
    (sum, b) => sum + b.substitutes.filter(s => s.decision === null).length,
    0
  );
}

// ─── Supplier inbox ───────────────────────────────────────────────────────────

export async function fetchSupplierInbox(supplierId: string): Promise<SupplierRfqInboxRow[]> {
  const { data: assignments, error: assErr } = await db
    .from('rfq_suppliers')
    .select('id, rfq_id, supplier_name_snapshot, status, invited_at, responded_at')
    .eq('supplier_id', supplierId);

  if (assErr) throw assErr;
  if (!assignments || assignments.length === 0) return [];

  const rfqIds = (assignments as any[]).map((a: any) => a.rfq_id);

  const { data: rfqs, error: rfqErr } = await db
    .from('rfq_batches')
    .select('id, rfq_number, status, deadline, pr1_id')
    .in('id', rfqIds);

  if (rfqErr) throw rfqErr;

  const pr1Ids: string[] = Array.from(
    new Set((rfqs ?? []).map((r: any) => r.pr1_id as string)),
  );

  const itemCounts = await fetchRfqLineCountsByPr1Id(pr1Ids);

  const [pr1Res, quotesRes] = await Promise.all([
    db.from('pr1_requests')
      .select('id, pr1_number, department_name_snapshot, purpose')
      .in('id', pr1Ids),
    db.from('rfq_item_quotes')
      .select('rfq_supplier_id, pr1_item_id, submitted_at')
      .in('rfq_supplier_id', (assignments as any[]).map((a: any) => a.id)),
  ]);

  const rfqMap:   Record<string, any> = Object.fromEntries(((rfqs ?? []) as any[]).map((r: any) => [r.id, r]));
  const pr1Map:   Record<string, any> = Object.fromEntries(((pr1Res.data ?? []) as any[]).map((r: any) => [r.id, r]));
  const quotesArr: any[] = quotesRes.data ?? [];

  return (assignments as any[]).map((assignment: any) => {
    const rfq = rfqMap[assignment.rfq_id];
    const pr1 = rfq ? pr1Map[rfq.pr1_id] : null;
    const quotesForThis = quotesArr.filter(
      q => q.rfq_supplier_id === assignment.id && q.submitted_at !== null
    );

    return {
      rfq_supplier_id:  assignment.id,
      rfq_id:           assignment.rfq_id,
      rfq_number:       rfq?.rfq_number ?? '',
      rfq_status:       rfq?.status ?? 'open',
      rfq_deadline:     rfq?.deadline ?? null,
      supplier_status:  assignment.status,
      pr1_number:       pr1?.pr1_number ?? '',
      department_name:  pr1?.department_name_snapshot ?? '',
      purpose:          pr1?.purpose ?? '',
      item_count:       rfq ? (itemCounts[rfq.pr1_id] ?? 0) : 0,
      quotes_submitted: quotesForThis.length,
    };
  });
}

// ─── Supplier RFQ inbox: paginated ───────────────────────────────────────────

export async function fetchSupplierInboxPaged(
  supplierId: string,
  options: { limit: number; offset: number }
): Promise<{ inbox: SupplierRfqInboxRow[]; total_count: number }> {
  const { limit, offset } = options;

  const [assignmentsRes, countRes] = await Promise.all([
    db
      .from('rfq_suppliers')
      .select('id, rfq_id, supplier_name_snapshot, status, invited_at, responded_at')
      .eq('supplier_id', supplierId)
      .order('invited_at', { ascending: false })
      .range(offset, offset + limit - 1),
    db
      .from('rfq_suppliers')
      .select('id', { count: 'exact', head: true })
      .eq('supplier_id', supplierId),
  ]);

  if (assignmentsRes.error) throw assignmentsRes.error;
  if (countRes.error) throw countRes.error;

  const assignments = assignmentsRes.data ?? [];
  if (assignments.length === 0) return { inbox: [], total_count: countRes.count ?? 0 };

  const rfqIds = (assignments as any[]).map((a: any) => a.rfq_id);

  const { data: rfqs, error: rfqErr } = await db
    .from('rfq_batches')
    .select('id, rfq_number, status, deadline, pr1_id')
    .in('id', rfqIds);

  if (rfqErr) throw rfqErr;

  const pr1Ids: string[] = Array.from(
    new Set(((rfqs ?? []) as any[]).map((r: any) => r.pr1_id as string)),
  );

  const itemCounts = await fetchRfqLineCountsByPr1Id(pr1Ids);

  const [pr1Res, quotesRes] = await Promise.all([
    db.from('pr1_requests')
      .select('id, pr1_number, department_name_snapshot, purpose')
      .in('id', pr1Ids),
    db.from('rfq_item_quotes')
      .select('rfq_supplier_id, pr1_item_id, submitted_at')
      .in('rfq_supplier_id', (assignments as any[]).map((a: any) => a.id)),
  ]);

  const rfqMap:   Record<string, any> = Object.fromEntries(((rfqs ?? []) as any[]).map((r: any) => [r.id, r]));
  const pr1Map:   Record<string, any> = Object.fromEntries(((pr1Res.data ?? []) as any[]).map((r: any) => [r.id, r]));
  const quotesArr: any[] = quotesRes.data ?? [];

  return {
    inbox: (assignments as any[]).map((assignment: any) => {
      const rfq = rfqMap[assignment.rfq_id];
      const pr1 = rfq ? pr1Map[rfq.pr1_id] : null;
      const quotesForThis = quotesArr.filter(
        q => q.rfq_supplier_id === assignment.id && q.submitted_at !== null
      );
      return {
        rfq_supplier_id:  assignment.id,
        rfq_id:           assignment.rfq_id,
        rfq_number:       rfq?.rfq_number ?? '',
        rfq_status:       rfq?.status ?? 'open',
        rfq_deadline:     rfq?.deadline ?? null,
        supplier_status:  assignment.status,
        pr1_number:       pr1?.pr1_number ?? '',
        department_name:  pr1?.department_name_snapshot ?? '',
        purpose:          pr1?.purpose ?? '',
        item_count:       rfq ? (itemCounts[rfq.pr1_id] ?? 0) : 0,
        quotes_submitted: quotesForThis.length,
      };
    }),
    total_count: countRes.count ?? 0,
  };
}

// ─── Supplier quotation detail ────────────────────────────────────────────────

export interface SupplierQuoteDetail {
  rfqSupplier: {
    id:     string;
    status: string;
    rfq_id: string;
  };
  rfq: {
    id:         string;
    rfq_number: string;
    status:     string;
    deadline:   string | null;
    notes:      string | null;
  };
  pr1: {
    pr1_number:              string;
    department_name_snapshot: string;
    purpose:                 string;
    request_type:            'goods' | 'services';
  };
  items: {
    id:                 string;
    item_order:         number;
    item_code:          string;
    description:        string;
    unit_of_measure:    string;
    quantity_requested: number;
    pr1_quantity_requested?: number;
    /** Phase 4 (Raw Mats): forwarded from pr1_items.is_raw_material. */
    is_raw_material?:   boolean;
    attachments?:       PR1Attachment[];
  }[];
  quotes: RfqItemQuote[];
}

export async function fetchSupplierQuoteDetail(
  rfqSupplierId: string,
  supplierId: string
): Promise<SupplierQuoteDetail | null> {
  const { data: rs, error: rsErr } = await db
    .from('rfq_suppliers')
    .select('id, rfq_id, supplier_id, status')
    .eq('id', rfqSupplierId)
    .eq('supplier_id', supplierId)
    .maybeSingle();

  if (rsErr) throw rsErr;
  if (!rs) return null;

  const [rfqRes, quotesRes] = await Promise.all([
    db.from('rfq_batches')
      .select('id, rfq_number, status, deadline, notes, pr1_id')
      .eq('id', rs.rfq_id)
      .maybeSingle(),
    db.from('rfq_item_quotes')
      .select('*')
      .eq('rfq_supplier_id', rfqSupplierId),
  ]);

  if (rfqRes.error) throw rfqRes.error;
  if (!rfqRes.data) return null;

  const rfq = rfqRes.data;

  const [pr1Res, pr1ItemsRes, legacyIds, attachments] = await Promise.all([
    db.from('pr1_requests')
      .select('pr1_number, department_name_snapshot, purpose, request_type')
      .eq('id', rfq.pr1_id)
      .maybeSingle(),
    db.from('pr1_items')
      .select('id, pr1_id, item_order, item_code, description, unit_of_measure, quantity_requested, is_raw_material')
      .eq('pr1_id', rfq.pr1_id)
      .order('item_order', { ascending: true }),
    collectLegacyPr1ItemIdsForRfq(rfq.id),
    fetchPR1Attachments(rfq.pr1_id).catch(() => []),
  ]);

  if (!pr1Res.data) return null;

  const attachmentsByItem: Record<string, PR1Attachment[]> = {};
  for (const att of attachments) {
    if (!attachmentsByItem[att.pr1_item_id]) attachmentsByItem[att.pr1_item_id] = [];
    attachmentsByItem[att.pr1_item_id].push(att);
  }
  const pr1Items = ((pr1ItemsRes.data ?? []) as any[]).map(item => ({
    ...item,
    attachments: attachmentsByItem[item.id] ?? [],
  })) as Pr1ItemRfqRow[];

  const warehouse = await fetchWarehouseProcurementByPr1Item(rfq.pr1_id);
  const items = buildRfqLineItems(pr1Items, warehouse, legacyIds);

  // Enrich quotes with supplier-uploaded attachments so the supplier sees
  // previously uploaded files on page reload.
  const rawQuotes = (quotesRes.data ?? []) as any[];
  const quoteAttachmentsByQuote = rawQuotes.length > 0
    ? await fetchRfqQuoteAttachmentsByRfq(rfq.id).catch(() => ({} as Record<string, RfqQuoteAttachment[]>))
    : {};
  const quotes = rawQuotes.map(q => ({
    ...q,
    attachments: quoteAttachmentsByQuote[q.id] ?? [],
  }));

  return {
    rfqSupplier: rs,
    rfq,
    pr1: {
      ...pr1Res.data,
      request_type: ((pr1Res.data as any).request_type ?? 'goods') as 'goods' | 'services',
    },
    items,
    quotes,
  };
}


// ─── Submit supplier quotation ────────────────────────────────────────────────

export interface QuoteDraft {
  pr1_item_id:          string;
  quoted_description:   string;
  is_alternative:       boolean;
  unit_price:           number;
  lead_time_days:       number;
  remarks:              string;
  /** Phase 7: optional link to a verified catalog product. */
  supplier_product_id?: string | null;
  /** Omitted or `quoted` = priced/product response; `no_quote` = cannot supply (reason required). */
  response_status?:     RfqQuoteResponseStatus;
  no_quote_reason?:     string | null;
}

export async function submitSupplierQuotation(
  rfqSupplierId: string,
  quotes: QuoteDraft[]
): Promise<void> {
  const now = new Date().toISOString();

  const rows = quotes.map(q => {
    const status: RfqQuoteResponseStatus =
      q.response_status === 'no_quote' ? 'no_quote' : 'quoted';
    if (status === 'no_quote') {
      const reason = (q.no_quote_reason ?? '').trim();
      return {
        rfq_supplier_id:     rfqSupplierId,
        pr1_item_id:         q.pr1_item_id,
        quoted_description:  'No quote',
        is_alternative:      false,
        unit_price:          0,
        lead_time_days:      0,
        remarks:             q.remarks.trim() || null,
        submitted_at:        now,
        updated_at:          now,
        supplier_product_id: null,
        response_status:     'no_quote' as const,
        no_quote_reason:     reason,
      };
    }
    return {
      rfq_supplier_id:     rfqSupplierId,
      pr1_item_id:         q.pr1_item_id,
      quoted_description:  q.quoted_description.trim(),
      is_alternative:      q.is_alternative,
      unit_price:          q.unit_price,
      lead_time_days:      q.lead_time_days,
      remarks:             q.remarks.trim() || null,
      submitted_at:        now,
      updated_at:          now,
      supplier_product_id: q.supplier_product_id ?? null,
      response_status:     'quoted' as const,
      no_quote_reason:     null,
    };
  });

  const { error: upsertErr } = await db
    .from('rfq_item_quotes')
    .upsert(rows, { onConflict: 'rfq_supplier_id,pr1_item_id' });

  if (upsertErr) throw upsertErr;

  // When a supplier materially changes a quote that procurement had already
  // selected as the winner, the prior selection becomes stale and procurement
  // must re-evaluate. That unselect + procurement notification is handled
  // atomically by the `trg_unselect_on_quote_change` DB trigger on
  // rfq_item_quotes (SECURITY DEFINER) — it cannot live here because supplier
  // RLS forbids the supplier session from reading or deleting
  // supplier_item_selections rows. See migration
  // 20260624120000_unselect_on_quote_change.sql.

  const { error: statusErr } = await db
    .from('rfq_suppliers')
    .update({ status: 'submitted', responded_at: now })
    .eq('id', rfqSupplierId);

  if (statusErr) throw statusErr;

  const alternativeCount = quotes.filter(
    q => q.response_status !== 'no_quote' && q.is_alternative
  ).length;

  try {
    const { data: rs } = await db
      .from('rfq_suppliers')
      .select('rfq_id, supplier_name_snapshot')
      .eq('id', rfqSupplierId)
      .maybeSingle();

    if (!rs?.rfq_id) return;

    const { data: rfq } = await db
      .from('rfq_batches')
      .select('id, rfq_number, pr1_id')
      .eq('id', rs.rfq_id)
      .maybeSingle();

    if (!rfq?.pr1_id) return;

    const { data: pr1 } = await db
      .from('pr1_requests')
      .select('pr1_number, requisitioner_id')
      .eq('id', rfq.pr1_id)
      .maybeSingle();

    const pr1Label     = pr1?.pr1_number ?? 'a request';
    const supplierName = rs.supplier_name_snapshot ?? 'A supplier';

    await notifyByRole('procurement', {
      title:         'Supplier Quotation Received',
      body:          `${supplierName} submitted a quotation for ${pr1Label}.`,
      type:          'info',
      document_type: 'rfq',
      document_id:   rfq.id,
      action_url:    `/rfq/${rfq.id}`,
    });

    if (alternativeCount > 0) {
      const altLabel = `${alternativeCount} substitute item${alternativeCount !== 1 ? 's' : ''}`;

      if (pr1?.requisitioner_id) {
        const { data: existing } = await db
          .from('notifications')
          .select('id')
          .eq('user_id', pr1.requisitioner_id)
          .eq('document_id', rfq.pr1_id)
          .eq('type', 'action_required')
          .eq('read', false)
          .ilike('title', 'Substitute Item%')
          .limit(1);

        if (!existing?.length) {
          await createNotification({
            user_id:       pr1.requisitioner_id,
            title:         'Substitute Item Review Required',
            body:          `${supplierName} offered ${altLabel} for ${pr1Label}. Review and decide before procurement can award.`,
            type:          'action_required',
            document_type: 'pr1',
            document_id:   rfq.pr1_id,
            action_url:    `/substitutes/${rfq.pr1_id}`,
          });
        }
      }

      await notifyByRole(
        'procurement',
        {
          title:         'Substitute Items Pending Requestor Review',
          body:          `${supplierName} submitted ${altLabel} for ${pr1Label}. Award is blocked until the requestor decides.`,
          type:          'action_required',
          document_type: 'rfq',
          document_id:   rfq.id,
          action_url:    `/rfq/${rfq.id}`,
        },
        { dedupeUnreadForDocument: true }
      );
    }
  } catch {
    // Notifications are best-effort; do not fail quotation submit
  }
}

// ─── Procurement dashboard stats ──────────────────────────────────────────────

export async function fetchProcurementStats(): Promise<{
  forCanvassing:       number;
  openRfqs:            number;
  canvassingComplete:  number;
  high_priority_count: number;
  medium_priority_count: number;
}> {
  const [queueRes, openRfqRes, completeRes, highRes, mediumRes] = await Promise.all([
    db.from('pr1_requests').select('id', { count: 'exact', head: true }).eq('status', 'for_canvassing'),
    db.from('rfq_batches').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    db.from('pr1_requests').select('id', { count: 'exact', head: true }).eq('status', 'canvassing_complete'),
    db.from('pr1_requests').select('id', { count: 'exact', head: true }).eq('status', 'for_canvassing').eq('priority', 'high'),
    db.from('pr1_requests').select('id', { count: 'exact', head: true }).eq('status', 'for_canvassing').eq('priority', 'medium'),
  ]);

  return {
    forCanvassing:        queueRes.count ?? 0,
    openRfqs:             openRfqRes.count ?? 0,
    canvassingComplete:   completeRes.count ?? 0,
    high_priority_count:  highRes.count ?? 0,
    medium_priority_count: mediumRes.count ?? 0,
  };
}

// ─── Supplier dashboard stats ─────────────────────────────────────────────────

export async function fetchSupplierStats(supplierId: string): Promise<{
  openRfqs:    number;
  submitted:   number;
  pending:     number;
}> {
  const { data: assignments, error: assErr } = await db
    .from('rfq_suppliers')
    .select('id, rfq_id, status')
    .eq('supplier_id', supplierId);

  if (assErr || !assignments || assignments.length === 0) {
    return { openRfqs: 0, submitted: 0, pending: 0 };
  }

  const rfqIds = (assignments as any[]).map((a: any) => a.rfq_id);
  const { data: rfqs } = await db
    .from('rfq_batches')
    .select('id, status')
    .in('id', rfqIds);

  const openRfqIds = new Set(
    ((rfqs ?? []) as any[]).filter(r => r.status === 'open').map(r => r.id)
  );

  const arr: any[] = assignments as any[];
  return {
    openRfqs:  arr.filter(a => openRfqIds.has(a.rfq_id)).length,
    submitted: arr.filter(a => a.status === 'submitted').length,
    pending:   arr.filter(a => a.status === 'invited' && openRfqIds.has(a.rfq_id)).length,
  };
}

// ─── RFQ Quote Attachments ────────────────────────────────────────────────────

/** Fetch all attachments for a single rfq_item_quote row. */
export async function fetchRfqQuoteAttachments(
  rfqItemQuoteId: string
): Promise<RfqQuoteAttachment[]> {
  const { data, error } = await db
    .from('rfq_quote_attachments')
    .select('*')
    .eq('rfq_item_quote_id', rfqItemQuoteId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as RfqQuoteAttachment[];
}

/** Fetch all attachments for every quote in an RFQ, grouped by rfq_item_quote_id. */
export async function fetchRfqQuoteAttachmentsByRfq(
  rfqId: string
): Promise<Record<string, RfqQuoteAttachment[]>> {
  const { data, error } = await db
    .from('rfq_quote_attachments')
    .select('*')
    .eq('rfq_id', rfqId)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const grouped: Record<string, RfqQuoteAttachment[]> = {};
  for (const att of (data ?? []) as RfqQuoteAttachment[]) {
    if (!grouped[att.rfq_item_quote_id]) grouped[att.rfq_item_quote_id] = [];
    grouped[att.rfq_item_quote_id].push(att);
  }
  return grouped;
}

/** Fetch attachments for a specific set of rfq_item_quote IDs, grouped by quote ID. */
export async function fetchRfqQuoteAttachmentsByQuoteIds(
  quoteIds: string[]
): Promise<Record<string, RfqQuoteAttachment[]>> {
  if (quoteIds.length === 0) return {};
  const { data, error } = await db
    .from('rfq_quote_attachments')
    .select('*')
    .in('rfq_item_quote_id', quoteIds)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const grouped: Record<string, RfqQuoteAttachment[]> = {};
  for (const att of (data ?? []) as RfqQuoteAttachment[]) {
    if (!grouped[att.rfq_item_quote_id]) grouped[att.rfq_item_quote_id] = [];
    grouped[att.rfq_item_quote_id].push(att);
  }
  return grouped;
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf',
]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function uploadRfqQuoteAttachment(params: {
  rfqId:           string;
  rfqSupplierId:   string;
  rfqItemQuoteId:  string;
  pr1ItemId:       string;
  file:            File;
}): Promise<RfqQuoteAttachment> {
  const { rfqId, rfqSupplierId, rfqItemQuoteId, pr1ItemId, file } = params;

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error(`File type "${file.type}" is not allowed. Use JPEG, PNG, WebP, GIF, or PDF.`);
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File exceeds the 10 MB limit.`);
  }

  const ts = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `rfq/${rfqId}/${rfqSupplierId}/${pr1ItemId}/${ts}_${safeName}`;

  const { error: uploadErr } = await supabase.storage
    .from('rfq-attachments')
    .upload(storagePath, file, { contentType: file.type, upsert: false });
  if (uploadErr) throw uploadErr;

  const { data, error: insertErr } = await db
    .from('rfq_quote_attachments')
    .insert({
      rfq_id:            rfqId,
      rfq_supplier_id:   rfqSupplierId,
      rfq_item_quote_id: rfqItemQuoteId,
      pr1_item_id:       pr1ItemId,
      uploaded_by:       (await supabase.auth.getUser()).data.user?.id,
      storage_path:      storagePath,
      file_name:         file.name,
      file_size:         file.size,
      mime_type:         file.type,
    })
    .select('*')
    .single();
  if (insertErr) {
    // Best-effort cleanup of orphaned storage object
    await supabase.storage.from('rfq-attachments').remove([storagePath]).catch(() => {});
    throw insertErr;
  }

  const uploaderId = (data as any).uploaded_by;
  if (uploaderId) {
    try {
      await db.from('audit_logs').insert({
        actor_id:      uploaderId,
        action:        'RFQ_QUOTE_ATTACHMENT_UPLOADED',
        document_type: 'RFQ',
        document_id:   rfqId,
        payload:       { rfq_supplier_id: rfqSupplierId, pr1_item_id: pr1ItemId, file_name: file.name, file_size: file.size },
      });
    } catch {}
  }

  return data as RfqQuoteAttachment;
}

export async function deleteRfqQuoteAttachment(
  attachmentId: string,
  storagePath:  string,
  actorId?:     string,
): Promise<void> {
  await supabase.storage.from('rfq-attachments').remove([storagePath]);
  const { error } = await db
    .from('rfq_quote_attachments')
    .delete()
    .eq('id', attachmentId);
  if (error) throw error;

  if (actorId) {
    try {
      await db.from('audit_logs').insert({
        actor_id:      actorId,
        action:        'RFQ_QUOTE_ATTACHMENT_DELETED',
        document_type: 'RFQ',
        document_id:   attachmentId,
        payload:       { storage_path: storagePath },
      });
    } catch {}
  }
}

/** Get a short-lived public URL for a stored RFQ quote attachment. */
export async function getRfqQuoteAttachmentUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('rfq-attachments')
    .createSignedUrl(storagePath, 60 * 60); // 1 hour
  if (error) throw error;
  return data.signedUrl;
}
