import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/auth';
import type {
  PR2ApprovalQueueRow,
  PR2ApprovalDetail,
  ApprovalAction,
  ApprovalInstanceStatus,
} from '@/types/approvals';

const db = supabase as any;

// ─── Authority check ──────────────────────────────────────────────────────────
// PR2 steps span both 'approver' and 'procurement' roles.
// Title (position) must match exactly.

export function canActOnPR2Step(
  profile: UserProfile,
  stepRoleRequired: string,
  stepPositionRequired: string
): boolean {
  return profile.role === stepRoleRequired && profile.position === stepPositionRequired;
}

// ─── Submit PR2 for Phase 1 approval ─────────────────────────────────────────
// Creates the Phase 1 approval_instance and transitions PR2 to pending_phase1_approval.

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
  const { error: instErr } = await db
    .from('approval_instances')
    .insert({
      workflow_id:   wf.id,
      document_type: 'PR2',
      document_id:   pr2Id,
      current_step:  1,
      status:        'active',
      started_by:    profile.id,
      started_at:    now,
    });
  if (instErr) throw instErr;

  // Transition PR2 status
  const { error: updErr } = await db
    .from('pr2_requests')
    .update({ status: 'pending_phase1_approval', updated_at: now })
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
      .select('id, pr2_number, pr1_id, requisitioner_name_snapshot, department_name_snapshot, purpose, date_required, status')
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
    ? await db.from('pr1_requests').select('id, priority').in('id', pr1Ids)
    : { data: [] };
  const pr1PriorityMap: Record<string, string> = Object.fromEntries(
    ((pr1s ?? []) as any[]).map((pr1: any) => [pr1.id, pr1.priority])
  );

  return instances.flatMap((inst: any) => {
    const pr2  = pr2Map[inst.document_id];
    const wf   = workflowMap[inst.workflow_id];
    const step = steps.find(
      (s: any) => s.workflow_id === inst.workflow_id && s.step_order === inst.current_step
    );
    if (!pr2 || !step) return [];

    const pr1Priority = pr2.pr1_id ? pr1PriorityMap[pr2.pr1_id] : undefined;

    return [{
      pr2_id:                      pr2.id,
      pr2_number:                  pr2.pr2_number,
      requisitioner_name_snapshot: pr2.requisitioner_name_snapshot,
      department_name_snapshot:    pr2.department_name_snapshot,
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
      .select('id, pr2_number, pr1_number_snapshot, pr1_id, rfq_number_snapshot, requisitioner_name_snapshot, department_name_snapshot, purpose, date_required, status, generated_at, remarks')
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

  const phase1Inst = allInstances.find((i: any) => wfCodeMap[i.workflow_id] === 'PR2_PHASE1');
  const phase2Inst = allInstances.find((i: any) => wfCodeMap[i.workflow_id] === 'PR2_PHASE2');

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

  // Fetch PR2 items
  const { data: itemRows } = await db
    .from('pr2_items')
    .select('id, item_order, item_code, description, unit_of_measure, quantity_requested, qty_on_hand, qty_incoming, quantity_to_purchase, supplier_name_snapshot, unit_price, total_price, pr1_item_id')
    .eq('pr2_id', pr2.id)
    .order('item_order', { ascending: true });

  // Fetch PR1 priority from related PR1 record
  let pr1Priority: 'normal' | 'medium' | 'high' | undefined;
  if (pr2.pr1_id) {
    const { data: pr1Data } = await db
      .from('pr1_requests')
      .select('priority')
      .eq('id', pr2.pr1_id)
      .maybeSingle();
    if (pr1Data?.priority) {
      pr1Priority = pr1Data.priority as 'normal' | 'medium' | 'high';
    }
  }

  return {
    pr2_id:                      pr2.id,
    pr2_number:                  pr2.pr2_number,
    pr1_number_snapshot:         pr2.pr1_number_snapshot,
    rfq_number_snapshot:         pr2.rfq_number_snapshot,
    requisitioner_name_snapshot: pr2.requisitioner_name_snapshot,
    department_name_snapshot:    pr2.department_name_snapshot,
    purpose:                     pr2.purpose,
    date_required:               pr2.date_required,
    pr2_status:                  pr2.status,
    generated_at:                pr2.generated_at,
    remarks:                     pr2.remarks,
    pr1_priority:                pr1Priority,
    items:                       (itemRows ?? []).map((i: any) => ({
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

      if (workflowCode === 'PR2_PHASE1') {
        // Phase 1 fully approved → update PR2 status, start Phase 2
        await db
          .from('pr2_requests')
          .update({ status: 'phase1_approved', updated_at: now })
          .eq('id', pr2Id);

        await startPhase2(pr2Id, profile, now);
      } else {
        // Phase 2 fully approved → PR2 is done
        await db
          .from('pr2_requests')
          .update({ status: 'phase2_approved', updated_at: now })
          .eq('id', pr2Id);
      }
    } else {
      // Check for PR2_PHASE1 step 1 → auto-approve Department Head (step 2) if no alternatives
      if (workflowCode === 'PR2_PHASE1' && stepOrder === 1) {
        const { data: itemsWithAlts, error: altErr } = await db
          .from('pr2_items')
          .select('id')
          .eq('pr2_id', pr2Id)
          .eq('is_alternative', true)
          .limit(1);

        if (altErr) throw altErr;

        if (!itemsWithAlts || itemsWithAlts.length === 0) {
          // No alternatives: auto-approve Step 2 (Department Head)
          const autoApproveRemarks = 'Auto-approved: No supplier alternative items offered';
          const { error: autoActionErr } = await db
            .from('approval_actions')
            .insert({
              instance_id:               instanceId,
              step_order:                2,
              action:                    'approved',
              actor_id:                  profile.id,
              actor_name_snapshot:       'Department Head (auto)',
              actor_position_snapshot:   'Department Head',
              actor_department_snapshot: 'Auto',
              remarks:                   autoApproveRemarks,
              acted_at:                  now,
            });
          if (autoActionErr) throw autoActionErr;

          // Advance directly to step 3
          await db
            .from('approval_instances')
            .update({ current_step: 3 })
            .eq('id', instanceId);

          // Audit log for auto-approval
          await db.from('audit_logs').insert({
            actor_id:      profile.id,
            action:        'PR2_DEPT_HEAD_AUTO_APPROVED',
            document_type: 'PR2',
            document_id:   pr2Id,
            payload: {
              instance_id:   instanceId,
              step_order:    2,
              workflow_code: workflowCode,
              reason:        'No supplier alternatives offered',
              actor:         profile.full_name,
              position:      profile.position,
            },
          });

          // Early return to prevent normal advancement
          return;
        }
      }

      // Normal advancement to next step
      await db
        .from('approval_instances')
        .update({ current_step: stepOrder + 1 })
        .eq('id', instanceId);
      // PR2 status unchanged (still pending_phaseX_approval)
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
        ? workflowCode === 'PR2_PHASE1'
          ? 'PR2_PHASE1_APPROVED'
          : 'PR2_PHASE2_APPROVED'
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
}

// ─── Internal: start Phase 2 immediately after Phase 1 completes ─────────────

async function startPhase2(pr2Id: string, profile: UserProfile, now: string): Promise<void> {
  const { data: wf, error: wfErr } = await db
    .from('approval_workflows')
    .select('id')
    .eq('code', 'PR2_PHASE2')
    .maybeSingle();
  if (wfErr) throw wfErr;
  if (!wf) throw new Error('PR2_PHASE2 workflow not configured.');

  const { error: instErr } = await db
    .from('approval_instances')
    .insert({
      workflow_id:   wf.id,
      document_type: 'PR2',
      document_id:   pr2Id,
      current_step:  1,
      status:        'active',
      started_by:    profile.id,
      started_at:    now,
    });
  if (instErr) throw instErr;

  await db
    .from('pr2_requests')
    .update({ status: 'pending_phase2_approval', updated_at: now })
    .eq('id', pr2Id);
}
