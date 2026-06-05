-- Allow procurement to clear a winner selection while the RFQ is still open.

DROP POLICY IF EXISTS "Procurement can delete supplier_item_selections" ON supplier_item_selections;

CREATE POLICY "Procurement can delete supplier_item_selections"
  ON supplier_item_selections FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );
