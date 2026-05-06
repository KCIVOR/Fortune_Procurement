/*
  # Tighten supplier RLS on accreditation, products, and documents

  Replaces permissive supplier INSERT/UPDATE policies so suppliers cannot
  self-approve accreditation, self-verify products, or forge procurement fields.

  Procurement / admin / TSQA policies are unchanged.

  Triggers supplement RLS where NEW vs OLD row comparisons are required
  (e.g. supplier submit must not mutate procurement-owned columns).
*/

-- ═══════════════════════════════════════════════════════════════════════════
-- Helper: true when the session user is a supplier and not procurement/admin/tsqa
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.auth_is_supplier_only()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'supplier'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name IN ('procurement', 'admin', 'tsqa')
  );
$$;

COMMENT ON FUNCTION public.auth_is_supplier_only() IS
  'Used by supplier write triggers; true for supplier-only sessions (Phase 7 RLS hardening).';

-- ═══════════════════════════════════════════════════════════════════════════
-- supplier_accreditations: BEFORE trigger for supplier sessions
-- ═══════════════════════════════════════════════════════════════════════════

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

      RAISE EXCEPTION 'Supplier accreditation update not permitted';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_supplier_accreditations_supplier_write ON public.supplier_accreditations;
CREATE TRIGGER tr_supplier_accreditations_supplier_write
  BEFORE INSERT OR UPDATE ON public.supplier_accreditations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_supplier_accreditations_supplier_write();

-- ═══════════════════════════════════════════════════════════════════════════
-- supplier_products: BEFORE trigger for supplier draft / submit updates
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.enforce_supplier_products_supplier_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NOT public.auth_is_supplier_only() THEN
    RETURN NEW;
  END IF;

  IF OLD.supplier_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF NEW.supplier_id IS DISTINCT FROM OLD.supplier_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Cannot change supplier_id or created_at';
  END IF;

  -- No further supplier edits after submission (procurement / TSQA own the row)
  IF OLD.status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'Supplier cannot update product in current status';
  END IF;

  -- Draft edits: only catalogue / link fields + updated_at
  IF NEW.status = 'draft' THEN
    IF NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
       OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
       OR NEW.verified_at IS DISTINCT FROM OLD.verified_at OR NEW.rejected_at IS DISTINCT FROM OLD.rejected_at
       OR NEW.review_notes IS DISTINCT FROM OLD.review_notes THEN
      RAISE EXCEPTION 'Invalid fields for draft product update';
    END IF;
    IF NEW.accreditation_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.supplier_accreditations sa
      WHERE sa.id = NEW.accreditation_id AND sa.supplier_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'accreditation_id must belong to the supplier';
    END IF;
    RETURN NEW;
  END IF;

  -- Submit for review: draft -> submitted (app sends status, submitted_at, updated_at only)
  IF NEW.status = 'submitted' THEN
    IF NEW.submitted_at IS NULL THEN
      RAISE EXCEPTION 'submitted_at required when submitting product';
    END IF;
    IF NEW.product_name IS DISTINCT FROM OLD.product_name
       OR NEW.product_code IS DISTINCT FROM OLD.product_code
       OR NEW.category IS DISTINCT FROM OLD.category
       OR NEW.description IS DISTINCT FROM OLD.description
       OR NEW.specifications IS DISTINCT FROM OLD.specifications
       OR NEW.accreditation_id IS DISTINCT FROM OLD.accreditation_id THEN
      RAISE EXCEPTION 'Submit must not change product payload in the same operation';
    END IF;
    IF NEW.reviewed_by IS NOT NULL OR NEW.reviewed_at IS NOT NULL
       OR NEW.verified_at IS NOT NULL OR NEW.rejected_at IS NOT NULL OR NEW.review_notes IS NOT NULL THEN
      RAISE EXCEPTION 'Procurement fields must remain unset when supplier submits product';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Supplier product status transition not permitted';
END;
$$;

DROP TRIGGER IF EXISTS tr_supplier_products_supplier_update ON public.supplier_products;
CREATE TRIGGER tr_supplier_products_supplier_update
  BEFORE UPDATE ON public.supplier_products
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_supplier_products_supplier_update();

-- ═══════════════════════════════════════════════════════════════════════════
-- Drop old supplier policies
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "supplier_accreditations_supplier_insert" ON public.supplier_accreditations;
DROP POLICY IF EXISTS "supplier_accreditations_supplier_update" ON public.supplier_accreditations;

DROP POLICY IF EXISTS "supplier_products_supplier_insert" ON public.supplier_products;
DROP POLICY IF EXISTS "supplier_products_supplier_update" ON public.supplier_products;

DROP POLICY IF EXISTS "supplier_documents_supplier_insert" ON public.supplier_documents;

-- ═══════════════════════════════════════════════════════════════════════════
-- supplier_accreditations — supplier INSERT (draft + null procurement cols)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE POLICY "supplier_accreditations_supplier_insert"
  ON public.supplier_accreditations FOR INSERT TO authenticated
  WITH CHECK (
    supplier_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
    AND status = 'draft'
    AND submitted_at IS NULL
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND review_notes IS NULL
    AND missing_documents_note IS NULL
    AND approved_at IS NULL
    AND rejected_at IS NULL
  );

-- Supplier may only submit from draft or missing_documents (one-way to submitted)
CREATE POLICY "supplier_accreditations_supplier_update"
  ON public.supplier_accreditations FOR UPDATE TO authenticated
  USING (
    supplier_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
    AND status IN ('draft', 'missing_documents')
  )
  WITH CHECK (
    supplier_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
    AND status = 'submitted'
    AND submitted_at IS NOT NULL
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- supplier_products — supplier INSERT (draft or RFQ submitted)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE POLICY "supplier_products_supplier_insert"
  ON public.supplier_products FOR INSERT TO authenticated
  WITH CHECK (
    supplier_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
    AND (
      (
        status = 'draft'
        AND submitted_at IS NULL
        AND reviewed_by IS NULL AND reviewed_at IS NULL
        AND verified_at IS NULL AND rejected_at IS NULL
        AND review_notes IS NULL
      )
      OR
      (
        status = 'submitted'
        AND submitted_at IS NOT NULL
        AND reviewed_by IS NULL AND reviewed_at IS NULL
        AND verified_at IS NULL AND rejected_at IS NULL
        AND review_notes IS NULL
      )
    )
    AND (
      accreditation_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.supplier_accreditations sa
        WHERE sa.id = accreditation_id AND sa.supplier_id = auth.uid()
      )
    )
  );

-- Supplier may update only while still draft (trigger enforces draft vs submit payload)
CREATE POLICY "supplier_products_supplier_update"
  ON public.supplier_products FOR UPDATE TO authenticated
  USING (
    supplier_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
    AND status = 'draft'
  )
  WITH CHECK (
    supplier_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
    AND status IN ('draft', 'submitted')
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- supplier_documents — supplier INSERT (owned accreditation and/or product)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE POLICY "supplier_documents_supplier_insert"
  ON public.supplier_documents FOR INSERT TO authenticated
  WITH CHECK (
    supplier_id = auth.uid()
    AND uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
    AND (
      (
        supplier_product_id IS NULL
        AND accreditation_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.supplier_accreditations sa
          WHERE sa.id = accreditation_id AND sa.supplier_id = auth.uid()
        )
      )
      OR
      (
        supplier_product_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.supplier_products sp
          WHERE sp.id = supplier_product_id
            AND sp.supplier_id = auth.uid()
            AND (accreditation_id IS NOT DISTINCT FROM sp.accreditation_id)
        )
      )
    )
  );
