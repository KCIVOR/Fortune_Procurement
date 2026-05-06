/*
  # Supplier accreditation: withdrawn status + supplier withdraw path

  - Adds status value `withdrawn` (CHECK constraint).
  - Extends supplier write trigger to allow draft/submitted/missing_documents → withdrawn
    without changing procurement-controlled columns.
  - Extends supplier UPDATE RLS so suppliers can withdraw from submitted (not only submit).
*/

-- ─── Status CHECK ────────────────────────────────────────────────────────────

ALTER TABLE public.supplier_accreditations
  DROP CONSTRAINT IF EXISTS supplier_accreditations_status_check;

ALTER TABLE public.supplier_accreditations
  ADD CONSTRAINT supplier_accreditations_status_check
  CHECK (status IN (
    'draft',
    'submitted',
    'under_review',
    'missing_documents',
    'approved',
    'rejected',
    'withdrawn'
  ));

-- ─── Supplier write trigger (replace body) ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.enforce_supplier_accreditations_supplier_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF public.auth_is_supplier_only() THEN
      IF NEW.status IS DISTINCT FROM 'draft' THEN
        RAISE EXCEPTION 'Supplier accreditation must be created as draft';
      END IF;
      IF NEW.submitted_at IS NOT NULL OR NEW.reviewed_by IS NOT NULL OR NEW.reviewed_at IS NOT NULL
         OR NEW.review_notes IS NOT NULL OR NEW.missing_documents_note IS NOT NULL
         OR NEW.approved_at IS NOT NULL OR NEW.rejected_at IS NOT NULL THEN
        RAISE EXCEPTION 'Supplier cannot set procurement-controlled accreditation fields on insert';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF public.auth_is_supplier_only() THEN
      IF OLD.supplier_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Not allowed';
      END IF;
      IF NEW.supplier_id IS DISTINCT FROM OLD.supplier_id
         OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'Cannot change supplier_id or created_at';
      END IF;

      IF OLD.status IN ('draft', 'missing_documents') AND NEW.status = 'submitted' THEN
        IF NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
           OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
           OR NEW.review_notes IS DISTINCT FROM OLD.review_notes
           OR NEW.missing_documents_note IS DISTINCT FROM OLD.missing_documents_note
           OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
           OR NEW.rejected_at IS DISTINCT FROM OLD.rejected_at THEN
          RAISE EXCEPTION 'Cannot change procurement-controlled fields when submitting accreditation';
        END IF;
        RETURN NEW;
      END IF;

      IF OLD.status IN ('draft', 'submitted', 'missing_documents') AND NEW.status = 'withdrawn' THEN
        IF NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
           OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
           OR NEW.review_notes IS DISTINCT FROM OLD.review_notes
           OR NEW.missing_documents_note IS DISTINCT FROM OLD.missing_documents_note
           OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
           OR NEW.rejected_at IS DISTINCT FROM OLD.rejected_at THEN
          RAISE EXCEPTION 'Cannot change procurement-controlled fields when withdrawing application';
        END IF;
        IF NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
          RAISE EXCEPTION 'Cannot change submitted_at when withdrawing application';
        END IF;
        RETURN NEW;
      END IF;

      RAISE EXCEPTION 'Supplier accreditation update not permitted';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- ─── Supplier UPDATE RLS: submit OR withdraw ────────────────────────────────

DROP POLICY IF EXISTS "supplier_accreditations_supplier_update" ON public.supplier_accreditations;

CREATE POLICY "supplier_accreditations_supplier_update"
  ON public.supplier_accreditations FOR UPDATE TO authenticated
  USING (
    supplier_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
    AND status IN ('draft', 'missing_documents', 'submitted')
  )
  WITH CHECK (
    supplier_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
    AND (
      (
        status = 'submitted'
        AND submitted_at IS NOT NULL
      )
      OR (status = 'withdrawn')
    )
  );

COMMENT ON POLICY "supplier_accreditations_supplier_update" ON public.supplier_accreditations IS
  'Supplier may submit (draft/missing_documents → submitted) or withdraw (draft/submitted/missing_documents → withdrawn).';
