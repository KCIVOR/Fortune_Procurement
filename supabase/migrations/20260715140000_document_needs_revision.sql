/*
  # Document needs_revision + supplier replace (same row)

  - Add revision_note text
  - Extend status CHECK with needs_revision
  - Narrow supplier UPDATE: only accreditation application docs in needs_revision
    → may set uploaded + clear revision_note (replace flow)
  - Application status is NOT changed by this migration
*/

ALTER TABLE public.supplier_documents
  ADD COLUMN IF NOT EXISTS revision_note text;

ALTER TABLE public.supplier_documents
  DROP CONSTRAINT IF EXISTS supplier_documents_status_check;

ALTER TABLE public.supplier_documents
  ADD CONSTRAINT supplier_documents_status_check
  CHECK (status = ANY (ARRAY[
    'uploaded'::text,
    'accepted'::text,
    'rejected'::text,
    'expired'::text,
    'needs_revision'::text
  ]));

DROP POLICY IF EXISTS "supplier_documents_supplier_update_needs_revision" ON public.supplier_documents;

CREATE POLICY "supplier_documents_supplier_update_needs_revision"
  ON public.supplier_documents
  FOR UPDATE
  TO authenticated
  USING (
    supplier_id = auth.uid()
    AND status = 'needs_revision'
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
