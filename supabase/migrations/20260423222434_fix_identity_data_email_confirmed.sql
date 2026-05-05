
/*
  # Fix identity_data — add email_confirmed: true

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
