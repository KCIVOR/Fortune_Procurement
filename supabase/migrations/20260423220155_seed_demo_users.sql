
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
