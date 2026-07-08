/*
  # PR2 Items: add pr1_remarks_snapshot field

  ## Summary
  Snapshot column that carries the requestor's per-line `pr1_items.remarks`
  forward onto the corresponding `pr2_items` row at PR2 generation time.

  ## Why
  `pr2_items.remarks` already exists but means something different —
  procurement's own canvassing/selection notes (populated from
  `supplier_item_selections.selection_notes`). PR1's requestor remarks
  cannot reuse that column without colliding with existing data, so this
  is a distinctly-named column. It is populated once, in application code
  (`lib/pr2.ts`) when PR2 lines are generated from PR1 items, and is
  read-only downstream — PO and GRN reads join back to this column the
  same way they already join `pr2_items.is_raw_material` and
  `pr2_items.quote_justification`.

  ## Change
  - Add `pr1_remarks_snapshot text` (nullable, no default) to `pr2_items`.

  ## Backfill
  All existing rows get `NULL`. Historical PR2s generated before this
  migration will simply show no PR1 remarks, which is correct since none
  were ever captured for them.

  ## Safety / Surgical Notes
  - Purely additive: no existing column is modified or dropped.
  - No RLS policy changes — existing policies on `pr2_items` already
    cover all columns generically.
  - No application code references this column until it ships alongside
    this migration.

  ## Rollback
  ```sql
  ALTER TABLE public.pr2_items DROP COLUMN IF EXISTS pr1_remarks_snapshot;
  ```
*/

ALTER TABLE public.pr2_items
  ADD COLUMN IF NOT EXISTS pr1_remarks_snapshot text;

COMMENT ON COLUMN public.pr2_items.pr1_remarks_snapshot IS
  'Read-only snapshot of pr1_items.remarks, copied at PR2 generation time. Distinct from pr2_items.remarks (procurement''s own selection notes). Joined through to po_items/grn_items reads the same way is_raw_material/quote_justification are.';
