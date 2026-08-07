-- Migration: 20260805100000_backfill_pr2_priority_from_pr1.sql
--
-- Data-only fix: pr2_requests.priority was added (20260729000000) with
-- DEFAULT 'normal', but createPR2FromWarehouseValidation() never copied the
-- source PR1's priority into it, so every warehouse-generated PR2 has been
-- silently stuck at 'normal' regardless of its PR1's actual priority.
--
-- This backfills existing rows only. The write-path fix (copying priority at
-- creation time) lands separately in lib/pr2-warehouse.ts so future PR2s
-- don't need this backfill again.

UPDATE pr2_requests p2
SET priority = p1.priority, updated_at = now()
FROM pr1_requests p1
WHERE p2.pr1_id = p1.id
  AND p2.priority IS DISTINCT FROM p1.priority;
