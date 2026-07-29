-- Manual document numbers: enforce unique PR2 numbers (RFQ/GRN already UNIQUE).
-- GRN DEFAULT remains as safety net; app always supplies grn_number on create.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pr2_requests_pr2_number_key'
  ) THEN
    ALTER TABLE pr2_requests ADD CONSTRAINT pr2_requests_pr2_number_key UNIQUE (pr2_number);
  END IF;
END $$;
