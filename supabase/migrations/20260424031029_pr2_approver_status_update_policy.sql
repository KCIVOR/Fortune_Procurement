/*
  # Allow approver role to update PR2 request status

  ## Problem
  The existing UPDATE policy on pr2_requests only permits users with role=procurement
  to update rows. When an approver (Director, Department Head) submits the final Phase 1
  approval step, the service code calls UPDATE pr2_requests to transition status to
  'phase1_approved' or 'phase2_approved'. RLS silently blocks this (0 rows updated, no
  error), so PR2.status never advances past 'pending_phase1_approval'.

  ## Fix
  Add a second UPDATE policy allowing role=approver to update pr2_requests. Approvers
  legitimately drive status transitions on final approval steps.

  ## Security
  Both the existing procurement policy and this new approver policy require the actor to
  be authenticated. The row-level filter is USING (true) which is intentional here:
  approvers need to update any PR2 they are acting on (they don't own the row).
  The approval authority gate (position+role match) is enforced at the application layer
  in canActOnPR2Step before this update is ever reached.
*/

CREATE POLICY "Approvers can update PR2 request status"
  ON pr2_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles p
      JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid()
        AND r.name = 'approver'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles p
      JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid()
        AND r.name = 'approver'
    )
  );
