/*
  # Supplier item selections: add quote_justification + requires_justification

  ## Summary
  Phase 7 of the Raw Mats Implementation Plan
  (`docs/RAW_MATS_IMPLEMENTATION_PLAN.md`). When procurement awards a quote
  for a raw-mats line that is unverified or filled manually, they must
  capture a written justification at selection time. This migration adds
  the persistence columns; the application layer enforces minimum length
  and required/not-required logic per line.

  ## Why on supplier_item_selections (not just pr2_items)
  Selections happen during canvassing — sometimes long before PR2 is
  generated. Capturing the justification at the canvassing record gives
  us:
    - Auditable record at the moment of decision (selected_at).
    - A snapshot we can copy onto pr2_items at PR2 creation (Phase 8).
    - Visibility for cancelled/replaced selections that never reach PR2.

  ## Change
  - `quote_justification text NULL` — free-form text, validated by app
    layer (min length, presence-when-required) rather than a DB CHECK
    so we can iterate on copy and length thresholds without a migration.
  - `requires_justification boolean NOT NULL DEFAULT false` — denormalised
    flag captured at selection time, indicating the award needed
    justification (raw-mats line + unverified/manual quote). Useful for
    quick filtering, dashboards, and downstream snapshots.

  ## Backfill
  Existing rows (currently 0 in production) receive
  `requires_justification = false` and `quote_justification = NULL`.
  This is correct because the legacy strict rule never allowed an
  unverified award in the first place; any selection on record must have
  been against a verified product.

  ## Safety / Surgical Notes
  - Purely additive. No existing column is modified or dropped.
  - No RLS changes — existing procurement policies on
    `supplier_item_selections` cover all columns generically.
  - No application code references these columns yet, so behaviour is
    unchanged until later Phase 7 commits land.

  ## Rollback
  ```sql
  ALTER TABLE public.supplier_item_selections
    DROP COLUMN IF EXISTS requires_justification,
    DROP COLUMN IF EXISTS quote_justification;
  ```
*/

ALTER TABLE public.supplier_item_selections
  ADD COLUMN IF NOT EXISTS quote_justification    text,
  ADD COLUMN IF NOT EXISTS requires_justification boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.supplier_item_selections.quote_justification IS
  'Procurement justification captured when awarding an unverified or manual-entry quote on a raw-mats line. NULL when not required (verified product OR non-raw-mats line). App layer enforces minimum length.';

COMMENT ON COLUMN public.supplier_item_selections.requires_justification IS
  'Phase 7 denormalised flag: true when the award required a justification (raw-mats line awarded against an unverified/manual quote). Lets dashboards filter without re-joining.';
