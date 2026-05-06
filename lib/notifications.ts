import { supabase } from '@/lib/supabase';
import type { NotificationType, Notification } from '@/types/database';

const db = supabase as any;

// ─── Read-side helpers ────────────────────────────────────────────────────────

export async function fetchMyNotifications(userId: string, limit = 10): Promise<Notification[]> {
  const { data, error } = await db
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Notification[];
}

export async function fetchUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await db
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);
  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await db
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);
}

// ─── Single insert ────────────────────────────────────────────────────────────

export interface NotificationInsert {
  user_id:       string;
  title:         string;
  body:          string;
  type:          NotificationType;
  document_type?: string | null;
  document_id?:  string | null;
  action_url?:   string | null;
}

export async function createNotification(insert: NotificationInsert): Promise<void> {
  await db.from('notifications').insert({ ...insert, read: false });
}

// ─── Approver fan-out ─────────────────────────────────────────────────────────
// Notifies all profiles matching the approval step's role + position.
// Skips users who already have an unread action_required for this document,
// which prevents duplicates if the step-advance is replayed.
//
// title / body / documentType / actionUrl default to PR1 values so that
// existing callers (warehouse.ts, approvals.ts) need no changes.

export async function notifyApproversForStep({
  workflowId,
  stepOrder,
  documentId,
  documentNumber,
  instanceId,
  title        = 'PR1 Approval Required',
  body,
  documentType = 'pr1',
  actionUrl,
}: {
  workflowId:     string;
  stepOrder:      number;
  documentId:     string;
  documentNumber: string;
  instanceId:     string;
  title?:         string;
  body?:          string;
  documentType?:  string;
  actionUrl?:     string;
}): Promise<void> {
  // 1. Step role + position requirements
  const { data: step, error: stepErr } = await db
    .from('approval_steps')
    .select('role_required, position_required')
    .eq('workflow_id', workflowId)
    .eq('step_order', stepOrder)
    .maybeSingle();
  if (stepErr || !step) return;

  // 2. Resolve role_id and position_id from their name/title
  const [roleRes, posRes] = await Promise.all([
    db.from('roles').select('id').eq('name', step.role_required).maybeSingle(),
    db.from('positions').select('id').eq('title', step.position_required).maybeSingle(),
  ]);
  if (!roleRes.data?.id || !posRes.data?.id) return;

  // 3. All profiles matching that role + position
  const { data: approvers, error: profErr } = await db
    .from('profiles')
    .select('id')
    .eq('role_id', roleRes.data.id)
    .eq('position_id', posRes.data.id);
  if (profErr || !approvers || approvers.length === 0) return;

  const approverIds: string[] = approvers.map((a: any) => a.id as string);

  // 4. Skip users who already have an unread action_required for this document
  const { data: existing } = await db
    .from('notifications')
    .select('user_id')
    .eq('document_id', documentId)
    .eq('type', 'action_required')
    .eq('read', false)
    .in('user_id', approverIds);

  const notifiedSet = new Set<string>((existing ?? []).map((n: any) => n.user_id as string));
  const targets = approverIds.filter(id => !notifiedSet.has(id));
  if (targets.length === 0) return;

  const notifBody      = body      ?? `PR1 ${documentNumber} requires your approval.`;
  const notifActionUrl = actionUrl ?? `/approvals/${instanceId}`;

  // 5. Insert one notification per target
  const rows = targets.map(userId => ({
    user_id:       userId,
    title,
    body:          notifBody,
    type:          'action_required' as NotificationType,
    document_type: documentType,
    document_id:   documentId,
    action_url:    notifActionUrl,
    read:          false,
  }));

  await db.from('notifications').insert(rows);
}
