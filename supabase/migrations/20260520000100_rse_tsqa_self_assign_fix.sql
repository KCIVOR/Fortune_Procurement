-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Fix TSQA self-assignment of unassigned RSE records
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Problem: TSQA users cannot "Start Review" on unassigned RSE records (status = 'created')
-- because the RLS policy requires `assigned_to = auth.uid()`, which fails when
-- assigned_to is NULL.
--
-- Solution: Update the RLS policy to allow TSQA to update records where:
--   1. assigned_to = auth.uid() (already assigned to them), OR
--   2. assigned_to IS NULL AND status IN ('created') (unassigned, self-assignment)
--
-- This allows TSQA users to self-assign unassigned RSE records by clicking
-- "Start Review", which transitions the record to 'under_review' and sets
-- assigned_to to the current user.
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "rse_records_tsqa_update" ON rse_records;

-- Create updated policy that allows self-assignment of unassigned records
CREATE POLICY "rse_records_tsqa_update"
  ON rse_records FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'tsqa'
    )
    AND (
      -- Can update records already assigned to them
      assigned_to = auth.uid()
      OR
      -- Can self-assign unassigned records (status = 'created')
      (assigned_to IS NULL AND status = 'created')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'tsqa'
    )
    AND (
      -- After update, must be assigned to them
      assigned_to = auth.uid()
    )
  );

-- Add comment explaining the policy
COMMENT ON POLICY "rse_records_tsqa_update" ON rse_records IS 
  'TSQA users can update RSE records assigned to them, or self-assign unassigned records (status=created). After update, the record must be assigned to the current user.';
