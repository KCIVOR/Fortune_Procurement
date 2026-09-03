/*
  Fix: supplier (and procurement) quote-attachment uploads to the
  'rfq-attachments' bucket have been silently rejected by RLS since
  20260730050800_fix_rfq_attachments_storage_upload_procurement.sql.

  The app has always uploaded to a 5-segment path:
    rfq/{rfqId}/{rfqSupplierId}/{itemId}/{timestamp}_{filename}
  (documented in 20260618120000_rfq_quote_attachments_phase1.sql, which
  correctly required split_part(name,'/',5) <> '').

  20260730050800 rewrote the policy to add procurement upload rights but
  flipped that check to split_part(name,'/',5) = '' (must be EMPTY) — the
  opposite of what the real path shape produces. Every upload through the
  app since then has failed RLS silently: uploadRfqQuoteAttachment's error
  is swallowed by a best-effort .catch() in the supplier quotation page, so
  the quote still submits successfully with no visible error while the
  attachment quietly never lands in rfq_quote_attachments or storage.

  This restores the correct 5-segment check (segment 5 = filename, must be
  non-empty) while keeping the procurement/admin upload broadening intact.
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
  AND split_part(name, '/', 5) <> ''
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
