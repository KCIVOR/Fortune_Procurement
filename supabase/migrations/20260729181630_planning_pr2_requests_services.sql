/*
  # Planning-direct PR2 — extend to Services

  Services Workflow Alignment Phase 3 (docs/services-workflow-alignment-plan.md):
  Planning may now create a Services PR2 directly (no PR1), same as Raw
  Material already works (Final_Workflow.md §5.1 step 1b).

  Broadens the three Planning-scoped INSERT/UPDATE/DELETE policies on
  pr2_requests from request_type = 'raw_material' to
  request_type IN ('raw_material', 'services'). Same Planning-role/position
  condition — no other change.
*/

DROP POLICY IF EXISTS "Planning can insert raw material PR2 requests" ON public.pr2_requests;

CREATE POLICY "Planning can insert raw material PR2 requests"
  ON public.pr2_requests
  FOR INSERT
  WITH CHECK (
    request_type IN ('raw_material', 'services')
    AND requisitioner_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM profiles p
      JOIN roles r ON r.id = p.role_id
      LEFT JOIN positions pos ON pos.id = p.position_id
      LEFT JOIN departments d ON d.id = p.department_id
      WHERE p.id = auth.uid()
        AND r.name = 'employee'
        AND (pos.title = 'Planning Staff' OR d.code = 'PLAN')
    )
  );

DROP POLICY IF EXISTS "Planning can update own draft raw material PR2 requests" ON public.pr2_requests;

CREATE POLICY "Planning can update own draft raw material PR2 requests"
  ON public.pr2_requests
  FOR UPDATE
  USING (
    requisitioner_id = auth.uid()
    AND request_type IN ('raw_material', 'services')
    AND status = 'draft'
  )
  WITH CHECK (
    requisitioner_id = auth.uid()
    AND request_type IN ('raw_material', 'services')
  );

DROP POLICY IF EXISTS "Planning can delete own draft raw material PR2 requests" ON public.pr2_requests;

CREATE POLICY "Planning can delete own draft raw material PR2 requests"
  ON public.pr2_requests
  FOR DELETE
  USING (
    requisitioner_id = auth.uid()
    AND request_type IN ('raw_material', 'services')
    AND status = 'draft'
  );

-- Same broadening for pr2_items (createRawMaterialPR2/syncRawMaterialItems in
-- lib/pr2-planning.ts insert/update/delete pr2_items directly for the PR2's
-- own requisitioner).

DROP POLICY IF EXISTS "Planning can insert raw material PR2 items" ON public.pr2_items;

CREATE POLICY "Planning can insert raw material PR2 items"
  ON public.pr2_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pr2_requests pr2
      WHERE pr2.id = pr2_items.pr2_id
        AND pr2.requisitioner_id = auth.uid()
        AND pr2.request_type IN ('raw_material', 'services')
        AND pr2.status = 'draft'
    )
  );

DROP POLICY IF EXISTS "Planning can update raw material PR2 items" ON public.pr2_items;

CREATE POLICY "Planning can update raw material PR2 items"
  ON public.pr2_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM pr2_requests pr2
      WHERE pr2.id = pr2_items.pr2_id
        AND pr2.requisitioner_id = auth.uid()
        AND pr2.request_type IN ('raw_material', 'services')
        AND pr2.status = 'draft'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pr2_requests pr2
      WHERE pr2.id = pr2_items.pr2_id
        AND pr2.requisitioner_id = auth.uid()
        AND pr2.request_type IN ('raw_material', 'services')
        AND pr2.status = 'draft'
    )
  );

DROP POLICY IF EXISTS "Planning can delete raw material PR2 items" ON public.pr2_items;

CREATE POLICY "Planning can delete raw material PR2 items"
  ON public.pr2_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM pr2_requests pr2
      WHERE pr2.id = pr2_items.pr2_id
        AND pr2.requisitioner_id = auth.uid()
        AND pr2.request_type IN ('raw_material', 'services')
        AND pr2.status = 'draft'
    )
  );

-- Same broadening for pr2_item_attachments (uploadPR2ItemAttachment insert
-- guard + the can_read_pr2_raw_material() SELECT helper it and
-- fetchPR2ItemAttachments rely on). Delete policy is already type-agnostic
-- (uploaded_by = auth.uid() OR admin) — no change needed there.

DROP POLICY IF EXISTS "pr2_item_attachments_insert" ON public.pr2_item_attachments;

CREATE POLICY "pr2_item_attachments_insert"
  ON public.pr2_item_attachments
  FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM pr2_requests pr2
      WHERE pr2.id = pr2_item_attachments.pr2_id
        AND pr2.request_type IN ('raw_material', 'services')
        AND pr2.requisitioner_id = auth.uid()
        AND pr2.status = 'draft'
    )
  );

CREATE OR REPLACE FUNCTION public.can_read_pr2_raw_material(p_pr2_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.pr2_requests pr2
    WHERE pr2.id = p_pr2_id
      AND pr2.request_type IN ('raw_material', 'services')
      AND (
        pr2.requisitioner_id = auth.uid()
        OR public.is_role('admin')
        OR public.is_role('procurement')
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
            OR pr2.department_id = (
              SELECT department_id FROM public.profiles WHERE id = auth.uid()
            )
          )
        )
        OR public.is_supplier_assigned_to_pr2(p_pr2_id)
      )
  );
$function$;
