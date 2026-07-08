/*
  # PR1 Items: add remarks field

  ## Summary
  Introduces a free-text, per-line remarks field on PR1 line items so
  requestors can add context (e.g. "prefer brand X", "urgent — machine
  down") to individual items, not just the PR1-level purpose.

  ## Why
  Requestors previously had no way to annotate a specific line item —
  only the PR1 header has a `purpose` field. This remarks value is later
  snapshotted onto `pr2_items.pr1_remarks_snapshot` at PR2 generation
  time (see companion migration `20260708100100`) and displayed
  read-only through PO/GRN, mirroring how `is_raw_material` flows
  through the same pipeline.

  ## Change
  - Add `remarks text` (nullable, no default) to `pr1_items`.

  ## Backfill
  All existing rows get `NULL`, which the app treats as "no remarks".

  ## Safety / Surgical Notes
  - Purely additive: no existing column is modified or dropped.
  - No RLS policy changes — existing policies on `pr1_items` already
    cover all columns generically.
  - No application code references this column until it ships alongside
    this migration, so no behavior changes for anyone not on the new code.

  ## Rollback
  ```sql
  ALTER TABLE public.pr1_items DROP COLUMN IF EXISTS remarks;
  ```
*/

ALTER TABLE public.pr1_items
  ADD COLUMN IF NOT EXISTS remarks text;

COMMENT ON COLUMN public.pr1_items.remarks IS
  'Optional per-line remarks entered by the requestor at PR1 creation. Snapshotted onto pr2_items.pr1_remarks_snapshot at PR2 generation and displayed read-only downstream (PO/GRN).';
