/*
  # Allow PR1 requestors to read alternative quotes for their own PR1s

  1. Problem
    Employees (requestors) could not see rfq_item_quotes because the table
    only had SELECT policies for procurement and supplier roles. This blocked
    the substitute review workflow entirely — fetchSubstitutesForRequestor
    returned empty arrays for every employee.

  2. Fix
    Add a SELECT policy that lets a user read quotes when they are the
    requisitioner of the PR1 that originated the RFQ. The join chain is:
      rfq_item_quotes.rfq_supplier_id
        → rfq_suppliers.rfq_id
        → rfq_batches.pr1_id
        → pr1_requests.requisitioner_id = auth.uid()

  3. Security
    Read-only. Employees cannot insert or update quotes.
*/

DROP POLICY IF EXISTS "Requestors can view quotes for their own PR1s" ON rfq_item_quotes;

CREATE POLICY "Requestors can view quotes for their own PR1s"
  ON rfq_item_quotes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM rfq_suppliers rs
      JOIN rfq_batches rb ON rb.id = rs.rfq_id
      JOIN pr1_requests pr ON pr.id = rb.pr1_id
      WHERE rs.id = rfq_item_quotes.rfq_supplier_id
        AND pr.requisitioner_id = auth.uid()
    )
  );
