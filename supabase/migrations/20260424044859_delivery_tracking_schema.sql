/*
  # Delivery Tracking Schema

  ## Overview
  Tracks the delivery lifecycle for Purchase Orders after supplier acknowledgment.
  Deliveries are created automatically when a supplier acknowledges a PO (status='sent').
  Suppliers update delivery status; procurement monitors and adds follow-up notes;
  employees can view progress.

  ## New Tables

  ### deliveries
  One delivery record per PO. Created when a PO is acknowledged by the supplier.
  - Tracks overall delivery status from pending → delivered
  - Carries snapshots of PO/supplier info for audit trail
  - Links back to po_requests, pr2, pr1 via snapshots

  ### delivery_status_history
  Append-only log of every status change and supplier/procurement note.
  - actor_id + actor_name_snapshot for audit
  - actor_role: 'supplier' | 'procurement' | 'warehouse'
  - status_to: the new status (null means note only, no status change)
  - note: free-text update from supplier or procurement follow-up

  ## Delivery Status Flow
  pending → scheduled → in_transit → delayed → delivered
                                    └─────────→ delivered

  ## Security
  - RLS enabled on all tables
  - Supplier: can read/update own deliveries (supplier_id = auth.uid())
  - Procurement: can read all, add follow-up notes
  - Warehouse: can read all (receives goods), mark delivered
  - Employee: read-only visibility into their own requisition's delivery
  - Approver: read-only

  ## Notes
  - No hard-delete on history — audit log is permanent
  - status_history uses INSERT only (no UPDATE/DELETE)
*/

-- ─── deliveries ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS deliveries (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Linked PO
  po_id                     uuid NOT NULL REFERENCES po_requests(id),
  po_number_snapshot        text NOT NULL DEFAULT '',
  pr2_number_snapshot       text NOT NULL DEFAULT '',
  pr1_number_snapshot       text NOT NULL DEFAULT '',
  rfq_number_snapshot       text NOT NULL DEFAULT '',

  -- Supplier
  supplier_id               uuid REFERENCES auth.users(id),
  supplier_name_snapshot    text NOT NULL DEFAULT '',

  -- Requisitioner (employee) — for employee visibility
  requisitioner_id          uuid REFERENCES auth.users(id),
  requisitioner_name_snapshot text NOT NULL DEFAULT '',
  department_name_snapshot  text NOT NULL DEFAULT '',
  purpose                   text NOT NULL DEFAULT '',

  -- Delivery status
  status                    text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','scheduled','in_transit','delayed','delivered','cancelled')),

  -- Dates
  commitment_date           date,          -- from po_receipts (supplier's original commit)
  scheduled_date            date,          -- supplier-updated scheduled delivery date
  actual_delivery_date      date,          -- set when delivered

  -- Where it's going
  delivery_address          text NOT NULL DEFAULT '',
  warehouse                 text NOT NULL DEFAULT '',

  -- Grand total (for display)
  grand_total               numeric(14,2) NOT NULL DEFAULT 0,

  -- Timestamps
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),

  UNIQUE(po_id)
);

ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

-- Procurement: full read
CREATE POLICY "Procurement can read all deliveries"
  ON deliveries FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

-- Approver: read-only
CREATE POLICY "Approvers can read all deliveries"
  ON deliveries FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'approver'
    )
  );

-- Warehouse: read-only (receives goods)
CREATE POLICY "Warehouse can read all deliveries"
  ON deliveries FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'warehouse'
    )
  );

-- Supplier: read own deliveries
CREATE POLICY "Supplier can read own deliveries"
  ON deliveries FOR SELECT TO authenticated
  USING (supplier_id = auth.uid());

-- Employee: read deliveries for their own requisitions
CREATE POLICY "Employee can read own requisition deliveries"
  ON deliveries FOR SELECT TO authenticated
  USING (requisitioner_id = auth.uid());

-- Procurement: create deliveries
CREATE POLICY "Procurement can insert deliveries"
  ON deliveries FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

-- Supplier: update status on own deliveries (status + dates only)
CREATE POLICY "Supplier can update own delivery status"
  ON deliveries FOR UPDATE TO authenticated
  USING (supplier_id = auth.uid())
  WITH CHECK (supplier_id = auth.uid());

-- Procurement: update any delivery (follow-up, mark received)
CREATE POLICY "Procurement can update deliveries"
  ON deliveries FOR UPDATE TO authenticated
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

-- Warehouse: mark delivered
CREATE POLICY "Warehouse can update delivery status"
  ON deliveries FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'warehouse'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'warehouse'
    )
  );

-- ─── delivery_status_history ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS delivery_status_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id     uuid NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,

  -- Who made this entry
  actor_id        uuid NOT NULL REFERENCES auth.users(id),
  actor_name      text NOT NULL DEFAULT '',
  actor_role      text NOT NULL DEFAULT '',

  -- What changed
  status_from     text,   -- null = first entry
  status_to       text,   -- null = note-only, no status change
  note            text,   -- free text: supplier update or procurement follow-up

  -- For scheduled/in_transit updates: supplier may provide new date
  scheduled_date  date,

  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE delivery_status_history ENABLE ROW LEVEL SECURITY;

-- Procurement: read all history
CREATE POLICY "Procurement can read delivery history"
  ON delivery_status_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

-- Approver: read all history
CREATE POLICY "Approvers can read delivery history"
  ON delivery_status_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'approver'
    )
  );

-- Warehouse: read all history
CREATE POLICY "Warehouse can read delivery history"
  ON delivery_status_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'warehouse'
    )
  );

-- Supplier: read history for own deliveries
CREATE POLICY "Supplier can read own delivery history"
  ON delivery_status_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM deliveries d
      WHERE d.id = delivery_status_history.delivery_id
        AND d.supplier_id = auth.uid()
    )
  );

-- Employee: read history for own requisition deliveries
CREATE POLICY "Employee can read own delivery history"
  ON delivery_status_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM deliveries d
      WHERE d.id = delivery_status_history.delivery_id
        AND d.requisitioner_id = auth.uid()
    )
  );

-- Supplier: insert history for own deliveries
CREATE POLICY "Supplier can insert own delivery history"
  ON delivery_status_history FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM deliveries d
      WHERE d.id = delivery_status_history.delivery_id
        AND d.supplier_id = auth.uid()
    )
  );

-- Procurement: insert history (follow-up notes)
CREATE POLICY "Procurement can insert delivery history"
  ON delivery_status_history FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

-- Warehouse: insert history (mark delivered note)
CREATE POLICY "Warehouse can insert delivery history"
  ON delivery_status_history FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'warehouse'
    )
  );

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_deliveries_po_id        ON deliveries(po_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_supplier_id  ON deliveries(supplier_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_req_id       ON deliveries(requisitioner_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status       ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_del_history_delivery_id ON delivery_status_history(delivery_id);

-- ─── Seed: create delivery for existing approved/sent POs ─────────────────────
-- Picks up any POs that were approved before the delivery module existed

INSERT INTO deliveries (
  po_id, po_number_snapshot, pr2_number_snapshot, pr1_number_snapshot,
  rfq_number_snapshot, supplier_id, supplier_name_snapshot,
  requisitioner_id, requisitioner_name_snapshot, department_name_snapshot,
  purpose, commitment_date, delivery_address, warehouse, grand_total, created_at, updated_at
)
SELECT
  po.id,
  po.po_number,
  po.pr2_number_snapshot,
  po.pr1_number_snapshot,
  po.rfq_number_snapshot,
  po.supplier_id,
  po.supplier_name_snapshot,
  pr2.requisitioner_id,
  po.requisitioner_name_snapshot,
  po.department_name_snapshot,
  po.purpose,
  rec.commitment_date,
  po.delivery_address,
  po.warehouse,
  COALESCE((
    SELECT SUM(total_price) FROM po_items WHERE po_id = po.id
  ), 0),
  po.updated_at,
  now()
FROM po_requests po
LEFT JOIN pr2_requests pr2 ON pr2.id = po.pr2_id
LEFT JOIN po_receipts rec ON rec.po_id = po.id
WHERE po.status IN ('approved', 'sent')
ON CONFLICT (po_id) DO NOTHING;
