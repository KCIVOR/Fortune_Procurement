/*
  # Add Approver SELECT Access to rfq_batches

  1. Problem
    - Approver users cannot see RFQ records in Related Records
    - Related Records shows "Not yet created" even when RFQ exists
    - Root cause: rfq_batches has no SELECT policy for role = 'approver'
    - Procurement users can see RFQ (have SELECT policy)
    - Approvers can access pr2_requests, po_requests, deliveries, grn_receipts
    - But rfq_batches blocks approvers

  2. Solution
    - Add SELECT policy for role = 'approver' on rfq_batches
    - Matches existing pattern from po_requests, deliveries, grn_receipts
    - Allows approvers to see complete document chain in Related Records
    - Does not expose supplier quotes/pricing
    - Does not change existing procurement/requestor/supplier policies

  3. Changes
    - New RLS Policy: "Approvers can select rfq_batches"
    - Table: rfq_batches
    - Scope: SELECT only
    - Condition: role = 'approver'

  4. Policies After Change
    - Procurement: can select (existing)
    - Approver: can select (NEW)
    - Requestor: can select own (existing)
    - Supplier: can select assigned (existing)

  5. Impact
    - Approver: Now sees RFQ in Related Records
    - Procurement: Unchanged
    - Requestor: Unchanged
    - Supplier: Unchanged
    - Related Records chain now complete for approvers

  6. Security
    - RLS enabled and enforced
    - Policy is same pattern as other document tables
    - Only adds approver role, does not broaden other roles
    - Does not expose confidential data beyond approver scope
*/

CREATE POLICY "Approvers can select rfq_batches"
  ON rfq_batches FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'approver'
    )
  );
