"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const warehouse_pr2_remarks_1 = require("./warehouse-pr2-remarks");
(0, node_test_1.test)('fills empty PR2 override reason from warehouse remarks', () => {
    const merged = (0, warehouse_pr2_remarks_1.applyWarehouseRemarksToPr2Item)({ quantity_override_reason_snapshot: null, quantity_overridden_by_name_snapshot: null }, { overrideReason: 'Partial stock issued', overriddenByName: 'Pedro Santos', itemNotes: 'Issue 8 from shelf A' });
    strict_1.default.equal(merged.quantity_override_reason_snapshot, 'Partial stock issued');
    strict_1.default.equal(merged.quantity_overridden_by_name_snapshot, 'Pedro Santos');
    strict_1.default.equal(merged.warehouse_item_notes, 'Issue 8 from shelf A');
});
(0, node_test_1.test)('keeps an existing PR2 override snapshot', () => {
    const merged = (0, warehouse_pr2_remarks_1.applyWarehouseRemarksToPr2Item)({ quantity_override_reason_snapshot: 'Already snapshotted', quantity_overridden_by_name_snapshot: 'Stored Name' }, { overrideReason: 'Newer warehouse reason', overriddenByName: 'Pedro Santos', itemNotes: 'Note' });
    strict_1.default.equal(merged.quantity_override_reason_snapshot, 'Already snapshotted');
    strict_1.default.equal(merged.quantity_overridden_by_name_snapshot, 'Stored Name');
    strict_1.default.equal(merged.warehouse_item_notes, 'Note');
});
(0, node_test_1.test)('returns empty notes when warehouse left no remarks', () => {
    const merged = (0, warehouse_pr2_remarks_1.applyWarehouseRemarksToPr2Item)({ quantity_override_reason_snapshot: null, quantity_overridden_by_name_snapshot: null }, null);
    strict_1.default.equal(merged.quantity_override_reason_snapshot, null);
    strict_1.default.equal(merged.quantity_overridden_by_name_snapshot, null);
    strict_1.default.equal(merged.warehouse_item_notes, null);
});
(0, node_test_1.test)('copies warehouse verified SOH onto a PR2 line that stored 0', () => {
    const merged = (0, warehouse_pr2_remarks_1.applyWarehouseSohToPr2Item)({ qty_on_hand: 0 }, { validatedSoh: 3 });
    strict_1.default.equal(merged.qty_on_hand, 3);
});
(0, node_test_1.test)('keeps warehouse SOH of 0 (zero stock is valid)', () => {
    const merged = (0, warehouse_pr2_remarks_1.applyWarehouseSohToPr2Item)({ qty_on_hand: 9 }, { validatedSoh: 0 });
    strict_1.default.equal(merged.qty_on_hand, 0);
});
(0, node_test_1.test)('keeps stored SOH when warehouse has no verified value', () => {
    const merged = (0, warehouse_pr2_remarks_1.applyWarehouseSohToPr2Item)({ qty_on_hand: 4 }, { validatedSoh: null });
    strict_1.default.equal(merged.qty_on_hand, 4);
});
(0, node_test_1.test)('keeps stored SOH when there is no warehouse line', () => {
    const merged = (0, warehouse_pr2_remarks_1.applyWarehouseSohToPr2Item)({ qty_on_hand: 4 }, null);
    strict_1.default.equal(merged.qty_on_hand, 4);
});
