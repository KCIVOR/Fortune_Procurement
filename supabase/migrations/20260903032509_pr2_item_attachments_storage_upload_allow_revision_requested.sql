/*
  Fix: Planning re-attaching a file to a Services/Raw-Material PR2 while it's
  back in `revision_requested` (after Dept Head/Operations Manager sends it
  back for revision) fails at the storage layer with "new row violates
  row-level security policy".

  20260803060000_pr2_items_revision_requested_rls.sql already widened the
  TABLE policies (pr2_items, pr2_item_attachments) from status = 'draft' to
  status IN ('draft', 'revision_requested') — but missed the separate
  storage.objects upload policy for the 'pr2-item-attachments' bucket, which
  Supabase Storage enforces independently of the table policies. This
  mirrors the equivalent fix already in place for pr1-attachments
  (pr1_attachments_storage_upload already allows both statuses).
*/

DROP POLICY IF EXISTS "pr2_item_attachments_storage_upload" ON storage.objects;

CREATE POLICY "pr2_item_attachments_storage_upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'pr2-item-attachments'
  AND split_part(name, '/', 1) = 'pr2'
  AND split_part(name, '/', 2) <> ''   -- pr2_id
  AND split_part(name, '/', 3) <> ''   -- pr2_item_id
  AND split_part(name, '/', 4) <> ''   -- filename
  AND split_part(name, '/', 5) = ''    -- no extra segments
  AND EXISTS (
    SELECT 1 FROM public.pr2_requests pr2
    WHERE pr2.id = split_part(name, '/', 2)::uuid
      AND pr2.request_type IN ('raw_material', 'services')
      AND pr2.requisitioner_id = auth.uid()
      AND pr2.status IN ('draft', 'revision_requested')
  )
);
