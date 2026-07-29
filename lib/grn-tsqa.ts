import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/auth';
import type { GRNWithItems } from '@/types/grn';
import { evaluateGRNQAStatus, fetchGRNById } from '@/lib/grn';

const db = supabase as any;

export interface TSQAGRNQueueRow {
  grn_id: string;
  grn_number: string;
  po_number_snapshot: string;
  supplier_name_snapshot: string;
  warehouse: string;
  transaction_date: string;
  status: string;
  pending_qa_count: number;
}

export async function fetchTSQAGRNQueue(): Promise<TSQAGRNQueueRow[]> {
  const { data: pendingItems, error } = await db
    .from('grn_items')
    .select('grn_id')
    .eq('requires_qa', true)
    .eq('qa_status', 'pending');
  if (error) throw error;

  const pendingCountByGrn = new Map<string, number>();
  for (const row of pendingItems ?? []) {
    pendingCountByGrn.set(row.grn_id, (pendingCountByGrn.get(row.grn_id) ?? 0) + 1);
  }

  const grnIds = Array.from(pendingCountByGrn.keys());
  if (grnIds.length === 0) return [];

  const { data: grns, error: grnErr } = await db
    .from('grn_receipts')
    .select('id, grn_number, po_number_snapshot, supplier_name_snapshot, warehouse, transaction_date, status')
    .in('id', grnIds)
    .neq('status', 'closed')
    .order('transaction_date', { ascending: false });
  if (grnErr) throw grnErr;

  return (grns ?? []).map((grn: any) => ({
    grn_id:                 grn.id,
    grn_number:             grn.grn_number,
    po_number_snapshot:     grn.po_number_snapshot,
    supplier_name_snapshot: grn.supplier_name_snapshot,
    warehouse:              grn.warehouse,
    transaction_date:       grn.transaction_date,
    status:                 grn.status,
    pending_qa_count:       pendingCountByGrn.get(grn.id) ?? 0,
  }));
}

export async function fetchTSQAGRNById(grnId: string): Promise<GRNWithItems | null> {
  const grn = await fetchGRNById(grnId);
  if (!grn) return null;
  return grn;
}

export async function approveGRNItemQA(
  grnItemId: string,
  profile: UserProfile
): Promise<void> {
  if (profile.role !== 'tsqa' && profile.role !== 'admin') {
    throw new Error('Only TSQA can approve GRN QA items.');
  }

  const { data: item, error: itemErr } = await db
    .from('grn_items')
    .select('id, grn_id, requires_qa, qa_status, description')
    .eq('id', grnItemId)
    .maybeSingle();
  if (itemErr) throw itemErr;
  if (!item) throw new Error('GRN item not found.');
  if (!item.requires_qa) throw new Error('This item does not require QA approval.');
  if (item.qa_status === 'approved') throw new Error('Item is already approved.');

  const now = new Date().toISOString();
  const { data: updated, error: updateErr } = await db
    .from('grn_items')
    .update({
      qa_status:         'approved',
      qa_approved_by_id: profile.id,
      qa_approved_at:    now,
      updated_at:        now,
    })
    .eq('id', grnItemId)
    .select('id');
  if (updateErr) throw updateErr;
  if (!updated || updated.length === 0) {
    throw new Error('You do not have permission to approve this GRN item.');
  }

  await evaluateGRNQAStatus(item.grn_id);

  try {
    await db.from('audit_logs').insert({
      actor_id:      profile.id,
      action:        'GRN_ITEM_QA_APPROVED',
      document_type: 'GRN',
      document_id:   item.grn_id,
      payload:       { grn_item_id: grnItemId, description: item.description },
    });
  } catch {}
}
