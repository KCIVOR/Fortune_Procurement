export type WarehouseLineRemark = {
  overrideReason: string | null;
  overriddenByName: string | null;
  itemNotes: string | null;
  validatedSoh?: number | null;
};

export type WarehouseRemarksForPr1 = {
  notes: string | null;
  byPr1ItemId: Record<string, WarehouseLineRemark>;
};

export const EMPTY_WAREHOUSE_REMARKS: WarehouseRemarksForPr1 = {
  notes: null,
  byPr1ItemId: {},
};

function blankToNull(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function applyWarehouseRemarksToPr2Item(
  item: {
    quantity_override_reason_snapshot?: string | null;
    quantity_overridden_by_name_snapshot?: string | null;
  },
  remark: WarehouseLineRemark | null,
): {
  quantity_override_reason_snapshot: string | null;
  quantity_overridden_by_name_snapshot: string | null;
  warehouse_item_notes: string | null;
} {
  return {
    quantity_override_reason_snapshot:
      blankToNull(item.quantity_override_reason_snapshot) ?? blankToNull(remark?.overrideReason),
    quantity_overridden_by_name_snapshot:
      blankToNull(item.quantity_overridden_by_name_snapshot) ?? blankToNull(remark?.overriddenByName),
    warehouse_item_notes: blankToNull(remark?.itemNotes),
  };
}

export function applyWarehouseSohToPr2Item(
  item: { qty_on_hand?: number | null },
  remark: { validatedSoh?: number | null } | null,
): { qty_on_hand: number } {
  const soh = remark?.validatedSoh;
  if (soh === null || soh === undefined || !Number.isFinite(Number(soh))) {
    return { qty_on_hand: Number(item.qty_on_hand) || 0 };
  }
  return { qty_on_hand: Number(soh) };
}

export function mergeWarehouseRemarksIntoPr2Items<
  T extends {
    pr1_item_id?: string | null;
    quantity_override_reason_snapshot?: string | null;
    quantity_overridden_by_name_snapshot?: string | null;
    qty_on_hand?: number | null;
  },
>(items: T[], remarks: WarehouseRemarksForPr1): Array<T & { warehouse_item_notes: string | null; qty_on_hand: number }> {
  return items.map((item) => {
    const remark = item.pr1_item_id ? remarks.byPr1ItemId[item.pr1_item_id] ?? null : null;
    return {
      ...item,
      ...applyWarehouseRemarksToPr2Item(item, remark),
      ...applyWarehouseSohToPr2Item(item, remark),
    };
  });
}
