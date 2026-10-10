"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const warehouse_item_code_1 = require("./warehouse-item-code");
(0, node_test_1.test)('RFQ overlays change only explicitly mapped item codes, preserving blanks and original objects', () => {
    const items = [{ id: 'one', item_code: '001', quantity_requested: 7, price: 99 }, { id: 'two', item_code: '001', quantity_requested: 5, price: 42 }];
    const codes = (0, warehouse_item_code_1.checkedRfqWarehouseItemCodeSnapshots)([{ pr1_item_id: 'one', item_code: '' }]);
    const result = (0, warehouse_item_code_1.applyRfqWarehouseItemCodeSnapshots)(items, codes);
    strict_1.default.deepEqual(result, [{ ...items[0], item_code: '' }, items[1]]);
    strict_1.default.equal(items[0].item_code, '001');
    strict_1.default.equal(result[1], items[1]);
    strict_1.default.deepEqual((0, warehouse_item_code_1.applyRfqWarehouseItemCodeSnapshots)(items, new Map()), items);
    const otherRfq = (0, warehouse_item_code_1.checkedRfqWarehouseItemCodeSnapshots)([{ pr1_item_id: 'one', item_code: '002-OTHER' }]);
    strict_1.default.equal((0, warehouse_item_code_1.applyRfqWarehouseItemCodeSnapshots)(items, otherRfq)[0].item_code, '002-OTHER');
});
(0, node_test_1.test)('RFQ snapshot response requires string codes, exact IDs and no duplicates', () => {
    for (const bad of [null, {}, [null], [{ pr1_item_id: 'one', item_code: null }],
        [{ pr1_item_id: '', item_code: 'a' }], [{ pr1_item_id: 'one', item_code: 'a' }, { pr1_item_id: 'one', item_code: 'b' }]]) {
        strict_1.default.throws(() => (0, warehouse_item_code_1.checkedRfqWarehouseItemCodeSnapshots)(bad));
    }
    strict_1.default.equal((0, warehouse_item_code_1.checkedRfqWarehouseItemCodeSnapshots)([]).size, 0);
});
(0, node_test_1.test)('requires persisted response fields and preserves blank codes and text bigint IDs', () => {
    const row = { validation_id: 'v', validation_item_id: 'line', pr1_item_id: 'i', effective_code: '',
        original_pr1_code: '', correction_id: '9007199254740993', changed_at: '2026-10-10T00:00:00Z', changed_by_name: 'Warehouse' };
    strict_1.default.deepEqual((0, warehouse_item_code_1.checkedWarehouseItemCodeRows)([row], true), [row]);
    strict_1.default.deepEqual((0, warehouse_item_code_1.checkedWarehouseItemCodeRows)([{ ...row, correction_id: null, changed_at: null, changed_by_name: null }], false)[0].effective_code, '');
    for (const invalid of [null, undefined, {}, [null], [{ ...row, correction_id: 9007199254740993 }],
        [{ ...row, changed_at: null }], [{ ...row, effective_code: null }], [{ ...row, original_pr1_code: undefined }]]) {
        strict_1.default.throws(() => (0, warehouse_item_code_1.checkedWarehouseItemCodeRows)(invalid, true));
    }
});
(0, node_test_1.test)('normalizes only surrounding ASCII spaces and preserves code formatting', () => {
    strict_1.default.equal((0, warehouse_item_code_1.normalizeWarehouseItemCode)('  001-Ab /  02  '), '001-Ab /  02');
    strict_1.default.equal((0, warehouse_item_code_1.normalizeWarehouseItemCode)(' \t001\n\u00a0 '), '\t001\n\u00a0');
    strict_1.default.equal((0, warehouse_item_code_1.normalizeWarehouseItemCode)('   '), '');
    strict_1.default.throws(() => (0, warehouse_item_code_1.normalizeWarehouseItemCode)(null));
});
(0, node_test_1.test)('direct-edit read must agree on persisted current code, never an audit override', () => {
    const row = { validation_id: 'v', validation_item_id: 'line', pr1_item_id: 'i',
        original_pr1_code: 'OLD', effective_code: 'NEW', correction_id: '1',
        changed_at: '2026-10-10T00:00:00Z', changed_by_name: 'Warehouse' };
    strict_1.default.throws(() => (0, warehouse_item_code_1.checkedWarehouseItemCodeRows)([row], true));
    strict_1.default.deepEqual((0, warehouse_item_code_1.checkedWarehouseItemCodeRows)([{ ...row, original_pr1_code: 'NEW' }], true)[0].effective_code, 'NEW');
});
