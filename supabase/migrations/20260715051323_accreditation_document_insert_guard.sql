/*
  # Guard accreditation-document inserts against closed applications

  Evidence: logic audit 2026-07-15 found `supplier_documents_supplier_insert`
  (20260507000200) checks only supplier_id = auth.uid() — it never verifies
  that accreditation_id actually belongs to that supplier, nor that the
  parent application is still open. The app layer (uploadSupplierAccreditationDocument)
  now checks status client/server-side, but that was enforcement-by-convention
  only; this migration makes it a real DB guarantee.

  Scope: only tightens the accreditation-application branch
  (accreditation_id IS NOT NULL AND supplier_product_id IS NULL). Product and
  RSE document inserts are untouched — out of scope for this feature.
*/

DROP POLICY IF EXISTS "supplier_documents_supplier_insert" ON public.supplier_documents;

CREATE POLICY "supplier_documents_supplier_insert"
  ON public.supplier_documents FOR INSERT TO authenticated
  WITH CHECK (
    supplier_id = auth.uid()
    AND uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
    AND (
      supplier_product_id IS NOT NULL
      OR accreditation_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.supplier_accreditations sa
        WHERE sa.id = supplier_documents.accreditation_id
          AND sa.supplier_id = auth.uid()
          AND sa.status NOT IN ('withdrawn', 'rejected', 'expired')
      )
    )
  );
