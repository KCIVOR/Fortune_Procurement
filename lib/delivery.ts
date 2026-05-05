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

const db = supabase as any;

// ─── Normalizers ──────────────────────────────────────────────────────────────

function normalizeDelivery(row: any): Delivery {
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
    created_at:                   row.created_at,
    updated_at:                   row.updated_at,
  };
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

export async function fetchDeliveryQueue(): Promise<Delivery[]> {
  const { data, error } = await db
    .from('deliveries')
    .select('*')
    .not('status', 'eq', 'cancelled')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalizeDelivery);
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
  return {
    ...normalizeDelivery(deliveryRes.data),
    history: (historyRes.data ?? []).map(normalizeHistoryEntry),
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
    .select('id, status, supplier_id')
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
    .select('id, status')
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
}
