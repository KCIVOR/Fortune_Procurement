-- Allow warehouse to override the requested quantity per PR1 line during
-- validation, with a mandatory reason and an actor/time snapshot for audit.
-- Downstream (PR2 generation) forwards the same info onto pr2_items as a
-- read-only snapshot, mirroring the existing pr1_remarks_snapshot pattern.

ALTER TABLE warehouse_validation_items
  ADD COLUMN quantity_override_reason text,
  ADD COLUMN quantity_overridden_by uuid REFERENCES profiles(id),
  ADD COLUMN quantity_overridden_by_name_snapshot text,
  ADD COLUMN quantity_overridden_at timestamptz;

ALTER TABLE pr2_items
  ADD COLUMN pr1_quantity_requested_snapshot numeric,
  ADD COLUMN quantity_override_reason_snapshot text,
  ADD COLUMN quantity_overridden_by_name_snapshot text;
