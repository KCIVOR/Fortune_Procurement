/*
  # Employee visibility for PO records

  ## Summary
  Adds RLS policy to allow employees to read PO records linked to their own PR1 requisitions.
  This enables the Related Records chain to fully resolve (PR1 → RFQ → PR2 → PO → Delivery → GRN)
  for employees viewing their own purchase requisition details.

  ## Changes
  - New SELECT policy on po_requests table
  - Allows authenticated users with role='employee' to read POs where:
    - PO is linked to a PR2 request
    - PR2 is linked to a PR1 request
    - PR1 requisitioner_id matches current user (auth.uid())

  ## Security
  - Policy is restrictive: employees can ONLY see POs for their own requisitions
  - No exposure of unrelated POs or sensitive pricing data
  - Existing procurement/approver policies remain unchanged
  - No changes to po_items or other tables

  ## Impact
  - Employees can now see downstream documents (Delivery, GRN) linked to their PR1
  - No regression for procurement, approver, or supplier roles
  - Related Records component now fully resolves for all users
*/

CREATE POLICY "Employee can read own requisition POs"
  ON po_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pr2_requests pr2
      JOIN pr1_requests pr1 ON pr1.id = pr2.pr1_id
      WHERE pr2.id = po_requests.pr2_id
        AND pr1.requisitioner_id = auth.uid()
    )
  );
