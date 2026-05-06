/*
  # Supplier Accreditation, Products, Documents, RSE, and TSQA Review Schema

  ## Summary
  Implements the complete data layer for:
    Supplier Accreditation → Supplier Products → RSE → TSQA Review

  No existing tables (PR1, warehouse, approvals, RFQ, PR2, PO, delivery, GRN)
  are touched. All supplier_id fields reference auth.users(id) — consistent with
  the existing rfq_suppliers.supplier_id, po_requests.supplier_id, and
  deliveries.supplier_id pattern. No separate suppliers table is introduced.

  ## Table creation order (dependency-first)
    1. supplier_accreditations   — company-level, no table deps
    2. supplier_products         — FK → supplier_accreditations
    3. supplier_documents        — FK → supplier_accreditations, supplier_products
    4. rse_records               — FK → supplier_accreditations, supplier_products
    5. tsqa_reviews              — FK → rse_records

  ## RLS policies are added AFTER all tables exist to avoid forward-reference
  errors where TSQA policies on supplier_products / supplier_documents reference
  rse_records before it is created.

  ## Roles used in RLS
  - supplier    — upload/read own records
  - procurement — full read/write
  - tsqa        — scoped to assigned RSE and linked products/documents
  - admin       — full read/write

  ## RSE number
  Format: RSE-YYYYMM-XXXX  (e.g. RSE-202605-0001)
  Generated atomically via rse_number_seq to avoid race conditions.
*/

-- ─── RSE number sequence + generator ────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS rse_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_rse_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_seq    int;
  v_prefix text;
BEGIN
  v_seq    := nextval('rse_number_seq');
  v_prefix := 'RSE-' || to_char(now(), 'YYYYMM');
  RETURN v_prefix || '-' || lpad(v_seq::text, 4, '0');
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE CREATION
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. supplier_accreditations ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS supplier_accreditations (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id            uuid        NOT NULL REFERENCES auth.users(id),
  status                 text        NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','under_review','missing_documents','approved','rejected')),
  submitted_at           timestamptz,
  reviewed_by            uuid        REFERENCES auth.users(id),
  reviewed_at            timestamptz,
  review_notes           text,
  missing_documents_note text,
  approved_at            timestamptz,
  rejected_at            timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_accreditations_supplier_id
  ON supplier_accreditations(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_accreditations_status
  ON supplier_accreditations(status);

-- ─── 2. supplier_products ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS supplier_products (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id      uuid        NOT NULL REFERENCES auth.users(id),
  accreditation_id uuid        REFERENCES supplier_accreditations(id),
  product_name     text        NOT NULL,
  product_code     text,
  category         text,
  description      text,
  specifications   text,
  status           text        NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','under_review','pending_tsqa','verified','rejected','inactive')),
  submitted_at     timestamptz,
  reviewed_by      uuid        REFERENCES auth.users(id),
  reviewed_at      timestamptz,
  review_notes     text,
  verified_at      timestamptz,
  rejected_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier_id
  ON supplier_products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_products_accreditation_id
  ON supplier_products(accreditation_id);
CREATE INDEX IF NOT EXISTS idx_supplier_products_status
  ON supplier_products(status);

-- ─── 3. supplier_documents ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS supplier_documents (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id         uuid        NOT NULL REFERENCES auth.users(id),
  accreditation_id    uuid        REFERENCES supplier_accreditations(id),
  supplier_product_id uuid        REFERENCES supplier_products(id),
  document_type       text        NOT NULL,
  file_name           text        NOT NULL,
  file_path           text        NOT NULL,
  mime_type           text,
  file_size           bigint,
  uploaded_by         uuid        NOT NULL REFERENCES auth.users(id),
  uploaded_at         timestamptz NOT NULL DEFAULT now(),
  expires_at          date,
  status              text        NOT NULL DEFAULT 'uploaded'
    CHECK (status IN ('uploaded','accepted','rejected','expired')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_documents_supplier_id
  ON supplier_documents(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_documents_accreditation_id
  ON supplier_documents(accreditation_id);
CREATE INDEX IF NOT EXISTS idx_supplier_documents_product_id
  ON supplier_documents(supplier_product_id);

-- ─── 4. rse_records ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rse_records (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rse_number          text        UNIQUE NOT NULL DEFAULT generate_rse_number(),
  supplier_id         uuid        NOT NULL REFERENCES auth.users(id),
  accreditation_id    uuid        REFERENCES supplier_accreditations(id),
  supplier_product_id uuid        NOT NULL REFERENCES supplier_products(id),
  status              text        NOT NULL DEFAULT 'created'
    CHECK (status IN ('created','assigned','under_review','passed','failed','cancelled')),
  created_by          uuid        NOT NULL REFERENCES auth.users(id),
  assigned_to         uuid        REFERENCES auth.users(id),
  assigned_at         timestamptz,
  reason              text,
  procurement_notes   text,
  completed_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rse_records_supplier_id
  ON rse_records(supplier_id);
CREATE INDEX IF NOT EXISTS idx_rse_records_supplier_product_id
  ON rse_records(supplier_product_id);
CREATE INDEX IF NOT EXISTS idx_rse_records_status
  ON rse_records(status);
CREATE INDEX IF NOT EXISTS idx_rse_records_assigned_to
  ON rse_records(assigned_to);

-- ─── 5. tsqa_reviews ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tsqa_reviews (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rse_id        uuid        NOT NULL REFERENCES rse_records(id),
  reviewer_id   uuid        NOT NULL REFERENCES auth.users(id),
  result        text        CHECK (result IN ('passed','failed')),
  remarks       text,
  test_findings text,
  reviewed_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tsqa_reviews_rse_id
  ON tsqa_reviews(rse_id);
CREATE INDEX IF NOT EXISTS idx_tsqa_reviews_reviewer_id
  ON tsqa_reviews(reviewer_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- ENABLE ROW LEVEL SECURITY
-- (all tables — done together before any policies are added)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE supplier_accreditations ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_products       ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_documents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE rse_records             ENABLE ROW LEVEL SECURITY;
ALTER TABLE tsqa_reviews            ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS POLICIES
-- All tables exist by this point, so forward-references in TSQA policies
-- (supplier_products/supplier_documents referencing rse_records) are safe.
-- Role lookup pattern: profiles JOIN roles — same as existing migrations.
-- ═══════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────────
-- supplier_accreditations
-- ────────────────────────────────────────────────────────────────────────────

-- Supplier: own records only
CREATE POLICY "supplier_accreditations_supplier_select"
  ON supplier_accreditations FOR SELECT TO authenticated
  USING (
    supplier_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
  );

CREATE POLICY "supplier_accreditations_supplier_insert"
  ON supplier_accreditations FOR INSERT TO authenticated
  WITH CHECK (
    supplier_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
  );

CREATE POLICY "supplier_accreditations_supplier_update"
  ON supplier_accreditations FOR UPDATE TO authenticated
  USING (
    supplier_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
  )
  WITH CHECK (
    supplier_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
  );

-- Procurement: all records
CREATE POLICY "supplier_accreditations_procurement_select"
  ON supplier_accreditations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

CREATE POLICY "supplier_accreditations_procurement_update"
  ON supplier_accreditations FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

-- Admin: all records
CREATE POLICY "supplier_accreditations_admin_select"
  ON supplier_accreditations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'admin'
    )
  );

CREATE POLICY "supplier_accreditations_admin_update"
  ON supplier_accreditations FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'admin'
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- supplier_products
-- ────────────────────────────────────────────────────────────────────────────

-- Supplier: own products only
CREATE POLICY "supplier_products_supplier_select"
  ON supplier_products FOR SELECT TO authenticated
  USING (
    supplier_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
  );

CREATE POLICY "supplier_products_supplier_insert"
  ON supplier_products FOR INSERT TO authenticated
  WITH CHECK (
    supplier_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
  );

CREATE POLICY "supplier_products_supplier_update"
  ON supplier_products FOR UPDATE TO authenticated
  USING (
    supplier_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
  )
  WITH CHECK (
    supplier_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
  );

-- Procurement: all products
CREATE POLICY "supplier_products_procurement_select"
  ON supplier_products FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

CREATE POLICY "supplier_products_procurement_update"
  ON supplier_products FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

-- TSQA: products in pending_tsqa status OR linked to an RSE assigned to/created for them
-- Note: rse_records exists by this point (all tables created above).
CREATE POLICY "supplier_products_tsqa_select"
  ON supplier_products FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'tsqa'
    )
    AND (
      status = 'pending_tsqa'
      OR EXISTS (
        SELECT 1 FROM rse_records rr
        WHERE rr.supplier_product_id = supplier_products.id
          AND (
            rr.assigned_to = auth.uid()
            OR rr.status IN ('created','assigned','under_review')
          )
      )
    )
  );

-- Admin: all products
CREATE POLICY "supplier_products_admin_select"
  ON supplier_products FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'admin'
    )
  );

CREATE POLICY "supplier_products_admin_update"
  ON supplier_products FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'admin'
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- supplier_documents
-- ────────────────────────────────────────────────────────────────────────────

-- Supplier: own documents only
CREATE POLICY "supplier_documents_supplier_select"
  ON supplier_documents FOR SELECT TO authenticated
  USING (
    supplier_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
  );

CREATE POLICY "supplier_documents_supplier_insert"
  ON supplier_documents FOR INSERT TO authenticated
  WITH CHECK (
    supplier_id = auth.uid()
    AND uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
  );

-- Procurement: all documents
CREATE POLICY "supplier_documents_procurement_select"
  ON supplier_documents FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

CREATE POLICY "supplier_documents_procurement_update"
  ON supplier_documents FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

-- TSQA: documents tied to a product or accreditation that has an active RSE assigned to them
CREATE POLICY "supplier_documents_tsqa_select"
  ON supplier_documents FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'tsqa'
    )
    AND (
      (
        supplier_product_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM rse_records rr
          WHERE rr.supplier_product_id = supplier_documents.supplier_product_id
            AND (
              rr.assigned_to = auth.uid()
              OR rr.status IN ('created','assigned','under_review')
            )
        )
      )
      OR (
        accreditation_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM rse_records rr
          WHERE rr.accreditation_id = supplier_documents.accreditation_id
            AND (
              rr.assigned_to = auth.uid()
              OR rr.status IN ('created','assigned','under_review')
            )
        )
      )
    )
  );

-- Admin: all documents
CREATE POLICY "supplier_documents_admin_select"
  ON supplier_documents FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'admin'
    )
  );

CREATE POLICY "supplier_documents_admin_update"
  ON supplier_documents FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'admin'
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- rse_records
-- ────────────────────────────────────────────────────────────────────────────

-- Procurement: full access (creates and manages RSE)
CREATE POLICY "rse_records_procurement_select"
  ON rse_records FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

CREATE POLICY "rse_records_procurement_insert"
  ON rse_records FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

CREATE POLICY "rse_records_procurement_update"
  ON rse_records FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

-- TSQA: select RSE assigned to them or unassigned (created status) to allow self-assignment
CREATE POLICY "rse_records_tsqa_select"
  ON rse_records FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'tsqa'
    )
    AND (assigned_to = auth.uid() OR status = 'created')
  );

-- TSQA: update only RSE records assigned to them
CREATE POLICY "rse_records_tsqa_update"
  ON rse_records FOR UPDATE TO authenticated
  USING (
    assigned_to = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'tsqa'
    )
  )
  WITH CHECK (
    assigned_to = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'tsqa'
    )
  );

-- Supplier: can see RSE records for their own products
CREATE POLICY "rse_records_supplier_select"
  ON rse_records FOR SELECT TO authenticated
  USING (
    supplier_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
  );

-- Admin: full access
CREATE POLICY "rse_records_admin_select"
  ON rse_records FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'admin'
    )
  );

CREATE POLICY "rse_records_admin_update"
  ON rse_records FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'admin'
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- tsqa_reviews
-- ────────────────────────────────────────────────────────────────────────────

-- TSQA: select their own reviews
CREATE POLICY "tsqa_reviews_tsqa_select"
  ON tsqa_reviews FOR SELECT TO authenticated
  USING (
    reviewer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'tsqa'
    )
  );

-- TSQA: insert review only for RSE assigned to them; reviewer_id must be self
CREATE POLICY "tsqa_reviews_tsqa_insert"
  ON tsqa_reviews FOR INSERT TO authenticated
  WITH CHECK (
    reviewer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'tsqa'
    )
    AND EXISTS (
      SELECT 1 FROM rse_records rr
      WHERE rr.id = rse_id
        AND rr.assigned_to = auth.uid()
    )
  );

-- TSQA: update their own reviews
CREATE POLICY "tsqa_reviews_tsqa_update"
  ON tsqa_reviews FOR UPDATE TO authenticated
  USING (
    reviewer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'tsqa'
    )
  )
  WITH CHECK (
    reviewer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'tsqa'
    )
  );

-- Procurement: select all reviews
CREATE POLICY "tsqa_reviews_procurement_select"
  ON tsqa_reviews FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

-- Supplier: select reviews for RSE records tied to their own supplier_id
CREATE POLICY "tsqa_reviews_supplier_select"
  ON tsqa_reviews FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
    AND EXISTS (
      SELECT 1 FROM rse_records rr
      WHERE rr.id = rse_id
        AND rr.supplier_id = auth.uid()
    )
  );

-- Admin: full access
CREATE POLICY "tsqa_reviews_admin_select"
  ON tsqa_reviews FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'admin'
    )
  );

CREATE POLICY "tsqa_reviews_admin_update"
  ON tsqa_reviews FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'admin'
    )
  );
