/*
  Seed migrations use crypt() / gen_salt() from pgcrypto.
  Fresh Supabase projects may not have this enabled; seeds use gen_salt('bf'::text)
  so Postgres resolves gen_salt(text) on strict servers.
*/
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
