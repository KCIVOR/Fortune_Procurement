-- Seed Planning demo user for raw-material PR2-direct testing (Phase 0.2).
-- Password: Fortune2026! (same as other DEV_ACCOUNTS quick-login users)

DO $$
DECLARE
  v_user_id uuid;
  v_employee_role_id uuid;
  v_pos_planning_staff uuid;
  v_dept_planning uuid;
BEGIN
  SELECT id INTO v_employee_role_id FROM roles WHERE name = 'employee';
  SELECT id INTO v_pos_planning_staff FROM positions WHERE title = 'Planning Staff';
  SELECT id INTO v_dept_planning FROM departments WHERE code = 'PLAN';

  IF v_employee_role_id IS NULL OR v_pos_planning_staff IS NULL OR v_dept_planning IS NULL THEN
    RAISE NOTICE 'Skipping planning demo user seed — role/position/department missing';
    RETURN;
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE email = 'planning@fortune.com';
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role,
      email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, reauthentication_token
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'planning@fortune.com',
      '$2a$10$.aO9CEfoa7bGdfWd2rMEKuF6feoewA84OMCOAE/y0nYulU4Vp/JhC',
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      now(),
      now(),
      '', '', '', '',
      '',
      ''
    );
  ELSE
    UPDATE auth.users
    SET encrypted_password = '$2a$10$.aO9CEfoa7bGdfWd2rMEKuF6feoewA84OMCOAE/y0nYulU4Vp/JhC',
        updated_at = now()
    WHERE id = v_user_id;
  END IF;

  INSERT INTO profiles (id, full_name, email, role_id, position_id, department_id, active)
  VALUES (
    v_user_id,
    'Planning Demo User',
    'planning@fortune.com',
    v_employee_role_id,
    v_pos_planning_staff,
    v_dept_planning,
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    role_id = EXCLUDED.role_id,
    position_id = EXCLUDED.position_id,
    department_id = EXCLUDED.department_id,
    active = true;

  IF NOT EXISTS (
    SELECT 1 FROM auth.identities i
    WHERE i.user_id = v_user_id AND i.provider = 'email'
  ) THEN
    INSERT INTO auth.identities (
      id, provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      'planning@fortune.com',
      v_user_id,
      jsonb_build_object(
        'sub', v_user_id::text,
        'email', 'planning@fortune.com',
        'email_verified', true
      ),
      'email',
      now(), now(), now()
    );
  END IF;
END $$;
