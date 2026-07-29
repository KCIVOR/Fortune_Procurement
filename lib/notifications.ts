import { supabase } from '@/lib/supabase';
import type { NotificationType, Notification } from '@/types/database';

const db = supabase as any;

// ─── Read-side helpers ────────────────────────────────────────────────────────

export async function fetchMyNotifications(
  userId: string, 
  limit = 10, 
  beforeTimestamp?: string
): Promise<Notification[]> {
  console.log('📥 [notifications.ts] Fetching notifications for user:', userId, 'limit:', limit, 'before:', beforeTimestamp);
  
  let query = db
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  // If beforeTimestamp is provided, fetch older notifications (cursor-based pagination)
  if (beforeTimestamp) {
    query = query.lt('created_at', beforeTimestamp);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('❌ [notifications.ts] Error fetching notifications:', error);
    throw error;
  }
  console.log('✅ [notifications.ts] Fetched notifications:', data?.length || 0);
  return (data ?? []) as Notification[];
}

export async function fetchUnreadNotificationCount(userId: string): Promise<number> {
  console.log('🔢 [notifications.ts] Fetching unread count for user:', userId);
  const { count, error } = await db
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);
  if (error) {
    console.error('❌ [notifications.ts] Error fetching count:', error);
    throw error;
  }
  console.log('✅ [notifications.ts] Unread count:', count ?? 0);
  return count ?? 0;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  console.log('📖 [notifications.ts] Marking notification as read:', notificationId);
  const { error } = await db
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);
  if (error) {
    console.error('❌ [notifications.ts] Error marking as read:', error);
    throw error;
  }
  console.log('✅ [notifications.ts] Marked as read successfully');
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  console.log('📖 [notifications.ts] Marking ALL notifications as read for user:', userId);
  const { error } = await db
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);
  if (error) {
    console.error('❌ [notifications.ts] Error marking all as read:', error);
    throw error;
  }
  console.log('✅ [notifications.ts] All notifications marked as read successfully');
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
  console.log('📝 [notifications.ts] Creating notification:', insert);
  const { error } = await db.from('notifications').insert({ ...insert, read: false });
  if (error) {
    console.error('❌ [notifications.ts] Error creating notification:', error);
    throw error;
  }
  console.log('✅ [notifications.ts] Notification created successfully');
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
  documentDepartmentId,
  directorPositions = [],
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
  /**
   * Department-scoped positions (e.g. Department Head, Supervisor) hold that
   * title in every department — without this, every Department Head in the
   * company gets notified for a single-department document, even though only
   * the matching department's holder can actually act on it (see
   * canActOnPR2Step / canActOnPOStep / etc.). Pass the document's own
   * department_id to scope the notification to the same set of people who
   * can act on it.
   */
  documentDepartmentId?: string | null;
  /** Positions exempt from department scoping (e.g. Director, Finance Director) — pass the caller's own DIRECTOR_POSITIONS list. */
  directorPositions?: readonly string[];
}): Promise<void> {
  // 1. Step role + position requirements
  const { data: step, error: stepErr } = await db
    .from('approval_steps')
    .select('role_required, position_required')
    .eq('workflow_id', workflowId)
    .eq('step_order', stepOrder)
    .maybeSingle();
  if (stepErr || !step) return;

  // 2. Resolve role_id and all eligible position_ids.
  // Procurement Manager inherits Procurement Staff steps, so when a
  // Procurement Staff step becomes actionable, notify both positions.
  const eligiblePositionTitles = [step.position_required];
  if (step.position_required === 'Procurement Staff') {
    eligiblePositionTitles.push('Procurement Manager');
  }

  const [roleRes, posRows] = await Promise.all([
    db.from('roles').select('id').eq('name', step.role_required).maybeSingle(),
    db.from('positions').select('id').in('title', eligiblePositionTitles),
  ]);
  if (!roleRes.data?.id) return;

  const posIds: string[] = (posRows.data ?? []).map((p: any) => p.id as string);
  if (posIds.length === 0) return;

  // 3. All profiles matching that role + any of the eligible positions.
  // Department-scoped positions must additionally match the document's own
  // department — otherwise every holder of that position title across all
  // departments gets notified, not just the one who can actually act on it.
  // Only 'approver'-role steps (Dept Head, Supervisor, etc.) are ever
  // department-scoped in the ACT gates (canActOnStep / canActOnPR2Step /
  // canActOnPOStep all special-case `stepRoleRequired === 'approver'`) — so
  // mirror that here rather than scoping procurement/supplier steps, which
  // are company-wide regardless of the document's department.
  const isDirectorStep = eligiblePositionTitles.some((t) => directorPositions.includes(t));
  let approversQuery = db
    .from('profiles')
    .select('id')
    .eq('role_id', roleRes.data.id)
    .in('position_id', posIds)
    .eq('active', true);
  if (step.role_required === 'approver' && documentDepartmentId && !isDirectorStep) {
    approversQuery = approversQuery.eq('department_id', documentDepartmentId);
  }
  const { data: approvers, error: profErr } = await approversQuery;
  if (profErr || !approvers || approvers.length === 0) return;

  const approverIds: string[] = approvers.map((a: any) => a.id as string);

  // Compute action URL before the dedup check so we can scope dedup to the
  // current approval instance. Each instance has a unique URL, which prevents
  // stale notifications from a prior rejected/revised round blocking new ones.
  const notifBody      = body      ?? `PR1 ${documentNumber} requires your approval.`;
  const notifActionUrl = actionUrl ?? `/approvals/${instanceId}`;

  // 4. Skip users who already have an unread action_required for this
  //    document AND this specific approval instance URL.
  const { data: existing } = await db
    .from('notifications')
    .select('user_id')
    .eq('document_id', documentId)
    .eq('type', 'action_required')
    .eq('read', false)
    .eq('action_url', notifActionUrl)
    .in('user_id', approverIds);

  const notifiedSet = new Set<string>((existing ?? []).map((n: any) => n.user_id as string));
  const targets = approverIds.filter(id => !notifiedSet.has(id));
  if (targets.length === 0) return;

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

// ─── Role fan-out ─────────────────────────────────────────────────────────────
// Notifies every profile with the given role name (e.g. warehouse, procurement).

export async function notifyByRole(
  roleName: string,
  notification: Omit<NotificationInsert, 'user_id'>,
  options?: { dedupeUnreadForDocument?: boolean }
): Promise<void> {
  const { data: role } = await db
    .from('roles')
    .select('id')
    .eq('name', roleName)
    .maybeSingle();
  if (!role?.id) return;

  const { data: recipients, error: profErr } = await db
    .from('profiles')
    .select('id')
    .eq('role_id', role.id)
    .eq('active', true);
  if (profErr || !recipients?.length) return;

  let targetIds = (recipients as { id: string }[]).map((p) => p.id);

  if (options?.dedupeUnreadForDocument && notification.document_id) {
    const { data: existing } = await db
      .from('notifications')
      .select('user_id')
      .eq('document_id', notification.document_id)
      .eq('type', notification.type)
      .eq('read', false)
      .in('user_id', targetIds);

    const skip = new Set((existing ?? []).map((n: { user_id: string }) => n.user_id));
    targetIds = targetIds.filter((id) => !skip.has(id));
    if (targetIds.length === 0) return;
  }

  const rows = targetIds.map((userId) => ({
    ...notification,
    user_id: userId,
    read: false,
  }));

  const { error } = await db.from('notifications').insert(rows);
  if (error) throw error;
}
