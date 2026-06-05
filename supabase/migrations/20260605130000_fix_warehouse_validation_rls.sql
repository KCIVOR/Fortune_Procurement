/*
  Fix warehouse validation open flow after Phase 1E.

  - can_read_warehouse_validation: staff roles can read by validation id
  - INSERT header: warehouse role + validator_id = auth.uid() (inline role check)
  - validation items INSERT: any warehouse staff when parent row exists
*/

GRANT EXECUTE ON FUNCTION public.is_role(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_warehouse_validation(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_read_warehouse_validation(p_validation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (
      (
        public.is_role('admin')
        OR public.is_role('procurement')
        OR public.is_role('warehouse')
      )
      AND EXISTS (
        SELECT 1
        FROM public.warehouse_validations wv
        WHERE wv.id = p_validation_id
      )
    )
  OR EXISTS (
    SELECT 1
    FROM public.warehouse_validations wv
    INNER JOIN public.pr1_requests pr ON pr.id = wv.pr1_id
    WHERE wv.id = p_validation_id
      AND pr.requisitioner_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "Warehouse staff can insert warehouse validations"
  ON public.warehouse_validations;

CREATE POLICY "Warehouse staff can insert warehouse validations"
  ON public.warehouse_validations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = validator_id
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      INNER JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid()
        AND r.name = 'warehouse'
    )
  );

DROP POLICY IF EXISTS "Warehouse staff can insert validation items"
  ON public.warehouse_validation_items;

CREATE POLICY "Warehouse staff can insert validation items"
  ON public.warehouse_validation_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_role('warehouse')
    AND EXISTS (
      SELECT 1
      FROM public.warehouse_validations wv
      WHERE wv.id = validation_id
    )
  );
