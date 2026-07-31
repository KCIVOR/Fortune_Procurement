-- Allow TSQA to change a QA decision (approve <-> reject) as long as the
-- parent GRN is still open (not closed), instead of only while pending.

DROP POLICY IF EXISTS "TSQA can update GRN items for QA" ON public.grn_items;
CREATE POLICY "TSQA can update GRN items for QA"
  ON public.grn_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'tsqa'
    )
    AND requires_qa = true
    AND EXISTS (
      SELECT 1 FROM public.grn_receipts g
      WHERE g.id = grn_items.grn_id AND g.status <> 'closed'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'tsqa'
    )
    AND requires_qa = true
    AND EXISTS (
      SELECT 1 FROM public.grn_receipts g
      WHERE g.id = grn_items.grn_id AND g.status <> 'closed'
    )
  );
