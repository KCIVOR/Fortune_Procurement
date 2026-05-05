/*
  # Repair GRN: Seed missing GRN items from PO items

  ## Summary
  The existing GRN (GRN-202604-0001) was created but its items were never seeded.
  PO has 2 items but grn_items count is 0.

  ## Changes
  - Inserts grn_items for any grn_receipts that have 0 items but have linked po_items
  - Uses the linked delivery → po_id → po_items chain
  - Safe to run multiple times: only inserts when grn_items count = 0 for that GRN

  ## Affected Tables
  - grn_items: rows inserted
*/

INSERT INTO grn_items (
  grn_id,
  po_item_id,
  item_order,
  item_code,
  description,
  unit_of_measure,
  quantity_ordered,
  quantity_received,
  quantity_rejected,
  unit_price,
  remarks
)
SELECT
  g.id            AS grn_id,
  pi.id           AS po_item_id,
  pi.item_order,
  COALESCE(pi.item_code, '')   AS item_code,
  pi.description,
  pi.unit_of_measure,
  pi.quantity_to_purchase      AS quantity_ordered,
  pi.quantity_to_purchase      AS quantity_received,
  0                            AS quantity_rejected,
  pi.unit_price,
  ''                           AS remarks
FROM grn_receipts g
JOIN deliveries d   ON d.id   = g.delivery_id
JOIN po_items   pi  ON pi.po_id = d.po_id
WHERE NOT EXISTS (
  SELECT 1 FROM grn_items gi WHERE gi.grn_id = g.id
);
