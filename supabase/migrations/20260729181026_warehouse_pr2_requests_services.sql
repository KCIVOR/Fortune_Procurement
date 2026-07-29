/*
  # Warehouse PR2 creation/update — extend to Services

  Services Workflow Alignment Phase 2 (docs/services-workflow-alignment-plan.md):
  Warehouse now creates the PR2 directly for Services requests too (same
  handoff role it already performs for Goods — Final_Workflow.md §5.2 step 4).

  Broadens the existing goods-only warehouse INSERT/UPDATE policies on
  pr2_requests to also allow pr1.request_type = 'services'. No other
  condition changes — same warehouse-role check, same pr1_id join.
*/

DROP POLICY IF EXISTS "warehouse_insert_pr2_requests_goods" ON public.pr2_requests;

CREATE POLICY "warehouse_insert_pr2_requests_goods"
  ON public.pr2_requests
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles p
      JOIN roles r ON r.id = p.role_id
      JOIN pr1_requests pr1 ON pr1.id = pr2_requests.pr1_id
      WHERE p.id = auth.uid()
        AND r.name = 'warehouse'
        AND pr1.request_type IN ('goods', 'services')
    )
  );

DROP POLICY IF EXISTS "warehouse_update_pr2_requests_goods" ON public.pr2_requests;

CREATE POLICY "warehouse_update_pr2_requests_goods"
  ON public.pr2_requests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM profiles p
      JOIN roles r ON r.id = p.role_id
      JOIN pr1_requests pr1 ON pr1.id = pr2_requests.pr1_id
      WHERE p.id = auth.uid()
        AND r.name = 'warehouse'
        AND pr1.request_type IN ('goods', 'services')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles p
      JOIN roles r ON r.id = p.role_id
      JOIN pr1_requests pr1 ON pr1.id = pr2_requests.pr1_id
      WHERE p.id = auth.uid()
        AND r.name = 'warehouse'
        AND pr1.request_type IN ('goods', 'services')
    )
  );
