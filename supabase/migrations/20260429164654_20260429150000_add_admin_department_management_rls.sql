/*
  # Admin Department Management RLS Policies

  1. New Policies
    - Allow admins to insert new departments
    - Allow admins to update existing departments
    - Uses proven admin-check pattern: profiles.role_id → roles.name = 'admin'
  2. Security
    - Only users with role name 'admin' can create/edit departments
    - Authenticated users can still read all departments
    - No unauthenticated access
  3. Notes
    - INSERT: Create new departments with any valid name and unique code
    - UPDATE: Edit name and code fields only (active not exposed in UI yet)
    - No DELETE policy added per scope
*/

-- Allow admins to insert departments
CREATE POLICY "Admins can create departments"
  ON departments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles admin_profile
      JOIN roles ON admin_profile.role_id = roles.id
      WHERE admin_profile.id = auth.uid()
      AND roles.name = 'admin'
    )
  );

-- Allow admins to update departments
CREATE POLICY "Admins can update departments"
  ON departments FOR UPDATE
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
