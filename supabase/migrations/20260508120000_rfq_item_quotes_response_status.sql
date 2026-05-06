-- Explicit per-line supplier response: quoted vs no_quote (cannot supply).
-- Existing rows: response_status defaults to 'quoted' — legacy RFQs unchanged.

ALTER TABLE rfq_item_quotes
  ADD COLUMN IF NOT EXISTS response_status text NOT NULL DEFAULT 'quoted',
  ADD COLUMN IF NOT EXISTS no_quote_reason text;

ALTER TABLE rfq_item_quotes
  DROP CONSTRAINT IF EXISTS rfq_item_quotes_response_status_check;

ALTER TABLE rfq_item_quotes
  ADD CONSTRAINT rfq_item_quotes_response_status_check
  CHECK (response_status IN ('quoted', 'no_quote'));

-- When no_quote: no catalog link, zero price/lead, explicit non-empty reason.
-- Quoted rows are not further constrained here (legacy quoted lines may have NULL product, etc.).
ALTER TABLE rfq_item_quotes
  DROP CONSTRAINT IF EXISTS rfq_item_quotes_no_quote_shape_check;

ALTER TABLE rfq_item_quotes
  ADD CONSTRAINT rfq_item_quotes_no_quote_shape_check
  CHECK (
    response_status <> 'no_quote'
    OR (
      supplier_product_id IS NULL
      AND unit_price = 0
      AND lead_time_days = 0
      AND is_alternative = false
      AND no_quote_reason IS NOT NULL
      AND trim(no_quote_reason) <> ''
    )
  );

COMMENT ON COLUMN rfq_item_quotes.response_status IS 'quoted | no_quote — supplier explicit response per RFQ line';
COMMENT ON COLUMN rfq_item_quotes.no_quote_reason IS 'Required when response_status = no_quote; NULL otherwise';
