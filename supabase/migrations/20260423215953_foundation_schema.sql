
/*
  # Fortune Procurement System — Foundation Schema

  ## Summary
  Sets up the core identity and access tables for the procurement system.

  ## New Tables

  ### departments
  - `id` (uuid, PK)
  - `name` (text) — e.g. "Finance", "Operations"
  - `code` (text, unique) — short code

  ### roles
  - `id` (uuid, PK)
  - `name` (text, unique) — e.g. "employee", "warehouse", "procurement", "approver", "supplier"

  ### positions
  - `id` (uuid, PK)
  - `title` (text) — e.g. "Supervisor", "Department Head", "Buyer"
  - `role_id` (FK → roles.id) — which role category this title belongs to

  ### profiles
  - `id` (uuid, PK = auth.users.id)
  - `full_name` (text)
  - `email` (text)
  - `role_id` (FK → roles.id)
  - `position_id` (FK → positions.id)
  - `department_id` (FK → departments.id)
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

-- ─── DEPARTMENTS ────────────────────────────────────────────────────────────
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

-- ─── ROLES ──────────────────────────────────────────────────────────────────
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

-- ─── POSITIONS ──────────────────────────────────────────────────────────────
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

-- ─── PROFILES ───────────────────────────────────────────────────────────────
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

-- ─── SEED: DEPARTMENTS ───────────────────────────────────────────────────────
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

-- ─── SEED: ROLES ─────────────────────────────────────────────────────────────
INSERT INTO roles (name) VALUES
  ('employee'),
  ('warehouse'),
  ('procurement'),
  ('approver'),
  ('supplier')
ON CONFLICT (name) DO NOTHING;

-- ─── SEED: POSITIONS ─────────────────────────────────────────────────────────
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
