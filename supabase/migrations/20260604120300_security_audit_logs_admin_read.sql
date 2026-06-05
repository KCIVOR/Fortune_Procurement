/*
  Phase 1D — Audit logs admin-only SELECT (F7)

  Keeps authenticated INSERT (actor set by app). Tightens read to admin role.
*/

DROP POLICY IF EXISTS "Authenticated users can read audit logs" ON public.audit_logs;

CREATE POLICY "Admins can read audit logs"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (public.is_role('admin'));
