import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/auth';
import type { ApprovalAction, ApprovalInstanceStatus, WorkflowStep, ApprovalActionRecord, PR2ApprovalQueueRow } from '@/types/approvals';
import { createNotification, notifyApproversForStep, notifyByRole } from '@/lib/notifications';
import { resolvePR2RequestType } from '@/lib/pr2-classification';

const db = supabase as any;

const DIRECTOR_POSITIONS = ['Director', 'Finance Director'] as const;

/** Unified PR2 page URL for RFQ canvassing review / approval (Goods workflow). */
export function getRfqApprovalPr2Url(pr2Id: string, instanceId?: string): string {
  const base = `/pr2/${pr2Id}`;
  return instanceId ? `${base}?rfqApproval=${instanceId}` : base;
}

export function canActOnRfqStep(
  profile: UserProfile,
  stepRoleRequired: string,
  stepPositionRequired: string,
  documentDepartmentId?: string | null,
): boolean {
  const isCorrectRole =
    profile.role === stepRoleRequired ||
    ((profile.role === 'approver' || profile.role === 'procurement') &&
      (stepRoleRequired === 'approver' || stepRoleRequired === 'procurement'));
  const isCorrectPosition =
    profile.position === stepPositionRequired ||
    (stepPositionRequired === 'Procurement Staff' && profile.position === 'Procurement Manager');
  if (!isCorrectRole || !isCorrectPosition) return false;
  if (
    stepRoleRequired === 'approver' &&
    documentDepartmentId &&
    !(DIRECTOR_POSITIONS as readonly string[]).includes(profile.position) &&
    profile.department_id !== documentDepartmentId
  ) {
    return false;
  }
  return true;
}

/** Active RFQ canvassing approvals surfaced on the PR2 Requests queue (Goods continuation). */
export async function fetchRfqCanvassingApprovalQueue(): Promise<PR2ApprovalQueueRow[]> {
  const { data: instances, error: instErr } = await db
    .from('approval_instances')
    .select('id, workflow_id, document_id, current_step, status, started_at')
    .eq('document_type', 'RFQ')
    .eq('status', 'active')
    .order('started_at', { ascending: true });

  if (instErr) throw instErr;
  if (!instances?.length) return [];

  const rfqIds = Array.from(new Set(instances.map((r: { document_id: string }) => r.document_id)));
  const workflowIds = Array.from(new Set(instances.map((r: { workflow_id: string }) => r.workflow_id)));

  const [rfqRes, workflowRes, stepsRes] = await Promise.all([
    db.from('rfq_batches').select('id, rfq_number, pr1_id, pr2_id').in('id', rfqIds),
    db.from('approval_workflows').select('id, code').in('id', workflowIds),
    db.from('approval_steps')
      .select('workflow_id, step_order, role_required, position_required, action_label, is_final')
      .in('workflow_id', workflowIds),
  ]);

  if (rfqRes.error) throw rfqRes.error;
  if (stepsRes.error) throw stepsRes.error;

  const rfqMap = Object.fromEntries((rfqRes.data ?? []).map((r: { id: string }) => [r.id, r]));
  const workflowMap = Object.fromEntries((workflowRes.data ?? []).map((r: { id: string }) => [r.id, r]));
  const steps: {
    workflow_id: string;
    step_order: number;
    role_required: string;
    position_required: string;
    action_label: string;
    is_final: boolean;
  }[] = stepsRes.data ?? [];

  const pr2Ids = Array.from(
    new Set((rfqRes.data ?? []).map((r: { pr2_id: string | null }) => r.pr2_id).filter(Boolean)),
  ) as string[];

  const { data: pr2s, error: pr2Err } = pr2Ids.length
    ? await db.from('pr2_requests')
        .select('id, pr2_number, pr1_id, request_type, requisitioner_name_snapshot, department_name_snapshot, department_id, purpose, date_required, status')
        .in('id', pr2Ids)
    : { data: [], error: null };
  if (pr2Err) throw pr2Err;

  const pr2Map = Object.fromEntries((pr2s ?? []).map((r: { id: string }) => [r.id, r]));

  const pr1Ids = Array.from(
    new Set((pr2s ?? []).map((p: { pr1_id: string | null }) => p.pr1_id).filter(Boolean)),
  ) as string[];
  const { data: pr1s } = pr1Ids.length
    ? await db.from('pr1_requests').select('id, priority, request_type').in('id', pr1Ids)
    : { data: [] };
  const pr1PriorityMap: Record<string, string> = Object.fromEntries(
    ((pr1s ?? []) as { id: string; priority: string }[]).map(p => [p.id, p.priority]),
  );
  const pr1TypeMap: Record<string, 'goods' | 'services'> = Object.fromEntries(
    ((pr1s ?? []) as { id: string; request_type: string }[]).map(p => [
      p.id,
      (p.request_type ?? 'goods') as 'goods' | 'services',
    ]),
  );

  return instances.flatMap((inst: {
    id: string;
    workflow_id: string;
    document_id: string;
    current_step: number;
    status: string;
    started_at: string;
  }) => {
    const rfq = rfqMap[inst.document_id];
    const pr2 = rfq?.pr2_id ? pr2Map[rfq.pr2_id] : null;
    const wf = workflowMap[inst.workflow_id];
    const step = steps.find(s => s.workflow_id === inst.workflow_id && s.step_order === inst.current_step);
    if (!rfq || !pr2 || !step) return [];

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
      workflow_code:               wf?.code ?? 'RFQ_APPROVAL',
      current_step:                inst.current_step,
      instance_status:             inst.status as ApprovalInstanceStatus,
      started_at:                  inst.started_at,
      step_position_required:      step.position_required,
      step_role_required:          step.role_required,
      step_action_label:           step.action_label,
      step_is_final:               step.is_final,
      pr1_priority:                pr2.pr1_id ? pr1PriorityMap[pr2.pr1_id] as 'normal' | 'medium' | 'high' : undefined,
      request_type:                resolvePR2RequestType(pr2, pr2.pr1_id ? { request_type: pr1TypeMap[pr2.pr1_id] } : null),
    }];
  });
}

/** Review URL for a row on the unified PR2 Requests queue. */
export function getPr2QueueReviewUrl(row: Pick<PR2ApprovalQueueRow, 'workflow_code' | 'pr2_id' | 'instance_id'>): string {
  if (row.workflow_code === 'RFQ_APPROVAL') {
    return getRfqApprovalPr2Url(row.pr2_id, row.instance_id);
  }
  return `/approvals/pr2/${row.instance_id}`;
}

export async function fetchRfqApprovalInstanceForRfq(
  rfqId: string,
): Promise<{ id: string; status: ApprovalInstanceStatus; current_step: number } | null> {
  const { data, error } = await db
    .from('approval_instances')
    .select('id, status, current_step')
    .eq('document_type', 'RFQ')
    .eq('document_id', rfqId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function submitRfqForApproval(
  rfqId: string,
  profile: UserProfile,
): Promise<void> {
  const now = new Date().toISOString();

  const { data: rfq, error: rfqErr } = await db
    .from('rfq_batches')
    .select('id, rfq_number, status, pr1_id, pr2_id')
    .eq('id', rfqId)
    .maybeSingle();
  if (rfqErr) throw rfqErr;
  if (!rfq) throw new Error('RFQ not found.');
  if (rfq.status !== 'closed') {
    throw new Error('RFQ must be closed before submitting for approval.');
  }

  const { data: existing } = await db
    .from('approval_instances')
    .select('id, status')
    .eq('document_type', 'RFQ')
    .eq('document_id', rfqId)
    .eq('status', 'active')
    .maybeSingle();
  if (existing?.id) throw new Error('An active RFQ approval instance already exists.');

  const { data: wf, error: wfErr } = await db
    .from('approval_workflows')
    .select('id')
    .eq('code', 'RFQ_APPROVAL')
    .maybeSingle();
  if (wfErr) throw wfErr;
  if (!wf) throw new Error('RFQ_APPROVAL workflow not configured.');

  const { data: newInst, error: instErr } = await db
    .from('approval_instances')
    .insert({
      workflow_id:   wf.id,
      document_type: 'RFQ',
      document_id:   rfqId,
      current_step:  1,
      status:        'active',
      started_by:    profile.id,
      started_at:    now,
    })
    .select('id')
    .single();
  if (instErr) throw instErr;

  await db.from('audit_logs').insert({
    actor_id:      profile.id,
    action:        'RFQ_SUBMITTED_FOR_APPROVAL',
    document_type: 'RFQ',
    document_id:   rfqId,
    payload:       { rfq_number: rfq.rfq_number, submitted_by: profile.full_name },
  });

  if (newInst?.id) {
    try {
      await notifyApproversForStep({
        workflowId:     wf.id,
        stepOrder:      1,
        documentId:     rfqId,
        documentNumber: rfq.rfq_number,
        instanceId:     newInst.id,
        title:          'RFQ Approval Required',
        body:           'RFQ requires your review.',
        documentType:   'rfq',
        actionUrl:      rfq.pr2_id
          ? getRfqApprovalPr2Url(rfq.pr2_id, newInst.id)
          : '/approvals/pr2',
      });
    } catch {
      // best-effort
    }
  }
}

export async function fetchRfqApprovalDetail(instanceId: string) {
  const { data: inst, error: instErr } = await db
    .from('approval_instances')
    .select('id, workflow_id, document_id, current_step, status, started_at, started_by')
    .eq('id', instanceId)
    .maybeSingle();
  if (instErr) throw instErr;
  if (!inst) return null;

  const [rfqRes, wfRes, stepsRes, actionsRes] = await Promise.all([
    db.from('rfq_batches')
      .select('id, rfq_number, pr1_id, pr2_id, status, deadline, notes')
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

  if (rfqRes.error) throw rfqRes.error;
  if (!rfqRes.data) return null;

  const rfq = rfqRes.data;
  const [pr1Res, pr2Res, starterRes] = await Promise.all([
    rfq.pr1_id
      ? db.from('pr1_requests')
          .select('id, pr1_number, request_type, requisitioner_name_snapshot, department_name_snapshot, department_id, purpose, date_required, priority')
          .eq('id', rfq.pr1_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    rfq.pr2_id
      ? db.from('pr2_requests')
          .select('id, pr2_number, status, request_type, requisitioner_name_snapshot, department_name_snapshot, department_id, purpose, date_required')
          .eq('id', rfq.pr2_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    inst.started_by
      ? db.from('profiles').select('full_name, positions(title)').eq('id', inst.started_by).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Phase 3 (Raw Mats): a raw-material RFQ has no pr1_id — fall back to the
  // linked pr2_requests row for header display fields.
  const pr1Data = pr1Res.data as any;
  const pr2Data = pr2Res.data as any;
  const requestType = resolvePR2RequestType(
    { request_type: pr2Data?.request_type ?? null, pr1_id: rfq.pr1_id },
    pr1Data ? { request_type: pr1Data.request_type } : null,
  );

  const starter = starterRes.data as { full_name?: string; positions?: { title?: string } | null } | null;
  const preparer =
    starter?.full_name && inst.started_at
      ? {
          position: starter.positions?.title?.trim() || 'Procurement Staff',
          actionLabel: 'Closed By',
          statusLabel: 'Closed',
          actorName: starter.full_name,
          actedAt: inst.started_at,
        }
      : null;

  return {
    rfq_id:                      rfq.id,
    rfq_number:                  rfq.rfq_number,
    rfq_status:                  rfq.status,
    pr1_id:                      rfq.pr1_id,
    pr1_number:                  pr1Data?.pr1_number ?? pr2Data?.pr2_number ?? '',
    request_type:                requestType,
    requisitioner_name_snapshot: pr1Data?.requisitioner_name_snapshot ?? pr2Data?.requisitioner_name_snapshot ?? '',
    department_name_snapshot:    pr1Data?.department_name_snapshot ?? pr2Data?.department_name_snapshot ?? '',
    department_id:               pr1Data?.department_id ?? pr2Data?.department_id ?? null,
    purpose:                     pr1Data?.purpose ?? pr2Data?.purpose ?? '',
    date_required:               pr1Data?.date_required ?? pr2Data?.date_required ?? '',
    pr1_priority:                pr1Data?.priority as 'normal' | 'medium' | 'high' | undefined,
    pr2_id:                      pr2Data?.id ?? rfq.pr2_id ?? null,
    pr2_number:                  pr2Data?.pr2_number ?? null,
    pr2_status:                  pr2Data?.status ?? null,
    instance_id:                 inst.id,
    workflow_code:               wfRes.data?.code ?? 'RFQ_APPROVAL',
    current_step:                inst.current_step,
    instance_status:             inst.status as ApprovalInstanceStatus,
    started_at:                  inst.started_at,
    steps:                       (stepsRes.data ?? []) as WorkflowStep[],
    actions:                     (actionsRes.data ?? []) as ApprovalActionRecord[],
    preparer,
  };
}

export async function submitRfqApprovalAction(
  instanceId: string,
  rfqId: string,
  stepOrder: number,
  isFinalStep: boolean,
  action: ApprovalAction,
  remarks: string,
  profile: UserProfile,
): Promise<void> {
  const now = new Date().toISOString();

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

  const { data: rfq } = await db
    .from('rfq_batches')
    .select('rfq_number, pr1_id, pr2_id')
    .eq('id', rfqId)
    .maybeSingle();

  if (action === 'approved') {
    if (isFinalStep) {
      await db
        .from('approval_instances')
        .update({ status: 'approved', completed_at: now })
        .eq('id', instanceId);

      if (rfq?.pr1_id) {
        await db
          .from('pr1_requests')
          .update({ status: 'canvassing_complete', updated_at: now })
          .eq('id', rfq.pr1_id);
      }
    } else {
      await db
        .from('approval_instances')
        .update({ current_step: stepOrder + 1 })
        .eq('id', instanceId);
    }
  } else if (action === 'rejected') {
    await db
      .from('approval_instances')
      .update({ status: 'rejected', completed_at: now })
      .eq('id', instanceId);
  } else {
    await db
      .from('approval_instances')
      .update({ status: 'cancelled', completed_at: now })
      .eq('id', instanceId);

    await db
      .from('rfq_batches')
      .update({ status: 'open', updated_at: now })
      .eq('id', rfqId)
      .eq('status', 'closed');
  }

  const auditAction =
    action === 'approved'
      ? isFinalStep
        ? 'RFQ_APPROVED'
        : 'RFQ_APPROVAL_STEP_APPROVED'
      : action === 'rejected'
        ? 'RFQ_APPROVAL_REJECTED'
        : 'RFQ_APPROVAL_REVISION_REQUESTED';

  await db.from('audit_logs').insert({
    actor_id:      profile.id,
    action:        auditAction,
    document_type: 'RFQ',
    document_id:   rfqId,
    payload: {
      instance_id: instanceId,
      step_order:  stepOrder,
      action,
      remarks:     remarks.trim() || null,
      actor:       profile.full_name,
    },
  });

  try {
    if (action === 'approved') {
      if (isFinalStep) {
        await notifyByRole('procurement', {
          title:         'RFQ Approved — Create PO',
          body:          `RFQ ${rfq?.rfq_number ?? ''} has been approved. You may create the Purchase Order.`,
          type:          'action_required',
          document_type: 'rfq',
          document_id:   rfqId,
          action_url:    `/rfq/${rfqId}`,
        });

        if (rfq?.pr1_id) {
          const { data: pr1Row } = await db
            .from('pr1_requests')
            .select('requisitioner_id, pr1_number')
            .eq('id', rfq.pr1_id)
            .maybeSingle();
          if (pr1Row?.requisitioner_id) {
            await createNotification({
              user_id:       pr1Row.requisitioner_id,
              title:         'RFQ Approved',
              body:          `Canvassing for ${pr1Row.pr1_number} has been fully approved.`,
              type:          'approved',
              document_type: 'pr1',
              document_id:   rfq.pr1_id,
              action_url:    `/pr1/${rfq.pr1_id}`,
            });
          }
        }
      } else {
        const { data: instData } = await db
          .from('approval_instances')
          .select('workflow_id')
          .eq('id', instanceId)
          .maybeSingle();
        if (instData?.workflow_id && rfq?.rfq_number) {
          await notifyApproversForStep({
            workflowId:     instData.workflow_id,
            stepOrder:      stepOrder + 1,
            documentId:     rfqId,
            documentNumber: rfq.rfq_number,
            instanceId,
            title:          'RFQ Approval Required',
            body:           'RFQ requires your approval.',
            documentType:   'rfq',
            actionUrl:      rfq?.pr2_id
              ? getRfqApprovalPr2Url(rfq.pr2_id, instanceId)
              : '/approvals/pr2',
          });
        }
      }
    } else {
      const { data: instData } = await db
        .from('approval_instances')
        .select('started_by')
        .eq('id', instanceId)
        .maybeSingle();
      if (instData?.started_by && rfq?.rfq_number) {
        const trimmedRemark = remarks.trim();
        await createNotification({
          user_id:       instData.started_by,
          title:         action === 'rejected' ? 'RFQ Rejected' : 'RFQ Revision Requested',
          body:          action === 'rejected'
            ? (trimmedRemark
                ? `RFQ ${rfq.rfq_number} was rejected. Reason: "${trimmedRemark}"`
                : `RFQ ${rfq.rfq_number} was rejected.`)
            : (trimmedRemark
                ? `Revision requested on RFQ ${rfq.rfq_number}. The RFQ has been reopened. Reason: "${trimmedRemark}"`
                : `Revision requested on RFQ ${rfq.rfq_number}. The RFQ has been reopened.`),
          type:          action === 'rejected' ? 'rejected' : 'action_required',
          document_type: 'rfq',
          document_id:   rfqId,
          action_url:    `/rfq/${rfqId}`,
        });
      }
    }
  } catch {
    // best-effort
  }
}

export type RfqApprovalDetail = NonNullable<Awaited<ReturnType<typeof fetchRfqApprovalDetail>>>;
