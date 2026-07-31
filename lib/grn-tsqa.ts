import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/auth';
import type { GRNWithItems } from '@/types/grn';
import { evaluateGRNQAStatus, fetchGRNById } from '@/lib/grn';
import { notifyByRole } from '@/lib/notifications';

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
  approved_qa_count: number;
  rejected_qa_count: number;
}

export async function fetchTSQAGRNQueue(): Promise<TSQAGRNQueueRow[]> {
  const { data: qaItems, error } = await db
    .from('grn_items')
    .select('grn_id, qa_status')
    .eq('requires_qa', true);
  if (error) throw error;

  const countsByGrn = new Map<string, { pending: number; approved: number; rejected: number }>();
  for (const row of qaItems ?? []) {
    const counts = countsByGrn.get(row.grn_id) ?? { pending: 0, approved: 0, rejected: 0 };
    if (row.qa_status === 'approved') counts.approved += 1;
    else if (row.qa_status === 'rejected') counts.rejected += 1;
    else counts.pending += 1;
    countsByGrn.set(row.grn_id, counts);
  }

  const grnIds = Array.from(countsByGrn.keys());
  if (grnIds.length === 0) return [];

  const { data: grns, error: grnErr } = await db
    .from('grn_receipts')
    .select('id, grn_number, po_number_snapshot, supplier_name_snapshot, warehouse, transaction_date, status')
    .in('id', grnIds)
    .order('transaction_date', { ascending: false });
  if (grnErr) throw grnErr;

  return (grns ?? []).map((grn: any) => {
    const counts = countsByGrn.get(grn.id) ?? { pending: 0, approved: 0, rejected: 0 };
    return {
      grn_id:                 grn.id,
      grn_number:             grn.grn_number,
      po_number_snapshot:     grn.po_number_snapshot,
      supplier_name_snapshot: grn.supplier_name_snapshot,
      warehouse:              grn.warehouse,
      transaction_date:       grn.transaction_date,
      status:                 grn.status,
      pending_qa_count:       counts.pending,
      approved_qa_count:      counts.approved,
      rejected_qa_count:      counts.rejected,
    };
  });
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
    .select('id, grn_id, requires_qa, qa_status, description, grn_receipts:grn_id ( status )')
    .eq('id', grnItemId)
    .maybeSingle();
  if (itemErr) throw itemErr;
  if (!item) throw new Error('GRN item not found.');
  if (!item.requires_qa) throw new Error('This item does not require QA approval.');
  if (item.grn_receipts?.status === 'closed') {
    throw new Error('GRN is closed; the QA decision can no longer be changed.');
  }
  if (item.qa_status === 'approved') return;

  const now = new Date().toISOString();
  const { data: updated, error: updateErr } = await db
    .from('grn_items')
    .update({
      qa_status:            'approved',
      qa_approved_by_id:    profile.id,
      qa_approved_at:       now,
      qa_rejection_reason:  null,
      qa_rejected_by_id:    null,
      qa_rejected_at:       null,
      updated_at:           now,
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
      payload:       { grn_item_id: grnItemId, description: item.description, changed_decision: item.qa_status === 'rejected' },
    });
  } catch {}
}

export async function rejectGRNItemQA(
  grnItemId: string,
  reason: string,
  profile: UserProfile
): Promise<void> {
  if (profile.role !== 'tsqa' && profile.role !== 'admin') {
    throw new Error('Only TSQA can reject GRN QA items.');
  }
  if (!reason.trim()) {
    throw new Error('A rejection reason is required.');
  }

  const { data: item, error: itemErr } = await db
    .from('grn_items')
    .select('id, grn_id, requires_qa, qa_status, description, grn_receipts:grn_id ( status )')
    .eq('id', grnItemId)
    .maybeSingle();
  if (itemErr) throw itemErr;
  if (!item) throw new Error('GRN item not found.');
  if (!item.requires_qa) throw new Error('This item does not require QA approval.');
  if (item.grn_receipts?.status === 'closed') {
    throw new Error('GRN is closed; the QA decision can no longer be changed.');
  }

  const now = new Date().toISOString();
  const { data: updated, error: updateErr } = await db
    .from('grn_items')
    .update({
      qa_status:            'rejected',
      qa_rejection_reason:  reason.trim(),
      qa_rejected_by_id:    profile.id,
      qa_rejected_at:       now,
      qa_approved_by_id:    null,
      qa_approved_at:       null,
      updated_at:           now,
    })
    .eq('id', grnItemId)
    .select('id');
  if (updateErr) throw updateErr;
  if (!updated || updated.length === 0) {
    throw new Error('You do not have permission to reject this GRN item.');
  }

  const grn = await fetchGRNById(item.grn_id);
  await evaluateGRNQAStatus(item.grn_id);

  try {
    await db.from('audit_logs').insert({
      actor_id:      profile.id,
      action:        'GRN_ITEM_QA_REJECTED',
      document_type: 'GRN',
      document_id:   item.grn_id,
      payload:       { grn_item_id: grnItemId, description: item.description, reason: reason.trim() },
    });
  } catch {}

  try {
    await notifyByRole('warehouse', {
      title:         'GRN Item Failed QA',
      body:          `${item.description} on GRN ${grn?.grn_number ?? ''} was rejected by QA: ${reason.trim()}`,
      type:          'rejected',
      document_type: 'grn',
      document_id:   item.grn_id,
      action_url:    `/grn/${item.grn_id}`,
    }, { dedupeUnreadForDocument: true });
  } catch {}
}
