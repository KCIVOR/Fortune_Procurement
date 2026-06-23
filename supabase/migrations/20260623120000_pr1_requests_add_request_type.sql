/*
  # PR1 Requests: add request_type classification

  ## Summary
  Introduces a header-level request type classification on PR1 requests.
  Phase 1 of the Service Request Type Implementation Plan
  (see `docs/service-request-type-plan.md`).

  ## Why
  Users need to classify a Purchase Request as either Goods or Services.
  Service requests are intangible and have no physical stock, so Stock-on-Hand
  (SOH) validation must be bypassed during warehouse validation.

  ## Change
  - Add `request_type TEXT NOT NULL DEFAULT 'goods'` to `pr1_requests`
    with a CHECK constraint limiting values to 'goods' or 'services'.
  - Add an index on `request_type` to keep queue filtering fast.

  ## Backfill
  All existing `pr1_requests` rows automatically receive `'goods'` via the
  column default, preserving backward compatibility.

  ## Safety / Surgical Notes
  - Purely additive: no existing column is modified or dropped.
  - No RLS policy changes — existing policies on `pr1_requests` already
    cover all columns generically.
  - No application code references this column yet, so behavior is
    unchanged until later phases consume it.

  ## Rollback
  ```sql
  DROP INDEX IF EXISTS public.idx_pr1_requests_request_type;
  ALTER TABLE public.pr1_requests DROP COLUMN IF EXISTS request_type;
  ```
*/

ALTER TABLE public.pr1_requests
  ADD COLUMN IF NOT EXISTS request_type TEXT NOT NULL DEFAULT 'goods'
    CHECK (request_type IN ('goods', 'services'));

COMMENT ON COLUMN public.pr1_requests.request_type IS
  'Classifies the PR1 as either goods (physical items with SOH) or services (intangible; SOH is not applicable). Mixing goods and services in a single PR1 is disallowed at the application layer.';

CREATE INDEX IF NOT EXISTS idx_pr1_requests_request_type
  ON public.pr1_requests (request_type);
