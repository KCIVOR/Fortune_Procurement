-- Raw Materials Phase 3 (Bundle C) fix: PostgREST upsert(onConflict:'a,b')
-- performs plain unique-index inference — it cannot target a *partial*
-- unique index (would need the WHERE predicate repeated in ON CONFLICT,
-- which the client library has no way to express). The two partial indexes
-- added in raw_material_phase3_schema don't work as upsert conflict targets.
-- Fix: replace each pair with a single NULLS NOT DISTINCT composite index,
-- which conflict-infers correctly for both the pr1_item_id and pr2_item_id
-- cases from one onConflict string.

DROP INDEX supplier_item_selections_rfq_pr1_item_key;
DROP INDEX supplier_item_selections_rfq_pr2_item_key;

CREATE UNIQUE INDEX supplier_item_selections_rfq_item_key
  ON supplier_item_selections (rfq_id, pr1_item_id, pr2_item_id) NULLS NOT DISTINCT;

DROP INDEX rfq_item_quotes_supplier_pr1_item_key;
DROP INDEX rfq_item_quotes_supplier_pr2_item_key;

CREATE UNIQUE INDEX rfq_item_quotes_supplier_item_key
  ON rfq_item_quotes (rfq_supplier_id, pr1_item_id, pr2_item_id) NULLS NOT DISTINCT;
