-- Migration: 20260805110000_warehouse_validation_approver_read.sql
--
-- can_read_warehouse_validation() grants blanket read access to
-- admin/procurement/warehouse, plus the PR1's own requisitioner, plus an
-- assigned supplier — but never the 'approver' role. Approvers are already
-- fully authorized to view and print PR1s (config/route-access.ts's /pr1/
-- rule includes 'approver'), so the PR1 print page's "For Warehouse Use"
-- signature block silently falls back to "Pending" for any approver, even
-- when the validation is complete, because the underlying RLS-guarded query
-- returns nothing for them.
--
-- Purely additive: widens read access, does not restrict anything.

CREATE OR REPLACE FUNCTION public.can_read_warehouse_validation(p_validation_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    (
      (
        public.is_role('admin')
        OR public.is_role('procurement')
        OR public.is_role('warehouse')
        OR public.is_role('approver')
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
$function$;
