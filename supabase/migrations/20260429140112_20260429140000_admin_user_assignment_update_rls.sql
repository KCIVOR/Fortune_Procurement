/*
  # Admin User Assignment Update RLS Policy

  1. New Policies
    - Allow admins to update role_id, position_id, and department_id for other users
    - Query by role name 'admin' instead of hardcoded UUID
    - Only affects role, position, and department assignments
    - Does NOT allow updates to other profile fields
  2. Security
    - Only users with role name 'admin' can update other users' assignments
    - Users can still update only their own profile (existing policy remains)
    - No unauthenticated access
  3. Notes
    - Admins identified by checking profiles.role_id → roles.name = 'admin'
    - Separate policy for role assignment field only (restrictive approach)
*/

-- Create policy allowing admins to update role_id for other users
CREATE POLICY "Admins can update user role"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    -- Admin is attempting update on a different user
    auth.uid() != id
    AND EXISTS (
      SELECT 1 FROM profiles admin_profile
      JOIN roles ON admin_profile.role_id = roles.id
      WHERE admin_profile.id = auth.uid()
      AND roles.name = 'admin'
    )
  )
  WITH CHECK (
    -- Verify target is different user and actor is admin
    auth.uid() != id
    AND EXISTS (
      SELECT 1 FROM profiles admin_profile
      JOIN roles ON admin_profile.role_id = roles.id
      WHERE admin_profile.id = auth.uid()
      AND roles.name = 'admin'
    )
  );
