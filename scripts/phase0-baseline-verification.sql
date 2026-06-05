-- Phase 0 baseline verification (Fortune Procurement)
-- Project: emddvbocupvufzvhcacz

-- 0.2 Tables without RLS
SELECT c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND NOT c.relrowsecurity
ORDER BY 1;

-- 0.4 rfq_suppliers RLS flag
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'rfq_suppliers';

-- 0.3 Permissive policies (qual or with_check literally true)
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual = 'true' OR with_check = 'true')
ORDER BY tablename, policyname;

-- 0.5 Demo users for regression matrix
SELECT p.id, p.email, p.full_name, r.name AS role, pos.title AS position
FROM profiles p
LEFT JOIN roles r ON r.id = p.role_id
LEFT JOIN positions pos ON pos.id = p.position_id
WHERE p.email LIKE '%@fortune.com' OR p.email LIKE '%fortune%'
ORDER BY r.name, p.email;

-- 0.6 Policy count per table
SELECT tablename, COUNT(*) AS policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- rfq_suppliers policies (F3 detail)
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'rfq_suppliers'
ORDER BY policyname;
