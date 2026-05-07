-- Allow multiple purchase orders per PR2 (one per awarded supplier).
-- Replaces one-PO-per-PR2 with one-PO-per-(pr2_id, supplier_id).
-- po_number remains globally unique; existing rows are not modified.

DROP INDEX IF EXISTS po_requests_pr2_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS po_requests_pr2_id_supplier_id_key
  ON po_requests (pr2_id, supplier_id);

COMMENT ON INDEX po_requests_pr2_id_supplier_id_key IS
  'At most one PO per PR2 per supplier profile (auth user); multiple suppliers on one PR2 each get their own PO row.';
