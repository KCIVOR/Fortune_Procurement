-- Phase 2: RLS for system_expiry_settings
-- All existing supplier_accreditations and supplier_products policies are
-- already compatible with 'expired' status — no changes needed there.

ALTER TABLE public.system_expiry_settings ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read (needed by lib functions when computing valid_until on approve/verify)
CREATE POLICY "expiry_settings_authenticated_select"
  ON public.system_expiry_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admin can update
CREATE POLICY "expiry_settings_admin_update"
  ON public.system_expiry_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles p
      JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid()
        AND r.name IN ('admin', 'superadmin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles p
      JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid()
        AND r.name IN ('admin', 'superadmin')
    )
  );
