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
import { createPR2FromWarehouseValidation } from '@/lib/pr2-warehouse';

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
    .order('submitted_at', { ascending: false });

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
    .order('submitted_at', { ascending: false })
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

/** PR1's original per-line quantity_requested, keyed by pr1_item_id — the
 *  immutable baseline used to detect whether warehouse has overridden a line. */
async function fetchOriginalQuantitiesByPr1Item(
  pr1ItemIds: string[]
): Promise<Record<string, number>> {
  if (pr1ItemIds.length === 0) return {};
  const { data, error } = await db
    .from('pr1_items')
    .select('id, quantity_requested')
    .in('id', pr1ItemIds);
  if (error) throw error;
  const map: Record<string, number> = {};
  for (const row of data ?? []) {
    map[(row as any).id] = Number((row as any).quantity_requested);
  }
  return map;
}

// ─── Save in-progress validation ─────────────────────────────────────────────
// Not restricted to the original validator_id — any warehouse user can save.

export async function saveValidationProgress(
  validationId: string,
  values: ValidationFormValues,
  profile: UserProfile,
): Promise<void> {
  const { error: hErr } = await db
    .from('warehouse_validations')
    .update({
      notes:      values.notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', validationId);

  if (hErr) throw hErr;

  const originalQtyByPr1Item = await fetchOriginalQuantitiesByPr1Item(
    values.items.map(i => i.pr1_item_id)
  );
  const now = new Date().toISOString();

  for (const item of values.items) {
    const sohRaw = item.validated_soh;
    const soh =
      sohRaw === '' || sohRaw === null || sohRaw === undefined
        ? null
        : Number(sohRaw);

    const qty = Number(item.quantity_requested);
    const original = originalQtyByPr1Item[item.pr1_item_id];
    const isOverridden = Number.isFinite(original) && qty !== original;

    let availability: ItemAvailability | null = null;
    if (soh !== null && Number.isFinite(soh) && soh >= 0) {
      try {
        availability = computeWarehouseItemRouting(soh, qty).availability;
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
        quantity_requested:                   qty,
        quantity_override_reason:             isOverridden ? (item.quantity_override_reason.trim() || null) : null,
        quantity_overridden_by:               isOverridden ? profile.id : null,
        quantity_overridden_by_name_snapshot: isOverridden ? profile.full_name : null,
        quantity_overridden_at:               isOverridden ? now : null,
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
  profile: UserProfile,
  options?: { pr2Number?: string },
): Promise<{ pr2Id: string | null }> {
  const now = new Date().toISOString();

  const originalQtyByPr1Item = await fetchOriginalQuantitiesByPr1Item(
    values.items.map(i => i.pr1_item_id)
  );

  const itemPayloads: Array<{
    item_route: WarehouseItemRoute;
    internal_fulfilled_qty: number;
    procurement_qty: number;
    availability: ItemAvailability;
    validated_soh: number;
    quantity_requested: number;
    isOverridden: boolean;
    original_quantity_requested: number | null;
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

    const qty = Number(item.quantity_requested);
    const original = originalQtyByPr1Item[item.pr1_item_id];
    const isOverridden = Number.isFinite(original) && qty !== original;
    if (isOverridden && !item.quantity_override_reason.trim()) {
      throw new Error(
        `Reason required for adjusted quantity on item ${item.item_code || `#${item.item_order}`}.`
      );
    }

    const r = computeWarehouseItemRouting(soh, qty);
    itemPayloads.push({
      item_route:            r.item_route,
      internal_fulfilled_qty: r.internal_fulfilled_qty,
      procurement_qty:      r.procurement_qty,
      availability:          r.availability,
      validated_soh:         soh,
      quantity_requested:    qty,
      isOverridden,
      original_quantity_requested: Number.isFinite(original) ? original : null,
    });
  }

  const decision: WarehouseDecision = itemPayloads.every(
    p => p.item_route === 'internal'
  )
    ? 'sufficient'
    : 'insufficient';

  const { data: pr1Meta, error: pr1MetaErr } = await db
    .from('pr1_requests')
    .select('request_type, pr1_number')
    .eq('id', pr1Id)
    .maybeSingle();
  if (pr1MetaErr) throw pr1MetaErr;
  const requestType = pr1Meta?.request_type as string | undefined;
  // Goods and Services both get their PR2 created here by Warehouse; Raw
  // Material never reaches this function (no PR1/warehouse step for it).
  const createsPR2 = decision === 'insufficient' && (requestType === 'goods' || requestType === 'services');

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
        procurement_qty:        p.procurement_qty,
        quantity_requested:                   p.quantity_requested,
        quantity_override_reason:             p.isOverridden ? item.quantity_override_reason.trim() : null,
        quantity_overridden_by:               p.isOverridden ? profile.id : null,
        quantity_overridden_by_name_snapshot: p.isOverridden ? profile.full_name : null,
        quantity_overridden_at:               p.isOverridden ? now : null,
      })
      .eq('id', item.id)
      .eq('validation_id', validationId);

    if (iErr) throw iErr;
  }

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

  let pr2Id: string | null = null;
  let nextPR1Status: string;

  if (createsPR2) {
    const pr2Number = options?.pr2Number?.trim() ?? '';
    if (!pr2Number) throw new Error('PR2 number is required when routing Goods/Services to procurement.');
    // Goods/Services final flow: warehouse creates PR2 (sets PR1 → pr2_pending_approval)
    pr2Id = await createPR2FromWarehouseValidation(pr1Id, validationId, profile, pr2Number);
    nextPR1Status = 'pr2_pending_approval';
  } else {
    // sufficient → resolved_internal. (Goods/Services with insufficient items
    // both create a PR2 in the branch above, and raw_material never reaches this function.)
    nextPR1Status = 'resolved_internal';

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
  }

  // Quantity overrides: dedicated audit entry + requestor notice, separate
  // from the general validation audit log below so it's easy to filter/render.
  const overriddenLines = values.items
    .map((item, idx) => ({ item, p: itemPayloads[idx] }))
    .filter(({ p }) => p.isOverridden);

  if (overriddenLines.length > 0) {
    try {
      await db.from('audit_logs').insert({
        actor_id:      profile.id,
        action:        'WAREHOUSE_QTY_OVERRIDDEN',
        document_type: 'PR1',
        document_id:   pr1Id,
        payload: {
          validation_id: validationId,
          overridden_by: profile.full_name,
          position:      profile.position,
          items: overriddenLines.map(({ item, p }) => ({
            pr1_item_id:                  item.pr1_item_id,
            item_code:                    item.item_code,
            description:                  item.description,
            original_quantity_requested: p.original_quantity_requested,
            quantity_requested:           p.quantity_requested,
            reason:                       item.quantity_override_reason.trim(),
          })),
        },
      });
    } catch {
      // Audit logging is best-effort
    }

    try {
      const { data: pr1Row } = await db
        .from('pr1_requests')
        .select('pr1_number, requisitioner_id')
        .eq('id', pr1Id)
        .maybeSingle();

      if (pr1Row?.requisitioner_id) {
        await createNotification({
          user_id:       pr1Row.requisitioner_id,
          title:         'Requested Quantity Adjusted by Warehouse',
          body:          `Warehouse adjusted the requested quantity on ${overriddenLines.length} line${overriddenLines.length !== 1 ? 's' : ''} of PR1 ${pr1Row.pr1_number}.`,
          type:          'info',
          document_type: 'pr1',
          document_id:   pr1Id,
          action_url:    `/pr1/${pr1Id}`,
        });
      }
    } catch {
      // Notifications are best-effort
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
      pr2_id:        pr2Id,
      item_routes:   values.items.map((it, idx) => ({
        pr1_item_id: it.pr1_item_id,
        item_order:  it.item_order,
        item_route:  itemPayloads[idx].item_route,
        procurement_qty: itemPayloads[idx].procurement_qty,
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

  return { pr2Id };
}