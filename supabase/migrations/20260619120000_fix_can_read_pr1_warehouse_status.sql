/*
  Fix: can_read_pr1 — restore warehouse status + supplier access

  Phase 1 department segregation migration (20260619000100) overwrote can_read_pr1
  using an outdated base, losing two previously applied fixes:
    1. approved_for_warehouse status (from 20260616011200)
    2. is_supplier_assigned_to_pr1 supplier access clause (from 20260605140000)

  This migration restores all three concerns in a single canonical version:
    - warehouse: reads both pending_warehouse and approved_for_warehouse
    - approver: department-scoped (with Director/Finance Director exemption)
    - supplier: reads PR1 only when assigned via rfq_suppliers
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
                AND pos.title IN ('Director', 'Finance Director')
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
