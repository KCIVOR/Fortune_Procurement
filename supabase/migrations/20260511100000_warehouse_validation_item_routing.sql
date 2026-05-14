/*
  # Warehouse validation — item-level routing (Phase 1)

  Adds per-line routing fields derived from verified SOH vs quantity requested.
  Keeps `availability` as available | unavailable only; partial fulfillment is
  represented by `item_route = 'partial'`.
*/

ALTER TABLE warehouse_validation_items
  ADD COLUMN IF NOT EXISTS item_route text,
  ADD COLUMN IF NOT EXISTS internal_fulfilled_qty numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS procurement_qty numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE warehouse_validation_items
  ADD CONSTRAINT warehouse_validation_items_item_route_values_check
  CHECK (item_route IS NULL OR item_route IN ('internal', 'procurement', 'partial'));

ALTER TABLE warehouse_validation_items
  ADD CONSTRAINT warehouse_validation_items_internal_fulfilled_nonneg_check
  CHECK (internal_fulfilled_qty >= 0);

ALTER TABLE warehouse_validation_items
  ADD CONSTRAINT warehouse_validation_items_procurement_nonneg_check
  CHECK (procurement_qty >= 0);
