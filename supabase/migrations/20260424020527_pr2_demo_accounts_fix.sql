/*
  # Fix PR2 Approval Demo Accounts

  ## Summary
  Five demo accounts required for PR2 approval workflow testing have $2a$ bcrypt hashes
  which are rejected by GoTrue/Supabase Auth (requires $2b$ prefix). This migration:

  1. Resets passwords to a verified $2b$10$ bcrypt hash of "Fortune2024!"
  2. Ensures email_confirmed_at is set for all 5 accounts
  3. Fixes identity email_verified flag to true so logins succeed
  4. No profile, role, or position changes needed (all 5 are correctly configured)

  ## Affected Accounts
  - procurement@fortune.com  (role: procurement, position: Procurement Staff)
  - dept.head@fortune.com    (role: approver,    position: Department Head)
  - proc.manager@fortune.com (role: procurement, position: Procurement Manager)
  - director@fortune.com     (role: approver,    position: Director)
  - buyer@fortune.com        (role: procurement, position: Buyer)

  ## Hash Verification
  Hash '$2b$10$qmuXJawZXSRYXH2yaEQPDO2yT4Xg946N1XRX0fObpXcpkG0Assez6' is a verified
  bcrypt $2b$10$ hash of "Fortune2024!" (same hash used for supplier2/supplier3 accounts
  which are confirmed working).
*/

-- 1. Reset passwords to verified $2b$ hash for all 5 PR2 approval demo accounts
UPDATE auth.users
SET
  encrypted_password  = '$2b$10$qmuXJawZXSRYXH2yaEQPDO2yT4Xg946N1XRX0fObpXcpkG0Assez6',
  email_confirmed_at  = COALESCE(email_confirmed_at, now()),
  updated_at          = now()
WHERE email IN (
  'procurement@fortune.com',
  'dept.head@fortune.com',
  'proc.manager@fortune.com',
  'director@fortune.com',
  'buyer@fortune.com'
);

-- 2. Mark identities as email-verified so GoTrue accepts the login
UPDATE auth.identities
SET
  identity_data = jsonb_set(
    jsonb_set(identity_data, '{email_verified}', 'true'),
    '{email}', identity_data->'email'
  ),
  updated_at = now()
WHERE user_id IN (
  SELECT id FROM auth.users
  WHERE email IN (
    'procurement@fortune.com',
    'dept.head@fortune.com',
    'proc.manager@fortune.com',
    'director@fortune.com',
    'buyer@fortune.com'
  )
)
AND provider = 'email';
