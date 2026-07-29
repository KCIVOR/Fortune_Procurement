-- Phase 4: bidirectional RFQ ↔ PR2 link for Goods flow

ALTER TABLE rfq_batches
  ADD COLUMN IF NOT EXISTS pr2_id uuid REFERENCES pr2_requests(id);

CREATE INDEX IF NOT EXISTS rfq_batches_pr2_id_idx ON rfq_batches(pr2_id);
