-- Phase 1: Expiry System Schema
-- Adds: system_expiry_settings table, valid_until columns, 'expired' status values, indexes

-- ─── 1a. System expiry settings (single-row config table) ─────────────────────

CREATE TABLE IF NOT EXISTS public.system_expiry_settings (
  id                          boolean     PRIMARY KEY DEFAULT TRUE,
  CONSTRAINT single_row       CHECK (id = TRUE),
  accreditation_validity_days integer     NOT NULL DEFAULT 365,
  product_validity_days       integer     NOT NULL DEFAULT 365,
  updated_by                  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.system_expiry_settings DEFAULT VALUES
ON CONFLICT (id) DO NOTHING;

-- ─── 1b. Add valid_until to accreditations and products ───────────────────────

ALTER TABLE public.supplier_accreditations
  ADD COLUMN IF NOT EXISTS valid_until date;

ALTER TABLE public.supplier_products
  ADD COLUMN IF NOT EXISTS valid_until date;

-- ─── 1c. Extend status check constraints to include 'expired' ─────────────────

ALTER TABLE public.supplier_accreditations
  DROP CONSTRAINT IF EXISTS supplier_accreditations_status_check;
ALTER TABLE public.supplier_accreditations
  ADD CONSTRAINT supplier_accreditations_status_check
  CHECK (status = ANY (ARRAY[
    'draft', 'submitted', 'under_review', 'missing_documents',
    'approved', 'rejected', 'withdrawn', 'expired'
  ]::text[]));

ALTER TABLE public.supplier_products
  DROP CONSTRAINT IF EXISTS supplier_products_status_check;
ALTER TABLE public.supplier_products
  ADD CONSTRAINT supplier_products_status_check
  CHECK (status = ANY (ARRAY[
    'draft', 'submitted', 'under_review', 'pending_tsqa',
    'verified', 'rejected', 'inactive', 'withdrawn', 'expired'
  ]::text[]));

-- ─── 1d. Indexes for cron job performance ─────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_accreditations_expiry_check
  ON public.supplier_accreditations (valid_until)
  WHERE status = 'approved' AND valid_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_expiry_check
  ON public.supplier_products (valid_until)
  WHERE status = 'verified' AND valid_until IS NOT NULL;
