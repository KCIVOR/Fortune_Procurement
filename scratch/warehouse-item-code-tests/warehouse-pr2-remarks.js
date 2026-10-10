"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeWarehouseRemarksIntoPr2Items = exports.applyWarehouseSohToPr2Item = exports.applyWarehouseRemarksToPr2Item = exports.EMPTY_WAREHOUSE_REMARKS = void 0;
exports.EMPTY_WAREHOUSE_REMARKS = {
    notes: null,
    byPr1ItemId: {},
};
function blankToNull(value) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
}
function applyWarehouseRemarksToPr2Item(item, remark) {
    return {
        quantity_override_reason_snapshot: blankToNull(item.quantity_override_reason_snapshot) ?? blankToNull(remark?.overrideReason),
        quantity_overridden_by_name_snapshot: blankToNull(item.quantity_overridden_by_name_snapshot) ?? blankToNull(remark?.overriddenByName),
        warehouse_item_notes: blankToNull(remark?.itemNotes),
    };
}
exports.applyWarehouseRemarksToPr2Item = applyWarehouseRemarksToPr2Item;
function applyWarehouseSohToPr2Item(item, remark) {
    const soh = remark?.validatedSoh;
    if (soh === null || soh === undefined || !Number.isFinite(Number(soh))) {
        return { qty_on_hand: Number(item.qty_on_hand) || 0 };
    }
    return { qty_on_hand: Number(soh) };
}
exports.applyWarehouseSohToPr2Item = applyWarehouseSohToPr2Item;
function mergeWarehouseRemarksIntoPr2Items(items, remarks) {
    return items.map((item) => {
        const remark = item.pr1_item_id ? remarks.byPr1ItemId[item.pr1_item_id] ?? null : null;
        return {
            ...item,
            ...applyWarehouseRemarksToPr2Item(item, remark),
            ...applyWarehouseSohToPr2Item(item, remark),
        };
    });
}
exports.mergeWarehouseRemarksIntoPr2Items = mergeWarehouseRemarksIntoPr2Items;
