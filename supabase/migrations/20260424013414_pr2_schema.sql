/*
  # PR2 (Purchase Request 2 / Canvass Slip) Schema

  1. New Tables
    - `pr2_requests` (header)
      - Carries forward PR1 requisitioner/department/purpose/date_required
      - Links to source pr1_id and rfq_id
      - Holds procurement-entered qty_on_hand and qty_incoming per document
      - Status flow: draft → pending_phase1_approval → phase1_approved →
                     pending_phase2_approval → phase2_approved → cancelled
      - Snapshot fields for both approval phases
    - `pr2_items` (line items)
      - Mirrors pr1_items, enriched with winning supplier data
      - qty_on_hand, qty_incoming entered by procurement per item
      - selected_rfq_supplier_id / supplier_name_snapshot / unit_price from canvassing
      - Computed total_price stored for fast reads

  2. Security
    - RLS enabled on both tables
    - Procurement can read/write all PR2 records
    - Approvers and employees can read PR2s relevant to them
    - Requestors can read their own PR2s (via pr1 ownership)

  3. Indexes
    - pr2_requests: pr1_id, rfq_id, status
    - pr2_items: pr2_id
*/

CREATE TABLE IF NOT EXISTS pr2_requests (
  id                           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  pr2_number                   text        NOT NULL,
  pr1_id                       uuid        NOT NULL REFERENCES pr1_requests(id),
  rfq_id                       uuid        NOT NULL REFERENCES rfq_batches(id),

  -- Carry-forward snapshots from PR1
  requisitioner_id             uuid        NOT NULL,
  requisitioner_name_snapshot  text        NOT NULL DEFAULT '',
  department_id                uuid,
  department_name_snapshot     text        NOT NULL DEFAULT '',
  purpose                      text        NOT NULL DEFAULT '',
  date_required                date        NOT NULL,

  -- PR1 reference number for display
  pr1_number_snapshot          text        NOT NULL DEFAULT '',
  rfq_number_snapshot          text        NOT NULL DEFAULT '',

  -- Remarks and notes by procurement
  remarks                      text,

  -- Status
  status                       text        NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft',
      'pending_phase1_approval',
      'phase1_approved',
      'pending_phase2_approval',
      'phase2_approved',
      'cancelled'
    )),

  -- Creation audit
  generated_by                 uuid        REFERENCES profiles(id),
  generated_at                 timestamptz NOT NULL DEFAULT now(),

  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pr2_items (
  id                           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  pr2_id                       uuid        NOT NULL REFERENCES pr2_requests(id),

  -- Ordering + identification
  item_order                   int         NOT NULL DEFAULT 1,
  item_code                    text        NOT NULL DEFAULT '',
  description                  text        NOT NULL DEFAULT '',
  unit_of_measure              text        NOT NULL DEFAULT '',

  -- From PR1
  pr1_item_id                  uuid        REFERENCES pr1_items(id),
  quantity_requested           numeric     NOT NULL DEFAULT 0,

  -- Procurement-entered inventory fields
  qty_on_hand                  numeric     NOT NULL DEFAULT 0,
  qty_incoming                 numeric     NOT NULL DEFAULT 0,

  -- Quantity to purchase = requested - on_hand - incoming (procurement may override)
  quantity_to_purchase         numeric     NOT NULL DEFAULT 0,

  -- Winning supplier from canvassing
  selected_rfq_supplier_id     uuid        REFERENCES rfq_suppliers(id),
  supplier_name_snapshot       text        NOT NULL DEFAULT '',

  -- Quote data from canvassing
  quoted_description           text        NOT NULL DEFAULT '',
  is_alternative               boolean     NOT NULL DEFAULT false,
  unit_price                   numeric     NOT NULL DEFAULT 0,
  lead_time_days               int         NOT NULL DEFAULT 0,
  total_price                  numeric     NOT NULL DEFAULT 0,

  -- Optional line remarks
  remarks                      text,

  created_at                   timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS pr2_requests_pr1_id_idx  ON pr2_requests(pr1_id);
CREATE INDEX IF NOT EXISTS pr2_requests_rfq_id_idx  ON pr2_requests(rfq_id);
CREATE INDEX IF NOT EXISTS pr2_requests_status_idx  ON pr2_requests(status);
CREATE INDEX IF NOT EXISTS pr2_items_pr2_id_idx     ON pr2_items(pr2_id);

-- RLS
ALTER TABLE pr2_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE pr2_items    ENABLE ROW LEVEL SECURITY;

-- Procurement: full access
CREATE POLICY "Procurement can read all PR2 requests"
  ON pr2_requests FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

CREATE POLICY "Procurement can insert PR2 requests"
  ON pr2_requests FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

CREATE POLICY "Procurement can update PR2 requests"
  ON pr2_requests FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

-- Approvers: read all PR2s (for approval queue)
CREATE POLICY "Approvers can read all PR2 requests"
  ON pr2_requests FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'approver'
    )
  );

-- Requestors: read their own PR2s (via pr1 ownership)
CREATE POLICY "Requestors can read own PR2 requests"
  ON pr2_requests FOR SELECT TO authenticated
  USING (requisitioner_id = auth.uid());

-- PR2 items: procurement full access
CREATE POLICY "Procurement can read all PR2 items"
  ON pr2_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

CREATE POLICY "Procurement can insert PR2 items"
  ON pr2_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

CREATE POLICY "Procurement can update PR2 items"
  ON pr2_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

-- PR2 items: approvers read
CREATE POLICY "Approvers can read all PR2 items"
  ON pr2_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'approver'
    )
  );

-- PR2 items: requestors read own
CREATE POLICY "Requestors can read own PR2 items"
  ON pr2_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pr2_requests r
      WHERE r.id = pr2_items.pr2_id AND r.requisitioner_id = auth.uid()
    )
  );
