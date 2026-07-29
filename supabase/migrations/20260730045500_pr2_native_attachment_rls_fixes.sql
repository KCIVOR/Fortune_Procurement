/*
  # Fix PR2 Item Attachments Storage Upload Policy for Services & Raw Materials

  Broadens `pr2_item_attachments_storage_upload` policy on `storage.objects`
  from `request_type = 'raw_material'` to `request_type IN ('raw_material', 'services')`
  so Planning staff can upload line-item attachments when creating or editing draft
  PR2s of either request type.
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
      AND pr2.status = 'draft'
  )
);
