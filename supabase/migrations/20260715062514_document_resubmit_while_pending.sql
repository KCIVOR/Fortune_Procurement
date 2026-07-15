/*
  # Allow resubmission on Pending (uploaded) documents too

  Follow-up: resubmit was widened to needs_revision + rejected, but a
  document still sitting Pending (never yet acted on by procurement) had no
  replace path either — only the "upload a duplicate row" workaround, same
  class of gap as rejected had before. Widen resubmit to also cover
  'uploaded' so the supplier can swap a file in place before procurement
  reviews it, instead of leaving two rows of the same document_type.

  WITH CHECK is unchanged — resubmission must still land exactly on
  uploaded + revision_note/expires_at cleared, so this is a same-status
  replace when starting from 'uploaded'.
*/

DROP POLICY IF EXISTS "supplier_documents_supplier_resubmit" ON public.supplier_documents;

CREATE POLICY "supplier_documents_supplier_resubmit"
  ON public.supplier_documents
  FOR UPDATE
  TO authenticated
  USING (
    supplier_id = auth.uid()
    AND status IN ('uploaded', 'needs_revision', 'rejected')
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
