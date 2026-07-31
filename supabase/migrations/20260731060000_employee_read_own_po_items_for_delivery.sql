/*
  Delivery Tracking: show line items on the delivery detail page.

  po_items already has read policies for procurement (unrestricted), warehouse
  (unrestricted), supplier (own approved/sent POs), and approver
  (department-scoped) — but no policy at all for the employee role, which is
  who actually views the shared /delivery pages as a requestor or Planning
  staff member. Mirrors the existing "Employee can read own requisition
  deliveries" policy (requisitioner_id = auth.uid() directly on deliveries)
  by joining through deliveries.po_id — an employee can only see items for a
  PO that has a delivery they themselves requisitioned.
*/

DROP POLICY IF EXISTS "Employee can read own requisition PO items" ON public.po_items;

CREATE POLICY "Employee can read own requisition PO items"
  ON public.po_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.po_id = po_items.po_id
        AND d.requisitioner_id = auth.uid()
    )
  );
