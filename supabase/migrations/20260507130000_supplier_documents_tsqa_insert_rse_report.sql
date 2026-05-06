/*
  # TSQA: INSERT on supplier_documents for RSE evaluation reports only

  Assigned TSQA users could upload to Storage (existing policy) but had no
  INSERT policy on supplier_documents, causing RLS failures after upload.

  This policy is narrow:
  - role = tsqa
  - document_type = rse_report only
  - uploaded_by = auth.uid()
  - file_path matches rse/{rse_id}/reports/...
  - rse_id in path matches an RSE assigned to auth.uid() with matching
    supplier_id, supplier_product_id, and accreditation_id (IS NOT DISTINCT FROM).
*/

CREATE POLICY "supplier_documents_tsqa_insert_rse_report"
  ON public.supplier_documents FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'tsqa'
    )
    AND uploaded_by = auth.uid()
    AND document_type = 'rse_report'
    AND supplier_product_id IS NOT NULL
    AND split_part(file_path, '/', 1) = 'rse'
    AND split_part(file_path, '/', 3) = 'reports'
    AND split_part(file_path, '/', 4) <> ''
    AND EXISTS (
      SELECT 1 FROM public.rse_records rr
      WHERE rr.id = split_part(file_path, '/', 2)::uuid
        AND rr.supplier_id           = supplier_id
        AND rr.supplier_product_id   = supplier_product_id
        AND rr.accreditation_id IS NOT DISTINCT FROM accreditation_id
        AND rr.assigned_to           = auth.uid()
    )
  );

COMMENT ON POLICY "supplier_documents_tsqa_insert_rse_report" ON public.supplier_documents IS
  'TSQA may insert RSE report metadata only for own assigned RSE; path must match rse/{id}/reports/.';
