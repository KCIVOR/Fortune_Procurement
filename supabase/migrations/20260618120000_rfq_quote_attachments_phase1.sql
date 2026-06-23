-- ============================================================================
-- RFQ QUOTE ATTACHMENTS - Phase 1
-- ============================================================================
-- Creates rfq_quote_attachments table + RLS, rfq-attachments storage bucket
-- + storage RLS, and adds rfq_item_quote_id FK to pr2_items.
--
-- Path convention: rfq/{rfq_id}/{rfq_supplier_id}/{pr1_item_id}/{ts}_{filename}
--   split_part indices: 1=rfq, 2=rfq_id, 3=rfq_supplier_id, 4=pr1_item_id, 5=filename
-- ============================================================================

-- ─── 1. rfq_quote_attachments table ─────────────────────────────────────────

CREATE TABLE public.rfq_quote_attachments (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id            uuid        NOT NULL REFERENCES public.rfq_batches(id)     ON DELETE CASCADE,
  rfq_supplier_id   uuid        NOT NULL REFERENCES public.rfq_suppliers(id)   ON DELETE CASCADE,
  rfq_item_quote_id uuid        NOT NULL REFERENCES public.rfq_item_quotes(id) ON DELETE CASCADE,
  pr1_item_id       uuid        NOT NULL REFERENCES public.pr1_items(id)       ON DELETE CASCADE,
  uploaded_by       uuid        NOT NULL REFERENCES auth.users(id),
  storage_path      text        NOT NULL,
  file_name         text        NOT NULL,
  file_size         bigint,
  mime_type         text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rfq_quote_attachments_quote_idx    ON public.rfq_quote_attachments(rfq_item_quote_id);
CREATE INDEX rfq_quote_attachments_rfq_idx      ON public.rfq_quote_attachments(rfq_id);
CREATE INDEX rfq_quote_attachments_item_idx     ON public.rfq_quote_attachments(pr1_item_id);
CREATE INDEX rfq_quote_attachments_supplier_idx ON public.rfq_quote_attachments(rfq_supplier_id);

-- ─── 2. Table RLS ────────────────────────────────────────────────────────────

ALTER TABLE public.rfq_quote_attachments ENABLE ROW LEVEL SECURITY;

-- Suppliers upload their own attachments while the RFQ is open
CREATE POLICY "rfq_quote_attachments_insert"
ON public.rfq_quote_attachments
FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.rfq_suppliers rs
    JOIN public.rfq_batches   rb ON rb.id = rs.rfq_id
    WHERE rs.id          = rfq_supplier_id
      AND rs.supplier_id = auth.uid()
      AND rb.status      = 'open'
  )
);

-- Authorized readers: the uploading supplier + procurement/approver/warehouse/admin
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
);

-- Suppliers delete their own attachments while the RFQ is open
CREATE POLICY "rfq_quote_attachments_delete"
ON public.rfq_quote_attachments
FOR DELETE TO authenticated
USING (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.rfq_suppliers rs
    JOIN public.rfq_batches   rb ON rb.id = rs.rfq_id
    WHERE rs.id          = rfq_supplier_id
      AND rs.supplier_id = auth.uid()
      AND rb.status      = 'open'
  )
);

-- ─── 3. Storage bucket ───────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'rfq-attachments',
  'rfq-attachments',
  FALSE,
  10485760,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ─── 4. Storage object RLS ───────────────────────────────────────────────────

-- Upload: supplier may upload to their own rfq_supplier segment in the path
CREATE POLICY "rfq_attachments_storage_upload"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'rfq-attachments'
  AND split_part(name, '/', 1) = 'rfq'
  AND split_part(name, '/', 2) <> ''
  AND split_part(name, '/', 3) <> ''
  AND split_part(name, '/', 4) <> ''
  AND split_part(name, '/', 5) <> ''
  AND EXISTS (
    SELECT 1
    FROM public.rfq_suppliers rs
    JOIN public.rfq_batches   rb ON rb.id = rs.rfq_id
    WHERE rs.id          = split_part(name, '/', 3)::uuid
      AND rs.supplier_id = auth.uid()
      AND rb.status      = 'open'
  )
);

-- Download: procurement/approver/warehouse/admin + the supplier who uploaded
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
  )
);

-- Delete: uploader or admin
CREATE POLICY "rfq_attachments_storage_delete"
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'rfq-attachments'
  AND (
    owner = auth.uid()
    OR public.is_role('admin')
  )
);

-- ─── 5. rfq_item_quote_id FK on pr2_items ────────────────────────────────────

ALTER TABLE public.pr2_items
  ADD COLUMN IF NOT EXISTS rfq_item_quote_id uuid REFERENCES public.rfq_item_quotes(id);

-- ============================================================================
-- ROLLBACK (reference only)
-- ----------------------------------------------------------------------------
-- ALTER TABLE public.pr2_items DROP COLUMN IF EXISTS rfq_item_quote_id;
-- DROP POLICY IF EXISTS "rfq_attachments_storage_delete"   ON storage.objects;
-- DROP POLICY IF EXISTS "rfq_attachments_storage_download" ON storage.objects;
-- DROP POLICY IF EXISTS "rfq_attachments_storage_upload"   ON storage.objects;
-- DELETE FROM storage.buckets WHERE id = 'rfq-attachments';
-- DROP TABLE IF EXISTS public.rfq_quote_attachments;
-- ============================================================================
