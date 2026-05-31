/*
  # PR2 Items: add quote_justification snapshot

  ## Summary
  Adds a free-form justification field on `pr2_items` to capture the
  reason procurement provided when awarding an unverified product on a
  raw-mats line. Phase 1.3 of the Raw Mats Implementation Plan
  (see `docs/RAW_MATS_IMPLEMENTATION_PLAN.md`).

  ## Why
  Decisions D6 and D11: when procurement selects an unverified or
  manually-entered quote on a raw-mats line, they must provide a written
  justification. The justification originates at canvassing-time on
  `supplier_item_selections.quote_justification` (added in a separate
  Phase 7 migration) and is snapshotted onto the PR2 line for downstream
  visibility (PO detail, audit, print) without forcing every reader to
  join back to the canvassing tables.

  ## Change
  - Add nullable `quote_justification text` column to `pr2_items`.

  ## Backfill
  None. Existing rows remain NULL (no justification was ever required
  for them, and they likely all reference verified products under the
  legacy strict rule).

  ## Safety / Surgical Notes
  - Purely additive, nullable column.
  - No CHECK constraint at this stage — minimum length validation lives
    in the application layer where end-user feedback is best surfaced
    (planned in Phase 7). A DB-level constraint can be added later once
    the minimum length is finalized with the client.
  - No RLS changes — existing pr2_items policies cover the new column.
  - Application code does not reference this column until Phase 8.

  ## Rollback
  ```sql
  ALTER TABLE public.pr2_items DROP COLUMN IF EXISTS quote_justification;
  ```
*/

ALTER TABLE public.pr2_items
  ADD COLUMN IF NOT EXISTS quote_justification text;

COMMENT ON COLUMN public.pr2_items.quote_justification IS
  'Procurement justification snapshot for awarding an unverified or manual-entry quote on a raw-mats line. NULL when not required (verified product OR non-raw-mats line). Source: supplier_item_selections.quote_justification at PR2 creation.';
