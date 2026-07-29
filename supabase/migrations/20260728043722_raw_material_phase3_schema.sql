-- Raw Materials Phase 3 (Bundle C): line-identity plumbing for PR2-native
-- RFQ lines. Additive/non-breaking — existing pr1_item_id-keyed rows are
-- unaffected (still enforced not-null-together via the OR check).

-- 3.9 rfq_quote_attachments: allow PR2-native lines (raw-material quotes
-- have no pr1_item to attach to).
ALTER TABLE rfq_quote_attachments
  ALTER COLUMN pr1_item_id DROP NOT NULL;

ALTER TABLE rfq_quote_attachments
  ADD COLUMN pr2_item_id uuid REFERENCES pr2_items(id) ON DELETE CASCADE;

ALTER TABLE rfq_quote_attachments
  ADD CONSTRAINT rfq_quote_attachments_line_ref_chk
  CHECK (pr1_item_id IS NOT NULL OR pr2_item_id IS NOT NULL);

-- 3.10a supplier_item_selections: replace the plain UNIQUE(rfq_id, pr1_item_id)
-- with two partial unique indexes (NULL pr1_item_id would otherwise let the
-- old constraint admit unlimited raw-material rows per rfq_id).
ALTER TABLE supplier_item_selections
  DROP CONSTRAINT supplier_item_selections_rfq_id_pr1_item_id_key;

CREATE UNIQUE INDEX supplier_item_selections_rfq_pr1_item_key
  ON supplier_item_selections (rfq_id, pr1_item_id) WHERE pr1_item_id IS NOT NULL;

CREATE UNIQUE INDEX supplier_item_selections_rfq_pr2_item_key
  ON supplier_item_selections (rfq_id, pr2_item_id) WHERE pr2_item_id IS NOT NULL;

-- 3.10b rfq_item_quotes: same problem — submitSupplierQuotation()'s upsert
-- targets (rfq_supplier_id, pr1_item_id); without a partial index, raw
-- material quotes (pr1_item_id null) never hit a conflict target and every
-- re-save would insert a duplicate row instead of updating.
ALTER TABLE rfq_item_quotes
  DROP CONSTRAINT rfq_item_quotes_rfq_supplier_id_pr1_item_id_key;

CREATE UNIQUE INDEX rfq_item_quotes_supplier_pr1_item_key
  ON rfq_item_quotes (rfq_supplier_id, pr1_item_id) WHERE pr1_item_id IS NOT NULL;

CREATE UNIQUE INDEX rfq_item_quotes_supplier_pr2_item_key
  ON rfq_item_quotes (rfq_supplier_id, pr2_item_id) WHERE pr2_item_id IS NOT NULL;
