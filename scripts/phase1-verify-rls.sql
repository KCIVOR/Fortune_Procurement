-- Phase 1 post-migration checks (run via: npx supabase db query --linked -f scripts/phase1-verify-rls.sql)
-- Note: CLI runs as elevated role; use app login tests for JWT-scoped checks.

-- 1. All public tables have RLS
SELECT c.relname AS table_without_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;

-- 2. Removed policies should be gone
SELECT policyname, tablename
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname IN (
    'Authenticated users can read all PR1s',
    'Authenticated users can read all PR1 items',
    'Authenticated users can update approval instances',
    'Authenticated users can read audit logs',
    'Authenticated users can read warehouse validations',
    'Authenticated users can insert warehouse validations'
  );

-- 3. Helpers exist
SELECT proname FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND proname IN ('is_role', 'can_read_pr1', 'can_read_warehouse_validation');
