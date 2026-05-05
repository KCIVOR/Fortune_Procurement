
/*
  # Add Admin Role and Demo User

  ## Summary
  Adds the admin role and related position, creating the foundation for system administration features.

  ## New Data
  - `roles.name`: admin
  - `positions.title`: System Administrator (linked to admin role)
  - Demo user: admin@fortune.com / Fortune2024!

  ## Demo Accounts Updated
  | Email | Role | Position | Department |
  |---|---|---|---|
  | admin@fortune.com | admin | System Administrator | Executive Office |

  ## Security
  - RLS policies not modified (existing policies permit authenticated users to read roles/positions)
  - Admin role is data-only; permissions enforced in application code
  - Demo password follows existing pattern (hashed with bcrypt)
*/

DO $$
DECLARE
  v_admin_role_id uuid;
  v_pos_admin uuid;
  v_dept_exec uuid;
  v_user_id uuid;
BEGIN
  -- Get or create admin role
  SELECT id INTO v_admin_role_id FROM roles WHERE name = 'admin';
  IF v_admin_role_id IS NULL THEN
    INSERT INTO roles (name) VALUES ('admin')
    RETURNING id INTO v_admin_role_id;
  END IF;

  -- Get or create System Administrator position
  SELECT id INTO v_pos_admin FROM positions WHERE title = 'System Administrator';
  IF v_pos_admin IS NULL THEN
    INSERT INTO positions (title, role_id) VALUES ('System Administrator', v_admin_role_id)
    RETURNING id INTO v_pos_admin;
  END IF;

  -- Get Executive Office department
  SELECT id INTO v_dept_exec FROM departments WHERE code = 'EXEC';

  -- Create admin demo user if it doesn't exist
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'admin@fortune.com';
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, aud, role)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'admin@fortune.com', extensions.crypt('Fortune2024!'::text, extensions.gen_salt('bf'::text)), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), 'authenticated', 'authenticated');
  END IF;

  -- Create or update admin profile
  INSERT INTO profiles (id, full_name, email, role_id, position_id, department_id)
  VALUES (v_user_id, 'System Administrator', 'admin@fortune.com', v_admin_role_id, v_pos_admin, v_dept_exec)
  ON CONFLICT (id) DO NOTHING;

END $$;
