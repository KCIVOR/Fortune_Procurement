/*
  # profiles.supplier_supply_type

  Exclusive classification set by procurement/admin on Supplier Accounts.
  Nullable until set. Does not constrain products or RFQ in v1.
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS supplier_supply_type text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_supplier_supply_type_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_supplier_supply_type_check
  CHECK (
    supplier_supply_type IS NULL
    OR supplier_supply_type IN ('raw_material', 'normal', 'service')
  );

COMMENT ON COLUMN public.profiles.supplier_supply_type IS
  'Exclusive supplier classification: raw_material | normal | service. Set by procurement/admin. NULL = unset.';
