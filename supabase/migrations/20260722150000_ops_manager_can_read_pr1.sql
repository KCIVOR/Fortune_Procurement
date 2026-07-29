/*
  Fix: Operations Manager final-approves Goods PR2, but cannot SELECT the linked PR1
  (can_read_pr1 was department-scoped and only exempted Director / Finance Director).

  PostgREST UPDATE on an invisible row is a silent no-op, so PR1 stayed
  pr2_pending_approval and never entered the Procurement RFQ queue (needs pr2_approved).

  Align with PR2 RLS (20260721150200): Operations Manager is org-wide like Director.
*/

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
          AND (
            EXISTS (
              SELECT 1
              FROM public.profiles p
              LEFT JOIN public.positions pos ON pos.id = p.position_id
              WHERE p.id = auth.uid()
                AND pos.title IN ('Director', 'Finance Director', 'Operations Manager')
            )
            OR pr.department_id = (
              SELECT department_id FROM public.profiles WHERE id = auth.uid()
            )
          )
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
