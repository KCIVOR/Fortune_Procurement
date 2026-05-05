/*
  # Delete manually-seeded auth users that GoTrue cannot sign in

  ## Problem
  All demo auth.users rows were inserted manually via SQL (crypt/bcrypt hashes).
  GoTrue's signInWithPassword and Admin API both fail with "Database error loading user"
  for these rows because GoTrue requires users to be created through its own internal
  flow to set up all required internal state (sessions, refresh tokens, nonces, etc).

  The GoTrue /auth/v1/signup endpoint works correctly — proved by a probe test.

  ## Fix
  Delete all broken manually-seeded auth users. The profiles rows will cascade-delete
  via the FK constraint (profiles.id REFERENCES auth.users(id) ON DELETE CASCADE).
  New users will be created via GoTrue's signup endpoint by the reset-demo-passwords
  edge function, which will also re-insert the profile rows with the new GoTrue-assigned IDs.

  ## Accounts deleted
  employee, warehouse, wh.manager, procurement, buyer, proc.manager,
  supervisor, dept.head, director, finance.director, supplier @fortune.com
  Also removes the testprobe999@fortune.com test account.
*/

DELETE FROM auth.users
WHERE email LIKE '%@fortune.com';
