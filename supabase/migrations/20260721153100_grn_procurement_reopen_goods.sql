-- Phase 6 (D6): Procurement may read and reopen closed Goods GRNs

DROP POLICY IF EXISTS "Procurement can read goods GRNs" ON grn_receipts;
CREATE POLICY "Procurement can read goods GRNs"
  ON grn_receipts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
    AND public.request_type_for_delivery(grn_receipts.delivery_id) = 'goods'
  );

DROP POLICY IF EXISTS "Procurement can update goods GRNs" ON grn_receipts;
CREATE POLICY "Procurement can update goods GRNs"
  ON grn_receipts FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
    AND public.request_type_for_delivery(grn_receipts.delivery_id) = 'goods'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
    AND public.request_type_for_delivery(grn_receipts.delivery_id) = 'goods'
  );

DROP POLICY IF EXISTS "Procurement can read goods GRN items" ON grn_items;
CREATE POLICY "Procurement can read goods GRN items"
  ON grn_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
    AND public.request_type_for_grn(grn_items.grn_id) = 'goods'
  );
