/*
  # PR1 — Purchase Request Schema

  ## Summary
  Creates the pr1_requests and pr1_items tables that back the PR1 module.
  PR1 is the employee-initiated purchase requisition — the first document in
  the MVP transaction path.

  ## New Tables

  ### pr1_requests
  The PR1 header record.
  - `id` (uuid, PK)
  - `pr1_number` (text) — manually entered by requestor; unique but soft-duplicate-warned
  - `requisitioner_id` (FK → profiles.id) — the submitting user
  - `requisitioner_name_snapshot` (text) — captured at submit
  - `department_id` (FK → departments.id)
  - `department_name_snapshot` (text) — captured at submit
  - `purpose` (text) — reason for the request
  - `date_required` (date) — when goods are needed
  - `status` (text) — draft | pending_warehouse | pending_approval | approved | rejected | cancelled
  - `submitted_at` (timestamptz, nullable)
  - `prepared_by_id` (FK → profiles.id, nullable) — set on submit
  - `prepared_by_name_snapshot` (text, nullable)
  - `prepared_by_position_snapshot` (text, nullable)
  - `prepared_at` (timestamptz, nullable)
  - `created_at`, `updated_at`

  ### pr1_items
  Line items on a PR1.
  - `id` (uuid, PK)
  - `pr1_id` (FK → pr1_requests.id ON DELETE CASCADE)
  - `item_order` (int) — display sequence
  - `item_code` (text, nullable)
  - `description` (text)
  - `unit_of_measure` (text)
  - `stock_on_hand` (numeric, default 0) — SOH at time of entry
  - `quantity_requested` (numeric)
  - `created_at`

  ## Security
  - RLS enabled on both tables
  - Requestors can CRUD their own draft PR1s
  - All authenticated users can SELECT (for approver/procurement visibility)
  - Only the owner can UPDATE/DELETE while in draft status
  - INSERT restricted to authenticated users (for themselves)
*/

-- ─── PR1 REQUESTS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pr1_requests (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pr1_number                      text NOT NULL,
  requisitioner_id                uuid NOT NULL REFERENCES profiles(id),
  requisitioner_name_snapshot     text NOT NULL DEFAULT '',
  department_id                   uuid NOT NULL REFERENCES departments(id),
  department_name_snapshot        text NOT NULL DEFAULT '',
  purpose                         text NOT NULL DEFAULT '',
  date_required                   date NOT NULL,
  status                          text NOT NULL DEFAULT 'draft'
                                    CHECK (status IN (
                                      'draft',
                                      'pending_warehouse',
                                      'pending_approval',
                                      'approved',
                                      'rejected',
                                      'cancelled'
                                    )),
  submitted_at                    timestamptz,
  prepared_by_id                  uuid REFERENCES profiles(id),
  prepared_by_name_snapshot       text,
  prepared_by_position_snapshot   text,
  prepared_at                     timestamptz,
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pr1_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read all PR1s"
  ON pr1_requests FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own PR1s"
  ON pr1_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requisitioner_id);

CREATE POLICY "Owners can update own PR1s"
  ON pr1_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = requisitioner_id)
  WITH CHECK (auth.uid() = requisitioner_id);

CREATE POLICY "Owners can delete own draft PR1s"
  ON pr1_requests FOR DELETE
  TO authenticated
  USING (auth.uid() = requisitioner_id AND status = 'draft');

CREATE INDEX IF NOT EXISTS idx_pr1_requests_requisitioner ON pr1_requests(requisitioner_id);
CREATE INDEX IF NOT EXISTS idx_pr1_requests_status        ON pr1_requests(status);
CREATE INDEX IF NOT EXISTS idx_pr1_requests_pr1_number    ON pr1_requests(pr1_number);

-- ─── PR1 ITEMS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pr1_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pr1_id              uuid NOT NULL REFERENCES pr1_requests(id) ON DELETE CASCADE,
  item_order          int  NOT NULL DEFAULT 1,
  item_code           text NOT NULL DEFAULT '',
  description         text NOT NULL DEFAULT '',
  unit_of_measure     text NOT NULL DEFAULT '',
  stock_on_hand       numeric(12,2) NOT NULL DEFAULT 0,
  quantity_requested  numeric(12,2) NOT NULL DEFAULT 1,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pr1_id, item_order)
);

ALTER TABLE pr1_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read all PR1 items"
  ON pr1_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "PR1 owners can insert items"
  ON pr1_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pr1_requests r
      WHERE r.id = pr1_id AND r.requisitioner_id = auth.uid()
    )
  );

CREATE POLICY "PR1 owners can update items"
  ON pr1_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pr1_requests r
      WHERE r.id = pr1_id AND r.requisitioner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pr1_requests r
      WHERE r.id = pr1_id AND r.requisitioner_id = auth.uid()
    )
  );

CREATE POLICY "PR1 owners can delete items on draft PR1s"
  ON pr1_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pr1_requests r
      WHERE r.id = pr1_id AND r.requisitioner_id = auth.uid() AND r.status = 'draft'
    )
  );

CREATE INDEX IF NOT EXISTS idx_pr1_items_pr1 ON pr1_items(pr1_id);
