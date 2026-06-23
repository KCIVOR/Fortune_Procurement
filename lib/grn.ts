import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/auth';
import type {
  GRNReceipt,
  GRNItem,
  GRNWithItems,
  GRNQueueRow,
  GRNFormValues,
} from '@/types/grn';
import { createNotification } from '@/lib/notifications';
import { fetchRfqQuoteAttachmentsByQuoteIds } from '@/lib/canvassing';
import type { RfqQuoteAttachment } from '@/types/canvassing';

const db = supabase as any;

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
    transaction_date:             row.transaction_date,
    received_by_id:               row.received_by_id ?? null,
    received_by_name_snapshot:    row.received_by_name_snapshot,
    received_by_position_snapshot:row.received_by_position_snapshot,
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
    quote_attachments: rfqItemQuoteId ? (quoteAttachmentsByQuote[rfqItemQuoteId] ?? []) : [],
    created_at:        row.created_at,
    updated_at:        row.updated_at,
  };
}

// ─── Queue: all GRNs (warehouse / procurement view) ──────────────────────────

const GRN_QUEUE_SELECT =
  'id, grn_number, delivery_id, po_number_snapshot, supplier_name_snapshot, department_name_snapshot, warehouse, transaction_date, status, closed_at, received_by_name_snapshot';

export type GRNListTab = 'all' | 'open' | 'closed';

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
}): Promise<{ grns: GRNQueueRow[]; total_count: number }> {
  const { statusFilter, limit, offset, search } = options;

  const applyFilters = (q: any) => {
    if (statusFilter !== 'all') {
      q = q.eq('status', statusFilter);
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
  return {
    grns: (data ?? []) as GRNQueueRow[],
    total_count: count ?? 0,
  };
}

export async function fetchGRNTabCounts(): Promise<Record<GRNListTab, number>> {
  const tabs: GRNListTab[] = ['all', 'open', 'closed'];
  const result: Record<GRNListTab, number> = { all: 0, open: 0, closed: 0 };

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
      .select('*, po_items:po_item_id ( pr2_items:pr2_item_id ( is_raw_material, quote_justification, rfq_item_quote_id ) )')
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

  return {
    ...normalizeGRN(grnRes.data),
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

// ─── Open GRN for a delivery (idempotent) ────────────────────────────────────
// Called when warehouse staff clicks "Receive Goods" on a delivered delivery.
// Seeds GRN items from po_items. Safe to call multiple times.

export async function openGRNForDelivery(
  deliveryId: string,
  profile: UserProfile
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
          .select('id, item_order, item_code, description, unit_of_measure, quantity_to_purchase, unit_price')
          .eq('po_id', delivery.po_id)
          .order('item_order', { ascending: true });
        if ((poItems ?? []).length > 0) {
          const itemRows = (poItems ?? []).map((pi: any) => ({
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
          }));
          await db.from('grn_items').insert(itemRows);
        }
      }
    }
    return existing.id;
  }

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
    .select('id, item_order, item_code, description, unit_of_measure, quantity_to_purchase, unit_price, total_price')
    .eq('po_id', delivery.po_id)
    .order('item_order', { ascending: true });
  if (piErr) throw piErr;

  // Create GRN header
  const { data: grn, error: gErr } = await db
    .from('grn_receipts')
    .insert({
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
  if (gErr) throw gErr;

  // Seed GRN items from PO items
  if ((poItems ?? []).length > 0) {
    const itemRows = (poItems ?? []).map((pi: any) => ({
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
    }));
    const { error: iErr } = await db.from('grn_items').insert(itemRows);
    if (iErr) throw iErr;
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

  return grn.id;
}

// ─── Save GRN progress (still open) ─────────────────────────────────────────

export async function saveGRNProgress(
  grnId: string,
  values: GRNFormValues
): Promise<void> {
  const now = new Date().toISOString();

  await db.from('grn_receipts').update({
    dr_no:            values.dr_no.trim(),
    dr_date:          values.dr_date || null,
    transaction_date: values.transaction_date,
    remarks:          values.remarks.trim(),
    updated_at:       now,
  }).eq('id', grnId);

  for (const item of values.items) {
    await db.from('grn_items').update({
      quantity_received: Number(item.quantity_received) || 0,
      quantity_rejected: Number(item.quantity_rejected) || 0,
      remarks:           item.remarks.trim(),
      updated_at:        now,
    }).eq('id', item.id);
  }
}

// ─── Close GRN (save + close transaction) ────────────────────────────────────

export async function closeGRN(
  grnId: string,
  deliveryId: string,
  values: GRNFormValues,
  profile: UserProfile
): Promise<void> {
  const now = new Date().toISOString();

  // Save all fields
  await saveGRNProgress(grnId, values);

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
    actor_role:     'warehouse',
    status_from:    null,
    status_to:      null,
    note:           `GRN closed by ${profile.full_name}. GRN No: ${grnId}.`,
    scheduled_date: null,
    created_at:     now,
  });

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
