/*
  # Widen warehouse's GRN read access to match procurement's symmetry

  1. Change
    Warehouse can now SELECT all GRNs (goods + services), matching how procurement
    already behaves on goods GRNs (read-all, write-only-own-type). Warehouse's
    INSERT/UPDATE remain goods-only, unchanged.

  2. Rationale (Rev #8 follow-up)
    Client wants warehouse to see service-type GRNs for visibility/tracing, without
    being able to act on them — the mirror image of procurement's existing goods
    read-all / services-write-only setup.

  3. Resulting access matrix
    | Role        | Read           | Write (insert/update) |
    |-------------|----------------|------------------------|
    | Warehouse   | all (goods+services) | goods only        |
    | Procurement | all (goods+services) | services only      |
*/

DROP POLICY IF EXISTS "Warehouse can read goods GRNs" ON grn_receipts;
CREATE POLICY "Warehouse can read all GRNs"
  ON grn_receipts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'warehouse'
    )
  );

DROP POLICY IF EXISTS "Warehouse can read goods GRN items" ON grn_items;
CREATE POLICY "Warehouse can read all GRN items"
  ON grn_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'warehouse'
    )
  );
