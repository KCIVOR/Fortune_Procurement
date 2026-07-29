/*
  # Fix RFQ Attachments Storage Upload Policy for Procurement Staff

  Broadens `rfq_attachments_storage_upload` policy on `storage.objects` so that
  Procurement staff (`is_role('procurement')` or `is_role('admin')`) can upload
  quote attachments to `rfq-attachments` bucket for any open RFQ assignment (including
  external vendor quote entries where supplier_id is null).
*/

DROP POLICY IF EXISTS "rfq_attachments_storage_upload" ON storage.objects;

CREATE POLICY "rfq_attachments_storage_upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'rfq-attachments'
  AND split_part(name, '/', 1) = 'rfq'
  AND split_part(name, '/', 2) <> ''
  AND split_part(name, '/', 3) <> ''
  AND split_part(name, '/', 4) <> ''
  AND split_part(name, '/', 5) = ''
  AND (
    public.is_role('procurement')
    OR public.is_role('admin')
    OR EXISTS (
      SELECT 1
      FROM public.rfq_suppliers rs
      JOIN public.rfq_batches   rb ON rb.id = rs.rfq_id
      WHERE rs.id          = split_part(name, '/', 3)::uuid
        AND rs.supplier_id = auth.uid()
        AND rb.status      = 'open'
    )
  )
);
