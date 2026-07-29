import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/auth';
import type {
  GRNReceipt,
  GRNItem,
  GRNWithItems,
  GRNQueueRow,
  GRNFormValues,
} from '@/types/grn';
import { createNotification, notifyByRole } from '@/lib/notifications';
import { fetchRfqQuoteAttachmentsByQuoteIds } from '@/lib/canvassing';
import type { RfqQuoteAttachment } from '@/types/canvassing';

const db = supabase as any;

type GRNItemQARow = { requires_qa?: boolean; qa_status?: string | null };

export function hasUnresolvedQAItems(items: GRNItemQARow[]): boolean {
  return items.some((i) => i.requires_qa === true && i.qa_status === 'pending');
}

export async function evaluateGRNQAStatus(grnId: string): Promise<'open' | 'pending_qa' | null> {
  const { data: grn, error: grnErr } = await db
    .from('grn_receipts')
    .select('id, status, grn_number')
    .eq('id', grnId)
    .maybeSingle();
  if (grnErr) throw grnErr;
  if (!grn || grn.status === 'closed') return null;

  const { data: items, error: itemsErr } = await db
    .from('grn_items')
    .select('requires_qa, qa_status')
    .eq('grn_id', grnId);
  if (itemsErr) throw itemsErr;

  const previousStatus = grn.status as string;

  const { data: syncedStatus, error: syncErr } = await db.rpc('sync_grn_qa_header_status', {
    p_grn_id: grnId,
  });
  if (syncErr) throw syncErr;

  const resolvedStatus = (syncedStatus as string | null) ?? previousStatus;

  try {
    if (resolvedStatus === 'pending_qa' && previousStatus !== 'pending_qa') {
      await notifyByRole('tsqa', {
        title:         'GRN QA Inspection Required',
        body:          `GRN ${grn.grn_number} has items pending QA approval.`,
        type:          'action_required',
        document_type: 'grn',
        document_id:   grnId,
        action_url:    `/tsqa/grn/${grnId}`,
      }, { dedupeUnreadForDocument: true });
    } else if (resolvedStatus === 'open' && previousStatus === 'pending_qa') {
      await notifyByRole('warehouse', {
        title:         'GRN QA Complete',
        body:          `All QA items on GRN ${grn.grn_number} have been approved. You may close the GRN.`,
        type:          'info',
        document_type: 'grn',
        document_id:   grnId,
        action_url:    `/grn/${grnId}`,
      }, { dedupeUnreadForDocument: true });
    }
  } catch {
    // Notifications are best-effort
  }

  return resolvedStatus === 'pending_qa' ? 'pending_qa' : resolvedStatus === 'open' ? 'open' : null;
}

export async function forwardItemToQA(grnId: string, itemId: string): Promise<void> {
  const { error } = await db
    .from('grn_items')
    .update({
      requires_qa: true,
      qa_status:   'pending',
      updated_at:  new Date().toISOString(),
    })
    .eq('id', itemId)
    .eq('grn_id', grnId);

  if (error) throw error;

  await evaluateGRNQAStatus(grnId);
}

// ─── Normalizers ──────────────────────────────────────────────────────────────

function normalizeGRN(row: any): GRNReceipt {
  return {
    id:                           row.id,
    grn_number:                   row.grn_number,
    delivery_id:                  row.delivery_id,
    po_number_snapshot:           row.po_number_snapshot,
    pr2_number_snapshot:          row.pr2_number_snapshot,
    pr1_number_snapshot:          row.pr1_number_snapshot,
    supplier_name_snapshot:       row.supplier_name_snapshot,
    department_name_snapshot:     row.department_name_snapshot,
    purpose:                      row.purpose,
    warehouse:                    row.warehouse,
    delivery_address:             row.delivery_address,
    dr_no:                        row.dr_no,
    dr_date:                      row.dr_date ?? null,
    inv_no:                       row.inv_no ?? '',
    transaction_date:             row.transaction_date,
    received_by_id:               row.received_by_id ?? null,
    received_by_name_snapshot:    row.received_by_name_snapshot,
    received_by_position_snapshot:row.received_by_position_snapshot,
    request_type:                 (row.request_type ?? 'goods') as 'goods' | 'services',
    status:                       row.status,
    remarks:                      row.remarks,
    created_at:                   row.created_at,
    updated_at:                   row.updated_at,
    closed_at:                    row.closed_at ?? null,
  };
}

function normalizeItem(row: any, quoteAttachmentsByQuote: Record<string, RfqQuoteAttachment[]> = {}): GRNItem {
  const pr2Item = row.po_items?.pr2_items ?? null;
  const rfqItemQuoteId: string | null = pr2Item?.rfq_item_quote_id ?? null;
  return {
    id:                row.id,
    grn_id:            row.grn_id,
    po_item_id:        row.po_item_id ?? null,
    item_order:        Number(row.item_order),
    item_code:         row.item_code,
    description:       row.description,
    unit_of_measure:   row.unit_of_measure,
    quantity_ordered:  Number(row.quantity_ordered),
    quantity_received: Number(row.quantity_received),
    quantity_rejected: Number(row.quantity_rejected),
    unit_price:        Number(row.unit_price),
    remarks:           row.remarks,
    is_raw_material:   pr2Item?.is_raw_material === true,
    quote_justification: pr2Item?.quote_justification ?? null,
    pr1_remarks_snapshot: pr2Item?.pr1_remarks_snapshot ?? null,
    pr1_quantity_requested_snapshot:      pr2Item?.pr1_quantity_requested_snapshot ?? null,
    quantity_override_reason_snapshot:    pr2Item?.quantity_override_reason_snapshot ?? null,
    quantity_overridden_by_name_snapshot: pr2Item?.quantity_overridden_by_name_snapshot ?? null,
    quote_attachments: rfqItemQuoteId ? (quoteAttachmentsByQuote[rfqItemQuoteId] ?? []) : [],
    requires_qa:       row.requires_qa === true,
    qa_status:         row.qa_status ?? null,
    qa_approved_by_id: row.qa_approved_by_id ?? null,
    qa_approved_at:    row.qa_approved_at ?? null,
    created_at:        row.created_at,
    updated_at:        row.updated_at,
  };
}

// ─── Queue: all GRNs (warehouse / procurement view) ──────────────────────────

const GRN_QUEUE_SELECT =
  'id, grn_number, delivery_id, po_number_snapshot, pr1_number_snapshot, supplier_name_snapshot, department_name_snapshot, warehouse, transaction_date, status, closed_at, received_by_name_snapshot';

export type GRNListTab = 'all' | 'open' | 'pending_qa' | 'closed';

export async function fetchGRNQueue(): Promise<GRNQueueRow[]> {
  const { data, error } = await db
    .from('grn_receipts')
    .select(GRN_QUEUE_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as GRNQueueRow[];
}

export async function fetchGRNQueuePaged(options: {
  statusFilter: GRNListTab;
  limit: number;
  offset: number;
  search?: string;
  /** Rev #9: priority lives on pr1_requests only — resolved/filtered via ID-based join chain. */
  priority?: string;
}): Promise<{ grns: GRNQueueRow[]; total_count: number }> {
  const { statusFilter, limit, offset, search, priority } = options;

  // Priority pre-filter: pr1 -> pr2 -> po -> deliveries -> grn_receipts, ID-based.
  let priorityDeliveryIds: string[] | null = null;
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
    let deliveryIds: string[] = [];
    if (poIds.length > 0) {
      const { data: deliveryHits } = await db.from('deliveries').select('id').in('po_id', poIds);
      deliveryIds = ((deliveryHits ?? []) as any[]).map(r => r.id);
    }
    priorityDeliveryIds = deliveryIds;
  }

  const applyFilters = (q: any) => {
    if (statusFilter !== 'all') {
      q = q.eq('status', statusFilter);
    }
    if (priorityDeliveryIds !== null) {
      if (priorityDeliveryIds.length === 0) {
        q = q.eq('id', '00000000-0000-0000-0000-000000000000');
      } else {
        q = q.in('delivery_id', priorityDeliveryIds);
      }
    }
    const term = search?.trim();
    if (term) {
      const p = `%${term}%`;
      q = q.or(
        `grn_number.ilike.${p},po_number_snapshot.ilike.${p},supplier_name_snapshot.ilike.${p},department_name_snapshot.ilike.${p},warehouse.ilike.${p},received_by_name_snapshot.ilike.${p}`
      );
    }
    return q;
  };

  const { data, error, count } = await applyFilters(
    db.from('grn_receipts').select(GRN_QUEUE_SELECT, { count: 'exact' })
  )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  const rawRows = (data ?? []) as any[];
  // Resolve request_type via the unambiguous FK chain (deliveries -> po_requests ->
  // pr2_requests -> pr1_requests), not by matching pr1_number_snapshot text — PR1
  // numbers are not guaranteed unique, and a text match can silently resolve to the
  // wrong row when a duplicate exists.
  const typeByDeliveryId: Record<string, 'goods' | 'services'> = {};
  const priorityByDeliveryId: Record<string, string> = {};
  const deliveryIds = Array.from(new Set(rawRows.map((r: any) => r.delivery_id).filter(Boolean)));
  if (deliveryIds.length > 0) {
    const { data: deliveryData } = await db
      .from('deliveries')
      .select('id, po_id')
      .in('id', deliveryIds);
    const poIds = Array.from(new Set((deliveryData ?? []).map((d: any) => d.po_id).filter(Boolean)));

    const { data: poData } = poIds.length > 0
      ? await db.from('po_requests').select('id, pr2_id').in('id', poIds)
      : { data: [] as any[] };
    const pr2Ids = Array.from(new Set((poData ?? []).map((p: any) => p.pr2_id).filter(Boolean)));

    const { data: pr2Data } = pr2Ids.length > 0
      ? await db.from('pr2_requests').select('id, pr1_id').in('id', pr2Ids)
      : { data: [] as any[] };
    const pr1Ids = Array.from(new Set((pr2Data ?? []).map((p: any) => p.pr1_id).filter(Boolean)));

    const { data: pr1Data } = pr1Ids.length > 0
      ? await db.from('pr1_requests').select('id, request_type, priority').in('id', pr1Ids)
      : { data: [] as any[] };

    const pr1TypeById: Record<string, 'goods' | 'services'> = Object.fromEntries(
      ((pr1Data ?? []) as any[]).map(p => [p.id, p.request_type ?? 'goods'])
    );
    const pr1PriorityById: Record<string, string> = Object.fromEntries(
      ((pr1Data ?? []) as any[]).map(p => [p.id, p.priority ?? 'normal'])
    );
    const pr1IdByPr2Id: Record<string, string> = Object.fromEntries(
      ((pr2Data ?? []) as any[]).map(p => [p.id, p.pr1_id])
    );
    const pr2IdByPoId: Record<string, string> = Object.fromEntries(
      ((poData ?? []) as any[]).map(p => [p.id, p.pr2_id])
    );
    for (const d of (deliveryData ?? []) as any[]) {
      const pr2Id = pr2IdByPoId[d.po_id];
      const pr1Id = pr2Id ? pr1IdByPr2Id[pr2Id] : undefined;
      const resolvedType = pr1Id ? pr1TypeById[pr1Id] : undefined;
      if (resolvedType) typeByDeliveryId[d.id] = resolvedType;
      priorityByDeliveryId[d.id] = pr1Id ? (pr1PriorityById[pr1Id] ?? 'normal') : 'normal';
    }
  }

  return {
    grns: rawRows.map(r => ({
      ...r,
      request_type: typeByDeliveryId[r.delivery_id] ?? 'goods',
      priority: priorityByDeliveryId[r.delivery_id] ?? 'normal',
    })) as GRNQueueRow[],
    total_count: count ?? 0,
  };
}

export async function fetchGRNTabCounts(): Promise<Record<GRNListTab, number>> {
  const tabs: GRNListTab[] = ['all', 'open', 'pending_qa', 'closed'];
  const result: Record<GRNListTab, number> = { all: 0, open: 0, pending_qa: 0, closed: 0 };

  for (const tab of tabs) {
    let q = db.from('grn_receipts').select('id', { count: 'exact', head: true });
    if (tab !== 'all') {
      q = q.eq('status', tab);
    }
    const { count, error } = await q;
    if (error) throw error;
    result[tab] = count ?? 0;
  }

  return result;
}

// ─── Detail: fetch GRN with items ────────────────────────────────────────────

export async function fetchGRNById(id: string): Promise<GRNWithItems | null> {
  const [grnRes, itemsRes] = await Promise.all([
    db.from('grn_receipts').select('*').eq('id', id).maybeSingle(),
    db.from('grn_items')
      .select('*, po_items:po_item_id ( pr2_items:pr2_item_id ( is_raw_material, quote_justification, pr1_remarks_snapshot, pr1_quantity_requested_snapshot, quantity_override_reason_snapshot, quantity_overridden_by_name_snapshot, rfq_item_quote_id ) )')
      .eq('grn_id', id)
      .order('item_order', { ascending: true }),
  ]);
  if (grnRes.error) throw grnRes.error;
  if (!grnRes.data) return null;

  const rawItems: any[] = itemsRes.data ?? [];
  const quoteIds = rawItems
    .map((r: any) => r.po_items?.pr2_items?.rfq_item_quote_id)
    .filter((id: string | null | undefined): id is string => !!id);
  const quoteAttachmentsByQuote: Record<string, RfqQuoteAttachment[]> =
    quoteIds.length > 0
      ? await fetchRfqQuoteAttachmentsByQuoteIds(quoteIds).catch(() => ({}))
      : {};

  let items: GRNItem[] = rawItems.map(r => normalizeItem(r, quoteAttachmentsByQuote));

  // Fallback: if no grn_items exist yet, synthesize from po_items via the delivery chain
  if (items.length === 0) {
    const { data: delivery } = await db
      .from('deliveries')
      .select('po_id')
      .eq('id', grnRes.data.delivery_id)
      .maybeSingle();

    if (delivery?.po_id) {
      const { data: poItems } = await db
        .from('po_items')
        .select('id, item_order, item_code, description, unit_of_measure, quantity_to_purchase, unit_price')
        .eq('po_id', delivery.po_id)
        .order('item_order', { ascending: true });

      items = (poItems ?? []).map((pi: any, idx: number): GRNItem => ({
        id:                pi.id,
        grn_id:            id,
        po_item_id:        pi.id,
        item_order:        Number(pi.item_order ?? idx + 1),
        item_code:         pi.item_code ?? '',
        description:       pi.description,
        unit_of_measure:   pi.unit_of_measure,
        quantity_ordered:  Number(pi.quantity_to_purchase),
        quantity_received: Number(pi.quantity_to_purchase),
        quantity_rejected: 0,
        unit_price:        Number(pi.unit_price),
        remarks:           '',
        created_at:        grnRes.data.created_at,
        updated_at:        grnRes.data.updated_at,
      }));
    }
  }

  const grn = normalizeGRN(grnRes.data);
  // Resolve request_type via the unambiguous FK chain (grn_receipts -> deliveries ->
  // po_requests -> pr2_requests -> pr1_requests), not by matching pr1_number_snapshot
  // text — PR1 numbers are not guaranteed unique, and a text match silently falls back
  // to 'goods' when a duplicate exists.
  const { data: resolvedType } = await db.rpc('request_type_for_grn', { p_grn_id: id });

  return {
    ...grn,
    request_type: (resolvedType as 'goods' | 'services' | null) ?? 'goods',
    items,
  };
}

// ─── Fetch GRN by delivery_id ─────────────────────────────────────────────────

export async function fetchGRNByDeliveryId(deliveryId: string): Promise<GRNWithItems | null> {
  const { data, error } = await db
    .from('grn_receipts')
    .select('id')
    .eq('delivery_id', deliveryId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return fetchGRNById(data.id);
}

/** Next 4-digit suffix for DR-{year}-#### (e.g. 0001). Guide only — not reserved. */
export async function fetchSuggestedDRSequence(year?: number): Promise<string> {
  const y = year ?? new Date().getFullYear();
  const prefix = `DR-${y}-`;

  const { data, error } = await db
    .from('grn_receipts')
    .select('dr_no')
    .ilike('dr_no', `${prefix}%`);

  if (error) throw error;

  let max = 0;
  const re = new RegExp(`^DR-${y}-(\\d+)`, 'i');
  for (const row of data ?? []) {
    const num = String((row as { dr_no?: string }).dr_no ?? '');
    const match = num.match(re);
    if (!match) continue;
    const parsed = parseInt(match[1], 10);
    if (!Number.isNaN(parsed) && parsed > max) max = parsed;
  }

  return String(max + 1).padStart(4, '0');
}

/** Next 4-digit suffix for GRN-{year}-####. Guide only — not reserved. */
export async function fetchSuggestedGRNSequence(year?: number): Promise<string> {
  const y = year ?? new Date().getFullYear();
  const prefix = `GRN-${y}-`;

  const { data, error } = await db
    .from('grn_receipts')
    .select('grn_number')
    .ilike('grn_number', `${prefix}%`);
  if (error) throw error;

  let max = 0;
  const re = new RegExp(`^GRN-${y}-(\\d+)`, 'i');
  for (const row of data ?? []) {
    const num = String((row as { grn_number?: string }).grn_number ?? '');
    const match = num.match(re);
    if (!match) continue;
    const parsed = parseInt(match[1], 10);
    if (!Number.isNaN(parsed) && parsed > max) max = parsed;
  }
  return String(max + 1).padStart(4, '0');
}

// ─── Open GRN for a delivery (idempotent) ────────────────────────────────────
// Called when warehouse staff clicks "Receive Goods" on a delivered delivery.
// Seeds GRN items from po_items. Safe to call multiple times.

export async function openGRNForDelivery(
  deliveryId: string,
  profile: UserProfile,
  grnNumberInput?: string,
): Promise<string> {
  // Check for existing GRN
  const { data: existing } = await db
    .from('grn_receipts')
    .select('id')
    .eq('delivery_id', deliveryId)
    .maybeSingle();
  if (existing?.id) {
    // Re-seed items if they were never created (handles creation race/failure)
    const { count } = await db
      .from('grn_items')
      .select('id', { count: 'exact', head: true })
      .eq('grn_id', existing.id);
    if ((count ?? 0) === 0) {
      const { data: delivery } = await db
        .from('deliveries').select('po_id').eq('id', deliveryId).maybeSingle();
      if (delivery?.po_id) {
        const { data: poItems } = await db
          .from('po_items')
          .select('id, item_order, item_code, description, unit_of_measure, quantity_to_purchase, unit_price, pr2_items:pr2_item_id ( is_raw_material )')
          .eq('po_id', delivery.po_id)
          .order('item_order', { ascending: true });
        if ((poItems ?? []).length > 0) {
          const itemRows = (poItems ?? []).map((pi: any) => {
            const isRawMaterial = pi.pr2_items?.is_raw_material === true;
            return {
              grn_id:            existing.id,
              po_item_id:        pi.id,
              item_order:        pi.item_order,
              item_code:         pi.item_code ?? '',
              description:       pi.description,
              unit_of_measure:   pi.unit_of_measure,
              quantity_ordered:  Number(pi.quantity_to_purchase),
              quantity_received: Number(pi.quantity_to_purchase),
              quantity_rejected: 0,
              unit_price:        Number(pi.unit_price),
              remarks:           '',
              requires_qa:       isRawMaterial,
              qa_status:         isRawMaterial ? 'pending' : null,
            };
          });
          await db.from('grn_items').insert(itemRows);
          await evaluateGRNQAStatus(existing.id);
        }
      }
    }
    return existing.id;
  }

  const grnNumber = (grnNumberInput ?? '').trim();
  if (!grnNumber) throw new Error('GRN number is required.');

  const { data: dup } = await db
    .from('grn_receipts')
    .select('id')
    .eq('grn_number', grnNumber)
    .maybeSingle();
  if (dup?.id) throw new Error(`GRN number ${grnNumber} is already in use.`);

  // Fetch delivery for snapshots
  const { data: delivery, error: dErr } = await db
    .from('deliveries')
    .select('*')
    .eq('id', deliveryId)
    .maybeSingle();
  if (dErr) throw dErr;
  if (!delivery) throw new Error('Delivery not found.');

  // Fetch PO items
  const { data: poItems, error: piErr } = await db
    .from('po_items')
    .select('id, item_order, item_code, description, unit_of_measure, quantity_to_purchase, unit_price, total_price, pr2_items:pr2_item_id ( is_raw_material )')
    .eq('po_id', delivery.po_id)
    .order('item_order', { ascending: true });
  if (piErr) throw piErr;

  // Create GRN header
  const { data: grn, error: gErr } = await db
    .from('grn_receipts')
    .insert({
      grn_number:                   grnNumber,
      delivery_id:                  deliveryId,
      po_number_snapshot:           delivery.po_number_snapshot,
      pr2_number_snapshot:          delivery.pr2_number_snapshot,
      pr1_number_snapshot:          delivery.pr1_number_snapshot,
      supplier_name_snapshot:       delivery.supplier_name_snapshot,
      department_name_snapshot:     delivery.department_name_snapshot,
      purpose:                      delivery.purpose,
      warehouse:                    delivery.warehouse,
      delivery_address:             delivery.delivery_address,
      dr_no:                        '',
      dr_date:                      null,
      transaction_date:             new Date().toISOString().slice(0, 10),
      received_by_id:               profile.id,
      received_by_name_snapshot:    profile.full_name,
      received_by_position_snapshot:profile.position,
      status:                       'open',
      remarks:                      '',
    })
    .select('id')
    .single();
  if (gErr) {
    if (gErr.code === '23505' && String(gErr.message ?? '').includes('grn_number')) {
      throw new Error(`GRN number ${grnNumber} is already in use.`);
    }
    throw gErr;
  }

  // Seed GRN items from PO items
  if ((poItems ?? []).length > 0) {
    const itemRows = (poItems ?? []).map((pi: any) => {
      const isRawMaterial = pi.pr2_items?.is_raw_material === true;
      return {
        grn_id:            grn.id,
        po_item_id:        pi.id,
        item_order:        pi.item_order,
        item_code:         pi.item_code ?? '',
        description:       pi.description,
        unit_of_measure:   pi.unit_of_measure,
        quantity_ordered:  Number(pi.quantity_to_purchase),
        quantity_received: Number(pi.quantity_to_purchase), // default: full qty received
        quantity_rejected: 0,
        unit_price:        Number(pi.unit_price),
        remarks:           '',
        requires_qa:       isRawMaterial,
        qa_status:         isRawMaterial ? 'pending' : null,
      };
    });
    const { error: iErr } = await db.from('grn_items').insert(itemRows);
    if (iErr) throw iErr;
    await evaluateGRNQAStatus(grn.id);
  }

  if (delivery.requisitioner_id) {
    try {
      const { data: existing } = await db
        .from('notifications')
        .select('id')
        .eq('user_id', delivery.requisitioner_id)
        .eq('document_id', grn.id)
        .eq('title', 'GRN Started')
        .eq('read', false)
        .maybeSingle();

      if (!existing) {
        await createNotification({
          user_id:       delivery.requisitioner_id,
          title:         'GRN Started',
          body:          'Goods receipt has started for your delivery.',
          type:          'info',
          document_type: 'grn',
          document_id:   grn.id,
          action_url:    `/grn/${grn.id}`,
        });
      }
    } catch {
      // Notifications are best-effort; do not fail GRN open
    }
  }

  try {
    await db.from('audit_logs').insert({
      actor_id:      profile.id,
      action:        'GRN_OPENED',
      document_type: 'GRN',
      document_id:   grn.id,
      payload:       { delivery_id: deliveryId, po_number: delivery.po_number_snapshot },
    });
  } catch {}

  return grn.id;
}

// ─── Save GRN progress (still open) ─────────────────────────────────────────

export async function saveGRNProgress(
  grnId: string,
  values: GRNFormValues,
  profile: UserProfile,
): Promise<void> {
  const now = new Date().toISOString();

  const { data: grn, error: grnErr } = await db
    .from('grn_receipts')
    .select('status')
    .eq('id', grnId)
    .maybeSingle();
  if (grnErr) throw grnErr;
  if (!grn) throw new Error('GRN not found.');
  if (grn.status === 'closed') throw new Error('Closed GRNs cannot be edited.');

  await db.from('grn_receipts').update({
    dr_no:            values.dr_no.trim(),
    dr_date:          values.dr_date || null,
    inv_no:           values.inv_no.trim(),
    transaction_date: values.transaction_date,
    remarks:          values.remarks.trim(),
    updated_at:       now,
  }).eq('id', grnId);

  const itemIds = values.items.map((i) => i.id);
  const { data: existingItems } = itemIds.length > 0
    ? await db.from('grn_items').select('id, qa_status').in('id', itemIds)
    : { data: [] as { id: string; qa_status: string | null }[] };
  const qaStatusById = Object.fromEntries(
    (existingItems ?? []).map((row: { id: string; qa_status: string | null }) => [row.id, row.qa_status])
  );

  for (const item of values.items) {
    const requiresQA = item.is_raw_material === true || item.requires_qa === true;
    const itemUpdate: Record<string, unknown> = {
      quantity_received: Number(item.quantity_received) || 0,
      quantity_rejected: Number(item.quantity_rejected) || 0,
      remarks:           item.remarks.trim(),
      requires_qa:       requiresQA,
      updated_at:        now,
    };

    if (requiresQA) {
      if (qaStatusById[item.id] !== 'approved') {
        itemUpdate.qa_status = 'pending';
      }
    } else {
      itemUpdate.qa_status = null;
      itemUpdate.qa_approved_by_id = null;
      itemUpdate.qa_approved_at = null;
    }

    await db.from('grn_items').update(itemUpdate).eq('id', item.id);
  }

  await evaluateGRNQAStatus(grnId);

  try {
    await db.from('audit_logs').insert({
      actor_id:      profile.id,
      action:        'GRN_PROGRESS_SAVED',
      document_type: 'GRN',
      document_id:   grnId,
      payload:       { item_count: values.items.length },
    });
  } catch {}
}

// ─── Close GRN (save + close transaction) ────────────────────────────────────

export async function closeGRN(
  grnId: string,
  deliveryId: string,
  values: GRNFormValues,
  profile: UserProfile
): Promise<void> {
  const now = new Date().toISOString();

  const { data: grn, error: grnErr } = await db
    .from('grn_receipts')
    .select('status')
    .eq('id', grnId)
    .maybeSingle();
  if (grnErr) throw grnErr;
  if (!grn) throw new Error('GRN not found.');
  if (grn.status === 'closed') throw new Error('GRN is already closed.');

  // Save all fields first so the QA re-check below reflects the form's current
  // requires_qa/qa_status, not stale DB state — otherwise a newly QA-flagged
  // item introduced by this save could bypass the gate and get closed anyway.
  // saveGRNProgress() calls evaluateGRNQAStatus() internally.
  await saveGRNProgress(grnId, values, profile);

  const { data: items, error: itemsErr } = await db
    .from('grn_items')
    .select('requires_qa, qa_status')
    .eq('grn_id', grnId);
  if (itemsErr) throw itemsErr;
  if (hasUnresolvedQAItems(items ?? [])) {
    throw new Error('All QA-flagged items must be approved by TSQA before closing the GRN.');
  }

  const { data: refreshedGrn, error: refreshErr } = await db
    .from('grn_receipts')
    .select('status')
    .eq('id', grnId)
    .maybeSingle();
  if (refreshErr) throw refreshErr;
  if (refreshedGrn?.status === 'closed') throw new Error('GRN is already closed.');
  if (refreshedGrn?.status === 'pending_qa') {
    throw new Error('GRN is pending QA approval and cannot be closed yet.');
  }

  // Close the GRN
  await db.from('grn_receipts').update({
    status:                       'closed',
    received_by_id:               profile.id,
    received_by_name_snapshot:    profile.full_name,
    received_by_position_snapshot:profile.position,
    closed_at:                    now,
    updated_at:                   now,
  }).eq('id', grnId);

  // Mark delivery as delivered if not already
  await db.from('deliveries').update({
    status:               'delivered',
    actual_delivery_date: values.transaction_date,
    updated_at:           now,
  }).eq('id', deliveryId).neq('status', 'delivered');

  // Add a delivery history entry
  await db.from('delivery_status_history').insert({
    delivery_id:    deliveryId,
    actor_id:       profile.id,
    actor_name:     profile.full_name,
    actor_role:     profile.role,
    status_from:    null,
    status_to:      null,
    note:           `GRN closed by ${profile.full_name}. GRN No: ${grnId}.`,
    scheduled_date: null,
    created_at:     now,
  });

  try {
    await db.from('audit_logs').insert({
      actor_id:      profile.id,
      action:        'GRN_CLOSED',
      document_type: 'GRN',
      document_id:   grnId,
      payload: {
        delivery_id:      deliveryId,
        dr_no:            values.dr_no.trim(),
        transaction_date: values.transaction_date,
        closed_by:        profile.full_name,
      },
    });
  } catch {}

  // Notify requisitioner (best-effort)
  try {
    const { data: delivery } = await db
      .from('deliveries')
      .select('requisitioner_id')
      .eq('id', deliveryId)
      .maybeSingle();

    if (delivery?.requisitioner_id) {
      const { data: existing } = await db
        .from('notifications')
        .select('id')
        .eq('user_id', delivery.requisitioner_id)
        .eq('document_id', grnId)
        .eq('title', 'GRN Closed')
        .eq('read', false)
        .maybeSingle();

      if (!existing) {
        await createNotification({
          user_id:       delivery.requisitioner_id,
          title:         'GRN Closed',
          body:          'Goods receipt has been completed for your request.',
          type:          'approved',
          document_type: 'grn',
          document_id:   grnId,
          action_url:    `/grn/${grnId}`,
        });
      }
    }
  } catch {
    // Notifications are best-effort; do not fail closeGRN
  }
}

// ─── Reopen GRN (closed → open) ──────────────────────────────────────────────
// Rev #7: closed GRNs can be reopened anytime for correction. Nothing is ever
// generated from a GRN, so there is no downstream guard (unlike RFQ reopen).
// `closed_at` / `received_by_*` are intentionally kept as a visible trace of the
// prior close; re-closing overwrites them with fresh values.

export async function reopenGRN(grnId: string, profile: UserProfile): Promise<void> {
  const { data: grn, error: fetchErr } = await db
    .from('grn_receipts')
    .select('id, grn_number, status, delivery_id')
    .eq('id', grnId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!grn) throw new Error('GRN not found.');
  if (grn.status !== 'closed') throw new Error('Only a closed GRN can be reopened.');

  const { data: items, error: itemsErr } = await db
    .from('grn_items')
    .select('requires_qa, qa_status')
    .eq('grn_id', grnId);
  if (itemsErr) throw itemsErr;
  const nextStatus = hasUnresolvedQAItems(items ?? []) ? 'pending_qa' : 'open';

  const now = new Date().toISOString();

  // RLS scopes writes by role + request type (warehouse↔goods, procurement↔services/goods reopen).
  const { data: updated, error } = await db
    .from('grn_receipts')
    .update({ status: nextStatus, updated_at: now })
    .eq('id', grnId)
    .select('id');
  if (error) throw error;
  if (!updated || updated.length === 0) {
    throw new Error('You do not have permission to reopen this GRN.');
  }

  // Delivery history entry — mirrors the "GRN closed by …" entry closeGRN writes
  await db.from('delivery_status_history').insert({
    delivery_id:    grn.delivery_id,
    actor_id:       profile.id,
    actor_name:     profile.full_name,
    actor_role:     profile.role,
    status_from:    null,
    status_to:      null,
    note:           `GRN reopened for editing by ${profile.full_name}. GRN No: ${grn.grn_number}.`,
    scheduled_date: null,
    created_at:     now,
  });

  try {
    await db.from('audit_logs').insert({
      actor_id:      profile.id,
      action:        'GRN_REOPENED',
      document_type: 'GRN',
      document_id:   grnId,
      payload: {
        grn_number:  grn.grn_number,
        delivery_id: grn.delivery_id,
        reopened_by: profile.full_name,
        actor_role:  profile.role,
      },
    });
  } catch {}

  // Notify requestor (best-effort) — their receipt is being revised
  try {
    const { data: delivery } = await db
      .from('deliveries')
      .select('requisitioner_id')
      .eq('id', grn.delivery_id)
      .maybeSingle();

    if (delivery?.requisitioner_id) {
      await createNotification({
        user_id:       delivery.requisitioner_id,
        title:         'GRN Reopened',
        body:          `Goods receipt ${grn.grn_number} has been reopened for correction. It will be re-closed once updated.`,
        type:          'info',
        document_type: 'grn',
        document_id:   grnId,
        action_url:    `/grn/${grnId}`,
      });
    }
  } catch {
    // Notifications are best-effort; do not fail reopen
  }
}
