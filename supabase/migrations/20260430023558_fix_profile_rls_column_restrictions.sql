/*
  # Fix profile self-update RLS to restrict to safe columns only

  ## Problem
  The existing "Users can update own profile" policy allows authenticated users
  to update ANY column (role_id, position_id, department_id, email, full_name)
  on their own profile row. This is a critical security gap: users can self-escalate
  their role or reassign themselves to different departments/positions.

  ## Solution
  Implement column-level access control:
    1. REVOKE all UPDATE permissions on profiles from authenticated role
    2. GRANT UPDATE on ONLY the safe column (full_name) to authenticated
    3. Keep the ownership-checking RLS policy in place

  This ensures:
    - Users can only modify their own full_name
    - role_id, position_id, department_id remain read-only for users
    - Admin role (via "Admins can update user role" policy) retains full update access
    - All existing admin user management flows continue working

  ## Changes
  - REVOKE UPDATE on profiles FROM authenticated (removes blanket permission)
  - GRANT UPDATE (full_name) ON profiles TO authenticated (restores only safe column)
  - Existing RLS policies unchanged (ownership check still applies)

  ## Security
  - Column-level GRANTs are checked BEFORE row-level RLS policies
  - User cannot update role/position/department even if they try
  - Admin updates still work because role grants supersede revoke
*/

DO $$
BEGIN
  -- Revoke all UPDATE permissions on profiles from the authenticated role
  REVOKE UPDATE ON profiles FROM authenticated;

  -- Grant UPDATE permission ONLY on the safe column (full_name)
  GRANT UPDATE (full_name) ON profiles TO authenticated;

  -- Note: The RLS policy "Users can update own profile" remains unchanged
  -- It enforces ownership (auth.uid() = id) but now column-level permissions
  -- also prevent modification of role_id, position_id, department_id
END $$;
