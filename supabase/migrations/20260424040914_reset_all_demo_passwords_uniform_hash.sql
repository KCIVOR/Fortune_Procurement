/*
  # Reset all demo account passwords to uniform bcrypt hash

  ## Problem
  Some demo accounts (finance.director, supplier, employee, supervisor, etc.) use
  the older $2a$ bcrypt variant, while buyer and proc.manager were already updated
  to $2b$. Mixed variants can cause login failures depending on the bcrypt library.

  ## Fix
  Apply the same known-working $2b$10$ hash for "Fortune2024!" to all demo accounts.
  This is the same hash already used by buyer@fortune.com and proc.manager@fortune.com.

  Hash: $2b$10$qmuXJawZXSRYXH2yaEQPDO2yT4Xg946N1XRX0fObpXcpkG0Assez6
  Password: Fortune2024!
*/

UPDATE auth.users
SET 
  encrypted_password = '$2b$10$qmuXJawZXSRYXH2yaEQPDO2yT4Xg946N1XRX0fObpXcpkG0Assez6',
  updated_at = now()
WHERE email IN (
  'buyer@fortune.com',
  'proc.manager@fortune.com',
  'finance.director@fortune.com',
  'supplier@fortune.com',
  'employee@fortune.com',
  'supervisor@fortune.com',
  'dept.head@fortune.com',
  'director@fortune.com',
  'procurement@fortune.com',
  'supplier2@fortune.com',
  'supplier3@fortune.com',
  'wh.manager@fortune.com',
  'warehouse@fortune.com'
);
