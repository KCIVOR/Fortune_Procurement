import { supabase } from './supabase';
import { checkedWarehouseItemCodeRows, normalizeWarehouseItemCode, checkedRfqWarehouseItemCodeSnapshots } from './warehouse-item-code';

/** Always read trusted snapshots; authorization is enforced by the database. */
export async function getRfqWarehouseItemCodeSnapshots(rfqId: string): Promise<ReadonlyMap<string, string>> {
  const { data, error } = await supabase.rpc('get_rfq_warehouse_item_code_snapshots', { p_rfq_id: rfqId });
  if (error) throw error;
  return checkedRfqWarehouseItemCodeSnapshots(data);
}

/** UI eligibility hint only. The save RPC checks all headers independently of caller RLS. */
export async function hasCurrentWarehouseItemCodePR2(pr1Id: string): Promise<boolean> {
  const { data, error } = await supabase.from('pr2_requests').select('id').eq('pr1_id', pr1Id).limit(1);
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error('Missing current PR2 response.');
  return data.length > 0;
}

/** Reads agreeing current PR1/validation codes through the authenticated checked RPC. */
export async function getWarehouseItemCodes(validationId: string) {
  const { data, error } = await supabase.rpc('get_warehouse_item_codes', { p_validation_id: validationId });
  if (error) throw error;
  const rows = checkedWarehouseItemCodeRows(data, true);
  const itemIds = new Set<string>();
  const lineIds = new Set<string>();
  for (const row of rows) {
    if (row.validation_id !== validationId || itemIds.has(row.pr1_item_id) || lineIds.has(row.validation_item_id)) {
      throw new Error('Mismatched or duplicate persisted item-code response.');
    }
    itemIds.add(row.pr1_item_id);
    lineIds.add(row.validation_item_id);
  }
  return rows;
}

/** Atomically edits both existing code copies on the server; audit is not an override. */
export async function updateWarehouseItemCode(validationItemId: string, expectedCode: string, newCode: string) {
  if (typeof expectedCode !== 'string') throw new Error('Expected item code must be a string.');
  const { data, error } = await supabase.rpc('update_warehouse_item_code', {
    p_validation_item_id: validationItemId,
    p_expected_code: expectedCode,
    p_new_code: normalizeWarehouseItemCode(newCode),
  });
  if (error) throw error;
  const rows = checkedWarehouseItemCodeRows(data, false);
  if (rows.length !== 1 || rows[0].validation_item_id !== validationItemId) {
    throw new Error('Missing or mismatched persisted item-code save response.');
  }
  return rows[0];
}
