/*
  # Phase 7 — Link rfq_item_quotes to supplier_products

  Adds a nullable foreign key to rfq_item_quotes so each supplier quote line
  can reference a verified product from the supplier's product catalog.

  Rules:
  - Column is nullable. Existing rows remain valid with NULL.
  - No backfill. Old RFQ quotes continue to work.
  - No RLS change — existing row-level policies already scope access correctly.
  - Only suppliers whose products are verified may appear in the selector (enforced at app layer).
*/

ALTER TABLE rfq_item_quotes
  ADD COLUMN IF NOT EXISTS supplier_product_id uuid
    REFERENCES supplier_products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS rfq_item_quotes_product_idx
  ON rfq_item_quotes(supplier_product_id);
