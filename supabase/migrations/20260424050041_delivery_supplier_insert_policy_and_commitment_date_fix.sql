/*
  # Fix delivery INSERT RLS and heal seeded delivery commitment_date

  ## Problems Fixed

  ### 1. deliveries INSERT only allowed procurement
  createDeliveryForPO is called from acknowledgeSupplierPO under the supplier's auth context.
  The existing INSERT policy only allowed procurement, so the supplier's call silently failed
  (swallowed by .catch(() => null)).

  Fix: add a supplier INSERT policy scoped to POs where supplier_id = auth.uid().
  This ensures a supplier can only create a delivery record for their own PO.

  ### 2. Seeded delivery has null commitment_date
  The migration seed ran before po_receipts was populated. Heal it now.

  ## Security
  - Supplier can only insert deliveries for po_requests where supplier_id = auth.uid()
  - Cannot insert deliveries for other suppliers' POs
*/

-- Allow supplier to insert delivery only for their own PO
CREATE POLICY "Supplier can insert delivery for own PO"
  ON deliveries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM po_requests po
      WHERE po.id = deliveries.po_id
        AND po.supplier_id = auth.uid()
        AND po.status IN ('approved', 'sent')
    )
  );

-- Heal seeded delivery: populate commitment_date from po_receipts
UPDATE deliveries d
SET commitment_date = (
  SELECT rec.commitment_date
  FROM po_receipts rec
  WHERE rec.po_id = d.po_id
  LIMIT 1
)
WHERE d.commitment_date IS NULL
  AND EXISTS (
    SELECT 1 FROM po_receipts rec
    WHERE rec.po_id = d.po_id
      AND rec.commitment_date IS NOT NULL
  );
