/*
  # Add unique constraint on pr2_requests.rfq_id

  Enforces one PR2 per RFQ at the database level, making the idempotency
  guarantee race-condition-safe. The application-layer check in generatePR2FromRfq
  remains as the fast path; this constraint catches concurrent inserts.
*/
ALTER TABLE pr2_requests
  ADD CONSTRAINT pr2_requests_rfq_id_key UNIQUE (rfq_id);
