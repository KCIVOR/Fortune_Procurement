"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyRfqWarehouseItemCodeSnapshots = exports.checkedRfqWarehouseItemCodeSnapshots = exports.checkedWarehouseItemCodeRows = exports.normalizeWarehouseItemCode = void 0;
// Dependency-free helpers. Current codes must come from checked database output.
function normalizeWarehouseItemCode(value) {
    if (typeof value !== 'string')
        throw new Error('Item code must be a string.');
    return value.replace(/^ +| +$/g, '');
}
exports.normalizeWarehouseItemCode = normalizeWarehouseItemCode;
function checkedWarehouseItemCodeRows(data, read) {
    if (!Array.isArray(data))
        throw new Error('Missing persisted item-code response.');
    for (const row of data) {
        if (!row || typeof row !== 'object' ||
            !['validation_id', 'validation_item_id', 'pr1_item_id'].every(key => typeof row[key] === 'string' && row[key].length > 0) ||
            typeof row.effective_code !== 'string' ||
            (read && (typeof row.original_pr1_code !== 'string' || row.original_pr1_code !== row.effective_code)) ||
            !(row.correction_id === null || (typeof row.correction_id === 'string' && /^[1-9][0-9]*$/.test(row.correction_id))) ||
            !(row.changed_at === null || (typeof row.changed_at === 'string' && Number.isFinite(Date.parse(row.changed_at)))) ||
            !(row.changed_by_name === null || typeof row.changed_by_name === 'string') ||
            (row.correction_id === null ? row.changed_at !== null || row.changed_by_name !== null : row.changed_at === null || row.changed_by_name === null)) {
            throw new Error('Invalid persisted item-code response.');
        }
    }
    return data;
}
exports.checkedWarehouseItemCodeRows = checkedWarehouseItemCodeRows;
function checkedRfqWarehouseItemCodeSnapshots(data) {
    if (!Array.isArray(data))
        throw new Error('Missing persisted RFQ item-code response.');
    const codes = new Map();
    for (const row of data) {
        if (!row || typeof row.pr1_item_id !== 'string' || !row.pr1_item_id || typeof row.item_code !== 'string' || codes.has(row.pr1_item_id)) {
            throw new Error('Invalid or duplicate persisted RFQ item-code response.');
        }
        codes.set(row.pr1_item_id, row.item_code);
    }
    return codes;
}
exports.checkedRfqWarehouseItemCodeSnapshots = checkedRfqWarehouseItemCodeSnapshots;
function applyRfqWarehouseItemCodeSnapshots(items, codes) {
    return items.map(item => codes.has(item.id) ? { ...item, item_code: codes.get(item.id) } : item);
}
exports.applyRfqWarehouseItemCodeSnapshots = applyRfqWarehouseItemCodeSnapshots;
