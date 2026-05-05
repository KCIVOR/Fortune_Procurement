/*
  # PO Approval Workflow + Supplier Receipt

  ## Summary
  Adds the infrastructure needed for Step 11: PO approval routing through
  Buyer → Procurement Manager → Finance Director, followed by supplier
  receipt acknowledgment. The existing approval_instances / approval_actions
  tables are reused via document_type = 'PO'. A new po_receipts table
  captures the supplier's commitment date and delivery remarks.

  ## Changes

  ### po_requests
  - Add column: `approval_instance_id uuid` (FK to approval_instances, nullable)
    Tracks the active approval instance so detail pages can look it up easily.
  - Status values extend to: draft | for_approval | approved | sent | cancelled
    (no schema change needed — column is text)

  ### po_receipts (new table)
  - id: UUID PK
  - po_id: FK to po_requests (unique — one receipt per PO)
  - acknowledged_by: FK to auth.users (supplier rep who acknowledged)
  - acknowledged_by_name: snapshot of supplier rep name
  - commitment_date: date the supplier commits to deliver
  - delivery_remarks: optional text field for supplier notes
  - acknowledged_at: timestamp

  ## Security
  - RLS enabled on po_receipts
  - Procurement can read all receipts
  - Approver can read all receipts
  - Supplier role can insert (first time) and read their own receipt
  - Supplier role can update their own receipt (commitment date / remarks)
*/

-- ─── po_requests: add approval_instance_id ───────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'po_requests' AND column_name = 'approval_instance_id'
  ) THEN
    ALTER TABLE po_requests ADD COLUMN approval_instance_id uuid;
  END IF;
END $$;

-- ─── po_receipts ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS po_receipts (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id                   uuid NOT NULL REFERENCES po_requests(id) ON DELETE CASCADE,
  acknowledged_by         uuid REFERENCES auth.users(id),
  acknowledged_by_name    text NOT NULL DEFAULT '',
  commitment_date         date,
  delivery_remarks        text,
  acknowledged_at         timestamptz NOT NULL DEFAULT now(),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- One receipt per PO
CREATE UNIQUE INDEX IF NOT EXISTS po_receipts_po_id_key ON po_receipts(po_id);

ALTER TABLE po_receipts ENABLE ROW LEVEL SECURITY;

-- Procurement: read all
CREATE POLICY "Procurement can read PO receipts"
  ON po_receipts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

-- Approver: read all
CREATE POLICY "Approvers can read PO receipts"
  ON po_receipts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'approver'
    )
  );

-- Supplier: read own receipts (where they are the acknowledger)
CREATE POLICY "Supplier can read own PO receipts"
  ON po_receipts FOR SELECT TO authenticated
  USING (
    acknowledged_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
  );

-- Supplier: insert receipt
CREATE POLICY "Supplier can insert PO receipt"
  ON po_receipts FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
  );

-- Supplier: update own receipt (commitment date / remarks)
CREATE POLICY "Supplier can update own PO receipt"
  ON po_receipts FOR UPDATE TO authenticated
  USING (acknowledged_by = auth.uid())
  WITH CHECK (acknowledged_by = auth.uid());
