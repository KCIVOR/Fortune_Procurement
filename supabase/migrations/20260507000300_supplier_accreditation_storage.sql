-- supplier-accreditation-documents: private Storage bucket for accreditation,
-- product, and RSE-related file uploads.
--
-- Bucket: supplier-accreditation-documents (private; 20 MB max; PDF, JPEG, PNG)
--
-- Path conventions (split_part indices 1-based):
--   supplier-accreditations/{accreditation_id}/documents/{filename}
--     part 1 = "supplier-accreditations", part 2 = accreditation_id, part 3 = "documents", part 4 = filename
--
--   supplier-products/{product_id}/documents/{filename}
--     part 1 = "supplier-products", part 2 = product_id, part 3 = "documents", part 4 = filename
--
--   rse/{rse_id}/reports/{filename}
--     part 1 = "rse", part 2 = rse_id, part 3 = "reports", part 4 = filename
--
-- Policies granted:
--   Supplier  INSERT  supplier-accreditations/…/documents/ (own accreditation only)
--   Supplier  INSERT  supplier-products/…/documents/       (own product only)
--   Supplier  SELECT  supplier-accreditations/…/documents/ (own accreditation)
--   Supplier  SELECT  supplier-products/…/documents/       (own product)
--   Procurement SELECT  all paths in bucket
--   TSQA      INSERT  rse/…/reports/                       (assigned RSE only)
--   TSQA      SELECT  rse/…/reports/                       (assigned RSE)
--   TSQA      SELECT  supplier-products/…/documents/       (products linked to assigned RSE)
--   Admin     SELECT  all paths in bucket
--
-- Limitations (noted, not blocking):
--   - Supplier accreditation-document paths are validated against the
--     supplier_accreditations table (path-based ownership join).
--   - UUID cast from split_part follows the same pattern as the existing
--     delivery-receipts bucket in migration 20260506093000.
--   - No UPDATE/DELETE is granted on storage objects (same as delivery-receipts).
--   - Admin write/delete of Storage objects must be done via Supabase Studio
--     or service-role API, not through this RLS.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'supplier-accreditation-documents',
  'supplier-accreditation-documents',
  FALSE,
  20971520,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ─── Supplier upload: own accreditation documents ────────────────────────────

CREATE POLICY "accreditation_docs_supplier_upload_accreditation"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'supplier-accreditation-documents'
  AND split_part(name, '/', 1) = 'supplier-accreditations'
  AND split_part(name, '/', 3) = 'documents'
  AND split_part(name, '/', 4) <> ''
  AND split_part(name, '/', 5) = ''
  AND EXISTS (
    SELECT 1 FROM supplier_accreditations sa
    WHERE sa.id = split_part(name, '/', 2)::uuid
      AND sa.supplier_id = auth.uid()
  )
);

-- ─── Supplier upload: own product documents ──────────────────────────────────

CREATE POLICY "accreditation_docs_supplier_upload_product"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'supplier-accreditation-documents'
  AND split_part(name, '/', 1) = 'supplier-products'
  AND split_part(name, '/', 3) = 'documents'
  AND split_part(name, '/', 4) <> ''
  AND split_part(name, '/', 5) = ''
  AND EXISTS (
    SELECT 1 FROM supplier_products sp
    WHERE sp.id = split_part(name, '/', 2)::uuid
      AND sp.supplier_id = auth.uid()
  )
);

-- ─── Supplier read: own accreditation paths ───────────────────────────────────

CREATE POLICY "accreditation_docs_supplier_select_accreditation"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'supplier-accreditation-documents'
  AND split_part(name, '/', 1) = 'supplier-accreditations'
  AND split_part(name, '/', 3) = 'documents'
  AND EXISTS (
    SELECT 1 FROM supplier_accreditations sa
    WHERE sa.id = split_part(name, '/', 2)::uuid
      AND sa.supplier_id = auth.uid()
  )
);

-- ─── Supplier read: own product paths ────────────────────────────────────────

CREATE POLICY "accreditation_docs_supplier_select_product"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'supplier-accreditation-documents'
  AND split_part(name, '/', 1) = 'supplier-products'
  AND split_part(name, '/', 3) = 'documents'
  AND EXISTS (
    SELECT 1 FROM supplier_products sp
    WHERE sp.id = split_part(name, '/', 2)::uuid
      AND sp.supplier_id = auth.uid()
  )
);

-- ─── Procurement: read all paths in bucket ───────────────────────────────────

CREATE POLICY "accreditation_docs_procurement_select"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'supplier-accreditation-documents'
  AND EXISTS (
    SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'procurement'
  )
);

-- ─── TSQA upload: RSE reports (own assigned RSE only) ────────────────────────

CREATE POLICY "accreditation_docs_tsqa_upload_rse_report"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'supplier-accreditation-documents'
  AND split_part(name, '/', 1) = 'rse'
  AND split_part(name, '/', 3) = 'reports'
  AND split_part(name, '/', 4) <> ''
  AND split_part(name, '/', 5) = ''
  AND EXISTS (
    SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'tsqa'
  )
  AND EXISTS (
    SELECT 1 FROM rse_records rr
    WHERE rr.id = split_part(name, '/', 2)::uuid
      AND rr.assigned_to = auth.uid()
  )
);

-- ─── TSQA read: RSE reports for assigned RSE ─────────────────────────────────

CREATE POLICY "accreditation_docs_tsqa_select_rse"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'supplier-accreditation-documents'
  AND split_part(name, '/', 1) = 'rse'
  AND split_part(name, '/', 3) = 'reports'
  AND EXISTS (
    SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'tsqa'
  )
  AND EXISTS (
    SELECT 1 FROM rse_records rr
    WHERE rr.id = split_part(name, '/', 2)::uuid
      AND rr.assigned_to = auth.uid()
  )
);

-- ─── TSQA read: product documents for products linked to an RSE assigned to them

CREATE POLICY "accreditation_docs_tsqa_select_product"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'supplier-accreditation-documents'
  AND split_part(name, '/', 1) = 'supplier-products'
  AND split_part(name, '/', 3) = 'documents'
  AND EXISTS (
    SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'tsqa'
  )
  AND EXISTS (
    SELECT 1 FROM rse_records rr
    WHERE rr.supplier_product_id = split_part(name, '/', 2)::uuid
      AND rr.assigned_to = auth.uid()
  )
);

-- ─── Admin: read all paths in bucket ─────────────────────────────────────────

CREATE POLICY "accreditation_docs_admin_select"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'supplier-accreditation-documents'
  AND EXISTS (
    SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'admin'
  )
);
