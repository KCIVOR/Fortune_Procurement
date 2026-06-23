-- Warehouse staff need to read pr2_items when fetching GRN item details.
-- The GRN → po_items → pr2_items join was silently returning null for
-- warehouse users because no SELECT policy existed for that role.
-- This also exposes quote_justification and rfq_item_quote_id (attachment link).

CREATE POLICY "Warehouse can read all PR2 items"
ON public.pr2_items
FOR SELECT TO authenticated
USING (
  public.is_role('warehouse')
);
