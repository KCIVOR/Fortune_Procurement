/*
  Phase 1E — Warehouse validation scope (F8)

  - SELECT: warehouse, procurement, admin, or PR1 owner
  - INSERT header: warehouse role only
  - UPDATE header/items: any warehouse staff (matches lib/warehouse.ts)
*/

CREATE OR REPLACE FUNCTION public.can_read_warehouse_validation(p_validation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.warehouse_validations wv
    WHERE wv.id = p_validation_id
      AND (
        public.is_role('admin')
        OR public.is_role('procurement')
        OR public.is_role('warehouse')
        OR EXISTS (
          SELECT 1
          FROM public.pr1_requests pr
          WHERE pr.id = wv.pr1_id
            AND pr.requisitioner_id = auth.uid()
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_read_warehouse_validation(uuid) TO authenticated;

-- warehouse_validations
DROP POLICY IF EXISTS "Authenticated users can read warehouse validations"
  ON public.warehouse_validations;

DROP POLICY IF EXISTS "Authenticated users can insert warehouse validations"
  ON public.warehouse_validations;

DROP POLICY IF EXISTS "Validators can update own warehouse validations"
  ON public.warehouse_validations;

CREATE POLICY "Scoped users can read warehouse validations"
  ON public.warehouse_validations
  FOR SELECT
  TO authenticated
  USING (public.can_read_warehouse_validation(id));

CREATE POLICY "Warehouse staff can insert warehouse validations"
  ON public.warehouse_validations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_role('warehouse')
    AND auth.uid() = validator_id
  );

CREATE POLICY "Warehouse staff can update warehouse validations"
  ON public.warehouse_validations
  FOR UPDATE
  TO authenticated
  USING (public.is_role('warehouse'))
  WITH CHECK (public.is_role('warehouse'));

-- warehouse_validation_items
DROP POLICY IF EXISTS "Authenticated users can read validation items"
  ON public.warehouse_validation_items;

DROP POLICY IF EXISTS "Validator can insert validation items"
  ON public.warehouse_validation_items;

DROP POLICY IF EXISTS "Validator can update validation items"
  ON public.warehouse_validation_items;

CREATE POLICY "Scoped users can read validation items"
  ON public.warehouse_validation_items
  FOR SELECT
  TO authenticated
  USING (public.can_read_warehouse_validation(validation_id));

CREATE POLICY "Warehouse staff can insert validation items"
  ON public.warehouse_validation_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_role('warehouse')
    AND public.can_read_warehouse_validation(validation_id)
  );

CREATE POLICY "Warehouse staff can update validation items"
  ON public.warehouse_validation_items
  FOR UPDATE
  TO authenticated
  USING (
    public.is_role('warehouse')
    AND public.can_read_warehouse_validation(validation_id)
  )
  WITH CHECK (
    public.is_role('warehouse')
    AND public.can_read_warehouse_validation(validation_id)
  );
