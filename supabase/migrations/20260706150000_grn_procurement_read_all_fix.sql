/*
  # Fix: restore procurement's read access to all GRNs (goods + services)

  1. Problem
    The prior migration (20260706140000_grn_services_procurement.sql) restricted
    procurement's SELECT on grn_receipts/grn_items to services-only, taking Rev #8's
    "procurement can only handle service type" decision too literally — applying it to
    reads as well as writes. This broke traceability: procurement lost visibility into
    goods-type GRNs entirely (e.g. the "Related Records" panel on a PO/delivery would
    show "Not yet created" for a GRN that warehouse had already created and closed).

  2. Fix
    Restore procurement's SELECT to unrestricted (all GRNs, any request_type) — matching
    original pre-Rev-#8 behavior. INSERT/UPDATE remain services-only, unchanged — that is
    the correct scope of "procurement can only handle (write) service type GRNs."

  3. Security
    - Warehouse's goods-only SELECT/INSERT/UPDATE are unchanged
    - Procurement's INSERT/UPDATE remain services-only, unchanged
    - Only procurement's SELECT is widened back to unrestricted
*/

DROP POLICY IF EXISTS "Procurement can read services GRNs" ON grn_receipts;
CREATE POLICY "Procurement can read all GRNs"
  ON grn_receipts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

DROP POLICY IF EXISTS "Procurement can read services GRN items" ON grn_items;
CREATE POLICY "Procurement can read GRN items"
  ON grn_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );
