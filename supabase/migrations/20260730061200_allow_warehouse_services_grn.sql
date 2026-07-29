/*
  # Allow Warehouse Staff to Create & Update Services GRNs

  1. Changes:
    - Update `grn_receipts` RLS policies so Warehouse staff can SELECT, INSERT, and UPDATE
      both 'goods' and 'services' GRNs.
    - Update `grn_items` RLS policies accordingly.
    - Preserve Procurement access to 'services' GRNs.
*/

-- ─── grn_receipts ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Warehouse can read goods GRNs" ON grn_receipts;
DROP POLICY IF EXISTS "Warehouse can read all GRNs" ON grn_receipts;
CREATE POLICY "Warehouse can read all GRNs"
  ON grn_receipts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'warehouse'
    )
  );

DROP POLICY IF EXISTS "Warehouse can insert goods GRNs" ON grn_receipts;
DROP POLICY IF EXISTS "Warehouse can insert GRNs" ON grn_receipts;
CREATE POLICY "Warehouse can insert GRNs"
  ON grn_receipts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'warehouse'
    )
  );

DROP POLICY IF EXISTS "Warehouse can update goods GRNs" ON grn_receipts;
DROP POLICY IF EXISTS "Warehouse can update GRNs" ON grn_receipts;
CREATE POLICY "Warehouse can update GRNs"
  ON grn_receipts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'warehouse'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'warehouse'
    )
  );

-- ─── grn_items ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Warehouse can read goods GRN items" ON grn_items;
DROP POLICY IF EXISTS "Warehouse can read GRN items" ON grn_items;
CREATE POLICY "Warehouse can read GRN items"
  ON grn_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'warehouse'
    )
  );

DROP POLICY IF EXISTS "Warehouse can insert goods GRN items" ON grn_items;
DROP POLICY IF EXISTS "Warehouse can insert GRN items" ON grn_items;
CREATE POLICY "Warehouse can insert GRN items"
  ON grn_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'warehouse'
    )
  );

DROP POLICY IF EXISTS "Warehouse can update goods GRN items" ON grn_items;
DROP POLICY IF EXISTS "Warehouse can update GRN items" ON grn_items;
CREATE POLICY "Warehouse can update GRN items"
  ON grn_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'warehouse'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'warehouse'
    )
  );
