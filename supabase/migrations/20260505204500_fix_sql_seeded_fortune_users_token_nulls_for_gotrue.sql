/*
  Minimal INSERT into auth.users (restore + seed_demo_users pattern) omits token columns,
  leaving confirmation_token/recovery_token/etc. as NULL.
  GoTrue treats those like broken rows — login fails with generic invalid credentials.

  Supplier2/3 seeds use '' for those columns; admin got a targeted UPDATE in 20260429132717.

  Normalize every Fortune demo SQL-seeded account to empty-string tokens (COALESCE keeps real values).
*/

UPDATE auth.users
SET
  confirmation_token          = COALESCE(confirmation_token, ''),
  recovery_token              = COALESCE(recovery_token, ''),
  email_change_token_new      = COALESCE(email_change_token_new, ''),
  email_change                = COALESCE(email_change, ''),
  email_change_token_current  = COALESCE(email_change_token_current, ''),
  reauthentication_token      = COALESCE(reauthentication_token, '')
WHERE email LIKE '%@fortune.com';
