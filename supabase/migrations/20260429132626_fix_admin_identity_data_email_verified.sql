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
  The migration is idempotent — safe to rerun.

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
    RAISE NOTICE 'admin@fortune.com not found in auth.users — skipping';
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
