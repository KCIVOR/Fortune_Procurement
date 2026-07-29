-- Fix infinite RLS recursion on grn_receipts / grn_items
-- Employee + TSQA SELECT policies joined back into grn_receipts while evaluating
-- grn_receipts/grn_items, causing "infinite recursion detected in policy".

CREATE OR REPLACE FUNCTION public.delivery_requisitioner_id(p_delivery_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT requisitioner_id FROM public.deliveries WHERE id = p_delivery_id;
$$;

CREATE OR REPLACE FUNCTION public.grn_delivery_id(p_grn_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT delivery_id FROM public.grn_receipts WHERE id = p_grn_id;
$$;

CREATE OR REPLACE FUNCTION public.grn_has_pending_qa_item(p_grn_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.grn_items gi
    WHERE gi.grn_id = p_grn_id
      AND gi.requires_qa = true
      AND gi.qa_status = 'pending'
  );
$$;

GRANT EXECUTE ON FUNCTION public.delivery_requisitioner_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grn_delivery_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grn_has_pending_qa_item(uuid) TO authenticated;

DROP POLICY IF EXISTS "Employee can read own requisition GRNs" ON public.grn_receipts;
CREATE POLICY "Employee can read own requisition GRNs"
  ON public.grn_receipts FOR SELECT TO authenticated
  USING (public.delivery_requisitioner_id(delivery_id) = auth.uid());

DROP POLICY IF EXISTS "Employee can read own requisition GRN items" ON public.grn_items;
CREATE POLICY "Employee can read own requisition GRN items"
  ON public.grn_items FOR SELECT TO authenticated
  USING (
    public.delivery_requisitioner_id(public.grn_delivery_id(grn_id)) = auth.uid()
  );

DROP POLICY IF EXISTS "TSQA can read goods GRNs pending QA" ON public.grn_receipts;
CREATE POLICY "TSQA can read goods GRNs pending QA"
  ON public.grn_receipts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'tsqa'
    )
    AND public.request_type_for_delivery(delivery_id) = 'goods'
    AND (
      status = 'pending_qa'
      OR public.grn_has_pending_qa_item(id)
    )
  );
