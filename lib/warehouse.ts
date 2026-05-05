import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/auth';
import type {
  WarehouseValidationWithItems,
  WarehouseValidationItem,
  ValidationFormValues,
  WarehouseDecision,
  PR1QueueRow,
} from '@/types/warehouse';

const db = supabase as any;

// ─── Queue ────────────────────────────────────────────────────────────────────

export async function fetchWarehouseQueue(): Promise<PR1QueueRow[]> {
  const { data, error } = await db
    .from('pr1_requests')
    .select(`
      id,
      pr1_number,
      requisitioner_name_snapshot,
      department_name_snapshot,
      purpose,
      priority,
      date_required,
      submitted_at,
      status,
      warehouse_validations ( id, decision )
    `)
    .eq('status', 'pending_warehouse')
    .order('submitted_at', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id:                          row.id,
    pr1_number:                  row.pr1_number,
    requisitioner_name_snapshot: row.requisitioner_name_snapshot,
    department_name_snapshot:    row.department_name_snapshot,
    purpose:                     row.purpose,
    priority:                    row.priority ?? 'normal',
    date_required:               row.date_required,
    submitted_at:                row.submitted_at,
    status:                      row.status,
    validation_id:               row.warehouse_validations?.[0]?.id ?? null,
    validation_decision:         row.warehouse_validations?.[0]?.decision ?? null,
  }));
}

// ─── Fetch validation record ──────────────────────────────────────────────────

export async function fetchValidationByPR1Id(
  pr1Id: string
): Promise<WarehouseValidationWithItems | null> {
  const { data, error } = await db
    .from('warehouse_validations')
    .select('*, warehouse_validation_items(*)')
    .eq('pr1_id', pr1Id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    ...data,
    items: (data.warehouse_validation_items ?? []).sort(
      (a: WarehouseValidationItem, b: WarehouseValidationItem) =>
        a.item_order - b.item_order
    ),
  };
}

// ─── Open / initialise validation ────────────────────────────────────────────
// Idempotent: if a validation already exists for this PR1, return it.
// Otherwise create a new one and seed its items from pr1_items.
// Any warehouse user can open a validation; the validator_id is set to the
// opener but UPDATE is not restricted to that user — any warehouse staff can
// save progress and submit.

export async function openValidation(
  pr1Id: string,
  profile: UserProfile
): Promise<WarehouseValidationWithItems> {
  // Check for existing record first (UNIQUE constraint on pr1_id means at most one)
  const existing = await fetchValidationByPR1Id(pr1Id);
  if (existing) return existing;

  // Fetch PR1 items to seed validation rows
  const { data: pr1Items, error: itemsErr } = await db
    .from('pr1_items')
    .select('*')
    .eq('pr1_id', pr1Id)
    .order('item_order', { ascending: true });

  if (itemsErr) throw itemsErr;

  // Insert validation header. If a concurrent opener already inserted one
  // (race between two warehouse users), the UNIQUE constraint will fire — we
  // catch that specific code and fall back to fetching the existing row.
  const { data: vRow, error: vErr } = await db
    .from('warehouse_validations')
    .insert({
      pr1_id:                      pr1Id,
      validator_id:                profile.id,
      validator_name_snapshot:     profile.full_name,
      validator_position_snapshot: profile.position,
      decision:                    null,
      notes:                       '',
      updated_at:                  new Date().toISOString(),
    })
    .select('*')
    .single();

  if (vErr) {
    // Postgres unique_violation code = '23505'
    if (vErr.code === '23505') {
      const fallback = await fetchValidationByPR1Id(pr1Id);
      if (fallback) return fallback;
    }
    throw vErr;
  }

  // Seed validation items
  const itemRows = (pr1Items ?? []).map((item: any) => ({
    validation_id:      vRow.id,
    pr1_item_id:        item.id,
    item_order:         item.item_order,
    item_code:          item.item_code,
    description:        item.description,
    unit_of_measure:    item.unit_of_measure,
    requestor_soh:      item.stock_on_hand,
    validated_soh:      null,
    quantity_requested: item.quantity_requested,
    availability:       null,
    item_notes:         '',
  }));

  if (itemRows.length > 0) {
    const { error: itemInsertErr } = await db
      .from('warehouse_validation_items')
      .insert(itemRows);

    if (itemInsertErr) throw itemInsertErr;
  }

  // Fetch the completed record with items to return consistent shape
  const result = await fetchValidationByPR1Id(pr1Id);
  if (!result) throw new Error('Failed to retrieve validation record after creation.');
  return result;
}

// ─── Save in-progress validation ─────────────────────────────────────────────
// Not restricted to the original validator_id — any warehouse user can save.

export async function saveValidationProgress(
  validationId: string,
  values: ValidationFormValues,
): Promise<void> {
  const { error: hErr } = await db
    .from('warehouse_validations')
    .update({
      notes:      values.notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', validationId);

  if (hErr) throw hErr;

  for (const item of values.items) {
    const { error: iErr } = await db
      .from('warehouse_validation_items')
      .update({
        validated_soh: item.validated_soh === '' ? null : Number(item.validated_soh),
        availability:  item.availability,
        item_notes:    item.item_notes,
      })
      .eq('id', item.id)
      .eq('validation_id', validationId);

    if (iErr) throw iErr;
  }
}

// ─── Submit final decision ────────────────────────────────────────────────────

export async function submitValidationDecision(
  validationId: string,
  pr1Id: string,
  values: ValidationFormValues,
  decision: WarehouseDecision,
  profile: UserProfile
): Promise<void> {
  const now = new Date().toISOString();

  // Save item progress first
  await saveValidationProgress(validationId, values);

  // Map decision to PR1 status
  // sufficient  → resolved_internal (closed, no approval needed)
  // insufficient → pending_approval (routes to approval workflow)
  const nextPR1Status = decision === 'sufficient'
    ? 'resolved_internal'
    : 'pending_approval';

  // Finalise validation header with decision and submitter snapshot
  const { error: vErr } = await db
    .from('warehouse_validations')
    .update({
      decision:                    decision,
      validator_id:                profile.id,
      validator_name_snapshot:     profile.full_name,
      validator_position_snapshot: profile.position,
      validated_at:                now,
      updated_at:                  now,
    })
    .eq('id', validationId);

  if (vErr) throw vErr;

  // Transition PR1 status — the warehouse UPDATE policy allows this
  const { data: updatedRows, error: pr1Err } = await db
    .from('pr1_requests')
    .update({
      status:     nextPR1Status,
      updated_at: now,
    })
    .eq('id', pr1Id)
    .eq('status', 'pending_warehouse')
    .select('id');

  if (pr1Err) throw pr1Err;
  if (!updatedRows || updatedRows.length === 0) {
    throw new Error('PR1 status could not be updated. It may have already been processed.');
  }

  // For insufficient decisions: look up the PR1_APPROVAL workflow and create
  // an approval instance at step 1 (Supervisor). This is the ONLY place an
  // approval instance is ever created for PR1 — never before warehouse validation.
  if (decision === 'insufficient') {
    const { data: workflow, error: wfErr } = await db
      .from('approval_workflows')
      .select('id')
      .eq('code', 'PR1_APPROVAL')
      .eq('active', true)
      .maybeSingle();

    if (wfErr) throw wfErr;
    if (!workflow) throw new Error('PR1_APPROVAL workflow not found. Cannot route for approval.');

    const { error: instanceErr } = await db
      .from('approval_instances')
      .insert({
        workflow_id:   workflow.id,
        document_type: 'PR1',
        document_id:   pr1Id,
        current_step:  1,
        status:        'active',
        started_by:    profile.id,
        started_at:    now,
      });

    if (instanceErr) throw instanceErr;
  }

  // Audit log
  await db.from('audit_logs').insert({
    actor_id:      profile.id,
    action:        decision === 'sufficient'
                     ? 'WAREHOUSE_VALIDATED_SUFFICIENT'
                     : 'WAREHOUSE_VALIDATED_INSUFFICIENT',
    document_type: 'PR1',
    document_id:   pr1Id,
    payload: {
      validation_id: validationId,
      decision,
      validated_by:  profile.full_name,
      position:      profile.position,
      next_status:   nextPR1Status,
    },
  });
}