/*
  # Add PR1 Priority Update Policy

  ## Summary
  Adds RLS policy allowing procurement and approver roles to update PR1 priority field.
  Complements the updatePR1Priority() helper function in lib/pr1.ts which enforces
  authorization at the application layer and restricts updates to the priority field.

  ## Changes

  ### 1. New UPDATE policy for procurement and approver roles
  - Policy: "Procurement and approvers can update PR1 priority"
  - Allows: Users with role_id matching 'procurement' or 'approver' roles
  - Action: UPDATE on pr1_requests table
  - USING: Checks auth.uid() against profile/role join
  - WITH CHECK: true (permissive; application layer enforces priority-only updates)
  - Enables: updatePR1Priority(pr1Id, priority, profile) function to work

  ## Security Notes
  - WITH CHECK (true) allows UPDATE of any column; application layer enforces priority-only
  - USING clause restricts to procurement/approver roles only
  - Does NOT restrict which PR1s can be updated; any PR1 by authorized roles
  - Existing policies remain intact (role-based, status-based, ownership-based)
  - No column-level security in Postgres; relies on application enforcement

  ## Backward Compatibility
  - No existing policies modified or deleted
  - Procurement/approver users already had SELECT access
  - Now they can also UPDATE (previously blocked)
  - Requisitioner ownership policies still apply to their own PR1s
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pr1_requests'
      AND policyname = 'Procurement and approvers can update PR1 priority'
  ) THEN
    CREATE POLICY "Procurement and approvers can update PR1 priority"
      ON pr1_requests FOR UPDATE
      TO authenticated
      USING (
        auth.uid() IN (
          SELECT p.id
          FROM profiles p
          JOIN roles r ON p.role_id = r.id
          WHERE r.name IN ('procurement', 'approver')
        )
      )
      WITH CHECK (true);
  END IF;
END $$;
