/*
  # PR1 Items: add is_raw_material flag

  ## Summary
  Introduces a per-line raw-material classification on PR1 line items.
  Phase 1.1 of the Raw Mats Implementation Plan
  (see `docs/RAW_MATS_IMPLEMENTATION_PLAN.md`).

  ## Why
  Client wants only items flagged as raw materials (e.g. chemicals used in
  production) to require/encourage product verification during canvassing.
  Non-raw-mats items (office supplies, stationery, etc.) should not be
  treated as compliance issues when supplier offers an unverified or
  manually-entered product.

  ## Change
  - Add `is_raw_material boolean NOT NULL DEFAULT false` to `pr1_items`.
  - Add a partial index on `is_raw_material = true` to keep filtering of
    raw-mats lines fast without bloating storage.

  ## Backfill
  All existing `pr1_items` rows automatically receive `false` via the
  column default. This matches decision D12 in the plan: legacy items
  skip verification (treated as non-raw-mats).

  ## Safety / Surgical Notes
  - Purely additive: no existing column is modified or dropped.
  - No RLS policy changes — existing policies on `pr1_items` already
    cover all columns generically.
  - No application code references this column yet, so behavior is
    unchanged until later phases consume it.

  ## Rollback
  ```sql
  DROP INDEX IF EXISTS public.idx_pr1_items_is_raw_material;
  ALTER TABLE public.pr1_items DROP COLUMN IF EXISTS is_raw_material;
  ```
*/

ALTER TABLE public.pr1_items
  ADD COLUMN IF NOT EXISTS is_raw_material boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.pr1_items.is_raw_material IS
  'True when this line item is a raw material (e.g. chemical input). Set by the requestor during PR1 creation; procurement may override during PR2 (snapshot lives on pr2_items).';

CREATE INDEX IF NOT EXISTS idx_pr1_items_is_raw_material
  ON public.pr1_items (is_raw_material)
  WHERE is_raw_material = true;
