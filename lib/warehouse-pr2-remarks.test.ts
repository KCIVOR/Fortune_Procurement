import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyWarehouseRemarksToPr2Item, applyWarehouseSohToPr2Item } from './warehouse-pr2-remarks';

test('fills empty PR2 override reason from warehouse remarks', () => {
  const merged = applyWarehouseRemarksToPr2Item(
    { quantity_override_reason_snapshot: null, quantity_overridden_by_name_snapshot: null },
    { overrideReason: 'Partial stock issued', overriddenByName: 'Pedro Santos', itemNotes: 'Issue 8 from shelf A' },
  );

  assert.equal(merged.quantity_override_reason_snapshot, 'Partial stock issued');
  assert.equal(merged.quantity_overridden_by_name_snapshot, 'Pedro Santos');
  assert.equal(merged.warehouse_item_notes, 'Issue 8 from shelf A');
});

test('keeps an existing PR2 override snapshot', () => {
  const merged = applyWarehouseRemarksToPr2Item(
    { quantity_override_reason_snapshot: 'Already snapshotted', quantity_overridden_by_name_snapshot: 'Stored Name' },
    { overrideReason: 'Newer warehouse reason', overriddenByName: 'Pedro Santos', itemNotes: 'Note' },
  );

  assert.equal(merged.quantity_override_reason_snapshot, 'Already snapshotted');
  assert.equal(merged.quantity_overridden_by_name_snapshot, 'Stored Name');
  assert.equal(merged.warehouse_item_notes, 'Note');
});

test('returns empty notes when warehouse left no remarks', () => {
  const merged = applyWarehouseRemarksToPr2Item(
    { quantity_override_reason_snapshot: null, quantity_overridden_by_name_snapshot: null },
    null,
  );

  assert.equal(merged.quantity_override_reason_snapshot, null);
  assert.equal(merged.quantity_overridden_by_name_snapshot, null);
  assert.equal(merged.warehouse_item_notes, null);
});

test('copies warehouse verified SOH onto a PR2 line that stored 0', () => {
  const merged = applyWarehouseSohToPr2Item({ qty_on_hand: 0 }, { validatedSoh: 3 });
  assert.equal(merged.qty_on_hand, 3);
});

test('keeps warehouse SOH of 0 (zero stock is valid)', () => {
  const merged = applyWarehouseSohToPr2Item({ qty_on_hand: 9 }, { validatedSoh: 0 });
  assert.equal(merged.qty_on_hand, 0);
});

test('keeps stored SOH when warehouse has no verified value', () => {
  const merged = applyWarehouseSohToPr2Item({ qty_on_hand: 4 }, { validatedSoh: null });
  assert.equal(merged.qty_on_hand, 4);
});

test('keeps stored SOH when there is no warehouse line', () => {
  const merged = applyWarehouseSohToPr2Item({ qty_on_hand: 4 }, null);
  assert.equal(merged.qty_on_hand, 4);
});
