/*
  # Fix DB Table RLS Insert Policy for rfq_quote_attachments

  Broadens `rfq_quote_attachments_insert` policy on `public.rfq_quote_attachments` table
  so that Procurement staff (`is_role('procurement')` or `is_role('admin')`) can insert
  quote attachment records for any open RFQ assignment (including external vendor quote entries).
*/

DROP POLICY IF EXISTS "rfq_quote_attachments_insert" ON public.rfq_quote_attachments;

CREATE POLICY "rfq_quote_attachments_insert"
ON public.rfq_quote_attachments
FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.rfq_suppliers rs
    JOIN public.rfq_batches   rb ON rb.id = rs.rfq_id
    WHERE rs.id = rfq_quote_attachments.rfq_supplier_id
      AND rb.status = 'open'
      AND (
        rs.supplier_id = auth.uid()
        OR public.is_role('procurement')
        OR public.is_role('admin')
      )
  )
);
