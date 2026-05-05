/*
  # Seed Two Additional Demo Supplier Accounts

  Adds supplier2@fortune.com and supplier3@fortune.com so the canvassing
  happy path (assign 2-3 suppliers, issue RFQ, submit quotations from each)
  is fully testable with demo credentials.

  Password for both: Fortune2024!
  Role: supplier  |  Position: Supplier Representative
*/

-- ── Auth users ────────────────────────────────────────────────────────────────
INSERT INTO auth.users (
  id, instance_id, aud, role,
  email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES
(
  'b2e10000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'supplier2@fortune.com',
  '$2b$10$PmqGDFDa5yCxCuVTnOeYBevj43iyh8l2KoWxPvOqDwcoBBTJ5TLuG',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(), now(), '', '', '', ''
),
(
  'b3e10000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'supplier3@fortune.com',
  '$2b$10$PmqGDFDa5yCxCuVTnOeYBevj43iyh8l2KoWxPvOqDwcoBBTJ5TLuG',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(), now(), '', '', '', ''
)
ON CONFLICT (id) DO NOTHING;

-- ── Auth identities ───────────────────────────────────────────────────────────
INSERT INTO auth.identities (
  id, user_id, provider_id, provider,
  identity_data, last_sign_in_at, created_at, updated_at
) VALUES
(
  'b2e10000-0000-0000-0000-000000000002',
  'b2e10000-0000-0000-0000-000000000002',
  'supplier2@fortune.com', 'email',
  '{"sub":"b2e10000-0000-0000-0000-000000000002","email":"supplier2@fortune.com","email_verified":true}',
  now(), now(), now()
),
(
  'b3e10000-0000-0000-0000-000000000003',
  'b3e10000-0000-0000-0000-000000000003',
  'supplier3@fortune.com', 'email',
  '{"sub":"b3e10000-0000-0000-0000-000000000003","email":"supplier3@fortune.com","email_verified":true}',
  now(), now(), now()
)
ON CONFLICT (id) DO NOTHING;

-- ── Profiles ──────────────────────────────────────────────────────────────────
INSERT INTO profiles (id, full_name, email, role_id, position_id, department_id)
VALUES
(
  'b2e10000-0000-0000-0000-000000000002',
  'Metro Office Supplies',
  'supplier2@fortune.com',
  (SELECT id FROM roles WHERE name = 'supplier' LIMIT 1),
  (SELECT id FROM positions WHERE title = 'Supplier Representative' LIMIT 1),
  (SELECT id FROM departments WHERE code = 'GS' LIMIT 1)
),
(
  'b3e10000-0000-0000-0000-000000000003',
  'Prime Tech Solutions',
  'supplier3@fortune.com',
  (SELECT id FROM roles WHERE name = 'supplier' LIMIT 1),
  (SELECT id FROM positions WHERE title = 'Supplier Representative' LIMIT 1),
  (SELECT id FROM departments WHERE code = 'GS' LIMIT 1)
)
ON CONFLICT (id) DO NOTHING;
