import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/auth';
import type {
  PR1ApprovalQueueRow,
  PR1ApprovalDetail,
  PR1ApprovalSignatories,
  ApprovalAction,
} from '@/types/approvals';
import { fetchPR1Attachments } from '@/lib/pr1';
import type { PR1Attachment } from '@/types/pr1';
import { createNotification, notifyApproversForStep, notifyByRole } from '@/lib/notifications';

const db = supabase as any;

// ─── Queue ────────────────────────────────────────────────────────────────────
// approval_instances has no FK to pr1_requests or approval_steps, so we cannot
// use PostgREST embedded resource syntax. Instead: fetch instances, then fetch
// the related data in two parallel queries and stitch manually.

export async function fetchApprovalQueue(): Promise<PR1ApprovalQueueRow[]> {
  const { data: instances, error: instErr } = await db
    .from('approval_instances')
    .select('id, workflow_id, document_id, current_step, status, started_at')
    .eq('document_type', 'PR1')
    .eq('status', 'active')
    .order('started_at', { ascending: true });

  if (instErr) throw instErr;
  if (!instances || instances.length === 0) return [];

  const pr1Ids      = Array.from(new Set(instances.map((r: any) => r.document_id as string)));
  const workflowIds = Array.from(new Set(instances.map((r: any) => r.workflow_id as string)));

  const [pr1Res, workflowRes, stepsRes] = await Promise.all([
    db.from('pr1_requests')
      .select('id, pr1_number, requisitioner_name_snapshot, department_name_snapshot, department_id, purpose, priority, request_type, date_required, submitted_at')
      .in('id', pr1Ids),
    db.from('approval_workflows')
      .select('id, code')
      .in('id', workflowIds),
    db.from('approval_steps')
      .select('workflow_id, step_order, role_required, position_required, action_label, is_final')
      .in('workflow_id', workflowIds),
  ]);

  if (pr1Res.error) throw pr1Res.error;
  if (stepsRes.error) throw stepsRes.error;

  const pr1Map:      Record<string, any> = Object.fromEntries((pr1Res.data ?? []).map((r: any) => [r.id, r]));
  const workflowMap: Record<string, any> = Object.fromEntries((workflowRes.data ?? []).map((r: any) => [r.id, r]));
  const steps: any[] = stepsRes.data ?? [];

  return instances.flatMap((inst: any) => {
    const pr1  = pr1Map[inst.document_id];
    const wf   = workflowMap[inst.workflow_id];
    const step = steps.find(
      (s: any) => s.workflow_id === inst.workflow_id && s.step_order === inst.current_step
    );
    if (!pr1 || !step) return [];

    return [{
      pr1_id:                      pr1.id,
      pr1_number:                  pr1.pr1_number,
      requisitioner_name_snapshot: pr1.requisitioner_name_snapshot,
      department_name_snapshot:    pr1.department_name_snapshot,
      department_id:               pr1.department_id ?? null,
      purpose:                     pr1.purpose,
      priority:                    pr1.priority,
      request_type:                (pr1.request_type ?? 'goods') as 'goods' | 'services',
      date_required:               pr1.date_required,
      submitted_at:                pr1.submitted_at,
      instance_id:                 inst.id,
      workflow_code:               wf?.code ?? '',
      current_step:                inst.current_step,
      instance_status:             inst.status,
      started_at:                  inst.started_at,
      step_position_required:      step.position_required,
      step_role_required:          step.role_required,
      step_action_label:           step.action_label,
      step_is_final:               step.is_final,
    }];
  });
}

// ─── Detail ───────────────────────────────────────────────────────────────────
// Same FK-less situation: fetch instance, then parallel-fetch related tables.

export async function fetchApprovalDetail(
  instanceId: string
): Promise<PR1ApprovalDetail | null> {
  const { data: inst, error: instErr } = await db
    .from('approval_instances')
    .select('id, workflow_id, document_id, current_step, status, started_at')
    .eq('id', instanceId)
    .maybeSingle();

  if (instErr) throw instErr;
  if (!inst) return null;

  const [pr1Res, wfRes, stepsRes, actionsRes, wvRes] = await Promise.all([
    db.from('pr1_requests').select('*, pr1_items(*)').eq('id', inst.document_id).maybeSingle(),
    db.from('approval_workflows').select('id, code').eq('id', inst.workflow_id).maybeSingle(),
    db.from('approval_steps')
      .select('step_order, role_required, position_required, action_label, is_final')
      .eq('workflow_id', inst.workflow_id)
      .order('step_order', { ascending: true }),
    db.from('approval_actions')
      .select('id, instance_id, step_order, action, actor_id, actor_name_snapshot, actor_position_snapshot, actor_department_snapshot, remarks, acted_at')
      .eq('instance_id', instanceId)
      .order('acted_at', { ascending: true }),
    db.from('warehouse_validations')
      .select('id, decision, validator_name_snapshot, validator_position_snapshot, validated_at, notes')
      .eq('pr1_id', inst.document_id)
      .maybeSingle(),
  ]);

  if (pr1Res.error) throw pr1Res.error;
  if (!pr1Res.data) return null;

  const pr1     = pr1Res.data;
  const wf      = wfRes.data;
  const steps   = stepsRes.data ?? [];
  const actions = actionsRes.data ?? [];
  const wv      = wvRes.data;

  // Fetch warehouse validation items to get validated_soh per item
  let validatedSohMap: Record<string, number | null> = {};
  if (wv?.id) {
    const { data: validationItems, error: viError } = await db
      .from('warehouse_validation_items')
      .select('pr1_item_id, validated_soh')
      .eq('validation_id', wv.id);

    if (viError) throw viError;
    (validationItems ?? []).forEach((vi: any) => {
      validatedSohMap[vi.pr1_item_id] = vi.validated_soh;
    });
  }

  const attachmentsAll = await fetchPR1Attachments(pr1.id as string).catch(() => []);
  const attachmentsByItem: Record<string, PR1Attachment[]> = {};
  for (const att of attachmentsAll) {
    if (!attachmentsByItem[att.pr1_item_id]) attachmentsByItem[att.pr1_item_id] = [];
    attachmentsByItem[att.pr1_item_id].push(att);
  }

  return {
    pr1_id:                      pr1.id,
    pr1_number:                  pr1.pr1_number,
    requisitioner_name_snapshot: pr1.requisitioner_name_snapshot,
    department_name_snapshot:    pr1.department_name_snapshot,
    department_id:               pr1.department_id ?? null,
    purpose:                     pr1.purpose,
    date_required:               pr1.date_required,
    submitted_at:                pr1.submitted_at,
    pr1_status:                  pr1.status,
    priority:                    pr1.priority ?? 'normal',
    request_type:                pr1.request_type ?? 'goods',
    items: (pr1.pr1_items ?? [])
      .sort((a: any, b: any) => a.item_order - b.item_order)
      .map((i: any) => ({
        id:                 i.id,
        item_order:         i.item_order,
        item_code:          i.item_code,
        description:        i.description,
        unit_of_measure:    i.unit_of_measure,
        stock_on_hand:      i.stock_on_hand,
        quantity_requested: i.quantity_requested,
        validated_soh:      validatedSohMap[i.id] ?? null,
        // Phase 4 (Raw Mats): forwarded so approver UI can render the badge.
        is_raw_material:    i.is_raw_material === true,
        remarks:            i.remarks ?? null,
        attachments:        attachmentsByItem[i.id] ?? [],
      })),
    instance_id:     inst.id,
    workflow_id:     inst.workflow_id,
    workflow_code:   wf?.code ?? '',
    current_step:    inst.current_step,
    instance_status: inst.status,
    started_at:      inst.started_at,
    workflow_steps:  steps,
    actions,
    warehouse_decision:           wv?.decision ?? null,
    warehouse_validator_name:     wv?.validator_name_snapshot ?? null,
    warehouse_validator_position: wv?.validator_position_snapshot ?? null,
    warehouse_validated_at:       wv?.validated_at ?? null,
    warehouse_notes:              wv?.notes ?? null,
    attachments: attachmentsAll,
  };
}

/**
 * Read-only signatory chain for a PR1. Uses the latest approval instance for this document
 * (ordered by `started_at` DESC — matches instance lifecycle start time).
 */
export async function fetchPR1ApprovalSignatories(
  pr1Id: string
): Promise<PR1ApprovalSignatories | null> {
  const { data: inst, error: instErr } = await db
    .from('approval_instances')
    .select('id')
    .eq('document_type', 'PR1')
    .eq('document_id', pr1Id)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (instErr) throw instErr;
  if (!inst?.id) return null;

  const detail = await fetchApprovalDetail(inst.id);
  if (!detail) return null;

  return {
    instance_id:      detail.instance_id,
    instance_status:  detail.instance_status,
    current_step:     detail.current_step,
    workflow_steps:   detail.workflow_steps,
    actions:          detail.actions,
  };
}

// ─── Authority check ──────────────────────────────────────────────────────────
// Returns whether the given profile can act on the current step.
// Title (position) must match exactly — role alone is not sufficient.
// PR1 workflow steps are all approver-role; the overload for role is kept for
// callers that only have position (legacy PR1 queue page).

export const DIRECTOR_POSITIONS = ['Director', 'Finance Director'] as const;

function isDepartmentBlocked(
  profile: UserProfile,
  documentDepartmentId?: string | null
): boolean {
  if (!documentDepartmentId) return false;
  if ((DIRECTOR_POSITIONS as readonly string[]).includes(profile.position)) return false;
  return profile.department_id !== documentDepartmentId;
}

export function canActOnStep(
  profile: UserProfile,
  stepPositionRequired: string,
  documentDepartmentId?: string | null
): boolean {
  if (profile.role !== 'approver') return false;
  if (profile.position !== stepPositionRequired) return false;
  if (isDepartmentBlocked(profile, documentDepartmentId)) return false;
  return true;
}

// Extended version used by PR2 and other multi-role workflows.
export function canActOnStepWithRole(
  profile: UserProfile,
  stepRoleRequired: string,
  stepPositionRequired: string,
  documentDepartmentId?: string | null
): boolean {
  const isCorrectRole = profile.role === stepRoleRequired ||
    ((profile.role === 'approver' || profile.role === 'procurement') &&
     (stepRoleRequired === 'approver' || stepRoleRequired === 'procurement'));
  const isCorrectPosition = profile.position === stepPositionRequired ||
    (stepPositionRequired === 'Procurement Staff' && profile.position === 'Procurement Manager');
  if (!isCorrectRole || !isCorrectPosition) return false;
  if (stepRoleRequired === 'approver' && isDepartmentBlocked(profile, documentDepartmentId)) return false;
  return true;
}

// ─── Submit approval action ───────────────────────────────────────────────────
// action:
//   'approved'           — advance to next step (or complete if final)
//   'rejected'           — terminate workflow, PR1 → rejected
//   'revision_requested' — pause workflow, PR1 → revision_requested

export async function submitApprovalAction(
  instanceId: string,
  pr1Id: string,
  stepOrder: number,
  isFinalStep: boolean,
  action: ApprovalAction,
  remarks: string,
  profile: UserProfile
): Promise<void> {
  const now = new Date().toISOString();

  // 1. Record the approval action (digital signature snapshot)
  const { error: actionErr } = await db
    .from('approval_actions')
    .insert({
      instance_id:              instanceId,
      step_order:               stepOrder,
      action,
      actor_id:                 profile.id,
      actor_name_snapshot:      profile.full_name,
      actor_position_snapshot:  profile.position,
      actor_department_snapshot: profile.department,
      remarks:                  remarks.trim() || null,
      acted_at:                 now,
    });

  if (actionErr) throw actionErr;

  if (action === 'approved') {
    if (isFinalStep) {
      // 2a. Final step approved → instance approved, PR1 → approved_for_warehouse
      const { error: instErr } = await db
        .from('approval_instances')
        .update({ status: 'approved', completed_at: now })
        .eq('id', instanceId);
      if (instErr) throw instErr;

      const { error: pr1Err } = await db
        .from('pr1_requests')
        .update({ status: 'approved_for_warehouse', updated_at: now })
        .eq('id', pr1Id)
        .eq('status', 'pending_approval');
      if (pr1Err) throw pr1Err;
    } else {
      // 2b. Non-final step approved → advance current_step
      const { error: instErr } = await db
        .from('approval_instances')
        .update({ current_step: stepOrder + 1 })
        .eq('id', instanceId);
      if (instErr) throw instErr;
      // PR1 stays as pending_approval
    }
  } else if (action === 'rejected') {
    // 3. Rejected → instance rejected, PR1 → rejected
    const { error: instErr } = await db
      .from('approval_instances')
      .update({ status: 'rejected', completed_at: now })
      .eq('id', instanceId);
    if (instErr) throw instErr;

    const { error: pr1Err } = await db
      .from('pr1_requests')
      .update({ status: 'rejected', updated_at: now })
      .eq('id', pr1Id)
      .eq('status', 'pending_approval');
    if (pr1Err) throw pr1Err;
  } else {
    // 4. Revision requested → instance cancelled, PR1 → revision_requested
    const { error: instErr } = await db
      .from('approval_instances')
      .update({ status: 'cancelled', completed_at: now })
      .eq('id', instanceId);
    if (instErr) throw instErr;

    const { error: pr1Err } = await db
      .from('pr1_requests')
      .update({ status: 'revision_requested', updated_at: now })
      .eq('id', pr1Id)
      .eq('status', 'pending_approval');
    if (pr1Err) throw pr1Err;
  }

  // 5. Audit log
  const auditAction =
    action === 'approved'
      ? isFinalStep
        ? 'PR1_APPROVAL_FINAL_APPROVED'
        : 'PR1_APPROVAL_STEP_APPROVED'
      : action === 'rejected'
      ? 'PR1_APPROVAL_REJECTED'
      : 'PR1_APPROVAL_REVISION_REQUESTED';

  await db.from('audit_logs').insert({
    actor_id:      profile.id,
    action:        auditAction,
    document_type: 'PR1',
    document_id:   pr1Id,
    payload: {
      instance_id:  instanceId,
      step_order:   stepOrder,
      action,
      remarks:      remarks.trim() || null,
      actor:        profile.full_name,
      position:     profile.position,
    },
  });

  // 6. Notifications (best-effort — must not fail the approval action)
  try {
    const { data: pr1Row } = await db
      .from('pr1_requests')
      .select('pr1_number, requisitioner_id, department_id')
      .eq('id', pr1Id)
      .maybeSingle();

    if (pr1Row) {
      if (action === 'approved') {
        if (isFinalStep) {
          await createNotification({
            user_id:       pr1Row.requisitioner_id,
            title:         'PR1 Approved',
            body:          `Your PR1 ${pr1Row.pr1_number} has been approved.`,
            type:          'approved',
            document_type: 'pr1',
            document_id:   pr1Id,
            action_url:    `/pr1/${pr1Id}`,
          });

          await notifyByRole(
            'warehouse',
            {
              title:         'PR1 Approved — Awaiting Warehouse Validation',
              body:          `PR1 ${pr1Row.pr1_number} has been approved and is ready for warehouse validation.`,
              type:          'action_required',
              document_type: 'pr1',
              document_id:   pr1Id,
              action_url:    `/warehouse/${pr1Id}`,
            },
            { dedupeUnreadForDocument: true }
          );
        } else {
          // Step advanced — notify the next step's approvers
          const { data: inst } = await db
            .from('approval_instances')
            .select('workflow_id')
            .eq('id', instanceId)
            .maybeSingle();

          if (inst?.workflow_id) {
            await notifyApproversForStep({
              workflowId:     inst.workflow_id,
              stepOrder:      stepOrder + 1,
              documentId:     pr1Id,
              documentNumber: pr1Row.pr1_number,
              instanceId,
              documentDepartmentId: pr1Row.department_id,
              directorPositions: DIRECTOR_POSITIONS,
            });
          }
        }
      } else if (action === 'rejected') {
        const trimmedRemark = remarks.trim();
        await createNotification({
          user_id:       pr1Row.requisitioner_id,
          title:         'PR1 Rejected',
          body:          trimmedRemark
            ? `Your PR1 ${pr1Row.pr1_number} was rejected. Reason: "${trimmedRemark}"`
            : `Your PR1 ${pr1Row.pr1_number} was rejected.`,
          type:          'rejected',
          document_type: 'pr1',
          document_id:   pr1Id,
          action_url:    `/pr1/${pr1Id}`,
        });
      } else {
        // revision_requested
        const trimmedRemark = remarks.trim();
        await createNotification({
          user_id:       pr1Row.requisitioner_id,
          title:         'PR1 Revision Requested',
          body:          trimmedRemark
            ? `Revision requested on PR1 ${pr1Row.pr1_number}. Reason: "${trimmedRemark}"`
            : `Revision requested on PR1 ${pr1Row.pr1_number}.`,
          type:          'action_required',
          document_type: 'pr1',
          document_id:   pr1Id,
          action_url:    `/pr1/${pr1Id}`,
        });
      }
    }
  } catch {
    // Notifications are best-effort; do not fail the approval action
  }
}

// ─── Dashboard stats ──────────────────────────────────────────────────────────

export async function fetchApproverStats(profileId: string): Promise<{
  awaitingAction: number;
  approvedThisWeek: number;
  rejectedThisWeek: number;
  totalProcessed: number;
}> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [queueRes, actionsRes] = await Promise.all([
    db
      .from('approval_instances')
      .select('id', { count: 'exact', head: true })
      .eq('document_type', 'PR1')
      .eq('status', 'active'),
    db
      .from('approval_actions')
      .select('action, acted_at')
      .eq('actor_id', profileId),
  ]);

  const queueCount = queueRes.count ?? 0;
  const actions: any[] = actionsRes.data ?? [];
  const recentActions = actions.filter((a) => a.acted_at >= weekAgo);
  const approvedThisWeek = recentActions.filter((a) => a.action === 'approved').length;
  const rejectedThisWeek = recentActions.filter((a) => a.action === 'rejected').length;

  return {
    awaitingAction:   queueCount,
    approvedThisWeek,
    rejectedThisWeek,
    totalProcessed:   actions.length,
  };
}
