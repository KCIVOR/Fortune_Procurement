/*
  # Allow resubmission on rejected documents, not just needs_revision

  Product decision 2026-07-15: Reject was a dead end — the row couldn't be
  updated by the supplier and the app layer didn't stop a fresh duplicate
  upload of the same document_type either, so rejected was silently
  workaroundable anyway. Chose to make Reject an explicit "harder
  needs-revision" instead: same resubmit mechanics, same single-row
  in-place replace, no separate application-status side effect.

  Renames the policy (was scoped to needs_revision only) and widens its
  USING clause to include 'rejected'. WITH CHECK is unchanged — resubmission
  must still land exactly on uploaded + revision_note/expires_at cleared.
*/

DROP POLICY IF EXISTS "supplier_documents_supplier_update_needs_revision" ON public.supplier_documents;

CREATE POLICY "supplier_documents_supplier_resubmit"
  ON public.supplier_documents
  FOR UPDATE
  TO authenticated
  USING (
    supplier_id = auth.uid()
    AND status IN ('needs_revision', 'rejected')
    AND accreditation_id IS NOT NULL
    AND supplier_product_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
    AND EXISTS (
      SELECT 1 FROM public.supplier_accreditations sa
      WHERE sa.id = supplier_documents.accreditation_id
        AND sa.supplier_id = auth.uid()
    )
  )
  WITH CHECK (
    supplier_id = auth.uid()
    AND status = 'uploaded'
    AND revision_note IS NULL
    AND expires_at IS NULL
    AND accreditation_id IS NOT NULL
    AND supplier_product_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
    AND EXISTS (
      SELECT 1 FROM public.supplier_accreditations sa
      WHERE sa.id = supplier_documents.accreditation_id
        AND sa.supplier_id = auth.uid()
    )
  );
