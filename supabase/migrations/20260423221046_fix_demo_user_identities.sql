
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
