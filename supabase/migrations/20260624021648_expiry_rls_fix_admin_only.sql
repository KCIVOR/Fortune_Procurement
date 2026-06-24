-- Fix expiry_settings_admin_update policy — 'superadmin' role does not exist, use 'admin' only

DROP POLICY IF EXISTS "expiry_settings_admin_update" ON public.system_expiry_settings;

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
        AND r.name = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles p
      JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid()
        AND r.name = 'admin'
    )
  );
