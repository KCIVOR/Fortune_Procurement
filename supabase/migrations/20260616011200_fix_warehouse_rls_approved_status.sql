-- Migration: Fix warehouse RLS and read visibility for realigned status

-- 1. Update can_read_pr1 function to support approved_for_warehouse
CREATE OR REPLACE FUNCTION public.can_read_pr1(p_pr1_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
            pr.status IN ('pending_warehouse', 'approved_for_warehouse')
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
$function$;

-- 2. Update RLS policy for pr1_requests status transition
DROP POLICY IF EXISTS "Warehouse can transition PR1 status from pending_warehouse" ON public.pr1_requests;
DROP POLICY IF EXISTS "Warehouse can transition PR1 status" ON public.pr1_requests;

CREATE POLICY "Warehouse can transition PR1 status"
  ON public.pr1_requests
  FOR UPDATE
  TO authenticated
  USING (status IN ('pending_warehouse', 'approved_for_warehouse'))
  WITH CHECK (status IN (
    'resolved_internal',
    'for_canvassing',
    'pending_approval',
    'rejected',
    'revision_requested'
  ));
