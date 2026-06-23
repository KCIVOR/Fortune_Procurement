import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/auth';
import type {
  PR2ApprovalQueueRow,
  PR2ApprovalDetail,
  ApprovalAction,
  ApprovalInstanceStatus,
} from '@/types/approvals';
import { createNotification, notifyApproversForStep } from '@/lib/notifications';
import { fetchRfqQuoteAttachmentsByRfq } from '@/lib/canvassing';
import type { RfqQuoteAttachment } from '@/types/canvassing';

const db = supabase as any;

// ─── Authority check ──────────────────────────────────────────────────────────
// PR2 steps span both 'approver' and 'procurement' roles.
// Title (position) must match exactly.

const DIRECTOR_POSITIONS = ['Director', 'Finance Director'] as const;

export function canActOnPR2Step(
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
  if (
    stepRoleRequired === 'approver' &&
    documentDepartmentId &&
    !(DIRECTOR_POSITIONS as readonly string[]).includes(profile.position) &&
    profile.department_id !== documentDepartmentId
  ) return false;
  return true;
}

// ─── Submit PR2 for approval ──────────────────────────────────────────────────
// Creates the approval_instance and transitions PR2 to pending_approval.

export async function submitPR2ForApproval(
  pr2Id: string,
  profile: UserProfile
): Promise<void> {
  const now = new Date().toISOString();

  // Guard: must be in draft
  const { data: pr2, error: pr2Err } = await db
    .from('pr2_requests')
    .select('id, status, pr2_number')
    .eq('id', pr2Id)
    .maybeSingle();
  if (pr2Err) throw pr2Err;
  if (!pr2) throw new Error('PR2 not found.');
  if (pr2.status !== 'draft') throw new Error('Only draft PR2s can be submitted for approval.');

  // Guard: no existing active Phase 1 instance
  const { data: existing } = await db
    .from('approval_instances')
    .select('id')
    .eq('document_type', 'PR2')
    .eq('document_id', pr2Id)
    .eq('status', 'active')
    .maybeSingle();
  if (existing?.id) throw new Error('An active approval instance already exists for this PR2.');

  // Fetch PR2_PHASE1 workflow id
  const { data: wf, error: wfErr } = await db
    .from('approval_workflows')
    .select('id')
    .eq('code', 'PR2_PHASE1')
    .maybeSingle();
  if (wfErr) throw wfErr;
  if (!wf) throw new Error('PR2_PHASE1 workflow not configured.');

  // Create Phase 1 instance starting at step 1
  const { data: newInst, error: instErr } = await db
    .from('approval_instances')
    .insert({
      workflow_id:   wf.id,
      document_type: 'PR2',
      document_id:   pr2Id,
      current_step:  1,
      status:        'active',
      started_by:    profile.id,
      started_at:    now,
    })
    .select('id')
    .single();
  if (instErr) throw instErr;

  // Transition PR2 status
  const { error: updErr } = await db
    .from('pr2_requests')
    .update({ status: 'pending_approval', updated_at: now })
    .eq('id', pr2Id)
    .eq('status', 'draft');
  if (updErr) throw updErr;

  await db.from('audit_logs').insert({
    actor_id:      profile.id,
    action:        'PR2_SUBMITTED_FOR_APPROVAL',
    document_type: 'PR2',
    document_id:   pr2Id,
    payload:       { pr2_number: pr2.pr2_number, submitted_by: profile.full_name },
  });

  // Notify phase1 step 1 approvers (best-effort)
  if (newInst?.id) {
    try {
      await notifyApproversForStep({
        workflowId:     wf.id,
        stepOrder:      1,
        documentId:     pr2Id,
        documentNumber: pr2.pr2_number,
        instanceId:     newInst.id,
        title:          'PR2 Approval Required',
        body:           'PR2 requires your approval.',
        documentType:   'pr2',
        actionUrl:      `/approvals/pr2/${newInst.id}`,
      });
    } catch {
      // Notifications are best-effort; do not fail submission
    }
  }
}

// ─── Fetch PR2 approval queue ─────────────────────────────────────────────────

export async function fetchPR2ApprovalQueue(): Promise<PR2ApprovalQueueRow[]> {
  const { data: instances, error: instErr } = await db
    .from('approval_instances')
    .select('id, workflow_id, document_id, current_step, status, started_at')
    .eq('document_type', 'PR2')
    .eq('status', 'active')
    .order('started_at', { ascending: true });

  if (instErr) throw instErr;
  if (!instances || instances.length === 0) return [];

  const pr2Ids      = Array.from(new Set(instances.map((r: any) => r.document_id as string)));
  const workflowIds = Array.from(new Set(instances.map((r: any) => r.workflow_id as string)));

  const [pr2Res, workflowRes, stepsRes] = await Promise.all([
    db.from('pr2_requests')
      .select('id, pr2_number, pr1_id, requisitioner_name_snapshot, department_name_snapshot, department_id, purpose, date_required, status')
      .in('id', pr2Ids),
    db.from('approval_workflows')
      .select('id, code')
      .in('id', workflowIds),
    db.from('approval_steps')
      .select('workflow_id, step_order, role_required, position_required, action_label, is_final')
      .in('workflow_id', workflowIds),
  ]);

  if (pr2Res.error) throw pr2Res.error;
  if (stepsRes.error) throw stepsRes.error;

  const pr2Map:      Record<string, any> = Object.fromEntries((pr2Res.data ?? []).map((r: any) => [r.id, r]));
  const workflowMap: Record<string, any> = Object.fromEntries((workflowRes.data ?? []).map((r: any) => [r.id, r]));
  const steps: any[] = stepsRes.data ?? [];

  // Fetch PR1 priorities for all PR2 records
  const pr1Ids = Array.from(new Set(
    (pr2Res.data ?? []).map((pr2: any) => pr2.pr1_id).filter(Boolean)
  ));
  const { data: pr1s } = pr1Ids.length > 0
    ? await db.from('pr1_requests').select('id, priority, request_type').in('id', pr1Ids)
    : { data: [] };
  const pr1PriorityMap: Record<string, string> = Object.fromEntries(
    ((pr1s ?? []) as any[]).map((pr1: any) => [pr1.id, pr1.priority])
  );
  const pr1TypeMap: Record<string, 'goods' | 'services'> = Object.fromEntries(
    ((pr1s ?? []) as any[]).map((pr1: any) => [pr1.id, pr1.request_type ?? 'goods'])
  );

  return instances.flatMap((inst: any) => {
    const pr2  = pr2Map[inst.document_id];
    const wf   = workflowMap[inst.workflow_id];
    const step = steps.find(
      (s: any) => s.workflow_id === inst.workflow_id && s.step_order === inst.current_step
    );
    if (!pr2 || !step) return [];

    const pr1Priority    = pr2.pr1_id ? pr1PriorityMap[pr2.pr1_id] : undefined;
    const pr1RequestType = pr2.pr1_id ? pr1TypeMap[pr2.pr1_id]    : undefined;

    return [{
      pr2_id:                      pr2.id,
      pr2_number:                  pr2.pr2_number,
      requisitioner_name_snapshot: pr2.requisitioner_name_snapshot,
      department_name_snapshot:    pr2.department_name_snapshot,
      department_id:               pr2.department_id ?? null,
      purpose:                     pr2.purpose,
      date_required:               pr2.date_required,
      pr2_status:                  pr2.status,
      instance_id:                 inst.id,
      workflow_code:               wf?.code ?? '',
      current_step:                inst.current_step,
      instance_status:             inst.status as ApprovalInstanceStatus,
      started_at:                  inst.started_at,
      step_position_required:      step.position_required,
      step_role_required:          step.role_required,
      step_action_label:           step.action_label,
      step_is_final:               step.is_final,
      pr1_priority:                pr1Priority as 'normal' | 'medium' | 'high' | undefined,
      request_type:                pr1RequestType,
    }] as PR2ApprovalQueueRow[];
  });
}

// ─── Fetch PR2 approval detail ────────────────────────────────────────────────

export async function fetchPR2ApprovalDetail(
  instanceId: string
): Promise<PR2ApprovalDetail | null> {
  const { data: inst, error: instErr } = await db
    .from('approval_instances')
    .select('id, workflow_id, document_id, current_step, status, started_at')
    .eq('id', instanceId)
    .maybeSingle();

  if (instErr) throw instErr;
  if (!inst) return null;
  if (inst.document_type !== 'PR2') {
    // allow lookup even if document_type isn't explicit in select
  }

  const [pr2Res, wfRes, stepsRes, actionsRes] = await Promise.all([
    db.from('pr2_requests')
      .select('id, pr2_number, pr1_number_snapshot, pr1_id, rfq_id, rfq_number_snapshot, requisitioner_name_snapshot, department_name_snapshot, department_id, purpose, date_required, status, generated_at, remarks')
      .eq('id', inst.document_id)
      .maybeSingle(),
    db.from('approval_workflows').select('id, code').eq('id', inst.workflow_id).maybeSingle(),
    db.from('approval_steps')
      .select('step_order, role_required, position_required, action_label, is_final')
      .eq('workflow_id', inst.workflow_id)
      .order('step_order', { ascending: true }),
    db.from('approval_actions')
      .select('id, instance_id, step_order, action, actor_id, actor_name_snapshot, actor_position_snapshot, actor_department_snapshot, remarks, acted_at')
      .eq('instance_id', instanceId)
      .order('acted_at', { ascending: true }),
  ]);

  if (pr2Res.error) throw pr2Res.error;
  if (!pr2Res.data) return null;

  const pr2     = pr2Res.data;
  const wf      = wfRes.data;
  const steps   = stepsRes.data ?? [];
  const actions = actionsRes.data ?? [];

  // Determine which phase this instance belongs to
  const workflowCode: string = wf?.code ?? '';
  const isPhase1 = workflowCode === 'PR2_PHASE1';

  // Fetch the other phase instance if needed
  let allInstances: any[] = [];
  const { data: relatedInstances } = await db
    .from('approval_instances')
    .select('id, workflow_id, current_step, status, started_at')
    .eq('document_type', 'PR2')
    .eq('document_id', inst.document_id)
    .order('started_at', { ascending: true });
  allInstances = relatedInstances ?? [];

  // Separate phase instances
  const { data: workflows } = await db
    .from('approval_workflows')
    .select('id, code')
    .in('id', allInstances.map((i: any) => i.workflow_id));
  const wfCodeMap: Record<string, string> = Object.fromEntries(
    ((workflows ?? []) as any[]).map((w: any) => [w.id, w.code])
  );

  const pickLatestByWorkflow = (code: string) => {
    const candidates = allInstances.filter((i: any) => wfCodeMap[i.workflow_id] === code);
    if (candidates.length === 0) return undefined;
    return [...candidates].sort(
      (a: any, b: any) =>
        new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
    )[0];
  };

  const phase1Inst = pickLatestByWorkflow('PR2_PHASE1');
  const phase2Inst = pickLatestByWorkflow('PR2_PHASE2');

  // Fetch steps + actions for both phases
  const phaseWfIds = [phase1Inst?.workflow_id, phase2Inst?.workflow_id].filter(Boolean);
  const phaseInstIds = [phase1Inst?.id, phase2Inst?.id].filter(Boolean);

  const [allStepsRes, allActionsRes] = await Promise.all([
    phaseWfIds.length > 0
      ? db.from('approval_steps')
          .select('workflow_id, step_order, role_required, position_required, action_label, is_final')
          .in('workflow_id', phaseWfIds)
          .order('step_order', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    phaseInstIds.length > 0
      ? db.from('approval_actions')
          .select('id, instance_id, step_order, action, actor_id, actor_name_snapshot, actor_position_snapshot, actor_department_snapshot, remarks, acted_at')
          .in('instance_id', phaseInstIds)
          .order('acted_at', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const allSteps: any[]   = allStepsRes.data ?? [];
  const allActions: any[] = allActionsRes.data ?? [];

  const phase1Steps   = allSteps.filter((s: any) => s.workflow_id === phase1Inst?.workflow_id);
  const phase1Actions = allActions.filter((a: any) => a.instance_id === phase1Inst?.id);
  const phase2Steps   = allSteps.filter((s: any) => s.workflow_id === phase2Inst?.workflow_id);
  const phase2Actions = allActions.filter((a: any) => a.instance_id === phase2Inst?.id);

  // The "active" instance is the one with status = active (only one at a time)
  const activeInst = allInstances.find((i: any) => i.status === 'active') ?? null;
  const activeWfCode = activeInst ? (wfCodeMap[activeInst.workflow_id] ?? null) : null;
  const activeSteps = activeInst
    ? allSteps.filter((s: any) => s.workflow_id === activeInst.workflow_id)
    : [];

  // Fetch PR2 items (include rfq_item_quote_id for quote attachment lookup)
  const [itemRowsRes, pr1Res] = await Promise.all([
    db.from('pr2_items')
      .select('id, item_order, item_code, description, unit_of_measure, quantity_requested, qty_on_hand, qty_incoming, quantity_to_purchase, supplier_name_snapshot, unit_price, total_price, pr1_item_id, is_raw_material, quote_justification, rfq_item_quote_id')
      .eq('pr2_id', pr2.id)
      .order('item_order', { ascending: true }),
    pr2.pr1_id
      ? db.from('pr1_requests').select('priority, request_type').eq('id', pr2.pr1_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const itemRows = itemRowsRes.data ?? [];

  // Batch-fetch quote attachments by RFQ id (pr2.rfq_id is on the pr2_requests row)
  const rfqId: string | null = (pr2 as any).rfq_id ?? null;
  const quoteAttachmentsByQuote: Record<string, RfqQuoteAttachment[]> = rfqId
    ? await fetchRfqQuoteAttachmentsByRfq(rfqId).catch(() => ({}))
    : {};

  // Fetch PR1 priority and request_type from related PR1 record
  let pr1Priority: 'normal' | 'medium' | 'high' | undefined;
  if (pr1Res.data?.priority) {
    pr1Priority = pr1Res.data.priority as 'normal' | 'medium' | 'high';
  }
  const pr1RequestType: 'goods' | 'services' = (pr1Res.data as any)?.request_type ?? 'goods';

  return {
    pr2_id:                      pr2.id,
    pr2_number:                  pr2.pr2_number,
    pr1_number_snapshot:         pr2.pr1_number_snapshot,
    rfq_number_snapshot:         pr2.rfq_number_snapshot,
    requisitioner_name_snapshot: pr2.requisitioner_name_snapshot,
    department_name_snapshot:    pr2.department_name_snapshot,
    department_id:               pr2.department_id ?? null,
    purpose:                     pr2.purpose,
    date_required:               pr2.date_required,
    pr2_status:                  pr2.status,
    generated_at:                pr2.generated_at,
    remarks:                     pr2.remarks,
    pr1_priority:                pr1Priority,
    request_type:                pr1RequestType,
    items:                       (itemRows as any[]).map((i: any) => ({
      id:                   i.id,
      item_order:           i.item_order,
      item_code:            i.item_code,
      description:          i.description,
      unit_of_measure:      i.unit_of_measure,
      quantity_requested:   Number(i.quantity_requested),
      qty_on_hand:          Number(i.qty_on_hand),
      qty_incoming:         Number(i.qty_incoming),
      quantity_to_purchase: Number(i.quantity_to_purchase),
      supplier_name_snapshot: i.supplier_name_snapshot,
      unit_price:           Number(i.unit_price),
      total_price:          Number(i.total_price),
      pr1_item_id:          i.pr1_item_id,
      is_raw_material:      i.is_raw_material === true,
      quote_justification:  i.quote_justification ?? null,
      quote_attachments:    i.rfq_item_quote_id ? (quoteAttachmentsByQuote[i.rfq_item_quote_id] ?? []) : [],
    })),
    phase1_instance_id:     phase1Inst?.id ?? inst.id,
    phase1_workflow_id:     phase1Inst?.workflow_id ?? inst.workflow_id,
    phase1_current_step:    phase1Inst?.current_step ?? inst.current_step,
    phase1_instance_status: (phase1Inst?.status ?? inst.status) as ApprovalInstanceStatus,
    phase1_steps:           phase1Steps.length > 0 ? phase1Steps : steps,
    phase1_actions:         phase1Actions.length > 0 ? phase1Actions : actions,
    phase2_instance_id:     phase2Inst?.id ?? null,
    phase2_workflow_id:     phase2Inst?.workflow_id ?? null,
    phase2_current_step:    phase2Inst?.current_step ?? null,
    phase2_instance_status: (phase2Inst?.status ?? null) as ApprovalInstanceStatus | null,
    phase2_steps:           phase2Steps,
    phase2_actions:         phase2Actions,
    active_instance_id:     activeInst?.id ?? null,
    active_workflow_code:   activeWfCode,
    active_current_step:    activeInst?.current_step ?? null,
    active_instance_status: (activeInst?.status ?? null) as ApprovalInstanceStatus | null,
    active_steps:           activeSteps,
  };
}

/** Latest PR2 approval instance by started_at, then full merged phase detail (read-only). */
export async function fetchPR2ApprovalDetailByPR2Id(
  pr2Id: string
): Promise<PR2ApprovalDetail | null> {
  const { data: inst, error } = await db
    .from('approval_instances')
    .select('id')
    .eq('document_type', 'PR2')
    .eq('document_id', pr2Id)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!inst?.id) return null;
  return fetchPR2ApprovalDetail(inst.id);
}

// ─── Submit PR2 approval action ───────────────────────────────────────────────

export async function submitPR2ApprovalAction(
  instanceId:  string,
  pr2Id:       string,
  stepOrder:   number,
  isFinalStep: boolean,
  workflowCode: string,
  action:      ApprovalAction,
  remarks:     string,
  profile:     UserProfile
): Promise<void> {
  const now = new Date().toISOString();

  // 1. Record the approval action snapshot
  const { error: actionErr } = await db
    .from('approval_actions')
    .insert({
      instance_id:               instanceId,
      step_order:                stepOrder,
      action,
      actor_id:                  profile.id,
      actor_name_snapshot:       profile.full_name,
      actor_position_snapshot:   profile.position,
      actor_department_snapshot: profile.department,
      remarks:                   remarks.trim() || null,
      acted_at:                  now,
    });
  if (actionErr) throw actionErr;

  if (action === 'approved') {
    if (isFinalStep) {
      // Close this instance
      await db
        .from('approval_instances')
        .update({ status: 'approved', completed_at: now })
        .eq('id', instanceId);

      // Single-phase: Director approval completes PR2
      await db
        .from('pr2_requests')
        .update({ status: 'approved', updated_at: now })
        .eq('id', pr2Id);
    } else {
      // Normal advancement to next step.
      // Note: PR2_PHASE1 Department Head auto-approval was removed when
      // the Department Head step itself was removed from the workflow
      // (migration 20260526120000_remove_pr2_phase1_dept_head.sql).
      await db
        .from('approval_instances')
        .update({ current_step: stepOrder + 1 })
        .eq('id', instanceId);
      // PR2 status unchanged (still pending_approval)
    }
  } else if (action === 'rejected') {
    await db
      .from('approval_instances')
      .update({ status: 'rejected', completed_at: now })
      .eq('id', instanceId);

    // Return PR2 to draft for procurement revision
    await db
      .from('pr2_requests')
      .update({ status: 'draft', updated_at: now })
      .eq('id', pr2Id);
  } else {
    // revision_requested — same as rejected: back to draft
    await db
      .from('approval_instances')
      .update({ status: 'cancelled', completed_at: now })
      .eq('id', instanceId);

    await db
      .from('pr2_requests')
      .update({ status: 'draft', updated_at: now })
      .eq('id', pr2Id);
  }

  // Audit log
  const auditAction =
    action === 'approved'
      ? isFinalStep
        ? 'PR2_APPROVED'
        : 'PR2_APPROVAL_STEP_APPROVED'
      : action === 'rejected'
      ? 'PR2_APPROVAL_REJECTED'
      : 'PR2_APPROVAL_REVISION_REQUESTED';

  await db.from('audit_logs').insert({
    actor_id:      profile.id,
    action:        auditAction,
    document_type: 'PR2',
    document_id:   pr2Id,
    payload: {
      instance_id:   instanceId,
      step_order:    stepOrder,
      workflow_code: workflowCode,
      action,
      remarks:       remarks.trim() || null,
      actor:         profile.full_name,
      position:      profile.position,
    },
  });

  // Notifications (best-effort — must not fail the approval action)
  try {
    if (action === 'approved') {
      if (isFinalStep) {
        // Final approved → notify requisitioner
        const { data: pr2Row } = await db
          .from('pr2_requests')
          .select('pr2_number, requisitioner_id')
          .eq('id', pr2Id)
          .maybeSingle();
        if (pr2Row?.requisitioner_id) {
          await createNotification({
            user_id:       pr2Row.requisitioner_id,
            title:         'PR2 Approved',
            body:          'Your request has been fully approved.',
            type:          'approved',
            document_type: 'pr2',
            document_id:   pr2Id,
            action_url:    `/pr2/${pr2Id}`,
          });
        }
      } else {
        // Normal step advance (auto dept-head already returned early)
        const [instData, pr2Data] = await Promise.all([
          db.from('approval_instances').select('workflow_id').eq('id', instanceId).maybeSingle(),
          db.from('pr2_requests').select('pr2_number').eq('id', pr2Id).maybeSingle(),
        ]);
        if (instData.data?.workflow_id && pr2Data.data?.pr2_number) {
          await notifyApproversForStep({
            workflowId:     instData.data.workflow_id,
            stepOrder:      stepOrder + 1,
            documentId:     pr2Id,
            documentNumber: pr2Data.data.pr2_number,
            instanceId,
            title:          'PR2 Approval Required',
            body:           'PR2 requires your approval.',
            documentType:   'pr2',
            actionUrl:      `/approvals/pr2/${instanceId}`,
          });
        }
      }
    } else {
      // rejected or revision_requested → notify the person who submitted PR2 for approval
      const [instData, pr2Data] = await Promise.all([
        db.from('approval_instances').select('started_by').eq('id', instanceId).maybeSingle(),
        db.from('pr2_requests').select('pr2_number').eq('id', pr2Id).maybeSingle(),
      ]);
      if (instData.data?.started_by && pr2Data.data?.pr2_number) {
        await createNotification({
          user_id:       instData.data.started_by,
          title:         action === 'rejected' ? 'PR2 Rejected' : 'PR2 Revision Requested',
          body:          action === 'rejected'
            ? `PR2 ${pr2Data.data.pr2_number} was rejected.`
            : `Revision requested on PR2 ${pr2Data.data.pr2_number}.`,
          type:          action === 'rejected' ? 'rejected' : 'action_required',
          document_type: 'pr2',
          document_id:   pr2Id,
          action_url:    `/pr2/${pr2Id}`,
        });
      }
    }
  } catch {
    // Notifications are best-effort; do not fail the approval action
  }
}

