import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/auth';
import type {
  POApprovalQueueRow,
  POApprovalDetail,
  POApprovalAction,
  POReceipt,
  SupplierPORow,
} from '@/types/po';
import { createDeliveryForPO } from '@/lib/delivery';
import { createNotification, notifyApproversForStep, notifyByRole } from '@/lib/notifications';
import { resolvePORequestType } from '@/lib/po-send';
import { fetchRfqQuoteAttachmentsByQuoteIds } from '@/lib/canvassing';
import type { RfqQuoteAttachment } from '@/types/canvassing';
import { fetchPR1Attachments } from '@/lib/pr1';
import type { PR1Attachment } from '@/types/pr1';

const db = supabase as any;

// ─── Authority check ──────────────────────────────────────────────────────────

const DIRECTOR_POSITIONS = ['Director', 'Finance Director'] as const;

export function canActOnPOStep(
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

// ─── Submit PO for approval (Buyer initiates) ─────────────────────────────────

export async function submitPOForApproval(
  poId: string,
  profile: UserProfile
): Promise<void> {
  const now = new Date().toISOString();

  const { data: po, error: poErr } = await db
    .from('po_requests')
    .select('id, status, po_number')
    .eq('id', poId)
    .maybeSingle();
  if (poErr) throw poErr;
  if (!po) throw new Error('PO not found.');
  if (po.status !== 'draft' && po.status !== 'revision_requested') throw new Error('Only draft or revision-requested POs can be submitted for approval.');

  const { data: existing } = await db
    .from('approval_instances')
    .select('id')
    .eq('document_type', 'PO')
    .eq('document_id', poId)
    .eq('status', 'active')
    .maybeSingle();
  if (existing?.id) throw new Error('An active approval instance already exists for this PO.');

  const { data: wf, error: wfErr } = await db
    .from('approval_workflows')
    .select('id')
    .eq('code', 'PO_APPROVAL')
    .maybeSingle();
  if (wfErr) throw wfErr;
  if (!wf) throw new Error('PO_APPROVAL workflow not configured.');

  const { data: inst, error: instErr } = await db
    .from('approval_instances')
    .insert({
      workflow_id:   wf.id,
      document_type: 'PO',
      document_id:   poId,
      current_step:  1,
      status:        'active',
      started_by:    profile.id,
      started_at:    now,
    })
    .select('id')
    .single();
  if (instErr) throw instErr;

  await db
    .from('po_requests')
    .update({ status: 'for_approval', approval_instance_id: inst.id, updated_at: now })
    .eq('id', poId);

  await db.from('audit_logs').insert({
    actor_id:      profile.id,
    action:        'PO_SUBMITTED_FOR_APPROVAL',
    document_type: 'PO',
    document_id:   poId,
    payload:       { po_number: po.po_number, submitted_by: profile.full_name },
  });

  // Notify step 1 approvers (best-effort)
  try {
    await notifyApproversForStep({
      workflowId:     wf.id,
      stepOrder:      1,
      documentId:     poId,
      documentNumber: po.po_number,
      instanceId:     inst.id,
      title:          'PO Approval Required',
      body:           'PO requires your approval.',
      documentType:   'po',
      actionUrl:      `/approvals/po/${inst.id}`,
    });
  } catch {
    // Notifications are best-effort; do not fail submission
  }
}

// ─── Fetch PO approval queue ──────────────────────────────────────────────────

export async function fetchPOApprovalQueue(): Promise<POApprovalQueueRow[]> {
  const { data: instances, error } = await db
    .from('approval_instances')
    .select('id, workflow_id, document_id, current_step, status, started_at')
    .eq('document_type', 'PO')
    .eq('status', 'active')
    .order('started_at', { ascending: false });

  if (error) throw error;
  if (!instances || instances.length === 0) return [];

  const poIds       = Array.from(new Set(instances.map((r: any) => r.document_id as string)));
  const workflowIds = Array.from(new Set(instances.map((r: any) => r.workflow_id as string)));

  const [poRes, stepsRes] = await Promise.all([
    db.from('po_requests')
      .select('id, po_number, pr2_id, supplier_name_snapshot, department_name_snapshot, department_id, purpose, date_required, status')
      .in('id', poIds),
    db.from('approval_steps')
      .select('workflow_id, step_order, role_required, position_required, action_label, is_final')
      .in('workflow_id', workflowIds),
  ]);

  if (poRes.error) throw poRes.error;

  const poMap:  Record<string, any> = Object.fromEntries((poRes.data ?? []).map((r: any) => [r.id, r]));
  const steps:  any[] = stepsRes.data ?? [];

  // Fetch PR2 IDs and PR1 priorities through PR2
  const pr2Ids = Array.from(new Set(
    (poRes.data ?? []).map((po: any) => po.pr2_id).filter(Boolean)
  ));
  const { data: pr2s } = pr2Ids.length > 0
    ? await db.from('pr2_requests').select('id, pr1_id, request_type').in('id', pr2Ids)
    : { data: [] };
  const pr2Map: Record<string, any> = Object.fromEntries(
    ((pr2s ?? []) as any[]).map((pr2: any) => [pr2.id, pr2])
  );

  // Fetch PR1 priorities only — request_type now reads pr2.request_type directly.
  const pr1Ids = Array.from(new Set(
    Object.values(pr2Map).map((pr2: any) => pr2.pr1_id).filter(Boolean)
  ));
  const { data: pr1s } = pr1Ids.length > 0
    ? await db.from('pr1_requests').select('id, priority').in('id', pr1Ids)
    : { data: [] };
  const pr1PriorityMap: Record<string, string> = Object.fromEntries(
    ((pr1s ?? []) as any[]).map((pr1: any) => [pr1.id, pr1.priority])
  );

  return instances.flatMap((inst: any) => {
    const po   = poMap[inst.document_id];
    const step = steps.find(
      (s: any) => s.workflow_id === inst.workflow_id && s.step_order === inst.current_step
    );
    if (!po || !step) return [];

    // Priority is PR1-only; request_type reads pr2.request_type directly.
    const pr1Id       = po.pr2_id && pr2Map[po.pr2_id]?.pr1_id ? pr2Map[po.pr2_id].pr1_id : undefined;
    const pr1Priority = pr1Id ? pr1PriorityMap[pr1Id] : undefined;
    const requestType = po.pr2_id ? pr2Map[po.pr2_id]?.request_type : undefined;

    return [{
      po_id:                    po.id,
      po_number:                po.po_number,
      supplier_name_snapshot:   po.supplier_name_snapshot,
      department_name_snapshot: po.department_name_snapshot,
      department_id:            po.department_id ?? null,
      purpose:                  po.purpose,
      date_required:            po.date_required,
      po_status:                po.status,
      instance_id:              inst.id,
      current_step:             inst.current_step,
      instance_status:          inst.status,
      started_at:               inst.started_at,
      step_role_required:       step.role_required,
      step_position_required:   step.position_required,
      step_action_label:        step.action_label,
      step_is_final:            step.is_final,
      pr1_priority:             pr1Priority as 'normal' | 'medium' | 'high' | undefined,
      request_type:             requestType,
    }] as POApprovalQueueRow[];
  });
}

// ─── Fetch PO approval detail ─────────────────────────────────────────────────

export async function fetchPOApprovalDetail(
  instanceId: string
): Promise<POApprovalDetail | null> {
  const { data: inst, error: instErr } = await db
    .from('approval_instances')
    .select('id, workflow_id, document_id, current_step, status, started_at')
    .eq('id', instanceId)
    .maybeSingle();
  if (instErr) throw instErr;
  if (!inst) return null;

  const [poRes, itemsRes, stepsRes, actionsRes, receiptRes] = await Promise.all([
    db.from('po_requests').select('*').eq('id', inst.document_id).maybeSingle(),
    db.from('po_items')
      .select('*, pr2_items:pr2_item_id ( is_raw_material, quote_justification, pr1_remarks_snapshot, pr1_quantity_requested_snapshot, quantity_override_reason_snapshot, quantity_overridden_by_name_snapshot, rfq_item_quote_id, pr1_item_id )')
      .eq('po_id', inst.document_id)
      .order('item_order', { ascending: true }),
    db.from('approval_steps')
      .select('step_order, role_required, position_required, action_label, is_final')
      .eq('workflow_id', inst.workflow_id)
      .order('step_order', { ascending: true }),
    db.from('approval_actions')
      .select('id, instance_id, step_order, action, actor_id, actor_name_snapshot, actor_position_snapshot, actor_department_snapshot, remarks, acted_at')
      .eq('instance_id', instanceId)
      .order('acted_at', { ascending: true }),
    db.from('po_receipts')
      .select('*')
      .eq('po_id', inst.document_id)
      .maybeSingle(),
  ]);

  if (poRes.error) throw poRes.error;
  if (!poRes.data) return null;

  const po = poRes.data;

  // Priority is PR1-only; request_type reads pr2.request_type directly.
  let pr1Priority: 'normal' | 'medium' | 'high' | undefined;
  let requestType: 'goods' | 'services' | 'raw_material' = 'goods';
  if (po.pr2_id) {
    const { data: pr2Data } = await db
      .from('pr2_requests')
      .select('pr1_id, request_type')
      .eq('id', po.pr2_id)
      .maybeSingle();
    requestType = (pr2Data?.request_type as 'goods' | 'services' | 'raw_material') ?? 'goods';
    if (pr2Data?.pr1_id) {
      const { data: pr1Data } = await db
        .from('pr1_requests')
        .select('priority')
        .eq('id', pr2Data.pr1_id)
        .maybeSingle();
      if (pr1Data?.priority) {
        pr1Priority = pr1Data.priority as 'normal' | 'medium' | 'high';
      }
    }
  }

  const rawItems: any[] = itemsRes.data ?? [];
  const quoteIds = rawItems
    .map((r: any) => r.pr2_items?.rfq_item_quote_id)
    .filter((id: string | null | undefined): id is string => !!id);

  const pr1IdFetch: string | null = po.pr2_id
    ? await db.from('pr2_requests').select('pr1_id').eq('id', po.pr2_id).maybeSingle()
        .then(({ data }: any) => data?.pr1_id ?? null).catch(() => null)
    : null;

  const [quoteAttachmentsByQuote, pr1AttachmentsByItem] = await Promise.all([
    quoteIds.length > 0
      ? fetchRfqQuoteAttachmentsByQuoteIds(quoteIds).catch(() => ({}))
      : Promise.resolve({}),
    pr1IdFetch
      ? fetchPR1Attachments(pr1IdFetch).then((atts: PR1Attachment[]) => {
          const map: Record<string, PR1Attachment[]> = {};
          for (const att of atts) {
            if (!map[att.pr1_item_id]) map[att.pr1_item_id] = [];
            map[att.pr1_item_id].push(att);
          }
          return map;
        }).catch(() => ({}))
      : Promise.resolve({}),
  ]) as [Record<string, RfqQuoteAttachment[]>, Record<string, PR1Attachment[]>];

  return {
    po_id:                       po.id,
    po_number:                   po.po_number,
    pr2_number_snapshot:         po.pr2_number_snapshot,
    pr1_number_snapshot:         po.pr1_number_snapshot,
    rfq_number_snapshot:         po.rfq_number_snapshot,
    supplier_id:                 po.supplier_id ?? null,
    supplier_name_snapshot:      po.supplier_name_snapshot,
    requisitioner_name_snapshot: po.requisitioner_name_snapshot,
    department_name_snapshot:    po.department_name_snapshot,
    department_id:               po.department_id ?? null,
    purpose:                     po.purpose,
    date_required:               po.date_required,
    po_date:                     po.po_date,
    warehouse:                   po.warehouse,
    delivery_address:            po.delivery_address,
    payment_terms:               po.payment_terms,
    packing:                     po.packing,
    remarks:                     po.remarks,
    po_status:                   po.status,
    pr1_priority:                pr1Priority,
    request_type:                requestType,
    pr1_id:                      pr1IdFetch,
    items: rawItems.map((i: any) => {
      const rfqItemQuoteId: string | null = i.pr2_items?.rfq_item_quote_id ?? null;
      return {
        id:                   i.id,
        po_id:                i.po_id,
        pr2_item_id:          i.pr2_item_id,
        item_order:           i.item_order,
        item_code:            i.item_code,
        description:          i.description,
        unit_of_measure:      i.unit_of_measure,
        quantity_to_purchase: Number(i.quantity_to_purchase),
        unit_price:           Number(i.unit_price),
        total_price:          Number(i.total_price),
        vat_type:             i.vat_type ?? null,
        vat_rate_applied:     i.vat_rate_applied ?? null,
        supplier_name_snapshot: i.supplier_name_snapshot,
        remarks:              i.remarks,
        requires_compliance_doc: i.requires_compliance_doc === true,
        is_raw_material:      i.pr2_items?.is_raw_material === true,
        quote_justification:  i.pr2_items?.quote_justification ?? null,
        pr1_remarks_snapshot: i.pr2_items?.pr1_remarks_snapshot ?? null,
        pr1_quantity_requested_snapshot:      i.pr2_items?.pr1_quantity_requested_snapshot ?? null,
        quantity_override_reason_snapshot:    i.pr2_items?.quantity_override_reason_snapshot ?? null,
        quantity_overridden_by_name_snapshot: i.pr2_items?.quantity_overridden_by_name_snapshot ?? null,
        rfq_item_quote_id:    rfqItemQuoteId,
        quote_attachments:    rfqItemQuoteId ? (quoteAttachmentsByQuote[rfqItemQuoteId] ?? []) : [],
        attachments:          i.pr2_items?.pr1_item_id ? (pr1AttachmentsByItem[i.pr2_items.pr1_item_id] ?? []) : [],
        created_at:           i.created_at,
      };
    }),
    instance_id:     inst.id,
    current_step:    inst.current_step,
    instance_status: inst.status,
    started_at:      inst.started_at,
    steps:           stepsRes.data ?? [],
    actions:         actionsRes.data ?? [],
    receipt:         receiptRes.data ? normalizeReceipt(receiptRes.data) : null,
  };
}

// ─── Fetch PO approval detail by PO ID ───────────────────────────────────────

export async function fetchPOApprovalDetailByPOId(
  poId: string
): Promise<POApprovalDetail | null> {
  const { data: inst } = await db
    .from('approval_instances')
    .select('id')
    .eq('document_type', 'PO')
    .eq('document_id', poId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!inst?.id) return null;
  return fetchPOApprovalDetail(inst.id);
}

// ─── Submit PO approval action (internal steps 1-3) ──────────────────────────

export async function submitPOApprovalAction(
  instanceId:  string,
  poId:        string,
  stepOrder:   number,
  isFinalStep: boolean,
  action:      'approved' | 'rejected' | 'revision_requested',
  remarks:     string,
  profile:     UserProfile
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

  if (action === 'approved') {
    // For PO workflow, check if the next step is a supplier step
    // If so, this is the final internal approval step
    let isFinalInternalStep = isFinalStep;
    
    if (!isFinalStep) {
      // Check if next step is supplier role (step 4 in PO workflow)
      const { data: inst } = await db
        .from('approval_instances')
        .select('workflow_id')
        .eq('id', instanceId)
        .maybeSingle();
      
      if (inst?.workflow_id) {
        const { data: nextStep } = await db
          .from('approval_steps')
          .select('role_required, position_required')
          .eq('workflow_id', inst.workflow_id)
          .eq('step_order', stepOrder + 1)
          .maybeSingle();
        
        // If next step is supplier role, treat current step as final internal approval
        if (nextStep?.role_required === 'supplier') {
          isFinalInternalStep = true;
        }
      }
    }

    if (isFinalInternalStep) {
      // Final internal approval - mark PO as approved, notify supplier
      await db
        .from('approval_instances')
        .update({ status: 'approved', completed_at: now })
        .eq('id', instanceId);
      await db
        .from('po_requests')
        .update({ status: 'approved', updated_at: now })
        .eq('id', poId);
    } else {
      await db
        .from('approval_instances')
        .update({ current_step: stepOrder + 1 })
        .eq('id', instanceId);
    }
  } else if (action === 'rejected') {
    // Terminal rejection — PO gets a distinct 'rejected' status (mirrors PR1).
    // Keep approval_instance_id so the rejection stays traceable on the detail
    // page, and so the PO can never be resubmitted (submit requires status='draft').
    await db
      .from('approval_instances')
      .update({ status: 'rejected', completed_at: now })
      .eq('id', instanceId);
    await db
      .from('po_requests')
      .update({ status: 'rejected', updated_at: now })
      .eq('id', poId);
  } else {
    // revision_requested — back to draft
    await db
      .from('approval_instances')
      .update({ status: 'cancelled', completed_at: now })
      .eq('id', instanceId);
    await db
      .from('po_requests')
      .update({ status: 'revision_requested', updated_at: now, approval_instance_id: null })
      .eq('id', poId);
  }

  // Use the computed isFinalInternalStep for audit and notifications
  const effectiveIsFinal = action === 'approved' ? 
    (isFinalStep || await checkIfFinalInternalStep(instanceId, stepOrder)) : 
    isFinalStep;

  await db.from('audit_logs').insert({
    actor_id:      profile.id,
    action:        action === 'approved'
      ? effectiveIsFinal ? 'PO_APPROVAL_FINAL_APPROVED' : 'PO_APPROVAL_STEP_APPROVED'
      : action === 'rejected' ? 'PO_APPROVAL_REJECTED' : 'PO_APPROVAL_REVISION_REQUESTED',
    document_type: 'PO',
    document_id:   poId,
    payload: { instance_id: instanceId, step_order: stepOrder, action, remarks: remarks.trim() || null },
  });

  // Notify procurement when PO is finally approved so they can perform manual send to supplier
  if (action === 'approved' && effectiveIsFinal) {
    try {
      const { data: po } = await db
        .from('po_requests')
        .select('supplier_id, po_number')
        .eq('id', poId)
        .maybeSingle();

      await notifyByRole('procurement', {
        title:         'PO Ready to Send to Supplier',
        body:          `PO ${po?.po_number ?? ''} has been approved. Send it to the supplier when ready.`,
        type:          'action_required',
        document_type: 'po',
        document_id:   poId,
        action_url:    `/po/${poId}`,
      }, { dedupeUnreadForDocument: true });

      const { data: poFull } = await db
        .from('po_requests')
        .select('po_number, pr2_id')
        .eq('id', poId)
        .maybeSingle();

      if (poFull?.pr2_id) {
        const { data: pr2 } = await db
          .from('pr2_requests')
          .select('pr1_id, request_type, requisitioner_id')
          .eq('id', poFull.pr2_id)
          .maybeSingle();

        // Goods resolves the requisitioner via PR1 (unchanged); raw material
        // has no PR1, so pr2.requisitioner_id is the Planning user directly.
        let notifyUserId: string | null = null;
        let notifyActionUrl = '';
        if (pr2?.pr1_id) {
          const { data: pr1 } = await db
            .from('pr1_requests')
            .select('requisitioner_id')
            .eq('id', pr2.pr1_id)
            .maybeSingle();
          notifyUserId = pr1?.requisitioner_id ?? null;
          notifyActionUrl = `/pr1/${pr2.pr1_id}`;
        } else if (pr2?.request_type === 'raw_material') {
          notifyUserId = pr2.requisitioner_id ?? null;
          notifyActionUrl = `/planning/pr2/${poFull.pr2_id}`;
        }

        if (notifyUserId) {
          await createNotification({
            user_id:       notifyUserId,
            title:         'Purchase Order Approved',
            body:          `PO ${poFull.po_number} has been approved.`,
            type:          'approved',
            document_type: 'po',
            document_id:   poId,
            action_url:    notifyActionUrl,
          });
        }
      }
    } catch (err) {
      console.error('[po-approvals] final-approval notifications error:', err);
    }
  }

  // Notify next approvers (non-final step) or submitter (rejected / revision) — best-effort
  try {
    if (action === 'approved' && !effectiveIsFinal) {
      const [instRow, poRow] = await Promise.all([
        db.from('approval_instances').select('workflow_id').eq('id', instanceId).maybeSingle(),
        db.from('po_requests').select('po_number').eq('id', poId).maybeSingle(),
      ]);
      if (instRow.data?.workflow_id && poRow.data?.po_number) {
        await notifyApproversForStep({
          workflowId:     instRow.data.workflow_id,
          stepOrder:      stepOrder + 1,
          documentId:     poId,
          documentNumber: poRow.data.po_number,
          instanceId,
          title:          'PO Approval Required',
          body:           'PO requires your approval.',
          documentType:   'po',
          actionUrl:      `/approvals/po/${instanceId}`,
        });
      }
    } else if (action === 'rejected' || action === 'revision_requested') {
      const [instRow, poRow] = await Promise.all([
        db.from('approval_instances').select('started_by').eq('id', instanceId).maybeSingle(),
        db.from('po_requests').select('po_number, pr2_id').eq('id', poId).maybeSingle(),
      ]);
      // Always notify the procurement buyer who submitted the PO.
      if (instRow.data?.started_by && poRow.data?.po_number) {
        const startedByRemark = remarks.trim();
        await createNotification({
          user_id:       instRow.data.started_by,
          title:         action === 'rejected' ? 'PO Rejected' : 'PO Revision Requested',
          body:          action === 'rejected'
            ? (startedByRemark
                ? `PO ${poRow.data.po_number} was rejected. Reason: "${startedByRemark}"`
                : `PO ${poRow.data.po_number} was rejected.`)
            : (startedByRemark
                ? `Revision requested on PO ${poRow.data.po_number}. Reason: "${startedByRemark}"`
                : `Revision requested on PO ${poRow.data.po_number}.`),
          type:          action === 'rejected' ? 'rejected' : 'action_required',
          document_type: 'po',
          document_id:   poId,
          action_url:    `/po/${poId}`,
        });
      }

      // Also notify the employee requisitioner (PR1/PR2 originator) so the
      // outcome surfaces in their My Requests / Raw Material Requests view.
      // Resolve via PO → PR2 → PR1 (goods); raw material has no PR1, so fall
      // back to pr2.requisitioner_id directly.
      if (poRow.data?.pr2_id && poRow.data?.po_number) {
        const { data: pr2 } = await db
          .from('pr2_requests')
          .select('pr1_id, request_type, requisitioner_id')
          .eq('id', poRow.data.pr2_id)
          .maybeSingle();

        let notifyUserId: string | null = null;
        let notifyActionUrl = '';
        if (pr2?.pr1_id) {
          const { data: pr1 } = await db
            .from('pr1_requests')
            .select('requisitioner_id')
            .eq('id', pr2.pr1_id)
            .maybeSingle();
          notifyUserId = pr1?.requisitioner_id ?? null;
          notifyActionUrl = `/pr1/${pr2.pr1_id}`;
        } else if (pr2?.request_type === 'raw_material') {
          notifyUserId = pr2.requisitioner_id ?? null;
          notifyActionUrl = `/planning/pr2/${poRow.data.pr2_id}`;
        }

        if (notifyUserId && notifyUserId !== instRow.data?.started_by) {
          const trimmedRemark = remarks.trim();
          await createNotification({
            user_id:       notifyUserId,
            title:         action === 'rejected' ? 'Purchase Order Rejected' : 'Purchase Order Revision Requested',
            body:          action === 'rejected'
              ? (trimmedRemark
                  ? `PO ${poRow.data.po_number} was rejected. Reason: "${trimmedRemark}"`
                  : `The Purchase Order for your request (${poRow.data.po_number}) was rejected.`)
              : (trimmedRemark
                  ? `Revision requested on PO ${poRow.data.po_number}. Reason: "${trimmedRemark}"`
                  : `Revision requested on the Purchase Order for your request (${poRow.data.po_number}).`),
            type:          action === 'rejected' ? 'rejected' : 'action_required',
            document_type: 'po',
            document_id:   poId,
            action_url:    notifyActionUrl,
          });
        }
      }
    }
  } catch (err) {
    console.error('[po-approvals] step-advance notifications error:', err);
  }
}

// Helper to check if next step is supplier (for determining final internal step)
async function checkIfFinalInternalStep(instanceId: string, stepOrder: number): Promise<boolean> {
  const { data: inst } = await db
    .from('approval_instances')
    .select('workflow_id')
    .eq('id', instanceId)
    .maybeSingle();
  
  if (!inst?.workflow_id) return false;
  
  const { data: nextStep } = await db
    .from('approval_steps')
    .select('role_required')
    .eq('workflow_id', inst.workflow_id)
    .eq('step_order', stepOrder + 1)
    .maybeSingle();
  
  return nextStep?.role_required === 'supplier';
}

// ─── Supplier inbox visibility (Goods POs hidden until procurement sends) ─────

const SUPPLIER_PO_SELECT = `
  id, po_number, purpose, date_required, po_date, warehouse, payment_terms, status,
  supplier_name_snapshot, sent_at,
  pr2:pr2_requests!pr2_id ( request_type )
`;

type SupplierPOQueryRow = {
  id: string;
  status: string;
  sent_at: string | null;
  pr2?: { request_type?: string } | null;
};

function supplierInboxVisible(row: SupplierPOQueryRow): boolean {
  if (row.status === 'sent') return true;
  if (row.status !== 'approved') return false;
  // Manual send gate applies to all PO types (goods, raw material, services).
  // Un-sent POs are hidden from supplier inbox until explicitly sent by procurement.
  if (!row.sent_at) return false;
  return true;
}

// ─── Supplier: fetch POs available for acknowledgment ────────────────────────
// Queries po_requests directly by supplier_id = auth.uid().
// RLS enforces the same constraint — no cross-table joins needed.

export async function fetchSupplierPOs(supplierId: string): Promise<SupplierPORow[]> {
  const { data: pos, error } = await db
    .from('po_requests')
    .select(SUPPLIER_PO_SELECT)
    .eq('supplier_id', supplierId)
    .in('status', ['approved', 'sent'])
    .order('po_date', { ascending: false });

  if (error) throw error;
  const visible = ((pos ?? []) as SupplierPOQueryRow[]).filter(supplierInboxVisible);
  if (visible.length === 0) return [];

  const poIds = visible.map((p) => p.id);
  const { data: receipts } = await db
    .from('po_receipts')
    .select('*')
    .in('po_id', poIds);

  const receiptMap: Record<string, any> = Object.fromEntries(
    (receipts ?? []).map((r: any) => [r.po_id, r])
  );

  return visible.map((po: any) => ({
    po_id:                  po.id,
    po_number:              po.po_number,
    purpose:                po.purpose,
    date_required:          po.date_required,
    po_date:                po.po_date,
    warehouse:              po.warehouse,
    payment_terms:          po.payment_terms,
    po_status:              po.status,
    receipt:                receiptMap[po.id] ? normalizeReceipt(receiptMap[po.id]) : null,
  }));
}

// ─── Supplier PO list: paginated ─────────────────────────────────────────────

export async function fetchSupplierPOsPaged(
  supplierId: string,
  options: { limit: number; offset: number; search?: string; status?: string }
): Promise<{ rows: SupplierPORow[]; total_count: number }> {
  const { limit, offset, search, status } = options;

  const applyFilters = (q: any) => {
    q = q.eq('supplier_id', supplierId);
    if (status && status !== 'all') {
      q = q.eq('status', status);
    } else {
      q = q.in('status', ['approved', 'sent']);
    }
    const term = search?.trim();
    if (term) {
      const pattern = `%${term}%`;
      q = q.or(`po_number.ilike.${pattern},purpose.ilike.${pattern}`);
    }
    return q;
  };

  const { data, error } = await applyFilters(
    db.from('po_requests').select(SUPPLIER_PO_SELECT)
  ).order('po_date', { ascending: false });

  if (error) throw error;

  const allVisible = ((data ?? []) as SupplierPOQueryRow[]).filter(supplierInboxVisible);
  const visible = allVisible.slice(offset, offset + limit);
  if (visible.length === 0) return { rows: [], total_count: allVisible.length };

  const poIds = visible.map((p) => p.id);
  const { data: receipts } = await db
    .from('po_receipts')
    .select('*')
    .in('po_id', poIds);

  const receiptMap: Record<string, any> = Object.fromEntries(
    (receipts ?? []).map((r: any) => [r.po_id, r])
  );

  return {
    rows: visible.map((po: any) => ({
      po_id:         po.id,
      po_number:     po.po_number,
      purpose:       po.purpose,
      date_required: po.date_required,
      po_date:       po.po_date,
      warehouse:     po.warehouse,
      payment_terms: po.payment_terms,
      po_status:     po.status,
      receipt:       receiptMap[po.id] ? normalizeReceipt(receiptMap[po.id]) : null,
    })),
    total_count: allVisible.length,
  };
}

// ─── Supplier PO global stat counts (unfiltered by search/status) ────────────

export async function fetchSupplierPOStatCounts(
  supplierId: string
): Promise<{ pending: number; acknowledged: number; total: number }> {
  const { data, error } = await db
    .from('po_requests')
    .select(SUPPLIER_PO_SELECT)
    .eq('supplier_id', supplierId)
    .in('status', ['approved', 'sent']);

  if (error) throw error;

  const visible = ((data ?? []) as SupplierPOQueryRow[]).filter(supplierInboxVisible);
  const pending = visible.filter((r) => r.status === 'approved').length;
  const acknowledged = visible.filter((r) => r.status === 'sent').length;

  return {
    pending,
    acknowledged,
    total: visible.length,
  };
}

// ─── Supplier: acknowledge PO receipt ────────────────────────────────────────

export async function acknowledgeSupplierPO(
  poId:            string,
  commitmentDate:  string,
  deliveryRemarks: string,
  profile:         UserProfile
): Promise<void> {
  const now = new Date().toISOString();

  // Guard: PO must be 'approved' — fetch all columns needed for delivery creation
  const { data: po } = await db
    .from('po_requests')
    .select('id, status, po_number, approval_instance_id, pr2_id, pr2_number_snapshot, pr1_number_snapshot, rfq_number_snapshot, supplier_id, supplier_name_snapshot, requisitioner_name_snapshot, department_name_snapshot, purpose, delivery_address, warehouse, sent_at')
    .eq('id', poId)
    .maybeSingle();
  if (!po) throw new Error('PO not found.');
  if (po.status !== 'approved') throw new Error('PO must be fully approved before acknowledgment.');

  if (!po.sent_at) {
    throw new Error('This PO has not been sent by procurement yet.');
  }

  // Resolve requisitioner_id for employee RLS: deliveries.employee visibility is
  // requisitioner_id = auth.uid(). Resolution must work under supplier auth (no
  // pr2_requests SELECT for suppliers), so we resolve via pr1_requests, which IS
  // readable by all authenticated users.
  //
  // We use pr1_number_snapshot as the lookup key, but defend against a known data
  // hazard: pr1_requests.pr1_number has no UNIQUE constraint, so duplicates can
  // exist. .maybeSingle() throws on >1 row — silently nulling the result via the
  // surrounding try/catch and producing an RLS-invisible delivery. To stay safe:
  //   - .order(created_at) + .limit(1) instead of .maybeSingle()
  //   - all rows sharing the same pr1_number observed so far have the same
  //     requisitioner_id (per the data we audited), so picking the earliest is
  //     correct and stable.
  let requisitionerId: string | null = null;
  try {
    const pr1No = String(po.pr1_number_snapshot ?? '').trim();
    if (pr1No) {
      const { data: pr1Rows } = await db
        .from('pr1_requests')
        .select('requisitioner_id')
        .eq('pr1_number', pr1No)
        .order('created_at', { ascending: true })
        .limit(1);
      const first = Array.isArray(pr1Rows) && pr1Rows.length > 0 ? pr1Rows[0] : null;
      requisitionerId = first?.requisitioner_id ?? null;
    } else if (po.pr2_id) {
      // Raw-material PO — no PR1 at all, so the lookup above is always
      // skipped. Resolve straight off pr2_requests instead: the awarded
      // supplier acknowledging this PO is, by construction, assigned to the
      // RFQ linked to this pr2_id, so is_supplier_assigned_to_pr2() (Phase 3)
      // grants them read access to pr2_requests.requisitioner_id here.
      const { data: pr2Row } = await db
        .from('pr2_requests')
        .select('requisitioner_id')
        .eq('id', po.pr2_id)
        .maybeSingle();
      requisitionerId = pr2Row?.requisitioner_id ?? null;
    }
  } catch {
    requisitionerId = null;
  }

  // Upsert receipt
  const { data: existing } = await db
    .from('po_receipts')
    .select('id')
    .eq('po_id', poId)
    .maybeSingle();

  if (existing?.id) {
    await db
      .from('po_receipts')
      .update({
        commitment_date:  commitmentDate || null,
        delivery_remarks: deliveryRemarks.trim() || null,
        acknowledged_at:  now,
        updated_at:       now,
      })
      .eq('id', existing.id);
  } else {
    await db.from('po_receipts').insert({
      po_id:                poId,
      acknowledged_by:      profile.id,
      acknowledged_by_name: profile.full_name,
      commitment_date:      commitmentDate || null,
      delivery_remarks:     deliveryRemarks.trim() || null,
      acknowledged_at:      now,
    });
  }

  // Advance the approval instance to mark supplier step done
  if (po.approval_instance_id) {
    // Record supplier approval action at step 4
    const { data: inst } = await db
      .from('approval_instances')
      .select('id, workflow_id, current_step, status')
      .eq('id', po.approval_instance_id)
      .maybeSingle();

    if (inst && inst.status === 'approved') {
      // Internal approval already closed; record supplementary action
      await db.from('approval_actions').insert({
        instance_id:               inst.id,
        step_order:                4,
        action:                    'approved',
        actor_id:                  profile.id,
        actor_name_snapshot:       profile.full_name,
        actor_position_snapshot:   profile.position,
        actor_department_snapshot: profile.department,
        remarks:                   deliveryRemarks.trim() || null,
        acted_at:                  now,
      });
    }
  }

  // Mark PO as sent
  await db
    .from('po_requests')
    .update({ status: 'sent', updated_at: now })
    .eq('id', poId);

  // Create delivery tracking record (idempotent — safe to call again).
  // requisitioner_id is set when we can resolve it from PR1 (required for employee RLS).
  await createDeliveryForPO({
    poId,
    po_number:                   po.po_number,
    pr2_number_snapshot:         po.pr2_number_snapshot,
    pr1_number_snapshot:         po.pr1_number_snapshot,
    rfq_number_snapshot:         po.rfq_number_snapshot,
    supplier_id:                 po.supplier_id,
    supplier_name_snapshot:      po.supplier_name_snapshot,
    requisitioner_id:            requisitionerId,
    requisitioner_name_snapshot: po.requisitioner_name_snapshot,
    department_name_snapshot:    po.department_name_snapshot,
    purpose:                     po.purpose,
    delivery_address:            po.delivery_address,
    warehouse:                   po.warehouse,
    commitment_date:             commitmentDate || null,
  }).catch(() => null);

  // Heal existing deliveries that were created without requisitioner_id (supplier context).
  if (requisitionerId) {
    await db
      .from('deliveries')
      .update({ requisitioner_id: requisitionerId, updated_at: now })
      .eq('po_id', poId)
      .is('requisitioner_id', null);
  }

  // Sync commitment_date on existing delivery (covers re-acknowledgment)
  await db
    .from('deliveries')
    .update({ commitment_date: commitmentDate || null, updated_at: now })
    .eq('po_id', poId)
    .neq('status', 'delivered');

  await db.from('audit_logs').insert({
    actor_id:      profile.id,
    action:        'PO_ACKNOWLEDGED_BY_SUPPLIER',
    document_type: 'PO',
    document_id:   poId,
    payload: {
      po_number:       po.po_number,
      commitment_date: commitmentDate,
      supplier:        profile.full_name,
    },
  });
}

// ─── External vendor: Procurement marks an external PO as ordered ─────────────
// External vendors (supplier_id IS NULL) have no portal, so there is no supplier
// acknowledgment. This is the procurement-side sibling of acknowledgeSupplierPO:
// it transitions the PO approved → sent and creates the delivery row that GRN
// depends on, without requiring a supplier session.
export async function markExternalPOOrdered(
  poId:    string,
  profile: UserProfile,
): Promise<void> {
  const now = new Date().toISOString();

  const { data: po } = await db
    .from('po_requests')
    .select('id, status, po_number, pr2_id, pr2_number_snapshot, pr1_number_snapshot, rfq_number_snapshot, supplier_id, supplier_name_snapshot, requisitioner_name_snapshot, department_name_snapshot, purpose, delivery_address, warehouse')
    .eq('id', poId)
    .maybeSingle();
  if (!po) throw new Error('PO not found.');
  if (po.supplier_id) throw new Error('This PO has a registered supplier — use the supplier acknowledgment flow.');
  if (po.status !== 'approved') throw new Error('PO must be fully approved before it can be marked as ordered.');

  // Resolve requisitioner_id for employee delivery RLS (procurement can read pr2).
  let requisitionerId: string | null = null;
  try {
    const { data: pr2Row } = await db
      .from('pr2_requests')
      .select('requisitioner_id')
      .eq('id', po.pr2_id)
      .maybeSingle();
    requisitionerId = pr2Row?.requisitioner_id ?? null;
  } catch {
    requisitionerId = null;
  }

  // Mark PO as sent
  await db
    .from('po_requests')
    .update({ status: 'sent', updated_at: now })
    .eq('id', poId);

  // Create the delivery record GRN depends on (idempotent). No commitment date
  // and no supplier_id — warehouse drives fulfillment from here.
  await createDeliveryForPO({
    poId,
    po_number:                   po.po_number,
    pr2_number_snapshot:         po.pr2_number_snapshot,
    pr1_number_snapshot:         po.pr1_number_snapshot,
    rfq_number_snapshot:         po.rfq_number_snapshot,
    supplier_id:                 null,
    supplier_name_snapshot:      po.supplier_name_snapshot,
    requisitioner_id:            requisitionerId,
    requisitioner_name_snapshot: po.requisitioner_name_snapshot,
    department_name_snapshot:    po.department_name_snapshot,
    purpose:                     po.purpose,
    delivery_address:            po.delivery_address,
    warehouse:                   po.warehouse,
    commitment_date:             null,
  }).catch(() => null);

  await db.from('audit_logs').insert({
    actor_id:      profile.id,
    action:        'PO_MARKED_ORDERED_EXTERNAL',
    document_type: 'PO',
    document_id:   poId,
    payload: {
      po_number: po.po_number,
      vendor:    po.supplier_name_snapshot,
      ordered_by: profile.full_name,
    },
  });
}

// ─── Normalize ────────────────────────────────────────────────────────────────

function normalizeReceipt(row: any): POReceipt {
  return {
    id:                   row.id,
    po_id:                row.po_id,
    acknowledged_by:      row.acknowledged_by,
    acknowledged_by_name: row.acknowledged_by_name,
    commitment_date:      row.commitment_date,
    delivery_remarks:     row.delivery_remarks,
    acknowledged_at:      row.acknowledged_at,
  };
}
