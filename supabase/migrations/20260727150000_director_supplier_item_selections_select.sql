/*
  Allow Director / Finance Director approvers to read procurement's winner
  selections on supplier_item_selections.

  Matches lib/price-visibility.ts COMMERCIAL_PRICING_APPROVER_POSITIONS and the
  existing "Directors can view all quotes" / "Directors can view rfq_suppliers"
  policies (20260605150000_finance_director_commercial_pricing_rls.sql).

  Without this, buildQuoteMatrix() returns empty selections for approvers and the
  PR2 canvassing comparison panel cannot highlight winning suppliers.
*/

CREATE POLICY "Directors can view supplier_item_selections"
  ON public.supplier_item_selections
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      INNER JOIN public.roles r ON r.id = p.role_id
      INNER JOIN public.positions pos ON pos.id = p.position_id
      WHERE p.id = auth.uid()
        AND r.name = 'approver'
        AND pos.title IN ('Director', 'Finance Director')
    )
  );
