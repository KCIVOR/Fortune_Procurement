-- Migration: 20260804090000_lead_time_days_to_text.sql
--
-- Converts lead_time_days from integer to free-text on rfq_item_quotes,
-- pr2_items, and pr2_items_archive so suppliers can enter values like
-- "2-3 working days" instead of a strict day-count.
--
-- Order matters: the two CHECK constraints on rfq_item_quotes do integer
-- comparisons (>= 0, = 0) and must be dropped BEFORE the column type
-- changes, otherwise ALTER COLUMN TYPE fails with "operator does not
-- exist: text >= integer". The no-quote shape constraint is then
-- re-added with the text-appropriate sentinel (lead_time_days = '').
--
-- pr2_items and pr2_items_archive must be migrated together in the same
-- transaction: unwind_pr2_to_warehouse() does
-- `INSERT INTO pr2_items_archive SELECT * FROM pr2_items`, a positional
-- copy that requires both tables to stay column-for-column identical.

BEGIN;

-- rfq_item_quotes: drop constraints that assume integer semantics
ALTER TABLE rfq_item_quotes DROP CONSTRAINT IF EXISTS rfq_item_quotes_lead_time_days_check;
ALTER TABLE rfq_item_quotes DROP CONSTRAINT IF EXISTS rfq_item_quotes_no_quote_shape_check;

-- rfq_item_quotes: change type, existing integers cast losslessly to their string form
ALTER TABLE rfq_item_quotes ALTER COLUMN lead_time_days TYPE text USING lead_time_days::text;
ALTER TABLE rfq_item_quotes ALTER COLUMN lead_time_days SET DEFAULT '';

-- Normalize existing no_quote rows: the int->text cast above turned their
-- lead_time_days = 0 into '0', but the text-era sentinel is '' (per the
-- no-quote shape constraint being re-added below).
UPDATE rfq_item_quotes SET lead_time_days = '' WHERE response_status = 'no_quote';

-- rfq_item_quotes: re-add no-quote shape constraint with text sentinel
ALTER TABLE rfq_item_quotes ADD CONSTRAINT rfq_item_quotes_no_quote_shape_check
  CHECK (
    response_status <> 'no_quote'
    OR (
      supplier_product_id IS NULL
      AND unit_price = 0
      AND lead_time_days = ''
      AND is_alternative = false
      AND no_quote_reason IS NOT NULL
      AND TRIM(BOTH FROM no_quote_reason) <> ''
    )
  );

-- pr2_items: no CHECK constraints reference lead_time_days, safe to alter directly
ALTER TABLE pr2_items ALTER COLUMN lead_time_days TYPE text USING lead_time_days::text;
ALTER TABLE pr2_items ALTER COLUMN lead_time_days SET DEFAULT '';

-- pr2_items_archive: must match pr2_items exactly (positional SELECT * copy in unwind_pr2_to_warehouse)
ALTER TABLE pr2_items_archive ALTER COLUMN lead_time_days TYPE text USING lead_time_days::text;
ALTER TABLE pr2_items_archive ALTER COLUMN lead_time_days SET DEFAULT '';

COMMIT;
