/*
  # Admin Workflow Management RLS Policies

  ## Summary
  Adds RLS policies to allow admin users to manage approval workflows and steps.
  This enables the Workflow Admin Configuration feature.

  ## Changes
  - Add INSERT policy for approval_workflows (admin only)
  - Add UPDATE policy for approval_workflows (admin only)
  - Add DELETE policy for approval_workflows (admin only)
  - Add INSERT policy for approval_steps (admin only)
  - Add UPDATE policy for approval_steps (admin only)
  - Add DELETE policy for approval_steps (admin only)

  ## Security
  - Only users with role='admin' can modify workflows and steps
  - All authenticated users can still read workflows and steps (existing policy)
  - Audit logs remain insert-only for all authenticated users
*/

-- ─── APPROVAL WORKFLOWS ADMIN POLICIES ───────────────────────────────────────

CREATE POLICY "Admins can insert approval workflows"
  ON approval_workflows FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles admin_profile
      JOIN roles ON admin_profile.role_id = roles.id
      WHERE admin_profile.id = auth.uid()
      AND roles.name = 'admin'
    )
  );

CREATE POLICY "Admins can update approval workflows"
  ON approval_workflows FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile
      JOIN roles ON admin_profile.role_id = roles.id
      WHERE admin_profile.id = auth.uid()
      AND roles.name = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles admin_profile
      JOIN roles ON admin_profile.role_id = roles.id
      WHERE admin_profile.id = auth.uid()
      AND roles.name = 'admin'
    )
  );

CREATE POLICY "Admins can delete approval workflows"
  ON approval_workflows FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile
      JOIN roles ON admin_profile.role_id = roles.id
      WHERE admin_profile.id = auth.uid()
      AND roles.name = 'admin'
    )
  );

-- ─── APPROVAL STEPS ADMIN POLICIES ───────────────────────────────────────────

CREATE POLICY "Admins can insert approval steps"
  ON approval_steps FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles admin_profile
      JOIN roles ON admin_profile.role_id = roles.id
      WHERE admin_profile.id = auth.uid()
      AND roles.name = 'admin'
    )
  );

CREATE POLICY "Admins can update approval steps"
  ON approval_steps FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile
      JOIN roles ON admin_profile.role_id = roles.id
      WHERE admin_profile.id = auth.uid()
      AND roles.name = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles admin_profile
      JOIN roles ON admin_profile.role_id = roles.id
      WHERE admin_profile.id = auth.uid()
      AND roles.name = 'admin'
    )
  );

CREATE POLICY "Admins can delete approval steps"
  ON approval_steps FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile
      JOIN roles ON admin_profile.role_id = roles.id
      WHERE admin_profile.id = auth.uid()
      AND roles.name = 'admin'
    )
  );

-- ─── COMMENTS ────────────────────────────────────────────────────────────────

COMMENT ON POLICY "Admins can insert approval workflows" ON approval_workflows IS
  'Allows admin users to create new approval workflows';

COMMENT ON POLICY "Admins can update approval workflows" ON approval_workflows IS
  'Allows admin users to modify existing approval workflows';

COMMENT ON POLICY "Admins can delete approval workflows" ON approval_workflows IS
  'Allows admin users to delete approval workflows';

COMMENT ON POLICY "Admins can insert approval steps" ON approval_steps IS
  'Allows admin users to add new steps to approval workflows';

COMMENT ON POLICY "Admins can update approval steps" ON approval_steps IS
  'Allows admin users to modify existing approval steps';

COMMENT ON POLICY "Admins can delete approval steps" ON approval_steps IS
  'Allows admin users to remove approval steps from workflows';
