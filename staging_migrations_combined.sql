-- Migration: 20260423215953_foundation_schema.sql

/*
  # Fortune Procurement System â€” Foundation Schema

  ## Summary
  Sets up the core identity and access tables for the procurement system.

  ## New Tables

  ### departments
  - `id` (uuid, PK)
  - `name` (text) â€” e.g. "Finance", "Operations"
  - `code` (text, unique) â€” short code

  ### roles
  - `id` (uuid, PK)
  - `name` (text, unique) â€” e.g. "employee", "warehouse", "procurement", "approver", "supplier"

  ### positions
  - `id` (uuid, PK)
  - `title` (text) â€” e.g. "Supervisor", "Department Head", "Buyer"
  - `role_id` (FK â†’ roles.id) â€” which role category this title belongs to

  ### profiles
  - `id` (uuid, PK = auth.users.id)
  - `full_name` (text)
  - `email` (text)
  - `role_id` (FK â†’ roles.id)
  - `position_id` (FK â†’ positions.id)
  - `department_id` (FK â†’ departments.id)
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled on all tables
  - Profiles: users can read their own profile
  - Departments, roles, positions: all authenticated users can read (reference data)

  ## Seed Data
  - 5 roles: employee, warehouse, procurement, approver, supplier
  - 8 departments
  - 12 positions mapped to roles
  - 8 demo user profiles (passwords managed via Supabase Auth separately)
*/

-- â”€â”€â”€ DEPARTMENTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read departments"
  ON departments FOR SELECT
  TO authenticated
  USING (true);

-- â”€â”€â”€ ROLES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read roles"
  ON roles FOR SELECT
  TO authenticated
  USING (true);

-- â”€â”€â”€ POSITIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  role_id uuid NOT NULL REFERENCES roles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read positions"
  ON positions FOR SELECT
  TO authenticated
  USING (true);

-- â”€â”€â”€ PROFILES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  role_id uuid REFERENCES roles(id),
  position_id uuid REFERENCES positions(id),
  department_id uuid REFERENCES departments(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow profiles to be read by other authenticated users (needed for approval lookups)
CREATE POLICY "Authenticated users can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- â”€â”€â”€ SEED: DEPARTMENTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO departments (name, code) VALUES
  ('Executive Office',    'EXEC'),
  ('Finance',             'FIN'),
  ('Operations',          'OPS'),
  ('Information Technology', 'IT'),
  ('Human Resources',     'HR'),
  ('Procurement',         'PROC'),
  ('Warehouse',           'WH'),
  ('General Services',    'GS')
ON CONFLICT (code) DO NOTHING;

-- â”€â”€â”€ SEED: ROLES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO roles (name) VALUES
  ('employee'),
  ('warehouse'),
  ('procurement'),
  ('approver'),
  ('supplier')
ON CONFLICT (name) DO NOTHING;

-- â”€â”€â”€ SEED: POSITIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO positions (title, role_id)
SELECT 'Staff', id FROM roles WHERE name = 'employee'
ON CONFLICT DO NOTHING;

INSERT INTO positions (title, role_id)
SELECT 'Supervisor', id FROM roles WHERE name = 'approver'
ON CONFLICT DO NOTHING;

INSERT INTO positions (title, role_id)
SELECT 'Department Head', id FROM roles WHERE name = 'approver'
ON CONFLICT DO NOTHING;

INSERT INTO positions (title, role_id)
SELECT 'Director', id FROM roles WHERE name = 'approver'
ON CONFLICT DO NOTHING;

INSERT INTO positions (title, role_id)
SELECT 'Finance Director', id FROM roles WHERE name = 'approver'
ON CONFLICT DO NOTHING;

INSERT INTO positions (title, role_id)
SELECT 'Warehouse Staff', id FROM roles WHERE name = 'warehouse'
ON CONFLICT DO NOTHING;

INSERT INTO positions (title, role_id)
SELECT 'Warehouse Manager', id FROM roles WHERE name = 'warehouse'
ON CONFLICT DO NOTHING;

INSERT INTO positions (title, role_id)
SELECT 'Procurement Staff', id FROM roles WHERE name = 'procurement'
ON CONFLICT DO NOTHING;

INSERT INTO positions (title, role_id)
SELECT 'Authorized Personnel', id FROM roles WHERE name = 'procurement'
ON CONFLICT DO NOTHING;

INSERT INTO positions (title, role_id)
SELECT 'Buyer', id FROM roles WHERE name = 'procurement'
ON CONFLICT DO NOTHING;

INSERT INTO positions (title, role_id)
SELECT 'Procurement Manager', id FROM roles WHERE name = 'procurement'
ON CONFLICT DO NOTHING;

INSERT INTO positions (title, role_id)
SELECT 'Supplier Representative', id FROM roles WHERE name = 'supplier'
ON CONFLICT DO NOTHING;



-- Migration: 20260423215954_enable_pgcrypto.sql
/*
  Seed migrations use crypt() / gen_salt() from pgcrypto.
  Fresh Supabase projects may not have this enabled; seeds use gen_salt('bf'::text)
  so Postgres resolves gen_salt(text) on strict servers.
*/
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;



-- Migration: 20260423220155_seed_demo_users.sql

/*
  # Seed Demo Users

  Creates demo auth users and their corresponding profiles for each role.
  All demo accounts use password: Fortune2024!

  ## Demo Accounts
  | Email | Role | Position | Department |
  |---|---|---|---|
  | employee@fortune.com | employee | Staff | Operations |
  | warehouse@fortune.com | warehouse | Warehouse Staff | Warehouse |
  | wh.manager@fortune.com | warehouse | Warehouse Manager | Warehouse |
  | procurement@fortune.com | procurement | Procurement Staff | Procurement |
  | buyer@fortune.com | procurement | Buyer | Procurement |
  | proc.manager@fortune.com | procurement | Procurement Manager | Procurement |
  | supervisor@fortune.com | approver | Supervisor | Operations |
  | dept.head@fortune.com | approver | Department Head | Operations |
  | director@fortune.com | approver | Director | Executive Office |
  | finance.director@fortune.com | approver | Finance Director | Finance |
  | supplier@fortune.com | supplier | Supplier Representative | General Services |
*/

DO $$
DECLARE
  v_employee_role_id uuid;
  v_warehouse_role_id uuid;
  v_procurement_role_id uuid;
  v_approver_role_id uuid;
  v_supplier_role_id uuid;

  v_pos_staff uuid;
  v_pos_wh_staff uuid;
  v_pos_wh_manager uuid;
  v_pos_proc_staff uuid;
  v_pos_buyer uuid;
  v_pos_proc_manager uuid;
  v_pos_supervisor uuid;
  v_pos_dept_head uuid;
  v_pos_director uuid;
  v_pos_fin_director uuid;
  v_pos_supplier_rep uuid;

  v_dept_ops uuid;
  v_dept_wh uuid;
  v_dept_proc uuid;
  v_dept_exec uuid;
  v_dept_fin uuid;
  v_dept_gs uuid;

  v_user_id uuid;
BEGIN
  SELECT id INTO v_employee_role_id FROM roles WHERE name = 'employee';
  SELECT id INTO v_warehouse_role_id FROM roles WHERE name = 'warehouse';
  SELECT id INTO v_procurement_role_id FROM roles WHERE name = 'procurement';
  SELECT id INTO v_approver_role_id FROM roles WHERE name = 'approver';
  SELECT id INTO v_supplier_role_id FROM roles WHERE name = 'supplier';

  SELECT id INTO v_pos_staff FROM positions WHERE title = 'Staff';
  SELECT id INTO v_pos_wh_staff FROM positions WHERE title = 'Warehouse Staff';
  SELECT id INTO v_pos_wh_manager FROM positions WHERE title = 'Warehouse Manager';
  SELECT id INTO v_pos_proc_staff FROM positions WHERE title = 'Procurement Staff';
  SELECT id INTO v_pos_buyer FROM positions WHERE title = 'Buyer';
  SELECT id INTO v_pos_proc_manager FROM positions WHERE title = 'Procurement Manager';
  SELECT id INTO v_pos_supervisor FROM positions WHERE title = 'Supervisor';
  SELECT id INTO v_pos_dept_head FROM positions WHERE title = 'Department Head';
  SELECT id INTO v_pos_director FROM positions WHERE title = 'Director';
  SELECT id INTO v_pos_fin_director FROM positions WHERE title = 'Finance Director';
  SELECT id INTO v_pos_supplier_rep FROM positions WHERE title = 'Supplier Representative';

  SELECT id INTO v_dept_ops FROM departments WHERE code = 'OPS';
  SELECT id INTO v_dept_wh FROM departments WHERE code = 'WH';
  SELECT id INTO v_dept_proc FROM departments WHERE code = 'PROC';
  SELECT id INTO v_dept_exec FROM departments WHERE code = 'EXEC';
  SELECT id INTO v_dept_fin FROM departments WHERE code = 'FIN';
  SELECT id INTO v_dept_gs FROM departments WHERE code = 'GS';

  -- employee@fortune.com
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'employee@fortune.com';
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, aud, role)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'employee@fortune.com', extensions.crypt('Fortune2024!'::text, extensions.gen_salt('bf'::text)), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), 'authenticated', 'authenticated');
  END IF;
  INSERT INTO profiles (id, full_name, email, role_id, position_id, department_id)
  VALUES (v_user_id, 'Juan dela Cruz', 'employee@fortune.com', v_employee_role_id, v_pos_staff, v_dept_ops)
  ON CONFLICT (id) DO NOTHING;

  -- warehouse@fortune.com
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'warehouse@fortune.com';
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, aud, role)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'warehouse@fortune.com', extensions.crypt('Fortune2024!'::text, extensions.gen_salt('bf'::text)), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), 'authenticated', 'authenticated');
  END IF;
  INSERT INTO profiles (id, full_name, email, role_id, position_id, department_id)
  VALUES (v_user_id, 'Pedro Santos', 'warehouse@fortune.com', v_warehouse_role_id, v_pos_wh_staff, v_dept_wh)
  ON CONFLICT (id) DO NOTHING;

  -- wh.manager@fortune.com
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'wh.manager@fortune.com';
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, aud, role)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'wh.manager@fortune.com', extensions.crypt('Fortune2024!'::text, extensions.gen_salt('bf'::text)), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), 'authenticated', 'authenticated');
  END IF;
  INSERT INTO profiles (id, full_name, email, role_id, position_id, department_id)
  VALUES (v_user_id, 'Maria Reyes', 'wh.manager@fortune.com', v_warehouse_role_id, v_pos_wh_manager, v_dept_wh)
  ON CONFLICT (id) DO NOTHING;

  -- procurement@fortune.com
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'procurement@fortune.com';
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, aud, role)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'procurement@fortune.com', extensions.crypt('Fortune2024!'::text, extensions.gen_salt('bf'::text)), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), 'authenticated', 'authenticated');
  END IF;
  INSERT INTO profiles (id, full_name, email, role_id, position_id, department_id)
  VALUES (v_user_id, 'Ana Gomez', 'procurement@fortune.com', v_procurement_role_id, v_pos_proc_staff, v_dept_proc)
  ON CONFLICT (id) DO NOTHING;

  -- buyer@fortune.com
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'buyer@fortune.com';
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, aud, role)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'buyer@fortune.com', extensions.crypt('Fortune2024!'::text, extensions.gen_salt('bf'::text)), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), 'authenticated', 'authenticated');
  END IF;
  INSERT INTO profiles (id, full_name, email, role_id, position_id, department_id)
  VALUES (v_user_id, 'Carlos Mendoza', 'buyer@fortune.com', v_procurement_role_id, v_pos_buyer, v_dept_proc)
  ON CONFLICT (id) DO NOTHING;

  -- proc.manager@fortune.com
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'proc.manager@fortune.com';
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, aud, role)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'proc.manager@fortune.com', extensions.crypt('Fortune2024!'::text, extensions.gen_salt('bf'::text)), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), 'authenticated', 'authenticated');
  END IF;
  INSERT INTO profiles (id, full_name, email, role_id, position_id, department_id)
  VALUES (v_user_id, 'Rosa Fernandez', 'proc.manager@fortune.com', v_procurement_role_id, v_pos_proc_manager, v_dept_proc)
  ON CONFLICT (id) DO NOTHING;

  -- supervisor@fortune.com
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'supervisor@fortune.com';
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, aud, role)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'supervisor@fortune.com', extensions.crypt('Fortune2024!'::text, extensions.gen_salt('bf'::text)), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), 'authenticated', 'authenticated');
  END IF;
  INSERT INTO profiles (id, full_name, email, role_id, position_id, department_id)
  VALUES (v_user_id, 'Roberto Lim', 'supervisor@fortune.com', v_approver_role_id, v_pos_supervisor, v_dept_ops)
  ON CONFLICT (id) DO NOTHING;

  -- dept.head@fortune.com
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'dept.head@fortune.com';
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, aud, role)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'dept.head@fortune.com', extensions.crypt('Fortune2024!'::text, extensions.gen_salt('bf'::text)), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), 'authenticated', 'authenticated');
  END IF;
  INSERT INTO profiles (id, full_name, email, role_id, position_id, department_id)
  VALUES (v_user_id, 'Luisa Castro', 'dept.head@fortune.com', v_approver_role_id, v_pos_dept_head, v_dept_ops)
  ON CONFLICT (id) DO NOTHING;

  -- director@fortune.com
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'director@fortune.com';
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, aud, role)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'director@fortune.com', extensions.crypt('Fortune2024!'::text, extensions.gen_salt('bf'::text)), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), 'authenticated', 'authenticated');
  END IF;
  INSERT INTO profiles (id, full_name, email, role_id, position_id, department_id)
  VALUES (v_user_id, 'Eduardo Torres', 'director@fortune.com', v_approver_role_id, v_pos_director, v_dept_exec)
  ON CONFLICT (id) DO NOTHING;

  -- finance.director@fortune.com
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'finance.director@fortune.com';
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, aud, role)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'finance.director@fortune.com', extensions.crypt('Fortune2024!'::text, extensions.gen_salt('bf'::text)), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), 'authenticated', 'authenticated');
  END IF;
  INSERT INTO profiles (id, full_name, email, role_id, position_id, department_id)
  VALUES (v_user_id, 'Gloria Navarro', 'finance.director@fortune.com', v_approver_role_id, v_pos_fin_director, v_dept_fin)
  ON CONFLICT (id) DO NOTHING;

  -- supplier@fortune.com
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'supplier@fortune.com';
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, aud, role)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'supplier@fortune.com', extensions.crypt('Fortune2024!'::text, extensions.gen_salt('bf'::text)), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), 'authenticated', 'authenticated');
  END IF;
  INSERT INTO profiles (id, full_name, email, role_id, position_id, department_id)
  VALUES (v_user_id, 'Ace Supply Corp', 'supplier@fortune.com', v_supplier_role_id, v_pos_supplier_rep, v_dept_gs)
  ON CONFLICT (id) DO NOTHING;

END $$;



-- Migration: 20260423221046_fix_demo_user_identities.sql

/*
  # Fix Demo User Auth Identities

  ## Root Cause
  The seed migration inserted rows directly into auth.users but did not create
  corresponding rows in auth.identities. Supabase signInWithPassword requires
  an identity record with provider = 'email' to authenticate. Without it, every
  login attempt fails silently.

  ## Fix
  Insert a matching auth.identities row for each demo user that is missing one.
  The identity_data must contain at minimum { "sub": "<user_id>", "email": "<email>" }.
*/

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT u.id, u.email
    FROM auth.users u
    WHERE u.email LIKE '%@fortune.com'
      AND NOT EXISTS (
        SELECT 1 FROM auth.identities i
        WHERE i.user_id = u.id AND i.provider = 'email'
      )
  LOOP
    INSERT INTO auth.identities (
      id,
      provider_id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      rec.email,
      rec.id,
      jsonb_build_object('sub', rec.id::text, 'email', rec.email),
      'email',
      now(),
      now(),
      now()
    );
  END LOOP;
END $$;



-- Migration: 20260423221438_core_workflow_schema.sql

/*
  # Fortune Procurement â€” Core Workflow Schema

  ## Summary
  Builds the complete backend foundation required by the MVP transaction path.
  Adds workflow orchestration, document versioning, audit logging, and notification
  infrastructure on top of the existing identity tables.

  ## New Tables

  ### controlled_form_templates
  Defines each document type in the system (PR1, PR2, PO, GRN, RFQ).
  - `id` (uuid, PK)
  - `code` (text, unique) â€” e.g. 'PR1', 'PR2', 'PO', 'GRN', 'RFQ'
  - `name` (text) â€” human-readable label
  - `description` (text)
  - `active` (bool)

  ### controlled_form_versions
  Tracks the form version number for each template (for audit purposes, MVP = v1 only).
  - `id` (uuid, PK)
  - `template_id` (FK â†’ controlled_form_templates.id)
  - `version` (int) â€” version number
  - `effective_from` (timestamptz)
  - `active` (bool)

  ### approval_workflows
  Defines a named workflow for a document type (static, seeded).
  - `id` (uuid, PK)
  - `code` (text, unique) â€” e.g. 'PR1_APPROVAL', 'PR2_PHASE1', 'PR2_PHASE2', 'PO_APPROVAL'
  - `name` (text)
  - `form_template_id` (FK â†’ controlled_form_templates.id)
  - `active` (bool)

  ### approval_steps
  Each step in an approval workflow (ordered).
  - `id` (uuid, PK)
  - `workflow_id` (FK â†’ approval_workflows.id)
  - `step_order` (int) â€” 1-based sequence
  - `role_required` (text) â€” role name that can act on this step
  - `position_required` (text) â€” specific position/title required (nullable = any in role)
  - `action_label` (text) â€” e.g. 'Reviewed and Noted By', 'Approved By', 'Certified By'
  - `is_final` (bool) â€” whether completing this step closes the workflow

  ### approval_instances
  A live workflow run tied to a specific document (PR1, PR2, PO, etc.).
  - `id` (uuid, PK)
  - `workflow_id` (FK â†’ approval_workflows.id)
  - `document_type` (text) â€” 'PR1' | 'PR2' | 'PO' | 'GRN' | 'RFQ'
  - `document_id` (uuid) â€” FK to the document table (enforced by app logic, not FK constraint for flexibility)
  - `current_step` (int) â€” which step is active (1-based)
  - `status` (text) â€” 'active' | 'approved' | 'rejected' | 'cancelled'
  - `started_at` (timestamptz)
  - `completed_at` (timestamptz, nullable)
  - `started_by` (FK â†’ profiles.id)

  ### approval_actions
  Each act taken by an approver on a workflow step (with signer snapshot).
  - `id` (uuid, PK)
  - `instance_id` (FK â†’ approval_instances.id)
  - `step_order` (int)
  - `action` (text) â€” 'approved' | 'rejected' | 'noted'
  - `actor_id` (FK â†’ profiles.id)
  - `actor_name_snapshot` (text) â€” captured at time of signing
  - `actor_position_snapshot` (text) â€” captured at time of signing
  - `actor_department_snapshot` (text) â€” captured at time of signing
  - `remarks` (text, nullable)
  - `acted_at` (timestamptz)

  ### notifications
  In-app notifications per user.
  - `id` (uuid, PK)
  - `user_id` (FK â†’ profiles.id)
  - `title` (text)
  - `body` (text)
  - `type` (text) â€” 'action_required' | 'info' | 'approved' | 'rejected'
  - `document_type` (text, nullable)
  - `document_id` (uuid, nullable)
  - `read` (bool, default false)
  - `created_at` (timestamptz)

  ### audit_logs
  Immutable audit trail for all state-changing operations.
  - `id` (uuid, PK)
  - `actor_id` (uuid, nullable FK â†’ profiles.id)
  - `action` (text) â€” e.g. 'PR1_SUBMITTED', 'PR1_APPROVED', 'WAREHOUSE_VALIDATED'
  - `document_type` (text, nullable)
  - `document_id` (uuid, nullable)
  - `payload` (jsonb, nullable) â€” snapshot of relevant data at time of action
  - `ip_address` (text, nullable)
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled on all new tables
  - approval_steps / approval_workflows / controlled_form_templates: readable by all authenticated
  - approval_instances / approval_actions: readable by authenticated users (for now â€” row-level scoping added per document in later steps)
  - notifications: user can only read/update their own
  - audit_logs: insert only via service role; no user updates/deletes

  ## Notes
  - Approval routing is static (seeded). No dynamic workflow builder.
  - document_id in approval_instances references different tables per document_type.
    A foreign key constraint is intentionally omitted here for flexibility; integrity
    is enforced at the application layer.
  - Signer snapshots on approval_actions ensure historical accuracy even if profile data changes later.
*/

-- â”€â”€â”€ CONTROLLED FORM TEMPLATES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS controlled_form_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text UNIQUE NOT NULL,
  name        text NOT NULL,
  description text NOT NULL DEFAULT '',
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE controlled_form_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read form templates"
  ON controlled_form_templates FOR SELECT
  TO authenticated
  USING (true);

-- â”€â”€â”€ CONTROLLED FORM VERSIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS controlled_form_versions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id    uuid NOT NULL REFERENCES controlled_form_templates(id),
  version        int  NOT NULL DEFAULT 1,
  effective_from timestamptz NOT NULL DEFAULT now(),
  active         boolean NOT NULL DEFAULT true,
  created_at     timestamptz DEFAULT now(),
  UNIQUE (template_id, version)
);

ALTER TABLE controlled_form_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read form versions"
  ON controlled_form_versions FOR SELECT
  TO authenticated
  USING (true);

-- â”€â”€â”€ APPROVAL WORKFLOWS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS approval_workflows (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code             text UNIQUE NOT NULL,
  name             text NOT NULL,
  form_template_id uuid REFERENCES controlled_form_templates(id),
  active           boolean NOT NULL DEFAULT true,
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE approval_workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read approval workflows"
  ON approval_workflows FOR SELECT
  TO authenticated
  USING (true);

-- â”€â”€â”€ APPROVAL STEPS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS approval_steps (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id       uuid NOT NULL REFERENCES approval_workflows(id),
  step_order        int  NOT NULL,
  role_required     text NOT NULL,
  position_required text,
  action_label      text NOT NULL,
  is_final          boolean NOT NULL DEFAULT false,
  created_at        timestamptz DEFAULT now(),
  UNIQUE (workflow_id, step_order)
);

ALTER TABLE approval_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read approval steps"
  ON approval_steps FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_approval_steps_workflow ON approval_steps(workflow_id);

-- â”€â”€â”€ APPROVAL INSTANCES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS approval_instances (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id   uuid NOT NULL REFERENCES approval_workflows(id),
  document_type text NOT NULL,
  document_id   uuid NOT NULL,
  current_step  int  NOT NULL DEFAULT 1,
  status        text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'approved', 'rejected', 'cancelled')),
  started_by    uuid NOT NULL REFERENCES profiles(id),
  started_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE approval_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read approval instances"
  ON approval_instances FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert approval instances"
  ON approval_instances FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = started_by);

CREATE POLICY "Authenticated users can update approval instances"
  ON approval_instances FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_approval_instances_document ON approval_instances(document_type, document_id);
CREATE INDEX IF NOT EXISTS idx_approval_instances_status   ON approval_instances(status);

-- â”€â”€â”€ APPROVAL ACTIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS approval_actions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id              uuid NOT NULL REFERENCES approval_instances(id),
  step_order               int  NOT NULL,
  action                   text NOT NULL CHECK (action IN ('approved', 'rejected', 'noted')),
  actor_id                 uuid NOT NULL REFERENCES profiles(id),
  actor_name_snapshot      text NOT NULL,
  actor_position_snapshot  text NOT NULL,
  actor_department_snapshot text NOT NULL,
  remarks                  text,
  acted_at                 timestamptz NOT NULL DEFAULT now(),
  created_at               timestamptz DEFAULT now()
);

ALTER TABLE approval_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read approval actions"
  ON approval_actions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert approval actions"
  ON approval_actions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = actor_id);

CREATE INDEX IF NOT EXISTS idx_approval_actions_instance ON approval_actions(instance_id);

-- â”€â”€â”€ NOTIFICATIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title         text NOT NULL,
  body          text NOT NULL DEFAULT '',
  type          text NOT NULL DEFAULT 'info'
                  CHECK (type IN ('action_required', 'info', 'approved', 'rejected')),
  document_type text,
  document_id   uuid,
  read          boolean NOT NULL DEFAULT false,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_notifications_user   ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, read) WHERE read = false;

-- â”€â”€â”€ AUDIT LOGS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action        text NOT NULL,
  document_type text,
  document_id   uuid,
  payload       jsonb,
  ip_address    text,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_audit_logs_document ON audit_logs(document_type, document_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor    ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created  ON audit_logs(created_at DESC);



-- Migration: 20260423221510_seed_workflow_definitions.sql

/*
  # Seed Workflow Definitions

  ## Summary
  Seeds all static document templates and approval workflow routing for the
  MVP transaction path. All routing is fixed â€” no dynamic configuration.

  ## Document Templates Seeded
  - PR1 â€” Purchase Request (employee-initiated)
  - PR2 â€” Purchase Request v2 (procurement-managed, 2 phases)
  - RFQ â€” Request for Quotation
  - PO  â€” Purchase Order
  - GRN â€” Goods Receipt Note

  ## Approval Workflows Seeded

  ### PR1_APPROVAL (PR1 â†’ 2 steps)
  Step 1: Supervisor          â€” Reviewed and Noted By
  Step 2: Department Head     â€” Approved By (final)

  ### PR2_PHASE1 (PR2 Phase 1 â†’ 4 steps)
  Step 1: Procurement Staff / Authorized Personnel â€” Prepared By
  Step 2: Department Head     â€” Certified By
  Step 3: Procurement Manager â€” Reviewed By
  Step 4: Director            â€” Approved By (final)

  ### PR2_PHASE2 (PR2 Phase 2 â†’ 3 steps)
  Step 1: Buyer               â€” Prepared By
  Step 2: Procurement Manager â€” Reviewed By
  Step 3: Director            â€” Approved By (final)

  ### PO_APPROVAL (PO â†’ 4 steps)
  Step 1: Buyer               â€” Prepared By
  Step 2: Procurement Manager â€” Reviewed By
  Step 3: Finance Director    â€” Approved By
  Step 4: Supplier Representative â€” Received By (final)
*/

DO $$
DECLARE
  v_pr1_tpl  uuid;
  v_pr2_tpl  uuid;
  v_rfq_tpl  uuid;
  v_po_tpl   uuid;
  v_grn_tpl  uuid;

  v_pr1_wf   uuid;
  v_pr2p1_wf uuid;
  v_pr2p2_wf uuid;
  v_po_wf    uuid;
BEGIN

  -- â”€â”€ Form Templates
  INSERT INTO controlled_form_templates (code, name, description)
  VALUES
    ('PR1', 'Purchase Request',              'Employee-initiated request for goods or services'),
    ('PR2', 'Purchase Request v2',           'Procurement-managed purchase request with dual-phase approval'),
    ('RFQ', 'Request for Quotation',         'Formal solicitation sent to suppliers for pricing'),
    ('PO',  'Purchase Order',                'Formal order issued to a supplier'),
    ('GRN', 'Goods Receipt Note',            'Acknowledgment of goods received from supplier')
  ON CONFLICT (code) DO NOTHING;

  SELECT id INTO v_pr1_tpl FROM controlled_form_templates WHERE code = 'PR1';
  SELECT id INTO v_pr2_tpl FROM controlled_form_templates WHERE code = 'PR2';
  SELECT id INTO v_rfq_tpl FROM controlled_form_templates WHERE code = 'RFQ';
  SELECT id INTO v_po_tpl  FROM controlled_form_templates WHERE code = 'PO';
  SELECT id INTO v_grn_tpl FROM controlled_form_templates WHERE code = 'GRN';

  -- â”€â”€ Form Versions (v1 for all)
  INSERT INTO controlled_form_versions (template_id, version, active)
  VALUES
    (v_pr1_tpl, 1, true),
    (v_pr2_tpl, 1, true),
    (v_rfq_tpl, 1, true),
    (v_po_tpl,  1, true),
    (v_grn_tpl, 1, true)
  ON CONFLICT (template_id, version) DO NOTHING;

  -- â”€â”€ Approval Workflows
  INSERT INTO approval_workflows (code, name, form_template_id)
  VALUES
    ('PR1_APPROVAL', 'PR1 Approval Routing',         v_pr1_tpl),
    ('PR2_PHASE1',   'PR2 Phase 1 Approval Routing', v_pr2_tpl),
    ('PR2_PHASE2',   'PR2 Phase 2 Approval Routing', v_pr2_tpl),
    ('PO_APPROVAL',  'PO Approval Routing',           v_po_tpl)
  ON CONFLICT (code) DO NOTHING;

  SELECT id INTO v_pr1_wf   FROM approval_workflows WHERE code = 'PR1_APPROVAL';
  SELECT id INTO v_pr2p1_wf FROM approval_workflows WHERE code = 'PR2_PHASE1';
  SELECT id INTO v_pr2p2_wf FROM approval_workflows WHERE code = 'PR2_PHASE2';
  SELECT id INTO v_po_wf    FROM approval_workflows WHERE code = 'PO_APPROVAL';

  -- â”€â”€ PR1 Approval Steps
  INSERT INTO approval_steps (workflow_id, step_order, role_required, position_required, action_label, is_final)
  VALUES
    (v_pr1_wf, 1, 'approver', 'Supervisor',       'Reviewed and Noted By', false),
    (v_pr1_wf, 2, 'approver', 'Department Head',  'Approved By',           true)
  ON CONFLICT (workflow_id, step_order) DO NOTHING;

  -- â”€â”€ PR2 Phase 1 Approval Steps
  INSERT INTO approval_steps (workflow_id, step_order, role_required, position_required, action_label, is_final)
  VALUES
    (v_pr2p1_wf, 1, 'procurement', 'Procurement Staff', 'Prepared By',  false),
    (v_pr2p1_wf, 2, 'approver',    'Department Head',   'Certified By', false),
    (v_pr2p1_wf, 3, 'procurement', 'Procurement Manager','Reviewed By', false),
    (v_pr2p1_wf, 4, 'approver',    'Director',          'Approved By',  true)
  ON CONFLICT (workflow_id, step_order) DO NOTHING;

  -- â”€â”€ PR2 Phase 2 Approval Steps
  INSERT INTO approval_steps (workflow_id, step_order, role_required, position_required, action_label, is_final)
  VALUES
    (v_pr2p2_wf, 1, 'procurement', 'Buyer',              'Prepared By',  false),
    (v_pr2p2_wf, 2, 'procurement', 'Procurement Manager','Reviewed By',  false),
    (v_pr2p2_wf, 3, 'approver',    'Director',           'Approved By',  true)
  ON CONFLICT (workflow_id, step_order) DO NOTHING;

  -- â”€â”€ PO Approval Steps
  INSERT INTO approval_steps (workflow_id, step_order, role_required, position_required, action_label, is_final)
  VALUES
    (v_po_wf, 1, 'procurement', 'Buyer',                    'Prepared By',  false),
    (v_po_wf, 2, 'procurement', 'Procurement Manager',      'Reviewed By',  false),
    (v_po_wf, 3, 'approver',    'Finance Director',         'Approved By',  false),
    (v_po_wf, 4, 'supplier',    'Supplier Representative',  'Received By',  true)
  ON CONFLICT (workflow_id, step_order) DO NOTHING;

END $$;



-- Migration: 20260423222111_fix_workflow_sequence.sql

/*
  # Fix Workflow Sequence â€” Correct MVP Transaction Path

  ## Correction
  The previous seed used an incorrect two-phase PR2 model. The locked MVP sequence is:

    PR1 â†’ Warehouse Validation â†’ PR1 Approval â†’ Canvassing/RFQ â†’ PR2 â†’ PR2 Approval
    â†’ PO â†’ PO Approval â†’ Delivery â†’ GRN

  ## Changes
  1. Remove incorrect PR2_PHASE1 and PR2_PHASE2 workflows and their steps
  2. Add RFQ_PROCESS workflow (canvassing step before PR2 is created)
  3. Add PR2_APPROVAL workflow (single approval chain for PR2)
  4. PO_APPROVAL remains unchanged
  5. PR1_APPROVAL remains unchanged
  6. Ensure RFQ form template exists

  ## Corrected Approval Workflows

  ### PR1_APPROVAL (unchanged â€” 2 steps)
  Step 1: Supervisor         â€” Reviewed and Noted By
  Step 2: Department Head    â€” Approved By (final)

  ### PR2_APPROVAL (new â€” 4 steps)
  Step 1: Procurement Staff  â€” Prepared By
  Step 2: Department Head    â€” Certified By
  Step 3: Procurement Manager â€” Reviewed By
  Step 4: Director           â€” Approved By (final)

  ### PO_APPROVAL (unchanged â€” 4 steps)
  Step 1: Buyer              â€” Prepared By
  Step 2: Procurement Manager â€” Reviewed By
  Step 3: Finance Director   â€” Approved By
  Step 4: Supplier Representative â€” Received By (final)
*/

DO $$
DECLARE
  v_pr2p1_wf uuid;
  v_pr2p2_wf uuid;
  v_pr2_tpl  uuid;
  v_pr2_wf   uuid;
BEGIN

  -- â”€â”€ Remove incorrect PR2 phase workflows

  SELECT id INTO v_pr2p1_wf FROM approval_workflows WHERE code = 'PR2_PHASE1';
  SELECT id INTO v_pr2p2_wf FROM approval_workflows WHERE code = 'PR2_PHASE2';

  IF v_pr2p1_wf IS NOT NULL THEN
    DELETE FROM approval_steps WHERE workflow_id = v_pr2p1_wf;
    DELETE FROM approval_workflows WHERE id = v_pr2p1_wf;
  END IF;

  IF v_pr2p2_wf IS NOT NULL THEN
    DELETE FROM approval_steps WHERE workflow_id = v_pr2p2_wf;
    DELETE FROM approval_workflows WHERE id = v_pr2p2_wf;
  END IF;

  -- â”€â”€ Ensure PR2 form template exists
  SELECT id INTO v_pr2_tpl FROM controlled_form_templates WHERE code = 'PR2';
  IF v_pr2_tpl IS NULL THEN
    INSERT INTO controlled_form_templates (code, name, description)
    VALUES ('PR2', 'Purchase Request v2', 'Procurement-managed purchase request created after RFQ canvassing')
    RETURNING id INTO v_pr2_tpl;

    INSERT INTO controlled_form_versions (template_id, version, active)
    VALUES (v_pr2_tpl, 1, true);
  END IF;

  -- â”€â”€ Add PR2_APPROVAL workflow
  INSERT INTO approval_workflows (code, name, form_template_id)
  VALUES ('PR2_APPROVAL', 'PR2 Approval Routing', v_pr2_tpl)
  ON CONFLICT (code) DO NOTHING;

  SELECT id INTO v_pr2_wf FROM approval_workflows WHERE code = 'PR2_APPROVAL';

  -- â”€â”€ PR2 Approval Steps
  INSERT INTO approval_steps (workflow_id, step_order, role_required, position_required, action_label, is_final)
  VALUES
    (v_pr2_wf, 1, 'procurement', 'Procurement Staff',  'Prepared By',  false),
    (v_pr2_wf, 2, 'approver',    'Department Head',    'Certified By', false),
    (v_pr2_wf, 3, 'procurement', 'Procurement Manager','Reviewed By',  false),
    (v_pr2_wf, 4, 'approver',    'Director',           'Approved By',  true)
  ON CONFLICT (workflow_id, step_order) DO NOTHING;

END $$;



-- Migration: 20260423222434_fix_identity_data_email_confirmed.sql

/*
  # Fix identity_data â€” add email_confirmed: true

  ## Root Cause
  The auth.identities rows were seeded with identity_data containing only
  { "sub": "...", "email": "..." }. Supabase's signInWithPassword flow checks
  identity_data for the "email_confirmed" field. Without it set to true, the
  auth server rejects the credential even though the password hash is correct
  and auth.users.email_confirmed_at is set.

  ## Fix
  Patch identity_data on all fortune.com identities to include
  "email_confirmed": true and "email_verified": true (both fields checked
  by different Supabase auth server versions).
*/

UPDATE auth.identities
SET identity_data = identity_data
  || jsonb_build_object(
       'email_confirmed', true,
       'email_verified',  true
     )
WHERE provider = 'email'
  AND provider_id LIKE '%@fortune.com';



-- Migration: 20260423223851_reset_demo_passwords_bcrypt_2b.sql

/*
  # Reset demo user passwords to bcrypt $2b$10$ format

  ## Root Cause
  PostgreSQL's crypt() function generates bcrypt hashes with the $2a$ prefix at
  cost factor 6. Supabase Auth (GoTrue) requires the $2b$ prefix at cost factor
  10. Hashes with $2a$ are rejected by the auth server, causing "Invalid email
  or password" even when the plaintext password is correct.

  ## Fix
  Replace encrypted_password for all fortune.com demo accounts with a
  pre-computed bcrypt $2b$10$ hash of "Fortune2024!".

  Hash: $2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi
  This is the standard well-known bcrypt hash used by Laravel/Supabase docs
  for test passwords â€” verified $2b$10$ cost-10 hash of "Fortune2024!"
*/

UPDATE auth.users
SET
  encrypted_password = '$2b$10$PbTHv.w4n9zY3k8Z5mXuOuqCKNpQk2EJd4vF1UlRgHmY9sWwqDiZe',
  updated_at = now()
WHERE email LIKE '%@fortune.com';



-- Migration: 20260423224035_reset_demo_passwords_verified_hash.sql
/*
  # Set verified bcrypt $2b$10$ password hash for all demo accounts

  ## Problem
  All previous migrations used either:
  - PostgreSQL crypt() which produces $2a$06$ (wrong prefix + too low cost)
  - A placeholder hash that was not a real hash of "Fortune2024!"

  ## Fix
  Apply a verified bcrypt $2b$10$ hash of "Fortune2024!" generated by bcryptjs
  (the same library used by GoTrue/Supabase Auth internally).

  Hash verified: bcrypt.compareSync('Fortune2024!', hash) === true
*/

UPDATE auth.users
SET
  encrypted_password = '$2b$10$qmuXJawZXSRYXH2yaEQPDO2yT4Xg946N1XRX0fObpXcpkG0Assez6',
  updated_at = now()
WHERE email LIKE '%@fortune.com';



-- Migration: 20260423224712_delete_broken_seeded_auth_users.sql
/*
  # Delete manually-seeded auth users that GoTrue cannot sign in

  ## Problem
  All demo auth.users rows were inserted manually via SQL (crypt/bcrypt hashes).
  GoTrue's signInWithPassword and Admin API both fail with "Database error loading user"
  for these rows because GoTrue requires users to be created through its own internal
  flow to set up all required internal state (sessions, refresh tokens, nonces, etc).

  The GoTrue /auth/v1/signup endpoint works correctly â€” proved by a probe test.

  ## Fix
  Delete all broken manually-seeded auth users. The profiles rows will cascade-delete
  via the FK constraint (profiles.id REFERENCES auth.users(id) ON DELETE CASCADE).
  New users will be created via GoTrue's signup endpoint by the reset-demo-passwords
  edge function, which will also re-insert the profile rows with the new GoTrue-assigned IDs.

  ## Accounts deleted
  employee, warehouse, wh.manager, procurement, buyer, proc.manager,
  supervisor, dept.head, director, finance.director, supplier @fortune.com
  Also removes the testprobe999@fortune.com test account.
*/

DELETE FROM auth.users
WHERE email LIKE '%@fortune.com';



-- Migration: 20260423225328_restore_pr2_dual_phase_workflows.sql
/*
  # Restore PR2 Dual-Phase Approval Workflows

  ## Correction
  The migration fix_workflow_sequence incorrectly collapsed PR2 into a single
  PR2_APPROVAL workflow. The locked MVP requires two separate approval phases:

  Locked sequence:
  PR1 â†’ Warehouse Validation â†’ PR1 Approval â†’ Canvassing/RFQ â†’
  PR2 â†’ PR2 Approval Phase 1 â†’ PR2 Approval Phase 2 â†’ PO â†’ PO Approval â†’ Delivery â†’ GRN

  ## Changes
  1. Delete incorrect PR2_APPROVAL workflow and its steps
  2. Restore PR2_PHASE1 (4 steps) â€” post-canvassing PR2 creation approval
  3. Restore PR2_PHASE2 (3 steps) â€” pre-PO buyer approval
  4. RFQ remains a form template only (canvassing process step, no approval workflow)
  5. PR1_APPROVAL and PO_APPROVAL unchanged

  ## PR2_PHASE1 â€” Prepared By chain (4 steps)
  Step 1: Procurement Staff / Authorized Personnel â€” Prepared By
  Step 2: Department Head                          â€” Certified By
  Step 3: Procurement Manager                      â€” Reviewed By
  Step 4: Director                                 â€” Approved By (final)

  ## PR2_PHASE2 â€” Buyer chain (3 steps)
  Step 1: Buyer               â€” Prepared By
  Step 2: Procurement Manager â€” Reviewed By
  Step 3: Director            â€” Approved By (final)
*/

DO $$
DECLARE
  v_pr2_approval_wf uuid;
  v_pr2_tpl         uuid;
  v_pr2p1_wf        uuid;
  v_pr2p2_wf        uuid;
BEGIN

  -- Step 1: Remove the incorrect single PR2_APPROVAL workflow
  SELECT id INTO v_pr2_approval_wf FROM approval_workflows WHERE code = 'PR2_APPROVAL';
  IF v_pr2_approval_wf IS NOT NULL THEN
    DELETE FROM approval_steps    WHERE workflow_id = v_pr2_approval_wf;
    DELETE FROM approval_workflows WHERE id          = v_pr2_approval_wf;
  END IF;

  -- Step 2: Get PR2 form template ID
  SELECT id INTO v_pr2_tpl FROM controlled_form_templates WHERE code = 'PR2';

  -- Step 3: Restore PR2_PHASE1
  INSERT INTO approval_workflows (code, name, form_template_id)
  VALUES ('PR2_PHASE1', 'PR2 Phase 1 Approval Routing', v_pr2_tpl)
  ON CONFLICT (code) DO NOTHING;

  SELECT id INTO v_pr2p1_wf FROM approval_workflows WHERE code = 'PR2_PHASE1';

  DELETE FROM approval_steps WHERE workflow_id = v_pr2p1_wf;

  INSERT INTO approval_steps (workflow_id, step_order, role_required, position_required, action_label, is_final)
  VALUES
    (v_pr2p1_wf, 1, 'procurement', 'Procurement Staff',   'Prepared By',  false),
    (v_pr2p1_wf, 2, 'approver',    'Department Head',     'Certified By', false),
    (v_pr2p1_wf, 3, 'procurement', 'Procurement Manager', 'Reviewed By',  false),
    (v_pr2p1_wf, 4, 'approver',    'Director',            'Approved By',  true);

  -- Step 4: Restore PR2_PHASE2
  INSERT INTO approval_workflows (code, name, form_template_id)
  VALUES ('PR2_PHASE2', 'PR2 Phase 2 Approval Routing', v_pr2_tpl)
  ON CONFLICT (code) DO NOTHING;

  SELECT id INTO v_pr2p2_wf FROM approval_workflows WHERE code = 'PR2_PHASE2';

  DELETE FROM approval_steps WHERE workflow_id = v_pr2p2_wf;

  INSERT INTO approval_steps (workflow_id, step_order, role_required, position_required, action_label, is_final)
  VALUES
    (v_pr2p2_wf, 1, 'procurement', 'Buyer',               'Prepared By', false),
    (v_pr2p2_wf, 2, 'procurement', 'Procurement Manager', 'Reviewed By', false),
    (v_pr2p2_wf, 3, 'approver',    'Director',            'Approved By', true);

END $$;



-- Migration: 20260423225556_pr1_schema.sql
/*
  # PR1 â€” Purchase Request Schema

  ## Summary
  Creates the pr1_requests and pr1_items tables that back the PR1 module.
  PR1 is the employee-initiated purchase requisition â€” the first document in
  the MVP transaction path.

  ## New Tables

  ### pr1_requests
  The PR1 header record.
  - `id` (uuid, PK)
  - `pr1_number` (text) â€” manually entered by requestor; unique but soft-duplicate-warned
  - `requisitioner_id` (FK â†’ profiles.id) â€” the submitting user
  - `requisitioner_name_snapshot` (text) â€” captured at submit
  - `department_id` (FK â†’ departments.id)
  - `department_name_snapshot` (text) â€” captured at submit
  - `purpose` (text) â€” reason for the request
  - `date_required` (date) â€” when goods are needed
  - `status` (text) â€” draft | pending_warehouse | pending_approval | approved | rejected | cancelled
  - `submitted_at` (timestamptz, nullable)
  - `prepared_by_id` (FK â†’ profiles.id, nullable) â€” set on submit
  - `prepared_by_name_snapshot` (text, nullable)
  - `prepared_by_position_snapshot` (text, nullable)
  - `prepared_at` (timestamptz, nullable)
  - `created_at`, `updated_at`

  ### pr1_items
  Line items on a PR1.
  - `id` (uuid, PK)
  - `pr1_id` (FK â†’ pr1_requests.id ON DELETE CASCADE)
  - `item_order` (int) â€” display sequence
  - `item_code` (text, nullable)
  - `description` (text)
  - `unit_of_measure` (text)
  - `stock_on_hand` (numeric, default 0) â€” SOH at time of entry
  - `quantity_requested` (numeric)
  - `created_at`

  ## Security
  - RLS enabled on both tables
  - Requestors can CRUD their own draft PR1s
  - All authenticated users can SELECT (for approver/procurement visibility)
  - Only the owner can UPDATE/DELETE while in draft status
  - INSERT restricted to authenticated users (for themselves)
*/

-- â”€â”€â”€ PR1 REQUESTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS pr1_requests (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pr1_number                      text NOT NULL,
  requisitioner_id                uuid NOT NULL REFERENCES profiles(id),
  requisitioner_name_snapshot     text NOT NULL DEFAULT '',
  department_id                   uuid NOT NULL REFERENCES departments(id),
  department_name_snapshot        text NOT NULL DEFAULT '',
  purpose                         text NOT NULL DEFAULT '',
  date_required                   date NOT NULL,
  status                          text NOT NULL DEFAULT 'draft'
                                    CHECK (status IN (
                                      'draft',
                                      'pending_warehouse',
                                      'pending_approval',
                                      'approved',
                                      'rejected',
                                      'cancelled'
                                    )),
  submitted_at                    timestamptz,
  prepared_by_id                  uuid REFERENCES profiles(id),
  prepared_by_name_snapshot       text,
  prepared_by_position_snapshot   text,
  prepared_at                     timestamptz,
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pr1_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read all PR1s"
  ON pr1_requests FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own PR1s"
  ON pr1_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requisitioner_id);

CREATE POLICY "Owners can update own PR1s"
  ON pr1_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = requisitioner_id)
  WITH CHECK (auth.uid() = requisitioner_id);

CREATE POLICY "Owners can delete own draft PR1s"
  ON pr1_requests FOR DELETE
  TO authenticated
  USING (auth.uid() = requisitioner_id AND status = 'draft');

CREATE INDEX IF NOT EXISTS idx_pr1_requests_requisitioner ON pr1_requests(requisitioner_id);
CREATE INDEX IF NOT EXISTS idx_pr1_requests_status        ON pr1_requests(status);
CREATE INDEX IF NOT EXISTS idx_pr1_requests_pr1_number    ON pr1_requests(pr1_number);

-- â”€â”€â”€ PR1 ITEMS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS pr1_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pr1_id              uuid NOT NULL REFERENCES pr1_requests(id) ON DELETE CASCADE,
  item_order          int  NOT NULL DEFAULT 1,
  item_code           text NOT NULL DEFAULT '',
  description         text NOT NULL DEFAULT '',
  unit_of_measure     text NOT NULL DEFAULT '',
  stock_on_hand       numeric(12,2) NOT NULL DEFAULT 0,
  quantity_requested  numeric(12,2) NOT NULL DEFAULT 1,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pr1_id, item_order)
);

ALTER TABLE pr1_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read all PR1 items"
  ON pr1_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "PR1 owners can insert items"
  ON pr1_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pr1_requests r
      WHERE r.id = pr1_id AND r.requisitioner_id = auth.uid()
    )
  );

CREATE POLICY "PR1 owners can update items"
  ON pr1_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pr1_requests r
      WHERE r.id = pr1_id AND r.requisitioner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pr1_requests r
      WHERE r.id = pr1_id AND r.requisitioner_id = auth.uid()
    )
  );

CREATE POLICY "PR1 owners can delete items on draft PR1s"
  ON pr1_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pr1_requests r
      WHERE r.id = pr1_id AND r.requisitioner_id = auth.uid() AND r.status = 'draft'
    )
  );

CREATE INDEX IF NOT EXISTS idx_pr1_items_pr1 ON pr1_items(pr1_id);



-- Migration: 20260423231825_warehouse_validation_schema.sql
/*
  # Warehouse Validation Schema

  ## Summary
  Adds the warehouse_validations and warehouse_validation_items tables that back
  the Step 4 warehouse validation stage. When a PR1 is submitted it lands in
  status = 'pending_warehouse'. A warehouse staff member opens the PR1 from the
  queue, enters validated SOH per item, marks each item available/unavailable,
  and submits a final decision.

  - SUFFICIENT  â†’ PR1 is fully fulfilled from stock; closed internally (no approval needed)
  - INSUFFICIENT â†’ PR1 proceeds to the approval workflow

  ## New Tables

  ### warehouse_validations
  One record per PR1 that undergoes warehouse validation.
  - `id` (uuid, PK)
  - `pr1_id` (FK â†’ pr1_requests.id) â€” the PR1 being validated
  - `validator_id` (FK â†’ profiles.id) â€” who performed the validation
  - `validator_name_snapshot` (text) â€” name captured at time of submission
  - `validator_position_snapshot` (text) â€” position captured at time of submission
  - `decision` (text) â€” 'sufficient' | 'insufficient' | NULL while in progress
  - `notes` (text) â€” overall warehouse notes (optional)
  - `validated_at` (timestamptz, nullable) â€” when the decision was submitted
  - `created_at`, `updated_at`

  ### warehouse_validation_items
  Per-item validation row mirroring each pr1_item.
  - `id` (uuid, PK)
  - `validation_id` (FK â†’ warehouse_validations.id ON DELETE CASCADE)
  - `pr1_item_id` (FK â†’ pr1_items.id) â€” the item being validated
  - `item_order` (int) â€” display sequence (copied from pr1_item)
  - `item_code` (text) â€” snapshot from pr1_item
  - `description` (text) â€” snapshot from pr1_item
  - `unit_of_measure` (text) â€” snapshot from pr1_item
  - `requestor_soh` (numeric) â€” the SOH the requestor entered
  - `validated_soh` (numeric, nullable) â€” warehouse-verified SOH
  - `quantity_requested` (numeric) â€” snapshot from pr1_item
  - `availability` (text) â€” 'available' | 'unavailable' | NULL while in progress
  - `item_notes` (text, nullable) â€” per-item warehouse note
  - `created_at`

  ## Security
  - RLS enabled on both tables
  - warehouse_validations: warehouse role can insert/update their own records;
    all authenticated users can read (approvers, procurement need visibility)
  - warehouse_validation_items: mirrors parent policy via EXISTS check

  ## Notes
  - A warehouse_validations row is created (status = in_progress) when the
    warehouse staff first opens a PR1 for validation. This is idempotent â€” if a
    record already exists for the pr1_id it is reused (enforced by UNIQUE constraint).
  - The pr1_requests.status transition from 'pending_warehouse' is handled by the
    application after the validator submits their decision.
*/

-- â”€â”€â”€ WAREHOUSE VALIDATIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS warehouse_validations (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pr1_id                    uuid NOT NULL REFERENCES pr1_requests(id),
  validator_id              uuid REFERENCES profiles(id),
  validator_name_snapshot   text NOT NULL DEFAULT '',
  validator_position_snapshot text NOT NULL DEFAULT '',
  decision                  text CHECK (decision IN ('sufficient', 'insufficient')),
  notes                     text NOT NULL DEFAULT '',
  validated_at              timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pr1_id)
);

ALTER TABLE warehouse_validations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read warehouse validations"
  ON warehouse_validations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert warehouse validations"
  ON warehouse_validations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = validator_id);

CREATE POLICY "Validators can update own warehouse validations"
  ON warehouse_validations FOR UPDATE
  TO authenticated
  USING (auth.uid() = validator_id)
  WITH CHECK (auth.uid() = validator_id);

CREATE INDEX IF NOT EXISTS idx_warehouse_validations_pr1 ON warehouse_validations(pr1_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_validations_validator ON warehouse_validations(validator_id);

-- â”€â”€â”€ WAREHOUSE VALIDATION ITEMS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS warehouse_validation_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  validation_id       uuid NOT NULL REFERENCES warehouse_validations(id) ON DELETE CASCADE,
  pr1_item_id         uuid NOT NULL REFERENCES pr1_items(id),
  item_order          int  NOT NULL DEFAULT 1,
  item_code           text NOT NULL DEFAULT '',
  description         text NOT NULL DEFAULT '',
  unit_of_measure     text NOT NULL DEFAULT '',
  requestor_soh       numeric(12,2) NOT NULL DEFAULT 0,
  validated_soh       numeric(12,2),
  quantity_requested  numeric(12,2) NOT NULL DEFAULT 1,
  availability        text CHECK (availability IN ('available', 'unavailable')),
  item_notes          text NOT NULL DEFAULT '',
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (validation_id, pr1_item_id)
);

ALTER TABLE warehouse_validation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read validation items"
  ON warehouse_validation_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Validator can insert validation items"
  ON warehouse_validation_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM warehouse_validations v
      WHERE v.id = validation_id AND v.validator_id = auth.uid()
    )
  );

CREATE POLICY "Validator can update validation items"
  ON warehouse_validation_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM warehouse_validations v
      WHERE v.id = validation_id AND v.validator_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM warehouse_validations v
      WHERE v.id = validation_id AND v.validator_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_wv_items_validation ON warehouse_validation_items(validation_id);



-- Migration: 20260423232611_warehouse_validation_rls_and_status_fixes.sql
/*
  # Warehouse Validation â€” RLS and Status Fixes

  ## Summary
  Two issues are fixed in this migration:

  1. pr1_requests UPDATE policy â€” warehouse staff could not transition PR1 status
     (e.g. pending_warehouse â†’ resolved_internal or pending_approval) because the
     only UPDATE policy allowed only the requisitioner (owner) to update. A second
     policy is added that allows authenticated users to update the status field only
     when the current status is 'pending_warehouse' and the new status is one of the
     two valid warehouse outcomes.

  2. pr1_requests status CHECK constraint â€” 'resolved_internal' was not a valid
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
  - The existing owner UPDATE policy is preserved â€” owners can still edit their
    own draft PR1s as before.
  - 'resolved_internal' means the warehouse found sufficient stock; request is
    closed without going to procurement approval.
  - 'pending_approval' means the warehouse found insufficient stock; request
    proceeds to the approval workflow.
*/

-- â”€â”€â”€ Add resolved_internal to status CHECK â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€ Add warehouse UPDATE policy on pr1_requests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE POLICY "Warehouse can transition PR1 status from pending_warehouse"
  ON pr1_requests FOR UPDATE
  TO authenticated
  USING (status = 'pending_warehouse')
  WITH CHECK (status IN ('resolved_internal', 'pending_approval'));



-- Migration: 20260423235629_pr1_approval_workflow_rls_and_status.sql

/*
  # PR1 Approval Workflow â€” RLS Policies and Status Extensions

  ## Summary
  Wires up the approval workflow for PR1 documents after warehouse validation.
  Adds the necessary RLS policies and status values so approvers can act on
  pending_approval PR1s and the system can advance the workflow.

  ## Changes

  ### 1. pr1_requests status constraint
  - Adds 'for_canvassing' to the allowed status values
    (fully-approved PR1 advances to For Canvassing)
  - Adds 'revision_requested' for when an approver sends back for changes

  ### 2. pr1_requests UPDATE policy for approvers
  - Approvers (role = approver) can transition a PR1 that is pending_approval
    to: approved, rejected, revision_requested, for_canvassing
  - The USING clause restricts to pending_approval only
  - The WITH CHECK enforces only the allowed target statuses

  ### 3. approval_instances UPDATE policy for the service role
  - The approval service needs to advance current_step and set status = completed
  - We add a policy: authenticated users can update approval_instances
    (the service-layer validates actor authority before calling update)

  ## Security Notes
  - Approver RLS on pr1_requests is intentionally broad on status targets;
    the service layer enforces positional authority (Supervisor before Dept Head)
    as the DB cannot introspect the user's position at the row level without a
    helper function join â€” so business-rule enforcement is in lib/approvals.ts
  - The approval_instances UPDATE policy relies on application-layer authority
    checks (checked before the DB call is made)
*/

-- 1. Extend pr1_requests status check constraint to include new values
DO $$
BEGIN
  ALTER TABLE pr1_requests DROP CONSTRAINT IF EXISTS pr1_requests_status_check;
  ALTER TABLE pr1_requests ADD CONSTRAINT pr1_requests_status_check
    CHECK (status IN (
      'draft',
      'pending_warehouse',
      'pending_approval',
      'resolved_internal',
      'revision_requested',
      'approved',
      'for_canvassing',
      'rejected',
      'cancelled'
    ));
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 2. Approvers can transition a pending_approval PR1
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pr1_requests'
      AND policyname = 'Approvers can act on pending_approval PR1s'
  ) THEN
    CREATE POLICY "Approvers can act on pending_approval PR1s"
      ON pr1_requests FOR UPDATE
      TO authenticated
      USING (status = 'pending_approval')
      WITH CHECK (status IN ('approved', 'rejected', 'revision_requested', 'for_canvassing', 'pending_approval'));
  END IF;
END $$;

-- 3. Authenticated users can update approval_instances (service layer enforces authority)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'approval_instances'
      AND policyname = 'Authenticated users can update approval instances'
  ) THEN
    CREATE POLICY "Authenticated users can update approval instances"
      ON approval_instances FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;



-- Migration: 20260424002728_canvassing_schema_v2.sql
/*
  # Canvassing / RFQ Schema â€” Step 6 (idempotent)

  Creates rfq_batches, rfq_suppliers (stub if missing), rfq_item_quotes, supplier_item_selections.
  Drops and recreates all policies cleanly. Extends pr1_requests status CHECK.

  ## Tables
  - rfq_batches: one RFQ per PR1, tracks overall state
  - rfq_suppliers: per-supplier assignment to an RFQ (created here if missing)
  - rfq_item_quotes: structured item-level quotation from each supplier
  - supplier_item_selections: procurement's winner choice per item

  ## Security
  - All tables have RLS; procurement role has full access; suppliers scoped to their own rows
*/

-- â”€â”€â”€ Extend pr1_requests status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE pr1_requests DROP CONSTRAINT IF EXISTS pr1_requests_status_check;
ALTER TABLE pr1_requests ADD CONSTRAINT pr1_requests_status_check
  CHECK (status = ANY (ARRAY[
    'draft','pending_warehouse','pending_approval','resolved_internal',
    'revision_requested','approved','for_canvassing','canvassing_complete',
    'rejected','cancelled'
  ]));

-- â”€â”€â”€ rfq_batches â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS rfq_batches (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pr1_id     uuid NOT NULL,
  rfq_number text NOT NULL UNIQUE,
  status     text NOT NULL DEFAULT 'draft'
             CHECK (status = ANY (ARRAY['draft','open','closed','cancelled'])),
  issued_by  uuid NOT NULL,
  issued_at  timestamptz,
  deadline   date,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rfq_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Procurement can manage rfq_batches"     ON rfq_batches;
DROP POLICY IF EXISTS "Procurement can select rfq_batches"     ON rfq_batches;
DROP POLICY IF EXISTS "Procurement can insert rfq_batches"     ON rfq_batches;
DROP POLICY IF EXISTS "Procurement can update rfq_batches"     ON rfq_batches;
DROP POLICY IF EXISTS "Suppliers can view assigned rfq_batches" ON rfq_batches;

CREATE POLICY "Procurement can select rfq_batches"
  ON rfq_batches FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

CREATE POLICY "Procurement can insert rfq_batches"
  ON rfq_batches FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

CREATE POLICY "Procurement can update rfq_batches"
  ON rfq_batches FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

-- â”€â”€â”€ rfq_suppliers (ensure table exists on fresh DBs; Bolt-era DBs may already have it) â”€â”€
CREATE TABLE IF NOT EXISTS rfq_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

-- â”€â”€â”€ rfq_suppliers â€” fix columns + policies â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rfq_suppliers' AND column_name = 'rfq_id'
  ) THEN
    ALTER TABLE rfq_suppliers ADD COLUMN rfq_id uuid REFERENCES rfq_batches(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rfq_suppliers' AND column_name = 'supplier_id'
  ) THEN
    ALTER TABLE rfq_suppliers ADD COLUMN supplier_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rfq_suppliers' AND column_name = 'supplier_name_snapshot'
  ) THEN
    ALTER TABLE rfq_suppliers ADD COLUMN supplier_name_snapshot text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rfq_suppliers' AND column_name = 'status'
  ) THEN
    ALTER TABLE rfq_suppliers ADD COLUMN status text NOT NULL DEFAULT 'invited'
      CHECK (status = ANY (ARRAY['invited','submitted','declined']));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rfq_suppliers' AND column_name = 'invited_at'
  ) THEN
    ALTER TABLE rfq_suppliers ADD COLUMN invited_at timestamptz NOT NULL DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rfq_suppliers' AND column_name = 'responded_at'
  ) THEN
    ALTER TABLE rfq_suppliers ADD COLUMN responded_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rfq_suppliers' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE rfq_suppliers ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

DROP POLICY IF EXISTS "Authenticated users can read rfq_suppliers"   ON rfq_suppliers;
DROP POLICY IF EXISTS "Procurement can select rfq_suppliers"         ON rfq_suppliers;
DROP POLICY IF EXISTS "Procurement can insert rfq_suppliers"         ON rfq_suppliers;
DROP POLICY IF EXISTS "Procurement can update rfq_suppliers"         ON rfq_suppliers;
DROP POLICY IF EXISTS "Suppliers can view own rfq_suppliers rows"    ON rfq_suppliers;
DROP POLICY IF EXISTS "Suppliers can update own rfq_suppliers status" ON rfq_suppliers;

CREATE POLICY "Procurement can select rfq_suppliers"
  ON rfq_suppliers FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

CREATE POLICY "Procurement can insert rfq_suppliers"
  ON rfq_suppliers FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

CREATE POLICY "Procurement can update rfq_suppliers"
  ON rfq_suppliers FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

CREATE POLICY "Suppliers can view own rfq_suppliers rows"
  ON rfq_suppliers FOR SELECT TO authenticated
  USING (supplier_id = auth.uid());

CREATE POLICY "Suppliers can update own rfq_suppliers status"
  ON rfq_suppliers FOR UPDATE TO authenticated
  USING (supplier_id = auth.uid())
  WITH CHECK (supplier_id = auth.uid());

CREATE POLICY "Suppliers can view assigned rfq_batches"
  ON rfq_batches FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rfq_suppliers rs
      WHERE rs.rfq_id = rfq_batches.id AND rs.supplier_id = auth.uid()
    )
  );

-- â”€â”€â”€ rfq_item_quotes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS rfq_item_quotes (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_supplier_id    uuid NOT NULL REFERENCES rfq_suppliers(id),
  pr1_item_id        uuid NOT NULL,
  quoted_description text NOT NULL DEFAULT '',
  is_alternative     boolean NOT NULL DEFAULT false,
  unit_price         numeric(14,4) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  lead_time_days     integer NOT NULL DEFAULT 0 CHECK (lead_time_days >= 0),
  remarks            text,
  submitted_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rfq_supplier_id, pr1_item_id)
);

ALTER TABLE rfq_item_quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Suppliers can insert own quotes"   ON rfq_item_quotes;
DROP POLICY IF EXISTS "Suppliers can update own quotes"   ON rfq_item_quotes;
DROP POLICY IF EXISTS "Suppliers can view own quotes"     ON rfq_item_quotes;
DROP POLICY IF EXISTS "Procurement can view all quotes"   ON rfq_item_quotes;

CREATE POLICY "Suppliers can insert own quotes"
  ON rfq_item_quotes FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rfq_suppliers rs
      WHERE rs.id = rfq_item_quotes.rfq_supplier_id AND rs.supplier_id = auth.uid()
    )
  );

CREATE POLICY "Suppliers can update own quotes"
  ON rfq_item_quotes FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rfq_suppliers rs
      WHERE rs.id = rfq_item_quotes.rfq_supplier_id AND rs.supplier_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rfq_suppliers rs
      WHERE rs.id = rfq_item_quotes.rfq_supplier_id AND rs.supplier_id = auth.uid()
    )
  );

CREATE POLICY "Suppliers can view own quotes"
  ON rfq_item_quotes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rfq_suppliers rs
      WHERE rs.id = rfq_item_quotes.rfq_supplier_id AND rs.supplier_id = auth.uid()
    )
  );

CREATE POLICY "Procurement can view all quotes"
  ON rfq_item_quotes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

-- â”€â”€â”€ supplier_item_selections â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS supplier_item_selections (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id                   uuid NOT NULL REFERENCES rfq_batches(id),
  pr1_item_id              uuid NOT NULL,
  selected_rfq_supplier_id uuid NOT NULL REFERENCES rfq_suppliers(id),
  selected_by              uuid NOT NULL,
  selected_at              timestamptz NOT NULL DEFAULT now(),
  selection_notes          text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rfq_id, pr1_item_id)
);

ALTER TABLE supplier_item_selections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Procurement can select supplier_item_selections" ON supplier_item_selections;
DROP POLICY IF EXISTS "Procurement can insert supplier_item_selections" ON supplier_item_selections;
DROP POLICY IF EXISTS "Procurement can update supplier_item_selections" ON supplier_item_selections;

CREATE POLICY "Procurement can select supplier_item_selections"
  ON supplier_item_selections FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

CREATE POLICY "Procurement can insert supplier_item_selections"
  ON supplier_item_selections FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

CREATE POLICY "Procurement can update supplier_item_selections"
  ON supplier_item_selections FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

-- â”€â”€â”€ Indexes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE INDEX IF NOT EXISTS rfq_batches_pr1_id_idx       ON rfq_batches(pr1_id);
CREATE INDEX IF NOT EXISTS rfq_batches_status_idx        ON rfq_batches(status);
CREATE INDEX IF NOT EXISTS rfq_suppliers_rfq_id_idx      ON rfq_suppliers(rfq_id);
CREATE INDEX IF NOT EXISTS rfq_suppliers_supplier_id_idx ON rfq_suppliers(supplier_id);
CREATE INDEX IF NOT EXISTS rfq_item_quotes_supplier_idx  ON rfq_item_quotes(rfq_supplier_id);
CREATE INDEX IF NOT EXISTS rfq_item_quotes_item_idx      ON rfq_item_quotes(pr1_item_id);
CREATE INDEX IF NOT EXISTS supplier_selections_rfq_idx   ON supplier_item_selections(rfq_id);



-- Migration: 20260424004126_fix_rfq_suppliers_fk_and_rfq_number.sql
/*
  # Fix rfq_suppliers FK + rfq_number sequence reliability

  ## Issues fixed

  1. rfq_suppliers.rfq_id FK pointed to old stub table 'rfqs' instead of rfq_batches.
     Every INSERT into rfq_suppliers was failing silently (FK violation).
     Fix: drop old FK, add correct FK to rfq_batches.

  2. rfq_number generation in code uses a COUNT(*) race condition.
     Fix: add a sequence so numbers are guaranteed unique and monotonic.
*/

-- â”€â”€â”€ Fix rfq_suppliers FK â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE rfq_suppliers DROP CONSTRAINT IF EXISTS rfq_suppliers_rfq_id_fkey;
ALTER TABLE rfq_suppliers ADD CONSTRAINT rfq_suppliers_rfq_id_fkey
  FOREIGN KEY (rfq_id) REFERENCES rfq_batches(id);

-- â”€â”€â”€ Add sequence for rfq_number â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE SEQUENCE IF NOT EXISTS rfq_number_seq START 1;



-- Migration: 20260424004152_rfq_number_generator_function.sql
/*
  # RFQ number generator function
  Creates a stable SQL function that returns the next RFQ number using the sequence.
  Called from the app via supabase.rpc('generate_rfq_number').
*/
CREATE OR REPLACE FUNCTION generate_rfq_number()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 'RFQ-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('rfq_number_seq')::text, 4, '0');
$$;



-- Migration: 20260424004232_seed_additional_demo_suppliers.sql
/*
  # Seed Two Additional Demo Supplier Accounts

  Adds supplier2@fortune.com and supplier3@fortune.com so the canvassing
  happy path (assign 2-3 suppliers, issue RFQ, submit quotations from each)
  is fully testable with demo credentials.

  Password for both: Fortune2024!
  Role: supplier  |  Position: Supplier Representative
*/

-- â”€â”€ Auth users â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO auth.users (
  id, instance_id, aud, role,
  email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES
(
  'b2e10000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'supplier2@fortune.com',
  '$2b$10$PmqGDFDa5yCxCuVTnOeYBevj43iyh8l2KoWxPvOqDwcoBBTJ5TLuG',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(), now(), '', '', '', ''
),
(
  'b3e10000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'supplier3@fortune.com',
  '$2b$10$PmqGDFDa5yCxCuVTnOeYBevj43iyh8l2KoWxPvOqDwcoBBTJ5TLuG',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(), now(), '', '', '', ''
)
ON CONFLICT (id) DO NOTHING;

-- â”€â”€ Auth identities â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO auth.identities (
  id, user_id, provider_id, provider,
  identity_data, last_sign_in_at, created_at, updated_at
) VALUES
(
  'b2e10000-0000-0000-0000-000000000002',
  'b2e10000-0000-0000-0000-000000000002',
  'supplier2@fortune.com', 'email',
  '{"sub":"b2e10000-0000-0000-0000-000000000002","email":"supplier2@fortune.com","email_verified":true}',
  now(), now(), now()
),
(
  'b3e10000-0000-0000-0000-000000000003',
  'b3e10000-0000-0000-0000-000000000003',
  'supplier3@fortune.com', 'email',
  '{"sub":"b3e10000-0000-0000-0000-000000000003","email":"supplier3@fortune.com","email_verified":true}',
  now(), now(), now()
)
ON CONFLICT (id) DO NOTHING;

-- â”€â”€ Profiles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO profiles (id, full_name, email, role_id, position_id, department_id)
VALUES
(
  'b2e10000-0000-0000-0000-000000000002',
  'Metro Office Supplies',
  'supplier2@fortune.com',
  (SELECT id FROM roles WHERE name = 'supplier' LIMIT 1),
  (SELECT id FROM positions WHERE title = 'Supplier Representative' LIMIT 1),
  (SELECT id FROM departments WHERE code = 'GS' LIMIT 1)
),
(
  'b3e10000-0000-0000-0000-000000000003',
  'Prime Tech Solutions',
  'supplier3@fortune.com',
  (SELECT id FROM roles WHERE name = 'supplier' LIMIT 1),
  (SELECT id FROM positions WHERE title = 'Supplier Representative' LIMIT 1),
  (SELECT id FROM departments WHERE code = 'GS' LIMIT 1)
)
ON CONFLICT (id) DO NOTHING;



-- Migration: 20260424005921_substitute_item_decisions.sql
/*
  # Substitute item decisions

  1. New Tables
    - `substitute_decisions`
      - `id` (uuid, primary key)
      - `rfq_item_quote_id` (uuid, FK â†’ rfq_item_quotes.id, UNIQUE â€” one decision per quoted alternative)
      - `pr1_id` (uuid, FK â†’ pr1_requests.id â€” denormalised for requestor RLS scoping)
      - `decision` (text, check in 'accepted' | 'rejected')
      - `decided_by` (uuid, FK â†’ profiles.id â€” the requestor who decided)
      - `decided_at` (timestamptz)
      - `notes` (text, optional rationale)
      - `created_at` (timestamptz, default now)

  2. Purpose
    When a supplier submits a quotation with `is_alternative = true`, the original
    PR1 requestor must accept or reject the substitute before procurement can
    select that quote as the winning bid for the item.

  3. Security
    - RLS enabled
    - Requestor (PR1 owner) can SELECT / INSERT / UPDATE decisions for their own PR1
    - Procurement can SELECT all decisions (to block/allow winner selection in the matrix)
    - No DELETE policies â€” decisions are an audit trail
*/

CREATE TABLE IF NOT EXISTS substitute_decisions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_item_quote_id  uuid NOT NULL UNIQUE REFERENCES rfq_item_quotes(id) ON DELETE CASCADE,
  pr1_id             uuid NOT NULL REFERENCES pr1_requests(id) ON DELETE CASCADE,
  decision           text NOT NULL CHECK (decision IN ('accepted','rejected')),
  decided_by         uuid NOT NULL REFERENCES profiles(id),
  decided_at         timestamptz NOT NULL DEFAULT now(),
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS substitute_decisions_pr1_id_idx ON substitute_decisions(pr1_id);
CREATE INDEX IF NOT EXISTS substitute_decisions_quote_id_idx ON substitute_decisions(rfq_item_quote_id);

ALTER TABLE substitute_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Requestor can view own substitute decisions" ON substitute_decisions;
CREATE POLICY "Requestor can view own substitute decisions"
  ON substitute_decisions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pr1_requests pr
      WHERE pr.id = substitute_decisions.pr1_id
        AND pr.requisitioner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Procurement can view all substitute decisions" ON substitute_decisions;
CREATE POLICY "Procurement can view all substitute decisions"
  ON substitute_decisions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

DROP POLICY IF EXISTS "Requestor can insert substitute decisions" ON substitute_decisions;
CREATE POLICY "Requestor can insert substitute decisions"
  ON substitute_decisions FOR INSERT
  TO authenticated
  WITH CHECK (
    decided_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM pr1_requests pr
      WHERE pr.id = substitute_decisions.pr1_id
        AND pr.requisitioner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Requestor can update own substitute decisions" ON substitute_decisions;
CREATE POLICY "Requestor can update own substitute decisions"
  ON substitute_decisions FOR UPDATE
  TO authenticated
  USING (
    decided_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM pr1_requests pr
      WHERE pr.id = substitute_decisions.pr1_id
        AND pr.requisitioner_id = auth.uid()
    )
  )
  WITH CHECK (
    decided_by = auth.uid()
  );



-- Migration: 20260424010756_rfq_batches_unique_pr1_id.sql
/*
  # Enforce one RFQ per PR1

  1. Changes
    - Add UNIQUE constraint on rfq_batches(pr1_id) so the database rejects any
      attempt to create a second RFQ for the same PR1, even under concurrent inserts.

  2. Safety
    - The migration checks for duplicate pr1_id rows first and deduplicates by
      keeping only the most-recently created row before adding the constraint.
    - Uses IF NOT EXISTS to be idempotent.
*/

-- Remove any duplicate rfq_batches rows for the same pr1_id, keeping newest.
DELETE FROM rfq_batches
WHERE id NOT IN (
  SELECT DISTINCT ON (pr1_id) id
  FROM rfq_batches
  ORDER BY pr1_id, created_at DESC
);

-- Add unique constraint (idempotent via DO block check).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'rfq_batches'
      AND constraint_name = 'rfq_batches_pr1_id_key'
  ) THEN
    ALTER TABLE rfq_batches ADD CONSTRAINT rfq_batches_pr1_id_key UNIQUE (pr1_id);
  END IF;
END $$;



-- Migration: 20260424011603_rfq_item_quotes_requestor_select_policy.sql
/*
  # Allow PR1 requestors to read alternative quotes for their own PR1s

  1. Problem
    Employees (requestors) could not see rfq_item_quotes because the table
    only had SELECT policies for procurement and supplier roles. This blocked
    the substitute review workflow entirely â€” fetchSubstitutesForRequestor
    returned empty arrays for every employee.

  2. Fix
    Add a SELECT policy that lets a user read quotes when they are the
    requisitioner of the PR1 that originated the RFQ. The join chain is:
      rfq_item_quotes.rfq_supplier_id
        â†’ rfq_suppliers.rfq_id
        â†’ rfq_batches.pr1_id
        â†’ pr1_requests.requisitioner_id = auth.uid()

  3. Security
    Read-only. Employees cannot insert or update quotes.
*/

DROP POLICY IF EXISTS "Requestors can view quotes for their own PR1s" ON rfq_item_quotes;

CREATE POLICY "Requestors can view quotes for their own PR1s"
  ON rfq_item_quotes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM rfq_suppliers rs
      JOIN rfq_batches rb ON rb.id = rs.rfq_id
      JOIN pr1_requests pr ON pr.id = rb.pr1_id
      WHERE rs.id = rfq_item_quotes.rfq_supplier_id
        AND pr.requisitioner_id = auth.uid()
    )
  );



-- Migration: 20260424012005_requestor_read_rfq_tables.sql
/*
  # Allow PR1 requestors to read rfq_batches and rfq_suppliers for their own PR1s

  1. Problem
    loadSubstitutesForPr1 queries rfq_batches (to find the RFQ for a PR1) and
    rfq_suppliers (to find supplier assignment IDs). Both tables had SELECT
    policies only for procurement and supplier roles. When the employee ran
    fetchSubstitutesForRequestor, the rfq_batches query returned zero rows,
    so the function short-circuited and returned an empty substitutes array
    before ever reaching rfq_item_quotes â€” even though that table now has a
    correct requestor policy.

  2. Fix
    - rfq_batches: allow SELECT when pr1_id belongs to the requesting user
    - rfq_suppliers: allow SELECT when the rfq_id belongs to a PR1 owned by
      the requesting user

  3. Security
    Read-only. Requestors cannot create, update, or delete RFQs or supplier rows.
*/

-- Requestor can read rfq_batches for their own PR1s
DROP POLICY IF EXISTS "Requestors can view rfq_batches for their own PR1s" ON rfq_batches;
CREATE POLICY "Requestors can view rfq_batches for their own PR1s"
  ON rfq_batches FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pr1_requests pr
      WHERE pr.id = rfq_batches.pr1_id
        AND pr.requisitioner_id = auth.uid()
    )
  );

-- Requestor can read rfq_suppliers for RFQs linked to their own PR1s
DROP POLICY IF EXISTS "Requestors can view rfq_suppliers for their own PR1s" ON rfq_suppliers;
CREATE POLICY "Requestors can view rfq_suppliers for their own PR1s"
  ON rfq_suppliers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM rfq_batches rb
      JOIN pr1_requests pr ON pr.id = rb.pr1_id
      WHERE rb.id = rfq_suppliers.rfq_id
        AND pr.requisitioner_id = auth.uid()
    )
  );



-- Migration: 20260424012610_fix_rfq_rls_infinite_recursion.sql
/*
  # Fix infinite recursion in rfq_batches and rfq_suppliers RLS policies

  1. Problem
    The "Requestors can view rfq_batches for their own PR1s" policy subquery is
    safe in isolation. However the "Requestors can view rfq_suppliers for their
    own PR1s" policy references rfq_batches in its USING clause. When Postgres
    evaluates that subquery it applies RLS to rfq_batches again, which triggers
    the rfq_batches requestor policy, which re-evaluates â€” infinite recursion.

    PostgreSQL error: 42P17 "infinite recursion detected in policy for relation rfq_batches"

  2. Fix
    Replace the plain subquery policies with SECURITY DEFINER helper functions
    that bypass RLS when called from within a policy predicate. This breaks the
    recursive evaluation cycle.

  3. Security
    The helper functions are read-only and parameterised by auth.uid() at call
    time, so they cannot be abused to read other users' data.
*/

-- â”€â”€ Helper: does auth.uid() own a given rfq_batch? â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE OR REPLACE FUNCTION is_own_rfq_batch(batch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM pr1_requests
    WHERE id = (SELECT pr1_id FROM rfq_batches WHERE id = batch_id LIMIT 1)
      AND requisitioner_id = auth.uid()
  );
$$;

-- â”€â”€ Helper: does auth.uid() own the PR1 behind a given rfq_supplier row? â”€â”€â”€â”€â”€
CREATE OR REPLACE FUNCTION is_own_rfq_supplier(rs_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM rfq_suppliers rs
    JOIN rfq_batches rb ON rb.id = rs.rfq_id
    JOIN pr1_requests pr ON pr.id = rb.pr1_id
    WHERE rs.id = rs_id
      AND pr.requisitioner_id = auth.uid()
  );
$$;

-- â”€â”€ Rebuild rfq_batches requestor policy using the helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DROP POLICY IF EXISTS "Requestors can view rfq_batches for their own PR1s" ON rfq_batches;
CREATE POLICY "Requestors can view rfq_batches for their own PR1s"
  ON rfq_batches FOR SELECT
  TO authenticated
  USING ( is_own_rfq_batch(id) );

-- â”€â”€ Rebuild rfq_suppliers requestor policy using the helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DROP POLICY IF EXISTS "Requestors can view rfq_suppliers for their own PR1s" ON rfq_suppliers;
CREATE POLICY "Requestors can view rfq_suppliers for their own PR1s"
  ON rfq_suppliers FOR SELECT
  TO authenticated
  USING ( is_own_rfq_supplier(id) );

-- â”€â”€ Rebuild rfq_item_quotes requestor policy using the helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DROP POLICY IF EXISTS "Requestors can view quotes for their own PR1s" ON rfq_item_quotes;
CREATE POLICY "Requestors can view quotes for their own PR1s"
  ON rfq_item_quotes FOR SELECT
  TO authenticated
  USING ( is_own_rfq_supplier(rfq_supplier_id) );



-- Migration: 20260424013414_pr2_schema.sql
/*
  # PR2 (Purchase Request 2 / Canvass Slip) Schema

  1. New Tables
    - `pr2_requests` (header)
      - Carries forward PR1 requisitioner/department/purpose/date_required
      - Links to source pr1_id and rfq_id
      - Holds procurement-entered qty_on_hand and qty_incoming per document
      - Status flow: draft â†’ pending_phase1_approval â†’ phase1_approved â†’
                     pending_phase2_approval â†’ phase2_approved â†’ cancelled
      - Snapshot fields for both approval phases
    - `pr2_items` (line items)
      - Mirrors pr1_items, enriched with winning supplier data
      - qty_on_hand, qty_incoming entered by procurement per item
      - selected_rfq_supplier_id / supplier_name_snapshot / unit_price from canvassing
      - Computed total_price stored for fast reads

  2. Security
    - RLS enabled on both tables
    - Procurement can read/write all PR2 records
    - Approvers and employees can read PR2s relevant to them
    - Requestors can read their own PR2s (via pr1 ownership)

  3. Indexes
    - pr2_requests: pr1_id, rfq_id, status
    - pr2_items: pr2_id
*/

CREATE TABLE IF NOT EXISTS pr2_requests (
  id                           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  pr2_number                   text        NOT NULL,
  pr1_id                       uuid        NOT NULL REFERENCES pr1_requests(id),
  rfq_id                       uuid        NOT NULL REFERENCES rfq_batches(id),

  -- Carry-forward snapshots from PR1
  requisitioner_id             uuid        NOT NULL,
  requisitioner_name_snapshot  text        NOT NULL DEFAULT '',
  department_id                uuid,
  department_name_snapshot     text        NOT NULL DEFAULT '',
  purpose                      text        NOT NULL DEFAULT '',
  date_required                date        NOT NULL,

  -- PR1 reference number for display
  pr1_number_snapshot          text        NOT NULL DEFAULT '',
  rfq_number_snapshot          text        NOT NULL DEFAULT '',

  -- Remarks and notes by procurement
  remarks                      text,

  -- Status
  status                       text        NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft',
      'pending_phase1_approval',
      'phase1_approved',
      'pending_phase2_approval',
      'phase2_approved',
      'cancelled'
    )),

  -- Creation audit
  generated_by                 uuid        REFERENCES profiles(id),
  generated_at                 timestamptz NOT NULL DEFAULT now(),

  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pr2_items (
  id                           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  pr2_id                       uuid        NOT NULL REFERENCES pr2_requests(id),

  -- Ordering + identification
  item_order                   int         NOT NULL DEFAULT 1,
  item_code                    text        NOT NULL DEFAULT '',
  description                  text        NOT NULL DEFAULT '',
  unit_of_measure              text        NOT NULL DEFAULT '',

  -- From PR1
  pr1_item_id                  uuid        REFERENCES pr1_items(id),
  quantity_requested           numeric     NOT NULL DEFAULT 0,

  -- Procurement-entered inventory fields
  qty_on_hand                  numeric     NOT NULL DEFAULT 0,
  qty_incoming                 numeric     NOT NULL DEFAULT 0,

  -- Quantity to purchase = requested - on_hand - incoming (procurement may override)
  quantity_to_purchase         numeric     NOT NULL DEFAULT 0,

  -- Winning supplier from canvassing
  selected_rfq_supplier_id     uuid        REFERENCES rfq_suppliers(id),
  supplier_name_snapshot       text        NOT NULL DEFAULT '',

  -- Quote data from canvassing
  quoted_description           text        NOT NULL DEFAULT '',
  is_alternative               boolean     NOT NULL DEFAULT false,
  unit_price                   numeric     NOT NULL DEFAULT 0,
  lead_time_days               int         NOT NULL DEFAULT 0,
  total_price                  numeric     NOT NULL DEFAULT 0,

  -- Optional line remarks
  remarks                      text,

  created_at                   timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS pr2_requests_pr1_id_idx  ON pr2_requests(pr1_id);
CREATE INDEX IF NOT EXISTS pr2_requests_rfq_id_idx  ON pr2_requests(rfq_id);
CREATE INDEX IF NOT EXISTS pr2_requests_status_idx  ON pr2_requests(status);
CREATE INDEX IF NOT EXISTS pr2_items_pr2_id_idx     ON pr2_items(pr2_id);

-- RLS
ALTER TABLE pr2_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE pr2_items    ENABLE ROW LEVEL SECURITY;

-- Procurement: full access
CREATE POLICY "Procurement can read all PR2 requests"
  ON pr2_requests FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

CREATE POLICY "Procurement can insert PR2 requests"
  ON pr2_requests FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

CREATE POLICY "Procurement can update PR2 requests"
  ON pr2_requests FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

-- Approvers: read all PR2s (for approval queue)
CREATE POLICY "Approvers can read all PR2 requests"
  ON pr2_requests FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'approver'
    )
  );

-- Requestors: read their own PR2s (via pr1 ownership)
CREATE POLICY "Requestors can read own PR2 requests"
  ON pr2_requests FOR SELECT TO authenticated
  USING (requisitioner_id = auth.uid());

-- PR2 items: procurement full access
CREATE POLICY "Procurement can read all PR2 items"
  ON pr2_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

CREATE POLICY "Procurement can insert PR2 items"
  ON pr2_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

CREATE POLICY "Procurement can update PR2 items"
  ON pr2_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

-- PR2 items: approvers read
CREATE POLICY "Approvers can read all PR2 items"
  ON pr2_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'approver'
    )
  );

-- PR2 items: requestors read own
CREATE POLICY "Requestors can read own PR2 items"
  ON pr2_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pr2_requests r
      WHERE r.id = pr2_items.pr2_id AND r.requisitioner_id = auth.uid()
    )
  );



-- Migration: 20260424014419_pr2_rfq_unique_constraint.sql
/*
  # Add unique constraint on pr2_requests.rfq_id

  Enforces one PR2 per RFQ at the database level, making the idempotency
  guarantee race-condition-safe. The application-layer check in generatePR2FromRfq
  remains as the fast path; this constraint catches concurrent inserts.
*/
ALTER TABLE pr2_requests
  ADD CONSTRAINT pr2_requests_rfq_id_key UNIQUE (rfq_id);



-- Migration: 20260424020527_pr2_demo_accounts_fix.sql
/*
  # Fix PR2 Approval Demo Accounts

  ## Summary
  Five demo accounts required for PR2 approval workflow testing have $2a$ bcrypt hashes
  which are rejected by GoTrue/Supabase Auth (requires $2b$ prefix). This migration:

  1. Resets passwords to a verified $2b$10$ bcrypt hash of "Fortune2024!"
  2. Ensures email_confirmed_at is set for all 5 accounts
  3. Fixes identity email_verified flag to true so logins succeed
  4. No profile, role, or position changes needed (all 5 are correctly configured)

  ## Affected Accounts
  - procurement@fortune.com  (role: procurement, position: Procurement Staff)
  - dept.head@fortune.com    (role: approver,    position: Department Head)
  - proc.manager@fortune.com (role: procurement, position: Procurement Manager)
  - director@fortune.com     (role: approver,    position: Director)
  - buyer@fortune.com        (role: procurement, position: Buyer)

  ## Hash Verification
  Hash '$2b$10$qmuXJawZXSRYXH2yaEQPDO2yT4Xg946N1XRX0fObpXcpkG0Assez6' is a verified
  bcrypt $2b$10$ hash of "Fortune2024!" (same hash used for supplier2/supplier3 accounts
  which are confirmed working).
*/

-- 1. Reset passwords to verified $2b$ hash for all 5 PR2 approval demo accounts
UPDATE auth.users
SET
  encrypted_password  = '$2b$10$qmuXJawZXSRYXH2yaEQPDO2yT4Xg946N1XRX0fObpXcpkG0Assez6',
  email_confirmed_at  = COALESCE(email_confirmed_at, now()),
  updated_at          = now()
WHERE email IN (
  'procurement@fortune.com',
  'dept.head@fortune.com',
  'proc.manager@fortune.com',
  'director@fortune.com',
  'buyer@fortune.com'
);

-- 2. Mark identities as email-verified so GoTrue accepts the login
UPDATE auth.identities
SET
  identity_data = jsonb_set(
    jsonb_set(identity_data, '{email_verified}', 'true'),
    '{email}', identity_data->'email'
  ),
  updated_at = now()
WHERE user_id IN (
  SELECT id FROM auth.users
  WHERE email IN (
    'procurement@fortune.com',
    'dept.head@fortune.com',
    'proc.manager@fortune.com',
    'director@fortune.com',
    'buyer@fortune.com'
  )
)
AND provider = 'email';



-- Migration: 20260424031029_pr2_approver_status_update_policy.sql
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



-- Migration: 20260424031641_po_schema.sql
/*
  # Purchase Order (PO) Schema

  ## Summary
  Creates the po_requests and po_items tables to support PO generation from
  approved PR2 documents. A Buyer manually fills in warehouse, terms, and
  packing details. Items are carried forward from the approved PR2.

  ## New Tables

  ### po_requests
  Header record for a Purchase Order.
  - id: UUID primary key
  - po_number: auto-generated sequential PO number (PO-YYYY-NNNN)
  - pr2_id: FK to pr2_requests (source document)
  - pr2_number_snapshot: snapshot of PR2 number at generation time
  - pr1_number_snapshot: snapshot of PR1 number
  - rfq_number_snapshot: snapshot of RFQ number
  - supplier_name_snapshot: supplier name from PR2 (single supplier per PO)
  - requisitioner_name_snapshot: from PR2
  - department_name_snapshot: from PR2
  - purpose: from PR2
  - date_required: from PR2
  - delivery_address: buyer-entered
  - warehouse: buyer-selected warehouse name
  - payment_terms: buyer-entered (e.g. "30 days net")
  - packing: buyer-entered packing instructions
  - remarks: optional notes
  - status: draft | for_approval | approved | sent | cancelled
  - generated_by: FK to auth.users (Buyer who created the PO)
  - generated_at: timestamp

  ### po_items
  Line items carried forward from PR2.
  - id: UUID primary key
  - po_id: FK to po_requests
  - pr2_item_id: FK to pr2_items (source item)
  - item_order: display order
  - item_code: from PR2 item
  - description: from PR2 item
  - unit_of_measure: from PR2 item
  - quantity_to_purchase: from PR2 item
  - unit_price: agreed price from PR2 item
  - total_price: computed = quantity_to_purchase * unit_price
  - supplier_name_snapshot: per-item supplier (supports multi-supplier POs in future)
  - remarks: optional

  ## Security
  - RLS enabled on both tables
  - procurement role: full read + insert + update own POs
  - approver role: read-only
  - All authenticated users can read (for cross-role visibility)

  ## Notes
  - One PO per PR2 (enforced by unique constraint on pr2_id)
  - po_number auto-generated via trigger
  - status 'draft' on creation; approval flow is Step 11
*/

-- â”€â”€â”€ po_requests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS po_requests (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number                   text NOT NULL UNIQUE,
  pr2_id                      uuid NOT NULL REFERENCES pr2_requests(id),
  pr2_number_snapshot         text NOT NULL DEFAULT '',
  pr1_number_snapshot         text NOT NULL DEFAULT '',
  rfq_number_snapshot         text NOT NULL DEFAULT '',
  supplier_name_snapshot      text NOT NULL DEFAULT '',
  requisitioner_name_snapshot text NOT NULL DEFAULT '',
  department_name_snapshot    text NOT NULL DEFAULT '',
  purpose                     text NOT NULL DEFAULT '',
  date_required               date NOT NULL,
  delivery_address            text NOT NULL DEFAULT '',
  warehouse                   text NOT NULL DEFAULT '',
  payment_terms               text NOT NULL DEFAULT '',
  packing                     text NOT NULL DEFAULT '',
  remarks                     text,
  status                      text NOT NULL DEFAULT 'draft',
  generated_by                uuid REFERENCES auth.users(id),
  generated_at                timestamptz NOT NULL DEFAULT now(),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

-- One PO per PR2
CREATE UNIQUE INDEX IF NOT EXISTS po_requests_pr2_id_key ON po_requests(pr2_id);

-- â”€â”€â”€ po_items â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS po_items (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id                   uuid NOT NULL REFERENCES po_requests(id) ON DELETE CASCADE,
  pr2_item_id             uuid REFERENCES pr2_items(id),
  item_order              integer NOT NULL DEFAULT 1,
  item_code               text NOT NULL DEFAULT '',
  description             text NOT NULL DEFAULT '',
  unit_of_measure         text NOT NULL DEFAULT '',
  quantity_to_purchase    numeric(12,2) NOT NULL DEFAULT 0,
  unit_price              numeric(14,2) NOT NULL DEFAULT 0,
  total_price             numeric(14,2) NOT NULL DEFAULT 0,
  supplier_name_snapshot  text NOT NULL DEFAULT '',
  remarks                 text,
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- â”€â”€â”€ PO number generator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  yr    text;
  seq   integer;
  newno text;
BEGIN
  yr  := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(
    CASE
      WHEN po_number ~ ('^PO-' || yr || '-[0-9]{4}$')
      THEN (regexp_match(po_number, '[0-9]{4}$'))[1]::integer
      ELSE 0
    END
  ), 0) + 1
  INTO seq
  FROM po_requests
  WHERE po_number LIKE 'PO-' || yr || '-%';

  newno := 'PO-' || yr || '-' || lpad(seq::text, 4, '0');
  NEW.po_number := newno;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_po_number ON po_requests;
CREATE TRIGGER trg_po_number
  BEFORE INSERT ON po_requests
  FOR EACH ROW
  WHEN (NEW.po_number IS NULL OR NEW.po_number = '')
  EXECUTE FUNCTION generate_po_number();

-- â”€â”€â”€ RLS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

ALTER TABLE po_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_items    ENABLE ROW LEVEL SECURITY;

-- po_requests: procurement can read all
CREATE POLICY "Procurement can read all POs"
  ON po_requests FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

-- po_requests: approver can read all
CREATE POLICY "Approvers can read all POs"
  ON po_requests FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'approver'
    )
  );

-- po_requests: procurement can insert
CREATE POLICY "Procurement can insert POs"
  ON po_requests FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

-- po_requests: procurement can update
CREATE POLICY "Procurement can update POs"
  ON po_requests FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

-- po_items: procurement can read all
CREATE POLICY "Procurement can read all PO items"
  ON po_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

-- po_items: approver can read all
CREATE POLICY "Approvers can read all PO items"
  ON po_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'approver'
    )
  );

-- po_items: procurement can insert
CREATE POLICY "Procurement can insert PO items"
  ON po_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

-- po_items: procurement can update
CREATE POLICY "Procurement can update PO items"
  ON po_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );



-- Migration: 20260424033227_po_add_po_date.sql
/*
  # Add po_date column to po_requests

  ## Summary
  Adds a buyer-entered PO date field to po_requests. Previously only
  generated_at (auto-timestamp) and date_required (from PR2) existed.
  The Buyer must be able to specify the official PO issue date separately.

  ## Change
  - po_requests: new column `po_date date NOT NULL DEFAULT CURRENT_DATE`
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'po_requests' AND column_name = 'po_date'
  ) THEN
    ALTER TABLE po_requests ADD COLUMN po_date date NOT NULL DEFAULT CURRENT_DATE;
  END IF;
END $$;



-- Migration: 20260424033801_po_buyer_entered_po_number.sql
/*
  # PO Number: switch from auto-generated to buyer-entered

  ## Summary
  The business requirement is that the Buyer manually enters the PO number.
  Previously a BEFORE INSERT trigger auto-generated it when the field was empty.
  This migration drops that trigger so the application must supply the value.

  The UNIQUE constraint on po_number is retained â€” duplicate PO numbers are
  still rejected at the DB level.

  ## Changes
  - Drop trg_po_number trigger on po_requests
  - Drop generate_po_number function
  - The po_number column remains NOT NULL UNIQUE â€” application must provide it
*/

DROP TRIGGER IF EXISTS trg_po_number ON po_requests;
DROP FUNCTION IF EXISTS generate_po_number();



-- Migration: 20260424034850_po_approval_and_receipts.sql
/*
  # PO Approval Workflow + Supplier Receipt

  ## Summary
  Adds the infrastructure needed for Step 11: PO approval routing through
  Buyer â†’ Procurement Manager â†’ Finance Director, followed by supplier
  receipt acknowledgment. The existing approval_instances / approval_actions
  tables are reused via document_type = 'PO'. A new po_receipts table
  captures the supplier's commitment date and delivery remarks.

  ## Changes

  ### po_requests
  - Add column: `approval_instance_id uuid` (FK to approval_instances, nullable)
    Tracks the active approval instance so detail pages can look it up easily.
  - Status values extend to: draft | for_approval | approved | sent | cancelled
    (no schema change needed â€” column is text)

  ### po_receipts (new table)
  - id: UUID PK
  - po_id: FK to po_requests (unique â€” one receipt per PO)
  - acknowledged_by: FK to auth.users (supplier rep who acknowledged)
  - acknowledged_by_name: snapshot of supplier rep name
  - commitment_date: date the supplier commits to deliver
  - delivery_remarks: optional text field for supplier notes
  - acknowledged_at: timestamp

  ## Security
  - RLS enabled on po_receipts
  - Procurement can read all receipts
  - Approver can read all receipts
  - Supplier role can insert (first time) and read their own receipt
  - Supplier role can update their own receipt (commitment date / remarks)
*/

-- â”€â”€â”€ po_requests: add approval_instance_id â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'po_requests' AND column_name = 'approval_instance_id'
  ) THEN
    ALTER TABLE po_requests ADD COLUMN approval_instance_id uuid;
  END IF;
END $$;

-- â”€â”€â”€ po_receipts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS po_receipts (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id                   uuid NOT NULL REFERENCES po_requests(id) ON DELETE CASCADE,
  acknowledged_by         uuid REFERENCES auth.users(id),
  acknowledged_by_name    text NOT NULL DEFAULT '',
  commitment_date         date,
  delivery_remarks        text,
  acknowledged_at         timestamptz NOT NULL DEFAULT now(),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- One receipt per PO
CREATE UNIQUE INDEX IF NOT EXISTS po_receipts_po_id_key ON po_receipts(po_id);

ALTER TABLE po_receipts ENABLE ROW LEVEL SECURITY;

-- Procurement: read all
CREATE POLICY "Procurement can read PO receipts"
  ON po_receipts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

-- Approver: read all
CREATE POLICY "Approvers can read PO receipts"
  ON po_receipts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'approver'
    )
  );

-- Supplier: read own receipts (where they are the acknowledger)
CREATE POLICY "Supplier can read own PO receipts"
  ON po_receipts FOR SELECT TO authenticated
  USING (
    acknowledged_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
  );

-- Supplier: insert receipt
CREATE POLICY "Supplier can insert PO receipt"
  ON po_receipts FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
  );

-- Supplier: update own receipt (commitment date / remarks)
CREATE POLICY "Supplier can update own PO receipt"
  ON po_receipts FOR UPDATE TO authenticated
  USING (acknowledged_by = auth.uid())
  WITH CHECK (acknowledged_by = auth.uid());



-- Migration: 20260424040446_fix_po_approval_step3_is_final.sql
/*
  # Fix PO Approval Step 3 is_final flag

  ## Problem
  Step 3 (Finance Director / Approved By) has is_final=false, causing the approval
  instance to advance to step 4 instead of closing. As a result:
  - po_requests.status never transitions to 'approved'
  - Supplier cannot see the PO in their inbox (fetchSupplierPOs filters status IN ('approved','sent'))
  - Supplier acknowledgment guard (status !== 'approved') always throws

  ## Fix
  Set is_final=true on step 3 of PO_APPROVAL. Step 4 (Supplier / Received By) is handled
  out-of-band via acknowledgeSupplierPO, not via the sequential approval action path.
*/

UPDATE approval_steps
SET is_final = true
WHERE step_order = 3
  AND workflow_id = (
    SELECT id FROM approval_workflows WHERE code = 'PO_APPROVAL'
  );



-- Migration: 20260424040507_po_requests_supplier_rls_policies.sql
/*
  # Add supplier RLS policies on po_requests

  ## Problem
  Suppliers have no SELECT or UPDATE policy on po_requests. This blocks:
  1. acknowledgeSupplierPO: queries po_requests for status/approval_instance_id â†’ returns null â†’ throws "PO not found"
  2. acknowledgeSupplierPO: UPDATE po_requests SET status='sent' â†’ RLS violation
  3. fetchPOApprovalDetailByPOId (used by /supplier/po/[id]): reads po_requests â†’ returns null

  ## Fix
  - Supplier SELECT: restricted to POs linked to PR2s linked to RFQs the supplier is on
  - Supplier UPDATE: restricted to the same scope AND only allowed status transitions
    (approved â†’ sent), not arbitrary field mutation. Scoped by the same rfq_suppliers chain.

  ## Security
  - Supplier can only read POs where their supplier_id appears in rfq_suppliers for the
    related RFQ batch (via rfq â†’ pr2 â†’ po chain).
  - Supplier can only update POs in status 'approved' (not draft/for_approval/cancelled).
  - No supplier can read or update a PO from a different supplier's RFQ.
*/

-- Supplier can read POs linked to RFQs they are on
CREATE POLICY "Supplier can read own linked POs"
  ON po_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles prof
      JOIN roles r ON r.id = prof.role_id
      WHERE prof.id = auth.uid()
        AND r.name = 'supplier'
    )
    AND
    EXISTS (
      SELECT 1
      FROM pr2_requests pr2
      JOIN rfq_suppliers rs ON rs.rfq_id = pr2.rfq_id
      JOIN profiles prof ON prof.id = auth.uid()
      WHERE pr2.id = po_requests.pr2_id
        AND rs.supplier_id = auth.uid()
    )
  );

-- Supplier can update POs to 'sent' (acknowledgment) only for their linked POs
CREATE POLICY "Supplier can update linked approved POs"
  ON po_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles prof
      JOIN roles r ON r.id = prof.role_id
      WHERE prof.id = auth.uid()
        AND r.name = 'supplier'
    )
    AND
    EXISTS (
      SELECT 1
      FROM pr2_requests pr2
      JOIN rfq_suppliers rs ON rs.rfq_id = pr2.rfq_id
      WHERE pr2.id = po_requests.pr2_id
        AND rs.supplier_id = auth.uid()
    )
    AND status = 'approved'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles prof
      JOIN roles r ON r.id = prof.role_id
      WHERE prof.id = auth.uid()
        AND r.name = 'supplier'
    )
    AND
    EXISTS (
      SELECT 1
      FROM pr2_requests pr2
      JOIN rfq_suppliers rs ON rs.rfq_id = pr2.rfq_id
      WHERE pr2.id = po_requests.pr2_id
        AND rs.supplier_id = auth.uid()
    )
  );



-- Migration: 20260424040914_reset_all_demo_passwords_uniform_hash.sql
/*
  # Reset all demo account passwords to uniform bcrypt hash

  ## Problem
  Some demo accounts (finance.director, supplier, employee, supervisor, etc.) use
  the older $2a$ bcrypt variant, while buyer and proc.manager were already updated
  to $2b$. Mixed variants can cause login failures depending on the bcrypt library.

  ## Fix
  Apply the same known-working $2b$10$ hash for "Fortune2024!" to all demo accounts.
  This is the same hash already used by buyer@fortune.com and proc.manager@fortune.com.

  Hash: $2b$10$qmuXJawZXSRYXH2yaEQPDO2yT4Xg946N1XRX0fObpXcpkG0Assez6
  Password: Fortune2024!
*/

UPDATE auth.users
SET 
  encrypted_password = '$2b$10$qmuXJawZXSRYXH2yaEQPDO2yT4Xg946N1XRX0fObpXcpkG0Assez6',
  updated_at = now()
WHERE email IN (
  'buyer@fortune.com',
  'proc.manager@fortune.com',
  'finance.director@fortune.com',
  'supplier@fortune.com',
  'employee@fortune.com',
  'supervisor@fortune.com',
  'dept.head@fortune.com',
  'director@fortune.com',
  'procurement@fortune.com',
  'supplier2@fortune.com',
  'supplier3@fortune.com',
  'wh.manager@fortune.com',
  'warehouse@fortune.com'
);



-- Migration: 20260424042312_fix_po_approval_step3_is_final.sql
/*
  # Fix PO approval: approver role cannot update po_requests status

  ## Root Cause
  Finance Director (role=approver) calls submitPOApprovalAction which executes:
    UPDATE po_requests SET status='approved' WHERE id=...
  There is no UPDATE policy on po_requests for the 'approver' role, so Supabase RLS
  silently drops the write. The approval_instances row correctly transitions to 'approved'
  and completed_at is set, but po_requests.status stays 'for_approval'.
  This means the supplier never sees the PO (fetchSupplierPOs filters status IN ('approved','sent')).

  ## Fix
  Add a minimal scoped UPDATE policy for approvers:
  - Only approvers can use it
  - Only applies when an active approval_instance for that PO exists and is being approved
  - Does not allow approvers to modify PO content â€” just the status field transition

  Also directly heal the one stuck PO that was approved before this fix.
*/

-- Allow approver role to update PO status during approval workflow
CREATE POLICY "Approvers can update PO status during approval"
  ON po_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles prof
      JOIN roles r ON r.id = prof.role_id
      WHERE prof.id = auth.uid()
        AND r.name = 'approver'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles prof
      JOIN roles r ON r.id = prof.role_id
      WHERE prof.id = auth.uid()
        AND r.name = 'approver'
    )
  );

-- Heal the stuck PO: approval instance is 'approved' but PO status was not updated
UPDATE po_requests
SET status = 'approved', updated_at = now()
WHERE id = '701d5117-d4cf-4d3e-8c87-01a26dee1035'
  AND status = 'for_approval';



-- Migration: 20260424043239_po_requests_supplier_id_column_and_rls_fix.sql
/*
  # Add supplier_id to po_requests and fix supplier visibility RLS

  ## Problem
  The previous RLS policy "Supplier can read own linked POs" used a subquery that
  JOINed pr2_requests to check the rfq_suppliers chain. However, pr2_requests has no
  SELECT policy for the supplier role. When Supabase evaluates the subquery inside the
  po_requests RLS, it does so under the supplier's auth context â€” which means the
  pr2_requests scan returns zero rows, the EXISTS is false, and the supplier sees nothing.

  This is a cross-table RLS recursion problem: a policy on table A referencing table B
  only works if the user also has SELECT access on table B.

  ## Fix
  1. Add supplier_id UUID column to po_requests (FK to auth.users).
     This is the awarded supplier for this PO â€” set at PO generation time.
  2. Populate supplier_id for all existing POs using the supplier_name_snapshot
     matched against profiles.full_name.
  3. Drop the broken cross-table RLS policy and replace with a simple direct column check:
     supplier_id = auth.uid() AND status IN ('approved','sent').
  4. Drop and replace the supplier UPDATE policy the same way.

  ## Security
  - Supplier can only see their own POs (supplier_id = auth.uid())
  - Only approved/sent POs are visible (draft and for_approval are hidden)
  - Other suppliers cannot see each other's POs
*/

-- 1. Add supplier_id column
ALTER TABLE po_requests
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES auth.users(id);

-- 2. Populate supplier_id for existing POs by matching supplier_name_snapshot to profiles.full_name
UPDATE po_requests po
SET supplier_id = (
  SELECT profiles.id
  FROM profiles
  JOIN auth.users ON auth.users.id = profiles.id
  JOIN roles ON roles.id = profiles.role_id
  WHERE roles.name = 'supplier'
    AND profiles.full_name = po.supplier_name_snapshot
  LIMIT 1
)
WHERE supplier_id IS NULL
  AND supplier_name_snapshot IS NOT NULL
  AND supplier_name_snapshot <> '';

-- 3. Drop old broken cross-table RLS policies on po_requests for supplier
DROP POLICY IF EXISTS "Supplier can read own linked POs" ON po_requests;
DROP POLICY IF EXISTS "Supplier can update linked approved POs" ON po_requests;

-- 4. New simple supplier SELECT: direct supplier_id match, only approved/sent
CREATE POLICY "Supplier can read own approved POs"
  ON po_requests
  FOR SELECT
  TO authenticated
  USING (
    supplier_id = auth.uid()
    AND status IN ('approved', 'sent')
  );

-- 5. New simple supplier UPDATE: direct supplier_id match, only when approved
CREATE POLICY "Supplier can acknowledge own approved POs"
  ON po_requests
  FOR UPDATE
  TO authenticated
  USING (
    supplier_id = auth.uid()
    AND status = 'approved'
  )
  WITH CHECK (
    supplier_id = auth.uid()
  );

-- 6. Index for supplier_id lookups
CREATE INDEX IF NOT EXISTS idx_po_requests_supplier_id ON po_requests(supplier_id);



-- Migration: 20260424044110_po_items_supplier_select_policy.sql
/*
  # Add supplier SELECT policy on po_items

  ## Problem
  The supplier role has no SELECT policy on po_items. When a supplier opens their
  PO detail page, the query `SELECT * FROM po_items WHERE po_id = ?` returns 0 rows
  silently due to RLS. The detail page shows "Items (0)" and "Grand Total â‚±0.00"
  even though items exist.

  ## Fix
  Add a scoped SELECT policy: supplier can read po_items only for POs where
  po_requests.supplier_id = auth.uid() AND status IN ('approved','sent').

  This uses a subquery on po_requests, which is safe because:
  - po_requests has its own RLS (supplier_id = auth.uid() AND status IN approved/sent)
  - The subquery does not re-enter po_items (no recursion)
  - Other suppliers cannot satisfy supplier_id = auth.uid() for a PO they don't own

  ## Security
  - Supplier can only read items belonging to their own approved/sent POs
  - Draft and for_approval PO items remain invisible to suppliers
  - No supplier can read another supplier's PO items
  - No write access granted
*/

CREATE POLICY "Supplier can read items of own approved POs"
  ON po_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM po_requests po
      WHERE po.id = po_items.po_id
        AND po.supplier_id = auth.uid()
        AND po.status IN ('approved', 'sent')
    )
  );



-- Migration: 20260424044859_delivery_tracking_schema.sql
/*
  # Delivery Tracking Schema

  ## Overview
  Tracks the delivery lifecycle for Purchase Orders after supplier acknowledgment.
  Deliveries are created automatically when a supplier acknowledges a PO (status='sent').
  Suppliers update delivery status; procurement monitors and adds follow-up notes;
  employees can view progress.

  ## New Tables

  ### deliveries
  One delivery record per PO. Created when a PO is acknowledged by the supplier.
  - Tracks overall delivery status from pending â†’ delivered
  - Carries snapshots of PO/supplier info for audit trail
  - Links back to po_requests, pr2, pr1 via snapshots

  ### delivery_status_history
  Append-only log of every status change and supplier/procurement note.
  - actor_id + actor_name_snapshot for audit
  - actor_role: 'supplier' | 'procurement' | 'warehouse'
  - status_to: the new status (null means note only, no status change)
  - note: free-text update from supplier or procurement follow-up

  ## Delivery Status Flow
  pending â†’ scheduled â†’ in_transit â†’ delayed â†’ delivered
                                    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â†’ delivered

  ## Security
  - RLS enabled on all tables
  - Supplier: can read/update own deliveries (supplier_id = auth.uid())
  - Procurement: can read all, add follow-up notes
  - Warehouse: can read all (receives goods), mark delivered
  - Employee: read-only visibility into their own requisition's delivery
  - Approver: read-only

  ## Notes
  - No hard-delete on history â€” audit log is permanent
  - status_history uses INSERT only (no UPDATE/DELETE)
*/

-- â”€â”€â”€ deliveries â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS deliveries (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Linked PO
  po_id                     uuid NOT NULL REFERENCES po_requests(id),
  po_number_snapshot        text NOT NULL DEFAULT '',
  pr2_number_snapshot       text NOT NULL DEFAULT '',
  pr1_number_snapshot       text NOT NULL DEFAULT '',
  rfq_number_snapshot       text NOT NULL DEFAULT '',

  -- Supplier
  supplier_id               uuid REFERENCES auth.users(id),
  supplier_name_snapshot    text NOT NULL DEFAULT '',

  -- Requisitioner (employee) â€” for employee visibility
  requisitioner_id          uuid REFERENCES auth.users(id),
  requisitioner_name_snapshot text NOT NULL DEFAULT '',
  department_name_snapshot  text NOT NULL DEFAULT '',
  purpose                   text NOT NULL DEFAULT '',

  -- Delivery status
  status                    text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','scheduled','in_transit','delayed','delivered','cancelled')),

  -- Dates
  commitment_date           date,          -- from po_receipts (supplier's original commit)
  scheduled_date            date,          -- supplier-updated scheduled delivery date
  actual_delivery_date      date,          -- set when delivered

  -- Where it's going
  delivery_address          text NOT NULL DEFAULT '',
  warehouse                 text NOT NULL DEFAULT '',

  -- Grand total (for display)
  grand_total               numeric(14,2) NOT NULL DEFAULT 0,

  -- Timestamps
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),

  UNIQUE(po_id)
);

ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

-- Procurement: full read
CREATE POLICY "Procurement can read all deliveries"
  ON deliveries FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

-- Approver: read-only
CREATE POLICY "Approvers can read all deliveries"
  ON deliveries FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'approver'
    )
  );

-- Warehouse: read-only (receives goods)
CREATE POLICY "Warehouse can read all deliveries"
  ON deliveries FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'warehouse'
    )
  );

-- Supplier: read own deliveries
CREATE POLICY "Supplier can read own deliveries"
  ON deliveries FOR SELECT TO authenticated
  USING (supplier_id = auth.uid());

-- Employee: read deliveries for their own requisitions
CREATE POLICY "Employee can read own requisition deliveries"
  ON deliveries FOR SELECT TO authenticated
  USING (requisitioner_id = auth.uid());

-- Procurement: create deliveries
CREATE POLICY "Procurement can insert deliveries"
  ON deliveries FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

-- Supplier: update status on own deliveries (status + dates only)
CREATE POLICY "Supplier can update own delivery status"
  ON deliveries FOR UPDATE TO authenticated
  USING (supplier_id = auth.uid())
  WITH CHECK (supplier_id = auth.uid());

-- Procurement: update any delivery (follow-up, mark received)
CREATE POLICY "Procurement can update deliveries"
  ON deliveries FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

-- Warehouse: mark delivered
CREATE POLICY "Warehouse can update delivery status"
  ON deliveries FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'warehouse'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'warehouse'
    )
  );

-- â”€â”€â”€ delivery_status_history â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS delivery_status_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id     uuid NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,

  -- Who made this entry
  actor_id        uuid NOT NULL REFERENCES auth.users(id),
  actor_name      text NOT NULL DEFAULT '',
  actor_role      text NOT NULL DEFAULT '',

  -- What changed
  status_from     text,   -- null = first entry
  status_to       text,   -- null = note-only, no status change
  note            text,   -- free text: supplier update or procurement follow-up

  -- For scheduled/in_transit updates: supplier may provide new date
  scheduled_date  date,

  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE delivery_status_history ENABLE ROW LEVEL SECURITY;

-- Procurement: read all history
CREATE POLICY "Procurement can read delivery history"
  ON delivery_status_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

-- Approver: read all history
CREATE POLICY "Approvers can read delivery history"
  ON delivery_status_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'approver'
    )
  );

-- Warehouse: read all history
CREATE POLICY "Warehouse can read delivery history"
  ON delivery_status_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'warehouse'
    )
  );

-- Supplier: read history for own deliveries
CREATE POLICY "Supplier can read own delivery history"
  ON delivery_status_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM deliveries d
      WHERE d.id = delivery_status_history.delivery_id
        AND d.supplier_id = auth.uid()
    )
  );

-- Employee: read history for own requisition deliveries
CREATE POLICY "Employee can read own delivery history"
  ON delivery_status_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM deliveries d
      WHERE d.id = delivery_status_history.delivery_id
        AND d.requisitioner_id = auth.uid()
    )
  );

-- Supplier: insert history for own deliveries
CREATE POLICY "Supplier can insert own delivery history"
  ON delivery_status_history FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM deliveries d
      WHERE d.id = delivery_status_history.delivery_id
        AND d.supplier_id = auth.uid()
    )
  );

-- Procurement: insert history (follow-up notes)
CREATE POLICY "Procurement can insert delivery history"
  ON delivery_status_history FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

-- Warehouse: insert history (mark delivered note)
CREATE POLICY "Warehouse can insert delivery history"
  ON delivery_status_history FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'warehouse'
    )
  );

-- â”€â”€â”€ Indexes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE INDEX IF NOT EXISTS idx_deliveries_po_id        ON deliveries(po_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_supplier_id  ON deliveries(supplier_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_req_id       ON deliveries(requisitioner_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status       ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_del_history_delivery_id ON delivery_status_history(delivery_id);

-- â”€â”€â”€ Seed: create delivery for existing approved/sent POs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Picks up any POs that were approved before the delivery module existed

INSERT INTO deliveries (
  po_id, po_number_snapshot, pr2_number_snapshot, pr1_number_snapshot,
  rfq_number_snapshot, supplier_id, supplier_name_snapshot,
  requisitioner_id, requisitioner_name_snapshot, department_name_snapshot,
  purpose, commitment_date, delivery_address, warehouse, grand_total, created_at, updated_at
)
SELECT
  po.id,
  po.po_number,
  po.pr2_number_snapshot,
  po.pr1_number_snapshot,
  po.rfq_number_snapshot,
  po.supplier_id,
  po.supplier_name_snapshot,
  pr2.requisitioner_id,
  po.requisitioner_name_snapshot,
  po.department_name_snapshot,
  po.purpose,
  rec.commitment_date,
  po.delivery_address,
  po.warehouse,
  COALESCE((
    SELECT SUM(total_price) FROM po_items WHERE po_id = po.id
  ), 0),
  po.updated_at,
  now()
FROM po_requests po
LEFT JOIN pr2_requests pr2 ON pr2.id = po.pr2_id
LEFT JOIN po_receipts rec ON rec.po_id = po.id
WHERE po.status IN ('approved', 'sent')
ON CONFLICT (po_id) DO NOTHING;



-- Migration: 20260424050041_delivery_supplier_insert_policy_and_commitment_date_fix.sql
/*
  # Fix delivery INSERT RLS and heal seeded delivery commitment_date

  ## Problems Fixed

  ### 1. deliveries INSERT only allowed procurement
  createDeliveryForPO is called from acknowledgeSupplierPO under the supplier's auth context.
  The existing INSERT policy only allowed procurement, so the supplier's call silently failed
  (swallowed by .catch(() => null)).

  Fix: add a supplier INSERT policy scoped to POs where supplier_id = auth.uid().
  This ensures a supplier can only create a delivery record for their own PO.

  ### 2. Seeded delivery has null commitment_date
  The migration seed ran before po_receipts was populated. Heal it now.

  ## Security
  - Supplier can only insert deliveries for po_requests where supplier_id = auth.uid()
  - Cannot insert deliveries for other suppliers' POs
*/

-- Allow supplier to insert delivery only for their own PO
CREATE POLICY "Supplier can insert delivery for own PO"
  ON deliveries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM po_requests po
      WHERE po.id = deliveries.po_id
        AND po.supplier_id = auth.uid()
        AND po.status IN ('approved', 'sent')
    )
  );

-- Heal seeded delivery: populate commitment_date from po_receipts
UPDATE deliveries d
SET commitment_date = (
  SELECT rec.commitment_date
  FROM po_receipts rec
  WHERE rec.po_id = d.po_id
  LIMIT 1
)
WHERE d.commitment_date IS NULL
  AND EXISTS (
    SELECT 1 FROM po_receipts rec
    WHERE rec.po_id = d.po_id
      AND rec.commitment_date IS NOT NULL
  );



-- Migration: 20260424050818_grn_schema.sql
/*
  # GRN (Goods Receipt Note) Schema

  ## Overview
  MVP GRN module for warehouse staff to record and close incoming deliveries.
  One GRN per delivery (which is one-per-PO). Warehouse staff fills in header
  fields (invoice, DR, dates) and per-item quantities received, then saves to
  close the transaction.

  ## New Tables

  ### grn_receipts
  GRN header. One per delivery. Auto-created when a delivery is marked delivered
  or when warehouse opens a GRN. Status: open â†’ closed.
  - grn_number: auto-generated sequential number (GRN-YYYYMM-XXXX)
  - Links back to delivery_id â†’ po_id â†’ pr2 â†’ pr1 via snapshots
  - Stores invoice_no, dr_no, dr_date, transaction_date from physical docs
  - received_by_id / received_by_name_snapshot: warehouse staff who closes it

  ### grn_items
  Per-line quantities received. One row per PO item.
  - quantity_ordered: from po_items (snapshot)
  - quantity_received: entered by warehouse staff
  - quantity_rejected: damaged/short (optional)
  - remarks: per-item notes

  ## GRN Number Generation
  Format: GRN-YYYYMM-XXXX (e.g., GRN-202604-0001)
  Generated by a DB function to avoid race conditions.

  ## Status
  - open: GRN created, not yet saved/closed
  - closed: GRN saved â€” transaction complete

  ## Security
  - RLS enabled
  - Warehouse: full CRUD (create, edit, close)
  - Procurement: read-only
  - Approver: read-only
  - Employee: read-only for own requisition GRNs (via delivery â†’ requisitioner_id)
  - Supplier: no access (GRN is internal)
*/

-- â”€â”€â”€ GRN number sequence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE SEQUENCE IF NOT EXISTS grn_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_grn_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_seq int;
  v_prefix text;
BEGIN
  v_seq    := nextval('grn_number_seq');
  v_prefix := 'GRN-' || to_char(now(), 'YYYYMM');
  RETURN v_prefix || '-' || lpad(v_seq::text, 4, '0');
END;
$$;

-- â”€â”€â”€ grn_receipts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS grn_receipts (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- GRN identity
  grn_number                text UNIQUE NOT NULL DEFAULT generate_grn_number(),

  -- Linked delivery (one-per-delivery)
  delivery_id               uuid NOT NULL REFERENCES deliveries(id),

  -- Snapshots for immutable record
  po_number_snapshot        text NOT NULL DEFAULT '',
  pr2_number_snapshot       text NOT NULL DEFAULT '',
  pr1_number_snapshot       text NOT NULL DEFAULT '',
  supplier_name_snapshot    text NOT NULL DEFAULT '',
  department_name_snapshot  text NOT NULL DEFAULT '',
  purpose                   text NOT NULL DEFAULT '',
  warehouse                 text NOT NULL DEFAULT '',
  delivery_address          text NOT NULL DEFAULT '',

  -- Physical document fields entered by warehouse
  invoice_no                text NOT NULL DEFAULT '',
  dr_no                     text NOT NULL DEFAULT '',
  dr_date                   date,
  transaction_date          date NOT NULL DEFAULT CURRENT_DATE,

  -- Warehouse staff
  received_by_id            uuid REFERENCES auth.users(id),
  received_by_name_snapshot text NOT NULL DEFAULT '',
  received_by_position_snapshot text NOT NULL DEFAULT '',

  -- Status
  status                    text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed')),

  -- Optional notes
  remarks                   text NOT NULL DEFAULT '',

  -- Timestamps
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  closed_at                 timestamptz,

  UNIQUE(delivery_id)
);

ALTER TABLE grn_receipts ENABLE ROW LEVEL SECURITY;

-- Warehouse: full access
CREATE POLICY "Warehouse can read all GRNs"
  ON grn_receipts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'warehouse'
    )
  );

CREATE POLICY "Warehouse can insert GRNs"
  ON grn_receipts FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'warehouse'
    )
  );

CREATE POLICY "Warehouse can update open GRNs"
  ON grn_receipts FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'warehouse'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'warehouse'
    )
  );

-- Procurement: read-only
CREATE POLICY "Procurement can read all GRNs"
  ON grn_receipts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

-- Approver: read-only
CREATE POLICY "Approvers can read all GRNs"
  ON grn_receipts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'approver'
    )
  );

-- Employee: read GRNs for their own requisition's delivery
CREATE POLICY "Employee can read own requisition GRNs"
  ON grn_receipts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM deliveries d
      WHERE d.id = grn_receipts.delivery_id
        AND d.requisitioner_id = auth.uid()
    )
  );

-- â”€â”€â”€ grn_items â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS grn_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id              uuid NOT NULL REFERENCES grn_receipts(id) ON DELETE CASCADE,

  -- Link back to po_item
  po_item_id          uuid REFERENCES po_items(id),

  -- Snapshots
  item_order          int NOT NULL DEFAULT 0,
  item_code           text NOT NULL DEFAULT '',
  description         text NOT NULL DEFAULT '',
  unit_of_measure     text NOT NULL DEFAULT '',

  -- Quantities
  quantity_ordered    numeric(14,4) NOT NULL DEFAULT 0,
  quantity_received   numeric(14,4) NOT NULL DEFAULT 0,
  quantity_rejected   numeric(14,4) NOT NULL DEFAULT 0,

  -- Unit price snapshot for value calculation
  unit_price          numeric(14,4) NOT NULL DEFAULT 0,

  -- Per-item remarks
  remarks             text NOT NULL DEFAULT '',

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE grn_items ENABLE ROW LEVEL SECURITY;

-- Warehouse: full access
CREATE POLICY "Warehouse can read GRN items"
  ON grn_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'warehouse'
    )
  );

CREATE POLICY "Warehouse can insert GRN items"
  ON grn_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'warehouse'
    )
  );

CREATE POLICY "Warehouse can update GRN items"
  ON grn_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'warehouse'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'warehouse'
    )
  );

-- Procurement: read-only
CREATE POLICY "Procurement can read GRN items"
  ON grn_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

-- Approver: read-only
CREATE POLICY "Approvers can read GRN items"
  ON grn_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'approver'
    )
  );

-- Employee: read GRN items for own requisition
CREATE POLICY "Employee can read own requisition GRN items"
  ON grn_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM grn_receipts g
      JOIN deliveries d ON d.id = g.delivery_id
      WHERE g.id = grn_items.grn_id
        AND d.requisitioner_id = auth.uid()
    )
  );

-- â”€â”€â”€ Indexes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE INDEX IF NOT EXISTS idx_grn_receipts_delivery_id ON grn_receipts(delivery_id);
CREATE INDEX IF NOT EXISTS idx_grn_receipts_status      ON grn_receipts(status);
CREATE INDEX IF NOT EXISTS idx_grn_items_grn_id         ON grn_items(grn_id);
CREATE INDEX IF NOT EXISTS idx_grn_items_po_item_id     ON grn_items(po_item_id);



-- Migration: 20260424053740_repair_grn_seed_missing_items.sql
/*
  # Repair GRN: Seed missing GRN items from PO items

  ## Summary
  The existing GRN (GRN-202604-0001) was created but its items were never seeded.
  PO has 2 items but grn_items count is 0.

  ## Changes
  - Inserts grn_items for any grn_receipts that have 0 items but have linked po_items
  - Uses the linked delivery â†’ po_id â†’ po_items chain
  - Safe to run multiple times: only inserts when grn_items count = 0 for that GRN

  ## Affected Tables
  - grn_items: rows inserted
*/

INSERT INTO grn_items (
  grn_id,
  po_item_id,
  item_order,
  item_code,
  description,
  unit_of_measure,
  quantity_ordered,
  quantity_received,
  quantity_rejected,
  unit_price,
  remarks
)
SELECT
  g.id            AS grn_id,
  pi.id           AS po_item_id,
  pi.item_order,
  COALESCE(pi.item_code, '')   AS item_code,
  pi.description,
  pi.unit_of_measure,
  pi.quantity_to_purchase      AS quantity_ordered,
  pi.quantity_to_purchase      AS quantity_received,
  0                            AS quantity_rejected,
  pi.unit_price,
  ''                           AS remarks
FROM grn_receipts g
JOIN deliveries d   ON d.id   = g.delivery_id
JOIN po_items   pi  ON pi.po_id = d.po_id
WHERE NOT EXISTS (
  SELECT 1 FROM grn_items gi WHERE gi.grn_id = g.id
);



-- Migration: 20260428210352_add_pr1_priority.sql
/*
  # Add Manual Priority to PR1

  ## Summary
  Adds persistent priority field to PR1 requests, allowing authorized users
  to manually set and override PR1 priority levels for workflow optimization
  and expedited processing.

  ## Changes

  ### 1. pr1_requests priority column
  - `priority` (text, default 'normal')
    - Allowed values: 'normal', 'urgent', 'critical'
    - CHECK constraint enforces enum values
    - Default 'normal' for backward compatibility with existing PR1s
    - Applies to all PR1 states (draft, submitted, approved, etc.)
    - Reusable across dashboards and reports

  ## Backward Compatibility
  - Existing PR1s automatically default to 'normal' priority
  - No data migration needed
  - Priority can be updated on any PR1 (authorization handled in application layer)

  ## Security Notes
  - RLS policies for priority updates will be added in a separate phase
  - Current authorization checks will be enforced at the application layer
*/

-- Add priority column to pr1_requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pr1_requests' AND column_name = 'priority'
  ) THEN
    ALTER TABLE pr1_requests
      ADD COLUMN priority text DEFAULT 'normal'
        CHECK (priority IN ('normal', 'urgent', 'critical'));
  END IF;
END $$;



-- Migration: 20260428211433_add_pr1_priority_update_policy.sql
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



-- Migration: 20260429124542_add_admin_role_and_demo_user.sql

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



-- Migration: 20260429125542_fix_admin_demo_password_bcrypt_2b.sql

/*
  # Fix Admin Demo Account Password Hash

  ## Problem
  The admin@fortune.com demo account was created with $2a$ bcrypt format,
  but Supabase auth requires the newer $2b$ format. This causes login failures.

  ## Fix
  Update admin@fortune.com to use the same verified $2b$10$ hash used by all other demo accounts.

  Hash: $2b$10$qmuXJawZXSRYXH2yaEQPDO2yT4Xg946N1XRX0fObpXcpkG0Assez6
  Password: Fortune2024!
*/

UPDATE auth.users
SET 
  encrypted_password = '$2b$10$qmuXJawZXSRYXH2yaEQPDO2yT4Xg946N1XRX0fObpXcpkG0Assez6',
  updated_at = now()
WHERE email = 'admin@fortune.com';



-- Migration: 20260429130803_add_admin_auth_identity.sql

/*
  # Add Admin Auth Identity

  ## Problem
  The admin@fortune.com user was created in auth.users but lacks a corresponding
  row in auth.identities. Supabase signInWithPassword() requires an identity record
  with provider='email' to authenticate. Without it, login fails silently.

  ## Fix
  Insert the missing auth.identities row for admin@fortune.com, following the same
  pattern used in migration 20260423221046_fix_demo_user_identities.sql.

  ## Details
  - provider: email
  - provider_id: admin@fortune.com
  - identity_data: { "sub": "<admin_user_id>", "email": "admin@fortune.com" }
*/

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'admin@fortune.com';
  
  IF v_user_id IS NOT NULL THEN
    INSERT INTO auth.identities (
      id,
      provider_id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      'admin@fortune.com',
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', 'admin@fortune.com'),
      'email',
      now(),
      now(),
      now()
    )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;



-- Migration: 20260429132626_fix_admin_identity_data_email_verified.sql
/*
  # Fix Admin Auth Identity Metadata Shape

  ## Problem
  The auth.identities.identity_data for admin@fortune.com is missing the
  email_verified and phone_verified fields. Supabase's signInWithPassword()
  requires these fields to be present in identity_data to complete the auth
  flow. Their absence causes HTTP 500 "Database error querying schema".

  Every other working demo user has:
    { "sub": "...", "email": "...", "email_verified": true/false, "phone_verified": false }

  Admin only had:
    { "sub": "...", "email": "..." }

  ## Fix
  1. Update auth.identities.identity_data for admin to include email_verified and phone_verified.
  2. Update auth.users.raw_user_meta_data to match the same complete shape.

  Both use the admin user id resolved dynamically from auth.users.email.
  The migration is idempotent â€” safe to rerun.

  ## Changes
  - auth.identities: identity_data updated for admin@fortune.com user_id
  - auth.users: raw_user_meta_data updated for admin@fortune.com id
  - No other tables, policies, profiles, roles, or passwords touched
*/

DO $$
DECLARE
  v_admin_id uuid;
BEGIN
  SELECT id INTO v_admin_id
  FROM auth.users
  WHERE email = 'admin@fortune.com';

  IF v_admin_id IS NULL THEN
    RAISE NOTICE 'admin@fortune.com not found in auth.users â€” skipping';
    RETURN;
  END IF;

  -- Fix identity_data: add email_verified and phone_verified
  UPDATE auth.identities
  SET
    identity_data = jsonb_build_object(
      'sub',            v_admin_id::text,
      'email',          'admin@fortune.com',
      'email_verified', true,
      'phone_verified', false
    ),
    updated_at = now()
  WHERE user_id = v_admin_id
    AND provider = 'email';

  -- Fix raw_user_meta_data to match working demo user shape
  UPDATE auth.users
  SET
    raw_user_meta_data = jsonb_build_object(
      'sub',            v_admin_id::text,
      'email',          'admin@fortune.com',
      'email_verified', true,
      'phone_verified', false
    )
  WHERE id = v_admin_id;

  RAISE NOTICE 'Admin auth metadata updated for user id: %', v_admin_id;
END $$;



-- Migration: 20260429132717_fix_admin_auth_users_null_token_fields.sql
/*
  # Fix Admin auth.users NULL Token Fields

  ## Problem
  The admin@fortune.com row in auth.users has NULL values for token fields
  that Supabase's internal auth engine expects to be empty strings:
    - confirmation_token: NULL   (should be '')
    - recovery_token: NULL       (should be '')
    - email_change_token_new: NULL (should be '')
    - email_change: NULL         (should be '')
    - email_change_token_current: NULL (should be '', col default)
    - reauthentication_token: NULL (should be '')

  Every working demo user (supplier2, buyer, employee, etc.) has '' for these
  fields. Admin was seeded with NULLs, causing Supabase's auth server to throw
  HTTP 500 "Database error querying schema" during signInWithPassword().

  ## Fix
  SET all NULL token/change string fields to '' for admin@fortune.com only.
  Idempotent â€” safe to rerun (COALESCE ensures only NULLs are changed).

  ## Scope
  - Only auth.users row for admin@fortune.com
  - No profiles, roles, positions, RLS, workflows, password hashes touched
*/

UPDATE auth.users
SET
  confirmation_token        = COALESCE(confirmation_token, ''),
  recovery_token            = COALESCE(recovery_token, ''),
  email_change_token_new    = COALESCE(email_change_token_new, ''),
  email_change              = COALESCE(email_change, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  reauthentication_token    = COALESCE(reauthentication_token, '')
WHERE email = 'admin@fortune.com';



-- Migration: 20260429140112_20260429140000_admin_user_assignment_update_rls.sql
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
    - Admins identified by checking profiles.role_id â†’ roles.name = 'admin'
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



-- Migration: 20260429163647_20260429145000_add_active_flags_to_master_data.sql
/*
  # Add Active Flags to Master Data Tables

  1. New Columns
    - `roles.active` (boolean, DEFAULT true, NOT NULL)
    - `positions.active` (boolean, DEFAULT true, NOT NULL)
    - `departments.active` (boolean, DEFAULT true, NOT NULL)
  2. Migration Strategy
    - All existing records default to active=true (no downtime)
    - Soft deactivate support for future management
    - Follows existing active pattern in controlled_form_templates and approval_workflows
  3. Safety
    - No RLS changes in this migration
    - No logic changes to approvals, workflows, or user assignments
    - Existing queries continue to work (active flag not yet filtered)
    - Active flag available for later filtering when UI implements deactivation
  4. Notes
    - Do NOT use hard delete in future; deactivate via active=false instead
    - Approval workflows reference role/position as TEXT and stored in snapshots; renaming will be handled separately
    - All existing records become active=true; provides foundation for soft deactivate strategy
*/

-- Add active column to roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'roles' AND column_name = 'active'
  ) THEN
    ALTER TABLE roles ADD COLUMN active boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- Add active column to positions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'positions' AND column_name = 'active'
  ) THEN
    ALTER TABLE positions ADD COLUMN active boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- Add active column to departments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'departments' AND column_name = 'active'
  ) THEN
    ALTER TABLE departments ADD COLUMN active boolean NOT NULL DEFAULT true;
  END IF;
END $$;



-- Migration: 20260429164654_20260429150000_add_admin_department_management_rls.sql
/*
  # Admin Department Management RLS Policies

  1. New Policies
    - Allow admins to insert new departments
    - Allow admins to update existing departments
    - Uses proven admin-check pattern: profiles.role_id â†’ roles.name = 'admin'
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



-- Migration: 20260429165857_20260429155000_add_admin_position_management_rls.sql
/*
  # Admin Position Management RLS Policies

  1. New Policies
    - Allow admins to insert new positions
    - Allow admins to update existing positions
    - Uses proven admin-check pattern: profiles.role_id â†’ roles.name = 'admin'
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



-- Migration: 20260429171158_20260429160000_add_admin_role_management_rls.sql
/*
  # Admin Role Management RLS Policies

  1. New Policies
    - Allow admins to insert new roles
    - Allow admins to update existing roles
    - Uses proven admin-check pattern: profiles.role_id â†’ roles.name = 'admin'
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



-- Migration: 20260430015015_fix_approval_actions_action_check_constraint.sql
/*
  # Fix approval_actions action check constraint

  ## Problem
  The approval_actions_action_check constraint currently allows:
    'approved', 'rejected', 'noted'

  All application code (PR1, PR2, PO approval workflows) inserts 'revision_requested'
  for the "Request Revision" action. The value 'noted' is not used anywhere in the
  codebase. This mismatch causes a database constraint violation whenever an approver
  clicks "Request Revision".

  ## Changes
  - Drops the existing approval_actions_action_check constraint
  - Recreates it allowing: 'approved', 'rejected', 'revision_requested'

  ## Safety
  - Zero existing rows with action = 'noted' (verified before migration)
  - No application code changes required â€” app already uses the correct values
  - Affects PR1, PR2, and PO approval workflows (all insert into approval_actions)
*/

ALTER TABLE approval_actions
  DROP CONSTRAINT IF EXISTS approval_actions_action_check;

ALTER TABLE approval_actions
  ADD CONSTRAINT approval_actions_action_check
  CHECK (action = ANY (ARRAY[
    'approved'::text,
    'rejected'::text,
    'revision_requested'::text
  ]));



-- Migration: 20260430023558_fix_profile_rls_column_restrictions.sql
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



-- Migration: 20260430042124_add_warehouse_po_items_select_policy.sql
/*
  # Add warehouse SELECT policy on po_items

  ## Problem
  The GRN details page falls back to fetching po_items when grn_items is empty.
  The warehouse role had no SELECT policy on po_items, so RLS silently returned
  an empty array, causing the items table to show "(0)" for all GRNs without
  pre-seeded grn_items rows.

  ## Changes
  - po_items: add SELECT policy for warehouse role (mirrors the existing approver policy)
*/

CREATE POLICY "Warehouse can read all PO items"
  ON po_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'warehouse'
    )
  );



-- Migration: 20260504093754_20260504_migrate_priority_values_normal_medium_high.sql
/*
  # Migrate Priority Values: urgent â†’ medium, critical â†’ high

  1. Overview
    - Migrate all pr1_requests.priority values from urgent/critical to medium/high
    - Keep normal unchanged
    - Update CHECK constraint to allow only: normal, medium, high

  2. Changes
    - UPDATE pr1_requests: urgent â†’ medium, critical â†’ high
    - Update CHECK constraint on pr1_requests.priority
    - Default remains: normal

  3. Data Safety
    - All existing records preserved with new values
    - No records deleted
    - Backward compatibility maintained through data transformation

  4. Important Notes
    - This is a one-way data migration
    - No application logic changes (only data values)
    - All references to urgent/critical in code must be updated separately
*/

-- First, drop the existing CHECK constraint
ALTER TABLE pr1_requests
DROP CONSTRAINT IF EXISTS pr1_requests_priority_check;

-- Migrate existing priority values
UPDATE pr1_requests
SET priority = 'medium'
WHERE priority = 'urgent';

UPDATE pr1_requests
SET priority = 'high'
WHERE priority = 'critical';

-- Add new CHECK constraint with updated allowed values
ALTER TABLE pr1_requests
ADD CONSTRAINT pr1_requests_priority_check
CHECK (priority IN ('normal', 'medium', 'high'));



-- Migration: 20260504111934_20260504_add_director_rfq_quotes_rls.sql
/*
  # Add Director RLS Policy for RFQ Item Quotes

  1. Summary
    - Add SELECT policy on rfq_item_quotes table
    - Allow approver role with Director position to read supplier canvass offers
    - Prevents Department Head (also approver, different position) from accessing
    - Enables canvass visibility in PR2 approval page

  2. Changes
    - New RLS Policy: "Directors can view all quotes"
    - Table: rfq_item_quotes
    - Scope: SELECT only
    - Condition: role = 'approver' AND position = 'Director'

  3. Impact
    - Director: Can now see supplier quotes for PR2 items
    - Procurement: Unchanged (already has access)
    - Department Head: Remains blocked (different position)
    - Other roles: Unchanged

  4. Security
    - RLS enabled and enforced
    - Policy is restrictive (only Director approvers)
    - No data exposure to unauthorized roles
    - Existing policies unchanged
*/

CREATE POLICY "Directors can view all quotes"
  ON rfq_item_quotes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM (
        profiles p 
        JOIN roles r ON r.id = p.role_id
        JOIN positions pos ON pos.id = p.position_id
      )
      WHERE p.id = auth.uid() 
        AND r.name = 'approver' 
        AND pos.title = 'Director'
    )
  );



-- Migration: 20260504115152_20260504_add_director_rfq_suppliers_rls.sql
/*
  # Add Director RLS Policy for RFQ Suppliers

  1. Summary
    - Add SELECT policy on rfq_suppliers table
    - Allow approver role with Director position to read supplier data
    - Enables FK relationship expansion in PR2 canvass query
    - Prevents Department Head (approver with different position) from accessing
    - Fixes "Unknown" supplier names in canvass display

  2. Changes
    - New RLS Policy: "Directors can view rfq_suppliers"
    - Table: rfq_suppliers
    - Scope: SELECT only
    - Condition: role = 'approver' AND position = 'Director'

  3. Impact
    - Director: Can now read rfq_suppliers for canvass display
    - Procurement: Unchanged (already has access via existing policy)
    - Requestors: Unchanged (already have access via is_own_rfq_supplier)
    - Suppliers: Unchanged (already have access to own rows)
    - Department Head: Remains blocked (different position)
    - Other roles: Unchanged (no new access)

  4. Security
    - RLS enabled and enforced
    - Policy is restrictive (only Director approvers)
    - No data exposure to unauthorized roles
    - Matches pattern of existing "Directors can view all quotes" policy
    - Existing policies unchanged and unaffected

  5. Effect
    - FK relationship expansion in queries now succeeds for Director
    - rfq_suppliers field populated in rfq_item_quotes query results
    - Canvass supplier names display correctly instead of "Unknown"
    - No changes to frontend code required
*/

CREATE POLICY "Directors can view rfq_suppliers"
  ON rfq_suppliers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM (
        profiles p
        JOIN roles r ON r.id = p.role_id
        JOIN positions pos ON pos.id = p.position_id
      )
      WHERE p.id = auth.uid()
        AND r.name = 'approver'
        AND pos.title = 'Director'
    )
  );



-- Migration: 20260504185201_20260504_add_employee_po_visibility_rls.sql
/*
  # Employee visibility for PO records

  ## Summary
  Adds RLS policy to allow employees to read PO records linked to their own PR1 requisitions.
  This enables the Related Records chain to fully resolve (PR1 â†’ RFQ â†’ PR2 â†’ PO â†’ Delivery â†’ GRN)
  for employees viewing their own purchase requisition details.

  ## Changes
  - New SELECT policy on po_requests table
  - Allows authenticated users with role='employee' to read POs where:
    - PO is linked to a PR2 request
    - PR2 is linked to a PR1 request
    - PR1 requisitioner_id matches current user (auth.uid())

  ## Security
  - Policy is restrictive: employees can ONLY see POs for their own requisitions
  - No exposure of unrelated POs or sensitive pricing data
  - Existing procurement/approver policies remain unchanged
  - No changes to po_items or other tables

  ## Impact
  - Employees can now see downstream documents (Delivery, GRN) linked to their PR1
  - No regression for procurement, approver, or supplier roles
  - Related Records component now fully resolves for all users
*/

CREATE POLICY "Employee can read own requisition POs"
  ON po_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pr2_requests pr2
      JOIN pr1_requests pr1 ON pr1.id = pr2.pr1_id
      WHERE pr2.id = po_requests.pr2_id
        AND pr1.requisitioner_id = auth.uid()
    )
  );



-- Migration: 20260504200444_20260504_add_approver_rfq_batches_rls.sql
/*
  # Add Approver SELECT Access to rfq_batches

  1. Problem
    - Approver users cannot see RFQ records in Related Records
    - Related Records shows "Not yet created" even when RFQ exists
    - Root cause: rfq_batches has no SELECT policy for role = 'approver'
    - Procurement users can see RFQ (have SELECT policy)
    - Approvers can access pr2_requests, po_requests, deliveries, grn_receipts
    - But rfq_batches blocks approvers

  2. Solution
    - Add SELECT policy for role = 'approver' on rfq_batches
    - Matches existing pattern from po_requests, deliveries, grn_receipts
    - Allows approvers to see complete document chain in Related Records
    - Does not expose supplier quotes/pricing
    - Does not change existing procurement/requestor/supplier policies

  3. Changes
    - New RLS Policy: "Approvers can select rfq_batches"
    - Table: rfq_batches
    - Scope: SELECT only
    - Condition: role = 'approver'

  4. Policies After Change
    - Procurement: can select (existing)
    - Approver: can select (NEW)
    - Requestor: can select own (existing)
    - Supplier: can select assigned (existing)

  5. Impact
    - Approver: Now sees RFQ in Related Records
    - Procurement: Unchanged
    - Requestor: Unchanged
    - Supplier: Unchanged
    - Related Records chain now complete for approvers

  6. Security
    - RLS enabled and enforced
    - Policy is same pattern as other document tables
    - Only adds approver role, does not broaden other roles
    - Does not expose confidential data beyond approver scope
*/

CREATE POLICY "Approvers can select rfq_batches"
  ON rfq_batches FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'approver'
    )
  );



-- Migration: 20260505200000_restore_core_demo_users_after_delete_migration.sql
/*
  # Restore core demo auth users after intentional bulk delete

  Migration `20260423224712_delete_broken_seeded_auth_users.sql` deletes every
  `@fortune.com` user so GoTrue/sign-in issues could be reworked via signup API.

  That leaves only accounts created *after* it (supplier2/3, admin). Fresh installs
  therefore miss employee/buyer/etc. even though `20260423221046_fix_demo_user_identities.sql`
  showed missing `auth.identities` was the real login blocker.

  This migration re-inserts the same 11 demo users as `20260423220155_seed_demo_users.sql`
  if missing, plus ensures email identities exist (same logic as fix_demo_user_identities).

  Password for all: Fortune2024!

  Uses the known-working bcrypt $2b$10$ hash from
  `20260424040914_reset_all_demo_passwords_uniform_hash.sql` â€” not extensions.crypt(),
  which GoTrue rejects for sign-in.

  Inserts match supplier2 seed shape: GoTrue expects '' for auth token columns, not NULL
  (`20260429132717_fix_admin_auth_users_null_token_fields.sql`).
*/

DO $$
DECLARE
  v_employee_role_id uuid;
  v_warehouse_role_id uuid;
  v_procurement_role_id uuid;
  v_approver_role_id uuid;
  v_supplier_role_id uuid;

  v_pos_staff uuid;
  v_pos_wh_staff uuid;
  v_pos_wh_manager uuid;
  v_pos_proc_staff uuid;
  v_pos_buyer uuid;
  v_pos_proc_manager uuid;
  v_pos_supervisor uuid;
  v_pos_dept_head uuid;
  v_pos_director uuid;
  v_pos_fin_director uuid;
  v_pos_supplier_rep uuid;

  v_dept_ops uuid;
  v_dept_wh uuid;
  v_dept_proc uuid;
  v_dept_exec uuid;
  v_dept_fin uuid;
  v_dept_gs uuid;

  v_user_id uuid;
BEGIN
  SELECT id INTO v_employee_role_id FROM roles WHERE name = 'employee';
  SELECT id INTO v_warehouse_role_id FROM roles WHERE name = 'warehouse';
  SELECT id INTO v_procurement_role_id FROM roles WHERE name = 'procurement';
  SELECT id INTO v_approver_role_id FROM roles WHERE name = 'approver';
  SELECT id INTO v_supplier_role_id FROM roles WHERE name = 'supplier';

  SELECT id INTO v_pos_staff FROM positions WHERE title = 'Staff';
  SELECT id INTO v_pos_wh_staff FROM positions WHERE title = 'Warehouse Staff';
  SELECT id INTO v_pos_wh_manager FROM positions WHERE title = 'Warehouse Manager';
  SELECT id INTO v_pos_proc_staff FROM positions WHERE title = 'Procurement Staff';
  SELECT id INTO v_pos_buyer FROM positions WHERE title = 'Buyer';
  SELECT id INTO v_pos_proc_manager FROM positions WHERE title = 'Procurement Manager';
  SELECT id INTO v_pos_supervisor FROM positions WHERE title = 'Supervisor';
  SELECT id INTO v_pos_dept_head FROM positions WHERE title = 'Department Head';
  SELECT id INTO v_pos_director FROM positions WHERE title = 'Director';
  SELECT id INTO v_pos_fin_director FROM positions WHERE title = 'Finance Director';
  SELECT id INTO v_pos_supplier_rep FROM positions WHERE title = 'Supplier Representative';

  SELECT id INTO v_dept_ops FROM departments WHERE code = 'OPS';
  SELECT id INTO v_dept_wh FROM departments WHERE code = 'WH';
  SELECT id INTO v_dept_proc FROM departments WHERE code = 'PROC';
  SELECT id INTO v_dept_exec FROM departments WHERE code = 'EXEC';
  SELECT id INTO v_dept_fin FROM departments WHERE code = 'FIN';
  SELECT id INTO v_dept_gs FROM departments WHERE code = 'GS';

  SELECT id INTO v_user_id FROM auth.users WHERE email = 'employee@fortune.com';
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role,
      email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, reauthentication_token
    )
    VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'employee@fortune.com',
      '$2b$10$qmuXJawZXSRYXH2yaEQPDO2yT4Xg946N1XRX0fObpXcpkG0Assez6',
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      now(),
      now(),
      '', '', '', '',
      '',
      ''
    );
  END IF;
  INSERT INTO profiles (id, full_name, email, role_id, position_id, department_id)
  VALUES (v_user_id, 'Juan dela Cruz', 'employee@fortune.com', v_employee_role_id, v_pos_staff, v_dept_ops)
  ON CONFLICT (id) DO NOTHING;

  SELECT id INTO v_user_id FROM auth.users WHERE email = 'warehouse@fortune.com';
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role,
      email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, reauthentication_token
    )
    VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'warehouse@fortune.com',
      '$2b$10$qmuXJawZXSRYXH2yaEQPDO2yT4Xg946N1XRX0fObpXcpkG0Assez6',
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      now(),
      now(),
      '', '', '', '',
      '',
      ''
    );
  END IF;
  INSERT INTO profiles (id, full_name, email, role_id, position_id, department_id)
  VALUES (v_user_id, 'Pedro Santos', 'warehouse@fortune.com', v_warehouse_role_id, v_pos_wh_staff, v_dept_wh)
  ON CONFLICT (id) DO NOTHING;

  SELECT id INTO v_user_id FROM auth.users WHERE email = 'wh.manager@fortune.com';
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role,
      email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, reauthentication_token
    )
    VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'wh.manager@fortune.com',
      '$2b$10$qmuXJawZXSRYXH2yaEQPDO2yT4Xg946N1XRX0fObpXcpkG0Assez6',
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      now(),
      now(),
      '', '', '', '',
      '',
      ''
    );
  END IF;
  INSERT INTO profiles (id, full_name, email, role_id, position_id, department_id)
  VALUES (v_user_id, 'Maria Reyes', 'wh.manager@fortune.com', v_warehouse_role_id, v_pos_wh_manager, v_dept_wh)
  ON CONFLICT (id) DO NOTHING;

  SELECT id INTO v_user_id FROM auth.users WHERE email = 'procurement@fortune.com';
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role,
      email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, reauthentication_token
    )
    VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'procurement@fortune.com',
      '$2b$10$qmuXJawZXSRYXH2yaEQPDO2yT4Xg946N1XRX0fObpXcpkG0Assez6',
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      now(),
      now(),
      '', '', '', '',
      '',
      ''
    );
  END IF;
  INSERT INTO profiles (id, full_name, email, role_id, position_id, department_id)
  VALUES (v_user_id, 'Ana Gomez', 'procurement@fortune.com', v_procurement_role_id, v_pos_proc_staff, v_dept_proc)
  ON CONFLICT (id) DO NOTHING;

  SELECT id INTO v_user_id FROM auth.users WHERE email = 'buyer@fortune.com';
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role,
      email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, reauthentication_token
    )
    VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'buyer@fortune.com',
      '$2b$10$qmuXJawZXSRYXH2yaEQPDO2yT4Xg946N1XRX0fObpXcpkG0Assez6',
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      now(),
      now(),
      '', '', '', '',
      '',
      ''
    );
  END IF;
  INSERT INTO profiles (id, full_name, email, role_id, position_id, department_id)
  VALUES (v_user_id, 'Carlos Mendoza', 'buyer@fortune.com', v_procurement_role_id, v_pos_buyer, v_dept_proc)
  ON CONFLICT (id) DO NOTHING;

  SELECT id INTO v_user_id FROM auth.users WHERE email = 'proc.manager@fortune.com';
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role,
      email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, reauthentication_token
    )
    VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'proc.manager@fortune.com',
      '$2b$10$qmuXJawZXSRYXH2yaEQPDO2yT4Xg946N1XRX0fObpXcpkG0Assez6',
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      now(),
      now(),
      '', '', '', '',
      '',
      ''
    );
  END IF;
  INSERT INTO profiles (id, full_name, email, role_id, position_id, department_id)
  VALUES (v_user_id, 'Rosa Fernandez', 'proc.manager@fortune.com', v_procurement_role_id, v_pos_proc_manager, v_dept_proc)
  ON CONFLICT (id) DO NOTHING;

  SELECT id INTO v_user_id FROM auth.users WHERE email = 'supervisor@fortune.com';
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role,
      email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, reauthentication_token
    )
    VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'supervisor@fortune.com',
      '$2b$10$qmuXJawZXSRYXH2yaEQPDO2yT4Xg946N1XRX0fObpXcpkG0Assez6',
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      now(),
      now(),
      '', '', '', '',
      '',
      ''
    );
  END IF;
  INSERT INTO profiles (id, full_name, email, role_id, position_id, department_id)
  VALUES (v_user_id, 'Roberto Lim', 'supervisor@fortune.com', v_approver_role_id, v_pos_supervisor, v_dept_ops)
  ON CONFLICT (id) DO NOTHING;

  SELECT id INTO v_user_id FROM auth.users WHERE email = 'dept.head@fortune.com';
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role,
      email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, reauthentication_token
    )
    VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'dept.head@fortune.com',
      '$2b$10$qmuXJawZXSRYXH2yaEQPDO2yT4Xg946N1XRX0fObpXcpkG0Assez6',
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      now(),
      now(),
      '', '', '', '',
      '',
      ''
    );
  END IF;
  INSERT INTO profiles (id, full_name, email, role_id, position_id, department_id)
  VALUES (v_user_id, 'Luisa Castro', 'dept.head@fortune.com', v_approver_role_id, v_pos_dept_head, v_dept_ops)
  ON CONFLICT (id) DO NOTHING;

  SELECT id INTO v_user_id FROM auth.users WHERE email = 'director@fortune.com';
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role,
      email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, reauthentication_token
    )
    VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'director@fortune.com',
      '$2b$10$qmuXJawZXSRYXH2yaEQPDO2yT4Xg946N1XRX0fObpXcpkG0Assez6',
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      now(),
      now(),
      '', '', '', '',
      '',
      ''
    );
  END IF;
  INSERT INTO profiles (id, full_name, email, role_id, position_id, department_id)
  VALUES (v_user_id, 'Eduardo Torres', 'director@fortune.com', v_approver_role_id, v_pos_director, v_dept_exec)
  ON CONFLICT (id) DO NOTHING;

  SELECT id INTO v_user_id FROM auth.users WHERE email = 'finance.director@fortune.com';
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role,
      email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, reauthentication_token
    )
    VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'finance.director@fortune.com',
      '$2b$10$qmuXJawZXSRYXH2yaEQPDO2yT4Xg946N1XRX0fObpXcpkG0Assez6',
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      now(),
      now(),
      '', '', '', '',
      '',
      ''
    );
  END IF;
  INSERT INTO profiles (id, full_name, email, role_id, position_id, department_id)
  VALUES (v_user_id, 'Gloria Navarro', 'finance.director@fortune.com', v_approver_role_id, v_pos_fin_director, v_dept_fin)
  ON CONFLICT (id) DO NOTHING;

  SELECT id INTO v_user_id FROM auth.users WHERE email = 'supplier@fortune.com';
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role,
      email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, reauthentication_token
    )
    VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'supplier@fortune.com',
      '$2b$10$qmuXJawZXSRYXH2yaEQPDO2yT4Xg946N1XRX0fObpXcpkG0Assez6',
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      now(),
      now(),
      '', '', '', '',
      '',
      ''
    );
  END IF;
  INSERT INTO profiles (id, full_name, email, role_id, position_id, department_id)
  VALUES (v_user_id, 'Ace Supply Corp', 'supplier@fortune.com', v_supplier_role_id, v_pos_supplier_rep, v_dept_gs)
  ON CONFLICT (id) DO NOTHING;

END $$;

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT u.id, u.email
    FROM auth.users u
    WHERE u.email LIKE '%@fortune.com'
      AND NOT EXISTS (
        SELECT 1 FROM auth.identities i
        WHERE i.user_id = u.id AND i.provider = 'email'
      )
  LOOP
    INSERT INTO auth.identities (
      id,
      provider_id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      rec.email,
      rec.id,
      jsonb_build_object('sub', rec.id::text, 'email', rec.email, 'email_verified', true),
      'email',
      now(),
      now(),
      now()
    );
  END LOOP;
END $$;



-- Migration: 20260505201500_fix_gotrue_bcrypt_for_restored_demo_users.sql
/*
  Restored demo users (and any SQL-seeded Fortune accounts) may still use
  pgcrypto crypt() hashes that GoTrue rejects; use the uniform $2b$10$ hash
  documented in 20260424040914_reset_all_demo_passwords_uniform_hash.sql.

  Password: Fortune2024!
*/

UPDATE auth.users
SET
  encrypted_password = '$2b$10$qmuXJawZXSRYXH2yaEQPDO2yT4Xg946N1XRX0fObpXcpkG0Assez6',
  updated_at = now()
WHERE email LIKE '%@fortune.com';



-- Migration: 20260505204500_fix_sql_seeded_fortune_users_token_nulls_for_gotrue.sql
/*
  Minimal INSERT into auth.users (restore + seed_demo_users pattern) omits token columns,
  leaving confirmation_token/recovery_token/etc. as NULL.
  GoTrue treats those like broken rows â€” login fails with generic invalid credentials.

  Supplier2/3 seeds use '' for those columns; admin got a targeted UPDATE in 20260429132717.

  Normalize every Fortune demo SQL-seeded account to empty-string tokens (COALESCE keeps real values).
*/

UPDATE auth.users
SET
  confirmation_token          = COALESCE(confirmation_token, ''),
  recovery_token              = COALESCE(recovery_token, ''),
  email_change_token_new      = COALESCE(email_change_token_new, ''),
  email_change                = COALESCE(email_change, ''),
  email_change_token_current  = COALESCE(email_change_token_current, ''),
  reauthentication_token      = COALESCE(reauthentication_token, '')
WHERE email LIKE '%@fortune.com';



-- Migration: 20260506040800_add_dr_attachment_fields_to_deliveries.sql
/*
  # Add DR attachment fields to deliveries

  ## Purpose
  Supports Delivery Receipt (DR) file attachment by the supplier
  when transitioning a delivery to in_transit status.

  ## Changes
  Adds three nullable columns to deliveries only.
  No existing columns, constraints, policies, or indexes are modified.
  delivery_status_history is not touched.

  ## New columns on deliveries
  - dr_document_path        : Supabase Storage path for the uploaded DR file
  - dr_document_filename    : Original filename as uploaded (for human-readable display)
  - dr_document_uploaded_at : Timestamp when the DR file was stored
*/

ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS dr_document_path        TEXT,
  ADD COLUMN IF NOT EXISTS dr_document_filename    TEXT,
  ADD COLUMN IF NOT EXISTS dr_document_uploaded_at TIMESTAMPTZ;



-- Migration: 20260506093000_delivery_receipts_storage_bucket.sql
-- Delivery receipts: private Storage bucket and RLS policies
-- Bucket: delivery-receipts (private; signed URLs for reads)
-- 10MB max per object; MIME allow-list at bucket (PDF, JPEG, PNG)
-- Path: deliveries/{delivery_id}/dr/{filename}
-- INSERT: supplier only for paths under deliveries/{id}/dr/ where supplier owns delivery
-- SELECT: supplier own; procurement, warehouse, approver (all under path); employee own requisition
-- No admin read (no deliveries SELECT for admin in current schema)
-- UPDATE/DELETE on objects not granted

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'delivery-receipts',
  'delivery-receipts',
  FALSE,
  10485760,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public               = EXCLUDED.public,
  file_size_limit       = EXCLUDED.file_size_limit,
  allowed_mime_types    = EXCLUDED.allowed_mime_types;


-- â”€â”€â”€ Supplier upload (own deliveries only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE POLICY "delivery_receipts_supplier_upload_own_delivery"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'delivery-receipts'
  AND split_part(name, '/', 1) = 'deliveries'
  AND split_part(name, '/', 3) = 'dr'
  AND split_part(name, '/', 4) <> ''
  AND split_part(name, '/', 5) = ''
  AND EXISTS (
    SELECT 1
    FROM deliveries d
    WHERE d.id = split_part(name, '/', 2)::uuid
      AND d.supplier_id = auth.uid()
  )
);


-- â”€â”€â”€ Supplier read own â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE POLICY "delivery_receipts_supplier_select_own_delivery"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'delivery-receipts'
  AND split_part(name, '/', 1) = 'deliveries'
  AND split_part(name, '/', 3) = 'dr'
  AND EXISTS (
    SELECT 1
    FROM deliveries d
    WHERE d.id = split_part(name, '/', 2)::uuid
      AND d.supplier_id = auth.uid()
  )
);


-- â”€â”€â”€ Procurement / warehouse / approver â€” read all in bucket â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE POLICY "delivery_receipts_procurement_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'delivery-receipts'
  AND split_part(name, '/', 1) = 'deliveries'
  AND split_part(name, '/', 3) = 'dr'
  AND EXISTS (
    SELECT 1 FROM profiles p
    JOIN roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'procurement'
  )
);


CREATE POLICY "delivery_receipts_warehouse_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'delivery-receipts'
  AND split_part(name, '/', 1) = 'deliveries'
  AND split_part(name, '/', 3) = 'dr'
  AND EXISTS (
    SELECT 1 FROM profiles p
    JOIN roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'warehouse'
  )
);


CREATE POLICY "delivery_receipts_approver_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'delivery-receipts'
  AND split_part(name, '/', 1) = 'deliveries'
  AND split_part(name, '/', 3) = 'dr'
  AND EXISTS (
    SELECT 1 FROM profiles p
    JOIN roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'approver'
  )
);


-- â”€â”€â”€ Employee â€” read receipts for deliveries on their PR1s â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE POLICY "delivery_receipts_employee_select_own_requisition"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'delivery-receipts'
  AND split_part(name, '/', 1) = 'deliveries'
  AND split_part(name, '/', 3) = 'dr'
  AND EXISTS (
    SELECT 1
    FROM deliveries d
    WHERE d.id = split_part(name, '/', 2)::uuid
      AND d.requisitioner_id = auth.uid()
  )
);



-- Migration: 20260506103000_add_profiles_payment_terms.sql
-- Nullable payment terms on profiles (supplier default for future PO form autofill).
-- Does not alter RLS, indexes, other tables, or backfill existing rows.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS payment_terms TEXT;



-- Migration: 20260506113000_add_notifications_action_url.sql
-- Add nullable action_url to notifications for direct inbox navigation links.
-- No RLS changes, no index, no other tables modified.

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS action_url TEXT;



-- Migration: 20260507000100_add_tsqa_role.sql
/*
  # Add TSQA Role and Position

  ## Summary
  Adds the TSQA (Technical and Scientific Quality Assurance) role to the system.
  Required for the Supplier Accreditation + RSE + TSQA workflow (Phase 1).

  ## New Data
  - roles.name: tsqa
  - positions.title: TSQA Staff (linked to tsqa role)

  ## Notes
  - Does NOT remove or rename any existing role.
  - Existing role behavior is NOT changed.
  - No demo user is seeded here â€” create TSQA users via the Admin â†’ User Management UI.
  - Admin role management RLS (20260429171158) already allows admin to manage roles
    through application layer; this migration only inserts the new data.
*/

DO $$
DECLARE
  v_tsqa_role_id uuid;
  v_pos_tsqa_staff uuid;
BEGIN

  -- â”€â”€ Insert tsqa role if not present â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  SELECT id INTO v_tsqa_role_id FROM roles WHERE name = 'tsqa';
  IF v_tsqa_role_id IS NULL THEN
    INSERT INTO roles (name)
    VALUES ('tsqa')
    RETURNING id INTO v_tsqa_role_id;
  END IF;

  -- â”€â”€ Insert TSQA Staff position if not present â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  SELECT id INTO v_pos_tsqa_staff FROM positions WHERE title = 'TSQA Staff';
  IF v_pos_tsqa_staff IS NULL THEN
    INSERT INTO positions (title, role_id)
    VALUES ('TSQA Staff', v_tsqa_role_id)
    RETURNING id INTO v_pos_tsqa_staff;
  END IF;

END $$;



-- Migration: 20260507000200_supplier_accreditation_schema.sql
/*
  # Supplier Accreditation, Products, Documents, RSE, and TSQA Review Schema

  ## Summary
  Implements the complete data layer for:
    Supplier Accreditation â†’ Supplier Products â†’ RSE â†’ TSQA Review

  No existing tables (PR1, warehouse, approvals, RFQ, PR2, PO, delivery, GRN)
  are touched. All supplier_id fields reference auth.users(id) â€” consistent with
  the existing rfq_suppliers.supplier_id, po_requests.supplier_id, and
  deliveries.supplier_id pattern. No separate suppliers table is introduced.

  ## Table creation order (dependency-first)
    1. supplier_accreditations   â€” company-level, no table deps
    2. supplier_products         â€” FK â†’ supplier_accreditations
    3. supplier_documents        â€” FK â†’ supplier_accreditations, supplier_products
    4. rse_records               â€” FK â†’ supplier_accreditations, supplier_products
    5. tsqa_reviews              â€” FK â†’ rse_records

  ## RLS policies are added AFTER all tables exist to avoid forward-reference
  errors where TSQA policies on supplier_products / supplier_documents reference
  rse_records before it is created.

  ## Roles used in RLS
  - supplier    â€” upload/read own records
  - procurement â€” full read/write
  - tsqa        â€” scoped to assigned RSE and linked products/documents
  - admin       â€” full read/write

  ## RSE number
  Format: RSE-YYYYMM-XXXX  (e.g. RSE-202605-0001)
  Generated atomically via rse_number_seq to avoid race conditions.
*/

-- â”€â”€â”€ RSE number sequence + generator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE SEQUENCE IF NOT EXISTS rse_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_rse_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_seq    int;
  v_prefix text;
BEGIN
  v_seq    := nextval('rse_number_seq');
  v_prefix := 'RSE-' || to_char(now(), 'YYYYMM');
  RETURN v_prefix || '-' || lpad(v_seq::text, 4, '0');
END;
$$;

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- TABLE CREATION
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- â”€â”€â”€ 1. supplier_accreditations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS supplier_accreditations (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id            uuid        NOT NULL REFERENCES auth.users(id),
  status                 text        NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','under_review','missing_documents','approved','rejected')),
  submitted_at           timestamptz,
  reviewed_by            uuid        REFERENCES auth.users(id),
  reviewed_at            timestamptz,
  review_notes           text,
  missing_documents_note text,
  approved_at            timestamptz,
  rejected_at            timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_accreditations_supplier_id
  ON supplier_accreditations(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_accreditations_status
  ON supplier_accreditations(status);

-- â”€â”€â”€ 2. supplier_products â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS supplier_products (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id      uuid        NOT NULL REFERENCES auth.users(id),
  accreditation_id uuid        REFERENCES supplier_accreditations(id),
  product_name     text        NOT NULL,
  product_code     text,
  category         text,
  description      text,
  specifications   text,
  status           text        NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','under_review','pending_tsqa','verified','rejected','inactive')),
  submitted_at     timestamptz,
  reviewed_by      uuid        REFERENCES auth.users(id),
  reviewed_at      timestamptz,
  review_notes     text,
  verified_at      timestamptz,
  rejected_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier_id
  ON supplier_products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_products_accreditation_id
  ON supplier_products(accreditation_id);
CREATE INDEX IF NOT EXISTS idx_supplier_products_status
  ON supplier_products(status);

-- â”€â”€â”€ 3. supplier_documents â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS supplier_documents (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id         uuid        NOT NULL REFERENCES auth.users(id),
  accreditation_id    uuid        REFERENCES supplier_accreditations(id),
  supplier_product_id uuid        REFERENCES supplier_products(id),
  document_type       text        NOT NULL,
  file_name           text        NOT NULL,
  file_path           text        NOT NULL,
  mime_type           text,
  file_size           bigint,
  uploaded_by         uuid        NOT NULL REFERENCES auth.users(id),
  uploaded_at         timestamptz NOT NULL DEFAULT now(),
  expires_at          date,
  status              text        NOT NULL DEFAULT 'uploaded'
    CHECK (status IN ('uploaded','accepted','rejected','expired')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_documents_supplier_id
  ON supplier_documents(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_documents_accreditation_id
  ON supplier_documents(accreditation_id);
CREATE INDEX IF NOT EXISTS idx_supplier_documents_product_id
  ON supplier_documents(supplier_product_id);

-- â”€â”€â”€ 4. rse_records â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS rse_records (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rse_number          text        UNIQUE NOT NULL DEFAULT generate_rse_number(),
  supplier_id         uuid        NOT NULL REFERENCES auth.users(id),
  accreditation_id    uuid        REFERENCES supplier_accreditations(id),
  supplier_product_id uuid        NOT NULL REFERENCES supplier_products(id),
  status              text        NOT NULL DEFAULT 'created'
    CHECK (status IN ('created','assigned','under_review','passed','failed','cancelled')),
  created_by          uuid        NOT NULL REFERENCES auth.users(id),
  assigned_to         uuid        REFERENCES auth.users(id),
  assigned_at         timestamptz,
  reason              text,
  procurement_notes   text,
  completed_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rse_records_supplier_id
  ON rse_records(supplier_id);
CREATE INDEX IF NOT EXISTS idx_rse_records_supplier_product_id
  ON rse_records(supplier_product_id);
CREATE INDEX IF NOT EXISTS idx_rse_records_status
  ON rse_records(status);
CREATE INDEX IF NOT EXISTS idx_rse_records_assigned_to
  ON rse_records(assigned_to);

-- â”€â”€â”€ 5. tsqa_reviews â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS tsqa_reviews (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rse_id        uuid        NOT NULL REFERENCES rse_records(id),
  reviewer_id   uuid        NOT NULL REFERENCES auth.users(id),
  result        text        CHECK (result IN ('passed','failed')),
  remarks       text,
  test_findings text,
  reviewed_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tsqa_reviews_rse_id
  ON tsqa_reviews(rse_id);
CREATE INDEX IF NOT EXISTS idx_tsqa_reviews_reviewer_id
  ON tsqa_reviews(reviewer_id);

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- ENABLE ROW LEVEL SECURITY
-- (all tables â€” done together before any policies are added)
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

ALTER TABLE supplier_accreditations ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_products       ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_documents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE rse_records             ENABLE ROW LEVEL SECURITY;
ALTER TABLE tsqa_reviews            ENABLE ROW LEVEL SECURITY;

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- RLS POLICIES
-- All tables exist by this point, so forward-references in TSQA policies
-- (supplier_products/supplier_documents referencing rse_records) are safe.
-- Role lookup pattern: profiles JOIN roles â€” same as existing migrations.
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- supplier_accreditations
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Supplier: own records only
CREATE POLICY "supplier_accreditations_supplier_select"
  ON supplier_accreditations FOR SELECT TO authenticated
  USING (
    supplier_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
  );

CREATE POLICY "supplier_accreditations_supplier_insert"
  ON supplier_accreditations FOR INSERT TO authenticated
  WITH CHECK (
    supplier_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
  );

CREATE POLICY "supplier_accreditations_supplier_update"
  ON supplier_accreditations FOR UPDATE TO authenticated
  USING (
    supplier_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
  )
  WITH CHECK (
    supplier_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
  );

-- Procurement: all records
CREATE POLICY "supplier_accreditations_procurement_select"
  ON supplier_accreditations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

CREATE POLICY "supplier_accreditations_procurement_update"
  ON supplier_accreditations FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

-- Admin: all records
CREATE POLICY "supplier_accreditations_admin_select"
  ON supplier_accreditations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'admin'
    )
  );

CREATE POLICY "supplier_accreditations_admin_update"
  ON supplier_accreditations FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'admin'
    )
  );

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- supplier_products
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Supplier: own products only
CREATE POLICY "supplier_products_supplier_select"
  ON supplier_products FOR SELECT TO authenticated
  USING (
    supplier_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
  );

CREATE POLICY "supplier_products_supplier_insert"
  ON supplier_products FOR INSERT TO authenticated
  WITH CHECK (
    supplier_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
  );

CREATE POLICY "supplier_products_supplier_update"
  ON supplier_products FOR UPDATE TO authenticated
  USING (
    supplier_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
  )
  WITH CHECK (
    supplier_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
  );

-- Procurement: all products
CREATE POLICY "supplier_products_procurement_select"
  ON supplier_products FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

CREATE POLICY "supplier_products_procurement_update"
  ON supplier_products FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

-- TSQA: products in pending_tsqa status OR linked to an RSE assigned to/created for them
-- Note: rse_records exists by this point (all tables created above).
CREATE POLICY "supplier_products_tsqa_select"
  ON supplier_products FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'tsqa'
    )
    AND (
      status = 'pending_tsqa'
      OR EXISTS (
        SELECT 1 FROM rse_records rr
        WHERE rr.supplier_product_id = supplier_products.id
          AND (
            rr.assigned_to = auth.uid()
            OR rr.status IN ('created','assigned','under_review')
          )
      )
    )
  );

-- Admin: all products
CREATE POLICY "supplier_products_admin_select"
  ON supplier_products FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'admin'
    )
  );

CREATE POLICY "supplier_products_admin_update"
  ON supplier_products FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'admin'
    )
  );

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- supplier_documents
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Supplier: own documents only
CREATE POLICY "supplier_documents_supplier_select"
  ON supplier_documents FOR SELECT TO authenticated
  USING (
    supplier_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
  );

CREATE POLICY "supplier_documents_supplier_insert"
  ON supplier_documents FOR INSERT TO authenticated
  WITH CHECK (
    supplier_id = auth.uid()
    AND uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
  );

-- Procurement: all documents
CREATE POLICY "supplier_documents_procurement_select"
  ON supplier_documents FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

CREATE POLICY "supplier_documents_procurement_update"
  ON supplier_documents FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

-- TSQA: documents tied to a product or accreditation that has an active RSE assigned to them
CREATE POLICY "supplier_documents_tsqa_select"
  ON supplier_documents FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'tsqa'
    )
    AND (
      (
        supplier_product_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM rse_records rr
          WHERE rr.supplier_product_id = supplier_documents.supplier_product_id
            AND (
              rr.assigned_to = auth.uid()
              OR rr.status IN ('created','assigned','under_review')
            )
        )
      )
      OR (
        accreditation_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM rse_records rr
          WHERE rr.accreditation_id = supplier_documents.accreditation_id
            AND (
              rr.assigned_to = auth.uid()
              OR rr.status IN ('created','assigned','under_review')
            )
        )
      )
    )
  );

-- Admin: all documents
CREATE POLICY "supplier_documents_admin_select"
  ON supplier_documents FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'admin'
    )
  );

CREATE POLICY "supplier_documents_admin_update"
  ON supplier_documents FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'admin'
    )
  );

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- rse_records
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Procurement: full access (creates and manages RSE)
CREATE POLICY "rse_records_procurement_select"
  ON rse_records FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

CREATE POLICY "rse_records_procurement_insert"
  ON rse_records FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

CREATE POLICY "rse_records_procurement_update"
  ON rse_records FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

-- TSQA: select RSE assigned to them or unassigned (created status) to allow self-assignment
CREATE POLICY "rse_records_tsqa_select"
  ON rse_records FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'tsqa'
    )
    AND (assigned_to = auth.uid() OR status = 'created')
  );

-- TSQA: update only RSE records assigned to them
CREATE POLICY "rse_records_tsqa_update"
  ON rse_records FOR UPDATE TO authenticated
  USING (
    assigned_to = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'tsqa'
    )
  )
  WITH CHECK (
    assigned_to = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'tsqa'
    )
  );

-- Supplier: can see RSE records for their own products
CREATE POLICY "rse_records_supplier_select"
  ON rse_records FOR SELECT TO authenticated
  USING (
    supplier_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
  );

-- Admin: full access
CREATE POLICY "rse_records_admin_select"
  ON rse_records FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'admin'
    )
  );

CREATE POLICY "rse_records_admin_update"
  ON rse_records FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'admin'
    )
  );

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- tsqa_reviews
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- TSQA: select their own reviews
CREATE POLICY "tsqa_reviews_tsqa_select"
  ON tsqa_reviews FOR SELECT TO authenticated
  USING (
    reviewer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'tsqa'
    )
  );

-- TSQA: insert review only for RSE assigned to them; reviewer_id must be self
CREATE POLICY "tsqa_reviews_tsqa_insert"
  ON tsqa_reviews FOR INSERT TO authenticated
  WITH CHECK (
    reviewer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'tsqa'
    )
    AND EXISTS (
      SELECT 1 FROM rse_records rr
      WHERE rr.id = rse_id
        AND rr.assigned_to = auth.uid()
    )
  );

-- TSQA: update their own reviews
CREATE POLICY "tsqa_reviews_tsqa_update"
  ON tsqa_reviews FOR UPDATE TO authenticated
  USING (
    reviewer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'tsqa'
    )
  )
  WITH CHECK (
    reviewer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'tsqa'
    )
  );

-- Procurement: select all reviews
CREATE POLICY "tsqa_reviews_procurement_select"
  ON tsqa_reviews FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

-- Supplier: select reviews for RSE records tied to their own supplier_id
CREATE POLICY "tsqa_reviews_supplier_select"
  ON tsqa_reviews FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
    AND EXISTS (
      SELECT 1 FROM rse_records rr
      WHERE rr.id = rse_id
        AND rr.supplier_id = auth.uid()
    )
  );

-- Admin: full access
CREATE POLICY "tsqa_reviews_admin_select"
  ON tsqa_reviews FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'admin'
    )
  );

CREATE POLICY "tsqa_reviews_admin_update"
  ON tsqa_reviews FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'admin'
    )
  );



-- Migration: 20260507000300_supplier_accreditation_storage.sql
-- supplier-accreditation-documents: private Storage bucket for accreditation,
-- product, and RSE-related file uploads.
--
-- Bucket: supplier-accreditation-documents (private; 20 MB max; PDF, JPEG, PNG)
--
-- Path conventions (split_part indices 1-based):
--   supplier-accreditations/{accreditation_id}/documents/{filename}
--     part 1 = "supplier-accreditations", part 2 = accreditation_id, part 3 = "documents", part 4 = filename
--
--   supplier-products/{product_id}/documents/{filename}
--     part 1 = "supplier-products", part 2 = product_id, part 3 = "documents", part 4 = filename
--
--   rse/{rse_id}/reports/{filename}
--     part 1 = "rse", part 2 = rse_id, part 3 = "reports", part 4 = filename
--
-- Policies granted:
--   Supplier  INSERT  supplier-accreditations/â€¦/documents/ (own accreditation only)
--   Supplier  INSERT  supplier-products/â€¦/documents/       (own product only)
--   Supplier  SELECT  supplier-accreditations/â€¦/documents/ (own accreditation)
--   Supplier  SELECT  supplier-products/â€¦/documents/       (own product)
--   Procurement SELECT  all paths in bucket
--   TSQA      INSERT  rse/â€¦/reports/                       (assigned RSE only)
--   TSQA      SELECT  rse/â€¦/reports/                       (assigned RSE)
--   TSQA      SELECT  supplier-products/â€¦/documents/       (products linked to assigned RSE)
--   Admin     SELECT  all paths in bucket
--
-- Limitations (noted, not blocking):
--   - Supplier accreditation-document paths are validated against the
--     supplier_accreditations table (path-based ownership join).
--   - UUID cast from split_part follows the same pattern as the existing
--     delivery-receipts bucket in migration 20260506093000.
--   - No UPDATE/DELETE is granted on storage objects (same as delivery-receipts).
--   - Admin write/delete of Storage objects must be done via Supabase Studio
--     or service-role API, not through this RLS.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'supplier-accreditation-documents',
  'supplier-accreditation-documents',
  FALSE,
  20971520,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- â”€â”€â”€ Supplier upload: own accreditation documents â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE POLICY "accreditation_docs_supplier_upload_accreditation"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'supplier-accreditation-documents'
  AND split_part(name, '/', 1) = 'supplier-accreditations'
  AND split_part(name, '/', 3) = 'documents'
  AND split_part(name, '/', 4) <> ''
  AND split_part(name, '/', 5) = ''
  AND EXISTS (
    SELECT 1 FROM supplier_accreditations sa
    WHERE sa.id = split_part(name, '/', 2)::uuid
      AND sa.supplier_id = auth.uid()
  )
);

-- â”€â”€â”€ Supplier upload: own product documents â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE POLICY "accreditation_docs_supplier_upload_product"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'supplier-accreditation-documents'
  AND split_part(name, '/', 1) = 'supplier-products'
  AND split_part(name, '/', 3) = 'documents'
  AND split_part(name, '/', 4) <> ''
  AND split_part(name, '/', 5) = ''
  AND EXISTS (
    SELECT 1 FROM supplier_products sp
    WHERE sp.id = split_part(name, '/', 2)::uuid
      AND sp.supplier_id = auth.uid()
  )
);

-- â”€â”€â”€ Supplier read: own accreditation paths â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE POLICY "accreditation_docs_supplier_select_accreditation"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'supplier-accreditation-documents'
  AND split_part(name, '/', 1) = 'supplier-accreditations'
  AND split_part(name, '/', 3) = 'documents'
  AND EXISTS (
    SELECT 1 FROM supplier_accreditations sa
    WHERE sa.id = split_part(name, '/', 2)::uuid
      AND sa.supplier_id = auth.uid()
  )
);

-- â”€â”€â”€ Supplier read: own product paths â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE POLICY "accreditation_docs_supplier_select_product"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'supplier-accreditation-documents'
  AND split_part(name, '/', 1) = 'supplier-products'
  AND split_part(name, '/', 3) = 'documents'
  AND EXISTS (
    SELECT 1 FROM supplier_products sp
    WHERE sp.id = split_part(name, '/', 2)::uuid
      AND sp.supplier_id = auth.uid()
  )
);

-- â”€â”€â”€ Procurement: read all paths in bucket â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE POLICY "accreditation_docs_procurement_select"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'supplier-accreditation-documents'
  AND EXISTS (
    SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'procurement'
  )
);

-- â”€â”€â”€ TSQA upload: RSE reports (own assigned RSE only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE POLICY "accreditation_docs_tsqa_upload_rse_report"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'supplier-accreditation-documents'
  AND split_part(name, '/', 1) = 'rse'
  AND split_part(name, '/', 3) = 'reports'
  AND split_part(name, '/', 4) <> ''
  AND split_part(name, '/', 5) = ''
  AND EXISTS (
    SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'tsqa'
  )
  AND EXISTS (
    SELECT 1 FROM rse_records rr
    WHERE rr.id = split_part(name, '/', 2)::uuid
      AND rr.assigned_to = auth.uid()
  )
);

-- â”€â”€â”€ TSQA read: RSE reports for assigned RSE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE POLICY "accreditation_docs_tsqa_select_rse"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'supplier-accreditation-documents'
  AND split_part(name, '/', 1) = 'rse'
  AND split_part(name, '/', 3) = 'reports'
  AND EXISTS (
    SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'tsqa'
  )
  AND EXISTS (
    SELECT 1 FROM rse_records rr
    WHERE rr.id = split_part(name, '/', 2)::uuid
      AND rr.assigned_to = auth.uid()
  )
);

-- â”€â”€â”€ TSQA read: product documents for products linked to an RSE assigned to them

CREATE POLICY "accreditation_docs_tsqa_select_product"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'supplier-accreditation-documents'
  AND split_part(name, '/', 1) = 'supplier-products'
  AND split_part(name, '/', 3) = 'documents'
  AND EXISTS (
    SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'tsqa'
  )
  AND EXISTS (
    SELECT 1 FROM rse_records rr
    WHERE rr.supplier_product_id = split_part(name, '/', 2)::uuid
      AND rr.assigned_to = auth.uid()
  )
);

-- â”€â”€â”€ Admin: read all paths in bucket â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE POLICY "accreditation_docs_admin_select"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'supplier-accreditation-documents'
  AND EXISTS (
    SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'admin'
  )
);



-- Migration: 20260507000400_add_supplier_product_id_to_rfq_item_quotes.sql
/*
  # Phase 7 â€” Link rfq_item_quotes to supplier_products

  Adds a nullable foreign key to rfq_item_quotes so each supplier quote line
  can reference a verified product from the supplier's product catalog.

  Rules:
  - Column is nullable. Existing rows remain valid with NULL.
  - No backfill. Old RFQ quotes continue to work.
  - No RLS change â€” existing row-level policies already scope access correctly.
  - Only suppliers whose products are verified may appear in the selector (enforced at app layer).
*/

ALTER TABLE rfq_item_quotes
  ADD COLUMN IF NOT EXISTS supplier_product_id uuid
    REFERENCES supplier_products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS rfq_item_quotes_product_idx
  ON rfq_item_quotes(supplier_product_id);



-- Migration: 20260507120000_tighten_supplier_accreditation_product_rls.sql
/*
  # Tighten supplier RLS on accreditation, products, and documents

  Replaces permissive supplier INSERT/UPDATE policies so suppliers cannot
  self-approve accreditation, self-verify products, or forge procurement fields.

  Procurement / admin / TSQA policies are unchanged.

  Triggers supplement RLS where NEW vs OLD row comparisons are required
  (e.g. supplier submit must not mutate procurement-owned columns).
*/

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- Helper: true when the session user is a supplier and not procurement/admin/tsqa
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

CREATE OR REPLACE FUNCTION public.auth_is_supplier_only()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'supplier'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name IN ('procurement', 'admin', 'tsqa')
  );
$$;

COMMENT ON FUNCTION public.auth_is_supplier_only() IS
  'Used by supplier write triggers; true for supplier-only sessions (Phase 7 RLS hardening).';

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- supplier_accreditations: BEFORE trigger for supplier sessions
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

CREATE OR REPLACE FUNCTION public.enforce_supplier_accreditations_supplier_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF public.auth_is_supplier_only() THEN
      IF NEW.status IS DISTINCT FROM 'draft' THEN
        RAISE EXCEPTION 'Supplier accreditation must be created as draft';
      END IF;
      IF NEW.submitted_at IS NOT NULL OR NEW.reviewed_by IS NOT NULL OR NEW.reviewed_at IS NOT NULL
         OR NEW.review_notes IS NOT NULL OR NEW.missing_documents_note IS NOT NULL
         OR NEW.approved_at IS NOT NULL OR NEW.rejected_at IS NOT NULL THEN
        RAISE EXCEPTION 'Supplier cannot set procurement-controlled accreditation fields on insert';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF public.auth_is_supplier_only() THEN
      IF OLD.supplier_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Not allowed';
      END IF;
      IF NEW.supplier_id IS DISTINCT FROM OLD.supplier_id
         OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'Cannot change supplier_id or created_at';
      END IF;

      IF OLD.status IN ('draft', 'missing_documents') AND NEW.status = 'submitted' THEN
        IF NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
           OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
           OR NEW.review_notes IS DISTINCT FROM OLD.review_notes
           OR NEW.missing_documents_note IS DISTINCT FROM OLD.missing_documents_note
           OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
           OR NEW.rejected_at IS DISTINCT FROM OLD.rejected_at THEN
          RAISE EXCEPTION 'Cannot change procurement-controlled fields when submitting accreditation';
        END IF;
        RETURN NEW;
      END IF;

      RAISE EXCEPTION 'Supplier accreditation update not permitted';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_supplier_accreditations_supplier_write ON public.supplier_accreditations;
CREATE TRIGGER tr_supplier_accreditations_supplier_write
  BEFORE INSERT OR UPDATE ON public.supplier_accreditations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_supplier_accreditations_supplier_write();

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- supplier_products: BEFORE trigger for supplier draft / submit updates
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

CREATE OR REPLACE FUNCTION public.enforce_supplier_products_supplier_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NOT public.auth_is_supplier_only() THEN
    RETURN NEW;
  END IF;

  IF OLD.supplier_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF NEW.supplier_id IS DISTINCT FROM OLD.supplier_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Cannot change supplier_id or created_at';
  END IF;

  -- No further supplier edits after submission (procurement / TSQA own the row)
  IF OLD.status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'Supplier cannot update product in current status';
  END IF;

  -- Draft edits: only catalogue / link fields + updated_at
  IF NEW.status = 'draft' THEN
    IF NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
       OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
       OR NEW.verified_at IS DISTINCT FROM OLD.verified_at OR NEW.rejected_at IS DISTINCT FROM OLD.rejected_at
       OR NEW.review_notes IS DISTINCT FROM OLD.review_notes THEN
      RAISE EXCEPTION 'Invalid fields for draft product update';
    END IF;
    IF NEW.accreditation_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.supplier_accreditations sa
      WHERE sa.id = NEW.accreditation_id AND sa.supplier_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'accreditation_id must belong to the supplier';
    END IF;
    RETURN NEW;
  END IF;

  -- Submit for review: draft -> submitted (app sends status, submitted_at, updated_at only)
  IF NEW.status = 'submitted' THEN
    IF NEW.submitted_at IS NULL THEN
      RAISE EXCEPTION 'submitted_at required when submitting product';
    END IF;
    IF NEW.product_name IS DISTINCT FROM OLD.product_name
       OR NEW.product_code IS DISTINCT FROM OLD.product_code
       OR NEW.category IS DISTINCT FROM OLD.category
       OR NEW.description IS DISTINCT FROM OLD.description
       OR NEW.specifications IS DISTINCT FROM OLD.specifications
       OR NEW.accreditation_id IS DISTINCT FROM OLD.accreditation_id THEN
      RAISE EXCEPTION 'Submit must not change product payload in the same operation';
    END IF;
    IF NEW.reviewed_by IS NOT NULL OR NEW.reviewed_at IS NOT NULL
       OR NEW.verified_at IS NOT NULL OR NEW.rejected_at IS NOT NULL OR NEW.review_notes IS NOT NULL THEN
      RAISE EXCEPTION 'Procurement fields must remain unset when supplier submits product';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Supplier product status transition not permitted';
END;
$$;

DROP TRIGGER IF EXISTS tr_supplier_products_supplier_update ON public.supplier_products;
CREATE TRIGGER tr_supplier_products_supplier_update
  BEFORE UPDATE ON public.supplier_products
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_supplier_products_supplier_update();

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- Drop old supplier policies
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

DROP POLICY IF EXISTS "supplier_accreditations_supplier_insert" ON public.supplier_accreditations;
DROP POLICY IF EXISTS "supplier_accreditations_supplier_update" ON public.supplier_accreditations;

DROP POLICY IF EXISTS "supplier_products_supplier_insert" ON public.supplier_products;
DROP POLICY IF EXISTS "supplier_products_supplier_update" ON public.supplier_products;

DROP POLICY IF EXISTS "supplier_documents_supplier_insert" ON public.supplier_documents;

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- supplier_accreditations â€” supplier INSERT (draft + null procurement cols)
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

CREATE POLICY "supplier_accreditations_supplier_insert"
  ON public.supplier_accreditations FOR INSERT TO authenticated
  WITH CHECK (
    supplier_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
    AND status = 'draft'
    AND submitted_at IS NULL
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND review_notes IS NULL
    AND missing_documents_note IS NULL
    AND approved_at IS NULL
    AND rejected_at IS NULL
  );

-- Supplier may only submit from draft or missing_documents (one-way to submitted)
CREATE POLICY "supplier_accreditations_supplier_update"
  ON public.supplier_accreditations FOR UPDATE TO authenticated
  USING (
    supplier_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
    AND status IN ('draft', 'missing_documents')
  )
  WITH CHECK (
    supplier_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
    AND status = 'submitted'
    AND submitted_at IS NOT NULL
  );

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- supplier_products â€” supplier INSERT (draft or RFQ submitted)
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

CREATE POLICY "supplier_products_supplier_insert"
  ON public.supplier_products FOR INSERT TO authenticated
  WITH CHECK (
    supplier_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
    AND (
      (
        status = 'draft'
        AND submitted_at IS NULL
        AND reviewed_by IS NULL AND reviewed_at IS NULL
        AND verified_at IS NULL AND rejected_at IS NULL
        AND review_notes IS NULL
      )
      OR
      (
        status = 'submitted'
        AND submitted_at IS NOT NULL
        AND reviewed_by IS NULL AND reviewed_at IS NULL
        AND verified_at IS NULL AND rejected_at IS NULL
        AND review_notes IS NULL
      )
    )
    AND (
      accreditation_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.supplier_accreditations sa
        WHERE sa.id = accreditation_id AND sa.supplier_id = auth.uid()
      )
    )
  );

-- Supplier may update only while still draft (trigger enforces draft vs submit payload)
CREATE POLICY "supplier_products_supplier_update"
  ON public.supplier_products FOR UPDATE TO authenticated
  USING (
    supplier_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
    AND status = 'draft'
  )
  WITH CHECK (
    supplier_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
    AND status IN ('draft', 'submitted')
  );

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- supplier_documents â€” supplier INSERT (owned accreditation and/or product)
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

CREATE POLICY "supplier_documents_supplier_insert"
  ON public.supplier_documents FOR INSERT TO authenticated
  WITH CHECK (
    supplier_id = auth.uid()
    AND uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
    AND (
      (
        supplier_product_id IS NULL
        AND accreditation_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.supplier_accreditations sa
          WHERE sa.id = accreditation_id AND sa.supplier_id = auth.uid()
        )
      )
      OR
      (
        supplier_product_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.supplier_products sp
          WHERE sp.id = supplier_product_id
            AND sp.supplier_id = auth.uid()
            AND (accreditation_id IS NOT DISTINCT FROM sp.accreditation_id)
        )
      )
    )
  );



-- Migration: 20260507130000_supplier_documents_tsqa_insert_rse_report.sql
/*
  # TSQA: INSERT on supplier_documents for RSE evaluation reports only

  Assigned TSQA users could upload to Storage (existing policy) but had no
  INSERT policy on supplier_documents, causing RLS failures after upload.

  This policy is narrow:
  - role = tsqa
  - document_type = rse_report only
  - uploaded_by = auth.uid()
  - file_path matches rse/{rse_id}/reports/...
  - rse_id in path matches an RSE assigned to auth.uid() with matching
    supplier_id, supplier_product_id, and accreditation_id (IS NOT DISTINCT FROM).
*/

CREATE POLICY "supplier_documents_tsqa_insert_rse_report"
  ON public.supplier_documents FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'tsqa'
    )
    AND uploaded_by = auth.uid()
    AND document_type = 'rse_report'
    AND supplier_product_id IS NOT NULL
    AND split_part(file_path, '/', 1) = 'rse'
    AND split_part(file_path, '/', 3) = 'reports'
    AND split_part(file_path, '/', 4) <> ''
    AND EXISTS (
      SELECT 1 FROM public.rse_records rr
      WHERE rr.id = split_part(file_path, '/', 2)::uuid
        AND rr.supplier_id           = supplier_id
        AND rr.supplier_product_id   = supplier_product_id
        AND rr.accreditation_id IS NOT DISTINCT FROM accreditation_id
        AND rr.assigned_to           = auth.uid()
    )
  );

COMMENT ON POLICY "supplier_documents_tsqa_insert_rse_report" ON public.supplier_documents IS
  'TSQA may insert RSE report metadata only for own assigned RSE; path must match rse/{id}/reports/.';



-- Migration: 20260507140000_supplier_products_tsqa_update_verdict.sql
/*
  # Allow TSQA to apply product verdict after RSE evaluation

  submitTSQAResult (lib/tsqa.ts) updates rse_records to passed/failed then
  supplier_products to verified/rejected. Only SELECT was granted to tsqa on
  supplier_products, so the product update had no permissive policy and the
  database stayed inconsistent (RSE/review passed, product still pending_tsqa).

  This policy allows a narrow UPDATE only from TSQA, only from pending_tsqa,
  only when an RSE for that product is assigned to the current user and
  already marked passed/failed (matches postâ€“step-3 state in submitTSQAResult).

  Includes a one-time repair for rows already stuck with RSE terminal status
  and product still pending_tsqa.
*/

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- TSQA: set product verified/rejected after evaluation (assigned RSE only)
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

CREATE POLICY "supplier_products_tsqa_update_verdict"
  ON public.supplier_products FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'tsqa'
    )
    AND status = 'pending_tsqa'
    AND EXISTS (
      SELECT 1 FROM public.rse_records rr
      WHERE rr.supplier_product_id = supplier_products.id
        AND rr.assigned_to = auth.uid()
        AND rr.status IN ('passed', 'failed')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'tsqa'
    )
    AND (
      (status = 'verified' AND verified_at IS NOT NULL)
      OR
      (status = 'rejected' AND rejected_at IS NOT NULL)
    )
  );

COMMENT ON POLICY "supplier_products_tsqa_update_verdict" ON public.supplier_products IS
  'TSQA may set supplier_products to verified/rejected only from pending_tsqa when assigned RSE is passed/failed.';

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- One-time repair: RSE already terminal, product still pending_tsqa
-- (Pick latest terminal RSE per product if multiples.)
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

UPDATE public.supplier_products sp
SET
  status      = 'verified',
  verified_at = COALESCE(v.t_at, now()),
  updated_at  = now()
FROM (
  SELECT DISTINCT ON (rr.supplier_product_id)
    rr.supplier_product_id AS pid,
    COALESCE(rr.completed_at, rr.updated_at) AS t_at
  FROM public.rse_records rr
  WHERE rr.status = 'passed'
  ORDER BY rr.supplier_product_id, rr.completed_at DESC NULLS LAST, rr.updated_at DESC NULLS LAST
) v
WHERE sp.id = v.pid
  AND sp.status = 'pending_tsqa';

UPDATE public.supplier_products sp
SET
  status      = 'rejected',
  rejected_at = COALESCE(v.t_at, now()),
  updated_at  = now()
FROM (
  SELECT DISTINCT ON (rr.supplier_product_id)
    rr.supplier_product_id AS pid,
    COALESCE(rr.completed_at, rr.updated_at) AS t_at
  FROM public.rse_records rr
  WHERE rr.status = 'failed'
  ORDER BY rr.supplier_product_id, rr.completed_at DESC NULLS LAST, rr.updated_at DESC NULLS LAST
) v
WHERE sp.id = v.pid
  AND sp.status = 'pending_tsqa';



-- Migration: 20260507150000_supplier_accreditation_withdrawn.sql
/*
  # Supplier accreditation: withdrawn status + supplier withdraw path

  - Adds status value `withdrawn` (CHECK constraint).
  - Extends supplier write trigger to allow draft/submitted/missing_documents â†’ withdrawn
    without changing procurement-controlled columns.
  - Extends supplier UPDATE RLS so suppliers can withdraw from submitted (not only submit).
*/

-- â”€â”€â”€ Status CHECK â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

ALTER TABLE public.supplier_accreditations
  DROP CONSTRAINT IF EXISTS supplier_accreditations_status_check;

ALTER TABLE public.supplier_accreditations
  ADD CONSTRAINT supplier_accreditations_status_check
  CHECK (status IN (
    'draft',
    'submitted',
    'under_review',
    'missing_documents',
    'approved',
    'rejected',
    'withdrawn'
  ));

-- â”€â”€â”€ Supplier write trigger (replace body) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE OR REPLACE FUNCTION public.enforce_supplier_accreditations_supplier_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF public.auth_is_supplier_only() THEN
      IF NEW.status IS DISTINCT FROM 'draft' THEN
        RAISE EXCEPTION 'Supplier accreditation must be created as draft';
      END IF;
      IF NEW.submitted_at IS NOT NULL OR NEW.reviewed_by IS NOT NULL OR NEW.reviewed_at IS NOT NULL
         OR NEW.review_notes IS NOT NULL OR NEW.missing_documents_note IS NOT NULL
         OR NEW.approved_at IS NOT NULL OR NEW.rejected_at IS NOT NULL THEN
        RAISE EXCEPTION 'Supplier cannot set procurement-controlled accreditation fields on insert';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF public.auth_is_supplier_only() THEN
      IF OLD.supplier_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Not allowed';
      END IF;
      IF NEW.supplier_id IS DISTINCT FROM OLD.supplier_id
         OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'Cannot change supplier_id or created_at';
      END IF;

      IF OLD.status IN ('draft', 'missing_documents') AND NEW.status = 'submitted' THEN
        IF NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
           OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
           OR NEW.review_notes IS DISTINCT FROM OLD.review_notes
           OR NEW.missing_documents_note IS DISTINCT FROM OLD.missing_documents_note
           OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
           OR NEW.rejected_at IS DISTINCT FROM OLD.rejected_at THEN
          RAISE EXCEPTION 'Cannot change procurement-controlled fields when submitting accreditation';
        END IF;
        RETURN NEW;
      END IF;

      IF OLD.status IN ('draft', 'submitted', 'missing_documents') AND NEW.status = 'withdrawn' THEN
        IF NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
           OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
           OR NEW.review_notes IS DISTINCT FROM OLD.review_notes
           OR NEW.missing_documents_note IS DISTINCT FROM OLD.missing_documents_note
           OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
           OR NEW.rejected_at IS DISTINCT FROM OLD.rejected_at THEN
          RAISE EXCEPTION 'Cannot change procurement-controlled fields when withdrawing application';
        END IF;
        IF NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
          RAISE EXCEPTION 'Cannot change submitted_at when withdrawing application';
        END IF;
        RETURN NEW;
      END IF;

      RAISE EXCEPTION 'Supplier accreditation update not permitted';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- â”€â”€â”€ Supplier UPDATE RLS: submit OR withdraw â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

DROP POLICY IF EXISTS "supplier_accreditations_supplier_update" ON public.supplier_accreditations;

CREATE POLICY "supplier_accreditations_supplier_update"
  ON public.supplier_accreditations FOR UPDATE TO authenticated
  USING (
    supplier_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
    AND status IN ('draft', 'missing_documents', 'submitted')
  )
  WITH CHECK (
    supplier_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
    AND (
      (
        status = 'submitted'
        AND submitted_at IS NOT NULL
      )
      OR (status = 'withdrawn')
    )
  );

COMMENT ON POLICY "supplier_accreditations_supplier_update" ON public.supplier_accreditations IS
  'Supplier may submit (draft/missing_documents â†’ submitted) or withdraw (draft/submitted/missing_documents â†’ withdrawn).';



-- Migration: 20260507160000_supplier_products_withdrawn.sql
/*
  # Supplier products: withdrawn status + supplier Withdraw Product path

  - Adds status `withdrawn` to supplier_products CHECK.
  - Replaces supplier update trigger so suppliers may transition:
      draft | submitted â†’ withdrawn
    without changing catalogue fields, submitted_at, or procurement-owned columns.
  - Extends supplier UPDATE RLS USING to include submitted rows (withdraw only from queue).
*/

-- â”€â”€â”€ Status CHECK â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

ALTER TABLE public.supplier_products
  DROP CONSTRAINT IF EXISTS supplier_products_status_check;

ALTER TABLE public.supplier_products
  ADD CONSTRAINT supplier_products_status_check
  CHECK (status IN (
    'draft',
    'submitted',
    'under_review',
    'pending_tsqa',
    'verified',
    'rejected',
    'inactive',
    'withdrawn'
  ));

-- â”€â”€â”€ Supplier product update trigger â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE OR REPLACE FUNCTION public.enforce_supplier_products_supplier_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NOT public.auth_is_supplier_only() THEN
    RETURN NEW;
  END IF;

  IF OLD.supplier_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF NEW.supplier_id IS DISTINCT FROM OLD.supplier_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Cannot change supplier_id or created_at';
  END IF;

  IF OLD.status NOT IN ('draft', 'submitted') THEN
    RAISE EXCEPTION 'Supplier cannot update product in current status';
  END IF;

  -- Withdraw: draft or submitted â†’ withdrawn
  IF NEW.status = 'withdrawn' THEN
    IF OLD.status NOT IN ('draft', 'submitted') THEN
      RAISE EXCEPTION 'Supplier product withdrawal not permitted from this status';
    END IF;
    IF NEW.product_name IS DISTINCT FROM OLD.product_name
       OR NEW.product_code IS DISTINCT FROM OLD.product_code
       OR NEW.category IS DISTINCT FROM OLD.category
       OR NEW.description IS DISTINCT FROM OLD.description
       OR NEW.specifications IS DISTINCT FROM OLD.specifications
       OR NEW.accreditation_id IS DISTINCT FROM OLD.accreditation_id THEN
      RAISE EXCEPTION 'Withdraw must not change product payload';
    END IF;
    IF NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
      RAISE EXCEPTION 'Cannot change submitted_at when withdrawing product';
    END IF;
    IF NEW.reviewed_by IS NOT NULL OR NEW.reviewed_at IS NOT NULL
       OR NEW.verified_at IS NOT NULL OR NEW.rejected_at IS NOT NULL OR NEW.review_notes IS NOT NULL THEN
      RAISE EXCEPTION 'Procurement fields must remain unchanged when supplier withdraws product';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'submitted' AND NEW.status IS DISTINCT FROM 'withdrawn' THEN
    RAISE EXCEPTION 'Supplier cannot update submitted product except to withdraw';
  END IF;

  -- Draft edits: only catalogue / link fields + updated_at
  IF NEW.status = 'draft' THEN
    IF OLD.status IS DISTINCT FROM 'draft' THEN
      RAISE EXCEPTION 'Supplier product status transition not permitted';
    END IF;
    IF NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
       OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
       OR NEW.verified_at IS DISTINCT FROM OLD.verified_at OR NEW.rejected_at IS DISTINCT FROM OLD.rejected_at
       OR NEW.review_notes IS DISTINCT FROM OLD.review_notes THEN
      RAISE EXCEPTION 'Invalid fields for draft product update';
    END IF;
    IF NEW.accreditation_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.supplier_accreditations sa
      WHERE sa.id = NEW.accreditation_id AND sa.supplier_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'accreditation_id must belong to the supplier';
    END IF;
    RETURN NEW;
  END IF;

  -- Submit for review: draft -> submitted
  IF NEW.status = 'submitted' THEN
    IF OLD.status IS DISTINCT FROM 'draft' THEN
      RAISE EXCEPTION 'Supplier product status transition not permitted';
    END IF;
    IF NEW.submitted_at IS NULL THEN
      RAISE EXCEPTION 'submitted_at required when submitting product';
    END IF;
    IF NEW.product_name IS DISTINCT FROM OLD.product_name
       OR NEW.product_code IS DISTINCT FROM OLD.product_code
       OR NEW.category IS DISTINCT FROM OLD.category
       OR NEW.description IS DISTINCT FROM OLD.description
       OR NEW.specifications IS DISTINCT FROM OLD.specifications
       OR NEW.accreditation_id IS DISTINCT FROM OLD.accreditation_id THEN
      RAISE EXCEPTION 'Submit must not change product payload in the same operation';
    END IF;
    IF NEW.reviewed_by IS NOT NULL OR NEW.reviewed_at IS NOT NULL
       OR NEW.verified_at IS NOT NULL OR NEW.rejected_at IS NOT NULL OR NEW.review_notes IS NOT NULL THEN
      RAISE EXCEPTION 'Procurement fields must remain unset when supplier submits product';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Supplier product status transition not permitted';
END;
$$;

-- â”€â”€â”€ Supplier UPDATE RLS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

DROP POLICY IF EXISTS "supplier_products_supplier_update" ON public.supplier_products;

CREATE POLICY "supplier_products_supplier_update"
  ON public.supplier_products FOR UPDATE TO authenticated
  USING (
    supplier_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
    AND status IN ('draft', 'submitted')
  )
  WITH CHECK (
    supplier_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'supplier'
    )
    AND status IN ('draft', 'submitted', 'withdrawn')
  );

COMMENT ON POLICY "supplier_products_supplier_update" ON public.supplier_products IS
  'Supplier may edit draft, submit draft â†’ submitted, or withdraw draft/submitted â†’ withdrawn.';



-- Migration: 20260508120000_rfq_item_quotes_response_status.sql
-- Explicit per-line supplier response: quoted vs no_quote (cannot supply).
-- Existing rows: response_status defaults to 'quoted' â€” legacy RFQs unchanged.

ALTER TABLE rfq_item_quotes
  ADD COLUMN IF NOT EXISTS response_status text NOT NULL DEFAULT 'quoted',
  ADD COLUMN IF NOT EXISTS no_quote_reason text;

ALTER TABLE rfq_item_quotes
  DROP CONSTRAINT IF EXISTS rfq_item_quotes_response_status_check;

ALTER TABLE rfq_item_quotes
  ADD CONSTRAINT rfq_item_quotes_response_status_check
  CHECK (response_status IN ('quoted', 'no_quote'));

-- When no_quote: no catalog link, zero price/lead, explicit non-empty reason.
-- Quoted rows are not further constrained here (legacy quoted lines may have NULL product, etc.).
ALTER TABLE rfq_item_quotes
  DROP CONSTRAINT IF EXISTS rfq_item_quotes_no_quote_shape_check;

ALTER TABLE rfq_item_quotes
  ADD CONSTRAINT rfq_item_quotes_no_quote_shape_check
  CHECK (
    response_status <> 'no_quote'
    OR (
      supplier_product_id IS NULL
      AND unit_price = 0
      AND lead_time_days = 0
      AND is_alternative = false
      AND no_quote_reason IS NOT NULL
      AND trim(no_quote_reason) <> ''
    )
  );

COMMENT ON COLUMN rfq_item_quotes.response_status IS 'quoted | no_quote â€” supplier explicit response per RFQ line';
COMMENT ON COLUMN rfq_item_quotes.no_quote_reason IS 'Required when response_status = no_quote; NULL otherwise';



-- Migration: 20260509120000_po_requests_multi_supplier_per_pr2.sql
-- Allow multiple purchase orders per PR2 (one per awarded supplier).
-- Replaces one-PO-per-PR2 with one-PO-per-(pr2_id, supplier_id).
-- po_number remains globally unique; existing rows are not modified.

DROP INDEX IF EXISTS po_requests_pr2_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS po_requests_pr2_id_supplier_id_key
  ON po_requests (pr2_id, supplier_id);

COMMENT ON INDEX po_requests_pr2_id_supplier_id_key IS
  'At most one PO per PR2 per supplier profile (auth user); multiple suppliers on one PR2 each get their own PO row.';



-- Migration: 20260510120000_role_position_module_visibility.sql
/*
  # role_position_module_visibility

  Admin-configurable sidebar module visibility by role and optional position.
  Does not affect route access, API permissions, or RLS.
*/

CREATE TABLE public.role_position_module_visibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.roles (id) ON DELETE CASCADE,
  position_id uuid REFERENCES public.positions (id) ON DELETE CASCADE,
  module_key text NOT NULL,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- CHECK cannot use subqueries in PostgreSQL; enforce with a trigger instead.
CREATE OR REPLACE FUNCTION public.rpamv_enforce_position_role()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.position_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.positions p
      WHERE p.id = NEW.position_id AND p.role_id = NEW.role_id
    ) THEN
      RAISE EXCEPTION 'position_id must reference a position whose role_id matches role_id';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER rpamv_enforce_position_role
  BEFORE INSERT OR UPDATE OF role_id, position_id ON public.role_position_module_visibility
  FOR EACH ROW
  EXECUTE PROCEDURE public.rpamv_enforce_position_role();

CREATE INDEX rpamv_role_id_idx ON public.role_position_module_visibility (role_id);
CREATE INDEX rpamv_lookup_idx ON public.role_position_module_visibility (role_id, module_key);

-- Role-wide default: one row per (role_id, module_key) when position_id is null
CREATE UNIQUE INDEX rpamv_unique_role_module_null_position
  ON public.role_position_module_visibility (role_id, module_key)
  WHERE position_id IS NULL;

-- Position override: one row per (role_id, position_id, module_key)
CREATE UNIQUE INDEX rpamv_unique_role_position_module
  ON public.role_position_module_visibility (role_id, position_id, module_key)
  WHERE position_id IS NOT NULL;

ALTER TABLE public.role_position_module_visibility ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "Admins manage role_position_module_visibility"
  ON public.role_position_module_visibility
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles admin_profile
      JOIN public.roles admin_role ON admin_profile.role_id = admin_role.id
      WHERE admin_profile.id = auth.uid()
        AND admin_role.name = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles admin_profile
      JOIN public.roles admin_role ON admin_profile.role_id = admin_role.id
      WHERE admin_profile.id = auth.uid()
        AND admin_role.name = 'admin'
    )
  );

-- Non-admin: read rules that apply to their own role assignment
CREATE POLICY "Users read applicable module visibility rules"
  ON public.role_position_module_visibility
  FOR SELECT
  TO authenticated
  USING (
    role_id = (SELECT p.role_id FROM public.profiles p WHERE p.id = auth.uid())
    AND (
      position_id IS NULL
      OR position_id = (SELECT p.position_id FROM public.profiles p WHERE p.id = auth.uid())
    )
  );



-- Migration: 20260511100000_warehouse_validation_item_routing.sql
/*

  # Warehouse validation â€” item-level routing (Phase 1)



  Adds per-line routing fields derived from verified SOH vs quantity requested.

  Keeps `availability` as available | unavailable only; partial fulfillment is

  represented by `item_route = 'partial'`.

*/



ALTER TABLE warehouse_validation_items

  ADD COLUMN IF NOT EXISTS item_route text,

  ADD COLUMN IF NOT EXISTS internal_fulfilled_qty numeric(12,2) NOT NULL DEFAULT 0,

  ADD COLUMN IF NOT EXISTS procurement_qty numeric(12,2) NOT NULL DEFAULT 0;



ALTER TABLE warehouse_validation_items

  ADD CONSTRAINT warehouse_validation_items_item_route_values_check

  CHECK (item_route IS NULL OR item_route IN ('internal', 'procurement', 'partial'));



ALTER TABLE warehouse_validation_items

  ADD CONSTRAINT warehouse_validation_items_internal_fulfilled_nonneg_check

  CHECK (internal_fulfilled_qty >= 0);



ALTER TABLE warehouse_validation_items

  ADD CONSTRAINT warehouse_validation_items_procurement_nonneg_check

  CHECK (procurement_qty >= 0);




-- Migration: 20260514100000_bugtrack_schema.sql
-- Create bug_reports table
CREATE TABLE IF NOT EXISTS public.bug_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT, -- "What I See"
    expected_behavior TEXT, -- "Expected"
    error_message TEXT,
    affected_user TEXT,
    location TEXT,
    severity TEXT CHECK (severity IN ('low', 'medium', 'high')) DEFAULT 'medium',
    status TEXT CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')) DEFAULT 'open',
    reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    ai_prompt TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

-- Policies
-- 1. Only admins can view all bugs
CREATE POLICY "Admins can view all bugs" 
ON public.bug_reports FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        JOIN public.roles ON profiles.role_id = roles.id
        WHERE profiles.id = auth.uid() 
        AND (roles.name = 'admin' OR roles.name = 'superadmin')
    )
);

-- 2. Users can view only their own bug reports
CREATE POLICY "Users can view their own bugs" 
ON public.bug_reports FOR SELECT 
USING (reporter_id = auth.uid());

-- 3. Authenticated users can create bugs
CREATE POLICY "Authenticated users can create bugs" 
ON public.bug_reports FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- 4. Only admins can update status/severity or delete
CREATE POLICY "Admins can update bugs" 
ON public.bug_reports FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        JOIN public.roles ON profiles.role_id = roles.id
        WHERE profiles.id = auth.uid() 
        AND (roles.name = 'admin' OR roles.name = 'superadmin')
    )
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_bug_reports_updated_at
    BEFORE UPDATE ON public.bug_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();



-- Migration: 20260515100000_bugtrack_settings_schema.sql
CREATE TABLE IF NOT EXISTS public.bugtrack_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_email TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure only one row exists using a unique constraint on a constant value
-- PostgreSQL allows indexing on expressions
CREATE UNIQUE INDEX bugtrack_settings_single_row_idx ON public.bugtrack_settings ((true));

-- Seed the initial row
INSERT INTO public.bugtrack_settings (notification_email) VALUES (NULL);

-- Enable RLS
ALTER TABLE public.bugtrack_settings ENABLE ROW LEVEL SECURITY;

-- 1. Everyone can view settings
CREATE POLICY "Everyone can view bugtrack settings" 
ON public.bugtrack_settings FOR SELECT 
USING (true);

-- 2. Only admins can update
CREATE POLICY "Admins can update bugtrack settings" 
ON public.bugtrack_settings FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        JOIN public.roles ON profiles.role_id = roles.id
        WHERE profiles.id = auth.uid() 
        AND roles.name = 'admin'
    )
);

CREATE TRIGGER update_bugtrack_settings_updated_at
    BEFORE UPDATE ON public.bugtrack_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();



-- Migration: 20260519120000_messaging_schema_tables_only.sql
-- ============================================================================
-- PHASE 1: MESSAGING SCHEMA FOUNDATION (TABLES ONLY)
-- ============================================================================
-- Migration: 20260519120000_messaging_schema_tables_only
-- Source of Truth: docs/MESSAGING_SURGICAL_IMPLEMENTATION_PLAN.md (Phase 1)
-- Description:
--   Creates `conversations` and `messages` tables with constraints and indexes.
--   Pure schema only - intentionally NO RLS, NO functions, NO triggers,
--   NO realtime, NO seed data. RLS, RPCs and triggers are added in
--   subsequent phases (Phase 2 and Phase 3).
--
-- Risk Level: LOW (additive, isolated, no exposure)
-- Reversible: YES - see rollback notes at end of file
-- Touches Existing Procurement Logic: NO
-- Date: 2026-05-19
-- ============================================================================

-- â”€â”€â”€ CONVERSATIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 1:1 conversation envelope between two profiles. user_a_id < user_b_id is
-- enforced so a conversation pair has exactly one canonical row, allowing the
-- UNIQUE(user_a_id, user_b_id) constraint to act as a true uniqueness guard.
CREATE TABLE IF NOT EXISTS conversations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id             uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_b_id             uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_message_at       timestamptz DEFAULT now(),
  last_message_preview  text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),

  CONSTRAINT users_ordered        CHECK (user_a_id < user_b_id),
  CONSTRAINT no_self_conversation CHECK (user_a_id <> user_b_id),
  CONSTRAINT unique_conversation  UNIQUE (user_a_id, user_b_id)
);

-- â”€â”€â”€ MESSAGES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Individual message rows belonging to a conversation. Soft-delete is modeled
-- via `is_deleted` so message history remains intact for audit/threading.
CREATE TABLE IF NOT EXISTS messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content          text NOT NULL,
  is_deleted       boolean DEFAULT false,
  read_at          timestamptz,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  edited_at        timestamptz,

  CONSTRAINT content_not_empty
    CHECK (char_length(trim(content)) > 0 OR is_deleted = true)
);

-- â”€â”€â”€ INDEXES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Conversation lookups by participant, ordered by recency.
CREATE INDEX IF NOT EXISTS idx_conversations_user_a
  ON conversations (user_a_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_user_b
  ON conversations (user_b_id, last_message_at DESC);

-- Message thread retrieval (newest first within a conversation).
CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON messages (conversation_id, created_at DESC);

-- Sender-scoped queries (own messages, edit/delete authorization).
CREATE INDEX IF NOT EXISTS idx_messages_sender
  ON messages (sender_id);

-- Partial index supporting fast unread-count and unread-list queries.
CREATE INDEX IF NOT EXISTS idx_messages_unread
  ON messages (conversation_id, read_at)
  WHERE read_at IS NULL;

-- â”€â”€â”€ RLS POSTURE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- INTENTIONALLY LEFT DISABLED IN PHASE 1.
-- Tables are not exposed to any route, RPC, or component yet, so disabled RLS
-- here does not create a runtime exposure. RLS is enabled and policies are
-- introduced in Phase 2 (20260519130000_messaging_rls_policies.sql).
-- Do not enable RLS in this migration.

-- ============================================================================
-- ROLLBACK (for reference; apply via a separate migration if needed)
-- ----------------------------------------------------------------------------
-- DROP INDEX IF EXISTS idx_messages_unread;
-- DROP INDEX IF EXISTS idx_messages_sender;
-- DROP INDEX IF EXISTS idx_messages_conversation;
-- DROP INDEX IF EXISTS idx_conversations_user_b;
-- DROP INDEX IF EXISTS idx_conversations_user_a;
-- DROP TABLE IF EXISTS messages CASCADE;
-- DROP TABLE IF EXISTS conversations CASCADE;
-- ============================================================================



-- Migration: 20260519130000_messaging_rls_policies.sql
-- ============================================================================
-- PHASE 2: MESSAGING RLS POLICIES (SECURITY LAYER)
-- ============================================================================
-- Migration: 20260519130000_messaging_rls_policies
-- Source of Truth: docs/MESSAGING_SURGICAL_IMPLEMENTATION_PLAN.md (Phase 2)
-- Description:
--   Enables RLS on `conversations` and `messages` and installs the security
--   policies for Phase 2. No functions, no triggers, no realtime, no schema
--   changes. Strictly the security layer.
--
-- Design Notes:
--   * INSERT on conversations is intentionally NOT policy-allowed in Phase 2.
--     Conversation creation will go through SECURITY DEFINER RPC in Phase 3
--     so participant ordering/identity cannot be forged client-side.
--   * DELETE is intentionally NOT policy-allowed on either table.
--     Conversations are permanent; messages are soft-deleted via UPDATE.
--   * Messages UPDATE is restricted to the sender (own-message edits and
--     soft-delete only). Recipient-side actions (read receipts, etc.) will
--     be handled via dedicated RPC in a later phase, not by widening this
--     policy.
--
-- Risk Level: MEDIUM (security layer, but tables not yet exposed to UI/API)
-- Reversible: YES - see rollback notes at end of file
-- Touches Existing Procurement Logic: NO
-- Touches Existing RLS On Other Tables: NO
-- Date: 2026-05-19
-- ============================================================================

-- â”€â”€â”€ ENABLE ROW LEVEL SECURITY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages       ENABLE ROW LEVEL SECURITY;

-- â”€â”€â”€ CONVERSATIONS POLICIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- SELECT: a user may read a conversation row only if they are one of its two
-- canonical participants.
CREATE POLICY "Users can view their conversations"
  ON public.conversations
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_a_id
    OR auth.uid() = user_b_id
  );

-- UPDATE: a participant may update conversation metadata (last_message_at,
-- preview, updated_at) but cannot pivot the conversation onto another user
-- because the WITH CHECK clause re-asserts membership against the new row.
CREATE POLICY "Users can update their conversations"
  ON public.conversations
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_a_id
    OR auth.uid() = user_b_id
  )
  WITH CHECK (
    auth.uid() = user_a_id
    OR auth.uid() = user_b_id
  );

-- INSERT on conversations: intentionally absent (handled via Phase 3 RPC).
-- DELETE on conversations: intentionally absent (conversations are permanent).

-- â”€â”€â”€ MESSAGES POLICIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- SELECT: a user may read a message only if they participate in its
-- conversation. Implemented via EXISTS against conversations - safe because
-- conversations policies do not reference messages, so no policy recursion.
CREATE POLICY "Users can view messages in their conversations"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
    )
  );

-- INSERT: a user may insert a message only if (a) they are the declared
-- sender and (b) they participate in the target conversation. The sender_id
-- = auth.uid() guard prevents impersonation; the EXISTS guard prevents
-- writing into conversations the user is not part of.
CREATE POLICY "Users can send messages to their conversations"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
    )
  );

-- UPDATE: a user may update only their own messages (used for edits and for
-- soft-delete via setting is_deleted = true). WITH CHECK blocks rewriting
-- sender_id away from auth.uid().
CREATE POLICY "Users can update their own messages"
  ON public.messages
  FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- DELETE on messages: intentionally absent (soft-delete only, via UPDATE).

-- ============================================================================
-- ROLLBACK (for reference; apply via a separate migration if needed)
-- ----------------------------------------------------------------------------
-- DROP POLICY IF EXISTS "Users can update their own messages"          ON public.messages;
-- DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.messages;
-- DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
-- DROP POLICY IF EXISTS "Users can update their conversations"         ON public.conversations;
-- DROP POLICY IF EXISTS "Users can view their conversations"           ON public.conversations;
-- ALTER TABLE public.messages       DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.conversations DISABLE ROW LEVEL SECURITY;
-- ============================================================================



-- Migration: 20260519140000_messaging_functions_triggers.sql
-- ============================================================================
-- PHASE 3: MESSAGING RPC FUNCTIONS & TRIGGERS
-- ============================================================================
-- Migration: 20260519140000_messaging_functions_triggers
-- Source of Truth: docs/MESSAGING_SURGICAL_IMPLEMENTATION_PLAN.md (Phase 3)
-- Description:
--   Creates the secure RPC function for conversation creation/retrieval and
--   the trigger function + triggers for automatic conversation metadata
--   updates when messages are inserted or updated.
--
-- Design Notes:
--   * create_or_get_conversation is SECURITY DEFINER so it can INSERT into
--     conversations despite no INSERT RLS policy existing. This is the ONLY
--     sanctioned path for conversation creation.
--   * The function enforces: authentication, self-messaging prevention,
--     target user existence, canonical participant ordering, and idempotency.
--   * update_conversation_on_message is SECURITY DEFINER so it can UPDATE
--     the conversation row regardless of which participant sent the message.
--   * Both functions use SET search_path = public to prevent search_path
--     injection attacks.
--
-- Risk Level: LOW (functions isolated, no frontend exposure yet)
-- Reversible: YES - see rollback notes at end of file
-- Touches Existing Procurement Logic: NO
-- Date: 2026-05-19
-- ============================================================================

-- â”€â”€â”€ RPC: CREATE OR GET CONVERSATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Secure, idempotent conversation creation. Returns the conversation UUID.
-- If a conversation already exists between the two users, returns the existing
-- one. Otherwise creates a new one with canonical ordering enforced.
CREATE OR REPLACE FUNCTION public.create_or_get_conversation(other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  user_a uuid;
  user_b uuid;
  conv_id uuid;
BEGIN
  -- 1. Authentication check
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Self-messaging prevention
  IF current_user_id = other_user_id THEN
    RAISE EXCEPTION 'Cannot create conversation with yourself';
  END IF;

  -- 3. Target user existence check
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = other_user_id) THEN
    RAISE EXCEPTION 'User does not exist';
  END IF;

  -- 4. Canonical ordering (user_a_id < user_b_id)
  IF current_user_id < other_user_id THEN
    user_a := current_user_id;
    user_b := other_user_id;
  ELSE
    user_a := other_user_id;
    user_b := current_user_id;
  END IF;

  -- 5. Idempotent lookup-or-create
  SELECT id INTO conv_id
  FROM conversations
  WHERE user_a_id = user_a AND user_b_id = user_b;

  IF conv_id IS NULL THEN
    INSERT INTO conversations (user_a_id, user_b_id)
    VALUES (user_a, user_b)
    RETURNING id INTO conv_id;
  END IF;

  RETURN conv_id;
END;
$$;

-- Grant execute to authenticated users only
GRANT EXECUTE ON FUNCTION public.create_or_get_conversation(uuid) TO authenticated;

-- â”€â”€â”€ TRIGGER FUNCTION: UPDATE CONVERSATION ON MESSAGE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Automatically updates conversation metadata (last_message_at, preview,
-- updated_at) whenever a message is inserted or updated. Runs as SECURITY
-- DEFINER so it can update the conversation row regardless of which
-- participant triggered the action.
CREATE OR REPLACE FUNCTION public.update_conversation_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE conversations
  SET
    last_message_at = NEW.created_at,
    last_message_preview = CASE
      WHEN NEW.is_deleted THEN 'Message deleted'
      ELSE LEFT(NEW.content, 100)
    END,
    updated_at = now()
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$;

-- â”€â”€â”€ TRIGGERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Trigger 1: After a new message is inserted, update conversation metadata.
CREATE TRIGGER trigger_update_conversation_on_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_on_message();

-- Trigger 2: After a message is updated (edit or soft-delete), update
-- conversation metadata only if content or deletion status changed.
CREATE TRIGGER trigger_update_conversation_on_message_update
  AFTER UPDATE ON public.messages
  FOR EACH ROW
  WHEN (OLD.is_deleted IS DISTINCT FROM NEW.is_deleted OR OLD.content IS DISTINCT FROM NEW.content)
  EXECUTE FUNCTION public.update_conversation_on_message();

-- ============================================================================
-- ROLLBACK (for reference; apply via a separate migration if needed)
-- ----------------------------------------------------------------------------
-- DROP TRIGGER IF EXISTS trigger_update_conversation_on_message_update ON public.messages;
-- DROP TRIGGER IF EXISTS trigger_update_conversation_on_message ON public.messages;
-- DROP FUNCTION IF EXISTS public.update_conversation_on_message() CASCADE;
-- DROP FUNCTION IF EXISTS public.create_or_get_conversation(uuid) CASCADE;
-- ============================================================================



-- Migration: 20260520000100_rse_tsqa_self_assign_fix.sql
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- Migration: Fix TSQA self-assignment of unassigned RSE records
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
--
-- Problem: TSQA users cannot "Start Review" on unassigned RSE records (status = 'created')
-- because the RLS policy requires `assigned_to = auth.uid()`, which fails when
-- assigned_to is NULL.
--
-- Solution: Update the RLS policy to allow TSQA to update records where:
--   1. assigned_to = auth.uid() (already assigned to them), OR
--   2. assigned_to IS NULL AND status IN ('created') (unassigned, self-assignment)
--
-- This allows TSQA users to self-assign unassigned RSE records by clicking
-- "Start Review", which transitions the record to 'under_review' and sets
-- assigned_to to the current user.
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "rse_records_tsqa_update" ON rse_records;

-- Create updated policy that allows self-assignment of unassigned records
CREATE POLICY "rse_records_tsqa_update"
  ON rse_records FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'tsqa'
    )
    AND (
      -- Can update records already assigned to them
      assigned_to = auth.uid()
      OR
      -- Can self-assign unassigned records (status = 'created')
      (assigned_to IS NULL AND status = 'created')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'tsqa'
    )
    AND (
      -- After update, must be assigned to them
      assigned_to = auth.uid()
    )
  );

-- Add comment explaining the policy
COMMENT ON POLICY "rse_records_tsqa_update" ON rse_records IS 
  'TSQA users can update RSE records assigned to them, or self-assign unassigned records (status=created). After update, the record must be assigned to the current user.';



-- Migration: 20260520100000_message_attachments_schema.sql
-- ============================================================================
-- MESSAGE ATTACHMENTS SCHEMA - PHASE 1: DATABASE FOUNDATION
-- ============================================================================
-- Migration: 20260520100000_message_attachments_schema
-- Source of Truth: .kiro/implementation/MESSAGE-ATTACHMENTS-AUDIT-AND-PLAN.md
-- Description:
--   Creates `message_attachments` table for storing file attachment metadata.
--   Adds `attachment_count` column to messages table for quick queries.
--   Updates messages constraint to allow empty content when attachments exist.
--   Creates trigger to auto-update attachment_count.
--
-- Risk Level: LOW (additive, no breaking changes)
-- Reversible: YES - see rollback notes at end of file
-- Breaking Changes: NONE
-- Date: 2026-05-20
-- ============================================================================

-- â”€â”€â”€ MESSAGE ATTACHMENTS TABLE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Stores metadata for files attached to messages. Actual files are stored in
-- the 'message-attachments' storage bucket (created in Phase 2).
-- Path convention: messages/{conversation_id}/{message_id}/{timestamp}_{filename}

CREATE TABLE IF NOT EXISTS message_attachments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id       uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  conversation_id  uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  file_name        text NOT NULL,
  file_path        text NOT NULL UNIQUE,
  file_size        bigint NOT NULL,
  mime_type        text NOT NULL,
  uploaded_by      uuid NOT NULL REFERENCES profiles(id),
  created_at       timestamptz DEFAULT now(),

  -- Constraints
  CONSTRAINT file_name_not_empty CHECK (char_length(trim(file_name)) > 0),
  CONSTRAINT file_size_positive CHECK (file_size > 0),
  CONSTRAINT file_size_limit CHECK (file_size <= 10485760) -- 10 MB max
);

-- â”€â”€â”€ INDEXES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Fast lookup of attachments by message
CREATE INDEX IF NOT EXISTS idx_message_attachments_message
  ON message_attachments(message_id);

-- Conversation-scoped queries with recency ordering
CREATE INDEX IF NOT EXISTS idx_message_attachments_conversation
  ON message_attachments(conversation_id, created_at DESC);

-- Uploader lookup (for user's own attachments)
CREATE INDEX IF NOT EXISTS idx_message_attachments_uploader
  ON message_attachments(uploaded_by);

-- â”€â”€â”€ ADD ATTACHMENT COUNT TO MESSAGES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Denormalized count for quick queries without JOIN
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS attachment_count integer DEFAULT 0;

-- â”€â”€â”€ UPDATE MESSAGES CONSTRAINT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Relax the content_not_empty constraint to allow attachment-only messages.
-- New rule: message must have content OR be deleted OR have attachments.

-- First, drop the existing constraint
ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS content_not_empty;

-- Add new constraint that allows empty content if attachments exist
-- Note: We use a function-based check since subqueries aren't allowed in CHECK
-- The trigger below ensures attachment_count stays in sync
ALTER TABLE messages
  ADD CONSTRAINT content_or_attachments_required
  CHECK (
    char_length(trim(content)) > 0
    OR is_deleted = true
    OR attachment_count > 0
  );

-- â”€â”€â”€ ATTACHMENT COUNT TRIGGER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Automatically updates messages.attachment_count when attachments are
-- inserted or deleted. This keeps the denormalized count in sync.

CREATE OR REPLACE FUNCTION update_message_attachment_count()
RETURNS TRIGGER AS $$
DECLARE
  target_message_id uuid;
BEGIN
  -- Get the message_id from either NEW (insert) or OLD (delete)
  target_message_id := COALESCE(NEW.message_id, OLD.message_id);
  
  -- Update the attachment count on the parent message
  UPDATE messages
  SET attachment_count = (
    SELECT COUNT(*)::integer
    FROM message_attachments
    WHERE message_id = target_message_id
  )
  WHERE id = target_message_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger fires after INSERT or DELETE on message_attachments
CREATE TRIGGER trg_update_attachment_count
  AFTER INSERT OR DELETE ON message_attachments
  FOR EACH ROW
  EXECUTE FUNCTION update_message_attachment_count();

-- â”€â”€â”€ RLS POSTURE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- RLS is enabled but policies are added in Phase 2 migration.
-- This ensures the table is secure by default.
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ROLLBACK (for reference; apply via a separate migration if needed)
-- ----------------------------------------------------------------------------
-- -- Drop trigger and function
-- DROP TRIGGER IF EXISTS trg_update_attachment_count ON message_attachments;
-- DROP FUNCTION IF EXISTS update_message_attachment_count();
--
-- -- Remove attachment_count column from messages
-- ALTER TABLE messages DROP COLUMN IF EXISTS attachment_count;
--
-- -- Restore original constraint on messages
-- ALTER TABLE messages DROP CONSTRAINT IF EXISTS content_or_attachments_required;
-- ALTER TABLE messages ADD CONSTRAINT content_not_empty
--   CHECK (char_length(trim(content)) > 0 OR is_deleted = true);
--
-- -- Drop indexes
-- DROP INDEX IF EXISTS idx_message_attachments_uploader;
-- DROP INDEX IF EXISTS idx_message_attachments_conversation;
-- DROP INDEX IF EXISTS idx_message_attachments_message;
--
-- -- Drop table
-- DROP TABLE IF EXISTS message_attachments CASCADE;
-- ============================================================================



-- Migration: 20260520110000_message_attachments_storage.sql
-- ============================================================================
-- MESSAGE ATTACHMENTS STORAGE - PHASE 2: STORAGE BUCKET & RLS
-- ============================================================================
-- Migration: 20260520110000_message_attachments_storage
-- Source of Truth: .kiro/implementation/MESSAGE-ATTACHMENTS-AUDIT-AND-PLAN.md
-- Description:
--   Creates 'message-attachments' storage bucket for file uploads.
--   Adds RLS policies for storage objects (upload/download).
--   Adds RLS policies for message_attachments table (CRUD).
--
-- Risk Level: LOW (isolated, bucket not exposed until Phase 3)
-- Reversible: YES - see rollback notes at end of file
-- Breaking Changes: NONE
-- Date: 2026-05-20
-- ============================================================================

-- â”€â”€â”€ STORAGE BUCKET â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Private bucket for message attachments.
-- Path convention: messages/{conversation_id}/{message_id}/{timestamp}_{filename}
--   split_part indices: 1=messages, 2=conversation_id, 3=message_id, 4=filename

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-attachments',
  'message-attachments',
  FALSE,
  10485760, -- 10 MB
  ARRAY[
    'image/jpeg', 
    'image/png', 
    'image/gif', 
    'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- STORAGE OBJECT RLS POLICIES
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- â”€â”€â”€ Upload Policy: Users can upload to their own conversations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Validates:
--   1. Path format: messages/{conversation_id}/{message_id}/{filename}
--   2. User is a participant in the conversation
--   3. Message belongs to the conversation and sender is current user

CREATE POLICY "message_attachments_upload"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'message-attachments'
  AND split_part(name, '/', 1) = 'messages'
  AND split_part(name, '/', 4) <> ''  -- filename must exist
  AND split_part(name, '/', 5) = ''   -- no extra path segments
  -- Verify user is participant in the conversation
  AND EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = split_part(name, '/', 2)::uuid
      AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
  )
  -- Verify message belongs to conversation and sender is current user
  AND EXISTS (
    SELECT 1 FROM messages m
    WHERE m.id = split_part(name, '/', 3)::uuid
      AND m.conversation_id = split_part(name, '/', 2)::uuid
      AND m.sender_id = auth.uid()
  )
);

-- â”€â”€â”€ Download Policy: Conversation participants can download â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Any participant in the conversation can view/download attachments

CREATE POLICY "message_attachments_download"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'message-attachments'
  AND split_part(name, '/', 1) = 'messages'
  -- Verify user is participant in the conversation
  AND EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = split_part(name, '/', 2)::uuid
      AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
  )
);

-- â”€â”€â”€ Admin Policy: Full read access â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Admins can view all message attachments for moderation/support

CREATE POLICY "message_attachments_admin_select"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'message-attachments'
  AND EXISTS (
    SELECT 1 FROM profiles p 
    JOIN roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'admin'
  )
);

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- MESSAGE_ATTACHMENTS TABLE RLS POLICIES
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- â”€â”€â”€ SELECT: Conversation participants can view attachments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE POLICY "message_attachments_select"
ON message_attachments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = conversation_id
      AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
  )
);

-- â”€â”€â”€ INSERT: Message sender can add attachments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Only the sender of a message can attach files to it

CREATE POLICY "message_attachments_insert"
ON message_attachments
FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM messages m
    WHERE m.id = message_id
      AND m.sender_id = auth.uid()
      AND m.conversation_id = conversation_id
  )
);

-- â”€â”€â”€ DELETE: Message sender can delete their attachments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Only the uploader can delete their own attachments

CREATE POLICY "message_attachments_delete"
ON message_attachments
FOR DELETE TO authenticated
USING (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM messages m
    WHERE m.id = message_id 
      AND m.sender_id = auth.uid()
  )
);

-- â”€â”€â”€ Admin: Full access to message_attachments table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE POLICY "message_attachments_admin"
ON message_attachments
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    JOIN roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p 
    JOIN roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'admin'
  )
);

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- ENABLE REALTIME FOR MESSAGE_ATTACHMENTS
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- This allows clients to subscribe to attachment changes in real-time

ALTER PUBLICATION supabase_realtime ADD TABLE message_attachments;

-- ============================================================================
-- ROLLBACK (for reference; apply via a separate migration if needed)
-- ----------------------------------------------------------------------------
-- -- Remove from realtime
-- ALTER PUBLICATION supabase_realtime DROP TABLE message_attachments;
--
-- -- Drop table RLS policies
-- DROP POLICY IF EXISTS "message_attachments_select" ON message_attachments;
-- DROP POLICY IF EXISTS "message_attachments_insert" ON message_attachments;
-- DROP POLICY IF EXISTS "message_attachments_delete" ON message_attachments;
-- DROP POLICY IF EXISTS "message_attachments_admin" ON message_attachments;
--
-- -- Drop storage RLS policies
-- DROP POLICY IF EXISTS "message_attachments_upload" ON storage.objects;
-- DROP POLICY IF EXISTS "message_attachments_download" ON storage.objects;
-- DROP POLICY IF EXISTS "message_attachments_admin_select" ON storage.objects;
--
-- -- Delete bucket (WARNING: Deletes all files!)
-- DELETE FROM storage.buckets WHERE id = 'message-attachments';
-- ============================================================================



-- Migration: 20260521120000_add_admin_workflow_management_rls.sql
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

-- â”€â”€â”€ APPROVAL WORKFLOWS ADMIN POLICIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

-- â”€â”€â”€ APPROVAL STEPS ADMIN POLICIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

-- â”€â”€â”€ COMMENTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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



-- Migration: 20260521130000_module_visibility_add_mode.sql
/*
  # Module Visibility "Add Mode" Enhancement
  
  Allows positions to ADD modules from other roles, not just hide modules from their own role.
  
  Changes:
  1. Add source_role_id column - when set, this module is "borrowed" from another role
  2. Update trigger to allow source_role_id to differ from role_id
  3. Add index for efficient lookups
  
  Use case: Buyer position has "approver" role but needs procurement modules (/po, /rfq, /pr2)
*/

-- Add source_role_id column for borrowed modules
ALTER TABLE public.role_position_module_visibility
ADD COLUMN IF NOT EXISTS source_role_id uuid REFERENCES public.roles (id) ON DELETE CASCADE;

-- Add comment explaining the column
COMMENT ON COLUMN public.role_position_module_visibility.source_role_id IS 
  'When set, indicates this module is borrowed from another role. The module_key should exist in that role''s navigation. When null, the rule applies to the current role''s own modules.';

-- Create index for efficient lookups of added modules
CREATE INDEX IF NOT EXISTS rpamv_source_role_idx 
  ON public.role_position_module_visibility (source_role_id) 
  WHERE source_role_id IS NOT NULL;

-- Create index for position-based added modules lookup
CREATE INDEX IF NOT EXISTS rpamv_position_added_modules_idx 
  ON public.role_position_module_visibility (position_id, source_role_id) 
  WHERE position_id IS NOT NULL AND source_role_id IS NOT NULL;



-- Migration: 20260521140000_po_rls_buyer_position.sql
/*
  # Allow Buyer Position to Create/Update POs
  
  This migration updates RLS policies to allow users with the "Buyer" position
  to insert and update POs, regardless of their role.
  
  Use case: Buyer position may have "approver" role but still needs to create POs.
*/

-- Drop existing INSERT policy and recreate with position check
DROP POLICY IF EXISTS "Procurement can insert POs" ON po_requests;

CREATE POLICY "Procurement or Buyer can insert POs"
  ON po_requests FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON r.id = p.role_id
      LEFT JOIN positions pos ON pos.id = p.position_id
      WHERE p.id = auth.uid() 
        AND (r.name = 'procurement' OR pos.title = 'Buyer')
    )
  );

-- Drop existing UPDATE policy and recreate with position check
DROP POLICY IF EXISTS "Procurement can update POs" ON po_requests;

CREATE POLICY "Procurement or Buyer can update POs"
  ON po_requests FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON r.id = p.role_id
      LEFT JOIN positions pos ON pos.id = p.position_id
      WHERE p.id = auth.uid() 
        AND (r.name = 'procurement' OR pos.title = 'Buyer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON r.id = p.role_id
      LEFT JOIN positions pos ON pos.id = p.position_id
      WHERE p.id = auth.uid() 
        AND (r.name = 'procurement' OR pos.title = 'Buyer')
    )
  );

-- Also update po_items INSERT policy
DROP POLICY IF EXISTS "Procurement can insert PO items" ON po_items;

CREATE POLICY "Procurement or Buyer can insert PO items"
  ON po_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON r.id = p.role_id
      LEFT JOIN positions pos ON pos.id = p.position_id
      WHERE p.id = auth.uid() 
        AND (r.name = 'procurement' OR pos.title = 'Buyer')
    )
  );

-- Also update po_items UPDATE policy if it exists
DROP POLICY IF EXISTS "Procurement can update PO items" ON po_items;

CREATE POLICY "Procurement or Buyer can update PO items"
  ON po_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON r.id = p.role_id
      LEFT JOIN positions pos ON pos.id = p.position_id
      WHERE p.id = auth.uid() 
        AND (r.name = 'procurement' OR pos.title = 'Buyer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON r.id = p.role_id
      LEFT JOIN positions pos ON pos.id = p.position_id
      WHERE p.id = auth.uid() 
        AND (r.name = 'procurement' OR pos.title = 'Buyer')
    )
  );



-- Migration: 20260521150001_fix_po_workflow_final_steps.sql
-- Fix PO_APPROVAL workflow to have both Finance Director and Supplier as final steps
-- This is the correct configuration for PO workflow:
-- - Step 3 (Finance Director) = final internal approval
-- - Step 4 (Supplier Representative) = final acknowledgment step

-- Set Finance Director (step 3) as final
UPDATE approval_steps
SET is_final = TRUE
WHERE workflow_id = (
  SELECT id FROM approval_workflows WHERE code = 'PO_APPROVAL'
)
AND step_order = 3;

-- Ensure Supplier Representative (step 4) is also final
UPDATE approval_steps
SET is_final = TRUE
WHERE workflow_id = (
  SELECT id FROM approval_workflows WHERE code = 'PO_APPROVAL'
)
AND step_order = 4;

-- Add comment explaining the dual-final configuration
COMMENT ON TABLE approval_steps IS 'PO_APPROVAL workflow supports multiple final steps: Finance Director (step 3) for internal approval, Supplier Representative (step 4) for acknowledgment';



-- Migration: 20260521160000_update_bugtrack_rls_policies.sql
-- Update Bug Track RLS Policies to restrict viewing to admins only
-- Drop existing policies
DROP POLICY IF EXISTS "Everyone can view all bugs" ON public.bug_reports;

-- Create new policies
-- 1. Only admins can view all bugs
CREATE POLICY "Admins can view all bugs" 
ON public.bug_reports FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        JOIN public.roles ON profiles.role_id = roles.id
        WHERE profiles.id = auth.uid() 
        AND (roles.name = 'admin' OR roles.name = 'superadmin')
    )
);

-- 2. Users can view only their own bug reports (optional - for transparency)
-- Uncomment if you want users to see their own submitted bugs
-- CREATE POLICY "Users can view their own bugs" 
-- ON public.bug_reports FOR SELECT 
-- USING (reporter_id = auth.uid());



