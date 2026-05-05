/*
  # Fix Admin auth.users NULL Token Fields

  ## Problem
  The admin@fortune.com row in auth.users has NULL values for token fields
  that Supabase's internal auth engine expects to be empty strings:
    - confirmation_token: NULL   (should be '')
    - recovery_token: NULL       (should be '')
    - email_change_token_new: NULL (should be '')
    - email_change: NULL         (should be '')
    - email_change_token_current: NULL (should be '', col default)
    - reauthentication_token: NULL (should be '')

  Every working demo user (supplier2, buyer, employee, etc.) has '' for these
  fields. Admin was seeded with NULLs, causing Supabase's auth server to throw
  HTTP 500 "Database error querying schema" during signInWithPassword().

  ## Fix
  SET all NULL token/change string fields to '' for admin@fortune.com only.
  Idempotent — safe to rerun (COALESCE ensures only NULLs are changed).

  ## Scope
  - Only auth.users row for admin@fortune.com
  - No profiles, roles, positions, RLS, workflows, password hashes touched
*/

UPDATE auth.users
SET
  confirmation_token        = COALESCE(confirmation_token, ''),
  recovery_token            = COALESCE(recovery_token, ''),
  email_change_token_new    = COALESCE(email_change_token_new, ''),
  email_change              = COALESCE(email_change, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  reauthentication_token    = COALESCE(reauthentication_token, '')
WHERE email = 'admin@fortune.com';
