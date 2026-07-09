'use client';

/**
 * Notes when warehouse changed a line's requested quantity away from what
 * the requestor originally asked for. Read-only, forwarded from
 * warehouse_validation_items through pr2_items (and downstream PO/GRN joins)
 * as a snapshot — PR1 stays the source of truth for the original ask.
 */
export default function WarehouseQtyOverrideNote({
  originalQty,
  currentQty,
  reason,
  overriddenBy,
}: {
  originalQty: number;
  currentQty: number;
  reason?: string | null;
  overriddenBy?: string | null;
}) {
  return (
    <p
      className="text-xs text-orange-700 italic mt-0.5 font-normal line-clamp-2 max-w-xs break-words"
      title={reason ?? undefined}
    >
      Qty adjusted by warehouse: {originalQty.toLocaleString()} → {currentQty.toLocaleString()}
      {reason ? ` — ${reason}` : ''}
      {overriddenBy ? ` (${overriddenBy})` : ''}
    </p>
  );
}
