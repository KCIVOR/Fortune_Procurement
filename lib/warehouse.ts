import { supabase } from '@/lib/supabase';
import { requireAuthUserId } from '@/lib/auth-session';
import type { UserProfile } from '@/types/auth';
import type {
  WarehouseValidationWithItems,
  WarehouseValidationItem,
  ValidationFormValues,
  WarehouseDecision,
  WarehouseTerminalAction,
  PR1QueueRow,
  WarehouseItemRoute,
  ItemAvailability,
} from '@/types/warehouse';
import { createNotification, notifyByRole } from '@/lib/notifications';

const db = supabase as any;

/** Derive per-line routing from verified SOH vs requested qty (persisted on submit). */
export function computeWarehouseItemRouting(
  validatedSoh: number,
  quantityRequested: number,
): {
  item_route: WarehouseItemRoute;
  internal_fulfilled_qty: number;
  procurement_qty: number;
  availability: ItemAvailability;
} {
  const soh = validatedSoh;
  const qty = quantityRequested;
  if (!Number.isFinite(soh) || !Number.isFinite(qty) || qty < 0 || soh < 0) {
    throw new Error('Invalid validated SOH or requested quantity');
  }
  if (soh >= qty) {
    return {
      item_route:            'internal',
      internal_fulfilled_qty: qty,
      procurement_qty:      0,
      availability:          'available',
    };
  }
  if (soh <= 0) {
    return {
      item_route:            'procurement',
      internal_fulfilled_qty: 0,
      procurement_qty:      qty,
      availability:          'unavailable',
    };
  }
  return {
    item_route:            'partial',
    internal_fulfilled_qty: soh,
    procurement_qty:      qty - soh,
    availability:          'unavailable',
  };
}

// ─── Queue ────────────────────────────────────────────────────────────────────

const WAREHOUSE_QUEUE_SELECT = `
  id,
  pr1_number,
  requisitioner_name_snapshot,
  department_name_snapshot,
  purpose,
  priority,
  request_type,
  date_required,
  submitted_at,
  status,
  warehouse_validations ( id, decision )
`;

function mapPr1QueueRow(row: any): PR1QueueRow {
  return {
    id:                          row.id,
    pr1_number:                  row.pr1_number,
    requisitioner_name_snapshot: row.requisitioner_name_snapshot,
    department_name_snapshot:    row.department_name_snapshot,
    purpose:                     row.purpose,
    priority:                    row.priority ?? 'normal',
    request_type:                row.request_type ?? 'goods',
    date_required:               row.date_required,
    submitted_at:                row.submitted_at,
    status:                      row.status,
    validation_id:               row.warehouse_validations?.[0]?.id ?? null,
    validation_decision:         row.warehouse_validations?.[0]?.decision ?? null,
  };
}

export async function fetchWarehouseQueue(): Promise<PR1QueueRow[]> {
  const { data, error } = await db
    .from('pr1_requests')
    .select(WAREHOUSE_QUEUE_SELECT)
    .eq('status', 'approved_for_warehouse')
    .order('submitted_at', { ascending: true });

  if (error) throw error;

  return (data ?? []).map(mapPr1QueueRow);
}

/** Paged queue for /warehouse list. Sort: oldest submitted first (unchanged). */
export async function fetchWarehouseQueuePaged(options: {
  limit:        number;
  offset:       number;
  search?:      string;
  priority?:    string;
  request_type?: string;
}): Promise<{ queue: PR1QueueRow[]; total_count: number }> {
  const { limit, offset, search, priority, request_type } = options;

  const applyFilters = (q: any) => {
    q = q.eq('status', 'approved_for_warehouse');

    if (priority && priority !== 'all') {
      q = q.eq('priority', priority);
    }

    if (request_type && request_type !== 'all') {
      q = q.eq('request_type', request_type);
    }

    const term = search?.trim();
    if (term) {
      const pattern = `%${term}%`;
      q = q.or(
        `pr1_number.ilike.${pattern},requisitioner_name_snapshot.ilike.${pattern},department_name_snapshot.ilike.${pattern},purpose.ilike.${pattern}`
      );
    }

    return q;
  };

  const listQuery = applyFilters(
    db.from('pr1_requests').select(WAREHOUSE_QUEUE_SELECT)
  )
    .order('submitted_at', { ascending: true })
    .range(offset, offset + limit - 1);

  const countQuery = applyFilters(
    db.from('pr1_requests').select('id', { count: 'exact', head: true })
  );

  const [listRes, countRes] = await Promise.all([listQuery, countQuery]);

  if (listRes.error) throw listRes.error;
  if (countRes.error) throw countRes.error;

  return {
    queue:       (listRes.data ?? []).map(mapPr1QueueRow),
    total_count: countRes.count ?? 0,
  };
}

/** Full-queue validation breakdown for stat cards (not limited to current page). */
export async function fetchWarehouseQueueStatCounts(): Promise<{
  pendingReview: number;
  sufficient: number;
  insufficient: number;
}> {
  const { data, error } = await db
    .from('pr1_requests')
    .select('warehouse_validations(decision)')
    .eq('status', 'approved_for_warehouse');

  if (error) throw error;

  let pendingReview = 0;
  let sufficient = 0;
  let insufficient = 0;
  for (const row of data ?? []) {
    const d = row.warehouse_validations?.[0]?.decision ?? null;
    if (d === 'sufficient') sufficient++;
    else if (d === 'insufficient') insufficient++;
    else pendingReview++;
  }
  return { pendingReview, sufficient, insufficient };
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

  const authUserId = await requireAuthUserId();

  // Insert header without RETURNING — avoids a second RLS SELECT check on insert
  // (?select=id was failing after Phase 1E even when WITH CHECK passed).
  const { error: vErr } = await db
    .from('warehouse_validations')
    .insert({
      pr1_id:                      pr1Id,
      validator_id:                authUserId,
      validator_name_snapshot:     profile.full_name,
      validator_position_snapshot: profile.position,
      decision:                    null,
      notes:                       '',
      updated_at:                  new Date().toISOString(),
    });

  if (vErr) {
    // Postgres unique_violation code = '23505'
    if (vErr.code === '23505') {
      const fallback = await fetchValidationByPR1Id(pr1Id);
      if (fallback) return fallback;
    }
    throw vErr;
  }

  const created = await fetchValidationByPR1Id(pr1Id);
  if (!created) {
    throw new Error('Failed to retrieve validation record after creation.');
  }

  // Seed validation items
  const itemRows = (pr1Items ?? []).map((item: any) => ({
    validation_id:      created.id,
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
    const sohRaw = item.validated_soh;
    const soh =
      sohRaw === '' || sohRaw === null || sohRaw === undefined
        ? null
        : Number(sohRaw);

    let availability: ItemAvailability | null = null;
    if (soh !== null && Number.isFinite(soh) && soh >= 0) {
      try {
        availability = computeWarehouseItemRouting(soh, item.quantity_requested).availability;
      } catch {
        availability = null;
      }
    }

    const { error: iErr } = await db
      .from('warehouse_validation_items')
      .update({
        validated_soh: soh,
        availability,
        item_notes:    item.item_notes,
      })
      .eq('id', item.id)
      .eq('validation_id', validationId);

    if (iErr) throw iErr;
  }
}

// ─── Reject or request revision (no SOH required) ──────────────────────────

export async function submitWarehouseTerminalAction(
  validationId: string,
  pr1Id: string,
  action: WarehouseTerminalAction,
  remarks: string,
  profile: UserProfile,
): Promise<void> {
  const trimmed = remarks.trim();
  if (!trimmed) {
    throw new Error('Remarks are required when rejecting or requesting revision.');
  }

  const now = new Date().toISOString();
  const decision: WarehouseDecision = action;
  const nextPR1Status = action === 'rejected' ? 'rejected' : 'revision_requested';

  const { error: vErr } = await db
    .from('warehouse_validations')
    .update({
      decision,
      notes:                       trimmed,
      validator_id:                profile.id,
      validator_name_snapshot:     profile.full_name,
      validator_position_snapshot: profile.position,
      validated_at:                now,
      updated_at:                  now,
    })
    .eq('id', validationId)
    .is('decision', null);

  if (vErr) throw vErr;

  const { data: updatedRows, error: pr1Err } = await db
    .from('pr1_requests')
    .update({
      status:     nextPR1Status,
      updated_at: now,
    })
    .eq('id', pr1Id)
    .eq('status', 'approved_for_warehouse')
    .select('id');

  if (pr1Err) throw pr1Err;
  if (!updatedRows || updatedRows.length === 0) {
    throw new Error('PR1 status could not be updated. It may have already been processed.');
  }

  await db.from('audit_logs').insert({
    actor_id:      profile.id,
    action:        action === 'rejected'
                     ? 'WAREHOUSE_REJECTED'
                     : 'WAREHOUSE_REVISION_REQUESTED',
    document_type: 'PR1',
    document_id:   pr1Id,
    payload: {
      validation_id: validationId,
      decision,
      remarks:       trimmed,
      validated_by:  profile.full_name,
      position:      profile.position,
      next_status:   nextPR1Status,
    },
  });

  try {
    const { data: pr1Row } = await db
      .from('pr1_requests')
      .select('pr1_number, requisitioner_id')
      .eq('id', pr1Id)
      .maybeSingle();

    if (pr1Row?.requisitioner_id) {
      if (action === 'rejected') {
        await createNotification({
          user_id:       pr1Row.requisitioner_id,
          title:         'PR1 Rejected by Warehouse',
          body:          `PR1 ${pr1Row.pr1_number} was rejected during warehouse validation.`,
          type:          'rejected',
          document_type: 'pr1',
          document_id:   pr1Id,
          action_url:    `/pr1/${pr1Id}`,
        });
      } else {
        await createNotification({
          user_id:       pr1Row.requisitioner_id,
          title:         'PR1 Revision Requested',
          body:          `Warehouse requested revisions on PR1 ${pr1Row.pr1_number}.`,
          type:          'action_required',
          document_type: 'pr1',
          document_id:   pr1Id,
          action_url:    `/pr1/${pr1Id}/edit`,
        });
      }
    }
  } catch {
    // Notifications are best-effort
  }
}

// ─── Submit final decision ────────────────────────────────────────────────────

export async function submitValidationDecision(
  validationId: string,
  pr1Id: string,
  values: ValidationFormValues,
  profile: UserProfile
): Promise<void> {
  const now = new Date().toISOString();

  const itemPayloads: Array<{
    item_route: WarehouseItemRoute;
    internal_fulfilled_qty: number;
    procurement_qty: number;
    availability: ItemAvailability;
    validated_soh: number;
  }> = [];

  for (const item of values.items) {
    const sohRaw = item.validated_soh;
    if (sohRaw === '' || sohRaw === null || sohRaw === undefined) {
      throw new Error('Enter verified SOH for every line before submitting.');
    }
    const soh = Number(sohRaw);
    if (!Number.isFinite(soh) || soh < 0) {
      throw new Error(
        `Invalid verified SOH for item ${item.item_code || `#${item.item_order}`}.`
      );
    }
    const r = computeWarehouseItemRouting(soh, item.quantity_requested);
    itemPayloads.push({
      item_route:            r.item_route,
      internal_fulfilled_qty: r.internal_fulfilled_qty,
      procurement_qty:      r.procurement_qty,
      availability:          r.availability,
      validated_soh:         soh,
    });
  }

  const decision: WarehouseDecision = itemPayloads.every(
    p => p.item_route === 'internal'
  )
    ? 'sufficient'
    : 'insufficient';

  const { error: hErr } = await db
    .from('warehouse_validations')
    .update({
      notes:      values.notes,
      updated_at: now,
    })
    .eq('id', validationId);

  if (hErr) throw hErr;

  for (let i = 0; i < values.items.length; i++) {
    const item = values.items[i];
    const p    = itemPayloads[i];
    const { error: iErr } = await db
      .from('warehouse_validation_items')
      .update({
        validated_soh:          p.validated_soh,
        availability:           p.availability,
        item_notes:             item.item_notes,
        item_route:             p.item_route,
        internal_fulfilled_qty: p.internal_fulfilled_qty,
        procurement_qty:      p.procurement_qty,
      })
      .eq('id', item.id)
      .eq('validation_id', validationId);

    if (iErr) throw iErr;
  }

  // Map decision to PR1 status
  // sufficient   → resolved_internal (closed, stock on hand covers request)
  // insufficient → for_canvassing (routes to procurement for canvassing)
  const nextPR1Status = decision === 'sufficient'
    ? 'resolved_internal'
    : 'for_canvassing';

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
    .eq('status', 'approved_for_warehouse')
    .select('id');

  if (pr1Err) throw pr1Err;
  if (!updatedRows || updatedRows.length === 0) {
    throw new Error('PR1 status could not be updated. It may have already been processed.');
  }

  // For insufficient decisions: notify procurement to begin canvassing
  if (decision === 'insufficient') {
    try {
      const { data: pr1Row } = await db
        .from('pr1_requests')
        .select('pr1_number')
        .eq('id', pr1Id)
        .maybeSingle();

      await notifyByRole(
        'procurement',
        {
          title:         'PR1 Ready for Canvassing',
          body:          `PR1 ${pr1Row?.pr1_number ?? pr1Id} has been validated — items require procurement.`,
          type:          'action_required',
          document_type: 'pr1',
          document_id:   pr1Id,
          action_url:    `/pr1/${pr1Id}`,
        },
        { dedupeUnreadForDocument: true }
      );
    } catch {
      // Notifications are best-effort; do not fail the validation
    }
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
      item_routes:   values.items.map((it, idx) => ({
        pr1_item_id: it.pr1_item_id,
        item_order:  it.item_order,
        ...itemPayloads[idx],
      })),
      derived_all_internal: decision === 'sufficient',
    },
  });

  if (decision === 'sufficient') {
    try {
      const { data: pr1Row } = await db
        .from('pr1_requests')
        .select('pr1_number, requisitioner_id')
        .eq('id', pr1Id)
        .maybeSingle();

      if (pr1Row?.requisitioner_id) {
        await createNotification({
          user_id:       pr1Row.requisitioner_id,
          title:         'Request Fulfilled from Stock',
          body:          `PR1 ${pr1Row.pr1_number} was fulfilled from warehouse stock.`,
          type:          'approved',
          document_type: 'pr1',
          document_id:   pr1Id,
          action_url:    `/pr1/${pr1Id}`,
        });
      }
    } catch {
      // Notifications are best-effort; do not fail validation
    }
  }
}