
/*
  # Fix Admin Demo Account Password Hash

  ## Problem
  The admin@fortune.com demo account was created with $2a$ bcrypt format,
  but Supabase auth requires the newer $2b$ format. This causes login failures.

  ## Fix
  Update admin@fortune.com to use the same verified $2b$10$ hash used by all other demo accounts.

  Hash: $2b$10$qmuXJawZXSRYXH2yaEQPDO2yT4Xg946N1XRX0fObpXcpkG0Assez6
  Password: Fortune2024!
*/

UPDATE auth.users
SET 
  encrypted_password = '$2b$10$qmuXJawZXSRYXH2yaEQPDO2yT4Xg946N1XRX0fObpXcpkG0Assez6',
  updated_at = now()
WHERE email = 'admin@fortune.com';
