/*
  # Warehouse Validation Schema

  ## Summary
  Adds the warehouse_validations and warehouse_validation_items tables that back
  the Step 4 warehouse validation stage. When a PR1 is submitted it lands in
  status = 'pending_warehouse'. A warehouse staff member opens the PR1 from the
  queue, enters validated SOH per item, marks each item available/unavailable,
  and submits a final decision.

  - SUFFICIENT  → PR1 is fully fulfilled from stock; closed internally (no approval needed)
  - INSUFFICIENT → PR1 proceeds to the approval workflow

  ## New Tables

  ### warehouse_validations
  One record per PR1 that undergoes warehouse validation.
  - `id` (uuid, PK)
  - `pr1_id` (FK → pr1_requests.id) — the PR1 being validated
  - `validator_id` (FK → profiles.id) — who performed the validation
  - `validator_name_snapshot` (text) — name captured at time of submission
  - `validator_position_snapshot` (text) — position captured at time of submission
  - `decision` (text) — 'sufficient' | 'insufficient' | NULL while in progress
  - `notes` (text) — overall warehouse notes (optional)
  - `validated_at` (timestamptz, nullable) — when the decision was submitted
  - `created_at`, `updated_at`

  ### warehouse_validation_items
  Per-item validation row mirroring each pr1_item.
  - `id` (uuid, PK)
  - `validation_id` (FK → warehouse_validations.id ON DELETE CASCADE)
  - `pr1_item_id` (FK → pr1_items.id) — the item being validated
  - `item_order` (int) — display sequence (copied from pr1_item)
  - `item_code` (text) — snapshot from pr1_item
  - `description` (text) — snapshot from pr1_item
  - `unit_of_measure` (text) — snapshot from pr1_item
  - `requestor_soh` (numeric) — the SOH the requestor entered
  - `validated_soh` (numeric, nullable) — warehouse-verified SOH
  - `quantity_requested` (numeric) — snapshot from pr1_item
  - `availability` (text) — 'available' | 'unavailable' | NULL while in progress
  - `item_notes` (text, nullable) — per-item warehouse note
  - `created_at`

  ## Security
  - RLS enabled on both tables
  - warehouse_validations: warehouse role can insert/update their own records;
    all authenticated users can read (approvers, procurement need visibility)
  - warehouse_validation_items: mirrors parent policy via EXISTS check

  ## Notes
  - A warehouse_validations row is created (status = in_progress) when the
    warehouse staff first opens a PR1 for validation. This is idempotent — if a
    record already exists for the pr1_id it is reused (enforced by UNIQUE constraint).
  - The pr1_requests.status transition from 'pending_warehouse' is handled by the
    application after the validator submits their decision.
*/

-- ─── WAREHOUSE VALIDATIONS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warehouse_validations (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pr1_id                    uuid NOT NULL REFERENCES pr1_requests(id),
  validator_id              uuid REFERENCES profiles(id),
  validator_name_snapshot   text NOT NULL DEFAULT '',
  validator_position_snapshot text NOT NULL DEFAULT '',
  decision                  text CHECK (decision IN ('sufficient', 'insufficient')),
  notes                     text NOT NULL DEFAULT '',
  validated_at              timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pr1_id)
);

ALTER TABLE warehouse_validations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read warehouse validations"
  ON warehouse_validations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert warehouse validations"
  ON warehouse_validations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = validator_id);

CREATE POLICY "Validators can update own warehouse validations"
  ON warehouse_validations FOR UPDATE
  TO authenticated
  USING (auth.uid() = validator_id)
  WITH CHECK (auth.uid() = validator_id);

CREATE INDEX IF NOT EXISTS idx_warehouse_validations_pr1 ON warehouse_validations(pr1_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_validations_validator ON warehouse_validations(validator_id);

-- ─── WAREHOUSE VALIDATION ITEMS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warehouse_validation_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  validation_id       uuid NOT NULL REFERENCES warehouse_validations(id) ON DELETE CASCADE,
  pr1_item_id         uuid NOT NULL REFERENCES pr1_items(id),
  item_order          int  NOT NULL DEFAULT 1,
  item_code           text NOT NULL DEFAULT '',
  description         text NOT NULL DEFAULT '',
  unit_of_measure     text NOT NULL DEFAULT '',
  requestor_soh       numeric(12,2) NOT NULL DEFAULT 0,
  validated_soh       numeric(12,2),
  quantity_requested  numeric(12,2) NOT NULL DEFAULT 1,
  availability        text CHECK (availability IN ('available', 'unavailable')),
  item_notes          text NOT NULL DEFAULT '',
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (validation_id, pr1_item_id)
);

ALTER TABLE warehouse_validation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read validation items"
  ON warehouse_validation_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Validator can insert validation items"
  ON warehouse_validation_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM warehouse_validations v
      WHERE v.id = validation_id AND v.validator_id = auth.uid()
    )
  );

CREATE POLICY "Validator can update validation items"
  ON warehouse_validation_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM warehouse_validations v
      WHERE v.id = validation_id AND v.validator_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM warehouse_validations v
      WHERE v.id = validation_id AND v.validator_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_wv_items_validation ON warehouse_validation_items(validation_id);
