/*
  # Canvassing / RFQ Schema — Step 6 (idempotent)

  Creates rfq_batches, rfq_suppliers (stub if missing), rfq_item_quotes, supplier_item_selections.
  Drops and recreates all policies cleanly. Extends pr1_requests status CHECK.

  ## Tables
  - rfq_batches: one RFQ per PR1, tracks overall state
  - rfq_suppliers: per-supplier assignment to an RFQ (created here if missing)
  - rfq_item_quotes: structured item-level quotation from each supplier
  - supplier_item_selections: procurement's winner choice per item

  ## Security
  - All tables have RLS; procurement role has full access; suppliers scoped to their own rows
*/

-- ─── Extend pr1_requests status ───────────────────────────────────────────────
ALTER TABLE pr1_requests DROP CONSTRAINT IF EXISTS pr1_requests_status_check;
ALTER TABLE pr1_requests ADD CONSTRAINT pr1_requests_status_check
  CHECK (status = ANY (ARRAY[
    'draft','pending_warehouse','pending_approval','resolved_internal',
    'revision_requested','approved','for_canvassing','canvassing_complete',
    'rejected','cancelled'
  ]));

-- ─── rfq_batches ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rfq_batches (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pr1_id     uuid NOT NULL,
  rfq_number text NOT NULL UNIQUE,
  status     text NOT NULL DEFAULT 'draft'
             CHECK (status = ANY (ARRAY['draft','open','closed','cancelled'])),
  issued_by  uuid NOT NULL,
  issued_at  timestamptz,
  deadline   date,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rfq_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Procurement can manage rfq_batches"     ON rfq_batches;
DROP POLICY IF EXISTS "Procurement can select rfq_batches"     ON rfq_batches;
DROP POLICY IF EXISTS "Procurement can insert rfq_batches"     ON rfq_batches;
DROP POLICY IF EXISTS "Procurement can update rfq_batches"     ON rfq_batches;
DROP POLICY IF EXISTS "Suppliers can view assigned rfq_batches" ON rfq_batches;

CREATE POLICY "Procurement can select rfq_batches"
  ON rfq_batches FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

CREATE POLICY "Procurement can insert rfq_batches"
  ON rfq_batches FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

CREATE POLICY "Procurement can update rfq_batches"
  ON rfq_batches FOR UPDATE TO authenticated
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

-- ─── rfq_suppliers (ensure table exists on fresh DBs; Bolt-era DBs may already have it) ──
CREATE TABLE IF NOT EXISTS rfq_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

-- ─── rfq_suppliers — fix columns + policies ────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rfq_suppliers' AND column_name = 'rfq_id'
  ) THEN
    ALTER TABLE rfq_suppliers ADD COLUMN rfq_id uuid REFERENCES rfq_batches(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rfq_suppliers' AND column_name = 'supplier_id'
  ) THEN
    ALTER TABLE rfq_suppliers ADD COLUMN supplier_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rfq_suppliers' AND column_name = 'supplier_name_snapshot'
  ) THEN
    ALTER TABLE rfq_suppliers ADD COLUMN supplier_name_snapshot text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rfq_suppliers' AND column_name = 'status'
  ) THEN
    ALTER TABLE rfq_suppliers ADD COLUMN status text NOT NULL DEFAULT 'invited'
      CHECK (status = ANY (ARRAY['invited','submitted','declined']));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rfq_suppliers' AND column_name = 'invited_at'
  ) THEN
    ALTER TABLE rfq_suppliers ADD COLUMN invited_at timestamptz NOT NULL DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rfq_suppliers' AND column_name = 'responded_at'
  ) THEN
    ALTER TABLE rfq_suppliers ADD COLUMN responded_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rfq_suppliers' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE rfq_suppliers ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

DROP POLICY IF EXISTS "Authenticated users can read rfq_suppliers"   ON rfq_suppliers;
DROP POLICY IF EXISTS "Procurement can select rfq_suppliers"         ON rfq_suppliers;
DROP POLICY IF EXISTS "Procurement can insert rfq_suppliers"         ON rfq_suppliers;
DROP POLICY IF EXISTS "Procurement can update rfq_suppliers"         ON rfq_suppliers;
DROP POLICY IF EXISTS "Suppliers can view own rfq_suppliers rows"    ON rfq_suppliers;
DROP POLICY IF EXISTS "Suppliers can update own rfq_suppliers status" ON rfq_suppliers;

CREATE POLICY "Procurement can select rfq_suppliers"
  ON rfq_suppliers FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

CREATE POLICY "Procurement can insert rfq_suppliers"
  ON rfq_suppliers FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

CREATE POLICY "Procurement can update rfq_suppliers"
  ON rfq_suppliers FOR UPDATE TO authenticated
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

CREATE POLICY "Suppliers can view own rfq_suppliers rows"
  ON rfq_suppliers FOR SELECT TO authenticated
  USING (supplier_id = auth.uid());

CREATE POLICY "Suppliers can update own rfq_suppliers status"
  ON rfq_suppliers FOR UPDATE TO authenticated
  USING (supplier_id = auth.uid())
  WITH CHECK (supplier_id = auth.uid());

CREATE POLICY "Suppliers can view assigned rfq_batches"
  ON rfq_batches FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rfq_suppliers rs
      WHERE rs.rfq_id = rfq_batches.id AND rs.supplier_id = auth.uid()
    )
  );

-- ─── rfq_item_quotes ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rfq_item_quotes (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_supplier_id    uuid NOT NULL REFERENCES rfq_suppliers(id),
  pr1_item_id        uuid NOT NULL,
  quoted_description text NOT NULL DEFAULT '',
  is_alternative     boolean NOT NULL DEFAULT false,
  unit_price         numeric(14,4) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  lead_time_days     integer NOT NULL DEFAULT 0 CHECK (lead_time_days >= 0),
  remarks            text,
  submitted_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rfq_supplier_id, pr1_item_id)
);

ALTER TABLE rfq_item_quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Suppliers can insert own quotes"   ON rfq_item_quotes;
DROP POLICY IF EXISTS "Suppliers can update own quotes"   ON rfq_item_quotes;
DROP POLICY IF EXISTS "Suppliers can view own quotes"     ON rfq_item_quotes;
DROP POLICY IF EXISTS "Procurement can view all quotes"   ON rfq_item_quotes;

CREATE POLICY "Suppliers can insert own quotes"
  ON rfq_item_quotes FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rfq_suppliers rs
      WHERE rs.id = rfq_item_quotes.rfq_supplier_id AND rs.supplier_id = auth.uid()
    )
  );

CREATE POLICY "Suppliers can update own quotes"
  ON rfq_item_quotes FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rfq_suppliers rs
      WHERE rs.id = rfq_item_quotes.rfq_supplier_id AND rs.supplier_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rfq_suppliers rs
      WHERE rs.id = rfq_item_quotes.rfq_supplier_id AND rs.supplier_id = auth.uid()
    )
  );

CREATE POLICY "Suppliers can view own quotes"
  ON rfq_item_quotes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rfq_suppliers rs
      WHERE rs.id = rfq_item_quotes.rfq_supplier_id AND rs.supplier_id = auth.uid()
    )
  );

CREATE POLICY "Procurement can view all quotes"
  ON rfq_item_quotes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

-- ─── supplier_item_selections ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supplier_item_selections (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id                   uuid NOT NULL REFERENCES rfq_batches(id),
  pr1_item_id              uuid NOT NULL,
  selected_rfq_supplier_id uuid NOT NULL REFERENCES rfq_suppliers(id),
  selected_by              uuid NOT NULL,
  selected_at              timestamptz NOT NULL DEFAULT now(),
  selection_notes          text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rfq_id, pr1_item_id)
);

ALTER TABLE supplier_item_selections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Procurement can select supplier_item_selections" ON supplier_item_selections;
DROP POLICY IF EXISTS "Procurement can insert supplier_item_selections" ON supplier_item_selections;
DROP POLICY IF EXISTS "Procurement can update supplier_item_selections" ON supplier_item_selections;

CREATE POLICY "Procurement can select supplier_item_selections"
  ON supplier_item_selections FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

CREATE POLICY "Procurement can insert supplier_item_selections"
  ON supplier_item_selections FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

CREATE POLICY "Procurement can update supplier_item_selections"
  ON supplier_item_selections FOR UPDATE TO authenticated
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

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS rfq_batches_pr1_id_idx       ON rfq_batches(pr1_id);
CREATE INDEX IF NOT EXISTS rfq_batches_status_idx        ON rfq_batches(status);
CREATE INDEX IF NOT EXISTS rfq_suppliers_rfq_id_idx      ON rfq_suppliers(rfq_id);
CREATE INDEX IF NOT EXISTS rfq_suppliers_supplier_id_idx ON rfq_suppliers(supplier_id);
CREATE INDEX IF NOT EXISTS rfq_item_quotes_supplier_idx  ON rfq_item_quotes(rfq_supplier_id);
CREATE INDEX IF NOT EXISTS rfq_item_quotes_item_idx      ON rfq_item_quotes(pr1_item_id);
CREATE INDEX IF NOT EXISTS supplier_selections_rfq_idx   ON supplier_item_selections(rfq_id);
