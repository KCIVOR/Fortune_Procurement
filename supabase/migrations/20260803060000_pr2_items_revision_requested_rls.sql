-- Phase 1 of docs/pr2-items-revision-requested-rls-gap-fix-plan.md
-- Widens the pr2_items (insert/update/delete) and pr2_item_attachments (insert)
-- Planning policies from status = 'draft' to status IN ('draft', 'revision_requested'),
-- matching the sibling pr2_requests policy already widened in
-- 20260731060000_pr2_revision_requested_rls.sql. Fixes: Planning editing/deleting
-- an item, or uploading an attachment, on a revision_requested raw-material/services
-- PR2 was silently blocked by RLS (UPDATE/DELETE) or raised a raw RLS error (INSERT),
-- even though app-layer code already correctly allowed the edit.

-- pr2_items: INSERT
DROP POLICY IF EXISTS "Planning can insert raw material PR2 items" ON public.pr2_items;
CREATE POLICY "Planning can insert raw material PR2 items"
  ON public.pr2_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pr2_requests pr2
      WHERE pr2.id = pr2_items.pr2_id
        AND pr2.requisitioner_id = auth.uid()
        AND pr2.request_type IN ('raw_material', 'services')
        AND pr2.status IN ('draft', 'revision_requested')
    )
  );

-- pr2_items: UPDATE
DROP POLICY IF EXISTS "Planning can update raw material PR2 items" ON public.pr2_items;
CREATE POLICY "Planning can update raw material PR2 items"
  ON public.pr2_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pr2_requests pr2
      WHERE pr2.id = pr2_items.pr2_id
        AND pr2.requisitioner_id = auth.uid()
        AND pr2.request_type IN ('raw_material', 'services')
        AND pr2.status IN ('draft', 'revision_requested')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pr2_requests pr2
      WHERE pr2.id = pr2_items.pr2_id
        AND pr2.requisitioner_id = auth.uid()
        AND pr2.request_type IN ('raw_material', 'services')
        AND pr2.status IN ('draft', 'revision_requested')
    )
  );

-- pr2_items: DELETE
DROP POLICY IF EXISTS "Planning can delete raw material PR2 items" ON public.pr2_items;
CREATE POLICY "Planning can delete raw material PR2 items"
  ON public.pr2_items FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pr2_requests pr2
      WHERE pr2.id = pr2_items.pr2_id
        AND pr2.requisitioner_id = auth.uid()
        AND pr2.request_type IN ('raw_material', 'services')
        AND pr2.status IN ('draft', 'revision_requested')
    )
  );

-- pr2_item_attachments: INSERT
DROP POLICY IF EXISTS "pr2_item_attachments_insert" ON public.pr2_item_attachments;
CREATE POLICY "pr2_item_attachments_insert"
  ON public.pr2_item_attachments FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.pr2_requests pr2
      WHERE pr2.id = pr2_item_attachments.pr2_id
        AND pr2.request_type IN ('raw_material', 'services')
        AND pr2.requisitioner_id = auth.uid()
        AND pr2.status IN ('draft', 'revision_requested')
    )
  );
