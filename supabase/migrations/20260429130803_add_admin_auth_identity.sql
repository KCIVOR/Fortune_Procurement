
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
