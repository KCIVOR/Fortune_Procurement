/*
  # GRN for services — handled by procurement

  1. New helper functions
    - `request_type_for_delivery(p_delivery_id)` — resolves 'goods' | 'services' for a
      delivery via the deliveries → po_requests → pr2_requests → pr1_requests FK chain
      (all NOT NULL, verified no orphaned rows)
    - `request_type_for_grn(p_grn_id)` — same, resolved from a grn_receipts row

  2. Changes
    - Warehouse GRN access (read/insert/update on grn_receipts + grn_items) is now
      restricted to goods-type deliveries only
    - Procurement GRN access (read/insert/update) is now restricted to services-type
      deliveries only — this replaces procurement's previous broad read-all access,
      per Rev #8 decision: "procurement can only handle service type, warehouse can
      only access goods"

  3. Rationale (Rev #8)
    For service-type PRs, warehouse is not involved in fulfillment — procurement should
    be the one who opens, edits, and closes the GRN instead. Warehouse continues to
    exclusively own goods-type GRNs, unchanged from today.

  4. Security
    - No column-level changes; row-level only
    - Approver and employee-own-requisition SELECT policies are untouched (still see
      all GRNs / their own, regardless of type) — out of scope for this revision
*/

CREATE OR REPLACE FUNCTION public.request_type_for_delivery(p_delivery_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pr1.request_type
  FROM public.deliveries d
  JOIN public.po_requests po  ON po.id  = d.po_id
  JOIN public.pr2_requests pr2 ON pr2.id = po.pr2_id
  JOIN public.pr1_requests pr1 ON pr1.id = pr2.pr1_id
  WHERE d.id = p_delivery_id;
$$;

CREATE OR REPLACE FUNCTION public.request_type_for_grn(p_grn_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.request_type_for_delivery(g.delivery_id)
  FROM public.grn_receipts g
  WHERE g.id = p_grn_id;
$$;

-- ─── grn_receipts ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Warehouse can read all GRNs" ON grn_receipts;
CREATE POLICY "Warehouse can read goods GRNs"
  ON grn_receipts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'warehouse'
    )
    AND public.request_type_for_delivery(grn_receipts.delivery_id) = 'goods'
  );

DROP POLICY IF EXISTS "Warehouse can insert GRNs" ON grn_receipts;
CREATE POLICY "Warehouse can insert goods GRNs"
  ON grn_receipts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'warehouse'
    )
    AND public.request_type_for_delivery(grn_receipts.delivery_id) = 'goods'
  );

DROP POLICY IF EXISTS "Warehouse can update open GRNs" ON grn_receipts;
CREATE POLICY "Warehouse can update goods GRNs"
  ON grn_receipts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'warehouse'
    )
    AND public.request_type_for_delivery(grn_receipts.delivery_id) = 'goods'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'warehouse'
    )
    AND public.request_type_for_delivery(grn_receipts.delivery_id) = 'goods'
  );

DROP POLICY IF EXISTS "Procurement can read all GRNs" ON grn_receipts;
CREATE POLICY "Procurement can read services GRNs"
  ON grn_receipts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
    AND public.request_type_for_delivery(grn_receipts.delivery_id) = 'services'
  );

DROP POLICY IF EXISTS "Procurement can insert services GRNs" ON grn_receipts;
CREATE POLICY "Procurement can insert services GRNs"
  ON grn_receipts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
    AND public.request_type_for_delivery(grn_receipts.delivery_id) = 'services'
  );

DROP POLICY IF EXISTS "Procurement can update services GRNs" ON grn_receipts;
CREATE POLICY "Procurement can update services GRNs"
  ON grn_receipts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
    AND public.request_type_for_delivery(grn_receipts.delivery_id) = 'services'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
    AND public.request_type_for_delivery(grn_receipts.delivery_id) = 'services'
  );

-- ─── grn_items ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Warehouse can read GRN items" ON grn_items;
CREATE POLICY "Warehouse can read goods GRN items"
  ON grn_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'warehouse'
    )
    AND public.request_type_for_grn(grn_items.grn_id) = 'goods'
  );

DROP POLICY IF EXISTS "Warehouse can insert GRN items" ON grn_items;
CREATE POLICY "Warehouse can insert goods GRN items"
  ON grn_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'warehouse'
    )
    AND public.request_type_for_grn(grn_items.grn_id) = 'goods'
  );

DROP POLICY IF EXISTS "Warehouse can update GRN items" ON grn_items;
CREATE POLICY "Warehouse can update goods GRN items"
  ON grn_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'warehouse'
    )
    AND public.request_type_for_grn(grn_items.grn_id) = 'goods'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'warehouse'
    )
    AND public.request_type_for_grn(grn_items.grn_id) = 'goods'
  );

DROP POLICY IF EXISTS "Procurement can read GRN items" ON grn_items;
CREATE POLICY "Procurement can read services GRN items"
  ON grn_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
    AND public.request_type_for_grn(grn_items.grn_id) = 'services'
  );

DROP POLICY IF EXISTS "Procurement can insert services GRN items" ON grn_items;
CREATE POLICY "Procurement can insert services GRN items"
  ON grn_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
    AND public.request_type_for_grn(grn_items.grn_id) = 'services'
  );

DROP POLICY IF EXISTS "Procurement can update services GRN items" ON grn_items;
CREATE POLICY "Procurement can update services GRN items"
  ON grn_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
    AND public.request_type_for_grn(grn_items.grn_id) = 'services'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
    AND public.request_type_for_grn(grn_items.grn_id) = 'services'
  );
