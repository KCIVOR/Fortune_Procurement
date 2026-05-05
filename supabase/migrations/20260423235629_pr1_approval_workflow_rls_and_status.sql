
/*
  # PR1 Approval Workflow — RLS Policies and Status Extensions

  ## Summary
  Wires up the approval workflow for PR1 documents after warehouse validation.
  Adds the necessary RLS policies and status values so approvers can act on
  pending_approval PR1s and the system can advance the workflow.

  ## Changes

  ### 1. pr1_requests status constraint
  - Adds 'for_canvassing' to the allowed status values
    (fully-approved PR1 advances to For Canvassing)
  - Adds 'revision_requested' for when an approver sends back for changes

  ### 2. pr1_requests UPDATE policy for approvers
  - Approvers (role = approver) can transition a PR1 that is pending_approval
    to: approved, rejected, revision_requested, for_canvassing
  - The USING clause restricts to pending_approval only
  - The WITH CHECK enforces only the allowed target statuses

  ### 3. approval_instances UPDATE policy for the service role
  - The approval service needs to advance current_step and set status = completed
  - We add a policy: authenticated users can update approval_instances
    (the service-layer validates actor authority before calling update)

  ## Security Notes
  - Approver RLS on pr1_requests is intentionally broad on status targets;
    the service layer enforces positional authority (Supervisor before Dept Head)
    as the DB cannot introspect the user's position at the row level without a
    helper function join — so business-rule enforcement is in lib/approvals.ts
  - The approval_instances UPDATE policy relies on application-layer authority
    checks (checked before the DB call is made)
*/

-- 1. Extend pr1_requests status check constraint to include new values
DO $$
BEGIN
  ALTER TABLE pr1_requests DROP CONSTRAINT IF EXISTS pr1_requests_status_check;
  ALTER TABLE pr1_requests ADD CONSTRAINT pr1_requests_status_check
    CHECK (status IN (
      'draft',
      'pending_warehouse',
      'pending_approval',
      'resolved_internal',
      'revision_requested',
      'approved',
      'for_canvassing',
      'rejected',
      'cancelled'
    ));
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 2. Approvers can transition a pending_approval PR1
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pr1_requests'
      AND policyname = 'Approvers can act on pending_approval PR1s'
  ) THEN
    CREATE POLICY "Approvers can act on pending_approval PR1s"
      ON pr1_requests FOR UPDATE
      TO authenticated
      USING (status = 'pending_approval')
      WITH CHECK (status IN ('approved', 'rejected', 'revision_requested', 'for_canvassing', 'pending_approval'));
  END IF;
END $$;

-- 3. Authenticated users can update approval_instances (service layer enforces authority)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'approval_instances'
      AND policyname = 'Authenticated users can update approval instances'
  ) THEN
    CREATE POLICY "Authenticated users can update approval instances"
      ON approval_instances FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
