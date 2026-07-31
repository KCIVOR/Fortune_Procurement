import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/auth';
import type {
  Delivery,
  DeliveryHistoryEntry,
  DeliveryWithHistory,
  DeliveryStatus,
  DeliverySupplierUpdateValues,
  DeliveryFollowUpValues,
} from '@/types/delivery';
import { createNotification, notifyByRole } from '@/lib/notifications';

const db = supabase as any;

// ─── Normalizers ──────────────────────────────────────────────────────────────

function normalizeDelivery(row: any, hasGrn?: boolean): Delivery {
  return {
    id:                           row.id,
    po_id:                        row.po_id,
    po_number_snapshot:           row.po_number_snapshot,
    pr2_number_snapshot:          row.pr2_number_snapshot,
    pr1_number_snapshot:          row.pr1_number_snapshot,
    rfq_number_snapshot:          row.rfq_number_snapshot,
    supplier_id:                  row.supplier_id ?? null,
    supplier_name_snapshot:       row.supplier_name_snapshot,
    requisitioner_id:             row.requisitioner_id ?? null,
    requisitioner_name_snapshot:  row.requisitioner_name_snapshot,
    department_name_snapshot:     row.department_name_snapshot,
    purpose:                      row.purpose,
    status:                       row.status as DeliveryStatus,
    commitment_date:              row.commitment_date ?? null,
    scheduled_date:               row.scheduled_date ?? null,
    actual_delivery_date:         row.actual_delivery_date ?? null,
    delivery_address:             row.delivery_address,
    warehouse:                    row.warehouse,
    grand_total:                  Number(row.grand_total),
    dr_document_path:             row.dr_document_path ?? null,
    dr_document_filename:         row.dr_document_filename ?? null,
    dr_document_uploaded_at:      row.dr_document_uploaded_at ?? null,
    request_type:                 (row.request_type ?? 'goods') as 'goods' | 'services',
    has_grn:                      hasGrn ?? (
      Array.isArray(row.grn_receipts)
        ? row.grn_receipts.length > 0
        : !!row.grn_receipts
    ),
    forwarded_to_procurement:     Boolean(row.forwarded_to_procurement),
    forwarded_at:                 row.forwarded_at ?? null,
    created_at:                   row.created_at,
    updated_at:                   row.updated_at,
  };
}

async function attachHasGrnFlags(rows: Delivery[]): Promise<void> {
  const deliveryIds = Array.from(new Set(rows.map(r => r.id).filter(Boolean)));
  if (deliveryIds.length === 0) return;

  const { data, error } = await db
    .from('grn_receipts')
    .select('delivery_id')
    .in('delivery_id', deliveryIds);
  if (error) throw error;

  const withGrn = new Set(((data ?? []) as { delivery_id: string }[]).map(r => r.delivery_id));
  for (const row of rows) {
    row.has_grn = withGrn.has(row.id);
  }
}

function normalizeHistoryEntry(row: any): DeliveryHistoryEntry {
  return {
    id:             row.id,
    delivery_id:    row.delivery_id,
    actor_id:       row.actor_id,
    actor_name:     row.actor_name,
    actor_role:     row.actor_role,
    status_from:    row.status_from ?? null,
    status_to:      row.status_to ?? null,
    note:           row.note ?? null,
    scheduled_date: row.scheduled_date ?? null,
    created_at:     row.created_at,
  };
}

// ─── Queue: all active deliveries (procurement / warehouse) ──────────────────

export type DeliveryListTab =
  | 'all'
  | 'pending'
  | 'scheduled'
  | 'in_transit'
  | 'delayed'
  | 'delivered';

export async function fetchDeliveryQueue(): Promise<Delivery[]> {
  const { data, error } = await db
    .from('deliveries')
    .select('*')
    .not('status', 'eq', 'cancelled')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalizeDelivery);
}

/** Paged list for /delivery; preserves procurement vs employee scope and per-tab status. */
export async function fetchDeliveryQueuePaged(params: {
  mode: 'procurement' | 'employee';
  requisitionerId?: string;
  requisitionerName?: string;
  statusTab: DeliveryListTab;
  limit: number;
  offset: number;
  search?: string;
  /** Rev #9: priority lives on pr1_requests only — resolved/filtered via ID-based join chain. */
  priority?: string;
}): Promise<{ deliveries: Delivery[]; total_count: number }> {
  const { mode, requisitionerId, requisitionerName, statusTab, limit, offset, search, priority } = params;

  // Priority pre-filter: pr1 -> pr2 -> po -> deliveries, ID-based.
  let priorityPoIds: string[] | null = null;
  if (priority && priority !== 'all') {
    const { data: pr1Hits } = await db.from('pr1_requests').select('id').eq('priority', priority);
    const pr1Ids = ((pr1Hits ?? []) as any[]).map(r => r.id);
    let pr2Ids: string[] = [];
    if (pr1Ids.length > 0) {
      const { data: pr2Hits } = await db.from('pr2_requests').select('id').in('pr1_id', pr1Ids);
      pr2Ids = ((pr2Hits ?? []) as any[]).map(r => r.id);
    }
    let poIds: string[] = [];
    if (pr2Ids.length > 0) {
      const { data: poHits } = await db.from('po_requests').select('id').in('pr2_id', pr2Ids);
      poIds = ((poHits ?? []) as any[]).map(r => r.id);
    }
    priorityPoIds = poIds;
  }

  let q = db.from('deliveries').select('*', { count: 'exact' });

  if (priorityPoIds !== null) {
    if (priorityPoIds.length === 0) {
      q = q.eq('id', '00000000-0000-0000-0000-000000000000');
    } else {
      q = q.in('po_id', priorityPoIds);
    }
  }

  if (mode === 'employee') {
    // Some deliveries are created under supplier context with requisitioner_id unavailable,
    // but still include requisitioner_name_snapshot. Employee view should match both.
    if (!requisitionerId && !requisitionerName) {
      throw new Error('requisitionerId or requisitionerName required for employee mode');
    }
    const orParts: string[] = [];
    if (requisitionerId) orParts.push(`requisitioner_id.eq.${requisitionerId}`);
    if (requisitionerName) orParts.push(`requisitioner_name_snapshot.eq.${JSON.stringify(requisitionerName)}`);
    q = q.or(orParts.join(','));
  } else {
    q = q.not('status', 'eq', 'cancelled');
  }

  if (statusTab !== 'all') {
    q = q.eq('status', statusTab);
  }

  const term = search?.trim();
  if (term) {
    const p = `%${term}%`;
    q = q.or(
      `po_number_snapshot.ilike.${p},purpose.ilike.${p},supplier_name_snapshot.ilike.${p},warehouse.ilike.${p}`
    );
  }

  const { data, error, count } = await q
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  const rows = (data ?? []).map((row: any) => normalizeDelivery(row, false));
  await attachHasGrnFlags(rows);
  // Resolve request_type via the unambiguous FK chain (po_requests -> pr2_requests ->
  // pr1_requests), not by matching pr1_number_snapshot text — PR1 numbers are not
  // guaranteed unique, and a text match can silently resolve to the wrong row.
  const poIds = Array.from(new Set(rows.map((d: Delivery) => d.po_id).filter(Boolean)));
  if (poIds.length > 0) {
    const { data: poData } = await db
      .from('po_requests')
      .select('id, pr2_id')
      .in('id', poIds);
    const pr2Ids = Array.from(new Set((poData ?? []).map((p: any) => p.pr2_id).filter(Boolean)));

    const { data: pr2Data } = pr2Ids.length > 0
      ? await db.from('pr2_requests').select('id, pr1_id, request_type').in('id', pr2Ids)
      : { data: [] as any[] };
    const pr1Ids = Array.from(new Set((pr2Data ?? []).map((p: any) => p.pr1_id).filter(Boolean)));

    const { data: pr1Data } = pr1Ids.length > 0
      ? await db.from('pr1_requests').select('id, priority').in('id', pr1Ids)
      : { data: [] as any[] };

    const pr1PriorityById: Record<string, string> = Object.fromEntries(
      ((pr1Data ?? []) as any[]).map(p => [p.id, p.priority ?? 'normal'])
    );
    const pr2ById: Record<string, any> = Object.fromEntries(
      ((pr2Data ?? []) as any[]).map(p => [p.id, p])
    );
    const pr2IdByPoId: Record<string, string> = Object.fromEntries(
      ((poData ?? []) as any[]).map(p => [p.id, p.pr2_id])
    );

    for (const d of rows) {
      const pr2Id = pr2IdByPoId[d.po_id];
      const pr2 = pr2Id ? pr2ById[pr2Id] : undefined;
      // request_type reads pr2.request_type directly — priority stays PR1-only.
      const resolvedType = pr2?.request_type;
      if (resolvedType) d.request_type = resolvedType;
      (d as any).priority = pr2?.pr1_id ? (pr1PriorityById[pr2.pr1_id] ?? 'normal') : 'normal';
    }
  }

  return {
    deliveries: rows,
    total_count: count ?? 0,
  };
}

/** Tab badge counts (DB exact counts, same scoping rules as the paged list). */
/**
 * Count of service deliveries Warehouse has forwarded to Procurement that
 * don't have a GRN opened yet — Procurement's actual outstanding work from
 * that handoff, since neither the GRN queue (no GRN exists yet) nor the
 * delivery list's generic "Awaiting GRN" badge distinguish this from a
 * services delivery still waiting on Warehouse to forward it.
 */
export async function fetchServicesAwaitingGRNCount(): Promise<number> {
  // forwarded_to_procurement is only ever set true from forwardServiceDeliveryToProcurement,
  // which is exclusively gated to services deliveries — no need to also filter by
  // request_type (which isn't even a raw column on `deliveries`; it's resolved per-row
  // via an RPC elsewhere, not something you can .eq() against here).
  const { data: forwarded, error } = await db
    .from('deliveries')
    .select('id')
    .eq('forwarded_to_procurement', true);
  if (error) throw error;

  const ids = ((forwarded ?? []) as { id: string }[]).map(r => r.id);
  if (ids.length === 0) return 0;

  const { data: withGrn, error: grnErr } = await db
    .from('grn_receipts')
    .select('delivery_id')
    .in('delivery_id', ids);
  if (grnErr) throw grnErr;

  const grnDeliveryIds = new Set(((withGrn ?? []) as { delivery_id: string }[]).map(r => r.delivery_id));
  return ids.filter(id => !grnDeliveryIds.has(id)).length;
}

export async function fetchDeliveryTabCounts(params: {
  mode: 'procurement' | 'employee';
  requisitionerId?: string;
  requisitionerName?: string;
}): Promise<Record<DeliveryListTab, number>> {
  const tabs: DeliveryListTab[] = [
    'all',
    'pending',
    'scheduled',
    'in_transit',
    'delayed',
    'delivered',
  ];

  const counts: Record<DeliveryListTab, number> = {
    all: 0,
    pending: 0,
    scheduled: 0,
    in_transit: 0,
    delayed: 0,
    delivered: 0,
  };

  for (const tab of tabs) {
    let q = db.from('deliveries').select('id', { count: 'exact', head: true });
    if (params.mode === 'employee') {
      if (!params.requisitionerId && !params.requisitionerName) {
        throw new Error('requisitionerId or requisitionerName required for employee mode');
      }
      const orParts: string[] = [];
      if (params.requisitionerId) orParts.push(`requisitioner_id.eq.${params.requisitionerId}`);
      if (params.requisitionerName) orParts.push(`requisitioner_name_snapshot.eq.${JSON.stringify(params.requisitionerName)}`);
      q = q.or(orParts.join(','));
    } else {
      q = q.not('status', 'eq', 'cancelled');
    }
    if (tab !== 'all') {
      q = q.eq('status', tab);
    }
    const { count, error } = await q;
    if (error) throw error;
    counts[tab] = count ?? 0;
  }

  return counts;
}

// ─── Queue: supplier's own deliveries ────────────────────────────────────────

export async function fetchSupplierDeliveries(supplierId: string): Promise<Delivery[]> {
  const { data, error } = await db
    .from('deliveries')
    .select('*')
    .eq('supplier_id', supplierId)
    .not('status', 'eq', 'cancelled')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalizeDelivery);
}

// ─── Queue: supplier's deliveries (paginated) ────────────────────────────────

export async function fetchSupplierDeliveriesPaged(
  supplierId: string,
  options: { limit: number; offset: number; search?: string; status?: string }
): Promise<{ deliveries: Delivery[]; total_count: number }> {
  const { limit, offset, search, status } = options;

  const applyFilters = (q: any) => {
    q = q.eq('supplier_id', supplierId).not('status', 'eq', 'cancelled');
    if (status && status !== 'all') {
      q = q.eq('status', status);
    }
    const term = search?.trim();
    if (term) {
      const pattern = `%${term}%`;
      q = q.or(`po_number_snapshot.ilike.${pattern},purpose.ilike.${pattern}`);
    }
    return q;
  };

  const [dataRes, countRes] = await Promise.all([
    applyFilters(db.from('deliveries').select('*'))
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1),
    applyFilters(db.from('deliveries').select('id', { count: 'exact', head: true })),
  ]);

  if (dataRes.error) throw dataRes.error;
  if (countRes.error) throw countRes.error;

  return {
    deliveries: (dataRes.data ?? []).map(normalizeDelivery),
    total_count: countRes.count ?? 0,
  };
}

// ─── Supplier delivery global stat counts (unfiltered by search/status) ──────

export async function fetchSupplierDeliveryStatCounts(
  supplierId: string
): Promise<{ active: number; completed: number; total: number }> {
  const applyBase = (q: any) =>
    q.eq('supplier_id', supplierId).not('status', 'eq', 'cancelled');

  const [activeRes, completedRes, totalRes] = await Promise.all([
    applyBase(db.from('deliveries').select('id', { count: 'exact', head: true })).not('status', 'eq', 'delivered'),
    applyBase(db.from('deliveries').select('id', { count: 'exact', head: true })).eq('status', 'delivered'),
    applyBase(db.from('deliveries').select('id', { count: 'exact', head: true })),
  ]);

  return {
    active:    activeRes.count    ?? 0,
    completed: completedRes.count ?? 0,
    total:     totalRes.count     ?? 0,
  };
}

// ─── Queue: employee's own requisition deliveries ────────────────────────────

export async function fetchMyDeliveries(requisitionerId: string): Promise<Delivery[]> {
  const { data, error } = await db
    .from('deliveries')
    .select('*')
    .eq('requisitioner_id', requisitionerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalizeDelivery);
}

// ─── Detail: fetch delivery with full history ─────────────────────────────────

export async function fetchDeliveryById(id: string): Promise<DeliveryWithHistory | null> {
  const [deliveryRes, historyRes] = await Promise.all([
    db.from('deliveries').select('*').eq('id', id).maybeSingle(),
    db.from('delivery_status_history')
      .select('*')
      .eq('delivery_id', id)
      .order('created_at', { ascending: true }),
  ]);
  if (deliveryRes.error) throw deliveryRes.error;
  if (!deliveryRes.data) return null;

  const delivery = normalizeDelivery(deliveryRes.data, false);
  await attachHasGrnFlags([delivery]);
  // Resolve request_type via the unambiguous FK chain (deliveries -> po_requests ->
  // pr2_requests -> pr1_requests), not by matching pr1_number_snapshot text — PR1
  // numbers are not guaranteed unique, and a text match can silently return the
  // wrong row (or fail ambiguously) if a duplicate exists.
  const { data: resolvedType } = await db.rpc('request_type_for_delivery_display', { p_delivery_id: id });

  // Line items for the delivery's PO — deliberately excludes unit_price/total_price;
  // pricing is not shown on delivery tracking pages for any role.
  const { data: itemRows, error: itemsErr } = await db
    .from('po_items')
    .select('id, item_order, item_code, description, unit_of_measure, quantity_to_purchase')
    .eq('po_id', delivery.po_id)
    .order('item_order', { ascending: true });
  if (itemsErr) throw itemsErr;

  return {
    ...delivery,
    request_type: (resolvedType as 'goods' | 'services' | 'raw_material' | null) ?? 'goods',
    history: (historyRes.data ?? []).map(normalizeHistoryEntry),
    items: (itemRows ?? []).map((r: any) => ({
      id:                   r.id,
      item_order:           r.item_order,
      item_code:            r.item_code,
      description:          r.description,
      unit_of_measure:      r.unit_of_measure,
      quantity_to_purchase: Number(r.quantity_to_purchase),
    })),
  };
}

// ─── Create delivery for a PO (called when PO is acknowledged) ───────────────
// All PO fields are passed in directly so this works under any auth context —
// specifically the supplier who acknowledges. We avoid reading pr2_requests
// (no supplier SELECT policy) by accepting requisitioner_id as a parameter.

export interface CreateDeliveryInput {
  poId:                       string;
  po_number:                  string;
  pr2_number_snapshot:        string;
  pr1_number_snapshot:        string;
  rfq_number_snapshot:        string;
  supplier_id:                string | null;
  supplier_name_snapshot:     string;
  requisitioner_id:           string | null;
  requisitioner_name_snapshot:string;
  department_name_snapshot:   string;
  purpose:                    string;
  delivery_address:           string;
  warehouse:                  string;
  commitment_date:            string | null;
}

export async function createDeliveryForPO(input: CreateDeliveryInput): Promise<string> {
  const { data: existing } = await db
    .from('deliveries')
    .select('id')
    .eq('po_id', input.poId)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: totalRow } = await db
    .from('po_items')
    .select('total_price')
    .eq('po_id', input.poId);
  const grandTotal = (totalRow ?? []).reduce((s: number, r: any) => s + Number(r.total_price), 0);

  const { data: delivery, error } = await db
    .from('deliveries')
    .insert({
      po_id:                        input.poId,
      po_number_snapshot:           input.po_number,
      pr2_number_snapshot:          input.pr2_number_snapshot,
      pr1_number_snapshot:          input.pr1_number_snapshot,
      rfq_number_snapshot:          input.rfq_number_snapshot,
      supplier_id:                  input.supplier_id,
      supplier_name_snapshot:       input.supplier_name_snapshot,
      requisitioner_id:             input.requisitioner_id,
      requisitioner_name_snapshot:  input.requisitioner_name_snapshot,
      department_name_snapshot:     input.department_name_snapshot,
      purpose:                      input.purpose,
      commitment_date:              input.commitment_date,
      delivery_address:             input.delivery_address,
      warehouse:                    input.warehouse,
      grand_total:                  grandTotal,
      status:                       'pending',
    })
    .select('id')
    .single();
  if (error) throw error;

  if (input.requisitioner_id) {
    try {
      const { data: existing } = await db
        .from('notifications')
        .select('id')
        .eq('user_id', input.requisitioner_id)
        .eq('document_id', delivery.id)
        .eq('title', 'Delivery Tracking Started')
        .eq('read', false)
        .maybeSingle();

      if (!existing) {
        await createNotification({
          user_id:       input.requisitioner_id,
          title:         'Delivery Tracking Started',
          body:          `Delivery tracking is active for PO ${input.po_number}.`,
          type:          'info',
          document_type: 'delivery',
          document_id:   delivery.id,
          action_url:    `/delivery/${delivery.id}`,
        });
      }
    } catch {
      // Notifications are best-effort; do not fail delivery creation
    }
  }

  return delivery.id;
}

// ─── Supplier: update delivery status ────────────────────────────────────────

export async function supplierUpdateDelivery(
  deliveryId: string,
  values: DeliverySupplierUpdateValues,
  profile: UserProfile
): Promise<void> {
  const { data: delivery } = await db
    .from('deliveries')
    .select('id, status, supplier_id, requisitioner_id')
    .eq('id', deliveryId)
    .maybeSingle();
  if (!delivery) throw new Error('Delivery not found.');
  if (delivery.supplier_id !== profile.id) throw new Error('Not authorized.');

  const now = new Date().toISOString();
  const statusFrom = delivery.status as DeliveryStatus;
  const statusTo   = values.new_status;

  const updates: Record<string, any> = { updated_at: now };
  if (statusTo !== statusFrom) updates.status = statusTo;
  if (values.scheduled_date)   updates.scheduled_date = values.scheduled_date;
  if (statusTo === 'delivered') updates.actual_delivery_date = now.slice(0, 10);
  if (
    statusTo === 'in_transit' &&
    values.dr_document_path?.trim() &&
    values.dr_document_filename?.trim()
  ) {
    updates.dr_document_path = values.dr_document_path.trim();
    updates.dr_document_filename = values.dr_document_filename.trim();
    updates.dr_document_uploaded_at = now;
  }

  await db.from('deliveries').update(updates).eq('id', deliveryId);

  await db.from('delivery_status_history').insert({
    delivery_id:    deliveryId,
    actor_id:       profile.id,
    actor_name:     profile.full_name,
    actor_role:     'supplier',
    status_from:    statusTo !== statusFrom ? statusFrom : null,
    status_to:      statusTo !== statusFrom ? statusTo   : null,
    note:           values.note.trim() || null,
    scheduled_date: values.scheduled_date || null,
    created_at:     now,
  });

  // Notify on meaningful status changes (best-effort)
  const notifiableStatuses: DeliveryStatus[] = ['in_transit', 'delayed', 'delivered'];
  if (statusTo !== statusFrom && notifiableStatuses.includes(statusTo)) {
    const statusLabel = statusTo === 'in_transit' ? 'in transit' : statusTo;
    const notifPayload = {
      type:          'info' as const,
      document_type: 'delivery',
      document_id:   deliveryId,
      action_url:    `/delivery/${deliveryId}`,
    };

    // Notify requisitioner (employee)
    if (delivery.requisitioner_id) {
      try {
        const { data: existing } = await db
          .from('notifications')
          .select('id')
          .eq('user_id', delivery.requisitioner_id)
          .eq('document_id', deliveryId)
          .eq('title', 'Delivery Update')
          .eq('read', false)
          .maybeSingle();
        if (!existing) {
          await createNotification({
            user_id: delivery.requisitioner_id,
            title:   'Delivery Update',
            body:    `Delivery status has been updated to ${statusLabel}.`,
            ...notifPayload,
          });
        }
      } catch {
        // best-effort
      }
    }

    // Notify procurement on all status changes
    try {
      await notifyByRole(
        'procurement',
        {
          title: 'Delivery Status Updated',
          body:  `Supplier updated delivery status to ${statusLabel}.`,
          ...notifPayload,
        },
        { dedupeUnreadForDocument: false },
      );
    } catch {
      // best-effort
    }

    // Notify warehouse when delivered — they need to perform GRN
    if (statusTo === 'delivered') {
      try {
        await notifyByRole(
          'warehouse',
          {
            title: 'Delivery Ready for GRN',
            body:  'A delivery has been marked delivered and is ready for goods receipt.',
            type:  'action_required',
            document_type: 'delivery',
            document_id:   deliveryId,
            action_url:    `/delivery/${deliveryId}`,
          },
          { dedupeUnreadForDocument: true },
        );
      } catch {
        // best-effort
      }
    }
  }
}

// ─── Procurement: add follow-up note ─────────────────────────────────────────

export async function procurementFollowUp(
  deliveryId: string,
  values: DeliveryFollowUpValues,
  profile: UserProfile
): Promise<void> {
  if (!values.note.trim()) throw new Error('Note is required.');
  const now = new Date().toISOString();
  await db.from('delivery_status_history').insert({
    delivery_id:    deliveryId,
    actor_id:       profile.id,
    actor_name:     profile.full_name,
    actor_role:     'procurement',
    status_from:    null,
    status_to:      null,
    note:           values.note.trim(),
    scheduled_date: null,
    created_at:     now,
  });
  await db.from('deliveries').update({ updated_at: now }).eq('id', deliveryId);
}

// ─── Procurement / Warehouse: mark delivered ─────────────────────────────────

export async function markDelivered(
  deliveryId: string,
  note: string,
  profile: UserProfile
): Promise<void> {
  const now = new Date().toISOString();
  const { data: delivery } = await db
    .from('deliveries')
    .select('id, status, requisitioner_id')
    .eq('id', deliveryId)
    .maybeSingle();
  if (!delivery) throw new Error('Delivery not found.');

  await db.from('deliveries').update({
    status:               'delivered',
    actual_delivery_date: now.slice(0, 10),
    updated_at:           now,
  }).eq('id', deliveryId);

  await db.from('delivery_status_history').insert({
    delivery_id:    deliveryId,
    actor_id:       profile.id,
    actor_name:     profile.full_name,
    actor_role:     profile.role,
    status_from:    delivery.status,
    status_to:      'delivered',
    note:           note.trim() || null,
    scheduled_date: null,
    created_at:     now,
  });

  // Notify requisitioner (best-effort)
  if (delivery.requisitioner_id) {
    try {
      const { data: existing } = await db
        .from('notifications')
        .select('id')
        .eq('user_id', delivery.requisitioner_id)
        .eq('document_id', deliveryId)
        .eq('title', 'Delivery Completed')
        .eq('read', false)
        .maybeSingle();

      if (!existing) {
        await createNotification({
          user_id:       delivery.requisitioner_id,
          title:         'Delivery Completed',
          body:          'Your delivery has been marked as delivered.',
          type:          'info',
          document_type: 'delivery',
          document_id:   deliveryId,
          action_url:    `/delivery/${deliveryId}`,
        });
      }
    } catch {
      // Notifications are best-effort; do not fail markDelivered
    }
  }

  try {
    await notifyByRole(
      'warehouse',
      {
        title:         'Delivery Ready for GRN',
        body:          'A delivery has been marked delivered and is ready for goods receipt.',
        type:          'action_required',
        document_type: 'delivery',
        document_id:   deliveryId,
        action_url:    `/delivery/${deliveryId}`,
      },
      { dedupeUnreadForDocument: true }
    );
  } catch {
    // Notifications are best-effort; do not fail markDelivered
  }
}

// ─── Warehouse: forward service delivery to Procurement for GRN ──────────────

export async function forwardServiceDeliveryToProcurement(
  deliveryId: string,
  profile: UserProfile
): Promise<void> {
  const now = new Date().toISOString();
  const { data: delivery } = await db
    .from('deliveries')
    .select('id, po_number_snapshot')
    .eq('id', deliveryId)
    .maybeSingle();
  if (!delivery) throw new Error('Delivery not found.');

  await db
    .from('deliveries')
    .update({
      forwarded_to_procurement: true,
      forwarded_at:               now,
      updated_at:                 now,
    })
    .eq('id', deliveryId);

  await db.from('delivery_status_history').insert({
    delivery_id:    deliveryId,
    actor_id:       profile.id,
    actor_name:     profile.full_name,
    actor_role:     profile.role,
    status_from:    null,
    status_to:      null,
    note:           'Forwarded service delivery to Procurement for GRN processing',
    scheduled_date: null,
    created_at:     now,
  });

  try {
    await notifyByRole(
      'procurement',
      {
        title:         'Service Delivery Forwarded for GRN',
        body:          `Warehouse has forwarded service delivery for PO ${delivery.po_number_snapshot} to Procurement for GRN processing.`,
        type:          'action_required',
        document_type: 'delivery',
        document_id:   deliveryId,
        action_url:    `/delivery/${deliveryId}`,
      },
      { dedupeUnreadForDocument: true }
    );
  } catch {
    // Notifications are best-effort
  }
}

