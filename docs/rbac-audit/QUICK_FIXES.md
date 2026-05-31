# RBAC Audit - Quick Fixes Guide

**Date:** May 25, 2026  
**Priority:** CRITICAL FIXES ONLY

---

## 🔴 CRITICAL FIX #1: Enable RLS on rfq_suppliers

**Time Required:** 30 minutes  
**Risk if not fixed:** Data breach, unauthorized access to supplier data

### SQL Script:

```sql
-- 1. Enable RLS
ALTER TABLE public.rfq_suppliers ENABLE ROW LEVEL SECURITY;

-- 2. Add procurement policy
CREATE POLICY "Procurement can manage rfq_suppliers"
ON public.rfq_suppliers
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'procurement'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'procurement'
  )
);

-- 3. Add supplier policy
CREATE POLICY "Suppliers can manage own rfq_suppliers"
ON public.rfq_suppliers
FOR ALL
TO authenticated
USING (supplier_id = auth.uid())
WITH CHECK (supplier_id = auth.uid());

-- 4. Add requestor policy
CREATE POLICY "Requestors can view own rfq_suppliers"
ON public.rfq_suppliers
FOR SELECT
TO authenticated
USING (is_own_rfq_supplier(id));

-- 5. Add director policy
CREATE POLICY "Directors can view rfq_suppliers"
ON public.rfq_suppliers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN roles r ON r.id = p.role_id
    JOIN positions pos ON pos.id = p.position_id
    WHERE p.id = auth.uid() 
      AND r.name = 'approver' 
      AND pos.title = 'Director'
  )
);
```

### Verification:

```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'rfq_suppliers';

-- Should return: rowsecurity = true

-- Check policies exist
SELECT policyname FROM pg_policies 
WHERE tablename = 'rfq_suppliers';

-- Should return 4 policies
```

---

## 🔴 CRITICAL FIX #2: Restrict Audit Log Access

**Time Required:** 15 minutes  
**Risk if not fixed:** Information disclosure, privacy violation

### SQL Script:

```sql
-- 1. Drop overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can read audit logs" ON audit_logs;

-- 2. Create admin-only read policy
CREATE POLICY "Admins can read audit logs"
ON audit_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'admin'
  )
);

-- 3. Keep insert policy (all users can log)
-- No change needed - existing policy is correct
```

### Verification:

```sql
-- Check policies
SELECT policyname, cmd FROM pg_policies 
WHERE tablename = 'audit_logs';

-- Should show:
-- - "Admins can read audit logs" (SELECT)
-- - "Authenticated users can insert audit logs" (INSERT)
```

---

## 🔴 CRITICAL FIX #3: Create Next.js Middleware

**Time Required:** 1 hour  
**Risk if not fixed:** Unauthorized page access, client-side bypass

### Create File: `middleware.ts` (project root)

```typescript
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Protect admin routes
  if (req.nextUrl.pathname.startsWith('/admin')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role_id, roles(name)')
      .eq('id', session.user.id)
      .single();

    if ((profile as any)?.roles?.name !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  // Protect authenticated routes
  const protectedPaths = [
    '/dashboard',
    '/pr1',
    '/pr2',
    '/po',
    '/approvals',
    '/warehouse',
    '/supplier',
    '/tsqa',
    '/rfq',
    '/grn',
    '/delivery',
    '/accreditation',
  ];

  const isProtectedPath = protectedPaths.some(path => 
    req.nextUrl.pathname.startsWith(path)
  );

  if (isProtectedPath && !session) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return res;
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/dashboard/:path*',
    '/pr1/:path*',
    '/pr2/:path*',
    '/po/:path*',
    '/approvals/:path*',
    '/warehouse/:path*',
    '/supplier/:path*',
    '/tsqa/:path*',
    '/rfq/:path*',
    '/grn/:path*',
    '/delivery/:path*',
    '/accreditation/:path*',
  ],
};
```

### Verification:

1. Try accessing `/admin` without login → Should redirect to `/login`
2. Login as non-admin → Try accessing `/admin` → Should redirect to `/dashboard`
3. Try accessing `/dashboard` without login → Should redirect to `/login`

---

## Testing After Fixes

### Test Script:

```bash
# 1. Test RLS on rfq_suppliers
# Login as employee, try to query rfq_suppliers
# Should return only relevant records

# 2. Test audit log access
# Login as non-admin, try to query audit_logs
# Should return 403 or empty result

# 3. Test middleware
# Open browser in incognito mode
# Try to access /admin
# Should redirect to /login
```

### Rollback Plan:

If any fix causes issues:

```sql
-- Rollback RLS fix
ALTER TABLE public.rfq_suppliers DISABLE ROW LEVEL SECURITY;

-- Rollback audit log fix
DROP POLICY "Admins can read audit logs" ON audit_logs;
CREATE POLICY "Authenticated users can read audit logs"
ON audit_logs FOR SELECT TO authenticated USING (true);
```

For middleware, simply delete or rename `middleware.ts`.

---

## Post-Fix Actions

1. ✅ Verify all fixes are working
2. ✅ Monitor error logs for 24 hours
3. ✅ Update documentation
4. ✅ Schedule follow-up audit in 1 week
5. ✅ Plan for high-priority fixes

---

**IMPORTANT:** These fixes address the most critical security issues. Additional fixes are required for complete security. See `RBAC_SECURITY_AUDIT.md` for full recommendations.
