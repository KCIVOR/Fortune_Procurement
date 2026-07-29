import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/auth';
import { createNotification } from '@/lib/notifications';

const db = supabase as any;

export async function resolvePORequestType(poId: string): Promise<'goods' | 'services' | 'raw_material'> {
  const { data: po } = await db
    .from('po_requests')
    .select('pr2_id')
    .eq('id', poId)
    .maybeSingle();
  if (!po?.pr2_id) return 'goods';

  const { data: pr2 } = await db
    .from('pr2_requests')
    .select('request_type')
    .eq('id', po.pr2_id)
    .maybeSingle();
  return (pr2?.request_type as 'goods' | 'services' | 'raw_material') ?? 'goods';
}

export async function sendPOToSupplier(poId: string, profile: UserProfile): Promise<void> {
  if (profile.role !== 'procurement') {
    throw new Error('Only procurement can send POs to suppliers.');
  }

  const { data: po } = await db
    .from('po_requests')
    .select('id, status, po_number, supplier_id, sent_at')
    .eq('id', poId)
    .maybeSingle();
  if (!po) throw new Error('PO not found.');
  if (po.status !== 'approved') {
    throw new Error('Only approved POs can be sent to the supplier.');
  }
  if (!po.supplier_id) {
    throw new Error('This PO has no registered supplier. Use Mark as Ordered for external vendors.');
  }
  if (po.sent_at) {
    throw new Error('PO has already been sent to the supplier.');
  }


  const now = new Date().toISOString();
  const { error: updateErr } = await db
    .from('po_requests')
    .update({ sent_by_id: profile.id, sent_at: now, updated_at: now })
    .eq('id', poId);
  if (updateErr) throw updateErr;

  const { data: existing } = await db
    .from('notifications')
    .select('id')
    .eq('user_id', po.supplier_id)
    .eq('document_id', poId)
    .eq('type', 'info')
    .maybeSingle();

  if (!existing) {
    await createNotification({
      user_id:       po.supplier_id,
      title:         'New Purchase Order',
      body:          `You have a new Purchase Order: ${po.po_number}.`,
      type:          'info',
      document_type: 'po',
      document_id:   poId,
      action_url:    `/supplier/po/${poId}`,
    });
  }

  await db.from('audit_logs').insert({
    actor_id:      profile.id,
    action:        'PO_SENT_TO_SUPPLIER',
    document_type: 'PO',
    document_id:   poId,
    payload:       { po_number: po.po_number },
  });
}
