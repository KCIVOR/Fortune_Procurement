import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/auth';
import { submitPR2ForApproval } from '@/lib/pr2-approvals';

const db = supabase as any;

/**
 * Goods and Services: create PR2 from warehouse validation (Prepared By =
 * warehouse), then auto-start PR2_FINAL approval. Supplier/price fields stay
 * empty until RFQ sync (Phase 4).
 */
export async function createPR2FromWarehouseValidation(
  pr1Id: string,
  validationId: string,
  profile: UserProfile,
  pr2NumberInput: string,
): Promise<string> {
  const now = new Date().toISOString();
  const pr2Number = pr2NumberInput.trim();
  if (!pr2Number) throw new Error('PR2 number is required.');

  // Idempotency: one PR2 per PR1 for goods
  const { data: existing } = await db
    .from('pr2_requests')
    .select('id, status')
    .eq('pr1_id', pr1Id)
    .maybeSingle();
  if (existing?.id) {
    if (existing.status === 'draft') {
      await submitPR2ForApproval(existing.id, profile);
    }
    return existing.id;
  }

  const { data: dup } = await db
    .from('pr2_requests')
    .select('id')
    .eq('pr2_number', pr2Number)
    .maybeSingle();
  if (dup?.id) throw new Error(`PR2 number ${pr2Number} is already in use.`);

  const { data: pr1, error: pr1Err } = await db
    .from('pr1_requests')
    .select(
      'id, pr1_number, request_type, requisitioner_id, requisitioner_name_snapshot, department_id, department_name_snapshot, purpose, date_required, status',
    )
    .eq('id', pr1Id)
    .maybeSingle();
  if (pr1Err) throw pr1Err;
  if (!pr1) throw new Error('PR1 not found.');
  if (pr1.request_type !== 'goods' && pr1.request_type !== 'services') {
    throw new Error('Warehouse PR2 creation is only supported for Goods and Services requests.');
  }
  if (pr1.status !== 'approved_for_warehouse') {
    throw new Error('PR1 must be awaiting warehouse validation before creating PR2.');
  }

  const { data: validation, error: valErr } = await db
    .from('warehouse_validations')
    .select('id, pr1_id')
    .eq('id', validationId)
    .eq('pr1_id', pr1Id)
    .maybeSingle();
  if (valErr) throw valErr;
  if (!validation) throw new Error('Warehouse validation not found.');

  const { data: valItems, error: itemsErr } = await db
    .from('warehouse_validation_items')
    .select('pr1_item_id, procurement_qty, quantity_requested')
    .eq('validation_id', validationId);
  if (itemsErr) throw itemsErr;

  const procurementLines = ((valItems ?? []) as any[]).filter(
    (row) => Number(row.procurement_qty) > 0,
  );
  if (procurementLines.length === 0) {
    throw new Error('No lines require procurement — cannot create PR2.');
  }

  const pr1ItemIds = procurementLines.map((r: any) => r.pr1_item_id as string);
  const { data: pr1Items, error: pr1ItemsErr } = await db
    .from('pr1_items')
    .select(
      'id, item_order, item_code, description, unit_of_measure, quantity_requested, is_raw_material, remarks',
    )
    .in('id', pr1ItemIds)
    .order('item_order', { ascending: true });
  if (pr1ItemsErr) throw pr1ItemsErr;

  const pr1ItemMap: Record<string, any> = Object.fromEntries(
    ((pr1Items ?? []) as any[]).map((i: any) => [i.id, i]),
  );
  const procurementByItem: Record<string, number> = Object.fromEntries(
    procurementLines.map((r: any) => [r.pr1_item_id, Number(r.procurement_qty)]),
  );

  const { data: pr2, error: pr2Err } = await db
    .from('pr2_requests')
    .insert({
      pr2_number:                    pr2Number,
      pr1_id:                        pr1.id,
      rfq_id:                        null,
      request_type:                  pr1.request_type,
      requisitioner_id:              pr1.requisitioner_id,
      requisitioner_name_snapshot:   pr1.requisitioner_name_snapshot,
      department_id:                 pr1.department_id,
      department_name_snapshot:      pr1.department_name_snapshot,
      purpose:                       pr1.purpose,
      date_required:                 pr1.date_required,
      pr1_number_snapshot:           pr1.pr1_number,
      rfq_number_snapshot:           '',
      status:                        'draft',
      generated_by:                  profile.id,
      generated_at:                  now,
      prepared_by_id:                profile.id,
      prepared_by_name_snapshot:     profile.full_name,
      prepared_by_position_snapshot: profile.position,
      prepared_at:                   now,
      updated_at:                    now,
    })
    .select('id')
    .single();
  if (pr2Err) {
    if (pr2Err.code === '23505' && String(pr2Err.message ?? '').includes('pr2_number')) {
      throw new Error(`PR2 number ${pr2Number} is already in use.`);
    }
    throw pr2Err;
  }

  const pr2Id = pr2.id as string;

  const itemRows = procurementLines
    .map((line: any) => {
      const item = pr1ItemMap[line.pr1_item_id];
      if (!item) return null;
      const qty = procurementByItem[item.id] ?? 0;
      return {
        pr2_id:                              pr2Id,
        item_order:                          item.item_order,
        item_code:                           item.item_code,
        description:                         item.description,
        unit_of_measure:                     item.unit_of_measure,
        pr1_item_id:                         item.id,
        quantity_requested:                  qty,
        qty_on_hand:                         0,
        qty_incoming:                        0,
        quantity_to_purchase:                qty,
        selected_rfq_supplier_id:            null,
        supplier_name_snapshot:              '',
        quoted_description:                  item.description,
        is_alternative:                      false,
        unit_price:                          0,
        lead_time_days:                      0,
        total_price:                         0,
        vat_type:                            null,
        vat_rate_applied:                    null,
        remarks:                             null,
        is_raw_material:                     item.is_raw_material === true,
        quote_justification:                 null,
        pr1_remarks_snapshot:                item.remarks ?? null,
        pr1_quantity_requested_snapshot:     Number(item.quantity_requested),
        quantity_override_reason_snapshot:   null,
        quantity_overridden_by_name_snapshot: null,
        rfq_item_quote_id:                   null,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  itemRows.sort((a, b) => a.item_order - b.item_order);

  if (itemRows.length === 0) {
    throw new Error('Could not build PR2 line items from warehouse validation.');
  }

  const { error: insertItemsErr } = await db.from('pr2_items').insert(itemRows);
  if (insertItemsErr) throw insertItemsErr;

  // PR1 → pr2_pending_approval (warehouse RLS allows this transition)
  const { data: updatedPr1, error: pr1UpdErr } = await db
    .from('pr1_requests')
    .update({ status: 'pr2_pending_approval', updated_at: now })
    .eq('id', pr1Id)
    .eq('status', 'approved_for_warehouse')
    .select('id');
  if (pr1UpdErr) throw pr1UpdErr;
  if (!updatedPr1 || updatedPr1.length === 0) {
    throw new Error('PR1 status could not be updated to pr2_pending_approval.');
  }

  await db.from('audit_logs').insert({
    actor_id:      profile.id,
    action:        'PR2_CREATED_FROM_WAREHOUSE',
    document_type: 'PR2',
    document_id:   pr2Id,
    payload: {
      pr2_number:    pr2Number,
      pr1_id:        pr1Id,
      validation_id: validationId,
      prepared_by:   profile.full_name,
      line_count:    itemRows.length,
    },
  });

  // Spec §5.2: PR2 enters approval immediately upon warehouse creation
  await submitPR2ForApproval(pr2Id, profile);

  return pr2Id;
}
