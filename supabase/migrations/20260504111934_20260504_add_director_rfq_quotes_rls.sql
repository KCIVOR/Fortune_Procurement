/*
  # Add Director RLS Policy for RFQ Item Quotes

  1. Summary
    - Add SELECT policy on rfq_item_quotes table
    - Allow approver role with Director position to read supplier canvass offers
    - Prevents Department Head (also approver, different position) from accessing
    - Enables canvass visibility in PR2 approval page

  2. Changes
    - New RLS Policy: "Directors can view all quotes"
    - Table: rfq_item_quotes
    - Scope: SELECT only
    - Condition: role = 'approver' AND position = 'Director'

  3. Impact
    - Director: Can now see supplier quotes for PR2 items
    - Procurement: Unchanged (already has access)
    - Department Head: Remains blocked (different position)
    - Other roles: Unchanged

  4. Security
    - RLS enabled and enforced
    - Policy is restrictive (only Director approvers)
    - No data exposure to unauthorized roles
    - Existing policies unchanged
*/

CREATE POLICY "Directors can view all quotes"
  ON rfq_item_quotes FOR SELECT
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
