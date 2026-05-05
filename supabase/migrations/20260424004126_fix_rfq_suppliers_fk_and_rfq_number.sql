/*
  # Fix rfq_suppliers FK + rfq_number sequence reliability

  ## Issues fixed

  1. rfq_suppliers.rfq_id FK pointed to old stub table 'rfqs' instead of rfq_batches.
     Every INSERT into rfq_suppliers was failing silently (FK violation).
     Fix: drop old FK, add correct FK to rfq_batches.

  2. rfq_number generation in code uses a COUNT(*) race condition.
     Fix: add a sequence so numbers are guaranteed unique and monotonic.
*/

-- ─── Fix rfq_suppliers FK ─────────────────────────────────────────────────────
ALTER TABLE rfq_suppliers DROP CONSTRAINT IF EXISTS rfq_suppliers_rfq_id_fkey;
ALTER TABLE rfq_suppliers ADD CONSTRAINT rfq_suppliers_rfq_id_fkey
  FOREIGN KEY (rfq_id) REFERENCES rfq_batches(id);

-- ─── Add sequence for rfq_number ──────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS rfq_number_seq START 1;
