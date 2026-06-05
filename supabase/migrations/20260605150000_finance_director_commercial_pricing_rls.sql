/*
  Extend Director RFQ canvass RLS to Finance Director (approver + position title).

  Matches lib/price-visibility.ts COMMERCIAL_PRICING_APPROVER_POSITIONS.
  Live positions (seed): Director, Finance Director — both role = approver.
*/

DROP POLICY IF EXISTS "Directors can view all quotes" ON public.rfq_item_quotes;

CREATE POLICY "Directors can view all quotes"
  ON public.rfq_item_quotes
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

DROP POLICY IF EXISTS "Directors can view rfq_suppliers" ON public.rfq_suppliers;

CREATE POLICY "Directors can view rfq_suppliers"
  ON public.rfq_suppliers
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
