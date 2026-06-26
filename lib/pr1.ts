import { supabase } from '@/lib/supabase';
import { requireAuthUserId } from '@/lib/auth-session';
import type { UserProfile } from '@/types/auth';
import type { StatusVariant } from '@/components/shared/StatusChip';
import type {
  PR1Request,
  PR1WithItems,
  PR1Item,
  PR1ItemDraft,
  PR1FormValues,
  PR1Attachment,
  DownstreamStage,
  PR1Status,
  PR1LifecycleSummary,
  PR1WarehouseValidationSummary,
} from '@/types/pr1';
import type { WarehouseItemRoute } from '@/types/warehouse';
import { PR1_STATUS_LABELS } from '@/types/pr1';
import { notifyByRole, notifyApproversForStep } from '@/lib/notifications';

const db = supabase as any;

const PO_ISSUED_STATUSES = new Set(['approved', 'sent']);
const DELIVERY_IN_PROGRESS_STATUSES = new Set(['pending', 'scheduled', 'in_transit', 'delayed']);
const PR2_PHASE2_APPROVED = 'approved';

const PR1_RAW_CHIP: Record<PR1Status, StatusVariant> = {
  draft:                  'draft',
  pending_warehouse:      'pending',
  pending_approval:       'in_review',
  approved_for_warehouse: 'in_review',
  resolved_internal:      'validated',
  revision_requested:     'in_review',
  for_canvassing:         'approved',
  canvassing_complete:    'approved',
  approved:               'approved',
  rejected:               'rejected',
  completed:              'completed',
  cancelled:              'cancelled',
};

/** PR1 row statuses reached after final PR1 approval (procurement path). */
export const POST_PR1_APPROVAL_STATUSES = new Set<PR1Status>([
  'approved',
  'approved_for_warehouse',
  'for_canvassing',
  'canvassing_complete',
]);

/** Lifecycle chips for downstream stages after PR1 approval (PO, delivery, GRN). */
const POST_APPROVAL_LIFECYCLE_CHIPS = new Set<StatusVariant>([
  'approved',
  'sent',
  'received',
  'completed',
]);

/** Whether an employee PR1 has passed final PR1 approval (KPI / summary counts). */
export function isEmployeeApprovedPR1(
  request: Pick<PR1Request, 'status' | 'lifecycle_display_chip'>,
): boolean {
  if (POST_PR1_APPROVAL_STATUSES.has(request.status)) return true;
  const chip = request.lifecycle_display_chip;
  return chip != null && POST_APPROVAL_LIFECYCLE_CHIPS.has(chip);
}

type POSummary = {
  poId: string;
  poStatus: string;
  deliveryStatus: string | null;
  grnStatus: string | null;
};

function pickPreferredDelivery(
  rows: { id: string; po_id: string; status: string }[]
): { id: string; status: string } | null {
  if (rows.length === 0) return null;
  const rank: Record<string, number> = {
    delivered:  5,
    in_transit: 4,
    scheduled:  3,
    delayed:    3,
    pending:    2,
    cancelled:  0,
  };
  return rows.reduce((best, cur) =>
    (rank[cur.status] ?? 1) > (rank[best.status] ?? 1) ? cur : best
  );
}

/**
 * Canonical derived lifecycle labels shown to employees on the PR1 list.
 * Single source of truth so the status filter options can't drift from
 * what deriveEmployeeLifecycleSummary actually returns.
 */
export const PR1_LIFECYCLE_LABELS = {
  COMPLETED_GRN:        'Completed (GRN Closed)',
  PARTIAL_GRN:          'Partial GRN',
  DELIVERED:            'Delivered',
  DELIVERY_IN_PROGRESS: 'Delivery In Progress',
  PO_SENT:              'PO — Sent to Supplier',
  PARTIAL_PO_SENT:      'Partial PO — Sent to Supplier',
  PR2_APPROVED:         'PR2 Approved',
  PR2_PENDING:          'PR2 — Pending Approval',
  CANVASSING_COMPLETE:  'Canvassing Complete',
} as const;

/** Pure employee-facing lifecycle (Option C): does not read or write pr1_requests.workflow fields beyond fallback label. */
export function deriveEmployeeLifecycleSummary(
  rawPr1Status: PR1Status,
  rfqStatus: string | null,
  pr2Statuses: string[],
  poSummaries: POSummary[],
): PR1LifecycleSummary {
  const nPo = poSummaries.length;

  if (nPo > 0) {
    const closedGrn = poSummaries.filter(s => s.grnStatus === 'closed').length;
    if (closedGrn === nPo) {
      return { lifecycle_display_label: PR1_LIFECYCLE_LABELS.COMPLETED_GRN, lifecycle_display_chip: 'completed' };
    }
    if (closedGrn > 0) {
      return { lifecycle_display_label: PR1_LIFECYCLE_LABELS.PARTIAL_GRN, lifecycle_display_chip: 'in_review' };
    }

    const allHaveDelivery = poSummaries.every(s => s.deliveryStatus !== null);
    const allDelivered =
      allHaveDelivery && poSummaries.every(s => s.deliveryStatus === 'delivered');
    if (allDelivered) {
      return { lifecycle_display_label: PR1_LIFECYCLE_LABELS.DELIVERED, lifecycle_display_chip: 'received' };
    }

    const anyDelivery = poSummaries.some(s => s.deliveryStatus !== null);
    const anyInFlight = poSummaries.some(
      s => s.deliveryStatus !== null && DELIVERY_IN_PROGRESS_STATUSES.has(s.deliveryStatus),
    );
    if (anyDelivery && (!allDelivered || anyInFlight)) {
      return { lifecycle_display_label: PR1_LIFECYCLE_LABELS.DELIVERY_IN_PROGRESS, lifecycle_display_chip: 'sent' };
    }

    let nIssued = 0;
    for (const s of poSummaries) {
      if (PO_ISSUED_STATUSES.has(s.poStatus)) nIssued++;
    }
    if (nIssued === nPo) {
      return { lifecycle_display_label: PR1_LIFECYCLE_LABELS.PO_SENT, lifecycle_display_chip: 'sent' };
    }
    if (nIssued > 0) {
      return { lifecycle_display_label: PR1_LIFECYCLE_LABELS.PARTIAL_PO_SENT, lifecycle_display_chip: 'in_review' };
    }
  }

  if (pr2Statuses.length > 0) {
    const allPr2Approved = pr2Statuses.every(s => s === PR2_PHASE2_APPROVED);
    if (allPr2Approved) {
      return { lifecycle_display_label: PR1_LIFECYCLE_LABELS.PR2_APPROVED, lifecycle_display_chip: 'approved' };
    }
    return { lifecycle_display_label: PR1_LIFECYCLE_LABELS.PR2_PENDING, lifecycle_display_chip: 'pending' };
  }

  if (rfqStatus === 'closed' || rawPr1Status === 'canvassing_complete') {
    return { lifecycle_display_label: PR1_LIFECYCLE_LABELS.CANVASSING_COMPLETE, lifecycle_display_chip: 'approved' };
  }

  return {
    lifecycle_display_label: PR1_STATUS_LABELS[rawPr1Status],
    lifecycle_display_chip:  PR1_RAW_CHIP[rawPr1Status],
  };
}

/**
 * Status-filter options for the employee PR1 list, in lifecycle order.
 * Values are the exact `lifecycle_display_label` strings produced above, so
 * filtering matches on the label the user actually sees. Fetched/filtered
 * in-memory in fetchMyPR1s because the lifecycle is derived, not a column.
 */
export const PR1_LIFECYCLE_FILTER_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: PR1_STATUS_LABELS.draft,                  label: PR1_STATUS_LABELS.draft },
  { value: PR1_STATUS_LABELS.pending_warehouse,      label: PR1_STATUS_LABELS.pending_warehouse },
  { value: PR1_STATUS_LABELS.pending_approval,       label: PR1_STATUS_LABELS.pending_approval },
  { value: PR1_STATUS_LABELS.revision_requested,     label: PR1_STATUS_LABELS.revision_requested },
  { value: PR1_STATUS_LABELS.approved_for_warehouse, label: PR1_STATUS_LABELS.approved_for_warehouse },
  { value: PR1_STATUS_LABELS.resolved_internal,      label: PR1_STATUS_LABELS.resolved_internal },
  { value: PR1_STATUS_LABELS.for_canvassing,         label: PR1_STATUS_LABELS.for_canvassing },
  { value: PR1_LIFECYCLE_LABELS.CANVASSING_COMPLETE, label: PR1_LIFECYCLE_LABELS.CANVASSING_COMPLETE },
  { value: PR1_LIFECYCLE_LABELS.PR2_PENDING,         label: PR1_LIFECYCLE_LABELS.PR2_PENDING },
  { value: PR1_LIFECYCLE_LABELS.PR2_APPROVED,        label: PR1_LIFECYCLE_LABELS.PR2_APPROVED },
  { value: PR1_LIFECYCLE_LABELS.PARTIAL_PO_SENT,     label: PR1_LIFECYCLE_LABELS.PARTIAL_PO_SENT },
  { value: PR1_LIFECYCLE_LABELS.PO_SENT,             label: PR1_LIFECYCLE_LABELS.PO_SENT },
  { value: PR1_LIFECYCLE_LABELS.DELIVERY_IN_PROGRESS,label: PR1_LIFECYCLE_LABELS.DELIVERY_IN_PROGRESS },
  { value: PR1_LIFECYCLE_LABELS.DELIVERED,           label: PR1_LIFECYCLE_LABELS.DELIVERED },
  { value: PR1_LIFECYCLE_LABELS.PARTIAL_GRN,         label: PR1_LIFECYCLE_LABELS.PARTIAL_GRN },
  { value: PR1_LIFECYCLE_LABELS.COMPLETED_GRN,       label: PR1_LIFECYCLE_LABELS.COMPLETED_GRN },
  { value: PR1_STATUS_LABELS.rejected,               label: PR1_STATUS_LABELS.rejected },
  { value: PR1_STATUS_LABELS.cancelled,              label: PR1_STATUS_LABELS.cancelled },
];

/**
 * Batched lifecycle labels for employee PR1 list/detail. Uses existing FK graph only (no PR1 row updates).
 */
export async function fetchPR1LifecycleSummaries(
  pr1Rows: Array<{ id: string; status: PR1Status }>,
): Promise<Record<string, PR1LifecycleSummary>> {
  const empty: Record<string, PR1LifecycleSummary> = {};
  if (pr1Rows.length === 0) return empty;

  const pr1Ids = pr1Rows.map(r => r.id);
  const statusByPr1: Record<string, PR1Status> = Object.fromEntries(
    pr1Rows.map(r => [r.id, r.status]),
  );

  const [{ data: pr2Rows }, { data: rfqRows }] = await Promise.all([
    db.from('pr2_requests').select('id, pr1_id, status').in('pr1_id', pr1Ids),
    db.from('rfq_batches').select('pr1_id, status').in('pr1_id', pr1Ids),
  ]);

  const pr2List = (pr2Rows ?? []) as { id: string; pr1_id: string; status: string }[];
  const pr2Ids = pr2List.map(r => r.id);

  const pr1ToPr2s = new Map<string, { id: string; status: string }[]>();
  for (const p of pr2List) {
    const list = pr1ToPr2s.get(p.pr1_id) ?? [];
    list.push({ id: p.id, status: p.status });
    pr1ToPr2s.set(p.pr1_id, list);
  }

  const pr1ToRfqStatus = new Map<string, string>();
  for (const r of (rfqRows ?? []) as { pr1_id: string; status: string }[]) {
    pr1ToRfqStatus.set(r.pr1_id, r.status);
  }

  const pr2ToPos = new Map<string, { id: string; status: string }[]>();
  let allPos: { id: string; pr2_id: string; status: string }[] = [];

  if (pr2Ids.length > 0) {
    const { data: poRows } = await db
      .from('po_requests')
      .select('id, pr2_id, status')
      .in('pr2_id', pr2Ids);
    allPos = (poRows ?? []) as { id: string; pr2_id: string; status: string }[];
    for (const po of allPos) {
      const list = pr2ToPos.get(po.pr2_id) ?? [];
      list.push({ id: po.id, status: po.status });
      pr2ToPos.set(po.pr2_id, list);
    }
  }

  const poIds = allPos.map(p => p.id);
  const deliveriesByPo = new Map<string, { id: string; po_id: string; status: string }[]>();

  if (poIds.length > 0) {
    const { data: delRows } = await db
      .from('deliveries')
      .select('id, po_id, status')
      .in('po_id', poIds);
    for (const d of (delRows ?? []) as { id: string; po_id: string; status: string }[]) {
      const list = deliveriesByPo.get(d.po_id) ?? [];
      list.push(d);
      deliveriesByPo.set(d.po_id, list);
    }
  }

  const preferredDeliveryByPo = new Map<string, { id: string; status: string } | null>();
  for (const poId of poIds) {
    const picked = pickPreferredDelivery(deliveriesByPo.get(poId) ?? []);
    preferredDeliveryByPo.set(poId, picked ? { id: picked.id, status: picked.status } : null);
  }

  const deliveryIds: string[] = [];
  preferredDeliveryByPo.forEach(d => {
    if (d) deliveryIds.push(d.id);
  });

  const grnByDeliveryId = new Map<string, { status: string }>();
  if (deliveryIds.length > 0) {
    const { data: grnRows } = await db
      .from('grn_receipts')
      .select('delivery_id, status')
      .in('delivery_id', deliveryIds);
    for (const g of (grnRows ?? []) as { delivery_id: string; status: string }[]) {
      const prev = grnByDeliveryId.get(g.delivery_id);
      if (!prev || (g.status === 'closed' && prev.status !== 'closed')) {
        grnByDeliveryId.set(g.delivery_id, { status: g.status });
      }
    }
  }

  function buildPoSummariesForPR1(pr1Id: string): POSummary[] {
    const pr2s = pr1ToPr2s.get(pr1Id) ?? [];
    const summaries: POSummary[] = [];
    for (const pr2 of pr2s) {
      const pos = pr2ToPos.get(pr2.id) ?? [];
      for (const po of pos) {
        const del = preferredDeliveryByPo.get(po.id) ?? null;
        const grn = del ? grnByDeliveryId.get(del.id) ?? null : null;
        summaries.push({
          poId: po.id,
          poStatus: po.status,
          deliveryStatus: del?.status ?? null,
          grnStatus: grn?.status ?? null,
        });
      }
    }
    return summaries;
  }

  const out: Record<string, PR1LifecycleSummary> = {};
  for (const pr1Id of pr1Ids) {
    const pr2s = pr1ToPr2s.get(pr1Id) ?? [];
    const pr2Statuses = pr2s.map(p => p.status);
    const poSummaries = buildPoSummariesForPR1(pr1Id);
    const rfqSt = pr1ToRfqStatus.get(pr1Id) ?? null;
    out[pr1Id] = deriveEmployeeLifecycleSummary(statusByPr1[pr1Id], rfqSt, pr2Statuses, poSummaries);
  }

  return out;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function fetchMyPR1s(
  userId: string,
  options: {
    limit?:        number;
    offset?:       number;
    status?:       string;
    search?:       string;
    dateFrom?:     string;
    dateTo?:       string;
    request_type?: string;
  } = {}
): Promise<{ requests: PR1Request[]; total_count: number }> {
  const { limit, offset = 0, status, search, dateFrom, dateTo, request_type } = options;

  // The status filter targets the *derived* lifecycle label (e.g. "Completed
  // (GRN Closed)"), which is computed from downstream PO/GRN/PR2 state — not a
  // column on pr1_requests. So we cannot filter it in SQL. When a lifecycle
  // filter is active we fetch all of the user's matching PR1s (per-user volume
  // is small, and the lifecycle queries are fully batched), enrich, then filter
  // and paginate in memory.
  const isLifecycleFilter = !!status && status !== 'all';

  // Column-level filters that CAN run in SQL (everything except status).
  const applyFilters = (q: any) => {
    q = q.eq('requisitioner_id', userId);

    if (request_type && request_type !== 'all') {
      q = q.eq('request_type', request_type);
    }

    if (search && search.trim()) {
      const t = `%${search.trim()}%`;
      q = q.or(`pr1_number.ilike.${t},purpose.ilike.${t}`);
    }

    if (dateFrom) {
      q = q.gte('created_at', `${dateFrom}T00:00:00.000Z`);
    }
    if (dateTo) {
      q = q.lte('created_at', `${dateTo}T23:59:59.999Z`);
    }

    return q;
  };

  if (isLifecycleFilter) {
    const listRes = await applyFilters(db.from('pr1_requests').select('*')).order(
      'created_at',
      { ascending: false },
    );
    if (listRes.error) throw listRes.error;

    const all = (listRes.data ?? []) as PR1Request[];
    const summaries = await fetchPR1LifecycleSummaries(
      all.map(r => ({ id: r.id, status: r.status })),
    );
    const enrichedAll: PR1Request[] = all.map(r => ({ ...r, ...summaries[r.id] }));
    const filtered = enrichedAll.filter(r => r.lifecycle_display_label === status);

    const page =
      limit != null && limit > 0 ? filtered.slice(offset, offset + limit) : filtered;

    return { requests: page, total_count: filtered.length };
  }

  // No status filter: efficient server-side pagination with an exact count.
  // Single `.select(...)` per query — chaining `.select` again after `select('*')`
  // drops the exact count header and yields count = null / 0.
  let dataQuery = applyFilters(db.from('pr1_requests').select('*')).order(
    'created_at',
    { ascending: false }
  );
  if (limit != null && limit > 0) {
    dataQuery = dataQuery.range(offset, offset + limit - 1);
  }

  const [listRes, countRes] = await Promise.all([
    dataQuery,
    applyFilters(
      db.from('pr1_requests').select('id', { count: 'exact', head: true })
    ),
  ]);

  if (listRes.error) throw listRes.error;
  if (countRes.error) throw countRes.error;

  const requests = (listRes.data ?? []) as PR1Request[];
  const summaries = await fetchPR1LifecycleSummaries(
    requests.map(r => ({ id: r.id, status: r.status })),
  );
  const enriched: PR1Request[] = requests.map(r => ({
    ...r,
    ...summaries[r.id],
  }));

  return {
    requests:    enriched,
    total_count: countRes.count ?? 0,
  };
}

export async function fetchPR1ById(id: string): Promise<PR1WithItems | null> {
  const { data, error } = await db
    .from('pr1_requests')
    .select('*, pr1_items(*)')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as any;
  const items = (row.pr1_items ?? []).sort(
    (a: PR1Item, b: PR1Item) => a.item_order - b.item_order
  );

  // Fetch warehouse validation data if validation exists
  const { data: warehouseValidation, error: wvError } = await db
    .from('warehouse_validations')
    .select(
      'id, decision, validator_name_snapshot, validator_position_snapshot, notes, validated_at'
    )
    .eq('pr1_id', id)
    .maybeSingle();

  if (wvError) throw wvError;

  // If warehouse validation exists, fetch per-item SOH + routing
  let validatedSohMap: Record<
    string,
    {
      validated_soh: number | null;
      warehouse_decision: string;
      warehouse_item_route: WarehouseItemRoute | null;
      warehouse_internal_fulfilled_qty: number;
      warehouse_procurement_qty: number;
    }
  > = {};
  if (warehouseValidation?.id) {
    const { data: validationItems, error: viError } = await db
      .from('warehouse_validation_items')
      .select(
        'pr1_item_id, validated_soh, item_route, internal_fulfilled_qty, procurement_qty'
      )
      .eq('validation_id', warehouseValidation.id);

    if (viError) throw viError;

    (validationItems ?? []).forEach((vi: any) => {
      validatedSohMap[vi.pr1_item_id] = {
        validated_soh:                 vi.validated_soh,
        warehouse_decision:            'validated',
        warehouse_item_route:          (vi.item_route ?? null) as WarehouseItemRoute | null,
        warehouse_internal_fulfilled_qty: Number(vi.internal_fulfilled_qty ?? 0),
        warehouse_procurement_qty:      Number(vi.procurement_qty ?? 0),
      };
    });
  }

  // Fetch all attachments for this PR1 and distribute them per item
  const allAttachments = await fetchPR1Attachments(row.id as string).catch(() => []);
  const attachmentsByItem: Record<string, PR1Attachment[]> = {};
  for (const att of allAttachments) {
    if (!attachmentsByItem[att.pr1_item_id]) attachmentsByItem[att.pr1_item_id] = [];
    attachmentsByItem[att.pr1_item_id].push(att);
  }

  // Merge warehouse validation fields AND attachments into items
  const itemsWithValidation = items.map((item: PR1Item) => ({
    ...item,
    validated_soh:                    validatedSohMap[item.id]?.validated_soh ?? null,
    warehouse_decision:               validatedSohMap[item.id]?.warehouse_decision ?? null,
    warehouse_item_route:             validatedSohMap[item.id]?.warehouse_item_route ?? null,
    warehouse_internal_fulfilled_qty:
      validatedSohMap[item.id]?.warehouse_internal_fulfilled_qty ?? null,
    warehouse_procurement_qty:
      validatedSohMap[item.id]?.warehouse_procurement_qty ?? null,
    attachments: attachmentsByItem[item.id] ?? [],
  }));

  const wvRow = warehouseValidation as {
    id?: string;
    decision?: 'sufficient' | 'insufficient' | null;
    validator_name_snapshot?: string | null;
    validator_position_snapshot?: string | null;
    notes?: string | null;
    validated_at?: string | null;
  } | null;

  const warehouse_validation: PR1WarehouseValidationSummary | null = wvRow?.id
    ? {
        decision: wvRow.decision ?? null,
        validator_name_snapshot: wvRow.validator_name_snapshot ?? null,
        validator_position_snapshot: wvRow.validator_position_snapshot ?? null,
        notes: wvRow.notes?.trim() || null,
        validated_at: wvRow.validated_at ?? null,
      }
    : null;

  return {
    ...row,
    items: itemsWithValidation,
    warehouse_validation,
    attachments: allAttachments,
  };
}


export const PR1_NUMBER_DUPLICATE_ERROR =
  'This PR1 number is already in use. Please choose a different number.';

export async function checkPR1NumberExists(
  pr1Number: string,
  excludeId?: string
): Promise<boolean> {
  let query = db
    .from('pr1_requests')
    .select('id')
    .eq('pr1_number', pr1Number.trim());

  if (excludeId) {
    query = query.neq('id', excludeId);
  }

  const { data } = await query;
  return (data?.length ?? 0) > 0;
}

/** Next 4-digit suffix for PR1-{year}-#### (e.g. 0001). Guide only — not reserved. */
export async function fetchSuggestedPR1Sequence(year?: number): Promise<string> {
  const y = year ?? new Date().getFullYear();
  const prefix = `PR1-${y}-`;

  const { data, error } = await db
    .from('pr1_requests')
    .select('pr1_number')
    .ilike('pr1_number', `${prefix}%`);

  if (error) throw error;

  let max = 0;
  const re = new RegExp(`^PR1-${y}-(\\d+)`, 'i');
  for (const row of data ?? []) {
    const num = String((row as { pr1_number?: string }).pr1_number ?? '');
    const match = num.match(re);
    if (!match) continue;
    const parsed = parseInt(match[1], 10);
    if (!Number.isNaN(parsed) && parsed > max) max = parsed;
  }

  return String(max + 1).padStart(4, '0');
}

export async function fetchDownstreamStage(pr1Id: string): Promise<DownstreamStage> {
  try {
    // Step 1: Check if PR2 exists
    const { data: pr2 } = await db
      .from('pr2_requests')
      .select('id, rfq_id')
      .eq('pr1_id', pr1Id)
      .maybeSingle();

    if (!pr2) return 'PR1 Approval';

    // Step 2: Check if PO exists (required for delivery lookup)
    const { data: po } = await db
      .from('po_requests')
      .select('id')
      .eq('pr2_id', pr2.id)
      .maybeSingle();

    if (!po) {
      // No PO yet, check if RFQ exists
      if (pr2.rfq_id) {
        return 'Canvassing';
      }
      return 'Processing (PR2)';
    }

    // Step 3: Check if delivery exists (correct table and FK)
    const { data: delivery } = await db
      .from('deliveries')
      .select('id')
      .eq('po_id', po.id)
      .maybeSingle();

    if (!delivery) return 'PO Issued';

    // Step 4: Check if GRN exists
    const { data: grn } = await db
      .from('grn_receipts')
      .select('id')
      .eq('delivery_id', delivery.id)
      .maybeSingle();

    if (grn) return 'Completed';

    // Step 5: Delivery exists but no GRN
    return 'For Delivery';
  } catch (err) {
    return 'PR1 Approval';
  }
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function saveDraftPR1(
  values: PR1FormValues,
  profile: UserProfile,
  existingId?: string
): Promise<{ id: string; items: Array<{ id: string; item_order: number }> }> {
  const authUserId = await requireAuthUserId();
  const now = new Date().toISOString();
  const headerFields = {
    pr1_number:                  values.pr1_number.trim(),
    requisitioner_id:            authUserId,
    requisitioner_name_snapshot: profile.full_name,
    department_id:               profile.department_id,
    department_name_snapshot:    profile.department,
    purpose:                     values.purpose.trim(),
    date_required:               values.date_required,
    request_type:                values.request_type ?? 'goods',
    updated_at:                  now,
  };

  let pr1Id: string;

  if (existingId) {
    await clearWarehouseValidationBeforeItemSync(existingId);
    const { error } = await db
      .from('pr1_requests')
      .update(headerFields)
      .eq('id', existingId)
      .in('status', ['draft', 'revision_requested']);
    if (error) throw error;
    pr1Id = existingId;
  } else {
    const { data, error } = await db
      .from('pr1_requests')
      .insert({ ...headerFields, status: 'draft' as const })
      .select('id')
      .single();
    if (error) throw error;
    pr1Id = data.id;
  }

  const syncedItems = await syncItems(pr1Id, values.items);

  try {
    await db.from('audit_logs').insert({
      actor_id:      profile.id,
      action:        existingId ? 'PR1_DRAFT_UPDATED' : 'PR1_DRAFT_CREATED',
      document_type: 'PR1',
      document_id:   pr1Id,
      payload: {
        pr1_number: values.pr1_number.trim(),
        purpose:    values.purpose.trim(),
        item_count: values.items.length,
      },
    });
  } catch {}

  return { id: pr1Id, items: syncedItems };
}

// submitPR1 accepts an optional existingId.
// If no existingId, it creates the PR1 header first, then syncs items, then transitions status.
// This avoids the double-syncItems race that happens when saveDraftPR1 + submitPR1 are chained.
export async function submitPR1(
  pr1Id: string,
  profile: UserProfile
): Promise<void> {
  const now = new Date().toISOString();
  const authUserId = await requireAuthUserId();

  const { data: currentRow, error: statusErr } = await db
    .from('pr1_requests')
    .select('status, pr1_number')
    .eq('id', pr1Id)
    .maybeSingle();

  if (statusErr) throw statusErr;
  const currentStatus = currentRow?.status as PR1Status | undefined;
  if (!currentStatus || !['draft', 'revision_requested'].includes(currentStatus)) {
    throw new Error('PR1 could not be submitted. It may have already been submitted or does not exist.');
  }

  // Transition header to submitted state
  const { data: updatedRows, error: headerErr } = await db
    .from('pr1_requests')
    .update({
      status:                       'pending_approval',
      submitted_at:                 now,
      prepared_by_id:               authUserId,
      prepared_by_name_snapshot:    profile.full_name,
      prepared_by_position_snapshot: profile.position,
      prepared_at:                  now,
      updated_at:                   now,
    })
    .eq('id', pr1Id)
    .eq('status', currentStatus)
    .select('id');

  if (headerErr) throw headerErr;
  if (!updatedRows || updatedRows.length === 0) {
    throw new Error('PR1 could not be submitted. It may have already been submitted or does not exist.');
  }

  // Audit log (best-effort, don't fail submit on log error)
  await db.from('audit_logs').insert({
    actor_id:      profile.id,
    action:        'PR1_SUBMITTED',
    document_type: 'PR1',
    document_id:   pr1Id,
    payload: {
      pr1_number:  currentRow.pr1_number,
      prepared_by: profile.full_name,
      position:    profile.position,
    },
  });

  const { data: wf, error: wfErr } = await db
    .from('approval_workflows')
    .select('id')
    .eq('code', 'PR1_APPROVAL')
    .eq('active', true)
    .maybeSingle();
  if (wfErr) throw wfErr;
  if (!wf) throw new Error('PR1_APPROVAL workflow not configured.');

  const { data: newInst, error: instErr } = await db
    .from('approval_instances')
    .insert({
      workflow_id:   wf.id,
      document_type: 'PR1',
      document_id:   pr1Id,
      current_step:  1,
      status:        'active',
      started_by:    authUserId,
      started_at:    now,
    })
    .select('id')
    .single();
  if (instErr) throw instErr;

  try {
    if (newInst?.id) {
      await notifyApproversForStep({
        workflowId:     wf.id,
        stepOrder:      1,
        documentId:     pr1Id,
        documentNumber: currentRow.pr1_number,
        instanceId:     newInst.id,
      });
    }
  } catch {
    // Notifications are best-effort; do not fail submit
  }
}

// canUpdatePR1Priority checks if a user is authorized to update PR1 priority.
// Only procurement and approver roles are allowed.
export function canUpdatePR1Priority(profile: UserProfile): boolean {
  return profile.role === 'procurement' || profile.role === 'approver';
}

// updatePR1Priority updates the priority of a PR1 request.
// Authorized users (procurement or approver) can set priority to normal, medium, or high.
// The update includes audit logging (best-effort; audit failures do not fail the update).
export async function updatePR1Priority(
  pr1Id: string,
  priority: 'normal' | 'medium' | 'high',
  profile: UserProfile
): Promise<void> {
  // 1. Authorization check
  if (!canUpdatePR1Priority(profile)) {
    throw new Error(`User role '${profile.role}' is not authorized to update PR1 priority.`);
  }

  // 2. Validate priority value
  const validPriorities = ['normal', 'medium', 'high'];
  if (!validPriorities.includes(priority)) {
    throw new Error(`Invalid priority value: '${priority}'. Must be one of: ${validPriorities.join(', ')}`);
  }

  // 3. Fetch current PR1 to verify it exists and get old priority
  const { data: pr1, error: fetchErr } = await db
    .from('pr1_requests')
    .select('id, pr1_number, priority')
    .eq('id', pr1Id)
    .maybeSingle();

  if (fetchErr) throw fetchErr;
  if (!pr1) throw new Error(`PR1 not found (id: ${pr1Id}).`);

  const oldPriority = pr1.priority;

  // 4. Update priority and updated_at
  const now = new Date().toISOString();
  const { error: updateErr } = await db
    .from('pr1_requests')
    .update({ priority, updated_at: now })
    .eq('id', pr1Id);

  if (updateErr) throw updateErr;

  // 5. Audit log (best-effort; do not fail the update if logging fails)
  try {
    const { error: auditError } = await db
      .from('audit_logs')
      .insert({
        actor_id:      profile.id,
        action:        'PR1_PRIORITY_UPDATED',
        document_type: 'PR1',
        document_id:   pr1Id,
        payload: {
          pr1_number:   pr1.pr1_number,
          old_priority: oldPriority,
          new_priority: priority,
          updated_by:   profile.full_name,
          role:         profile.role,
          position:     profile.position,
        },
      });
    if (auditError) {
      console.warn('Failed to write priority audit log:', auditError);
    }
  } catch (auditError) {
    console.warn('Failed to write priority audit log:', auditError);
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

export async function deleteDraftPR1(pr1Id: string, profile: UserProfile): Promise<void> {
  // 1. Fetch current PR1 to verify it exists, belongs to user, and is a draft
  const { data: pr1, error: fetchErr } = await db
    .from('pr1_requests')
    .select('id, requisitioner_id, status')
    .eq('id', pr1Id)
    .maybeSingle();

  if (fetchErr) throw fetchErr;
  if (!pr1) throw new Error(`PR1 not found (id: ${pr1Id}).`);

  if (pr1.requisitioner_id !== profile.id && profile.role !== 'admin') {
    throw new Error('Not authorized to delete this PR1.');
  }

  if (pr1.status !== 'draft') {
    throw new Error('Only draft requests can be deleted.');
  }

  try {
    await db.from('audit_logs').insert({
      actor_id:      profile.id,
      action:        'PR1_DRAFT_DELETED',
      document_type: 'PR1',
      document_id:   pr1Id,
      payload:       { deleted_by: profile.full_name },
    });
  } catch {}

  // 2. Delete PR1 items first (unless cascade is set, but this is safer)
  const { error: itemsErr } = await db
    .from('pr1_items')
    .delete()
    .eq('pr1_id', pr1Id);
    
  if (itemsErr) throw itemsErr;

  // 3. Delete PR1 header
  const { error: delErr } = await db
    .from('pr1_requests')
    .delete()
    .eq('id', pr1Id);

  if (delErr) throw delErr;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Remove warehouse validation rows before pr1_items are deleted (resubmit/edit). */
async function clearWarehouseValidationBeforeItemSync(pr1Id: string): Promise<void> {
  const { data: row, error } = await db
    .from('pr1_requests')
    .select('status')
    .eq('id', pr1Id)
    .maybeSingle();

  if (error) throw error;
  if (!row?.status || !['draft', 'revision_requested'].includes(row.status)) return;

  const { data: validations, error: vErr } = await db
    .from('warehouse_validations')
    .select('id')
    .eq('pr1_id', pr1Id)
    .limit(1);

  if (vErr) throw vErr;
  if (!validations?.length) return;

  const { error: resetErr } = await db.rpc('reset_warehouse_validation_on_pr1_resubmit', {
    p_pr1_id: pr1Id,
  });
  if (resetErr) throw resetErr;
}

async function syncItems(pr1Id: string, items: PR1ItemDraft[]): Promise<Array<{ id: string; item_order: number }>> {
  // 1. Get existing items from the DB to see what is currently saved
  const { data: existingDbItems, error: fetchErr } = await db
    .from('pr1_items')
    .select('id, item_order')
    .eq('pr1_id', pr1Id);
  if (fetchErr) throw fetchErr;

  const dbItems = existingDbItems ?? [];
  const dbItemIds: string[] = dbItems.map((i: any) => i.id as string);

  // Filter out empty rows
  const validIncomingItems = items.filter(i => i.description.trim() !== '');

  // 2. Identify items to delete: database items whose IDs are not in incoming items
  const incomingIds = new Set(validIncomingItems.map(i => i.id).filter(Boolean));
  const idsToDelete = dbItemIds.filter((id: string) => !incomingIds.has(id));

  if (idsToDelete.length > 0) {
    const { error: delErr } = await db
      .from('pr1_items')
      .delete()
      .in('id', idsToDelete);
    if (delErr) throw delErr;
  }

  // 2.5. Temporarily shift the item_order of remaining database items to a high offset (+10000)
  // to avoid unique constraint (pr1_id, item_order) violations when we perform the final upsert.
  const remainingDbItems = dbItems.filter((item: any) => !idsToDelete.includes(item.id));
  let shifted = false;
  if (remainingDbItems.length > 0) {
    const shiftRows = remainingDbItems.map((item: any) => ({
      id: item.id,
      pr1_id: pr1Id,
      item_order: (Number(item.item_order) || 0) + 10000,
    }));

    const { error: shiftUpsertErr } = await db
      .from('pr1_items')
      .upsert(shiftRows);
    if (shiftUpsertErr) throw shiftUpsertErr;
    shifted = true;
  }

  try {
    // 3. Prepare rows for upsert
    const rowsToUpsert = validIncomingItems.map((item, idx) => {
      const row: any = {
        pr1_id:             pr1Id,
        item_order:         idx + 1,
        item_code:          item.item_code.trim(),
        description:        item.description.trim(),
        unit_of_measure:    item.unit_of_measure.trim(),
        stock_on_hand:      Number(item.stock_on_hand) || 0,
        quantity_requested: Number(item.quantity_requested) || 1,
        is_raw_material:    item.is_raw_material === true,
      };
      if (item.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id)) {
        row.id = item.id;
      }
      return row;
    });

    if (rowsToUpsert.length === 0) return [];

    // 4. Perform upsert (inserts new, updates existing)
    const { data: upsertedData, error: upsertErr } = await db
      .from('pr1_items')
      .upsert(rowsToUpsert)
      .select('id, item_order');
    if (upsertErr) throw upsertErr;

    return (upsertedData ?? []) as Array<{ id: string; item_order: number }>;
  } catch (error) {
    // Rollback shifted orders if the upsert fails
    if (shifted && remainingDbItems.length > 0) {
      const rollbackRows = remainingDbItems.map((item: any) => ({
        id: item.id,
        pr1_id: pr1Id,
        item_order: Number(item.item_order) || 0,
      }));
      try { await db.from('pr1_items').upsert(rollbackRows); } catch {}
    }
    throw error;
  }
}

// ─── Attachment helpers ────────────────────────────────────────────────────

const ATTACHMENT_SIGNED_URL_TTL = 3600; // 1 hour

/**
 * Upload a file to the pr1-attachments bucket and record it in pr1_attachments.
 * Caller must ensure the PR1 is in draft/revision_requested state.
 */
export async function uploadPR1Attachment(
  pr1Id: string,
  pr1ItemId: string,
  file: File,
): Promise<PR1Attachment> {
  const authUserId = await requireAuthUserId();
  const ts = Date.now();
  const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `pr1/${pr1Id}/${pr1ItemId}/${ts}_${safeFilename}`;

  const { error: uploadErr } = await supabase.storage
    .from('pr1-attachments')
    .upload(storagePath, file, { upsert: false });

  if (uploadErr) throw uploadErr;

  const { data, error: insertErr } = await db
    .from('pr1_attachments')
    .insert({
      pr1_id:       pr1Id,
      pr1_item_id:  pr1ItemId,
      uploaded_by:  authUserId,
      storage_path: storagePath,
      file_name:    file.name,
      file_size:    file.size,
      mime_type:    file.type || null,
    })
    .select('*')
    .single();

  if (insertErr) {
    await supabase.storage.from('pr1-attachments').remove([storagePath]);
    throw insertErr;
  }

  try {
    await db.from('audit_logs').insert({
      actor_id:      authUserId,
      action:        'PR1_ATTACHMENT_UPLOADED',
      document_type: 'PR1',
      document_id:   pr1Id,
      payload:       { file_name: file.name, file_size: file.size, pr1_item_id: pr1ItemId },
    });
  } catch {}

  return data as PR1Attachment;
}

/**
 * Delete an attachment record and its storage object.
 */
export async function deletePR1Attachment(attachment: PR1Attachment, actorId?: string): Promise<void> {
  const { error: dbErr } = await db
    .from('pr1_attachments')
    .delete()
    .eq('id', attachment.id);

  if (dbErr) throw dbErr;

  // Best-effort storage removal (don't fail if already gone)
  await supabase.storage.from('pr1-attachments').remove([attachment.storage_path]);

  if (actorId) {
    try {
      await db.from('audit_logs').insert({
        actor_id:      actorId,
        action:        'PR1_ATTACHMENT_DELETED',
        document_type: 'PR1',
        document_id:   attachment.pr1_id,
        payload:       { file_name: attachment.file_name, pr1_item_id: attachment.pr1_item_id },
      });
    } catch {}
  }
}

/**
 * Fetch attachments for a PR1 and resolve signed URLs for display.
 */
export async function fetchPR1Attachments(pr1Id: string): Promise<PR1Attachment[]> {
  const { data, error } = await db
    .from('pr1_attachments')
    .select('*')
    .eq('pr1_id', pr1Id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  const rows = (data ?? []) as PR1Attachment[];

  if (rows.length === 0) return [];

  // Resolve signed URLs in parallel (best-effort; skip on error)
  const withUrls = await Promise.all(
    rows.map(async (row) => {
      try {
        const { data: urlData } = await supabase.storage
          .from('pr1-attachments')
          .createSignedUrl(row.storage_path, ATTACHMENT_SIGNED_URL_TTL);
        return { ...row, signed_url: urlData?.signedUrl ?? undefined };
      } catch {
        return row;
      }
    }),
  );

  return withUrls;
}

