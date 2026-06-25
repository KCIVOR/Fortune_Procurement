-- ─────────────────────────────────────────────────────────────────────────────
-- External Vendor (Manual Quote) support — Phase 1
--
-- Lets Procurement add an external vendor (e.g. Shopee, Lazada, a walk-in store)
-- to an RFQ with no supplier account, and enter the quote on their behalf.
--
-- Additive only:
--   • rfq_suppliers.is_external flag (DEFAULT false → all existing rows unchanged)
--   • Two NEW permissive RLS policies letting Procurement INSERT/UPDATE quotes.
--     Existing supplier policies are left untouched (Postgres ORs permissive
--     policies, so suppliers keep their own insert/update rights).
-- ─────────────────────────────────────────────────────────────────────────────

-- B2: flag external vendor slots
ALTER TABLE rfq_suppliers
  ADD COLUMN IF NOT EXISTS is_external boolean NOT NULL DEFAULT false;

-- B1: allow Procurement to enter quotes for external vendor slots.
-- (Existing "Suppliers can insert/update own quotes" policies remain in force.)
DROP POLICY IF EXISTS "Procurement can insert rfq_item_quotes" ON rfq_item_quotes;
CREATE POLICY "Procurement can insert rfq_item_quotes"
  ON rfq_item_quotes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'procurement'));

DROP POLICY IF EXISTS "Procurement can update rfq_item_quotes" ON rfq_item_quotes;
CREATE POLICY "Procurement can update rfq_item_quotes"
  ON rfq_item_quotes FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'procurement'));
