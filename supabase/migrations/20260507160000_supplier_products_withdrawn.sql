/*
  # Supplier products: withdrawn status + supplier Withdraw Product path

  - Adds status `withdrawn` to supplier_products CHECK.
  - Replaces supplier update trigger so suppliers may transition:
      draft | submitted → withdrawn
    without changing catalogue fields, submitted_at, or procurement-owned columns.
  - Extends supplier UPDATE RLS USING to include submitted rows (withdraw only from queue).
*/

-- ─── Status CHECK ────────────────────────────────────────────────────────────

ALTER TABLE public.supplier_products
  DROP CONSTRAINT IF EXISTS supplier_products_status_check;

ALTER TABLE public.supplier_products
  ADD CONSTRAINT supplier_products_status_check
  CHECK (status IN (
    'draft',
    'submitted',
    'under_review',
    'pending_tsqa',
    'verified',
    'rejected',
    'inactive',
    'withdrawn'
  ));

-- ─── Supplier product update trigger ────────────────────────────────────────

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

  IF OLD.status NOT IN ('draft', 'submitted') THEN
    RAISE EXCEPTION 'Supplier cannot update product in current status';
  END IF;

  -- Withdraw: draft or submitted → withdrawn
  IF NEW.status = 'withdrawn' THEN
    IF OLD.status NOT IN ('draft', 'submitted') THEN
      RAISE EXCEPTION 'Supplier product withdrawal not permitted from this status';
    END IF;
    IF NEW.product_name IS DISTINCT FROM OLD.product_name
       OR NEW.product_code IS DISTINCT FROM OLD.product_code
       OR NEW.category IS DISTINCT FROM OLD.category
       OR NEW.description IS DISTINCT FROM OLD.description
       OR NEW.specifications IS DISTINCT FROM OLD.specifications
       OR NEW.accreditation_id IS DISTINCT FROM OLD.accreditation_id THEN
      RAISE EXCEPTION 'Withdraw must not change product payload';
    END IF;
    IF NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
      RAISE EXCEPTION 'Cannot change submitted_at when withdrawing product';
    END IF;
    IF NEW.reviewed_by IS NOT NULL OR NEW.reviewed_at IS NOT NULL
       OR NEW.verified_at IS NOT NULL OR NEW.rejected_at IS NOT NULL OR NEW.review_notes IS NOT NULL THEN
      RAISE EXCEPTION 'Procurement fields must remain unchanged when supplier withdraws product';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'submitted' AND NEW.status IS DISTINCT FROM 'withdrawn' THEN
    RAISE EXCEPTION 'Supplier cannot update submitted product except to withdraw';
  END IF;

  -- Draft edits: only catalogue / link fields + updated_at
  IF NEW.status = 'draft' THEN
    IF OLD.status IS DISTINCT FROM 'draft' THEN
      RAISE EXCEPTION 'Supplier product status transition not permitted';
    END IF;
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

  -- Submit for review: draft -> submitted
  IF NEW.status = 'submitted' THEN
    IF OLD.status IS DISTINCT FROM 'draft' THEN
      RAISE EXCEPTION 'Supplier product status transition not permitted';
    END IF;
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

-- ─── Supplier UPDATE RLS ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "supplier_products_supplier_update" ON public.supplier_products;

CREATE POLICY "supplier_products_supplier_update"
  ON public.supplier_products FOR UPDATE TO authenticated
  USING (
    supplier_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
    AND status IN ('draft', 'submitted')
  )
  WITH CHECK (
    supplier_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
    AND status IN ('draft', 'submitted', 'withdrawn')
  );

COMMENT ON POLICY "supplier_products_supplier_update" ON public.supplier_products IS
  'Supplier may edit draft, submit draft → submitted, or withdraw draft/submitted → withdrawn.';
