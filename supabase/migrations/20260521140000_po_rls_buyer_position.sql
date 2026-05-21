/*
  # Allow Buyer Position to Create/Update POs
  
  This migration updates RLS policies to allow users with the "Buyer" position
  to insert and update POs, regardless of their role.
  
  Use case: Buyer position may have "approver" role but still needs to create POs.
*/

-- Drop existing INSERT policy and recreate with position check
DROP POLICY IF EXISTS "Procurement can insert POs" ON po_requests;

CREATE POLICY "Procurement or Buyer can insert POs"
  ON po_requests FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON r.id = p.role_id
      LEFT JOIN positions pos ON pos.id = p.position_id
      WHERE p.id = auth.uid() 
        AND (r.name = 'procurement' OR pos.title = 'Buyer')
    )
  );

-- Drop existing UPDATE policy and recreate with position check
DROP POLICY IF EXISTS "Procurement can update POs" ON po_requests;

CREATE POLICY "Procurement or Buyer can update POs"
  ON po_requests FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON r.id = p.role_id
      LEFT JOIN positions pos ON pos.id = p.position_id
      WHERE p.id = auth.uid() 
        AND (r.name = 'procurement' OR pos.title = 'Buyer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON r.id = p.role_id
      LEFT JOIN positions pos ON pos.id = p.position_id
      WHERE p.id = auth.uid() 
        AND (r.name = 'procurement' OR pos.title = 'Buyer')
    )
  );

-- Also update po_items INSERT policy
DROP POLICY IF EXISTS "Procurement can insert PO items" ON po_items;

CREATE POLICY "Procurement or Buyer can insert PO items"
  ON po_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON r.id = p.role_id
      LEFT JOIN positions pos ON pos.id = p.position_id
      WHERE p.id = auth.uid() 
        AND (r.name = 'procurement' OR pos.title = 'Buyer')
    )
  );

-- Also update po_items UPDATE policy if it exists
DROP POLICY IF EXISTS "Procurement can update PO items" ON po_items;

CREATE POLICY "Procurement or Buyer can update PO items"
  ON po_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON r.id = p.role_id
      LEFT JOIN positions pos ON pos.id = p.position_id
      WHERE p.id = auth.uid() 
        AND (r.name = 'procurement' OR pos.title = 'Buyer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON r.id = p.role_id
      LEFT JOIN positions pos ON pos.id = p.position_id
      WHERE p.id = auth.uid() 
        AND (r.name = 'procurement' OR pos.title = 'Buyer')
    )
  );
