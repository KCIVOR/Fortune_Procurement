/*
  # Admin Role Management RLS Policies

  1. New Policies
    - Allow admins to insert new roles
    - Allow admins to update existing roles
    - Uses proven admin-check pattern: profiles.role_id → roles.name = 'admin'
  2. Security
    - Only users with role name 'admin' can create/edit roles
    - Authenticated users can still read all roles
    - No unauthenticated access
  3. Notes
    - INSERT: Create new roles with name (must be unique)
    - UPDATE: Edit name field only
    - No DELETE policy added per scope
    - Role names are stored in:
      - approval_steps.role_required as TEXT
      - config/navigation.ts ROLE_NAV mapping
      - auth login logic
      Changing name does not auto-update these (must be done separately)
*/

-- Allow admins to insert roles
CREATE POLICY "Admins can create roles"
  ON roles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles admin_profile
      JOIN roles admin_role ON admin_profile.role_id = admin_role.id
      WHERE admin_profile.id = auth.uid()
      AND admin_role.name = 'admin'
    )
  );

-- Allow admins to update roles
CREATE POLICY "Admins can update roles"
  ON roles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile
      JOIN roles admin_role ON admin_profile.role_id = admin_role.id
      WHERE admin_profile.id = auth.uid()
      AND admin_role.name = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles admin_profile
      JOIN roles admin_role ON admin_profile.role_id = admin_role.id
      WHERE admin_profile.id = auth.uid()
      AND admin_role.name = 'admin'
    )
  );
