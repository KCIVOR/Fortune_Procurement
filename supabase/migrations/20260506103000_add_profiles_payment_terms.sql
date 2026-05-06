-- Nullable payment terms on profiles (supplier default for future PO form autofill).
-- Does not alter RLS, indexes, other tables, or backfill existing rows.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS payment_terms TEXT;
