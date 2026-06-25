-- ============================================================================
-- Dynamic Dropdown Options
-- ============================================================================
-- Stores configurable dropdown values for the procurement system.
-- Admin can create, edit, reorder, and soft-delete options per category.
-- ============================================================================

-- ── Table ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.system_dropdown_options (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  category      text        NOT NULL,
  option_value  text        NOT NULL,
  option_label  text        NOT NULL,
  sort_order    integer     NOT NULL DEFAULT 0,
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_dropdown_category_value UNIQUE (category, option_value)
);

-- Index for the most common query pattern: active options by category, ordered.
CREATE INDEX IF NOT EXISTS idx_dropdown_options_category_active
  ON public.system_dropdown_options (category, is_active, sort_order);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.system_dropdown_options ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read active options
CREATE POLICY "Authenticated users can read active dropdown options"
  ON public.system_dropdown_options
  FOR SELECT
  TO authenticated
  USING (true);

-- Admin: full CRUD
CREATE POLICY "Admin can insert dropdown options"
  ON public.system_dropdown_options
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'admin'
    )
  );

CREATE POLICY "Admin can update dropdown options"
  ON public.system_dropdown_options
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'admin'
    )
  );

CREATE POLICY "Admin can delete dropdown options"
  ON public.system_dropdown_options
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'admin'
    )
  );

-- ── Seed Data ─────────────────────────────────────────────────────────────────

-- 1. WAREHOUSE_OPTIONS
INSERT INTO public.system_dropdown_options (category, option_value, option_label, sort_order) VALUES
  ('WAREHOUSE_OPTIONS', 'Main Warehouse',    'Main Warehouse',    1),
  ('WAREHOUSE_OPTIONS', 'Warehouse A',       'Warehouse A',       2),
  ('WAREHOUSE_OPTIONS', 'Warehouse B',       'Warehouse B',       3),
  ('WAREHOUSE_OPTIONS', 'Cold Storage',      'Cold Storage',      4),
  ('WAREHOUSE_OPTIONS', 'Hazmat Storage',    'Hazmat Storage',    5),
  ('WAREHOUSE_OPTIONS', 'Off-Site Warehouse','Off-Site Warehouse', 6),
  ('WAREHOUSE_OPTIONS', 'Other',             'Other',             99)
ON CONFLICT (category, option_value) DO NOTHING;

-- 2. PAYMENT_TERMS_OPTIONS
INSERT INTO public.system_dropdown_options (category, option_value, option_label, sort_order) VALUES
  ('PAYMENT_TERMS_OPTIONS', '15 days net',             '15 days net',             1),
  ('PAYMENT_TERMS_OPTIONS', '30 days net',             '30 days net',             2),
  ('PAYMENT_TERMS_OPTIONS', '45 days net',             '45 days net',             3),
  ('PAYMENT_TERMS_OPTIONS', '60 days net',             '60 days net',             4),
  ('PAYMENT_TERMS_OPTIONS', 'COD (Cash on Delivery)',  'COD (Cash on Delivery)',  5),
  ('PAYMENT_TERMS_OPTIONS', 'Advance Payment',         'Advance Payment',         6),
  ('PAYMENT_TERMS_OPTIONS', 'Letter of Credit',        'Letter of Credit',        7),
  ('PAYMENT_TERMS_OPTIONS', 'Other',                   'Other',                   99)
ON CONFLICT (category, option_value) DO NOTHING;

-- 3. PURPOSE_OPTIONS
INSERT INTO public.system_dropdown_options (category, option_value, option_label, sort_order) VALUES
  ('PURPOSE_OPTIONS', 'Office Supplies',       'Office Supplies',       1),
  ('PURPOSE_OPTIONS', 'IT Equipment',          'IT Equipment',          2),
  ('PURPOSE_OPTIONS', 'Maintenance & Repair',  'Maintenance & Repair',  3),
  ('PURPOSE_OPTIONS', 'Project Materials',     'Project Materials',     4),
  ('PURPOSE_OPTIONS', 'Operations Support',    'Operations Support',    5),
  ('PURPOSE_OPTIONS', 'Other',                 'Other',                 99)
ON CONFLICT (category, option_value) DO NOTHING;

-- 4. UNIT_OPTIONS
INSERT INTO public.system_dropdown_options (category, option_value, option_label, sort_order) VALUES
  ('UNIT_OPTIONS', 'pcs',    'pcs',    1),
  ('UNIT_OPTIONS', 'box',    'box',    2),
  ('UNIT_OPTIONS', 'set',    'set',    3),
  ('UNIT_OPTIONS', 'pack',   'pack',   4),
  ('UNIT_OPTIONS', 'ream',   'ream',   5),
  ('UNIT_OPTIONS', 'roll',   'roll',   6),
  ('UNIT_OPTIONS', 'bottle', 'bottle', 7),
  ('UNIT_OPTIONS', 'liter',  'liter',  8),
  ('UNIT_OPTIONS', 'kg',     'kg',     9),
  ('UNIT_OPTIONS', 'meter',  'meter',  10),
  ('UNIT_OPTIONS', 'pair',   'pair',   11),
  ('UNIT_OPTIONS', 'unit',   'unit',   12),
  ('UNIT_OPTIONS', 'Other',  'Other',  99)
ON CONFLICT (category, option_value) DO NOTHING;

-- 5. ACCREDITATION_DOC_TYPE_OPTIONS
INSERT INTO public.system_dropdown_options (category, option_value, option_label, sort_order) VALUES
  ('ACCREDITATION_DOC_TYPE_OPTIONS', 'company_profile',       'Company Profile',               1),
  ('ACCREDITATION_DOC_TYPE_OPTIONS', 'self_assessment',       'Self Assessment',               2),
  ('ACCREDITATION_DOC_TYPE_OPTIONS', 'legal_document',        'Legal Document',                3),
  ('ACCREDITATION_DOC_TYPE_OPTIONS', 'certification',         'Certification',                 4),
  ('ACCREDITATION_DOC_TYPE_OPTIONS', 'tds',                   'Technical Data Sheet (TDS)',     5),
  ('ACCREDITATION_DOC_TYPE_OPTIONS', 'msds',                  'MSDS / Safety Data Sheet',      6),
  ('ACCREDITATION_DOC_TYPE_OPTIONS', 'product_specification', 'Product Specification',         7),
  ('ACCREDITATION_DOC_TYPE_OPTIONS', 'other',                 'Other',                         99)
ON CONFLICT (category, option_value) DO NOTHING;

-- 6. PRODUCT_DOC_TYPE_OPTIONS
INSERT INTO public.system_dropdown_options (category, option_value, option_label, sort_order) VALUES
  ('PRODUCT_DOC_TYPE_OPTIONS', 'tds',                   'Technical Data Sheet (TDS)',     1),
  ('PRODUCT_DOC_TYPE_OPTIONS', 'msds',                  'MSDS / Safety Data Sheet',      2),
  ('PRODUCT_DOC_TYPE_OPTIONS', 'product_specification', 'Product Specification',         3),
  ('PRODUCT_DOC_TYPE_OPTIONS', 'certification',         'Certification',                 4),
  ('PRODUCT_DOC_TYPE_OPTIONS', 'company_profile',       'Company Profile',               5),
  ('PRODUCT_DOC_TYPE_OPTIONS', 'other',                 'Other',                         99)
ON CONFLICT (category, option_value) DO NOTHING;
