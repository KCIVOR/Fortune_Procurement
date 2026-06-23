-- Allow warehouse role to read rfq_batches, pr2_requests, and po_requests
-- for document chain traceability (Related Records panel).
-- These policies are read-only; warehouse cannot insert/update/delete.

-- rfq_batches: warehouse can see all RFQ records (status + number only at query level)
CREATE POLICY "warehouse_select_rfq_batches"
  ON rfq_batches
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'warehouse'
    )
  );

-- pr2_requests: warehouse can see all PR2 records (status + number only at query level)
CREATE POLICY "warehouse_select_pr2_requests"
  ON pr2_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'warehouse'
    )
  );

-- po_requests: warehouse can see all PO records (status + number only at query level)
CREATE POLICY "warehouse_select_po_requests"
  ON po_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'warehouse'
    )
  );
