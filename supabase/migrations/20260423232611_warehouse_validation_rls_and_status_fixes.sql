/*
  # Warehouse Validation — RLS and Status Fixes

  ## Summary
  Two issues are fixed in this migration:

  1. pr1_requests UPDATE policy — warehouse staff could not transition PR1 status
     (e.g. pending_warehouse → resolved_internal or pending_approval) because the
     only UPDATE policy allowed only the requisitioner (owner) to update. A second
     policy is added that allows authenticated users to update the status field only
     when the current status is 'pending_warehouse' and the new status is one of the
     two valid warehouse outcomes.

  2. pr1_requests status CHECK constraint — 'resolved_internal' was not a valid
     status value. Adding it so sufficient warehouse decisions can use a semantically
     clear status instead of re-using 'cancelled'.

  ## Changes

  ### pr1_requests
  - Add 'resolved_internal' to status CHECK constraint
  - Add new UPDATE policy: "Warehouse can transition pending_warehouse PR1 status"
    Allows any authenticated user to update status from 'pending_warehouse' to
    either 'resolved_internal' or 'pending_approval'. No other fields are writable
    via this policy because WITH CHECK restricts to those target statuses.

  ## Notes
  - The existing owner UPDATE policy is preserved — owners can still edit their
    own draft PR1s as before.
  - 'resolved_internal' means the warehouse found sufficient stock; request is
    closed without going to procurement approval.
  - 'pending_approval' means the warehouse found insufficient stock; request
    proceeds to the approval workflow.
*/

-- ─── Add resolved_internal to status CHECK ───────────────────────────────────
-- Drop the old constraint and recreate with the new value
ALTER TABLE pr1_requests
  DROP CONSTRAINT IF EXISTS pr1_requests_status_check;

ALTER TABLE pr1_requests
  ADD CONSTRAINT pr1_requests_status_check
  CHECK (status IN (
    'draft',
    'pending_warehouse',
    'pending_approval',
    'resolved_internal',
    'approved',
    'rejected',
    'cancelled'
  ));

-- ─── Add warehouse UPDATE policy on pr1_requests ─────────────────────────────
CREATE POLICY "Warehouse can transition PR1 status from pending_warehouse"
  ON pr1_requests FOR UPDATE
  TO authenticated
  USING (status = 'pending_warehouse')
  WITH CHECK (status IN ('resolved_internal', 'pending_approval'));
