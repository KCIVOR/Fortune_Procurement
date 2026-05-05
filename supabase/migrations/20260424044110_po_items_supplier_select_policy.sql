/*
  # Add supplier SELECT policy on po_items

  ## Problem
  The supplier role has no SELECT policy on po_items. When a supplier opens their
  PO detail page, the query `SELECT * FROM po_items WHERE po_id = ?` returns 0 rows
  silently due to RLS. The detail page shows "Items (0)" and "Grand Total ₱0.00"
  even though items exist.

  ## Fix
  Add a scoped SELECT policy: supplier can read po_items only for POs where
  po_requests.supplier_id = auth.uid() AND status IN ('approved','sent').

  This uses a subquery on po_requests, which is safe because:
  - po_requests has its own RLS (supplier_id = auth.uid() AND status IN approved/sent)
  - The subquery does not re-enter po_items (no recursion)
  - Other suppliers cannot satisfy supplier_id = auth.uid() for a PO they don't own

  ## Security
  - Supplier can only read items belonging to their own approved/sent POs
  - Draft and for_approval PO items remain invisible to suppliers
  - No supplier can read another supplier's PO items
  - No write access granted
*/

CREATE POLICY "Supplier can read items of own approved POs"
  ON po_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM po_requests po
      WHERE po.id = po_items.po_id
        AND po.supplier_id = auth.uid()
        AND po.status IN ('approved', 'sent')
    )
  );
