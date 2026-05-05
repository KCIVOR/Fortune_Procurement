/*
  # Admin Position Management RLS Policies

  1. New Policies
    - Allow admins to insert new positions
    - Allow admins to update existing positions
    - Uses proven admin-check pattern: profiles.role_id → roles.name = 'admin'
  2. Security
    - Only users with role name 'admin' can create/edit positions
    - Authenticated users can still read all positions
    - No unauthenticated access
  3. Notes
    - INSERT: Create new positions with title and role_id
    - UPDATE: Edit title and role_id fields only
    - No DELETE policy added per scope
    - Position titles are stored in approval_steps.position_required as TEXT;
      changing title does not auto-update workflows (must be done separately)
*/

-- Allow admins to insert positions
CREATE POLICY "Admins can create positions"
  ON positions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles admin_profile
      JOIN roles ON admin_profile.role_id = roles.id
      WHERE admin_profile.id = auth.uid()
      AND roles.name = 'admin'
    )
  );

-- Allow admins to update positions
CREATE POLICY "Admins can update positions"
  ON positions FOR UPDATE
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
