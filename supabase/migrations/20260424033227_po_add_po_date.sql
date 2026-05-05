/*
  # Add po_date column to po_requests

  ## Summary
  Adds a buyer-entered PO date field to po_requests. Previously only
  generated_at (auto-timestamp) and date_required (from PR2) existed.
  The Buyer must be able to specify the official PO issue date separately.

  ## Change
  - po_requests: new column `po_date date NOT NULL DEFAULT CURRENT_DATE`
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'po_requests' AND column_name = 'po_date'
  ) THEN
    ALTER TABLE po_requests ADD COLUMN po_date date NOT NULL DEFAULT CURRENT_DATE;
  END IF;
END $$;
