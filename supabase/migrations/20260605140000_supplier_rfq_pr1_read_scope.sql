/*
  Allow suppliers to read PR1 header/items (and warehouse validation lines) only when
  they are assigned to the RFQ for that PR1 via rfq_suppliers.

  Fixes supplier quotation page "RFQ not found or access denied" after Phase 1B.
*/

CREATE OR REPLACE FUNCTION public.is_supplier_assigned_to_pr1(p_pr1_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_role('supplier')
    AND EXISTS (
      SELECT 1
      FROM public.rfq_batches rb
      INNER JOIN public.rfq_suppliers rs ON rs.rfq_id = rb.id
      WHERE rb.pr1_id = p_pr1_id
        AND rs.supplier_id = auth.uid()
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_supplier_assigned_to_pr1(uuid) TO authenticated;

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
        OR public.is_supplier_assigned_to_pr1(p_pr1_id)
      )
  );
$$;

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
  )
  OR EXISTS (
    SELECT 1
    FROM public.warehouse_validations wv
    WHERE wv.id = p_validation_id
      AND public.is_supplier_assigned_to_pr1(wv.pr1_id)
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_read_pr1(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_warehouse_validation(uuid) TO authenticated;
