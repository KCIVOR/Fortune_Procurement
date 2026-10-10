import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeWarehouseItemCode, checkedWarehouseItemCodeRows, checkedRfqWarehouseItemCodeSnapshots, applyRfqWarehouseItemCodeSnapshots } from './warehouse-item-code';

test('RFQ overlays change only explicitly mapped item codes, preserving blanks and original objects', () => {
  const items = [{ id: 'one', item_code: '001', quantity_requested: 7, price: 99 }, { id: 'two', item_code: '001', quantity_requested: 5, price: 42 }];
  const codes = checkedRfqWarehouseItemCodeSnapshots([{ pr1_item_id: 'one', item_code: '' }]);
  const result = applyRfqWarehouseItemCodeSnapshots(items, codes);
  assert.deepEqual(result, [{ ...items[0], item_code: '' }, items[1]]);
  assert.equal(items[0].item_code, '001');
  assert.equal(result[1], items[1]);
  assert.deepEqual(applyRfqWarehouseItemCodeSnapshots(items, new Map()), items);
  const otherRfq = checkedRfqWarehouseItemCodeSnapshots([{ pr1_item_id: 'one', item_code: '002-OTHER' }]);
  assert.equal(applyRfqWarehouseItemCodeSnapshots(items, otherRfq)[0].item_code, '002-OTHER');
});

test('RFQ snapshot response requires string codes, exact IDs and no duplicates', () => {
  for (const bad of [null, {}, [null], [{ pr1_item_id: 'one', item_code: null }],
    [{ pr1_item_id: '', item_code: 'a' }], [{ pr1_item_id: 'one', item_code: 'a' }, { pr1_item_id: 'one', item_code: 'b' }]]) {
    assert.throws(() => checkedRfqWarehouseItemCodeSnapshots(bad));
  }
  assert.equal(checkedRfqWarehouseItemCodeSnapshots([]).size, 0);
});

test('requires persisted response fields and preserves blank codes and text bigint IDs', () => {
  const row = { validation_id: 'v', validation_item_id: 'line', pr1_item_id: 'i', effective_code: '',
    original_pr1_code: '', correction_id: '9007199254740993', changed_at: '2026-10-10T00:00:00Z', changed_by_name: 'Warehouse' };
  assert.deepEqual(checkedWarehouseItemCodeRows([row], true), [row]);
  assert.deepEqual(checkedWarehouseItemCodeRows([{ ...row, correction_id: null, changed_at: null, changed_by_name: null }], false)[0].effective_code, '');
  for (const invalid of [null, undefined, {}, [null], [{ ...row, correction_id: 9007199254740993 }],
    [{ ...row, changed_at: null }], [{ ...row, effective_code: null }], [{ ...row, original_pr1_code: undefined }]]) {
    assert.throws(() => checkedWarehouseItemCodeRows(invalid, true));
  }
});

test('normalizes only surrounding ASCII spaces and preserves code formatting', () => {
  assert.equal(normalizeWarehouseItemCode('  001-Ab /  02  '), '001-Ab /  02');
  assert.equal(normalizeWarehouseItemCode(' \t001\n\u00a0 '), '\t001\n\u00a0');
  assert.equal(normalizeWarehouseItemCode('   '), '');
  assert.throws(() => normalizeWarehouseItemCode(null as unknown as string));
});

test('direct-edit read must agree on persisted current code, never an audit override', () => {
  const row = { validation_id: 'v', validation_item_id: 'line', pr1_item_id: 'i',
    original_pr1_code: 'OLD', effective_code: 'NEW', correction_id: '1',
    changed_at: '2026-10-10T00:00:00Z', changed_by_name: 'Warehouse' };
  assert.throws(() => checkedWarehouseItemCodeRows([row], true));
  assert.deepEqual(checkedWarehouseItemCodeRows([{ ...row, original_pr1_code: 'NEW' }], true)[0].effective_code, 'NEW');
});

