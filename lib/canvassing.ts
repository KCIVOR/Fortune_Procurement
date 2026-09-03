import { supabase } from '@/lib/supabase';
import { authFetch } from '@/lib/authenticated-fetch';
import type { UserProfile } from '@/types/auth';
import { fetchPR1Attachments } from './pr1';
import type { PR1Attachment } from '@/types/pr1';
import { createNotification, notifyByRole } from '@/lib/notifications';
import { syncPR2ItemsFromRfqSelections, syncRawMaterialPR2ItemsFromRfqSelections } from '@/lib/pr2-rfq-sync';
import { submitRfqForApproval } from '@/lib/rfq-approvals';
import { isPr2NativeDirectRequest } from '@/lib/pr2-classification';
import { getVatSettings, computeLineVat } from '@/lib/vat';
import type {
  RfqBatch,
  RfqSupplier,
  RfqItemQuote,
  CanvassingQueueRow,
  RawMaterialCanvassingQueueRow,
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

/**
 * Procurement canvassing queue eligibility. Goods and Services both create
 * their PR2 before RFQ (Warehouse handoff) and both reach `pr2_approved` on
 * final PR2 approval — the old separate services clause (`for_canvassing`/
 * `canvassing_complete`) was the legacy pre-alignment shape and is no longer
 * reachable for new services records (Services Workflow Alignment Phase 5).
 */
const CANVASSING_QUEUE_OR_FILTER =
  'and(request_type.in.(goods,services),status.eq.pr2_approved)';

// Defensive filter for stale goods/services rows still sitting at the old
// for_canvassing/canvassing_complete statuses from before their respective
// alignment fixes shipped — the OR filter above no longer selects rows in
// this shape going forward, but this catches any that slip through a stale
// query plan or manual DB state.
function isLegacyGoodsCanvassingStatus(row: { request_type?: string; status?: string }): boolean {
  if ((row.request_type ?? 'goods') !== 'goods' && row.request_type !== 'services') return false;
  return row.status === 'for_canvassing' || row.status === 'canvassing_complete';
}

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
  /** Forwarded from pr1_items.remarks so procurement sees the requestor's note while canvassing. */
  remarks?: string | null;
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
      remarks:            i.remarks ?? null,
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
        remarks:                i.remarks ?? null,
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
        remarks:                i.remarks ?? null,
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

/**
 * Count of RFQ lines per PR2, for PR2-native RFQs (raw material / services
 * created directly by Planning, no PR1 and no warehouse validation step —
 * every pr2_items row is meant for supplier quoting, unlike PR1's routing).
 */
async function fetchRfqLineCountsByPr2Id(pr2Ids: string[]): Promise<Record<string, number>> {
  if (pr2Ids.length === 0) return {};
  const { data: itemRows } = await db.from('pr2_items').select('pr2_id').in('pr2_id', pr2Ids);
  const out: Record<string, number> = {};
  for (const r of itemRows ?? []) {
    const pid = (r as any).pr2_id as string;
    out[pid] = (out[pid] ?? 0) + 1;
  }
  return out;
}

// ─── Canvassing queue (procurement) ──────────────────────────────────────────
// Returns PR1s with status=for_canvassing, joined with their RFQ if one exists.

const CANVASSING_QUEUE_PR1_SELECT =
  'id, pr1_number, requisitioner_name_snapshot, department_name_snapshot, purpose, priority, request_type, date_required, submitted_at, assigned_buyer_id, assigned_buyer_name_snapshot';

export async function fetchCanvassingQueue(): Promise<CanvassingQueueRow[]> {
  const { data: pr1s, error: pr1Err } = await db
    .from('pr1_requests')
    .select(CANVASSING_QUEUE_PR1_SELECT)
    .or(CANVASSING_QUEUE_OR_FILTER)
    .order('submitted_at', { ascending: false });

  if (pr1Err) throw pr1Err;
  if (!pr1s || pr1s.length === 0) return [];

  const eligible = (pr1s as any[]).filter((row) => !isLegacyGoodsCanvassingStatus(row));
  if (eligible.length === 0) return [];

  const pr1Ids = eligible.map((r: any) => r.id);

  const { data: rfqs, error: rfqErr } = await db
    .from('rfq_batches')
    .select('id, pr1_id, rfq_number, status')
    .in('pr1_id', pr1Ids);

  if (rfqErr) throw rfqErr;

  const rfqMap: Record<string, any> = {};
  for (const rfq of (rfqs ?? []) as any[]) {
    rfqMap[rfq.pr1_id] = rfq;
  }

  return (eligible as any[]).map((pr1: any) => {
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
      assigned_buyer_id:            pr1.assigned_buyer_id ?? null,
      assigned_buyer_name_snapshot: pr1.assigned_buyer_name_snapshot ?? null,
    };
  });
}

// ─── Canvassing queue: paginated ─────────────────────────────────────────────

export async function fetchCanvassingQueuePaged(options: {
  limit: number;
  offset: number;
  search?: string;
  departmentId?: string;
  /** 'awaiting' = PR1s with no RFQ yet; 'issued' = PR1s that already have an RFQ; 'all' = both. */
  view?: 'awaiting' | 'issued' | 'all';
  /** 'mine' = assigned to viewerId; 'unassigned' = no buyer set; 'all' = no filter. */
  assignedFilter?: 'all' | 'mine' | 'unassigned';
  viewerId?: string;
  /** Rev #9: 'all' | 'normal' | 'medium' | 'high'. */
  priorityFilter?: string;
}): Promise<{ rows: CanvassingQueueRow[]; total_count: number }> {
  const { limit, offset, search, departmentId, view = 'all', assignedFilter = 'all', viewerId, priorityFilter } = options;
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

  // For view filtering, resolve the set of PR1s that already have an RFQ.
  let rfqPr1Ids: string[] = [];
  if (view !== 'all') {
    const { data: allRfqs, error: allRfqErr } = await db
      .from('rfq_batches')
      .select('pr1_id');
    if (allRfqErr) throw allRfqErr;
    rfqPr1Ids = Array.from(
      new Set((allRfqs ?? []).map((r: any) => r.pr1_id).filter(Boolean))
    );
  }

  const applyFilters = (q: any) => {
    if (view !== 'issued') {
      q = q.or(CANVASSING_QUEUE_OR_FILTER);
    }
    if (assignedFilter === 'mine' && viewerId) {
      q = q.eq('assigned_buyer_id', viewerId);
    } else if (assignedFilter === 'unassigned') {
      q = q.is('assigned_buyer_id', null);
    }
    if (priorityFilter && priorityFilter !== 'all') {
      q = q.eq('priority', priorityFilter);
    }
    if (view === 'awaiting' && rfqPr1Ids.length > 0) {
      q = q.not('id', 'in', `(${rfqPr1Ids.join(',')})`);
    } else if (view === 'issued') {
      // Issued list is exactly the PR1s that have an RFQ. None → empty result.
      if (rfqPr1Ids.length === 0) {
        q = q.eq('id', '00000000-0000-0000-0000-000000000000');
      } else {
        q = q.in('id', rfqPr1Ids);
      }
    }
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
      .order('submitted_at', { ascending: false })
      .range(offset, offset + limit - 1),
    applyFilters(db.from('pr1_requests').select('id', { count: 'exact', head: true })),
  ]);

  if (pr1sRes.error) throw pr1sRes.error;
  if (countRes.error) throw countRes.error;

  const pr1s = ((pr1sRes.data ?? []) as any[]).filter((row) => view === 'issued' ? true : !isLegacyGoodsCanvassingStatus(row));
  const totalEligible = (countRes.count ?? 0); // approximate when legacy rows exist
  if (pr1s.length === 0) return { rows: [], total_count: totalEligible };

  const pr1Ids = pr1s.map((r: any) => r.id);

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
        assigned_buyer_id:            pr1.assigned_buyer_id ?? null,
        assigned_buyer_name_snapshot: pr1.assigned_buyer_name_snapshot ?? null,
      };
    }),
    total_count: totalEligible,
  };
}

// ─── Canvassing queue: assign a buyer ────────────────────────────────────────

export interface ProcurementUserOption {
  id:        string;
  full_name: string;
}

export async function listProcurementUsers(): Promise<ProcurementUserOption[]> {
  const { data: role } = await db
    .from('roles')
    .select('id')
    .eq('name', 'procurement')
    .maybeSingle();
  if (!role?.id) return [];

  const { data, error } = await db
    .from('profiles')
    .select('id, full_name')
    .eq('role_id', role.id)
    .order('full_name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProcurementUserOption[];
}

export async function assignPr1ToBuyer(
  pr1Id:   string,
  buyerId: string,
  profile: UserProfile
): Promise<void> {
  const { data: buyer, error: buyerErr } = await db
    .from('profiles')
    .select('full_name')
    .eq('id', buyerId)
    .maybeSingle();
  if (buyerErr) throw buyerErr;
  if (!buyer) throw new Error('Selected buyer not found.');

  const { data: pr1, error: pr1Err } = await db
    .from('pr1_requests')
    .select('pr1_number')
    .eq('id', pr1Id)
    .maybeSingle();
  if (pr1Err) throw pr1Err;
  if (!pr1) throw new Error('PR1 not found.');

  const now = new Date().toISOString();
  const { error } = await db
    .from('pr1_requests')
    .update({
      assigned_buyer_id:            buyerId,
      assigned_buyer_name_snapshot: (buyer as any).full_name,
      assigned_at:                  now,
      assigned_by:                  profile.id,
      updated_at:                   now,
    })
    .eq('id', pr1Id);
  if (error) throw error;

  try {
    await db.from('audit_logs').insert({
      actor_id:      profile.id,
      action:        'PR1_ASSIGNED_TO_BUYER',
      document_type: 'PR1',
      document_id:   pr1Id,
      payload: {
        pr1_number:       (pr1 as any).pr1_number,
        assigned_to:      buyerId,
        assigned_to_name: (buyer as any).full_name,
        by:               profile.full_name,
      },
    });
  } catch {
    /* best-effort audit */
  }

  try {
    await createNotification({
      user_id:       buyerId,
      title:         'PR1 Assigned to You',
      body:          `PR1 ${(pr1 as any).pr1_number} has been assigned to you for canvassing/RFQ processing.`,
      type:          'action_required',
      document_type: 'PR1',
      document_id:   pr1Id,
      action_url:    '/rfq',
    });
  } catch {
    /* non-blocking */
  }
}

export async function unassignPr1FromBuyer(
  pr1Id:   string,
  profile: UserProfile
): Promise<void> {
  const { data: pr1, error: pr1Err } = await db
    .from('pr1_requests')
    .select('pr1_number, assigned_buyer_id')
    .eq('id', pr1Id)
    .maybeSingle();
  if (pr1Err) throw pr1Err;
  if (!pr1) throw new Error('PR1 not found.');

  const now = new Date().toISOString();
  const { error } = await db
    .from('pr1_requests')
    .update({
      assigned_buyer_id:            null,
      assigned_buyer_name_snapshot: null,
      assigned_at:                  null,
      assigned_by:                  null,
      updated_at:                   now,
    })
    .eq('id', pr1Id);
  if (error) throw error;

  try {
    await db.from('audit_logs').insert({
      actor_id:      profile.id,
      action:        'PR1_UNASSIGNED',
      document_type: 'PR1',
      document_id:   pr1Id,
      payload: {
        pr1_number:          (pr1 as any).pr1_number,
        previous_buyer_id:   (pr1 as any).assigned_buyer_id,
        by:                  profile.full_name,
      },
    });
  } catch {
    /* best-effort audit */
  }
}

// ─── Planning Direct (PR2-native) buyer assignment ───────────────────────────
// Mirrors assignPr1ToBuyer/unassignPr1FromBuyer above, scoped to pr2_requests
// for the "Planning Direct" tab's raw-material/services rows (no pr1_id).

export async function assignPr2ToBuyer(
  pr2Id:   string,
  buyerId: string,
  profile: UserProfile
): Promise<void> {
  const { data: buyer, error: buyerErr } = await db
    .from('profiles')
    .select('full_name')
    .eq('id', buyerId)
    .maybeSingle();
  if (buyerErr) throw buyerErr;
  if (!buyer) throw new Error('Selected buyer not found.');

  const { data: pr2, error: pr2Err } = await db
    .from('pr2_requests')
    .select('pr2_number')
    .eq('id', pr2Id)
    .maybeSingle();
  if (pr2Err) throw pr2Err;
  if (!pr2) throw new Error('PR2 not found.');

  const now = new Date().toISOString();
  const { error } = await db
    .from('pr2_requests')
    .update({
      assigned_buyer_id:            buyerId,
      assigned_buyer_name_snapshot: (buyer as any).full_name,
      assigned_at:                  now,
      assigned_by:                  profile.id,
      updated_at:                   now,
    })
    .eq('id', pr2Id);
  if (error) throw error;

  try {
    await db.from('audit_logs').insert({
      actor_id:      profile.id,
      action:        'PR2_ASSIGNED_TO_BUYER',
      document_type: 'PR2',
      document_id:   pr2Id,
      payload: {
        pr2_number:       (pr2 as any).pr2_number,
        assigned_to:      buyerId,
        assigned_to_name: (buyer as any).full_name,
        by:               profile.full_name,
      },
    });
  } catch {
    /* best-effort audit */
  }

  try {
    await createNotification({
      user_id:       buyerId,
      title:         'PR2 Assigned to You',
      body:          `PR2 ${(pr2 as any).pr2_number} has been assigned to you for canvassing/RFQ processing.`,
      type:          'action_required',
      document_type: 'PR2',
      document_id:   pr2Id,
      action_url:    '/rfq',
    });
  } catch {
    /* non-blocking */
  }
}

export async function unassignPr2FromBuyer(
  pr2Id:   string,
  profile: UserProfile
): Promise<void> {
  const { data: pr2, error: pr2Err } = await db
    .from('pr2_requests')
    .select('pr2_number, assigned_buyer_id')
    .eq('id', pr2Id)
    .maybeSingle();
  if (pr2Err) throw pr2Err;
  if (!pr2) throw new Error('PR2 not found.');

  const now = new Date().toISOString();
  const { error } = await db
    .from('pr2_requests')
    .update({
      assigned_buyer_id:            null,
      assigned_buyer_name_snapshot: null,
      assigned_at:                  null,
      assigned_by:                  null,
      updated_at:                   now,
    })
    .eq('id', pr2Id);
  if (error) throw error;

  try {
    await db.from('audit_logs').insert({
      actor_id:      profile.id,
      action:        'PR2_UNASSIGNED',
      document_type: 'PR2',
      document_id:   pr2Id,
      payload: {
        pr2_number:          (pr2 as any).pr2_number,
        previous_buyer_id:   (pr2 as any).assigned_buyer_id,
        by:                  profile.full_name,
      },
    });
  } catch {
    /* best-effort audit */
  }
}

// ─── Canvassing queue: global KPI counts ─────────────────────────────────────
// Accurate totals across the whole canvassing pipeline (not page-scoped):
//   awaiting = canvassing PR1s with no RFQ yet
//   active   = RFQs currently open (collecting quotations)
//   complete = RFQs closed
//   issued   = distinct PR1s that have an RFQ (drives the "RFQ Issued" tab count)

export async function fetchCanvassingQueueCounts(): Promise<{
  awaiting: number;
  active: number;
  complete: number;
  issued: number;
  planningDirect: number;
}> {
  const { data: rfqs, error: rfqErr } = await db
    .from('rfq_batches')
    .select('pr1_id, status');
  if (rfqErr) throw rfqErr;

  const rfqRows = (rfqs ?? []) as { pr1_id: string | null; status: string }[];
  const rfqPr1Ids = new Set(
    rfqRows.map((r) => r.pr1_id).filter(Boolean) as string[]
  );
  const active   = rfqRows.filter((r) => r.status === 'open').length;
  const complete = rfqRows.filter((r) => r.status === 'closed').length;

  // "awaiting" and "issued" must both count only PR1s currently within the
  // canvassing queue's own eligibility window (same OR-filter the paged list
  // uses) — otherwise a PR1 that finished canvassing long ago (e.g. status
  // moved on to canvassing_complete) still inflates the "issued" badge forever
  // even though it no longer appears in that tab's list.
  const { data: eligiblePr1s, error: eligibleErr } = await db
    .from('pr1_requests')
    .select('id')
    .or(CANVASSING_QUEUE_OR_FILTER);
  if (eligibleErr) throw eligibleErr;

  const eligibleIds = ((eligiblePr1s ?? []) as any[]).map((r) => r.id as string);
  const awaiting = eligibleIds.filter((id) => !rfqPr1Ids.has(id)).length;
  const issued   = rfqPr1Ids.size;

  const { count: planningDirectCount, error: planningDirectErr } = await db
    .from('pr2_requests')
    .select('id', { count: 'exact', head: true })
    .in('request_type', ['raw_material', 'services'])
    .is('pr1_id', null)
    .eq('status', 'approved');
  if (planningDirectErr) throw planningDirectErr;

  return { awaiting, active, complete, issued, planningDirect: planningDirectCount ?? 0 };
}

// ─── Planning-direct canvassing queue (Phase 3, no PR1) ──────────────────────
// Sibling to fetchCanvassingQueue — a PR2-native request (Raw Material, or a
// Planning-direct Services PR2 per Services Workflow Alignment Phase 4) has
// no pr1_requests row to filter on, so this can't extend
// CANVASSING_QUEUE_OR_FILTER. No priority/buyer-assignment fields for the
// non-priority case — pr2_requests has no buyer-assignment column either way.
// `.is('pr1_id', null)` excludes PR1-linked Services PR2s, which already
// surface in the main PR1-based queue instead.

export async function fetchRawMaterialCanvassingQueue(options: {
  limit: number;
  offset: number;
  search?: string;
  departmentId?: string;
  priorityFilter?: string;
  /** 'mine' = assigned to viewerId; 'unassigned' = no buyer set; 'all' = no filter. */
  assignedFilter?: 'all' | 'mine' | 'unassigned';
  viewerId?: string;
}): Promise<{ rows: RawMaterialCanvassingQueueRow[]; total_count: number }> {
  const { limit, offset, search, departmentId, priorityFilter, assignedFilter = 'all', viewerId } = options;
  const term = search?.trim();

  const applyFilters = (q: any, includesPriority: boolean) => {
    if (term) {
      const p = `%${term}%`;
      q = q.or(
        `pr2_number.ilike.${p},purpose.ilike.${p},department_name_snapshot.ilike.${p},requisitioner_name_snapshot.ilike.${p}`
      );
    }
    if (departmentId) {
      q = q.eq('department_id', departmentId);
    }
    if (includesPriority && priorityFilter && priorityFilter !== 'all') {
      q = q.eq('priority', priorityFilter);
    }
    if (assignedFilter === 'mine' && viewerId) {
      q = q.eq('assigned_buyer_id', viewerId);
    } else if (assignedFilter === 'unassigned') {
      q = q.is('assigned_buyer_id', null);
    }
    return q;
  };

  let pr2s: any[] = [];
  let totalCount = 0;

  const [dataRes, countRes] = await Promise.all([
    applyFilters(
      db
        .from('pr2_requests')
        .select('id, pr2_number, request_type, requisitioner_name_snapshot, department_name_snapshot, purpose, date_required, priority, department_id, assigned_buyer_id, assigned_buyer_name_snapshot')
        .in('request_type', ['raw_material', 'services'])
        .is('pr1_id', null)
        .eq('status', 'approved'),
      true
    )
      .order('generated_at', { ascending: false })
      .range(offset, offset + limit - 1),
    applyFilters(
      db
        .from('pr2_requests')
        .select('id', { count: 'exact', head: true })
        .in('request_type', ['raw_material', 'services'])
        .is('pr1_id', null)
        .eq('status', 'approved'),
      true
    ),
  ]);

  if (dataRes.error && (dataRes.error.code === '42703' || String(dataRes.error.message ?? '').includes('priority'))) {
    const [fallbackDataRes, fallbackCountRes] = await Promise.all([
      applyFilters(
        db
          .from('pr2_requests')
          .select('id, pr2_number, request_type, requisitioner_name_snapshot, department_name_snapshot, purpose, date_required, department_id, assigned_buyer_id, assigned_buyer_name_snapshot')
          .in('request_type', ['raw_material', 'services'])
          .is('pr1_id', null)
          .eq('status', 'approved'),
        false
      )
        .order('generated_at', { ascending: false })
        .range(offset, offset + limit - 1),
      applyFilters(
        db
          .from('pr2_requests')
          .select('id', { count: 'exact', head: true })
          .in('request_type', ['raw_material', 'services'])
          .is('pr1_id', null)
          .eq('status', 'approved'),
        false
      ),
    ]);
    if (fallbackDataRes.error) throw fallbackDataRes.error;
    if (fallbackCountRes.error) throw fallbackCountRes.error;
    pr2s = fallbackDataRes.data ?? [];
    totalCount = fallbackCountRes.count ?? 0;
  } else if (dataRes.error) {
    throw dataRes.error;
  } else {
    if (countRes.error) throw countRes.error;
    pr2s = dataRes.data ?? [];
    totalCount = countRes.count ?? 0;
  }

  if (pr2s.length === 0) return { rows: [], total_count: totalCount };

  const pr2Ids = pr2s.map((r: any) => r.id);

  const { data: rfqs, error: rfqErr } = await db
    .from('rfq_batches')
    .select('id, pr2_id, rfq_number, status')
    .in('pr2_id', pr2Ids);

  if (rfqErr) throw rfqErr;

  const rfqMap: Record<string, any> = {};
  for (const rfq of (rfqs ?? []) as any[]) {
    rfqMap[rfq.pr2_id] = rfq;
  }

  const rows = (pr2s as any[]).map((pr2: any) => {
    const rfq = rfqMap[pr2.id] ?? null;
    return {
      pr2_id:                      pr2.id,
      pr2_number:                  pr2.pr2_number,
      request_type:                (pr2.request_type ?? 'raw_material') as 'raw_material' | 'services',
      requisitioner_name_snapshot: pr2.requisitioner_name_snapshot,
      department_name_snapshot:    pr2.department_name_snapshot,
      purpose:                     pr2.purpose,
      priority:                    pr2.priority ?? 'normal',
      date_required:               pr2.date_required,
      rfq_id:                      rfq?.id ?? null,
      rfq_number:                  rfq?.rfq_number ?? null,
      rfq_status:                  rfq?.status ?? null,
      assigned_buyer_id:            pr2.assigned_buyer_id ?? null,
      assigned_buyer_name_snapshot: pr2.assigned_buyer_name_snapshot ?? null,
    };
  });

  return { rows, total_count: totalCount };
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

  const suppliersRes = await db.from('rfq_suppliers').select('*').eq('rfq_id', rfqId);

  let pr1Header: RfqDetailView['pr1'];
  let items: RfqDetailView['items'];

  if (rfq.pr1_id === null && rfq.pr2_id) {
    // Phase 3 (Raw Mats): PR2-native RFQ — no PR1, no warehouse step. Lines
    // come straight off pr2_items (already final quantities).
    const { data: pr2, error: pr2Err } = await db
      .from('pr2_requests')
      .select('id, pr2_number, requisitioner_name_snapshot, department_name_snapshot, purpose, date_required, request_type')
      .eq('id', rfq.pr2_id)
      .maybeSingle();
    if (pr2Err) throw pr2Err;
    if (!pr2) return null;

    const { data: pr2ItemRows, error: pr2ItemsErr } = await db
      .from('pr2_items')
      .select('id, item_order, item_code, description, unit_of_measure, quantity_requested, is_raw_material, remarks')
      .eq('pr2_id', rfq.pr2_id)
      .order('item_order', { ascending: true });
    if (pr2ItemsErr) throw pr2ItemsErr;

    pr1Header = {
      id:                          pr2.id,
      pr1_number:                  pr2.pr2_number,
      requisitioner_name_snapshot: pr2.requisitioner_name_snapshot,
      department_name_snapshot:    pr2.department_name_snapshot,
      purpose:                     pr2.purpose,
      date_required:               pr2.date_required,
      request_type:                (pr2.request_type ?? 'raw_material') as 'raw_material' | 'services',
    };
    items = ((pr2ItemRows ?? []) as any[]).map((item) => ({
      id:                 item.id,
      item_order:         item.item_order,
      item_code:          item.item_code,
      description:        item.description,
      unit_of_measure:    item.unit_of_measure,
      quantity_requested: Number(item.quantity_requested) || 0,
      is_raw_material:    item.is_raw_material === true,
      remarks:            item.remarks ?? null,
      attachments:        [],
    }));
  } else {
    const [pr1Res, itemsRes, attachments] = await Promise.all([
      db.from('pr1_requests')
        .select('id, pr1_number, requisitioner_name_snapshot, department_name_snapshot, purpose, date_required, request_type')
        .eq('id', rfq.pr1_id)
        .maybeSingle(),
      db.from('pr1_items')
        .select('id, pr1_id, item_order, item_code, description, unit_of_measure, quantity_requested, is_raw_material, remarks')
        .eq('pr1_id', rfq.pr1_id)
        .order('item_order', { ascending: true }),
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
    items = buildRfqLineItems(pr1Items, warehouse, legacyIds);

    pr1Header = {
      ...pr1Res.data,
      request_type: (pr1Res.data as any).request_type as 'goods' | 'services',
    };
  }

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

  // Fetch substitute decisions for alternative quotes on this RFQ (PR1 or PR2-native).
  let substituteDecisions: SubstituteDecisionRow[] = [];
  const decisionQuoteIds = (quotes as any[]).map((q: any) => q.id as string);
  if (decisionQuoteIds.length > 0) {
    const { data: decisionData } = await db
      .from('substitute_decisions')
      .select('*')
      .in('rfq_item_quote_id', decisionQuoteIds);
    substituteDecisions = (decisionData ?? []) as SubstituteDecisionRow[];
  }

  // All supplier profiles for canvassing + assign name snapshots — enrichment for modal
  const { data: roles } = await db.from('roles').select('id').eq('name', 'supplier');
  const supplierRoleId = (roles ?? [])[0]?.id ?? null;
  let allSuppliers: CanvassSupplierCandidate[] = [];
  if (supplierRoleId) {
    const { data: profileRows } = await db
      .from('profiles')
      .select('id, full_name, email, supplier_supply_type')
      .eq('role_id', supplierRoleId)
      .order('full_name', { ascending: true });

    const profiles = (profileRows ?? []) as {
      id: string;
      full_name: string;
      email: string | null;
      supplier_supply_type: string | null;
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

    allSuppliers = profiles.map(p => {
      const st = p.supplier_supply_type;
      const supplier_supply_type =
        st === 'raw_material' || st === 'normal' || st === 'service' ? st : null;
      return {
        id:                      p.id,
        full_name:               p.full_name,
        email:                   p.email ?? null,
        supplier_supply_type,
        accreditation_status:    latestAccBySupplier[p.id] ?? null,
        verified_product_count:  countsBySupplier[p.id]?.v  ?? 0,
        verified_goods_count:    countsBySupplier[p.id]?.vg ?? 0,
        verified_service_count:  countsBySupplier[p.id]?.vs ?? 0,
        pending_product_count:   countsBySupplier[p.id]?.p  ?? 0,
        rejected_product_count:  countsBySupplier[p.id]?.r  ?? 0,
        withdrawn_product_count: countsBySupplier[p.id]?.w  ?? 0,
      };
    });
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

  // Rev #1 (VAT): resolve is_vat_registered per assigned supplier (external vendors default to false).
  const vatSupplierIds = Array.from(
    new Set(assignedSuppliers.map((s: any) => s.supplier_id).filter(Boolean))
  ) as string[];
  const { data: vatProfiles } = vatSupplierIds.length > 0
    ? await db.from('profiles').select('id, is_vat_registered').in('id', vatSupplierIds)
    : { data: [] as any[] };
  const vatRegisteredBySupplierId: Record<string, boolean> = Object.fromEntries(
    ((vatProfiles ?? []) as any[]).map((p: any) => [p.id, Boolean(p.is_vat_registered)])
  );
  const suppliersWithVat = assignedSuppliers.map((s: any) => ({
    ...s,
    is_vat_registered: s.supplier_id ? Boolean(vatRegisteredBySupplierId[s.supplier_id]) : false,
  }));
  const vatSettings = await getVatSettings().catch(() => ({ vat_rate: 12 }));

  return {
    rfq,
    pr1:        pr1Header,
    items,
    suppliers:  suppliersWithVat,
    quotes,
    selections,
    substituteDecisions,
    allSuppliers,
    productLookup,
    vatRate: Number(vatSettings.vat_rate),
  };
}

// ─── Build quote comparison matrix ───────────────────────────────────────────

export function buildQuoteMatrix(detail: RfqDetailView): QuoteMatrixRow[] {
  const decisionByQuoteId: Record<string, SubstituteDecision> = {};
  for (const d of detail.substituteDecisions) {
    decisionByQuoteId[d.rfq_item_quote_id] = d.decision;
  }

  return detail.items.map(item => {
    const selection = detail.selections.find(s => (s.pr1_item_id ?? s.pr2_item_id) === item.id);

    const quotes = detail.suppliers.map(supplier => {
      const quote = detail.quotes.find(
        q => q.rfq_supplier_id === supplier.id && (q.pr1_item_id ?? q.pr2_item_id) === item.id
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

      const isVatRegistered = supplier.is_vat_registered === true;
      const totalPrice = quote
        ? computeLineVat(
            Number(quote.unit_price),
            item.quantity_requested,
            isVatRegistered,
            quote.vat_type ?? null,
            detail.vatRate
          ).total
        : 0;

      return {
        rfq_supplier_id:         supplier.id,
        quote_id:                quote?.id ?? null,
        supplier_name:           supplier.supplier_name_snapshot,
        quoted_description:      quote?.quoted_description ?? '',
        is_alternative:          quote?.is_alternative ?? false,
        unit_price:              quote ? Number(quote.unit_price) : 0,
        lead_time_days:          quote?.lead_time_days ?? '',
        remarks:                 quote?.remarks ?? null,
        total_price:             totalPrice,
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
        vat_type:                quote?.vat_type ?? null,
      };
    });

    return {
      item,
      quotes,
      selected_rfq_supplier_id: selection?.selected_rfq_supplier_id ?? null,
    };
  });
}

/** Next 4-digit suffix for RFQ-{year}-####. Guide only — not reserved. */
export async function fetchSuggestedRFQSequence(year?: number): Promise<string> {
  const y = year ?? new Date().getFullYear();
  const prefix = `RFQ-${y}-`;

  const { data, error } = await db
    .from('rfq_batches')
    .select('rfq_number')
    .ilike('rfq_number', `${prefix}%`);
  if (error) throw error;

  let max = 0;
  const re = new RegExp(`^RFQ-${y}-(\\d+)`, 'i');
  for (const row of data ?? []) {
    const num = String((row as { rfq_number?: string }).rfq_number ?? '');
    const match = num.match(re);
    if (!match) continue;
    const parsed = parseInt(match[1], 10);
    if (!Number.isNaN(parsed) && parsed > max) max = parsed;
  }
  return String(max + 1).padStart(4, '0');
}

// ─── Create RFQ ───────────────────────────────────────────────────────────────

export async function createRfq(
  pr1Id: string,
  deadline: string | null,
  notes: string,
  profile: UserProfile,
  rfqNumberInput: string,
): Promise<string> {
  // Idempotency: return existing RFQ if one already exists for this PR1.
  const { data: existing } = await db
    .from('rfq_batches')
    .select('id')
    .eq('pr1_id', pr1Id)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const rfq_number = rfqNumberInput.trim();
  if (!rfq_number) throw new Error('RFQ number is required.');

  const { data: dup } = await db
    .from('rfq_batches')
    .select('id')
    .eq('rfq_number', rfq_number)
    .maybeSingle();
  if (dup?.id) throw new Error(`RFQ number ${rfq_number} is already in use.`);

  const { data: pr1Header, error: pr1HeaderErr } = await db
    .from('pr1_requests')
    .select('id, request_type, status')
    .eq('id', pr1Id)
    .maybeSingle();
  if (pr1HeaderErr) throw pr1HeaderErr;
  if (!pr1Header) throw new Error('PR1 not found.');

  // Goods and Services both get their PR2 created before RFQ (Warehouse
  // handoff — lib/pr2-warehouse.ts), so both require an already-approved PR2
  // before canvassing can start. Raw Material never reaches this function (no
  // PR1) — it uses the createRfqFromPr2 sibling instead.
  const requiresApprovedPR2 = pr1Header.request_type === 'goods' || pr1Header.request_type === 'services';
  let linkedPr2Id: string | null = null;

  if (requiresApprovedPR2) {
    if (pr1Header.status !== 'pr2_approved') {
      throw new Error('RFQ requires PR2 final approval (PR1 status must be pr2_approved).');
    }
    const { data: pr2, error: pr2Err } = await db
      .from('pr2_requests')
      .select('id, status')
      .eq('pr1_id', pr1Id)
      .maybeSingle();
    if (pr2Err) throw pr2Err;
    if (!pr2 || pr2.status !== 'approved') {
      throw new Error('An approved PR2 must exist before creating an RFQ.');
    }
    linkedPr2Id = pr2.id;
  }

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

  const { data, error } = await db
    .from('rfq_batches')
    .insert({
      pr1_id:     pr1Id,
      pr2_id:     linkedPr2Id,
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
  // UNIQUE(rfq_number) surfaces as a friendly duplicate error.
  if (error) {
    if (error.code === '23505') {
      if (String(error.message ?? '').includes('rfq_number')) {
        throw new Error(`RFQ number ${rfq_number} is already in use.`);
      }
      const { data: race } = await db
        .from('rfq_batches')
        .select('id')
        .eq('pr1_id', pr1Id)
        .maybeSingle();
      if (race?.id) return race.id;
    }
    throw error;
  }

  if (requiresApprovedPR2 && linkedPr2Id) {
    const { error: linkErr } = await db
      .from('pr2_requests')
      .update({
        rfq_id:              data.id,
        rfq_number_snapshot: rfq_number,
        updated_at:          now,
      })
      .eq('id', linkedPr2Id);
    if (linkErr) throw linkErr;
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

// ─── Create RFQ from a raw-material PR2 (Phase 3, no PR1) ─────────────────────
// Sibling to createRfq() rather than a branch inside it — the PR1-linked
// goods/services path is keyed entirely off pr1_requests/pr1_items/warehouse
// validation, none of which exists for a PR2-native request (Raw Material or
// a Planning-direct Services PR2, Services Workflow Alignment Phase 4).

export async function createRfqFromPr2(
  pr2Id: string,
  deadline: string | null,
  notes: string,
  profile: UserProfile,
  rfqNumberInput: string,
): Promise<string> {
  // Idempotency: return existing RFQ if one already exists for this PR2.
  const { data: existing } = await db
    .from('rfq_batches')
    .select('id')
    .eq('pr2_id', pr2Id)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const rfq_number = rfqNumberInput.trim();
  if (!rfq_number) throw new Error('RFQ number is required.');

  const { data: dup } = await db
    .from('rfq_batches')
    .select('id')
    .eq('rfq_number', rfq_number)
    .maybeSingle();
  if (dup?.id) throw new Error(`RFQ number ${rfq_number} is already in use.`);

  const { data: pr2Header, error: pr2HeaderErr } = await db
    .from('pr2_requests')
    .select('id, request_type, status, pr1_id')
    .eq('id', pr2Id)
    .maybeSingle();
  if (pr2HeaderErr) throw pr2HeaderErr;
  if (!pr2Header) throw new Error('PR2 not found.');
  if (!isPr2NativeDirectRequest(pr2Header)) {
    throw new Error('createRfqFromPr2 is only for PR2-native (Planning-direct) requests.');
  }
  if (pr2Header.status !== 'approved') {
    throw new Error('An approved PR2 is required before creating an RFQ.');
  }

  const { data: pr2ItemRows, error: piErr } = await db
    .from('pr2_items')
    .select('id, item_order, quantity_to_purchase, quantity_requested')
    .eq('pr2_id', pr2Id)
    .order('item_order', { ascending: true });
  if (piErr) throw piErr;
  if (!pr2ItemRows || pr2ItemRows.length === 0) {
    throw new Error('This request has no line items — an RFQ is not applicable.');
  }

  const now = new Date().toISOString();

  const { data, error } = await db
    .from('rfq_batches')
    .insert({
      pr1_id:     null,
      pr2_id:     pr2Id,
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
  // The partial UNIQUE(pr2_id) constraint fires — fetch and return the winner.
  // UNIQUE(rfq_number) surfaces as a friendly duplicate error.
  if (error) {
    if (error.code === '23505') {
      if (String(error.message ?? '').includes('rfq_number')) {
        throw new Error(`RFQ number ${rfq_number} is already in use.`);
      }
      const { data: race } = await db
        .from('rfq_batches')
        .select('id')
        .eq('pr2_id', pr2Id)
        .maybeSingle();
      if (race?.id) return race.id;
    }
    throw error;
  }

  // Always link back — unlike the PR1-linked path, the PR2 already exists and
  // is approved before an RFQ can be created for it, so this is unconditional.
  const { error: linkErr } = await db
    .from('pr2_requests')
    .update({
      rfq_id:              data.id,
      rfq_number_snapshot: rfq_number,
      updated_at:          now,
    })
    .eq('id', pr2Id);
  if (linkErr) throw linkErr;

  await db.from('audit_logs').insert({
    actor_id:      profile.id,
    action:        'RFQ_CREATED',
    document_type: 'RFQ',
    document_id:   data.id,
    payload:       { rfq_number, pr2_id: pr2Id },
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

  // Phase 3 (Raw Mats) + Services Workflow Alignment Phase 4: server-side
  // enforcement — a raw-material or services RFQ may only be assigned
  // suppliers whose profile carries the matching supplier_supply_type. The
  // "Assign Suppliers" modal already filters/locks this client-side, but
  // that alone is trivially bypassable; enforce it here too. Goods RFQs have
  // no such restriction (supplier_supply_type 'normal' or unset).
  if (supplierIds.length > 0) {
    const { data: rfqRow } = await db
      .from('rfq_batches')
      .select('pr1_id, pr2_id')
      .eq('id', rfqId)
      .maybeSingle();
    let requestType: string | undefined;
    if (rfqRow?.pr1_id) {
      const { data: pr1 } = await db
        .from('pr1_requests')
        .select('request_type')
        .eq('id', rfqRow.pr1_id)
        .maybeSingle();
      requestType = pr1?.request_type;
    } else if (rfqRow?.pr2_id) {
      const { data: pr2 } = await db
        .from('pr2_requests')
        .select('request_type')
        .eq('id', rfqRow.pr2_id)
        .maybeSingle();
      requestType = pr2?.request_type;
    }

    // Note: pr1/pr2 request_type uses 'services' (plural); supplier_supply_type
    // uses 'service' (singular) — these are deliberately different enums.
    const requiredSupplyType = requestType === 'raw_material'
      ? 'raw_material'
      : requestType === 'services'
        ? 'service'
        : null;

    if (requiredSupplyType) {
      const { data: supplierProfiles } = await db
        .from('profiles')
        .select('id, supplier_supply_type')
        .in('id', supplierIds);
      const mismatched = ((supplierProfiles ?? []) as any[]).filter(
        (p) => p.supplier_supply_type !== requiredSupplyType,
      );
      if (mismatched.length > 0) {
        throw new Error(
          requiredSupplyType === 'raw_material'
            ? 'Only suppliers classified as Raw Material may be assigned to a raw-material RFQ.'
            : 'Only suppliers classified as Service may be assigned to a services RFQ.',
        );
      }
    }
  }

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

  const { data: inserted, error } = await db
    .from('rfq_suppliers')
    .insert(rows)
    .select('id, supplier_id');
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

  // If the RFQ is already open, notify newly added suppliers immediately.
  // (When the RFQ is still draft, issueRfq handles notifications at issue time.)
  try {
    const { data: rfq } = await db
      .from('rfq_batches')
      .select('status')
      .eq('id', rfqId)
      .single();

    if (rfq?.status !== 'open') return;

    const newRows = ((inserted ?? []) as { id: string; supplier_id: string | null }[])
      .filter((r): r is { id: string; supplier_id: string } => !!r.supplier_id);
    if (newRows.length === 0) return;

    const newSupplierIds = newRows.map(r => r.supplier_id);

    // Dedup: skip anyone who already has an unread action_required notification
    // for this RFQ (guards against retries / concurrent calls).
    const { data: existingNotifs } = await db
      .from('notifications')
      .select('user_id')
      .eq('document_id', rfqId)
      .eq('type', 'action_required')
      .eq('read', false)
      .in('user_id', newSupplierIds);

    const alreadyNotified = new Set<string>(
      ((existingNotifs ?? []) as { user_id: string }[]).map(n => n.user_id)
    );

    await Promise.all(
      newRows
        .filter(r => !alreadyNotified.has(r.supplier_id))
        .map(r =>
          createNotification({
            user_id:       r.supplier_id,
            title:         'RFQ Issued',
            body:          'You have been invited to submit a quotation.',
            type:          'action_required',
            document_type: 'rfq',
            document_id:   rfqId,
            action_url:    `/supplier/quotations/${r.id}`,
          })
        )
    );
  } catch (err) {
    console.error('assignSuppliers notifications error:', err);
    // Notifications are best-effort; do not fail the assignment
  }
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
  itemId: string,
): Promise<string | null> {
  const { data } = await db
    .from('rfq_item_quotes')
    .select('id')
    .eq('rfq_supplier_id', rfqSupplierId)
    .or(`pr1_item_id.eq.${itemId},pr2_item_id.eq.${itemId}`)
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
    // Fetch RFQ + PR1/PR2 details for the email
    const { data: rfq } = await db
      .from('rfq_batches')
      .select('rfq_number, deadline, notes, pr1_id, pr2_id')
      .eq('id', rfqId)
      .single();

    if (!rfq) return;

    // Planning-direct RFQs (raw material / services) have no pr1_id — their
    // department/purpose live on pr2_requests instead.
    let requestHeader: { department_name_snapshot: string; purpose: string } | null = null;
    if (rfq.pr1_id) {
      const { data: pr1 } = await db
        .from('pr1_requests')
        .select('department_name_snapshot, purpose')
        .eq('id', rfq.pr1_id)
        .single();
      requestHeader = pr1 ?? null;
    } else if (rfq.pr2_id) {
      const { data: pr2 } = await db
        .from('pr2_requests')
        .select('department_name_snapshot, purpose')
        .eq('id', rfq.pr2_id)
        .single();
      requestHeader = pr2 ?? null;
    }

    if (!requestHeader) return;

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
          department: requestHeader.department_name_snapshot,
          purpose: requestHeader.purpose,
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

export async function closeRfq(rfqId: string, pr1Id: string | null, profile: UserProfile): Promise<void> {
  const now = new Date().toISOString();

  const [{ data: pr1 }, { data: rfqRow }] = await Promise.all([
    pr1Id
      ? db.from('pr1_requests').select('request_type, pr1_number, requisitioner_id').eq('id', pr1Id).maybeSingle()
      : Promise.resolve({ data: null }),
    db.from('rfq_batches').select('id, pr2_id, rfq_number').eq('id', rfqId).maybeSingle(),
  ]);

  // Phase 3 (Raw Mats): a raw-material RFQ has no pr1_id — resolve its PR2 directly.
  let pr2: { id: string; request_type: string; pr2_number: string; requisitioner_id: string } | null = null;
  if (!pr1Id && rfqRow?.pr2_id) {
    const { data } = await db
      .from('pr2_requests')
      .select('id, request_type, pr2_number, requisitioner_id')
      .eq('id', rfqRow.pr2_id)
      .maybeSingle();
    pr2 = data;
  }

  // Goods and Services both have their PR2 created before RFQ (Warehouse
  // handoff) and both follow the same RFQ_APPROVAL path afterward — the old
  // "services closes straight to canvassing_complete, no approval" branch
  // below was the legacy pre-alignment shape and is no longer reachable for
  // new services RFQs (Services Workflow Alignment Phase 4).
  const isGoodsOrServices = pr1?.request_type === 'goods' || pr1?.request_type === 'services';
  // PR2-native (no pr1_id): Raw Material or a Planning-direct Services PR2 —
  // both sync via the PR2-native sync function and follow the approval flow.
  const isPr2Native = !pr1Id && (pr2?.request_type === 'raw_material' || pr2?.request_type === 'services');
  const isRawMaterial = !pr1Id && pr2?.request_type === 'raw_material';

  if (isGoodsOrServices) {
    const pr2Id = rfqRow?.pr2_id as string | null;
    if (!pr2Id) throw new Error('RFQ is missing a linked PR2.');
    await syncPR2ItemsFromRfqSelections(pr2Id, rfqId, profile);
  } else if (isPr2Native) {
    await syncRawMaterialPR2ItemsFromRfqSelections(pr2!.id, rfqId, profile);
  }

  const { error: rfqErr } = await db
    .from('rfq_batches')
    .update({ status: 'closed', updated_at: now })
    .eq('id', rfqId)
    .eq('status', 'open');

  if (rfqErr) throw rfqErr;

  if (!isGoodsOrServices && !isPr2Native && pr1Id) {
    const { error: pr1Err } = await db
      .from('pr1_requests')
      .update({ status: 'canvassing_complete', updated_at: now })
      .eq('id', pr1Id);

    if (pr1Err) throw pr1Err;
  }

  await db.from('audit_logs').insert({
    actor_id:      profile.id,
    action:        'RFQ_CLOSED',
    document_type: 'RFQ',
    document_id:   rfqId,
    payload:       {
      closed_by:  profile.full_name,
      pr1_id:     pr1Id,
      pr2_id:     pr2?.id ?? null,
      goods_or_services_flow: isGoodsOrServices,
      raw_material_flow: isRawMaterial,
      pr2_native_services_flow: isPr2Native && !isRawMaterial,
    },
  });

  if (isGoodsOrServices || isPr2Native) {
    await submitRfqForApproval(rfqId, profile);
    return;
  }

  if (!pr1Id) return; // legacy fallback path only past this point

  try {
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

// ─── Reopen RFQ ───────────────────────────────────────────────────────────────

export async function reopenRfq(rfqId: string, profile: UserProfile): Promise<void> {
  const { data: rfq, error: rfqFetchErr } = await db
    .from('rfq_batches')
    .select('id, rfq_number, pr1_id, pr2_id, status')
    .eq('id', rfqId)
    .maybeSingle();
  if (rfqFetchErr) throw rfqFetchErr;
  if (!rfq) throw new Error('RFQ not found.');
  if (rfq.status !== 'closed') throw new Error('Only a closed RFQ can be reopened.');

  const [{ data: pr1 }, pr2Res] = await Promise.all([
    rfq.pr1_id
      ? db.from('pr1_requests').select('request_type').eq('id', rfq.pr1_id).maybeSingle()
      : Promise.resolve({ data: null }),
    !rfq.pr1_id && rfq.pr2_id
      ? db.from('pr2_requests').select('id, request_type').eq('id', rfq.pr2_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  // Phase 3 (Raw Mats): a raw-material RFQ has no pr1_id — resolving
  // isGoodsOrServices from pr1?.request_type alone would silently fall into
  // the legacy branch below and block reopen forever (the linked PR2 always
  // exists, since it's linked at RFQ creation, not after close).
  const pr2 = pr2Res.data as { id: string; request_type: string } | null;
  const isGoodsOrServices = pr1?.request_type === 'goods' || pr1?.request_type === 'services';
  // PR2-native (no pr1_id): Raw Material or a Planning-direct Services PR2.
  const isPr2Native = !rfq.pr1_id && (pr2?.request_type === 'raw_material' || pr2?.request_type === 'services');
  const followsApprovalFlow = isGoodsOrServices || isPr2Native;

  if (followsApprovalFlow) {
    const { data: approval } = await db
      .from('approval_instances')
      .select('status')
      .eq('document_type', 'RFQ')
      .eq('document_id', rfqId)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (approval?.status === 'approved') {
      throw new Error('RFQ approval is complete. It can no longer be reopened.');
    }
    if (rfq.pr2_id) {
      const { data: existingPO } = await db
        .from('po_requests')
        .select('id')
        .eq('pr2_id', rfq.pr2_id)
        .limit(1)
        .maybeSingle();
      if (existingPO?.id) {
        throw new Error('A PO has already been created from this PR2. The RFQ can no longer be reopened.');
      }
    }
    if (approval?.status === 'active') {
      await db
        .from('approval_instances')
        .update({ status: 'cancelled', completed_at: new Date().toISOString() })
        .eq('document_type', 'RFQ')
        .eq('document_id', rfqId)
        .eq('status', 'active');
    }
  } else {
    const { data: existingPR2 } = await db
      .from('pr2_requests')
      .select('id')
      .eq('rfq_id', rfqId)
      .maybeSingle();
    if (existingPR2?.id) {
      throw new Error('A PR2 has already been generated from this RFQ. It can no longer be reopened.');
    }
  }

  const now = new Date().toISOString();

  const { error: rfqErr } = await db
    .from('rfq_batches')
    .update({ status: 'open', updated_at: now })
    .eq('id', rfqId);
  if (rfqErr) throw rfqErr;

  if (rfq.pr1_id) {
    const nextPr1Status = isGoodsOrServices ? 'pr2_approved' : 'for_canvassing';
    const { error: pr1Err } = await db
      .from('pr1_requests')
      .update({ status: nextPr1Status, updated_at: now })
      .eq('id', rfq.pr1_id);
    if (pr1Err) throw pr1Err;
  }

  await db.from('audit_logs').insert({
    actor_id:      profile.id,
    action:        'RFQ_REOPENED',
    document_type: 'RFQ',
    document_id:   rfqId,
    payload:       { rfq_number: rfq.rfq_number, reopened_by: profile.full_name, pr1_id: rfq.pr1_id, pr2_id: rfq.pr2_id ?? null },
  });

  try {
    if (rfq.pr1_id) {
      const { data: pr1Row } = await db
        .from('pr1_requests')
        .select('pr1_number, requisitioner_id')
        .eq('id', rfq.pr1_id)
        .maybeSingle();

      const pr1Label = pr1Row?.pr1_number ?? 'PR1';

      await notifyByRole(
        'procurement',
        {
          title:         'RFQ Reopened',
          body:          `RFQ ${rfq.rfq_number} for ${pr1Label} has been reopened by ${profile.full_name}.`,
          type:          'info',
          document_type: 'rfq',
          document_id:   rfqId,
          action_url:    `/rfq/${rfqId}`,
        },
        { dedupeUnreadForDocument: true }
      );

      if (pr1Row?.requisitioner_id) {
        await createNotification({
          user_id:       pr1Row.requisitioner_id,
          title:         'RFQ Reopened',
          body:          `Canvassing for your request ${pr1Label} has been reopened for further supplier changes.`,
          type:          'info',
          document_type: 'pr1',
          document_id:   rfq.pr1_id,
          action_url:    `/pr1/${rfq.pr1_id}`,
        });
      }
    } else if (pr2) {
      const { data: pr2Row } = await db
        .from('pr2_requests')
        .select('pr2_number, requisitioner_id')
        .eq('id', pr2.id)
        .maybeSingle();

      const pr2Label = pr2Row?.pr2_number ?? 'PR2';

      await notifyByRole(
        'procurement',
        {
          title:         'RFQ Reopened',
          body:          `RFQ ${rfq.rfq_number} for ${pr2Label} has been reopened by ${profile.full_name}.`,
          type:          'info',
          document_type: 'rfq',
          document_id:   rfqId,
          action_url:    `/rfq/${rfqId}`,
        },
        { dedupeUnreadForDocument: true }
      );

      if (pr2Row?.requisitioner_id) {
        await createNotification({
          user_id:       pr2Row.requisitioner_id,
          title:         'RFQ Reopened',
          body:          `Canvassing for your request ${pr2Label} has been reopened for further supplier changes.`,
          type:          'info',
          document_type: 'pr2',
          document_id:   pr2.id,
          action_url:    `/planning/pr2/${pr2.id}`,
        });
      }
    }
  } catch {
    // Notifications are best-effort; do not fail reopenRfq
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
  // catalog-product / raw-mats logic below. `pr1ItemId` is really just "the
  // item id" — Phase 3 (Raw Mats) PR2-native lines pass a pr2_items.id here,
  // resolved via the OR below since exactly one of pr1_item_id/pr2_item_id
  // is set on any given quote row.
  const { data: quote } = await db
    .from('rfq_item_quotes')
    .select('id, is_alternative, supplier_product_id, response_status, pr1_item_id, pr2_item_id')
    .eq('rfq_supplier_id', selectedRfqSupplierId)
    .or(`pr1_item_id.eq.${pr1ItemId},pr2_item_id.eq.${pr1ItemId}`)
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
  // manual quote require a written justification. Look up the source line
  // (pr1_items or, Phase 3, pr2_items) to determine the raw-mats flag.
  let isRawMaterial: boolean;
  if (quote.pr1_item_id) {
    const { data: pr1Item } = await db
      .from('pr1_items')
      .select('is_raw_material')
      .eq('id', quote.pr1_item_id)
      .maybeSingle();
    isRawMaterial = (pr1Item as any)?.is_raw_material === true;
  } else {
    const { data: pr2Item } = await db
      .from('pr2_items')
      .select('is_raw_material')
      .eq('id', quote.pr2_item_id)
      .maybeSingle();
    isRawMaterial = (pr2Item as any)?.is_raw_material === true;
  }
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
        pr1_item_id:              quote.pr1_item_id ?? null,
        pr2_item_id:              quote.pr2_item_id ?? null,
        selected_rfq_supplier_id: selectedRfqSupplierId,
        selected_by:              profile.id,
        selected_at:              now,
        selection_notes:          notes.trim() || null,
        quote_justification:      finalJustification,
        requires_justification:   requiresJustification,
      },
      // Phase 3 (Raw Mats): supplier_item_selections_rfq_item_key is a
      // single NULLS NOT DISTINCT composite index, so one onConflict target
      // handles both pr1- and pr2-keyed rows.
      { onConflict: 'rfq_id,pr1_item_id,pr2_item_id' }
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
    .or(`pr1_item_id.eq.${pr1ItemId},pr2_item_id.eq.${pr1ItemId}`);

  if (error) throw error;

  await db.from('audit_logs').insert({
    actor_id:      profile.id,
    action:        'RFQ_SELECTION_CLEARED',
    document_type: 'RFQ',
    document_id:   rfqId,
    payload:       { pr1_item_id: pr1ItemId },
  });
}

// ─── Substitute item review (requestor + procurement) ───────────────────────

/** Maps `decided_by` profile id → role name, for attributing who made a substitute decision. */
async function buildDeciderRoleMap(decisionRows: SubstituteDecisionRow[]): Promise<Record<string, string>> {
  const decidedByIds = Array.from(new Set(decisionRows.map(d => d.decided_by).filter(Boolean)));
  if (decidedByIds.length === 0) return {};

  const [{ data: deciderProfiles }, { data: allRoles }] = await Promise.all([
    db.from('profiles').select('id, role_id').in('id', decidedByIds),
    db.from('roles').select('id, name'),
  ]);

  const roleNameById = Object.fromEntries(((allRoles ?? []) as any[]).map((r: any) => [r.id, r.name]));
  return Object.fromEntries(
    ((deciderProfiles ?? []) as any[]).map((p: any) => [p.id, roleNameById[p.role_id] ?? ''])
  );
}

/**
 * All alternative-flagged quotes visible to the caller, grouped by PR1. RLS does the
 * scoping: employees see only their own PR1s (`is_own_rfq_supplier`); procurement sees
 * every PR1 system-wide (`Procurement can view all quotes`, etc). Used by both the
 * employee and procurement substitute inboxes — no role branching needed here.
 */
export async function fetchSubstituteReviewBundles(): Promise<SubstituteReviewBundle[]> {
  const { data: quotes } = await db
    .from('rfq_item_quotes')
    .select('*')
    .eq('is_alternative', true)
    .not('submitted_at', 'is', null);

  const quoteArr: any[] = quotes ?? [];
  if (quoteArr.length === 0) return [];

  const rfqSupplierIds = Array.from(new Set(quoteArr.map(q => q.rfq_supplier_id)));
  const { data: rfqSuppliers } = await db
    .from('rfq_suppliers')
    .select('id, rfq_id, supplier_name_snapshot')
    .in('id', rfqSupplierIds);
  const supplierArr: any[] = rfqSuppliers ?? [];
  if (supplierArr.length === 0) return [];

  const rfqIds = Array.from(new Set(supplierArr.map(rs => rs.rfq_id)));
  const { data: rfqs } = await db
    .from('rfq_batches')
    .select('id, rfq_number, status, pr1_id, pr2_id')
    .in('id', rfqIds);
  const rfqArr: any[] = rfqs ?? [];
  if (rfqArr.length === 0) return [];

  const supplierMap: Record<string, any> = Object.fromEntries(supplierArr.map(rs => [rs.id, rs]));
  const rfqMap: Record<string, any>      = Object.fromEntries(rfqArr.map(r => [r.id, r]));

  const pr1Rfqs = rfqArr.filter(r => r.pr1_id);
  const pr2Rfqs = rfqArr.filter(r => !r.pr1_id && r.pr2_id);

  const pr1Ids = Array.from(new Set(pr1Rfqs.map(r => r.pr1_id as string)));
  const pr2Ids = Array.from(new Set(pr2Rfqs.map(r => r.pr2_id as string)));

  // ── PR1 bundles (existing path — keep query/loop semantics) ───────────────
  let pr1Bundles: SubstituteReviewBundle[] = [];
  if (pr1Ids.length > 0) {
    const { data: pr1s } = await db
      .from('pr1_requests')
      .select('id, pr1_number, purpose, department_name_snapshot, requisitioner_id, requisitioner_name_snapshot, priority')
      .in('id', pr1Ids)
      .order('created_at', { ascending: false });
    const pr1Arr: any[] = pr1s ?? [];

    if (pr1Arr.length > 0) {
      const pr1RfqIdSet = new Set(pr1Rfqs.map(r => r.id as string));
      const pr1QuoteArr = quoteArr.filter(q => {
        const supplier = supplierMap[q.rfq_supplier_id];
        return supplier && pr1RfqIdSet.has(supplier.rfq_id);
      });
      const itemIds  = Array.from(new Set(pr1QuoteArr.map(q => q.pr1_item_id).filter(Boolean)));
      const quoteIds = pr1QuoteArr.map(q => q.id);
      const pr1RfqIds = Array.from(pr1RfqIdSet);

      const [itemsRes, decisionsRes, attachmentsByQuote, selectionsRes] = await Promise.all([
        itemIds.length > 0
          ? db.from('pr1_items')
              .select('id, item_order, item_code, description, unit_of_measure, quantity_requested')
              .in('id', itemIds)
          : Promise.resolve({ data: [] as any[] }),
        quoteIds.length > 0
          ? db.from('substitute_decisions').select('*').in('rfq_item_quote_id', quoteIds)
          : Promise.resolve({ data: [] as any[] }),
        fetchRfqQuoteAttachmentsByQuoteIds(quoteIds).catch(() => ({} as Record<string, RfqQuoteAttachment[]>)),
        db.from('supplier_item_selections').select('rfq_id, pr1_item_id').in('rfq_id', pr1RfqIds),
      ]);

      const itemMap: Record<string, any> = Object.fromEntries(((itemsRes.data ?? []) as any[]).map((i: any) => [i.id, i]));
      const decisionRows = (decisionsRes.data ?? []) as SubstituteDecisionRow[];
      const decisionMap: Record<string, SubstituteDecisionRow> = Object.fromEntries(
        decisionRows.map(d => [d.rfq_item_quote_id, d])
      );
      const awardedKeys = new Set<string>(
        ((selectionsRes.data ?? []) as any[]).map((s: any) => `${s.rfq_id}|${s.pr1_item_id}`)
      );
      const deciderRoleMap = await buildDeciderRoleMap(decisionRows);

      const whByPr1: Record<string, Awaited<ReturnType<typeof fetchWarehouseProcurementByPr1Item>>> = {};
      await Promise.all(pr1Ids.map(async id => { whByPr1[id] = await fetchWarehouseProcurementByPr1Item(id); }));

      const bundlesByPr1: Record<string, SubstituteReviewItem[]> = Object.fromEntries(pr1Ids.map(id => [id, []]));

      for (const q of pr1QuoteArr) {
        const item     = itemMap[q.pr1_item_id];
        const supplier = supplierMap[q.rfq_supplier_id];
        if (!item || !supplier) continue;
        const rfq = rfqMap[supplier.rfq_id];
        if (!rfq || !bundlesByPr1[rfq.pr1_id]) continue;

        const decision = decisionMap[q.id] ?? null;
        const wh = whByPr1[rfq.pr1_id];
        const rfqQty = !wh?.validated
          ? Number(item.quantity_requested) || 0
          : (wh.byPr1ItemId[item.id] !== undefined && wh.byPr1ItemId[item.id] > 0
              ? wh.byPr1ItemId[item.id]
              : Number(item.quantity_requested) || 0);

        bundlesByPr1[rfq.pr1_id].push({
          quote_id:             q.id,
          rfq_id:               supplier.rfq_id,
          rfq_number:           rfq.rfq_number ?? '',
          rfq_supplier_id:      supplier.id,
          supplier_name:        supplier.supplier_name_snapshot,
          pr1_item_id:          item.id,
          item_order:           item.item_order,
          item_code:            item.item_code,
          original_description: item.description,
          original_quantity:    rfqQty,
          unit_of_measure:      item.unit_of_measure,
          quoted_description:   q.quoted_description,
          unit_price:           Number(q.unit_price),
          lead_time_days:       q.lead_time_days,
          remarks:              q.remarks,
          submitted_at:         q.submitted_at,
          decision:             decision?.decision ?? null,
          decided_at:           decision?.decided_at ?? null,
          decision_notes:       decision?.notes ?? null,
          decided_by_role:      decision ? (deciderRoleMap[decision.decided_by] ?? null) : null,
          attachments:          attachmentsByQuote[q.id] ?? [],
          rfq_status:           rfq.status ?? 'open',
          is_awarded:           awardedKeys.has(`${supplier.rfq_id}|${item.id}`),
        });
      }

      pr1Bundles = pr1Arr
        .map(pr1 => ({
          source: 'pr1' as const,
          pr1,
          substitutes: (bundlesByPr1[pr1.id] ?? []).sort((a, b) => a.item_order - b.item_order),
        }))
        .filter(b => b.substitutes.length > 0);
    }
  }

  // ── PR2-native bundles (parallel path; no warehouse qty step) ─────────────
  let pr2Bundles: SubstituteReviewBundle[] = [];
  if (pr2Ids.length > 0) {
    const { data: pr2s } = await db
      .from('pr2_requests')
      .select('id, pr2_number, purpose, department_name_snapshot, requisitioner_id, requisitioner_name_snapshot, priority')
      .in('id', pr2Ids)
      .order('created_at', { ascending: false });
    const pr2Arr: any[] = pr2s ?? [];

    if (pr2Arr.length > 0) {
      const pr2RfqIdSet = new Set(pr2Rfqs.map(r => r.id as string));
      const pr2QuoteArr = quoteArr.filter(q => {
        const supplier = supplierMap[q.rfq_supplier_id];
        return supplier && pr2RfqIdSet.has(supplier.rfq_id) && q.pr2_item_id;
      });
      const itemIds  = Array.from(new Set(pr2QuoteArr.map(q => q.pr2_item_id).filter(Boolean)));
      const quoteIds = pr2QuoteArr.map(q => q.id);
      const pr2RfqIds = Array.from(pr2RfqIdSet);

      const [itemsRes, decisionsRes, attachmentsByQuote, selectionsRes] = await Promise.all([
        itemIds.length > 0
          ? db.from('pr2_items')
              .select('id, item_order, item_code, description, unit_of_measure, quantity_requested')
              .in('id', itemIds)
          : Promise.resolve({ data: [] as any[] }),
        quoteIds.length > 0
          ? db.from('substitute_decisions').select('*').in('rfq_item_quote_id', quoteIds)
          : Promise.resolve({ data: [] as any[] }),
        fetchRfqQuoteAttachmentsByQuoteIds(quoteIds).catch(() => ({} as Record<string, RfqQuoteAttachment[]>)),
        db.from('supplier_item_selections')
          .select('rfq_id, pr1_item_id, pr2_item_id')
          .in('rfq_id', pr2RfqIds),
      ]);

      const itemMap: Record<string, any> = Object.fromEntries(((itemsRes.data ?? []) as any[]).map((i: any) => [i.id, i]));
      const decisionRows = (decisionsRes.data ?? []) as SubstituteDecisionRow[];
      const decisionMap: Record<string, SubstituteDecisionRow> = Object.fromEntries(
        decisionRows.map(d => [d.rfq_item_quote_id, d])
      );
      const awardedKeys = new Set<string>(
        ((selectionsRes.data ?? []) as any[])
          .filter((s: any) => s.pr2_item_id)
          .map((s: any) => `${s.rfq_id}|${s.pr2_item_id}`)
      );
      const deciderRoleMap = await buildDeciderRoleMap(decisionRows);

      const bundlesByPr2: Record<string, SubstituteReviewItem[]> = Object.fromEntries(pr2Ids.map(id => [id, []]));

      for (const q of pr2QuoteArr) {
        const item     = itemMap[q.pr2_item_id];
        const supplier = supplierMap[q.rfq_supplier_id];
        if (!item || !supplier) continue;
        const rfq = rfqMap[supplier.rfq_id];
        if (!rfq || !bundlesByPr2[rfq.pr2_id]) continue;

        const decision = decisionMap[q.id] ?? null;

        bundlesByPr2[rfq.pr2_id].push({
          quote_id:             q.id,
          rfq_id:               supplier.rfq_id,
          rfq_number:           rfq.rfq_number ?? '',
          rfq_supplier_id:      supplier.id,
          supplier_name:        supplier.supplier_name_snapshot,
          pr1_item_id:          null,
          pr2_item_id:          item.id,
          item_order:           item.item_order,
          item_code:            item.item_code,
          original_description: item.description,
          original_quantity:    Number(item.quantity_requested) || 0,
          unit_of_measure:      item.unit_of_measure,
          quoted_description:   q.quoted_description,
          unit_price:           Number(q.unit_price),
          lead_time_days:       q.lead_time_days,
          remarks:              q.remarks,
          submitted_at:         q.submitted_at,
          decision:             decision?.decision ?? null,
          decided_at:           decision?.decided_at ?? null,
          decision_notes:       decision?.notes ?? null,
          decided_by_role:      decision ? (deciderRoleMap[decision.decided_by] ?? null) : null,
          attachments:          attachmentsByQuote[q.id] ?? [],
          rfq_status:           rfq.status ?? 'open',
          is_awarded:           awardedKeys.has(`${supplier.rfq_id}|${item.id}`),
        });
      }

      pr2Bundles = pr2Arr
        .map(pr2 => ({
          source: 'pr2' as const,
          pr1: {
            id:                          pr2.id,
            pr1_number:                  pr2.pr2_number,
            purpose:                     pr2.purpose,
            department_name_snapshot:    pr2.department_name_snapshot,
            requisitioner_id:            pr2.requisitioner_id,
            requisitioner_name_snapshot: pr2.requisitioner_name_snapshot,
            priority:                    pr2.priority ?? 'normal',
          },
          substitutes: (bundlesByPr2[pr2.id] ?? []).sort((a, b) => a.item_order - b.item_order),
        }))
        .filter(b => b.substitutes.length > 0);
    }
  }

  return pr1Bundles.concat(pr2Bundles);
}

/**
 * Backward-compatible wrapper — RLS already scopes `fetchSubstituteReviewBundles` to
 * whatever the caller can see, so the requestor id is not needed for filtering anymore.
 */
export async function fetchSubstitutesForRequestor(_requisitionerId: string): Promise<SubstituteReviewBundle[]> {
  return fetchSubstituteReviewBundles();
}

/**
 * Load the substitute-review bundle for a single PR1. Returns null if the
 * caller has no permission (RLS will zero-fill), or no PR1 exists.
 */
export async function fetchSubstituteBundleForPr1(
  pr1Id: string
): Promise<SubstituteReviewBundle | null> {
  const { data: pr1 } = await db
    .from('pr1_requests')
    .select('id, pr1_number, purpose, department_name_snapshot, requisitioner_id, requisitioner_name_snapshot, priority')
    .eq('id', pr1Id)
    .maybeSingle();

  if (!pr1) return null;
  return loadSubstitutesForPr1(pr1);
}

export async function fetchSubstituteBundleForPr2(
  pr2Id: string
): Promise<SubstituteReviewBundle | null> {
  const { data: pr2 } = await db
    .from('pr2_requests')
    .select('id, pr2_number, purpose, department_name_snapshot, requisitioner_id, requisitioner_name_snapshot, priority')
    .eq('id', pr2Id)
    .maybeSingle();

  if (!pr2) return null;
  return loadSubstitutesForPr2(pr2);
}

/** Detail page entry: try PR1 first (unchanged path), then PR2. */
export async function fetchSubstituteBundleForRequest(
  requestId: string
): Promise<SubstituteReviewBundle | null> {
  const pr1Bundle = await fetchSubstituteBundleForPr1(requestId);
  if (pr1Bundle) return { ...pr1Bundle, source: 'pr1' as const };
  return fetchSubstituteBundleForPr2(requestId);
}

async function loadSubstitutesForPr1(pr1: any): Promise<SubstituteReviewBundle | null> {
  // Find all RFQ batches linked to this PR1
  const { data: rfqs } = await db
    .from('rfq_batches')
    .select('id, rfq_number, status')
    .eq('pr1_id', pr1.id);

  const rfqArr: any[] = rfqs ?? [];
  if (rfqArr.length === 0) {
    return { source: 'pr1', pr1, substitutes: [] };
  }

  const rfqIds = rfqArr.map(r => r.id);

  // rfq_suppliers for these RFQs
  const { data: rfqSuppliers } = await db
    .from('rfq_suppliers')
    .select('id, rfq_id, supplier_name_snapshot')
    .in('rfq_id', rfqIds);

  const supplierArr: any[] = rfqSuppliers ?? [];
  if (supplierArr.length === 0) {
    return { source: 'pr1', pr1, substitutes: [] };
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
    return { source: 'pr1', pr1, substitutes: [] };
  }

  // Items + decisions in parallel
  const itemIds = Array.from(new Set(quoteArr.map(q => q.pr1_item_id)));
  const quoteIds = quoteArr.map(q => q.id);

  const [itemsRes, decisionsRes, attachmentsByQuote, selectionsRes] = await Promise.all([
    db.from('pr1_items')
      .select('id, item_order, item_code, description, unit_of_measure, quantity_requested')
      .in('id', itemIds),
    db.from('substitute_decisions')
      .select('*')
      .in('rfq_item_quote_id', quoteIds),
    fetchRfqQuoteAttachmentsByQuoteIds(quoteIds).catch(() => ({} as Record<string, RfqQuoteAttachment[]>)),
    db.from('supplier_item_selections')
      .select('rfq_id, pr1_item_id')
      .in('rfq_id', rfqIds),
  ]);

  const itemMap: Record<string, any> = Object.fromEntries(((itemsRes.data ?? []) as any[]).map((i: any) => [i.id, i]));
  const supplierMap: Record<string, any> = Object.fromEntries(supplierArr.map(rs => [rs.id, rs]));
  const rfqMap: Record<string, any> = Object.fromEntries(rfqArr.map(r => [r.id, r]));
  const decisionRows = (decisionsRes.data ?? []) as SubstituteDecisionRow[];
  const decisionMap: Record<string, SubstituteDecisionRow> = Object.fromEntries(
    decisionRows.map(d => [d.rfq_item_quote_id, d])
  );
  // Set of "rfqId|pr1ItemId" keys that have an award recorded
  const awardedKeys = new Set<string>(
    ((selectionsRes.data ?? []) as any[]).map((s: any) => `${s.rfq_id}|${s.pr1_item_id}`)
  );
  const deciderRoleMap = await buildDeciderRoleMap(decisionRows);

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
        decided_by_role:      decision ? (deciderRoleMap[decision.decided_by] ?? null) : null,
        attachments:          attachmentsByQuote[q.id] ?? [],
        rfq_status:           rfq?.status ?? 'open',
        is_awarded:           awardedKeys.has(`${supplier.rfq_id}|${item.id}`),
      };
    })
    .filter((s): s is SubstituteReviewItem => s !== null)
    .sort((a, b) => a.item_order - b.item_order);

  return { source: 'pr1', pr1, substitutes };
}

async function loadSubstitutesForPr2(pr2: any): Promise<SubstituteReviewBundle | null> {
  const header = {
    id:                          pr2.id,
    pr1_number:                  pr2.pr2_number,
    purpose:                     pr2.purpose,
    department_name_snapshot:    pr2.department_name_snapshot,
    requisitioner_id:            pr2.requisitioner_id,
    requisitioner_name_snapshot: pr2.requisitioner_name_snapshot,
    priority:                    pr2.priority ?? 'normal',
  };

  const { data: rfqs } = await db
    .from('rfq_batches')
    .select('id, rfq_number, status')
    .eq('pr2_id', pr2.id)
    .is('pr1_id', null);

  const rfqArr: any[] = rfqs ?? [];
  if (rfqArr.length === 0) {
    return { source: 'pr2', pr1: header, substitutes: [] };
  }

  const rfqIds = rfqArr.map(r => r.id);

  const { data: rfqSuppliers } = await db
    .from('rfq_suppliers')
    .select('id, rfq_id, supplier_name_snapshot')
    .in('rfq_id', rfqIds);

  const supplierArr: any[] = rfqSuppliers ?? [];
  if (supplierArr.length === 0) {
    return { source: 'pr2', pr1: header, substitutes: [] };
  }

  const rfqSupplierIds = supplierArr.map(rs => rs.id);

  const { data: quotes } = await db
    .from('rfq_item_quotes')
    .select('*')
    .in('rfq_supplier_id', rfqSupplierIds)
    .eq('is_alternative', true)
    .not('submitted_at', 'is', null);

  const quoteArr: any[] = quotes ?? [];
  if (quoteArr.length === 0) {
    return { source: 'pr2', pr1: header, substitutes: [] };
  }

  const itemIds = Array.from(new Set(quoteArr.map(q => q.pr2_item_id).filter(Boolean)));
  const quoteIds = quoteArr.map(q => q.id);

  const [itemsRes, decisionsRes, attachmentsByQuote, selectionsRes] = await Promise.all([
    itemIds.length > 0
      ? db.from('pr2_items')
          .select('id, item_order, item_code, description, unit_of_measure, quantity_requested')
          .in('id', itemIds)
      : Promise.resolve({ data: [] as any[] }),
    db.from('substitute_decisions')
      .select('*')
      .in('rfq_item_quote_id', quoteIds),
    fetchRfqQuoteAttachmentsByQuoteIds(quoteIds).catch(() => ({} as Record<string, RfqQuoteAttachment[]>)),
    db.from('supplier_item_selections')
      .select('rfq_id, pr1_item_id, pr2_item_id')
      .in('rfq_id', rfqIds),
  ]);

  const itemMap: Record<string, any> = Object.fromEntries(((itemsRes.data ?? []) as any[]).map((i: any) => [i.id, i]));
  const supplierMap: Record<string, any> = Object.fromEntries(supplierArr.map(rs => [rs.id, rs]));
  const rfqMap: Record<string, any> = Object.fromEntries(rfqArr.map(r => [r.id, r]));
  const decisionRows = (decisionsRes.data ?? []) as SubstituteDecisionRow[];
  const decisionMap: Record<string, SubstituteDecisionRow> = Object.fromEntries(
    decisionRows.map(d => [d.rfq_item_quote_id, d])
  );
  const awardedKeys = new Set<string>(
    ((selectionsRes.data ?? []) as any[])
      .filter((s: any) => s.pr2_item_id)
      .map((s: any) => `${s.rfq_id}|${s.pr2_item_id}`)
  );
  const deciderRoleMap = await buildDeciderRoleMap(decisionRows);

  const substitutes: SubstituteReviewItem[] = quoteArr
    .map((q: any): SubstituteReviewItem | null => {
      const item     = itemMap[q.pr2_item_id];
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
        pr1_item_id:          null,
        pr2_item_id:          item.id,
        item_order:           item.item_order,
        item_code:            item.item_code,
        original_description: item.description,
        original_quantity:    Number(item.quantity_requested) || 0,
        unit_of_measure:      item.unit_of_measure,
        quoted_description:   q.quoted_description,
        unit_price:           Number(q.unit_price),
        lead_time_days:       q.lead_time_days,
        remarks:              q.remarks,
        submitted_at:         q.submitted_at,
        decision:             decision?.decision ?? null,
        decided_at:           decision?.decided_at ?? null,
        decision_notes:       decision?.notes ?? null,
        decided_by_role:      decision ? (deciderRoleMap[decision.decided_by] ?? null) : null,
        attachments:          attachmentsByQuote[q.id] ?? [],
        rfq_status:           rfq?.status ?? 'open',
        is_awarded:           awardedKeys.has(`${supplier.rfq_id}|${item.id}`),
      };
    })
    .filter((s): s is SubstituteReviewItem => s !== null)
    .sort((a, b) => a.item_order - b.item_order);

  return { source: 'pr2', pr1: header, substitutes };
}

export async function saveSubstituteDecision(
  quoteId: string,
  parentRequestId: string,
  decision: SubstituteDecision,
  notes: string,
  profile: UserProfile
): Promise<void> {
  const now = new Date().toISOString();
  const actingAsProcurement = profile.role === 'procurement';

  const { data: quote } = await db
    .from('rfq_item_quotes')
    .select('id, rfq_supplier_id, is_alternative, quoted_description')
    .eq('id', quoteId)
    .maybeSingle();
  if (!quote) throw new Error('Quote not found.');
  if (!quote.is_alternative) throw new Error('Not an alternative quote.');

  const { data: rs } = await db
    .from('rfq_suppliers')
    .select('rfq_id, supplier_name_snapshot')
    .eq('id', quote.rfq_supplier_id)
    .maybeSingle();
  if (!rs?.rfq_id) throw new Error('RFQ assignment not found.');

  const { data: rfq } = await db
    .from('rfq_batches')
    .select('id, pr1_id, pr2_id, rfq_number')
    .eq('id', rs.rfq_id)
    .maybeSingle();
  if (!rfq) throw new Error('RFQ not found.');

  const isPr1 = !!rfq.pr1_id;
  const isPr2 = !rfq.pr1_id && !!rfq.pr2_id;
  if (!isPr1 && !isPr2) throw new Error('RFQ has no parent request.');

  const expectedParent = isPr1 ? rfq.pr1_id : rfq.pr2_id;
  if (parentRequestId !== expectedParent) {
    throw new Error('Substitute parent mismatch.');
  }

  const { error } = await db
    .from('substitute_decisions')
    .upsert(
      {
        rfq_item_quote_id: quoteId,
        pr1_id:            isPr1 ? rfq.pr1_id : null,
        pr2_id:            isPr2 ? rfq.pr2_id : null,
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
    payload:       {
      pr1_id:     isPr1 ? rfq.pr1_id : null,
      pr2_id:     isPr2 ? rfq.pr2_id : null,
      notes,
      actor_role: profile.role,
      on_behalf:  actingAsProcurement,
    },
  });

  try {
    const supplierName = rs.supplier_name_snapshot ?? 'A supplier';
    const itemDesc     = (quote.quoted_description ?? 'substitute item').trim();
    const accepted     = decision === 'accepted';

    if (isPr1) {
      const pr1Id = rfq.pr1_id as string;
      const { data: pr1 } = await db
        .from('pr1_requests')
        .select('pr1_number, requisitioner_id')
        .eq('id', pr1Id)
        .maybeSingle();

      const pr1Label = pr1?.pr1_number ?? 'PR1';

      if (actingAsProcurement) {
        // Procurement decided on the requestor's behalf — notify the requestor,
        // not procurement (they already know, they made the decision).
        if (pr1?.requisitioner_id) {
          await db.from('notifications').insert({
            user_id:       pr1.requisitioner_id,
            title:         accepted ? 'Substitute Item Accepted On Your Behalf' : 'Substitute Item Rejected On Your Behalf',
            body:          `Procurement ${accepted ? 'accepted' : 'rejected'} ${supplierName}'s substitute offer "${itemDesc}" for ${pr1Label} on your behalf.`,
            type:          'info',
            document_type: 'rfq',
            document_id:   rs.rfq_id,
            action_url:    `/substitutes/${pr1Id}`,
            read:          false,
          });
        }
      } else {
        await notifyByRole('procurement', {
          title:         accepted ? 'Substitute Item Accepted' : 'Substitute Item Rejected',
          body:          `Requestor ${accepted ? 'accepted' : 'rejected'} ${supplierName}'s substitute offer "${itemDesc}" for ${pr1Label}.`,
          type:          'info',
          document_type: 'rfq',
          document_id:   rs.rfq_id,
          action_url:    `/rfq/${rs.rfq_id}`,
        });
      }
    } else {
      const pr2Id = rfq.pr2_id as string;
      const { data: pr2 } = await db
        .from('pr2_requests')
        .select('pr2_number, requisitioner_id')
        .eq('id', pr2Id)
        .maybeSingle();

      const pr2Label = pr2?.pr2_number ?? 'PR2';

      if (actingAsProcurement) {
        if (pr2?.requisitioner_id) {
          await db.from('notifications').insert({
            user_id:       pr2.requisitioner_id,
            title:         accepted ? 'Substitute Item Accepted On Your Behalf' : 'Substitute Item Rejected On Your Behalf',
            body:          `Procurement ${accepted ? 'accepted' : 'rejected'} ${supplierName}'s substitute offer "${itemDesc}" for ${pr2Label} on your behalf.`,
            type:          'info',
            document_type: 'rfq',
            document_id:   rs.rfq_id,
            action_url:    `/substitutes/${pr2Id}`,
            read:          false,
          });
        }
      } else {
        await notifyByRole('procurement', {
          title:         accepted ? 'Substitute Item Accepted' : 'Substitute Item Rejected',
          body:          `Requestor ${accepted ? 'accepted' : 'rejected'} ${supplierName}'s substitute offer "${itemDesc}" for ${pr2Label}.`,
          type:          'info',
          document_type: 'rfq',
          document_id:   rs.rfq_id,
          action_url:    `/rfq/${rs.rfq_id}`,
        });
      }
    }
  } catch {
    // Notifications are best-effort; do not fail substitute decision
  }
}

/**
 * A substitute only needs a decision if it's undecided AND still actionable —
 * once its RFQ closes/cancels or the line gets awarded, the decision UI locks
 * and an undecided item would otherwise count as "pending" forever with no
 * way to resolve it.
 */
export function isSubstituteActionable(s: Pick<SubstituteReviewItem, 'decision' | 'rfq_status' | 'is_awarded'>): boolean {
  return s.decision === null && s.rfq_status !== 'closed' && s.rfq_status !== 'cancelled' && !s.is_awarded;
}

export async function fetchPendingSubstituteCount(requisitionerId: string): Promise<number> {
  const bundles = await fetchSubstitutesForRequestor(requisitionerId);
  return bundles.reduce(
    (sum, b) => sum + b.substitutes.filter(isSubstituteActionable).length,
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

export async function fetchSupplierInboxCounts(supplierId: string): Promise<{
  invited: number;
  submitted: number;
  declined: number;
  total: number;
}> {
  const [invitedRes, submittedRes, declinedRes] = await Promise.all([
    db.from('rfq_suppliers').select('id', { count: 'exact', head: true }).eq('supplier_id', supplierId).eq('status', 'invited'),
    db.from('rfq_suppliers').select('id', { count: 'exact', head: true }).eq('supplier_id', supplierId).eq('status', 'submitted'),
    db.from('rfq_suppliers').select('id', { count: 'exact', head: true }).eq('supplier_id', supplierId).eq('status', 'declined'),
  ]);
  const invited   = invitedRes.count   ?? 0;
  const submitted = submittedRes.count ?? 0;
  const declined  = declinedRes.count  ?? 0;
  return { invited, submitted, declined, total: invited + submitted + declined };
}

export async function fetchSupplierInboxPaged(
  supplierId: string,
  options: { limit: number; offset: number; statusFilter?: 'invited' | 'submitted' | 'declined' | 'all' }
): Promise<{ inbox: SupplierRfqInboxRow[]; total_count: number }> {
  const { limit, offset, statusFilter = 'all' } = options;

  let assignmentsQuery = (db
    .from('rfq_suppliers')
    .select('id, rfq_id, supplier_name_snapshot, status, invited_at, responded_at')
    .eq('supplier_id', supplierId) as any);

  let countQuery = (db
    .from('rfq_suppliers')
    .select('id', { count: 'exact', head: true })
    .eq('supplier_id', supplierId) as any);

  if (statusFilter !== 'all') {
    assignmentsQuery = assignmentsQuery.eq('status', statusFilter);
    countQuery       = countQuery.eq('status', statusFilter);
  }

  const [assignmentsRes, countRes] = await Promise.all([
    assignmentsQuery
      .order('invited_at', { ascending: false })
      .range(offset, offset + limit - 1),
    countQuery,
  ]);

  if (assignmentsRes.error) throw assignmentsRes.error;
  if (countRes.error) throw countRes.error;

  const assignments = assignmentsRes.data ?? [];
  if (assignments.length === 0) return { inbox: [], total_count: countRes.count ?? 0 };

  const rfqIds = (assignments as any[]).map((a: any) => a.rfq_id);

  const { data: rfqs, error: rfqErr } = await db
    .from('rfq_batches')
    .select('id, rfq_number, status, deadline, pr1_id, pr2_id')
    .in('id', rfqIds);

  if (rfqErr) throw rfqErr;

  const pr1Ids: string[] = Array.from(
    new Set(((rfqs ?? []) as any[]).filter((r: any) => r.pr1_id).map((r: any) => r.pr1_id as string)),
  );
  // PR2-native RFQs (raw material / services created directly by Planning —
  // no PR1 in the chain). Without this branch, Purpose/Department/Item count
  // silently resolved to empty/zero for every such RFQ (only pr1_id was ever
  // checked), mirroring the same pr1-only-join bug already fixed elsewhere
  // for request_type/priority resolution.
  const pr2Ids: string[] = Array.from(
    new Set(((rfqs ?? []) as any[]).filter((r: any) => !r.pr1_id && r.pr2_id).map((r: any) => r.pr2_id as string)),
  );

  const [itemCounts, pr2ItemCounts] = await Promise.all([
    fetchRfqLineCountsByPr1Id(pr1Ids),
    fetchRfqLineCountsByPr2Id(pr2Ids),
  ]);

  const [pr1Res, pr2Res, quotesRes] = await Promise.all([
    db.from('pr1_requests')
      .select('id, pr1_number, department_name_snapshot, purpose')
      .in('id', pr1Ids),
    db.from('pr2_requests')
      .select('id, pr2_number, department_name_snapshot, purpose')
      .in('id', pr2Ids),
    db.from('rfq_item_quotes')
      .select('rfq_supplier_id, pr1_item_id, submitted_at')
      .in('rfq_supplier_id', (assignments as any[]).map((a: any) => a.id)),
  ]);

  const rfqMap:   Record<string, any> = Object.fromEntries(((rfqs ?? []) as any[]).map((r: any) => [r.id, r]));
  const pr1Map:   Record<string, any> = Object.fromEntries(((pr1Res.data ?? []) as any[]).map((r: any) => [r.id, r]));
  const pr2Map:   Record<string, any> = Object.fromEntries(((pr2Res.data ?? []) as any[]).map((r: any) => [r.id, r]));
  const quotesArr: any[] = quotesRes.data ?? [];

  return {
    inbox: (assignments as any[]).map((assignment: any) => {
      const rfq = rfqMap[assignment.rfq_id];
      const pr1 = rfq?.pr1_id ? pr1Map[rfq.pr1_id] : null;
      const pr2 = !rfq?.pr1_id && rfq?.pr2_id ? pr2Map[rfq.pr2_id] : null;
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
        pr1_number:       pr1?.pr1_number ?? pr2?.pr2_number ?? '',
        department_name:  pr1?.department_name_snapshot ?? pr2?.department_name_snapshot ?? '',
        purpose:          pr1?.purpose ?? pr2?.purpose ?? '',
        item_count:       pr1 ? (itemCounts[rfq.pr1_id] ?? 0) : pr2 ? (pr2ItemCounts[rfq.pr2_id] ?? 0) : 0,
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
    request_type:            'goods' | 'services' | 'raw_material';
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
      .select('id, rfq_number, status, deadline, notes, pr1_id, pr2_id')
      .eq('id', rs.rfq_id)
      .maybeSingle(),
    db.from('rfq_item_quotes')
      .select('*')
      .eq('rfq_supplier_id', rfqSupplierId),
  ]);

  if (rfqRes.error) throw rfqRes.error;
  if (!rfqRes.data) return null;

  const rfq = rfqRes.data;

  let pr1Header: SupplierQuoteDetail['pr1'];
  let items: SupplierQuoteDetail['items'];

  if (rfq.pr1_id === null) {
    // Phase 3 (Raw Mats): PR2-native RFQ — no PR1, no warehouse step.
    const { data: pr2 } = await db
      .from('pr2_requests')
      .select('pr2_number, department_name_snapshot, purpose')
      .eq('id', rfq.pr2_id)
      .maybeSingle();
    if (!pr2) return null;

    const { data: pr2ItemRows } = await db
      .from('pr2_items')
      .select('id, item_order, item_code, description, unit_of_measure, quantity_requested, is_raw_material')
      .eq('pr2_id', rfq.pr2_id)
      .order('item_order', { ascending: true });

    pr1Header = {
      pr1_number:               pr2.pr2_number,
      department_name_snapshot: pr2.department_name_snapshot,
      purpose:                  pr2.purpose,
      request_type:             'raw_material',
    };
    items = ((pr2ItemRows ?? []) as any[]).map((item) => ({
      id:                 item.id,
      item_order:         item.item_order,
      item_code:          item.item_code,
      description:        item.description,
      unit_of_measure:    item.unit_of_measure,
      quantity_requested: Number(item.quantity_requested) || 0,
      is_raw_material:    item.is_raw_material === true,
      attachments:        [],
    }));
  } else {
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
    items = buildRfqLineItems(pr1Items, warehouse, legacyIds);

    pr1Header = {
      ...pr1Res.data,
      request_type: ((pr1Res.data as any).request_type ?? 'goods') as 'goods' | 'services',
    };
  }

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
    pr1: pr1Header,
    items,
    quotes,
  };
}


// ─── Submit supplier quotation ────────────────────────────────────────────────

export interface QuoteDraft {
  pr1_item_id?:         string | null;
  /** Phase 3 (Raw Mats): set instead of pr1_item_id for PR2-native lines. */
  pr2_item_id?:         string | null;
  quoted_description:   string;
  is_alternative:       boolean;
  unit_price:           number;
  lead_time_days:       string;
  remarks:              string;
  /** Phase 7: optional link to a verified catalog product. */
  supplier_product_id?: string | null;
  /** Omitted or `quoted` = priced/product response; `no_quote` = cannot supply (reason required). */
  response_status?:     RfqQuoteResponseStatus;
  no_quote_reason?:     string | null;
  /** Rev #1: required when the quoting supplier is VAT-registered; null/omitted otherwise. */
  vat_type?:            'vat_inclusive' | 'vat_exclusive' | null;
}

export async function submitSupplierQuotation(
  rfqSupplierId: string,
  quotes: QuoteDraft[]
): Promise<void> {
  const now = new Date().toISOString();

  const { data: assignment, error: assignErr } = await db
    .from('rfq_suppliers')
    .select('id, supplier_id')
    .eq('id', rfqSupplierId)
    .maybeSingle();
  if (assignErr) throw assignErr;
  if (!assignment) throw new Error('RFQ assignment not found.');

  const supplierId = (assignment as { supplier_id: string | null }).supplier_id;
  const productIds = Array.from(
    new Set(
      quotes
        .map(q => q.supplier_product_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    )
  );

  if (productIds.length > 0) {
    if (!supplierId) {
      throw new Error('Catalog products cannot be linked on this RFQ assignment.');
    }

    const { data: products, error: prodErr } = await db
      .from('supplier_products')
      .select('id, supplier_id, status, item_type')
      .in('id', productIds);
    if (prodErr) throw prodErr;

    const byId = new Map(
      ((products ?? []) as {
        id: string;
        supplier_id: string;
        status: string;
        item_type: string | null;
      }[]).map(p => [p.id, p])
    );

    for (const productId of productIds) {
      const product = byId.get(productId);
      if (!product) {
        throw new Error('One or more selected catalog products were not found.');
      }
      if (product.supplier_id !== supplierId) {
        throw new Error('Catalog products must belong to the quoting supplier.');
      }
      if (product.status !== 'verified') {
        throw new Error(
          'Only verified catalog products can be linked on a quote. Deactivated or inactive products cannot be offered.'
        );
      }
      if (product.item_type !== 'goods') {
        throw new Error(
          'Only goods catalog products can be linked on a quote. Services RFQs use manual entry.'
        );
      }
    }
  }

  const rows = quotes.map(q => {
    const status: RfqQuoteResponseStatus =
      q.response_status === 'no_quote' ? 'no_quote' : 'quoted';
    const base = {
      rfq_supplier_id: rfqSupplierId,
      pr1_item_id:     q.pr1_item_id ?? null,
      pr2_item_id:     q.pr2_item_id ?? null,
      submitted_at:    now,
      updated_at:      now,
    };
    if (status === 'no_quote') {
      const reason = (q.no_quote_reason ?? '').trim();
      return {
        ...base,
        quoted_description:  'No quote',
        is_alternative:      false,
        unit_price:          0,
        lead_time_days:      '',
        remarks:             q.remarks.trim() || null,
        supplier_product_id: null,
        response_status:     'no_quote' as const,
        no_quote_reason:     reason,
        vat_type:            null,
      };
    }
    return {
      ...base,
      quoted_description:  q.quoted_description.trim(),
      is_alternative:      q.is_alternative,
      unit_price:          q.unit_price,
      lead_time_days:      q.lead_time_days,
      remarks:             q.remarks.trim() || null,
      supplier_product_id: q.supplier_product_id ?? null,
      response_status:     'quoted' as const,
      no_quote_reason:     null,
      vat_type:            q.vat_type ?? null,
    };
  });

  // Remove any legacy duplicate quote row for the same item where pr1_item_id / pr2_item_id were inverted
  for (const q of quotes) {
    const itemId = q.pr1_item_id ?? q.pr2_item_id;
    if (itemId) {
      if (q.pr1_item_id) {
        await db.from('rfq_item_quotes').delete().eq('rfq_supplier_id', rfqSupplierId).eq('pr2_item_id', itemId);
      } else if (q.pr2_item_id) {
        await db.from('rfq_item_quotes').delete().eq('rfq_supplier_id', rfqSupplierId).eq('pr1_item_id', itemId);
      }
    }
  }

  // Phase 3 (Raw Mats): rfq_item_quotes_supplier_item_key is a single
  // NULLS NOT DISTINCT composite index over (rfq_supplier_id, pr1_item_id,
  // pr2_item_id), so one upsert handles both pr1- and pr2-keyed rows.
  const { error: upsertErr } = await db
    .from('rfq_item_quotes')
    .upsert(rows, { onConflict: 'rfq_supplier_id,pr1_item_id,pr2_item_id' });
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
      .select('id, rfq_number, pr1_id, pr2_id')
      .eq('id', rs.rfq_id)
      .maybeSingle();

    if (!rfq) return;

    // Phase 3 (Raw Mats): a raw-material RFQ has no pr1_id — resolve the
    // label/requestor through pr2_requests instead.
    let requestLabel = 'a request';
    let requisitionerId: string | null = null;
    if (rfq.pr1_id) {
      const { data: pr1 } = await db
        .from('pr1_requests')
        .select('pr1_number, requisitioner_id')
        .eq('id', rfq.pr1_id)
        .maybeSingle();
      requestLabel     = pr1?.pr1_number ?? requestLabel;
      requisitionerId  = pr1?.requisitioner_id ?? null;
    } else if (rfq.pr2_id) {
      const { data: pr2 } = await db
        .from('pr2_requests')
        .select('pr2_number, requisitioner_id')
        .eq('id', rfq.pr2_id)
        .maybeSingle();
      requestLabel     = pr2?.pr2_number ?? requestLabel;
      requisitionerId  = pr2?.requisitioner_id ?? null;
    }
    const pr1Label     = requestLabel;
    const supplierName = rs.supplier_name_snapshot ?? 'A supplier';

    await notifyByRole('procurement', {
      title:         'Supplier Quotation Received',
      body:          `${supplierName} submitted a quotation for ${pr1Label}.`,
      type:          'info',
      document_type: 'rfq',
      document_id:   rfq.id,
      action_url:    `/rfq/${rfq.id}`,
    });

    // Substitute-item review: PR1-originated RFQs, plus PR2-native (Planning-direct /
    // raw-mat) RFQs that have no pr1_id.
    if (rfq.pr1_id && alternativeCount > 0) {
      const altLabel = `${alternativeCount} substitute item${alternativeCount !== 1 ? 's' : ''}`;

      if (requisitionerId) {
        const { data: existing } = await db
          .from('notifications')
          .select('id')
          .eq('user_id', requisitionerId)
          .eq('document_id', rfq.pr1_id)
          .eq('type', 'action_required')
          .eq('read', false)
          .ilike('title', 'Substitute Item%')
          .limit(1);

        if (!existing?.length) {
          await createNotification({
            user_id:       requisitionerId,
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
    } else if (rfq.pr2_id && alternativeCount > 0) {
      const altLabel = `${alternativeCount} substitute item${alternativeCount !== 1 ? 's' : ''}`;

      if (requisitionerId) {
        const { data: existing } = await db
          .from('notifications')
          .select('id')
          .eq('user_id', requisitionerId)
          .eq('document_id', rfq.pr2_id)
          .eq('type', 'action_required')
          .eq('read', false)
          .ilike('title', 'Substitute Item%')
          .limit(1);

        if (!existing?.length) {
          await createNotification({
            user_id:       requisitionerId,
            title:         'Substitute Item Review Required',
            body:          `${supplierName} offered ${altLabel} for ${pr1Label}. Review and decide before procurement can award.`,
            type:          'action_required',
            document_type: 'pr2',
            document_id:   rfq.pr2_id,
            action_url:    `/substitutes/${rfq.pr2_id}`,
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
  // Services Workflow Alignment Phase 5: Goods and Services both reach
  // `pr2_approved` when ready for RFQ now (the old for_canvassing/
  // canvassing_complete statuses are no longer reachable for new services
  // records) — "ready for RFQ" and its priority breakdown are now type-blind,
  // matching the canvassing queue itself.
  const [readyRes, openRfqRes, highRes, mediumRes] = await Promise.all([
    db.from('pr1_requests').select('id', { count: 'exact', head: true }).eq('status', 'pr2_approved').in('request_type', ['goods', 'services']),
    db.from('rfq_batches').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    db.from('pr1_requests').select('id', { count: 'exact', head: true }).eq('status', 'pr2_approved').eq('priority', 'high').in('request_type', ['goods', 'services']),
    db.from('pr1_requests').select('id', { count: 'exact', head: true }).eq('status', 'pr2_approved').eq('priority', 'medium').in('request_type', ['goods', 'services']),
  ]);

  // canvassingComplete: closed RFQs with no PO generated yet. Not currently
  // rendered on any dashboard card (checked components/dashboards/
  // ProcurementDashboard.tsx) — kept correct rather than deleted, in case a
  // card is added later, but computed cheaply since it's presently unused.
  const { data: closedRfqs, error: closedErr } = await db
    .from('rfq_batches')
    .select('pr2_id')
    .eq('status', 'closed')
    .not('pr2_id', 'is', null);
  if (closedErr) throw closedErr;
  const closedPr2Ids = Array.from(new Set((closedRfqs ?? []).map((r: any) => r.pr2_id as string)));
  let canvassingComplete = 0;
  if (closedPr2Ids.length > 0) {
    const { data: posForClosed, error: poErr } = await db
      .from('po_requests')
      .select('pr2_id')
      .in('pr2_id', closedPr2Ids);
    if (poErr) throw poErr;
    const pr2IdsWithPO = new Set((posForClosed ?? []).map((p: any) => p.pr2_id as string));
    canvassingComplete = closedPr2Ids.filter((id) => !pr2IdsWithPO.has(id)).length;
  }

  return {
    forCanvassing:        readyRes.count ?? 0,
    openRfqs:             openRfqRes.count ?? 0,
    canvassingComplete,
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
    .order('created_at', { ascending: false });
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
    .order('created_at', { ascending: false });
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
    .order('created_at', { ascending: false });
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
  pr1ItemId?:      string | null;
  /** Phase 3 (Raw Mats): set instead of pr1ItemId for PR2-native lines. */
  pr2ItemId?:      string | null;
  file:            File;
}): Promise<RfqQuoteAttachment> {
  const { rfqId, rfqSupplierId, rfqItemQuoteId, pr1ItemId, pr2ItemId, file } = params;
  const itemId = pr1ItemId ?? pr2ItemId;

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error(`File type "${file.type}" is not allowed. Use JPEG, PNG, WebP, GIF, or PDF.`);
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File exceeds the 10 MB limit.`);
  }

  const ts = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `rfq/${rfqId}/${rfqSupplierId}/${itemId}/${ts}_${safeName}`;

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
      pr1_item_id:       pr1ItemId ?? null,
      pr2_item_id:       pr2ItemId ?? null,
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
        payload:       { rfq_supplier_id: rfqSupplierId, item_id: itemId, file_name: file.name, file_size: file.size },
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
