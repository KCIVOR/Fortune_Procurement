/*
  # Add Director RLS Policy for RFQ Suppliers

  1. Summary
    - Add SELECT policy on rfq_suppliers table
    - Allow approver role with Director position to read supplier data
    - Enables FK relationship expansion in PR2 canvass query
    - Prevents Department Head (approver with different position) from accessing
    - Fixes "Unknown" supplier names in canvass display

  2. Changes
    - New RLS Policy: "Directors can view rfq_suppliers"
    - Table: rfq_suppliers
    - Scope: SELECT only
    - Condition: role = 'approver' AND position = 'Director'

  3. Impact
    - Director: Can now read rfq_suppliers for canvass display
    - Procurement: Unchanged (already has access via existing policy)
    - Requestors: Unchanged (already have access via is_own_rfq_supplier)
    - Suppliers: Unchanged (already have access to own rows)
    - Department Head: Remains blocked (different position)
    - Other roles: Unchanged (no new access)

  4. Security
    - RLS enabled and enforced
    - Policy is restrictive (only Director approvers)
    - No data exposure to unauthorized roles
    - Matches pattern of existing "Directors can view all quotes" policy
    - Existing policies unchanged and unaffected

  5. Effect
    - FK relationship expansion in queries now succeeds for Director
    - rfq_suppliers field populated in rfq_item_quotes query results
    - Canvass supplier names display correctly instead of "Unknown"
    - No changes to frontend code required
*/

CREATE POLICY "Directors can view rfq_suppliers"
  ON rfq_suppliers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM (
        profiles p
        JOIN roles r ON r.id = p.role_id
        JOIN positions pos ON pos.id = p.position_id
      )
      WHERE p.id = auth.uid()
        AND r.name = 'approver'
        AND pos.title = 'Director'
    )
  );
