-- Raw Materials Phase 2: PR2_FINAL step 1 requires an approver with position
-- 'Department Head' in the SAME department as the PR2 (Dept Head is not in
-- the Director-position RLS bypass list, unlike Ops Manager/Director/Finance
-- Director). Without a Planning Department Head, every raw-material PR2
-- would be stuck at step 1 forever — this is a real workflow gap, not just
-- a test-data one.

DO $$
DECLARE
  v_user_id uuid;
  v_approver_role_id uuid;
  v_pos_dept_head uuid;
  v_dept_planning uuid;
BEGIN
  SELECT id INTO v_approver_role_id FROM roles WHERE name = 'approver';
  SELECT id INTO v_pos_dept_head FROM positions WHERE title = 'Department Head';
  SELECT id INTO v_dept_planning FROM departments WHERE code = 'PLAN';

  IF v_approver_role_id IS NULL OR v_pos_dept_head IS NULL OR v_dept_planning IS NULL THEN
    RAISE NOTICE 'Skipping planning dept head seed — role/position/department missing';
    RETURN;
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE email = 'planning.head@fortune.com';
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
      'planning.head@fortune.com',
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
    'Planning Dept Head Demo User',
    'planning.head@fortune.com',
    v_approver_role_id,
    v_pos_dept_head,
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
      'planning.head@fortune.com',
      v_user_id,
      jsonb_build_object(
        'sub', v_user_id::text,
        'email', 'planning.head@fortune.com',
        'email_verified', true
      ),
      'email',
      now(), now(), now()
    );
  END IF;
END $$;
