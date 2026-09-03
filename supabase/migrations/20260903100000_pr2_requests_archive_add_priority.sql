-- Migration: 20260903100000_pr2_requests_archive_add_priority.sql
--
-- Live pr2_requests gained `priority` in 20260729000000. Archive was created
-- later without it. unwind_pr2_to_warehouse() copies with
--   INSERT INTO pr2_requests_archive SELECT * FROM pr2_requests
-- which raises 42601 (more expressions than target columns).
--
-- Additive archive-only change. Does not alter live pr2_requests.
-- Does not rewrite the RPC (see 20260903101000).

ALTER TABLE public.pr2_requests_archive
  ADD COLUMN IF NOT EXISTS priority text DEFAULT 'normal';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pr2_requests_archive_priority_check'
  ) THEN
    ALTER TABLE public.pr2_requests_archive
      ADD CONSTRAINT pr2_requests_archive_priority_check
      CHECK (priority IS NULL OR priority IN ('normal', 'medium', 'high'));
  END IF;
END $$;
