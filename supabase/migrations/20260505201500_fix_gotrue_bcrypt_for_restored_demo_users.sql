/*
  Restored demo users (and any SQL-seeded Fortune accounts) may still use
  pgcrypto crypt() hashes that GoTrue rejects; use the uniform $2b$10$ hash
  documented in 20260424040914_reset_all_demo_passwords_uniform_hash.sql.

  Password: Fortune2024!
*/

UPDATE auth.users
SET
  encrypted_password = '$2b$10$qmuXJawZXSRYXH2yaEQPDO2yT4Xg946N1XRX0fObpXcpkG0Assez6',
  updated_at = now()
WHERE email LIKE '%@fortune.com';
