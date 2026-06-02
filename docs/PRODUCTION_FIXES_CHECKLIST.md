# Production Fixes Checklist

## Fortune Procurement System

**Created:** May 31, 2026  
**Based on:** Production Readiness Audit Report  
**Status:** 🔴 NOT READY FOR PRODUCTION

---

## Quick Summary

| Priority | Count | Status |
|----------|-------|--------|
| 🔴 P0 - Critical | 2 | Must fix before production |
| 🟠 P1 - High | 5 | Should fix before production |
| 🟡 P2 - Medium | 8 | Fix within first sprint |
| 🟢 P3 - Low | 4 | Future iterations |

**Minimum effort to go live:** ~4-5 hours (P0 + P1)

---

## 🔴 P0 - CRITICAL (Block Production)

These issues MUST be resolved before going live. They represent immediate security risks.

### P0-1: RLS Disabled on `rfq_suppliers` Table

| Field | Value |
|-------|-------|
| **Location** | Database: `public.rfq_suppliers` |
| **Risk** | Any authenticated user can read/modify ALL supplier RFQ assignments |
| **Impact** | Data exposure, unauthorized modifications |
| **Effort** | 5 minutes |
| **Fix Type** | SQL Migration |

**Remediation:**
```sql
-- Enable RLS (policies already exist)
ALTER TABLE public.rfq_suppliers ENABLE ROW LEVEL SECURITY;
```

**Verification:**
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'rfq_suppliers';
-- Should return: rowsecurity = true
```

- [ ] Fixed
- [ ] Verified

---

### P0-2: Demo Credentials Exposed in Login Page

| Field | Value |
|-------|-------|
| **Location** | `app/login/page.tsx` (lines 170-230) |
| **Risk** | Anyone can access the system with known credentials (`Fortune2024!`) |
| **Impact** | Complete system compromise |
| **Effort** | 15 minutes |
| **Fix Type** | Code Change |

**Remediation:**
```typescript
// Wrap the demo credentials section with environment check
{process.env.NODE_ENV === 'development' && (
  <Card className="border-pq-neutral-200 bg-pq-white shadow-sm overflow-hidden">
    <Accordion type="single" collapsible className="w-full">
      {/* ... demo credentials content ... */}
    </Accordion>
  </Card>
)}
```

**Verification:**
1. Build production: `npm run build`
2. Start production: `npm run start`
3. Navigate to login page
4. Confirm demo credentials section is NOT visible

- [ ] Fixed
- [ ] Verified

---

## 🟠 P1 - HIGH (Should Fix Before Production)

These issues should be resolved before production. They represent significant security or quality concerns.

### P1-1: Overly Permissive `approval_instances` UPDATE Policy

| Field | Value |
|-------|-------|
| **Location** | Database: `public.approval_instances` |
| **Risk** | Any authenticated user can update any approval instance |
| **Impact** | Approval workflow bypass, unauthorized approvals |
| **Effort** | 30 minutes |
| **Fix Type** | SQL Migration |

**Current Policy (Problematic):**
```sql
-- Policy: "Authenticated users can update approval instances"
-- WITH CHECK (true) -- Allows ANY update
```

**Remediation:**
```sql
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can update approval instances" ON approval_instances;

-- Create restrictive policy
CREATE POLICY "Approvers can update approval instances" ON approval_instances
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() 
    AND r.name IN ('approver', 'procurement', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() 
    AND r.name IN ('approver', 'procurement', 'admin')
  )
);
```

- [ ] Fixed
- [ ] Verified

---

### P1-2: Overly Permissive `audit_logs` INSERT Policy

| Field | Value |
|-------|-------|
| **Location** | Database: `public.audit_logs` |
| **Risk** | Any authenticated user can insert fake audit log entries |
| **Impact** | Compliance issues, audit trail manipulation |
| **Effort** | 15 minutes |
| **Fix Type** | SQL Migration |

**Current Policy (Problematic):**
```sql
-- Policy: "Authenticated users can insert audit logs"
-- WITH CHECK (true) -- Allows ANY insert
```

**Remediation:**
```sql
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON audit_logs;

-- Create restrictive policy - users can only create logs for themselves
CREATE POLICY "Users can insert own audit logs" ON audit_logs
FOR INSERT TO authenticated
WITH CHECK (actor_id = auth.uid());
```

- [ ] Fixed
- [ ] Verified

---

### P1-3: ESLint Disabled During Builds

| Field | Value |
|-------|-------|
| **Location** | `next.config.js` |
| **Risk** | Code quality issues not caught during build |
| **Impact** | Potential bugs, inconsistent code |
| **Effort** | 2 hours (may need to fix existing lint errors) |
| **Fix Type** | Config Change + Code Fixes |

**Current Config (Problematic):**
```javascript
eslint: {
  ignoreDuringBuilds: true,
}
```

**Remediation:**
```javascript
eslint: {
  ignoreDuringBuilds: false,
}
```

**Note:** This may surface existing ESLint errors that need to be fixed before the build succeeds.

**Verification:**
```bash
npm run lint
npm run build
```

- [ ] Fixed
- [ ] Lint errors resolved
- [ ] Build succeeds

---

### P1-4: Leaked Password Protection Disabled

| Field | Value |
|-------|-------|
| **Location** | Supabase Dashboard → Authentication → Settings |
| **Risk** | Users can set passwords that have been exposed in data breaches |
| **Impact** | Account compromise via credential stuffing |
| **Effort** | 5 minutes |
| **Fix Type** | Dashboard Setting |

**Remediation:**
1. Go to Supabase Dashboard
2. Navigate to Authentication → Settings
3. Find "Leaked Password Protection"
4. Enable it

**Verification:**
- Try to set a known leaked password (e.g., "password123")
- Should be rejected

- [ ] Fixed
- [ ] Verified

---

### P1-5: SECURITY DEFINER Functions Callable by Anonymous

| Field | Value |
|-------|-------|
| **Location** | Database functions |
| **Risk** | Anonymous users can execute privileged functions |
| **Impact** | Potential data manipulation |
| **Effort** | 1 hour |
| **Fix Type** | SQL Migration |

**Affected Functions:**
- `auth_is_supplier_only`
- `generate_pr2_number`
- `generate_rfq_number`
- `generate_grn_number`
- `generate_rse_number`

**Remediation:**
```sql
-- Revoke execute from anon role for each function
REVOKE EXECUTE ON FUNCTION generate_pr2_number FROM anon;
REVOKE EXECUTE ON FUNCTION generate_rfq_number FROM anon;
REVOKE EXECUTE ON FUNCTION generate_grn_number FROM anon;
REVOKE EXECUTE ON FUNCTION generate_rse_number FROM anon;
REVOKE EXECUTE ON FUNCTION auth_is_supplier_only FROM anon;

-- Grant only to authenticated users
GRANT EXECUTE ON FUNCTION generate_pr2_number TO authenticated;
GRANT EXECUTE ON FUNCTION generate_rfq_number TO authenticated;
GRANT EXECUTE ON FUNCTION generate_grn_number TO authenticated;
GRANT EXECUTE ON FUNCTION generate_rse_number TO authenticated;
GRANT EXECUTE ON FUNCTION auth_is_supplier_only TO authenticated;
```

- [ ] Fixed
- [ ] Verified

---

## 🟡 P2 - MEDIUM (First Sprint Post-Launch)

These issues should be addressed within the first sprint after launch.

### P2-1: No Rate Limiting on API Routes

| Field | Value |
|-------|-------|
| **Location** | All `/app/api/*` routes |
| **Risk** | Brute force attacks, DoS |
| **Effort** | 4 hours |
| **Fix Type** | Middleware Implementation |

**Remediation Options:**
1. Use Vercel Edge Middleware with rate limiting
2. Implement custom rate limiting with Redis/Upstash
3. Use a service like Cloudflare

- [ ] Fixed

---

### P2-2: No MFA/2FA Implementation

| Field | Value |
|-------|-------|
| **Location** | Auth flow |
| **Risk** | Single factor authentication vulnerable to credential theft |
| **Effort** | 8 hours |
| **Fix Type** | Feature Implementation |

**Remediation:**
- Implement Supabase MFA (TOTP)
- Add MFA enrollment flow
- Add MFA verification on login

- [ ] Fixed

---

### P2-3: No Account Lockout Mechanism

| Field | Value |
|-------|-------|
| **Location** | Auth flow |
| **Risk** | Unlimited login attempts enable brute force |
| **Effort** | 4 hours |
| **Fix Type** | Feature Implementation |

**Remediation:**
- Track failed login attempts per user/IP
- Lock account after X failed attempts
- Implement unlock mechanism (time-based or admin)

- [ ] Fixed

---

### P2-4: Image Optimization Disabled

| Field | Value |
|-------|-------|
| **Location** | `next.config.js` |
| **Risk** | Poor performance, larger bundle sizes |
| **Effort** | 1 hour |
| **Fix Type** | Config Change |

**Current Config:**
```javascript
images: { unoptimized: true }
```

**Remediation:**
```javascript
images: {
  unoptimized: false,
  remotePatterns: [
    {
      protocol: 'https',
      hostname: '*.supabase.co',
    },
  ],
}
```

- [ ] Fixed

---

### P2-5: Function search_path Mutable

| Field | Value |
|-------|-------|
| **Location** | Database functions |
| **Risk** | Search path injection attacks |
| **Effort** | 2 hours |
| **Fix Type** | SQL Migration |

**Affected Functions:**
- `generate_grn_number`
- `generate_rse_number`
- `generate_rfq_number`
- `generate_pr2_number`
- Others

**Remediation:**
```sql
-- For each function, alter to set search_path
ALTER FUNCTION generate_grn_number() SET search_path = public;
ALTER FUNCTION generate_rse_number() SET search_path = public;
ALTER FUNCTION generate_rfq_number() SET search_path = public;
ALTER FUNCTION generate_pr2_number() SET search_path = public;
```

- [ ] Fixed

---

### P2-6: No Automated Tests

| Field | Value |
|-------|-------|
| **Location** | Project-wide |
| **Risk** | Regressions, bugs in production |
| **Effort** | 40+ hours |
| **Fix Type** | Test Implementation |

**Remediation:**
1. Set up Jest or Vitest
2. Write unit tests for critical functions
3. Write integration tests for API routes
4. Write E2E tests for critical workflows

- [ ] Test framework set up
- [ ] Unit tests written
- [ ] Integration tests written
- [ ] E2E tests written

---

### P2-7: Overly Permissive `notifications` INSERT Policy

| Field | Value |
|-------|-------|
| **Location** | Database: `public.notifications` |
| **Risk** | Any user can spam notifications |
| **Effort** | 15 minutes |
| **Fix Type** | SQL Migration |

**Remediation:**
```sql
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON notifications;

CREATE POLICY "System can insert notifications" ON notifications
FOR INSERT TO authenticated
WITH CHECK (
  -- Only allow if user is admin/procurement or creating for themselves
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() 
    AND r.name IN ('admin', 'procurement')
  )
  OR user_id = auth.uid()
);
```

- [ ] Fixed

---

### P2-8: Overly Permissive `pr1_requests` UPDATE Policy

| Field | Value |
|-------|-------|
| **Location** | Database: `public.pr1_requests` |
| **Risk** | Unauthorized PR1 modifications |
| **Effort** | 30 minutes |
| **Fix Type** | SQL Migration |

**Remediation:**
Review and tighten the `WITH CHECK` clause to ensure only authorized users can update.

- [ ] Fixed

---

## 🟢 P3 - LOW (Future Iterations)

These are improvements that can be addressed in future development cycles.

### P3-1: Password Complexity Requirements

| Field | Value |
|-------|-------|
| **Location** | Auth flow |
| **Effort** | 2 hours |

**Current:** Only 8 character minimum  
**Recommended:** Add uppercase, lowercase, number, special character requirements

- [ ] Fixed

---

### P3-2: Structured Audit Log Diffs

| Field | Value |
|-------|-------|
| **Location** | Audit system |
| **Effort** | 8 hours |

**Current:** Only `payload` JSON  
**Recommended:** Store structured before/after values for better audit trail

- [ ] Fixed

---

### P3-3: Optimistic Locking for Concurrent Edits

| Field | Value |
|-------|-------|
| **Location** | Data layer |
| **Effort** | 16 hours |

**Current:** No handling for concurrent modifications  
**Recommended:** Add version columns and conflict detection

- [ ] Fixed

---

### P3-4: Bundle Size Analysis

| Field | Value |
|-------|-------|
| **Location** | Build config |
| **Effort** | 2 hours |

**Recommended:** Add `@next/bundle-analyzer` to monitor bundle sizes

- [ ] Fixed

---

## Implementation Order

### Phase 1: Pre-Production (Required)
1. [ ] P0-1: Enable RLS on rfq_suppliers
2. [ ] P0-2: Hide demo credentials
3. [ ] P1-4: Enable leaked password protection
4. [ ] P1-1: Fix approval_instances policy
5. [ ] P1-2: Fix audit_logs policy
6. [ ] P1-5: Revoke anon access to functions
7. [ ] P1-3: Re-enable ESLint

### Phase 2: First Sprint Post-Launch
8. [ ] P2-7: Fix notifications policy
9. [ ] P2-8: Fix pr1_requests policy
10. [ ] P2-5: Fix function search_path
11. [ ] P2-4: Enable image optimization
12. [ ] P2-1: Add rate limiting

### Phase 3: Second Sprint
13. [ ] P2-3: Account lockout
14. [ ] P2-2: MFA/2FA

### Phase 4: Ongoing
15. [ ] P2-6: Automated tests
16. [ ] P3-1 through P3-4

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| Tech Lead | | | |
| Security Review | | | |
| Product Owner | | | |

---

**Document Version:** 1.0  
**Last Updated:** May 31, 2026
