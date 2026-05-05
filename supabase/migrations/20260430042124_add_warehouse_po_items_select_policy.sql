/*
  # Add warehouse SELECT policy on po_items

  ## Problem
  The GRN details page falls back to fetching po_items when grn_items is empty.
  The warehouse role had no SELECT policy on po_items, so RLS silently returned
  an empty array, causing the items table to show "(0)" for all GRNs without
  pre-seeded grn_items rows.

  ## Changes
  - po_items: add SELECT policy for warehouse role (mirrors the existing approver policy)
*/

CREATE POLICY "Warehouse can read all PO items"
  ON po_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'warehouse'
    )
  );
