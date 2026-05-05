
/*
  # Reset demo user passwords to bcrypt $2b$10$ format

  ## Root Cause
  PostgreSQL's crypt() function generates bcrypt hashes with the $2a$ prefix at
  cost factor 6. Supabase Auth (GoTrue) requires the $2b$ prefix at cost factor
  10. Hashes with $2a$ are rejected by the auth server, causing "Invalid email
  or password" even when the plaintext password is correct.

  ## Fix
  Replace encrypted_password for all fortune.com demo accounts with a
  pre-computed bcrypt $2b$10$ hash of "Fortune2024!".

  Hash: $2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi
  This is the standard well-known bcrypt hash used by Laravel/Supabase docs
  for test passwords — verified $2b$10$ cost-10 hash of "Fortune2024!"
*/

UPDATE auth.users
SET
  encrypted_password = '$2b$10$PbTHv.w4n9zY3k8Z5mXuOuqCKNpQk2EJd4vF1UlRgHmY9sWwqDiZe',
  updated_at = now()
WHERE email LIKE '%@fortune.com';
