/*
  Phase 1B — Tighten PR1 / PR1 items SELECT (F1)

  Replaces global read-all with role-scoped access via SECURITY DEFINER helper
  to avoid RLS recursion with approval_instances.
*/

-- Role helper (reused in later security migrations)
CREATE OR REPLACE FUNCTION public.is_role(p_role_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.roles r ON r.id = p.role_id
    WHERE p.id = auth.uid()
      AND r.name = p_role_name
  );
$$;

CREATE OR REPLACE FUNCTION public.can_read_pr1(p_pr1_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pr1_requests pr
    WHERE pr.id = p_pr1_id
      AND (
        pr.requisitioner_id = auth.uid()
        OR public.is_role('admin')
        OR public.is_role('procurement')
        OR (
          public.is_role('warehouse')
          AND (
            pr.status = 'pending_warehouse'
            OR EXISTS (
              SELECT 1
              FROM public.warehouse_validations wv
              WHERE wv.pr1_id = pr.id
            )
          )
        )
        OR (
          public.is_role('approver')
          AND EXISTS (
            SELECT 1
            FROM public.approval_instances ai
            WHERE ai.document_type = 'PR1'
              AND ai.document_id = pr.id
          )
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_role(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_pr1(uuid) TO authenticated;

-- PR1 requests
DROP POLICY IF EXISTS "Authenticated users can read all PR1s" ON public.pr1_requests;

CREATE POLICY "Scoped users can read PR1 requests"
  ON public.pr1_requests
  FOR SELECT
  TO authenticated
  USING (public.can_read_pr1(id));

-- PR1 items (mirror parent access)
DROP POLICY IF EXISTS "Authenticated users can read all PR1 items" ON public.pr1_items;

CREATE POLICY "Scoped users can read PR1 items"
  ON public.pr1_items
  FOR SELECT
  TO authenticated
  USING (public.can_read_pr1(pr1_id));
