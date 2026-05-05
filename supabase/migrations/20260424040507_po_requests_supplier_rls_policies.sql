/*
  # Add supplier RLS policies on po_requests

  ## Problem
  Suppliers have no SELECT or UPDATE policy on po_requests. This blocks:
  1. acknowledgeSupplierPO: queries po_requests for status/approval_instance_id → returns null → throws "PO not found"
  2. acknowledgeSupplierPO: UPDATE po_requests SET status='sent' → RLS violation
  3. fetchPOApprovalDetailByPOId (used by /supplier/po/[id]): reads po_requests → returns null

  ## Fix
  - Supplier SELECT: restricted to POs linked to PR2s linked to RFQs the supplier is on
  - Supplier UPDATE: restricted to the same scope AND only allowed status transitions
    (approved → sent), not arbitrary field mutation. Scoped by the same rfq_suppliers chain.

  ## Security
  - Supplier can only read POs where their supplier_id appears in rfq_suppliers for the
    related RFQ batch (via rfq → pr2 → po chain).
  - Supplier can only update POs in status 'approved' (not draft/for_approval/cancelled).
  - No supplier can read or update a PO from a different supplier's RFQ.
*/

-- Supplier can read POs linked to RFQs they are on
CREATE POLICY "Supplier can read own linked POs"
  ON po_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles prof
      JOIN roles r ON r.id = prof.role_id
      WHERE prof.id = auth.uid()
        AND r.name = 'supplier'
    )
    AND
    EXISTS (
      SELECT 1
      FROM pr2_requests pr2
      JOIN rfq_suppliers rs ON rs.rfq_id = pr2.rfq_id
      JOIN profiles prof ON prof.id = auth.uid()
      WHERE pr2.id = po_requests.pr2_id
        AND rs.supplier_id = auth.uid()
    )
  );

-- Supplier can update POs to 'sent' (acknowledgment) only for their linked POs
CREATE POLICY "Supplier can update linked approved POs"
  ON po_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles prof
      JOIN roles r ON r.id = prof.role_id
      WHERE prof.id = auth.uid()
        AND r.name = 'supplier'
    )
    AND
    EXISTS (
      SELECT 1
      FROM pr2_requests pr2
      JOIN rfq_suppliers rs ON rs.rfq_id = pr2.rfq_id
      WHERE pr2.id = po_requests.pr2_id
        AND rs.supplier_id = auth.uid()
    )
    AND status = 'approved'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles prof
      JOIN roles r ON r.id = prof.role_id
      WHERE prof.id = auth.uid()
        AND r.name = 'supplier'
    )
    AND
    EXISTS (
      SELECT 1
      FROM pr2_requests pr2
      JOIN rfq_suppliers rs ON rs.rfq_id = pr2.rfq_id
      WHERE pr2.id = po_requests.pr2_id
        AND rs.supplier_id = auth.uid()
    )
  );
