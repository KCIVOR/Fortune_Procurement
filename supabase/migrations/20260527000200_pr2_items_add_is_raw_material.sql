/*
  # PR2 Items: add is_raw_material snapshot

  ## Summary
  Adds the same raw-material flag on `pr2_items` as a snapshot copied from
  `pr1_items` when PR2 is generated from canvassing. Phase 1.2 of the Raw
  Mats Implementation Plan (see `docs/RAW_MATS_IMPLEMENTATION_PLAN.md`).

  ## Why
  The flag must travel with the line through PR2 → PO → Delivery → GRN so
  the raw-mats badge can be rendered on every downstream surface (decision
  D10) and so procurement-side overrides (Phase 10) can persist on the
  PR2 snapshot without mutating the original PR1.

  ## Change
  - Add `is_raw_material boolean NOT NULL DEFAULT false` to `pr2_items`.

  ## Backfill
  Existing `pr2_items` rows receive `false` via default. This is correct
  because their corresponding `pr1_items` are also defaulting to `false`
  (per migration `20260527000100`). No additional UPDATE is required for
  legacy data.

  Optional one-time backfill (only if any pr1_items rows are flipped to
  true between Phase 1.1 and Phase 1.2 deployment — unlikely):
  ```sql
  UPDATE public.pr2_items AS p2
     SET is_raw_material = p1.is_raw_material
    FROM public.pr1_items AS p1
   WHERE p2.pr1_item_id = p1.id
     AND p1.is_raw_material = true;
  ```

  ## Safety / Surgical Notes
  - Purely additive.
  - No RLS changes — existing pr2_items policies cover the new column.
  - Application code does not reference this column until Phase 8.

  ## Rollback
  ```sql
  ALTER TABLE public.pr2_items DROP COLUMN IF EXISTS is_raw_material;
  ```
*/

ALTER TABLE public.pr2_items
  ADD COLUMN IF NOT EXISTS is_raw_material boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.pr2_items.is_raw_material IS
  'Snapshot of raw-material classification for this PR2 line. Initialized from pr1_items.is_raw_material at PR2 creation; procurement may override on this row only (PR1 stays unchanged).';
