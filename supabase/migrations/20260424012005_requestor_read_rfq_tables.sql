/*
  # Allow PR1 requestors to read rfq_batches and rfq_suppliers for their own PR1s

  1. Problem
    loadSubstitutesForPr1 queries rfq_batches (to find the RFQ for a PR1) and
    rfq_suppliers (to find supplier assignment IDs). Both tables had SELECT
    policies only for procurement and supplier roles. When the employee ran
    fetchSubstitutesForRequestor, the rfq_batches query returned zero rows,
    so the function short-circuited and returned an empty substitutes array
    before ever reaching rfq_item_quotes — even though that table now has a
    correct requestor policy.

  2. Fix
    - rfq_batches: allow SELECT when pr1_id belongs to the requesting user
    - rfq_suppliers: allow SELECT when the rfq_id belongs to a PR1 owned by
      the requesting user

  3. Security
    Read-only. Requestors cannot create, update, or delete RFQs or supplier rows.
*/

-- Requestor can read rfq_batches for their own PR1s
DROP POLICY IF EXISTS "Requestors can view rfq_batches for their own PR1s" ON rfq_batches;
CREATE POLICY "Requestors can view rfq_batches for their own PR1s"
  ON rfq_batches FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pr1_requests pr
      WHERE pr.id = rfq_batches.pr1_id
        AND pr.requisitioner_id = auth.uid()
    )
  );

-- Requestor can read rfq_suppliers for RFQs linked to their own PR1s
DROP POLICY IF EXISTS "Requestors can view rfq_suppliers for their own PR1s" ON rfq_suppliers;
CREATE POLICY "Requestors can view rfq_suppliers for their own PR1s"
  ON rfq_suppliers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM rfq_batches rb
      JOIN pr1_requests pr ON pr.id = rb.pr1_id
      WHERE rb.id = rfq_suppliers.rfq_id
        AND pr.requisitioner_id = auth.uid()
    )
  );
