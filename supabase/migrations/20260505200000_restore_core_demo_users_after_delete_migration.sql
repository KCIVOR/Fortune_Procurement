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
  `20260424040914_reset_all_demo_passwords_uniform_hash.sql` — not extensions.crypt(),
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
