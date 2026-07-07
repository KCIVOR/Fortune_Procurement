/*
  # VAT handling — schema

  1. New table: system_vat_settings
    Single-row admin-configurable VAT rate, mirrors system_expiry_settings' pattern.

  2. New columns
    - profiles.is_vat_registered (boolean, default false) — the "VAT-able" flag on a
      supplier profile. Meaningless for non-supplier roles.
    - rfq_item_quotes.vat_type ('vat_inclusive' | 'vat_exclusive' | null) — set by the
      supplier per quote line. Only meaningful when the quoting supplier is VAT-able.
    - pr2_items.vat_type, pr2_items.vat_rate_applied — snapshotted at PR2 generation.
    - po_items.vat_type, po_items.vat_rate_applied — snapshotted at PO generation.

  3. Rationale (Rev #1)
    No VAT concept existed anywhere in this system before this migration (confirmed via
    full-codebase audit). Rate is snapshotted per line item, not looked up live, so a
    future admin rate change never silently alters a historical PR2/PO's breakdown.
*/

CREATE TABLE IF NOT EXISTS public.system_vat_settings (
  id         boolean PRIMARY KEY DEFAULT true,
  CONSTRAINT single_row CHECK (id = true),
  vat_rate   numeric(5,2) NOT NULL DEFAULT 12.00,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.system_vat_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_vat_registered boolean NOT NULL DEFAULT false;

ALTER TABLE public.rfq_item_quotes
  ADD COLUMN IF NOT EXISTS vat_type text CHECK (vat_type IN ('vat_inclusive', 'vat_exclusive'));

ALTER TABLE public.pr2_items
  ADD COLUMN IF NOT EXISTS vat_type text CHECK (vat_type IN ('vat_inclusive', 'vat_exclusive')),
  ADD COLUMN IF NOT EXISTS vat_rate_applied numeric(5,2);

ALTER TABLE public.po_items
  ADD COLUMN IF NOT EXISTS vat_type text CHECK (vat_type IN ('vat_inclusive', 'vat_exclusive')),
  ADD COLUMN IF NOT EXISTS vat_rate_applied numeric(5,2);
