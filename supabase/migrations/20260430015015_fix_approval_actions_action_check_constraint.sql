/*
  # Fix approval_actions action check constraint

  ## Problem
  The approval_actions_action_check constraint currently allows:
    'approved', 'rejected', 'noted'

  All application code (PR1, PR2, PO approval workflows) inserts 'revision_requested'
  for the "Request Revision" action. The value 'noted' is not used anywhere in the
  codebase. This mismatch causes a database constraint violation whenever an approver
  clicks "Request Revision".

  ## Changes
  - Drops the existing approval_actions_action_check constraint
  - Recreates it allowing: 'approved', 'rejected', 'revision_requested'

  ## Safety
  - Zero existing rows with action = 'noted' (verified before migration)
  - No application code changes required — app already uses the correct values
  - Affects PR1, PR2, and PO approval workflows (all insert into approval_actions)
*/

ALTER TABLE approval_actions
  DROP CONSTRAINT IF EXISTS approval_actions_action_check;

ALTER TABLE approval_actions
  ADD CONSTRAINT approval_actions_action_check
  CHECK (action = ANY (ARRAY[
    'approved'::text,
    'rejected'::text,
    'revision_requested'::text
  ]));
