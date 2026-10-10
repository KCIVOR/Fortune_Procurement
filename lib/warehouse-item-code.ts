// Dependency-free helpers. Current codes must come from checked database output.
export function normalizeWarehouseItemCode(value: string): string {
  if (typeof value !== 'string') throw new Error('Item code must be a string.');
  return value.replace(/^ +| +$/g, '');
}

export interface WarehouseItemCodeSaveResult {
  validation_id: string;
  validation_item_id: string;
  pr1_item_id: string;
  effective_code: string;
  correction_id: string | null;
  changed_at: string | null;
  changed_by_name: string | null;
}

export interface WarehouseItemCodeReadResult extends WarehouseItemCodeSaveResult {
  // Compatibility RPC field: the current PR1 code, not an unchanged requester baseline.
  original_pr1_code: string;
}

export function checkedWarehouseItemCodeRows(data: unknown, read: true): WarehouseItemCodeReadResult[];
export function checkedWarehouseItemCodeRows(data: unknown, read: false): WarehouseItemCodeSaveResult[];
export function checkedWarehouseItemCodeRows(data: unknown, read: boolean): WarehouseItemCodeSaveResult[] {
  if (!Array.isArray(data)) throw new Error('Missing persisted item-code response.');
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

export function checkedRfqWarehouseItemCodeSnapshots(data: unknown): ReadonlyMap<string, string> {
  if (!Array.isArray(data)) throw new Error('Missing persisted RFQ item-code response.');
  const codes = new Map<string, string>();
  for (const row of data) {
    if (!row || typeof row.pr1_item_id !== 'string' || !row.pr1_item_id || typeof row.item_code !== 'string' || codes.has(row.pr1_item_id)) {
      throw new Error('Invalid or duplicate persisted RFQ item-code response.');
    }
    codes.set(row.pr1_item_id, row.item_code);
  }
  return codes;
}

export function applyRfqWarehouseItemCodeSnapshots<T extends { id: string; item_code: string }>(
  items: readonly T[], codes: ReadonlyMap<string, string>,
): T[] {
  return items.map(item => codes.has(item.id) ? { ...item, item_code: codes.get(item.id)! } : item);
}
