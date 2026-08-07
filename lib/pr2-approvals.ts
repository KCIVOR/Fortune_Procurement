import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/auth';
import type {
  PR2ApprovalQueueRow,
  PR2ApprovalDetail,
  ApprovalAction,
  ApprovalInstanceStatus,
} from '@/types/approvals';
import { createNotification, notifyApproversForStep, notifyByRole } from '@/lib/notifications';
import { fetchRfqCanvassingApprovalQueue } from '@/lib/rfq-approvals';
import { fetchRfqQuoteAttachmentsByRfq } from '@/lib/canvassing';
import type { RfqQuoteAttachment } from '@/types/canvassing';
import { fetchPR1Attachments } from '@/lib/pr1';
import type { PR1Attachment } from '@/types/pr1';
import { resolvePR2RequestType, resolvePR2Priority } from '@/lib/pr2-classification';

const db = supabase as any;

// ─── Authority check ──────────────────────────────────────────────────────────
// PR2 steps span both 'approver' and 'procurement' roles.
// Title (position) must match exactly.

const DIRECTOR_POSITIONS = ['Director', 'Finance Director', 'Operations Manager'] as const;

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
    .select('id, status, pr2_number, pr1_id, request_type, requisitioner_id, department_id')
    .eq('id', pr2Id)
    .maybeSingle();
  if (pr2Err) throw pr2Err;
  if (!pr2) throw new Error('PR2 not found.');
  if (pr2.status !== 'draft' && pr2.status !== 'revision_requested') throw new Error('Only draft or revision-requested PR2s can be submitted for approval.');

  // Raw material PR2s are Planning-owned end to end (no procurement editor in
  // between). Guarding here — not just in submitRawMaterialPR2()'s wrapper —
  // closes the gap where the generic /pr2/[id] page calls this function
  // directly: without this, procurement could submit a raw-material PR2 and
  // become approval_instances.started_by, hijacking revision/rejection
  // notifications away from the actual Planning requisitioner.
  if (pr2.pr1_id === null && pr2.requisitioner_id !== profile.id) {
    throw new Error('Only the Planning requisitioner may submit this PR2 for approval.');
  }

  // Guard: no existing active Phase 1 instance
  const { data: existing } = await db
    .from('approval_instances')
    .select('id')
    .eq('document_type', 'PR2')
    .eq('document_id', pr2Id)
    .eq('status', 'active')
    .maybeSingle();
  if (existing?.id) throw new Error('An active approval instance already exists for this PR2.');

  // Goods/Raw Material/Services → PR2_FINAL (Dept Head → Operations Manager).
  // PR2_PHASE1 (Procurement Staff → Procurement Manager → Director) is now
  // legacy/fallback only — no longer reachable for any of the three types
  // once a pr1_id or a direct raw_material/services PR2 is present.
  let workflowCode = 'PR2_PHASE1';
  if (pr2.request_type === 'raw_material') {
    workflowCode = 'PR2_FINAL';
  } else if (pr2.pr1_id) {
    const { data: pr1Row } = await db
      .from('pr1_requests')
      .select('request_type')
      .eq('id', pr2.pr1_id)
      .maybeSingle();
    if (pr1Row?.request_type === 'goods' || pr1Row?.request_type === 'services') workflowCode = 'PR2_FINAL';
  } else if (pr2.request_type === 'services') {
    // Planning-direct Services PR2 (no pr1_id) — Phase 3 entry point.
    // No-op today (that entry point doesn't exist yet), safe to route now.
    workflowCode = 'PR2_FINAL';
  }

  const { data: wf, error: wfErr } = await db
    .from('approval_workflows')
    .select('id')
    .eq('code', workflowCode)
    .maybeSingle();
  if (wfErr) throw wfErr;
  if (!wf) throw new Error(`${workflowCode} workflow not configured.`);

  // Create approval instance starting at step 1
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

  // Transition PR2 status — filter against pr2.status (captured above, either
  // 'draft' or 'revision_requested' per the guard at the top of this function),
  // not a hardcoded 'draft'. A resubmit from revision_requested previously
  // matched zero rows here (Postgres/PostgREST treats that as a silent
  // success, not an error), leaving the PR2 stuck at revision_requested
  // forever while the approval_instances row inserted above was already
  // committed as 'active' — an orphaned instance that then blocked every
  // future resubmit with "An active approval instance already exists".
  // .select('id') + a length check turns any other no-op update (e.g. a
  // concurrent submit) into an explicit error instead of a silent no-op.
  // Mirrors submitPR1()'s status-transition pattern in lib/pr1.ts.
  const { data: updatedRows, error: updErr } = await db
    .from('pr2_requests')
    .update({ status: 'pending_approval', updated_at: now })
    .eq('id', pr2Id)
    .eq('status', pr2.status)
    .select('id');
  if (updErr) throw updErr;
  if (!updatedRows || updatedRows.length === 0) {
    throw new Error('PR2 could not be submitted. It may have already been submitted or does not exist.');
  }

  await db.from('audit_logs').insert({
    actor_id:      profile.id,
    action:        'PR2_SUBMITTED_FOR_APPROVAL',
    document_type: 'PR2',
    document_id:   pr2Id,
    payload:       {
      pr2_number:   pr2.pr2_number,
      submitted_by: profile.full_name,
      workflow_code: workflowCode,
    },
  });

  // Notify step 1 approvers (best-effort)
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
        documentDepartmentId: pr2.department_id,
        directorPositions: DIRECTOR_POSITIONS,
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
      .select('id, pr2_number, pr1_id, request_type, priority, requisitioner_name_snapshot, department_name_snapshot, department_id, purpose, date_required, status')
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

  return [
    ...instances.flatMap((inst: any) => {
    const pr2  = pr2Map[inst.document_id];
    const wf   = workflowMap[inst.workflow_id];
    const step = steps.find(
      (s: any) => s.workflow_id === inst.workflow_id && s.step_order === inst.current_step
    );
    if (!pr2 || !step) return [];

    const priority = resolvePR2Priority(
      pr2,
      pr2.pr1_id && pr1PriorityMap[pr2.pr1_id] ? { priority: pr1PriorityMap[pr2.pr1_id] as 'normal' | 'medium' | 'high' } : null
    );
    const requestType = resolvePR2RequestType(pr2, pr2.pr1_id ? { request_type: pr1TypeMap[pr2.pr1_id] } : null);

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
      pr1_priority:                priority as 'normal' | 'medium' | 'high',
      request_type:                requestType,
    }] as PR2ApprovalQueueRow[];
  }),
    ...(await fetchRfqCanvassingApprovalQueue()),
  ];
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
      .select('id, pr2_number, pr1_number_snapshot, pr1_id, request_type, priority, rfq_id, rfq_number_snapshot, requisitioner_name_snapshot, department_name_snapshot, department_id, purpose, date_required, status, generated_at, remarks, prepared_by_name_snapshot, prepared_by_position_snapshot, prepared_at, generated_by')
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

  let pr2Error = pr2Res.error;
  let pr2Data = pr2Res.data;
  let isArchived = false;

  if (!pr2Data && !pr2Error) {
    const archiveRes = await db.from('pr2_requests_archive')
      .select('id, pr2_number, pr1_number_snapshot, pr1_id, request_type, rfq_id, rfq_number_snapshot, requisitioner_name_snapshot, department_name_snapshot, department_id, purpose, date_required, status, generated_at, remarks, prepared_by_name_snapshot, prepared_by_position_snapshot, prepared_at, generated_by')
      .eq('id', inst.document_id)
      .maybeSingle();
    pr2Error = archiveRes.error;
    pr2Data = archiveRes.data;
    if (pr2Data) isArchived = true;
  }

  if (pr2Error) throw pr2Error;
  if (!pr2Data) return null;

  const pr2     = { ...pr2Data, is_archived: isArchived };
  const wf      = wfRes.data;
  const steps   = stepsRes.data ?? [];
  const actions = actionsRes.data ?? [];

  // Determine which phase this instance belongs to
  const workflowCode: string = wf?.code ?? '';

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

  const phase1Inst = pickLatestByWorkflow('PR2_FINAL') ?? pickLatestByWorkflow('PR2_PHASE1');
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
  const itemTableName = (pr2 as any).is_archived ? 'pr2_items_archive' : 'pr2_items';
  const [itemRowsRes, pr1Res] = await Promise.all([
    db.from(itemTableName)
      .select('id, item_order, item_code, description, unit_of_measure, quantity_requested, qty_on_hand, qty_incoming, quantity_to_purchase, supplier_name_snapshot, unit_price, total_price, vat_type, vat_rate_applied, pr1_item_id, is_raw_material, quote_justification, pr1_remarks_snapshot, pr1_quantity_requested_snapshot, quantity_override_reason_snapshot, quantity_overridden_by_name_snapshot, rfq_item_quote_id')
      .eq('pr2_id', pr2.id)
      .order('item_order', { ascending: true }),
    pr2.pr1_id
      ? db.from('pr1_requests').select('priority, request_type').eq('id', pr2.pr1_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const itemRows = itemRowsRes.data ?? [];

  // Batch-fetch quote attachments by RFQ id (pr2.rfq_id is on the pr2_requests row)
  const rfqId: string | null = (pr2 as any).rfq_id ?? null;
  const [quoteAttachmentsByQuote, pr1AttachmentsByItem] = await Promise.all([
    rfqId ? fetchRfqQuoteAttachmentsByRfq(rfqId).catch(() => ({})) : Promise.resolve({}),
    pr2.pr1_id
      ? fetchPR1Attachments(pr2.pr1_id).then((atts: PR1Attachment[]) => {
          const map: Record<string, PR1Attachment[]> = {};
          for (const att of atts) {
            if (!map[att.pr1_item_id]) map[att.pr1_item_id] = [];
            map[att.pr1_item_id].push(att);
          }
          return map;
        }).catch(() => ({}))
      : Promise.resolve({}),
  ]) as [Record<string, RfqQuoteAttachment[]>, Record<string, PR1Attachment[]>];

  const priority = resolvePR2Priority(pr2 as any, (pr1Res.data as any) ?? null);
  const requestType = resolvePR2RequestType(pr2 as any, (pr1Res.data as any) ?? null);

  let preparer: PR2ApprovalDetail['preparer'] = null;
  const preparedName = (pr2 as any).prepared_by_name_snapshot as string | null | undefined;
  const preparedPosition = (pr2 as any).prepared_by_position_snapshot as string | null | undefined;
  const preparedAt = (pr2 as any).prepared_at as string | null | undefined;
  if (preparedName && preparedAt) {
    preparer = {
      position: preparedPosition?.trim() || 'Warehouse',
      actionLabel: 'Prepared By',
      actorName: preparedName,
      actedAt: preparedAt,
    };
  } else if ((pr2 as any).generated_by) {
    const { data: genProfile } = await db
      .from('profiles')
      .select('full_name, positions(title)')
      .eq('id', (pr2 as any).generated_by)
      .maybeSingle();
    if (genProfile?.full_name) {
      const genPosition = (genProfile as { positions?: { title?: string } | null }).positions?.title;
      preparer = {
        position: genPosition?.trim() || 'Procurement Staff',
        actionLabel: 'Prepared By',
        actorName: genProfile.full_name,
        actedAt: pr2.generated_at,
      };
    }
  }

  return {
    pr2_id:                      pr2.id,
    pr2_number:                  pr2.pr2_number,
    is_archived:                 (pr2 as any).is_archived,
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
    pr1_priority:                priority,
    request_type:                requestType,
    pr1_id:                      pr2.pr1_id ?? null,
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
      vat_type:             i.vat_type ?? null,
      vat_rate_applied:     i.vat_rate_applied ?? null,
      pr1_item_id:          i.pr1_item_id,
      is_raw_material:      i.is_raw_material === true,
      quote_justification:  i.quote_justification ?? null,
      pr1_remarks_snapshot: i.pr1_remarks_snapshot ?? null,
      pr1_quantity_requested_snapshot:      i.pr1_quantity_requested_snapshot ?? null,
      quantity_override_reason_snapshot:    i.quantity_override_reason_snapshot ?? null,
      quantity_overridden_by_name_snapshot: i.quantity_overridden_by_name_snapshot ?? null,
      quote_attachments:    i.rfq_item_quote_id ? (quoteAttachmentsByQuote[i.rfq_item_quote_id] ?? []) : [],
      attachments:          i.pr1_item_id ? (pr1AttachmentsByItem[i.pr1_item_id] ?? []) : [],
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
    preparer,
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

  // Phase 7: Track if we unwind to PR1 for audit mirroring
  let unwoundPr1Id: string | null = null;

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

      // Final approval completes PR2
      await db
        .from('pr2_requests')
        .update({ status: 'approved', updated_at: now })
        .eq('id', pr2Id);

      // Goods: PR1 → pr2_approved (ready for RFQ)
      if (workflowCode === 'PR2_FINAL') {
        const { data: pr2Link } = await db
          .from('pr2_requests')
          .select('pr1_id')
          .eq('id', pr2Id)
          .maybeSingle();
        if (pr2Link?.pr1_id) {
          const { data: updatedPr1, error: pr1StatusErr } = await db
            .from('pr1_requests')
            .update({ status: 'pr2_approved', updated_at: now })
            .eq('id', pr2Link.pr1_id)
            .eq('status', 'pr2_pending_approval')
            .select('id');
          if (pr1StatusErr) throw pr1StatusErr;
          if (!updatedPr1?.length) {
            throw new Error(
              'PR2 was approved but PR1 could not be marked ready for RFQ. Check approver access to the linked PR1.'
            );
          }
        }
      }
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
    // 1. Fetch pr1_id to determine if this is a warehouse-originated PR2
    const { data: pr2Data } = await db
      .from('pr2_requests')
      .select('pr1_id')
      .eq('id', pr2Id)
      .maybeSingle();

    if (pr2Data?.pr1_id) {
      unwoundPr1Id = pr2Data.pr1_id;
      // Phase 7: Unwind to warehouse natively via RPC (Terminal)
      const { error: unwindErr } = await db.rpc('unwind_pr2_to_warehouse', { p_pr1_id: pr2Data.pr1_id, p_terminal: true });
      if (unwindErr) throw new Error(unwindErr.message);

      await db
        .from('approval_instances')
        .update({ status: 'rejected', completed_at: now })
        .eq('id', instanceId);
    } else {
      // Fall through to original behavior for non-warehouse (e.g. Planning raw material)
      await db
        .from('approval_instances')
        .update({ status: 'rejected', completed_at: now })
        .eq('id', instanceId);

      await db
        .from('pr2_requests')
        .update({ status: 'rejected', updated_at: now })
        .eq('id', pr2Id);
    }
  } else {
    // revision_requested
    const { data: pr2Data } = await db
      .from('pr2_requests')
      .select('pr1_id')
      .eq('id', pr2Id)
      .maybeSingle();

    if (pr2Data?.pr1_id) {
      unwoundPr1Id = pr2Data.pr1_id;
      // Phase 7: Unwind to warehouse natively via RPC (Non-terminal revision)
      const { error: unwindErr } = await db.rpc('unwind_pr2_to_warehouse', { p_pr1_id: pr2Data.pr1_id, p_terminal: false });
      if (unwindErr) throw new Error(unwindErr.message);

      await db
        .from('approval_instances')
        .update({ status: 'cancelled', completed_at: now })
        .eq('id', instanceId);
    } else {
      // Fall through to original behavior
      await db
        .from('approval_instances')
        .update({ status: 'cancelled', completed_at: now })
        .eq('id', instanceId);

      await db
        .from('pr2_requests')
        .update({ status: 'revision_requested', updated_at: now })
        .eq('id', pr2Id);
    }
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

  // Phase 7: If we unwound a PR2 back to PR1, add a parallel audit log to PR1
  // since the PR2 record is now deleted and its audit log is orphaned from most UI.
  if (unwoundPr1Id) {
    await db.from('audit_logs').insert({
      actor_id:      profile.id,
      action:        auditAction,
      document_type: 'PR1',
      document_id:   unwoundPr1Id,
      payload: {
        instance_id:   instanceId,
        step_order:    stepOrder,
        workflow_code: workflowCode,
        action,
        remarks:       remarks.trim() || null,
        actor:         profile.full_name,
        position:      profile.position,
        note:          'PR2 was unwound; this is a mirrored audit log.',
      },
    });
  }

  // Notifications (best-effort — must not fail the approval action)
  try {
    if (action === 'approved') {
      if (isFinalStep) {
        // Final approved → notify requisitioner + procurement
        const { data: pr2Row } = await db
          .from('pr2_requests')
          .select('pr2_number, requisitioner_id, request_type')
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
            action_url:    pr2Row.request_type === 'raw_material' ? `/planning/pr2/${pr2Id}` : `/pr2/${pr2Id}`,
          });
        }
        if (workflowCode === 'PR2_FINAL') {
          await notifyByRole('procurement', {
            title:         'PR2 Ready for Canvassing',
            body:          `PR2 ${pr2Row?.pr2_number ?? ''} has been approved. Create an RFQ and begin supplier canvassing.`,
            type:          'action_required',
            document_type: 'pr2',
            document_id:   pr2Id,
            action_url:    `/pr2/${pr2Id}`,
          });
        } else {
          await notifyByRole('procurement', {
            title:         'PR2 Ready for PO',
            body:          `PR2 ${pr2Row?.pr2_number ?? ''} has been fully approved. Generate the Purchase Order.`,
            type:          'action_required',
            document_type: 'pr2',
            document_id:   pr2Id,
            action_url:    `/pr2/${pr2Id}`,
          });
        }
      } else {
        // Normal step advance (auto dept-head already returned early)
        const [instData, pr2Data] = await Promise.all([
          db.from('approval_instances').select('workflow_id').eq('id', instanceId).maybeSingle(),
          db.from('pr2_requests').select('pr2_number, department_id').eq('id', pr2Id).maybeSingle(),
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
            documentDepartmentId: pr2Data.data.department_id,
            directorPositions: DIRECTOR_POSITIONS,
          });
        }
      }
    } else {
      // rejected or revision_requested
      if (unwoundPr1Id) {
        // Phase 7: PR2 was unwound to warehouse
        const startedByRemark = remarks.trim();
        const { data: pr1Data } = await db.from('pr1_requests').select('pr1_number, requisitioner_id').eq('id', unwoundPr1Id).maybeSingle();
        
        if (action === 'revision_requested') {
          // Notify warehouse about the returned PR1
          await notifyByRole('warehouse', {
            title:         'Warehouse Validation Required',
            body:          startedByRemark 
              ? `PR1 ${pr1Data?.pr1_number ?? ''} needs re-validation. Approver remarks: "${startedByRemark}"` 
              : `PR1 ${pr1Data?.pr1_number ?? ''} needs re-validation.`,
            type:          'action_required',
            document_type: 'pr1',
            document_id:   unwoundPr1Id,
            action_url:    `/warehouse/${unwoundPr1Id}`,
          }, { dedupeUnreadForDocument: true });
        } else {
          // Terminal rejection: notify original PR1 requisitioner directly
          if (pr1Data?.requisitioner_id) {
            await createNotification({
              user_id:       pr1Data.requisitioner_id,
              title:         'PR1 Rejected',
              body:          startedByRemark
                ? `PR1 ${pr1Data.pr1_number ?? ''} was rejected by PR2 approver. Reason: "${startedByRemark}"`
                : `PR1 ${pr1Data.pr1_number ?? ''} was rejected by PR2 approver.`,
              type:          'rejected',
              document_type: 'pr1',
              document_id:   unwoundPr1Id,
              action_url:    `/pr1/${unwoundPr1Id}`,
            });
          }
        }
      } else {
        // notify the person who submitted PR2 for approval (fallback for non-warehouse PR2)
        const [instData, pr2Data] = await Promise.all([
          db.from('approval_instances').select('started_by').eq('id', instanceId).maybeSingle(),
          db.from('pr2_requests').select('pr2_number, requisitioner_id, request_type').eq('id', pr2Id).maybeSingle(),
        ]);
        const requesterActionUrl = pr2Data.data?.request_type === 'raw_material' ? `/planning/pr2/${pr2Id}` : `/pr2/${pr2Id}`;
        const startedByRemark = remarks.trim();
        if (instData.data?.started_by && pr2Data.data?.pr2_number) {
          await createNotification({
            user_id:       instData.data.started_by,
            title:         action === 'rejected' ? 'PR2 Rejected' : 'PR2 Revision Requested',
            body:          action === 'rejected'
              ? (startedByRemark
                  ? `PR2 ${pr2Data.data.pr2_number} was rejected. Reason: "${startedByRemark}"`
                  : `PR2 ${pr2Data.data.pr2_number} was rejected.`)
              : (startedByRemark
                  ? `Revision requested on PR2 ${pr2Data.data.pr2_number}. Reason: "${startedByRemark}"`
                  : `Revision requested on PR2 ${pr2Data.data.pr2_number}.`),
            type:          action === 'rejected' ? 'rejected' : 'action_required',
            document_type: 'pr2',
            document_id:   pr2Id,
            action_url:    requesterActionUrl,
          });
        }

        // On terminal rejection, also notify the requisitioner if they are someone
        // other than the submitter, so the rejection surfaces in their requests.
        if (
          pr2Data.data?.requisitioner_id &&
          pr2Data.data?.pr2_number &&
          pr2Data.data.requisitioner_id !== instData.data?.started_by
        ) {
          await createNotification({
            user_id:       pr2Data.data.requisitioner_id,
            title:         'PR2 Rejected',
            body:          startedByRemark
              ? `PR2 ${pr2Data.data.pr2_number} was rejected. Reason: "${startedByRemark}"`
              : `PR2 ${pr2Data.data.pr2_number} for your request was rejected.`,
            type:          'rejected',
            document_type: 'pr2',
            document_id:   pr2Id,
            action_url:    requesterActionUrl,
          });
        }
      }
    }
  } catch {
    // Notifications are best-effort; do not fail the approval action
  }
}

