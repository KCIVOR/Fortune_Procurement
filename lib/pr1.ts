import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/auth';
import type {
  PR1Request,
  PR1WithItems,
  PR1Item,
  PR1ItemDraft,
  PR1FormValues,
  DownstreamStage,
} from '@/types/pr1';

// supabase client is untyped for custom tables — cast to any for PR1 queries
const db = supabase as any;

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function fetchMyPR1s(
  userId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<{ requests: PR1Request[]; total_count: number }> {
  const limit = options.limit;
  const offset = options.offset ?? 0;

  let query = db
    .from('pr1_requests')
    .select('*', { count: 'exact' })
    .eq('requisitioner_id', userId)
    .order('created_at', { ascending: false });

  if (limit) {
    query = query.range(offset, offset + limit - 1);
  }

  const { data, error, count } = await query;

  if (error) throw error;
  return {
    requests: (data ?? []) as PR1Request[],
    total_count: count ?? 0,
  };
}

export async function fetchPR1ById(id: string): Promise<PR1WithItems | null> {
  const { data, error } = await db
    .from('pr1_requests')
    .select('*, pr1_items(*)')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as any;
  const items = (row.pr1_items ?? []).sort(
    (a: PR1Item, b: PR1Item) => a.item_order - b.item_order
  );

  // Fetch warehouse validation data if validation exists
  const { data: warehouseValidation, error: wvError } = await db
    .from('warehouse_validations')
    .select('id')
    .eq('pr1_id', id)
    .maybeSingle();

  if (wvError) throw wvError;

  // If warehouse validation exists, fetch per-item validated SOH
  let validatedSohMap: Record<string, { validated_soh: number | null; warehouse_decision: string }> = {};
  if (warehouseValidation?.id) {
    const { data: validationItems, error: viError } = await db
      .from('warehouse_validation_items')
      .select('pr1_item_id, validated_soh')
      .eq('validation_id', warehouseValidation.id);

    if (viError) throw viError;

    // Build map: pr1_item_id → validated_soh
    (validationItems ?? []).forEach((vi: any) => {
      validatedSohMap[vi.pr1_item_id] = {
        validated_soh: vi.validated_soh,
        warehouse_decision: 'validated',
      };
    });
  }

  // Merge validated_soh into items
  const itemsWithValidation = items.map((item: PR1Item) => ({
    ...item,
    validated_soh: validatedSohMap[item.id]?.validated_soh ?? null,
    warehouse_decision: validatedSohMap[item.id]?.warehouse_decision ?? null,
  }));

  return {
    ...row,
    items: itemsWithValidation,
  };
}

export async function checkPR1NumberExists(
  pr1Number: string,
  excludeId?: string
): Promise<boolean> {
  let query = db
    .from('pr1_requests')
    .select('id')
    .eq('pr1_number', pr1Number.trim());

  if (excludeId) {
    query = query.neq('id', excludeId);
  }

  const { data } = await query;
  return (data?.length ?? 0) > 0;
}

export async function fetchDownstreamStage(pr1Id: string): Promise<DownstreamStage> {
  try {
    // Step 1: Check if PR2 exists
    const { data: pr2 } = await db
      .from('pr2_requests')
      .select('id, rfq_id')
      .eq('pr1_id', pr1Id)
      .maybeSingle();

    if (!pr2) return 'PR1 Approval';

    // Step 2: Check if PO exists (required for delivery lookup)
    const { data: po } = await db
      .from('po_requests')
      .select('id')
      .eq('pr2_id', pr2.id)
      .maybeSingle();

    if (!po) {
      // No PO yet, check if RFQ exists
      if (pr2.rfq_id) {
        return 'Canvassing';
      }
      return 'Processing (PR2)';
    }

    // Step 3: Check if delivery exists (correct table and FK)
    const { data: delivery } = await db
      .from('deliveries')
      .select('id')
      .eq('po_id', po.id)
      .maybeSingle();

    if (!delivery) return 'PO Issued';

    // Step 4: Check if GRN exists
    const { data: grn } = await db
      .from('grn_receipts')
      .select('id')
      .eq('delivery_id', delivery.id)
      .maybeSingle();

    if (grn) return 'Completed';

    // Step 5: Delivery exists but no GRN
    return 'For Delivery';
  } catch (err) {
    return 'PR1 Approval';
  }
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function saveDraftPR1(
  values: PR1FormValues,
  profile: UserProfile,
  existingId?: string
): Promise<string> {
  const header = {
    pr1_number:                  values.pr1_number.trim(),
    requisitioner_id:            profile.id,
    requisitioner_name_snapshot: profile.full_name,
    department_id:               profile.department_id,
    department_name_snapshot:    profile.department,
    purpose:                     values.purpose.trim(),
    date_required:               values.date_required,
    status:                      'draft' as const,
    updated_at:                  new Date().toISOString(),
  };

  let pr1Id: string;

  if (existingId) {
    const { error } = await db
      .from('pr1_requests')
      .update(header)
      .eq('id', existingId)
      .eq('status', 'draft');
    if (error) throw error;
    pr1Id = existingId;
  } else {
    const { data, error } = await db
      .from('pr1_requests')
      .insert(header)
      .select('id')
      .single();
    if (error) throw error;
    pr1Id = data.id;
  }

  await syncItems(pr1Id, values.items);
  return pr1Id;
}

// submitPR1 accepts an optional existingId.
// If no existingId, it creates the PR1 header first, then syncs items, then transitions status.
// This avoids the double-syncItems race that happens when saveDraftPR1 + submitPR1 are chained.
export async function submitPR1(
  values: PR1FormValues,
  profile: UserProfile,
  existingId?: string
): Promise<string> {
  const now = new Date().toISOString();

  let pr1Id: string;

  if (existingId) {
    pr1Id = existingId;
  } else {
    // Create the header record in draft state first
    const { data, error: insertErr } = await db
      .from('pr1_requests')
      .insert({
        pr1_number:                  values.pr1_number.trim(),
        requisitioner_id:            profile.id,
        requisitioner_name_snapshot: profile.full_name,
        department_id:               profile.department_id,
        department_name_snapshot:    profile.department,
        purpose:                     values.purpose.trim(),
        date_required:               values.date_required,
        status:                      'draft',
        updated_at:                  now,
      })
      .select('id')
      .single();
    if (insertErr) throw insertErr;
    pr1Id = data.id;
  }

  // Sync items — single call, no race
  await syncItems(pr1Id, values.items);

  // Transition header to submitted state
  const { data: updatedRows, error: headerErr } = await db
    .from('pr1_requests')
    .update({
      pr1_number:                   values.pr1_number.trim(),
      purpose:                      values.purpose.trim(),
      date_required:                values.date_required,
      status:                       'pending_warehouse',
      submitted_at:                 now,
      prepared_by_id:               profile.id,
      prepared_by_name_snapshot:    profile.full_name,
      prepared_by_position_snapshot: profile.position,
      prepared_at:                  now,
      updated_at:                   now,
    })
    .eq('id', pr1Id)
    .eq('status', 'draft')
    .select('id');

  if (headerErr) throw headerErr;
  if (!updatedRows || updatedRows.length === 0) {
    throw new Error('PR1 could not be submitted. It may have already been submitted or does not exist.');
  }

  // Audit log (best-effort, don't fail submit on log error)
  await db.from('audit_logs').insert({
    actor_id:      profile.id,
    action:        'PR1_SUBMITTED',
    document_type: 'PR1',
    document_id:   pr1Id,
    payload: {
      pr1_number: values.pr1_number.trim(),
      prepared_by: profile.full_name,
      position:    profile.position,
    },
  });

  return pr1Id;
}

// canUpdatePR1Priority checks if a user is authorized to update PR1 priority.
// Only procurement and approver roles are allowed.
export function canUpdatePR1Priority(profile: UserProfile): boolean {
  return profile.role === 'procurement' || profile.role === 'approver';
}

// updatePR1Priority updates the priority of a PR1 request.
// Authorized users (procurement or approver) can set priority to normal, medium, or high.
// The update includes audit logging (best-effort; audit failures do not fail the update).
export async function updatePR1Priority(
  pr1Id: string,
  priority: 'normal' | 'medium' | 'high',
  profile: UserProfile
): Promise<void> {
  // 1. Authorization check
  if (!canUpdatePR1Priority(profile)) {
    throw new Error(`User role '${profile.role}' is not authorized to update PR1 priority.`);
  }

  // 2. Validate priority value
  const validPriorities = ['normal', 'medium', 'high'];
  if (!validPriorities.includes(priority)) {
    throw new Error(`Invalid priority value: '${priority}'. Must be one of: ${validPriorities.join(', ')}`);
  }

  // 3. Fetch current PR1 to verify it exists and get old priority
  const { data: pr1, error: fetchErr } = await db
    .from('pr1_requests')
    .select('id, pr1_number, priority')
    .eq('id', pr1Id)
    .maybeSingle();

  if (fetchErr) throw fetchErr;
  if (!pr1) throw new Error(`PR1 not found (id: ${pr1Id}).`);

  const oldPriority = pr1.priority;

  // 4. Update priority and updated_at
  const now = new Date().toISOString();
  const { error: updateErr } = await db
    .from('pr1_requests')
    .update({ priority, updated_at: now })
    .eq('id', pr1Id);

  if (updateErr) throw updateErr;

  // 5. Audit log (best-effort; do not fail the update if logging fails)
  try {
    const { error: auditError } = await db
      .from('audit_logs')
      .insert({
        actor_id:      profile.id,
        action:        'PR1_PRIORITY_UPDATED',
        document_type: 'PR1',
        document_id:   pr1Id,
        payload: {
          pr1_number:   pr1.pr1_number,
          old_priority: oldPriority,
          new_priority: priority,
          updated_by:   profile.full_name,
          role:         profile.role,
          position:     profile.position,
        },
      });
    if (auditError) {
      console.warn('Failed to write priority audit log:', auditError);
    }
  } catch (auditError) {
    console.warn('Failed to write priority audit log:', auditError);
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function syncItems(pr1Id: string, items: PR1ItemDraft[]): Promise<void> {
  // Delete all existing items and re-insert (simplest safe approach for draft edits)
  const { error: delErr } = await db
    .from('pr1_items')
    .delete()
    .eq('pr1_id', pr1Id);
  if (delErr) throw delErr;

  const rows = items
    .filter(i => i.description.trim() !== '')
    .map((item, idx) => ({
      pr1_id:             pr1Id,
      item_order:         idx + 1,
      item_code:          item.item_code.trim(),
      description:        item.description.trim(),
      unit_of_measure:    item.unit_of_measure.trim(),
      stock_on_hand:      Number(item.stock_on_hand) || 0,
      quantity_requested: Number(item.quantity_requested) || 1,
    }));

  if (rows.length === 0) return;

  const { error: insErr } = await db.from('pr1_items').insert(rows);
  if (insErr) throw insErr;
}
