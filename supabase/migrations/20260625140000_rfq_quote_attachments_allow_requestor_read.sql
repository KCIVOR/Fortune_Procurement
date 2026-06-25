-- Allow the PR1 requestor (employee) to read RFQ quote attachments for their own
-- PR1 so they can view files on substitute/alternative quotes during review.
-- Previously the table row and storage object were readable only by
-- procurement/approver/warehouse/admin + the uploading supplier, so the employee
-- reviewing a substitute saw no attachment.

-- ── Table SELECT ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "rfq_quote_attachments_select" ON public.rfq_quote_attachments;

CREATE POLICY "rfq_quote_attachments_select"
ON public.rfq_quote_attachments
FOR SELECT TO authenticated
USING (
  uploaded_by = auth.uid()
  OR public.is_role('procurement')
  OR public.is_role('approver')
  OR public.is_role('warehouse')
  OR public.is_role('admin')
  OR EXISTS (
    SELECT 1 FROM public.rfq_suppliers rs
    WHERE rs.id          = rfq_supplier_id
      AND rs.supplier_id = auth.uid()
  )
  -- PR1 requestor may read attachments tied to their own PR1
  OR EXISTS (
    SELECT 1
    FROM public.rfq_batches   rb
    JOIN public.pr1_requests  pr ON pr.id = rb.pr1_id
    WHERE rb.id              = rfq_id
      AND pr.requisitioner_id = auth.uid()
  )
);

-- ── Storage download ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "rfq_attachments_storage_download" ON storage.objects;

CREATE POLICY "rfq_attachments_storage_download"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'rfq-attachments'
  AND split_part(name, '/', 1) = 'rfq'
  AND (
    owner = auth.uid()
    OR public.is_role('procurement')
    OR public.is_role('approver')
    OR public.is_role('warehouse')
    OR public.is_role('admin')
    OR EXISTS (
      SELECT 1 FROM public.rfq_suppliers rs
      WHERE rs.id          = split_part(name, '/', 3)::uuid
        AND rs.supplier_id = auth.uid()
    )
    -- PR1 requestor may download attachments tied to their own PR1
    OR EXISTS (
      SELECT 1
      FROM public.rfq_batches   rb
      JOIN public.pr1_requests  pr ON pr.id = rb.pr1_id
      WHERE rb.id              = split_part(name, '/', 2)::uuid
        AND pr.requisitioner_id = auth.uid()
    )
  )
);
