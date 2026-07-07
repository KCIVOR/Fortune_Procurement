/*
  # VAT handling — RLS for system_vat_settings

  Mirrors system_expiry_settings exactly: any authenticated user can read (needed
  client-side at PR2/PO generation time to compute VAT), only admin can update.
  No RLS changes needed on profiles/rfq_item_quotes/pr2_items/po_items — writes to
  profiles go through a service-role API route; the other three tables already have
  adequate procurement/supplier write policies from prior audits.
*/

ALTER TABLE public.system_vat_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_vat_settings" ON public.system_vat_settings;
CREATE POLICY "authenticated_read_vat_settings"
  ON public.system_vat_settings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "admin_update_vat_settings" ON public.system_vat_settings;
CREATE POLICY "admin_update_vat_settings"
  ON public.system_vat_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'admin'
    )
  );
