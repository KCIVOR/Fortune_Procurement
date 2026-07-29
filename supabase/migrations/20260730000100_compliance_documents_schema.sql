-- ============================================================================
-- PHASE 9 — COMPLIANCE DOCUMENTATION
-- ============================================================================
-- § Adds `requires_compliance_doc` to `supplier_products` (set by Procurement).
-- § Creates `compliance_documents` table — supplier uploads certs per PO item.
-- § Storage bucket `compliance-documents` + RLS.
-- § No hard block on GRN closure per D2 decision — this is informational only.
-- ============================================================================

-- ─── 1. supplier_products: compliance doc flag ───────────────────────────────

ALTER TABLE public.supplier_products
  ADD COLUMN IF NOT EXISTS requires_compliance_doc boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.supplier_products.requires_compliance_doc IS
  'When true, the supplier must upload a compliance/certification document (e.g. Certificate of Calibration) before or after delivery. Soft requirement — does not hard-block GRN closure. Set by Procurement.';

-- ─── 2. compliance_documents table ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.compliance_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id           uuid NOT NULL REFERENCES public.po_requests(id)    ON DELETE CASCADE,
  po_item_id      uuid NOT NULL REFERENCES public.po_items(id)        ON DELETE CASCADE,
  supplier_id     uuid NOT NULL REFERENCES auth.users(id),
  document_type   text NOT NULL DEFAULT 'compliance',
  storage_path    text NOT NULL,   -- compliance-documents/{po_id}/{po_item_id}/{ts}_{filename}
  file_name       text NOT NULL,
  file_size       bigint,
  mime_type       text,
  uploaded_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS compliance_documents_po_id_idx      ON public.compliance_documents(po_id);
CREATE INDEX IF NOT EXISTS compliance_documents_po_item_id_idx ON public.compliance_documents(po_item_id);
CREATE INDEX IF NOT EXISTS compliance_documents_supplier_id_idx ON public.compliance_documents(supplier_id);

ALTER TABLE public.compliance_documents ENABLE ROW LEVEL SECURITY;

-- SELECT: uploader (supplier) or procurement/admin
CREATE POLICY "compliance_documents_select"
ON public.compliance_documents FOR SELECT TO authenticated
USING (
  supplier_id = auth.uid()
  OR public.is_role('procurement')
  OR public.is_role('admin')
);

-- INSERT: supplier may upload for their own POs
CREATE POLICY "compliance_documents_insert"
ON public.compliance_documents FOR INSERT TO authenticated
WITH CHECK (
  supplier_id = auth.uid()
  AND public.is_role('supplier')
  AND EXISTS (
    SELECT 1 FROM public.po_requests po
    WHERE po.id = po_id
      AND po.supplier_id = auth.uid()
      AND po.status IN ('approved', 'sent')
  )
);

-- DELETE: uploader or admin
CREATE POLICY "compliance_documents_delete"
ON public.compliance_documents FOR DELETE TO authenticated
USING (
  supplier_id = auth.uid()
  OR public.is_role('admin')
);

-- ─── 3. Storage bucket ───────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'compliance-documents',
  'compliance-documents',
  FALSE,
  20971520, -- 20 MB per file
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Upload: supplier uploads to their own PO/item folder
CREATE POLICY "compliance_documents_storage_upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'compliance-documents'
  AND split_part(name, '/', 1) = 'compliance-documents'
  AND split_part(name, '/', 2) <> ''   -- po_id
  AND split_part(name, '/', 3) <> ''   -- po_item_id
  AND split_part(name, '/', 4) <> ''   -- filename
  AND split_part(name, '/', 5) = ''    -- no extra segments
  AND EXISTS (
    SELECT 1 FROM public.po_requests po
    WHERE po.id = split_part(name, '/', 2)::uuid
      AND po.supplier_id = auth.uid()
      AND po.status IN ('approved', 'sent')
  )
);

-- Download: supplier (own) or procurement/admin
CREATE POLICY "compliance_documents_storage_download"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'compliance-documents'
  AND (
    EXISTS (
      SELECT 1 FROM public.po_requests po
      WHERE po.id = split_part(name, '/', 2)::uuid
        AND po.supplier_id = auth.uid()
    )
    OR public.is_role('procurement')
    OR public.is_role('admin')
  )
);

-- Delete: uploader or admin
CREATE POLICY "compliance_documents_storage_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'compliance-documents'
  AND (
    owner = auth.uid()
    OR public.is_role('admin')
  )
);
