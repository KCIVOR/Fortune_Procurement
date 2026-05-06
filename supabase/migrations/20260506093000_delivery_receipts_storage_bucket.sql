-- Delivery receipts: private Storage bucket and RLS policies
-- Bucket: delivery-receipts (private; signed URLs for reads)
-- 10MB max per object; MIME allow-list at bucket (PDF, JPEG, PNG)
-- Path: deliveries/{delivery_id}/dr/{filename}
-- INSERT: supplier only for paths under deliveries/{id}/dr/ where supplier owns delivery
-- SELECT: supplier own; procurement, warehouse, approver (all under path); employee own requisition
-- No admin read (no deliveries SELECT for admin in current schema)
-- UPDATE/DELETE on objects not granted

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'delivery-receipts',
  'delivery-receipts',
  FALSE,
  10485760,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public               = EXCLUDED.public,
  file_size_limit       = EXCLUDED.file_size_limit,
  allowed_mime_types    = EXCLUDED.allowed_mime_types;


-- ─── Supplier upload (own deliveries only) ────────────────────────────────────

CREATE POLICY "delivery_receipts_supplier_upload_own_delivery"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'delivery-receipts'
  AND split_part(name, '/', 1) = 'deliveries'
  AND split_part(name, '/', 3) = 'dr'
  AND split_part(name, '/', 4) <> ''
  AND split_part(name, '/', 5) = ''
  AND EXISTS (
    SELECT 1
    FROM deliveries d
    WHERE d.id = split_part(name, '/', 2)::uuid
      AND d.supplier_id = auth.uid()
  )
);


-- ─── Supplier read own ─────────────────────────────────────────────────────────

CREATE POLICY "delivery_receipts_supplier_select_own_delivery"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'delivery-receipts'
  AND split_part(name, '/', 1) = 'deliveries'
  AND split_part(name, '/', 3) = 'dr'
  AND EXISTS (
    SELECT 1
    FROM deliveries d
    WHERE d.id = split_part(name, '/', 2)::uuid
      AND d.supplier_id = auth.uid()
  )
);


-- ─── Procurement / warehouse / approver — read all in bucket ────────────────

CREATE POLICY "delivery_receipts_procurement_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'delivery-receipts'
  AND split_part(name, '/', 1) = 'deliveries'
  AND split_part(name, '/', 3) = 'dr'
  AND EXISTS (
    SELECT 1 FROM profiles p
    JOIN roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'procurement'
  )
);


CREATE POLICY "delivery_receipts_warehouse_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'delivery-receipts'
  AND split_part(name, '/', 1) = 'deliveries'
  AND split_part(name, '/', 3) = 'dr'
  AND EXISTS (
    SELECT 1 FROM profiles p
    JOIN roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'warehouse'
  )
);


CREATE POLICY "delivery_receipts_approver_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'delivery-receipts'
  AND split_part(name, '/', 1) = 'deliveries'
  AND split_part(name, '/', 3) = 'dr'
  AND EXISTS (
    SELECT 1 FROM profiles p
    JOIN roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'approver'
  )
);


-- ─── Employee — read receipts for deliveries on their PR1s ──────────────────────

CREATE POLICY "delivery_receipts_employee_select_own_requisition"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'delivery-receipts'
  AND split_part(name, '/', 1) = 'deliveries'
  AND split_part(name, '/', 3) = 'dr'
  AND EXISTS (
    SELECT 1
    FROM deliveries d
    WHERE d.id = split_part(name, '/', 2)::uuid
      AND d.requisitioner_id = auth.uid()
  )
);
