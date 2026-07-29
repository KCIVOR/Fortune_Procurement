-- Seed Operations Manager demo user for Goods PR2_FINAL approval testing.
-- Password: Fortune2026! (same as other DEV_ACCOUNTS quick-login users)

DO $$
DECLARE
  v_user_id uuid;
  v_approver_role_id uuid;
  v_pos_ops_mgr uuid;
  v_dept_ops uuid;
BEGIN
  SELECT id INTO v_approver_role_id FROM roles WHERE name = 'approver';
  SELECT id INTO v_pos_ops_mgr FROM positions WHERE title = 'Operations Manager';
  SELECT id INTO v_dept_ops FROM departments WHERE name = 'Operations';

  IF v_approver_role_id IS NULL OR v_pos_ops_mgr IS NULL THEN
    RAISE NOTICE 'Skipping ops manager seed — role or position missing';
    RETURN;
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE email = 'operations.manager@fortune.com';
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
      'operations.manager@fortune.com',
      '$2b$10$R/50U2r83bJUbg4CCE452.phLgF0VD7OdijPkUZBxcymW9aNSqP7e',
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
    SET encrypted_password = '$2b$10$R/50U2r83bJUbg4CCE452.phLgF0VD7OdijPkUZBxcymW9aNSqP7e',
        updated_at = now()
    WHERE id = v_user_id;
  END IF;

  INSERT INTO profiles (id, full_name, email, role_id, position_id, department_id, active)
  VALUES (
    v_user_id,
    'Marcus Ortega',
    'operations.manager@fortune.com',
    v_approver_role_id,
    v_pos_ops_mgr,
    v_dept_ops,
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
      'operations.manager@fortune.com',
      v_user_id,
      jsonb_build_object(
        'sub', v_user_id::text,
        'email', 'operations.manager@fortune.com',
        'email_verified', true
      ),
      'email',
      now(), now(), now()
    );
  END IF;
END $$;
