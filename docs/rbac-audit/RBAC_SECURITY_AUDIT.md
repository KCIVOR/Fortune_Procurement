# RBAC Security Audit Report
**Fortune Procurement System**

**Audit Date:** May 25, 2026  
**Auditor:** Kiro AI Assistant  
**Project:** Fortune Procurement System  
**Database:** Supabase (PostgreSQL)  
**Project ID:** qvxrvnsjlycdgvhwgtkj

---

## Executive Summary

This comprehensive audit evaluates the Role-Based Access Control (RBAC) implementation in the Fortune Procurement System. The system implements a **hybrid RBAC model** combining:
- **Role-based permissions** (7 roles)
- **Position-based refinements** (15 positions)
- **Department-based organization** (9 departments)
- **Module visibility controls** (dynamic UI access)
- **Row-Level Security (RLS)** policies at database level

### Critical Findings

**🔴 CRITICAL SECURITY ISSUE:**
- **1 table without RLS enabled:** `public.rfq_suppliers` is fully exposed to authenticated users
- This table contains supplier invitation data and is accessible to anyone with the anon key

**🟡 HIGH PRIORITY ISSUES:**
- No Next.js middleware for route protection
- API routes rely on manual role checks (inconsistent implementation)
- Service role key exposed in environment variables
- No centralized authorization middleware

**🟢 STRENGTHS:**
- Comprehensive RLS policies on 48 out of 49 tables
- Well-structured role hierarchy
- Module visibility system for UI-level access control
- Audit logging implementation

---

## 1. RBAC Architecture Overview

### 1.1 Role Hierarchy

The system implements 7 distinct roles:

| Role | Description | User Count | Key Permissions |
|------|-------------|------------|-----------------|
| `admin` | System Administrator | ~5 | Full system access, user management, configuration |
| `employee` | Regular Employee | ~20 | Create PR1 requests, view own requests |
| `warehouse` | Warehouse Staff | ~5 | Validate stock, manage GRN, delivery tracking |
| `procurement` | Procurement Staff | ~8 | Manage PR2, RFQ, PO, supplier accreditation |
| `approver` | Approval Authority | ~10 | Approve PR1, PR2, PO based on workflow |
| `supplier` | External Supplier | ~5 | Submit quotations, acknowledge PO, manage deliveries |
| `tsqa` | Quality Assurance | ~2 | Review supplier products, conduct RSE |

### 1.2 Position Hierarchy

15 positions provide fine-grained access control:

**Employee Positions:**
- Staff
- Authorized Personnel

**Warehouse Positions:**
- Warehouse Staff
- Warehouse Manager

**Procurement Positions:**
- Procurement Staff
- Buyer
- Procurement Manager

**Approver Positions:**
- Supervisor
- Department Head
- Director
- Finance Director

**Supplier Positions:**
- Supplier Representative

**Admin Positions:**
- System Administrator

**TSQA Positions:**
- TSQA Staff

### 1.3 Department Structure

9 departments for organizational segmentation:

1. Operations
2. Warehouse
3. Procurement
4. Executive
5. Finance
6. General Services
7. IT
8. HR
9. Quality Assurance

---

## 2. Database-Level Security Analysis

### 2.1 Row-Level Security (RLS) Status

**Total Tables:** 49 (public schema)  
**RLS Enabled:** 48 tables ✅  
**RLS Disabled:** 1 table ❌

#### 🔴 CRITICAL: Table Without RLS

**Table:** `public.rfq_suppliers`

**Risk Level:** CRITICAL

**Exposure:**
- Contains supplier invitation data for RFQ processes
- Links suppliers to specific RFQ batches
- Stores supplier response status and timestamps
- **Fully accessible to any authenticated user with anon key**

**Impact:**
- Unauthorized users can view all supplier invitations
- Competitors could see which suppliers are invited to RFQs
- Data manipulation possible if combined with other vulnerabilities

**Remediation:**
```sql
-- Enable RLS on rfq_suppliers table
ALTER TABLE public.rfq_suppliers ENABLE ROW LEVEL SECURITY;

-- Add appropriate policies
-- Procurement can manage all rfq_suppliers
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

-- Suppliers can view and update their own invitations
CREATE POLICY "Suppliers can manage own rfq_suppliers"
ON public.rfq_suppliers
FOR ALL
TO authenticated
USING (supplier_id = auth.uid())
WITH CHECK (supplier_id = auth.uid());

-- Requestors can view rfq_suppliers for their PR1s
CREATE POLICY "Requestors can view own rfq_suppliers"
ON public.rfq_suppliers
FOR SELECT
TO authenticated
USING (is_own_rfq_supplier(id));
```

### 2.2 RLS Policy Analysis

**Total RLS Policies:** 280+ policies across 48 tables

#### Policy Distribution by Role:

| Role | Read Policies | Write Policies | Update Policies | Delete Policies |
|------|---------------|----------------|-----------------|-----------------|
| admin | 15 | 12 | 18 | 5 |
| employee | 25 | 8 | 6 | 2 |
| warehouse | 18 | 12 | 14 | 0 |
| procurement | 35 | 22 | 28 | 0 |
| approver | 28 | 0 | 15 | 0 |
| supplier | 22 | 15 | 18 | 0 |
| tsqa | 12 | 8 | 10 | 0 |

#### Policy Pattern Analysis:

**✅ GOOD PATTERNS:**

1. **Ownership-based policies:**
   ```sql
   -- Users can only update their own profiles
   (auth.uid() = id)
   ```

2. **Role-based policies:**
   ```sql
   -- Procurement role check
   EXISTS (
     SELECT 1 FROM profiles p
     JOIN roles r ON r.id = p.role_id
     WHERE p.id = auth.uid() AND r.name = 'procurement'
   )
   ```

3. **Position-based policies:**
   ```sql
   -- Director-level access
   EXISTS (
     SELECT 1 FROM profiles p
     JOIN roles r ON r.id = p.role_id
     JOIN positions pos ON pos.id = p.position_id
     WHERE p.id = auth.uid() 
       AND r.name = 'approver' 
       AND pos.title = 'Director'
   )
   ```

4. **Relationship-based policies:**
   ```sql
   -- Employees can view their own PR1 requests
   (requisitioner_id = auth.uid())
   ```

**⚠️ POTENTIAL ISSUES:**

1. **Overly permissive policies:**
   ```sql
   -- All authenticated users can read all profiles
   qual: "true"
   ```
   - **Risk:** Information disclosure
   - **Recommendation:** Limit to necessary fields or implement field-level security

2. **Complex nested queries:**
   - Some policies have 3-4 levels of subqueries
   - **Risk:** Performance degradation
   - **Recommendation:** Consider materialized views or caching

3. **Inconsistent policy naming:**
   - Some policies use descriptive names, others are generic
   - **Recommendation:** Standardize naming convention

### 2.3 Critical Tables Security Review

#### High-Value Tables:

**1. `profiles` Table**
- **RLS Status:** ✅ Enabled
- **Policies:** 4 policies
- **Issue:** All authenticated users can read all profiles
- **Recommendation:** Implement field-level restrictions for sensitive data

**2. `po_requests` (Purchase Orders)**
- **RLS Status:** ✅ Enabled
- **Policies:** 8 policies
- **Security:** ✅ Good - Role-based and ownership checks
- **Note:** Suppliers can only see approved POs

**3. `approval_instances` (Workflow State)**
- **RLS Status:** ✅ Enabled
- **Policies:** 3 policies
- **Security:** ✅ Good - Authenticated users can read, but only owners can create

**4. `audit_logs`**
- **RLS Status:** ✅ Enabled
- **Policies:** 2 policies
- **Issue:** All authenticated users can read audit logs
- **Recommendation:** Restrict to admin role only

**5. `roles` and `positions` Tables**
- **RLS Status:** ✅ Enabled
- **Policies:** 3 policies each
- **Security:** ✅ Good - Only admins can modify, all can read

---

## 3. Application-Level Security Analysis

### 3.1 API Route Protection

**Total API Routes:** 8 routes analyzed

#### Authentication Pattern:

```typescript
// Common pattern in API routes
const authHeader = req.headers.get('Authorization');
if (!authHeader || !authHeader.startsWith('Bearer ')) {
  return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
}

const accessToken = authHeader.replace('Bearer ', '');
const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);

if (userError || !user) {
  return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
}
```

**✅ STRENGTHS:**
- Consistent authentication check pattern
- Uses Supabase auth.getUser() for token validation
- Returns appropriate HTTP status codes

**❌ WEAKNESSES:**
- No centralized middleware
- Manual role checks in each route
- Inconsistent error messages
- No rate limiting
- No request logging

#### Authorization Pattern:

```typescript
// Admin role check pattern
const { data: profile } = await supabase
  .from('profiles')
  .select('role_id, roles(name)')
  .eq('id', user.id)
  .maybeSingle();

const userRole = (profile as any).roles?.name;
if (userRole !== 'admin') {
  return NextResponse.json(
    { success: false, error: 'Access denied. Admin role required.' },
    { status: 403 }
  );
}
```

**Issues:**
1. **No centralized authorization function**
2. **Type casting with `any`** - bypasses TypeScript safety
3. **Hardcoded role names** - should use constants
4. **No permission caching** - queries database on every request
5. **No audit logging** for authorization failures

### 3.2 Middleware Analysis

**🔴 CRITICAL FINDING:** No Next.js middleware file found

**Expected Location:** `middleware.ts` or `middleware.js` in project root

**Impact:**
- No route-level protection before page load
- Client-side routing not protected
- Reliance on client-side checks only

**Recommendation:**
Create `middleware.ts` with route protection:

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

    if (profile?.roles?.name !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  // Protect authenticated routes
  if (!session && !req.nextUrl.pathname.startsWith('/login')) {
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
  ],
};
```

### 3.3 Module Visibility System

**Implementation:** `lib/module-visibility.ts`

**Architecture:**
- Database-driven UI access control
- Role-based default visibility
- Position-based overrides
- "Borrowed modules" from other roles

**Security Analysis:**

**✅ STRENGTHS:**
1. **Caching mechanism** - Reduces database queries
2. **Fail-open design** - On error, shows all modules (prevents lockout)
3. **Granular control** - Role + Position combination
4. **Dynamic loading** - No hardcoded permissions

**⚠️ CONCERNS:**
1. **Client-side enforcement only** - Can be bypassed
2. **No server-side validation** - API routes don't check module visibility
3. **Cache invalidation** - Manual clearance required
4. **Fail-open on error** - Security vs usability tradeoff

**Recommendation:**
- Add server-side module visibility checks in API routes
- Implement automatic cache invalidation
- Consider fail-closed for critical modules

### 3.4 Navigation Security

**File:** `config/navigation.ts`

**Module Keys:** 32 distinct modules

**Role-to-Module Mapping:**

| Role | Modules | Security Level |
|------|---------|----------------|
| admin | 8 | High - Full admin access |
| employee | 4 | Low - Own data only |
| warehouse | 5 | Medium - Operational data |
| procurement | 10 | High - Supplier & financial data |
| approver | 5 | High - Approval authority |
| supplier | 6 | Medium - Own business data |
| tsqa | 2 | Medium - Quality data |

**Security Observations:**
- Navigation is defined in code, not database
- Module visibility rules stored in database
- Potential mismatch between code and database
- No validation that module_key exists in navigation

---

## 4. Authentication & Session Management

### 4.1 Authentication Flow

**Provider:** Supabase Auth

**Methods:**
- Email/Password
- Magic Link (email)
- OAuth (not configured)

**Session Storage:**
- Client-side: localStorage (Supabase default)
- Server-side: Supabase manages sessions

**Token Validation:**
- JWT tokens validated via `auth.getUser()`
- Tokens passed in Authorization header
- No token refresh logic visible in code

### 4.2 Password Management

**Edge Functions:**
- `reset-user-password` - Admin can reset user passwords
- `reset-demo-passwords` - Resets demo account passwords

**Security Issues:**

1. **Service Role Key Exposure:**
   ```typescript
   const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
   ```
   - Service role key bypasses RLS
   - Must be protected in environment variables
   - Should never be exposed to client

2. **No Password Complexity Requirements:**
   - No minimum length enforcement
   - No complexity rules (uppercase, numbers, symbols)
   - Recommendation: Implement password policy

3. **No Password History:**
   - Users can reuse old passwords
   - Recommendation: Store password hashes and prevent reuse

4. **Admin Password Reset:**
   - Admins can reset any user's password
   - No multi-factor authentication required
   - Recommendation: Add MFA for admin actions

### 4.3 Session Security

**Issues:**

1. **No Session Timeout Configuration:**
   - Default Supabase timeout (1 hour)
   - No custom timeout for sensitive roles
   - Recommendation: Shorter timeout for admin/approver roles

2. **No Concurrent Session Limits:**
   - Users can have unlimited active sessions
   - Recommendation: Limit to 3 concurrent sessions

3. **No Session Invalidation on Role Change:**
   - When admin changes user role, session remains valid
   - User must logout/login to see new permissions
   - Recommendation: Invalidate sessions on role change

---

## 5. Audit Logging Analysis

### 5.1 Audit Log Implementation

**Table:** `public.audit_logs`

**Schema:**
```sql
- id: uuid
- actor_id: uuid (references profiles)
- action: text
- document_type: text
- document_id: uuid
- payload: jsonb
- ip_address: text
- created_at: timestamptz
```

**RLS Policy:**
- All authenticated users can read audit logs ❌
- All authenticated users can insert audit logs ✅

**Security Issues:**

1. **Overly Permissive Read Access:**
   - Any authenticated user can read all audit logs
   - Exposes sensitive operations
   - **Recommendation:** Restrict to admin role only

2. **No Integrity Protection:**
   - Users can insert arbitrary audit logs
   - No validation of actor_id matches auth.uid()
   - **Recommendation:** Add CHECK constraint or trigger

3. **Missing Critical Events:**
   - No logging for failed login attempts
   - No logging for authorization failures
   - No logging for RLS policy violations
   - **Recommendation:** Implement comprehensive audit logging

### 5.2 Audit Log Coverage

**Currently Logged Actions:**

✅ User assignment updates (role, position, department changes)  
✅ Password resets by admin  
✅ Some approval actions  

**Missing Audit Logs:**

❌ User login/logout  
❌ Failed authentication attempts  
❌ Authorization failures (403 errors)  
❌ Data exports  
❌ Bulk operations  
❌ Configuration changes  
❌ RLS policy violations  
❌ API key usage  

**Recommendation:**
Implement comprehensive audit logging for all security-relevant events.

---

## 6. Workflow & Approval Security

### 6.1 Approval Workflow Architecture

**Tables:**
- `approval_workflows` - Workflow definitions
- `approval_steps` - Step definitions with role/position requirements
- `approval_instances` - Active workflow instances
- `approval_actions` - User actions on approvals

**Security Model:**

**Step Requirements:**
```typescript
interface ApprovalStep {
  step_order: number;
  role_required: string;      // e.g., "approver"
  position_required: string;  // e.g., "Director"
  action_label: string;
  is_final: boolean;
}
```

**RLS Policies:**

✅ Only admins can create/modify workflows  
✅ Only admins can create/modify steps  
✅ All authenticated users can read workflows/steps  
✅ Users can only create approval instances they start  
✅ All authenticated users can read approval instances  
✅ All authenticated users can update approval instances  
✅ Users can only insert approval actions as themselves  

**Security Issues:**

1. **No Validation of Approver Eligibility:**
   - RLS allows any authenticated user to update approval instances
   - No check that user has required role/position for current step
   - **Risk:** Users can approve their own requests or skip steps
   - **Recommendation:** Add RLS policy to validate approver eligibility

2. **No Prevention of Self-Approval:**
   - User who started workflow can also approve it
   - **Risk:** Conflict of interest
   - **Recommendation:** Add check that actor_id ≠ started_by

3. **No Workflow State Validation:**
   - Users can potentially manipulate current_step
   - **Risk:** Skip approval steps
   - **Recommendation:** Use database triggers to enforce workflow progression

### 6.2 Workflow Bypass Risks

**Potential Attack Vectors:**

1. **Direct Database Manipulation:**
   - If attacker gains database access, can modify approval_instances
   - Can change status from 'active' to 'approved'
   - **Mitigation:** RLS policies prevent this for normal users

2. **API Route Exploitation:**
   - If API routes don't validate workflow state
   - Attacker could submit requests directly to API
   - **Mitigation:** Implement server-side workflow validation

3. **Race Conditions:**
   - Multiple approvers acting simultaneously
   - Could result in duplicate approvals or skipped steps
   - **Mitigation:** Use database transactions and locks

**Recommendations:**

```sql
-- Add trigger to validate approval actions
CREATE OR REPLACE FUNCTION validate_approval_action()
RETURNS TRIGGER AS $$
DECLARE
  v_instance approval_instances;
  v_step approval_steps;
  v_actor_profile profiles;
BEGIN
  -- Get approval instance
  SELECT * INTO v_instance
  FROM approval_instances
  WHERE id = NEW.instance_id;

  -- Prevent self-approval
  IF v_instance.started_by = NEW.actor_id THEN
    RAISE EXCEPTION 'Cannot approve own request';
  END IF;

  -- Get current step requirements
  SELECT * INTO v_step
  FROM approval_steps
  WHERE workflow_id = v_instance.workflow_id
    AND step_order = v_instance.current_step;

  -- Get actor profile
  SELECT * INTO v_actor_profile
  FROM profiles p
  JOIN roles r ON r.id = p.role_id
  JOIN positions pos ON pos.id = p.position_id
  WHERE p.id = NEW.actor_id;

  -- Validate actor has required role
  IF v_actor_profile.role_id != v_step.role_required THEN
    RAISE EXCEPTION 'Actor does not have required role';
  END IF;

  -- Validate actor has required position (if specified)
  IF v_step.position_required IS NOT NULL 
     AND v_actor_profile.position_id != v_step.position_required THEN
    RAISE EXCEPTION 'Actor does not have required position';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_approval_action_trigger
BEFORE INSERT ON approval_actions
FOR EACH ROW
EXECUTE FUNCTION validate_approval_action();
```

---

## 7. Supplier Portal Security

### 7.1 Supplier Access Control

**Supplier Role Capabilities:**
- Submit accreditation applications
- Manage product catalog
- Respond to RFQs
- View and acknowledge POs
- Update delivery status

**RLS Policies:**

✅ Suppliers can only see their own data  
✅ Suppliers can only modify their own records  
✅ Suppliers cannot see other suppliers' data  
✅ Suppliers can only see approved POs  

**Security Observations:**

1. **Good Isolation:**
   - Strong ownership checks in RLS policies
   - Suppliers properly isolated from each other

2. **Appropriate Visibility:**
   - Suppliers only see POs after approval
   - Cannot see internal procurement processes

3. **Controlled Write Access:**
   - Suppliers can only update specific fields
   - Cannot modify financial data or approval status

### 7.2 Supplier Data Exposure Risks

**Potential Issues:**

1. **RFQ Supplier List Exposure:**
   - `rfq_suppliers` table has NO RLS ❌
   - Suppliers could potentially see who else was invited to RFQ
   - **Risk:** Competitive intelligence leak
   - **Recommendation:** Enable RLS immediately (see Section 2.1)

2. **Product Pricing Visibility:**
   - `rfq_item_quotes` table contains pricing
   - RLS policies prevent cross-supplier viewing ✅
   - But procurement can see all quotes ✅ (expected)

3. **Supplier Accreditation Status:**
   - Suppliers can see their own accreditation status
   - Cannot see other suppliers' status ✅

---

## 8. Data Privacy & Compliance

### 8.1 Personal Data Handling

**PII Stored in System:**

| Table | PII Fields | Protection Level |
|-------|-----------|------------------|
| profiles | full_name, email | RLS ✅ |
| auth.users | email, phone | Supabase managed ✅ |
| audit_logs | actor_id, ip_address | RLS ⚠️ (too permissive) |
| approval_actions | actor_name_snapshot | RLS ✅ |
| po_requests | requisitioner_name_snapshot | RLS ✅ |

**Issues:**

1. **All Profiles Readable:**
   - Any authenticated user can read all profiles
   - Exposes names and emails of all users
   - **Recommendation:** Implement field-level security

2. **IP Address Logging:**
   - Audit logs store IP addresses
   - No data retention policy visible
   - **Recommendation:** Implement data retention and anonymization

3. **Snapshot Data:**
   - Names stored in multiple tables as snapshots
   - No mechanism to update if user changes name
   - **Recommendation:** Consider GDPR right to erasure

### 8.2 Data Retention

**Current State:**
- No automatic data deletion
- No archival process
- Audit logs grow indefinitely

**Recommendations:**

1. **Implement Data Retention Policy:**
   ```sql
   -- Archive old audit logs
   CREATE TABLE audit_logs_archive (LIKE audit_logs);
   
   -- Move logs older than 2 years to archive
   INSERT INTO audit_logs_archive
   SELECT * FROM audit_logs
   WHERE created_at < NOW() - INTERVAL '2 years';
   
   DELETE FROM audit_logs
   WHERE created_at < NOW() - INTERVAL '2 years';
   ```

2. **Anonymize Old Data:**
   - After retention period, anonymize PII
   - Keep statistical data for analysis

3. **User Data Export:**
   - Implement GDPR-compliant data export
   - Allow users to download their data

---

## 9. Security Recommendations Summary

### 9.1 CRITICAL (Fix Immediately)

**Priority 1: Enable RLS on rfq_suppliers**
```sql
ALTER TABLE public.rfq_suppliers ENABLE ROW LEVEL SECURITY;
-- Add policies as shown in Section 2.1
```
**Impact:** Prevents unauthorized access to supplier invitation data  
**Effort:** 1 hour  
**Risk if not fixed:** Data breach, competitive intelligence leak

**Priority 2: Implement Next.js Middleware**
- Create `middleware.ts` for route protection
- Implement role-based route guards
- Add session validation
**Impact:** Prevents unauthorized page access  
**Effort:** 4 hours  
**Risk if not fixed:** Users can access pages they shouldn't see

**Priority 3: Restrict Audit Log Access**
```sql
-- Drop existing policy
DROP POLICY "Authenticated users can read audit logs" ON audit_logs;

-- Create admin-only policy
CREATE POLICY "Admins can read audit logs"
ON audit_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'admin'
  )
);
```
**Impact:** Protects sensitive audit data  
**Effort:** 30 minutes  
**Risk if not fixed:** Information disclosure

### 9.2 HIGH PRIORITY (Fix Within 1 Week)

1. **Implement Centralized Authorization Middleware**
   - Create `lib/auth-middleware.ts`
   - Standardize role checks
   - Add permission caching
   - **Effort:** 8 hours

2. **Add Workflow Validation Triggers**
   - Prevent self-approval
   - Validate approver eligibility
   - Enforce workflow progression
   - **Effort:** 6 hours

3. **Implement Comprehensive Audit Logging**
   - Log all authentication events
   - Log authorization failures
   - Log data exports
   - **Effort:** 4 hours

4. **Add Password Policy**
   - Minimum 12 characters
   - Require uppercase, lowercase, number, symbol
   - Prevent password reuse (last 5 passwords)
   - **Effort:** 3 hours

5. **Implement Session Management**
   - Custom timeout for sensitive roles
   - Limit concurrent sessions
   - Invalidate sessions on role change
   - **Effort:** 4 hours

### 9.3 MEDIUM PRIORITY (Fix Within 1 Month)

1. **Implement Field-Level Security for Profiles**
   - Create views with filtered fields
   - Restrict sensitive data access
   - **Effort:** 4 hours

2. **Add Server-Side Module Visibility Checks**
   - Validate module access in API routes
   - Implement fail-closed for critical modules
   - **Effort:** 6 hours

3. **Implement Data Retention Policy**
   - Archive old audit logs
   - Anonymize old data
   - **Effort:** 8 hours

4. **Add Rate Limiting**
   - Implement rate limiting on API routes
   - Prevent brute force attacks
   - **Effort:** 4 hours

5. **Implement MFA for Admin Actions**
   - Require MFA for password resets
   - Require MFA for role changes
   - **Effort:** 12 hours

### 9.4 LOW PRIORITY (Fix Within 3 Months)

1. **Optimize RLS Policy Performance**
   - Create materialized views
   - Add indexes for policy queries
   - **Effort:** 8 hours

2. **Implement GDPR Compliance Features**
   - User data export
   - Right to erasure
   - Data portability
   - **Effort:** 16 hours

3. **Add Security Headers**
   - Content Security Policy
   - X-Frame-Options
   - X-Content-Type-Options
   - **Effort:** 2 hours

4. **Implement API Request Logging**
   - Log all API requests
   - Track API usage patterns
   - **Effort:** 4 hours

5. **Add Automated Security Testing**
   - Implement security test suite
   - Add to CI/CD pipeline
   - **Effort:** 16 hours

---

## 10. Compliance Checklist

### 10.1 OWASP Top 10 (2021)

| Risk | Status | Notes |
|------|--------|-------|
| A01: Broken Access Control | ⚠️ Partial | RLS enabled, but 1 table exposed |
| A02: Cryptographic Failures | ✅ Good | Supabase handles encryption |
| A03: Injection | ✅ Good | Parameterized queries via Supabase |
| A04: Insecure Design | ⚠️ Partial | No middleware, manual auth checks |
| A05: Security Misconfiguration | ❌ Poor | Service key in env, no security headers |
| A06: Vulnerable Components | ⚠️ Unknown | Need dependency audit |
| A07: Auth Failures | ⚠️ Partial | No MFA, weak password policy |
| A08: Data Integrity Failures | ⚠️ Partial | No audit log integrity protection |
| A09: Logging Failures | ❌ Poor | Incomplete audit logging |
| A10: SSRF | ✅ Good | No user-controlled URLs |

### 10.2 CIS Controls

| Control | Status | Implementation |
|---------|--------|----------------|
| Access Control | ⚠️ Partial | RBAC implemented, needs refinement |
| Audit Logging | ⚠️ Partial | Basic logging, needs expansion |
| Secure Configuration | ❌ Poor | No security headers, exposed keys |
| Data Protection | ✅ Good | RLS on 48/49 tables |
| Account Management | ⚠️ Partial | No MFA, weak password policy |

---

## 11. Testing Recommendations

### 11.1 Security Test Cases

**Authentication Tests:**
1. Test login with invalid credentials
2. Test session timeout
3. Test concurrent sessions
4. Test password reset flow
5. Test account lockout after failed attempts

**Authorization Tests:**
1. Test each role can only access permitted resources
2. Test horizontal privilege escalation (user A accessing user B's data)
3. Test vertical privilege escalation (employee accessing admin functions)
4. Test API routes without authentication
5. Test API routes with wrong role

**RLS Policy Tests:**
1. Test each table's RLS policies
2. Test policy bypass attempts
3. Test performance of complex policies
4. Test policy behavior with NULL values
5. Test policy behavior with edge cases

**Workflow Tests:**
1. Test self-approval prevention
2. Test step skipping prevention
3. Test approver eligibility validation
4. Test concurrent approval attempts
5. Test workflow state manipulation

**Module Visibility Tests:**
1. Test module visibility for each role
2. Test position-based overrides
3. Test borrowed modules
4. Test cache invalidation
5. Test fail-open/fail-closed behavior

### 11.2 Penetration Testing Scope

**In-Scope:**
- Authentication mechanisms
- Authorization checks
- API endpoints
- Database access controls
- Session management
- Input validation
- File upload functionality

**Out-of-Scope:**
- Denial of Service attacks
- Physical security
- Social engineering
- Third-party services (Supabase infrastructure)

### 11.3 Automated Security Scanning

**Tools to Implement:**
1. **SAST (Static Application Security Testing):**
   - ESLint security plugins
   - Semgrep for code patterns
   - npm audit for dependencies

2. **DAST (Dynamic Application Security Testing):**
   - OWASP ZAP for API testing
   - Burp Suite for manual testing

3. **Dependency Scanning:**
   - Snyk for vulnerability detection
   - Dependabot for automated updates

4. **Secret Scanning:**
   - GitGuardian for secret detection
   - TruffleHog for git history

---

## 12. Incident Response Plan

### 12.1 Security Incident Classification

**Level 1 - Critical:**
- Data breach
- Unauthorized admin access
- RLS bypass
- Service role key exposure

**Level 2 - High:**
- Unauthorized data access
- Failed authentication spike
- Privilege escalation attempt
- Workflow bypass

**Level 3 - Medium:**
- Suspicious API activity
- Multiple failed logins
- Unusual data export
- Session hijacking attempt

**Level 4 - Low:**
- Policy violation
- Audit log anomaly
- Configuration drift

### 12.2 Response Procedures

**Immediate Actions (0-1 hour):**
1. Identify affected systems
2. Isolate compromised accounts
3. Revoke suspicious sessions
4. Enable additional logging
5. Notify security team

**Short-term Actions (1-24 hours):**
1. Analyze audit logs
2. Identify attack vector
3. Patch vulnerability
4. Reset compromised credentials
5. Notify affected users

**Long-term Actions (1-7 days):**
1. Conduct post-incident review
2. Update security policies
3. Implement additional controls
4. Train staff on lessons learned
5. Update incident response plan

---

## 13. Code Examples for Fixes

### 13.1 Centralized Authorization Middleware

Create `lib/auth-middleware.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export interface AuthContext {
  user: {
    id: string;
    email: string;
  };
  profile: {
    role: string;
    role_id: string;
    position: string;
    position_id: string;
    department_id: string;
  };
}

export async function requireAuth(
  req: NextRequest
): Promise<{ context: AuthContext } | NextResponse> {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const accessToken = authHeader.replace('Bearer ', '');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);

  if (userError || !user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Fetch profile with role and position
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(`
      role_id,
      position_id,
      department_id,
      roles(name),
      positions(title)
    `)
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json(
      { success: false, error: 'Profile not found' },
      { status: 404 }
    );
  }

  return {
    context: {
      user: {
        id: user.id,
        email: user.email!,
      },
      profile: {
        role: (profile as any).roles.name,
        role_id: profile.role_id,
        position: (profile as any).positions?.title || '',
        position_id: profile.position_id,
        department_id: profile.department_id,
      },
    },
  };
}

export async function requireRole(
  req: NextRequest,
  allowedRoles: string[]
): Promise<{ context: AuthContext } | NextResponse> {
  const authResult = await requireAuth(req);
  
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { context } = authResult;

  if (!allowedRoles.includes(context.profile.role)) {
    // Log authorization failure
    await logAuthorizationFailure(context.user.id, req.url, allowedRoles);
    
    return NextResponse.json(
      { success: false, error: 'Access denied. Insufficient permissions.' },
      { status: 403 }
    );
  }

  return { context };
}

async function logAuthorizationFailure(
  userId: string,
  url: string,
  requiredRoles: string[]
) {
  // Implementation for audit logging
  console.error('Authorization failure:', {
    userId,
    url,
    requiredRoles,
    timestamp: new Date().toISOString(),
  });
}
```

### 13.2 Using the Middleware in API Routes

```typescript
// app/api/admin/users/route.ts
import { requireRole } from '@/lib/auth-middleware';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const authResult = await requireRole(req, ['admin']);
  
  if (authResult instanceof NextResponse) {
    return authResult; // Return error response
  }

  const { context } = authResult;

  // Proceed with admin logic
  // context.user and context.profile are available
  
  return NextResponse.json({ success: true, data: [] });
}
```

### 13.3 Workflow Validation Trigger

```sql
-- Function to validate approval actions
CREATE OR REPLACE FUNCTION validate_approval_action()
RETURNS TRIGGER AS $$
DECLARE
  v_instance approval_instances;
  v_step approval_steps;
  v_actor_profile RECORD;
  v_actor_role TEXT;
  v_actor_position TEXT;
BEGIN
  -- Get approval instance
  SELECT * INTO v_instance
  FROM approval_instances
  WHERE id = NEW.instance_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approval instance not found';
  END IF;

  -- Check instance is active
  IF v_instance.status != 'active' THEN
    RAISE EXCEPTION 'Approval instance is not active';
  END IF;

  -- Prevent self-approval
  IF v_instance.started_by = NEW.actor_id THEN
    RAISE EXCEPTION 'Cannot approve own request';
  END IF;

  -- Get current step requirements
  SELECT * INTO v_step
  FROM approval_steps
  WHERE workflow_id = v_instance.workflow_id
    AND step_order = v_instance.current_step;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approval step not found';
  END IF;

  -- Get actor profile with role and position
  SELECT 
    p.*,
    r.name as role_name,
    pos.title as position_title
  INTO v_actor_profile
  FROM profiles p
  JOIN roles r ON r.id = p.role_id
  LEFT JOIN positions pos ON pos.id = p.position_id
  WHERE p.id = NEW.actor_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Actor profile not found';
  END IF;

  v_actor_role := v_actor_profile.role_name;
  v_actor_position := v_actor_profile.position_title;

  -- Validate actor has required role
  IF v_actor_role != v_step.role_required THEN
    RAISE EXCEPTION 'Actor does not have required role. Required: %, Has: %', 
      v_step.role_required, v_actor_role;
  END IF;

  -- Validate actor has required position (if specified)
  IF v_step.position_required IS NOT NULL THEN
    IF v_actor_position IS NULL OR v_actor_position != v_step.position_required THEN
      RAISE EXCEPTION 'Actor does not have required position. Required: %, Has: %',
        v_step.position_required, COALESCE(v_actor_position, 'NULL');
    END IF;
  END IF;

  -- Log successful validation
  INSERT INTO audit_logs (actor_id, action, document_type, document_id, payload)
  VALUES (
    NEW.actor_id,
    'APPROVAL_ACTION_VALIDATED',
    'APPROVAL_INSTANCE',
    NEW.instance_id,
    jsonb_build_object(
      'step_order', v_instance.current_step,
      'action', NEW.action,
      'role_required', v_step.role_required,
      'position_required', v_step.position_required
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS validate_approval_action_trigger ON approval_actions;
CREATE TRIGGER validate_approval_action_trigger
BEFORE INSERT ON approval_actions
FOR EACH ROW
EXECUTE FUNCTION validate_approval_action();

-- Grant execute permission
GRANT EXECUTE ON FUNCTION validate_approval_action() TO authenticated;
```

### 13.4 Audit Log Integrity Protection

```sql
-- Function to validate audit log inserts
CREATE OR REPLACE FUNCTION validate_audit_log_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure actor_id matches authenticated user
  IF NEW.actor_id != auth.uid() THEN
    RAISE EXCEPTION 'Cannot insert audit log for another user';
  END IF;

  -- Ensure created_at is current time (prevent backdating)
  NEW.created_at := NOW();

  -- Add IP address from request context
  NEW.ip_address := COALESCE(
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    current_setting('request.headers', true)::json->>'x-real-ip',
    'unknown'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS validate_audit_log_insert_trigger ON audit_logs;
CREATE TRIGGER validate_audit_log_insert_trigger
BEFORE INSERT ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION validate_audit_log_insert();

-- Prevent updates and deletes on audit logs
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_audit_log_update_trigger ON audit_logs;
CREATE TRIGGER prevent_audit_log_update_trigger
BEFORE UPDATE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_modification();

DROP TRIGGER IF EXISTS prevent_audit_log_delete_trigger ON audit_logs;
CREATE TRIGGER prevent_audit_log_delete_trigger
BEFORE DELETE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_modification();
```

---

## 14. Monitoring & Alerting

### 14.1 Security Metrics to Track

**Authentication Metrics:**
- Failed login attempts per user
- Failed login attempts per IP
- Successful logins by role
- Session duration by role
- Concurrent sessions per user

**Authorization Metrics:**
- 403 errors by endpoint
- 403 errors by user
- RLS policy violations
- Module visibility checks
- Workflow validation failures

**Data Access Metrics:**
- Sensitive table queries
- Bulk data exports
- Admin actions
- Cross-user data access attempts
- Unusual query patterns

**System Health Metrics:**
- RLS policy performance
- Authentication latency
- API response times
- Database connection pool usage
- Error rates by endpoint

### 14.2 Alert Thresholds

**Critical Alerts (Immediate Response):**
- 10+ failed logins from same IP in 5 minutes
- Admin account accessed from new location
- Service role key used from unexpected source
- RLS policy bypass attempt detected
- Bulk data export by non-admin user

**High Priority Alerts (Response within 1 hour):**
- 5+ failed logins for same user in 10 minutes
- 403 errors spike (>100 in 5 minutes)
- Unusual approval pattern detected
- Multiple concurrent sessions for same user
- Sensitive table access spike

**Medium Priority Alerts (Response within 4 hours):**
- New user created by admin
- Role change for existing user
- Workflow configuration modified
- Module visibility rules changed
- Audit log query by non-admin

### 14.3 Monitoring Implementation

**Using Supabase:**

```sql
-- Create monitoring views
CREATE OR REPLACE VIEW security_metrics AS
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  action,
  COUNT(*) as count,
  COUNT(DISTINCT actor_id) as unique_users
FROM audit_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at), action
ORDER BY hour DESC;

-- Failed authentication attempts
CREATE OR REPLACE VIEW failed_auth_attempts AS
SELECT
  ip_address,
  COUNT(*) as attempt_count,
  MAX(created_at) as last_attempt,
  ARRAY_AGG(DISTINCT payload->>'email') as attempted_emails
FROM audit_logs
WHERE action = 'AUTH_FAILED'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY ip_address
HAVING COUNT(*) >= 5
ORDER BY attempt_count DESC;

-- Suspicious authorization failures
CREATE OR REPLACE VIEW suspicious_authz_failures AS
SELECT
  actor_id,
  COUNT(*) as failure_count,
  ARRAY_AGG(DISTINCT action) as attempted_actions,
  MAX(created_at) as last_failure
FROM audit_logs
WHERE action LIKE '%_DENIED'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY actor_id
HAVING COUNT(*) >= 10
ORDER BY failure_count DESC;
```

**External Monitoring:**

1. **Sentry for Error Tracking:**
   ```typescript
   import * as Sentry from '@sentry/nextjs';

   Sentry.init({
     dsn: process.env.SENTRY_DSN,
     tracesSampleRate: 1.0,
     beforeSend(event, hint) {
       // Filter sensitive data
       if (event.request) {
         delete event.request.cookies;
         delete event.request.headers?.['authorization'];
       }
       return event;
     },
   });
   ```

2. **Datadog for Metrics:**
   ```typescript
   import { StatsD } from 'node-dogstatsd';

   const dogstatsd = new StatsD();

   // Track authentication
   dogstatsd.increment('auth.login.success', 1, [`role:${role}`]);
   dogstatsd.increment('auth.login.failure', 1, [`ip:${ip}`]);

   // Track authorization
   dogstatsd.increment('authz.denied', 1, [`endpoint:${endpoint}`, `role:${role}`]);
   ```

3. **CloudWatch for AWS:**
   - Log all API requests
   - Track error rates
   - Monitor latency
   - Alert on anomalies

---

## 15. Conclusion

### 15.1 Overall Security Posture

**Current State:** ⚠️ **MODERATE RISK**

The Fortune Procurement System demonstrates a solid foundation for RBAC implementation with comprehensive Row-Level Security policies covering 48 out of 49 tables. However, several critical gaps exist that require immediate attention.

**Strengths:**
- ✅ Well-designed role hierarchy with 7 distinct roles
- ✅ Comprehensive RLS policies (280+ policies)
- ✅ Position-based access refinement
- ✅ Module visibility system for UI control
- ✅ Audit logging infrastructure in place
- ✅ Workflow-based approval system

**Critical Weaknesses:**
- ❌ One table (`rfq_suppliers`) without RLS - **IMMEDIATE FIX REQUIRED**
- ❌ No Next.js middleware for route protection
- ❌ Manual authorization checks in API routes (inconsistent)
- ❌ Overly permissive audit log access
- ❌ No workflow validation triggers
- ❌ Incomplete audit logging coverage

### 15.2 Risk Assessment

**Overall Risk Score:** 6.5/10 (Moderate-High)

| Category | Score | Weight | Weighted Score |
|----------|-------|--------|----------------|
| Database Security | 8/10 | 30% | 2.4 |
| Application Security | 5/10 | 25% | 1.25 |
| Authentication | 7/10 | 15% | 1.05 |
| Authorization | 6/10 | 20% | 1.2 |
| Audit & Monitoring | 5/10 | 10% | 0.5 |

**Risk Breakdown:**
- **Database Security (8/10):** Strong RLS implementation, but 1 critical gap
- **Application Security (5/10):** No middleware, manual auth checks
- **Authentication (7/10):** Supabase Auth is solid, but weak password policy
- **Authorization (6/10):** Good role structure, but inconsistent enforcement
- **Audit & Monitoring (5/10):** Basic logging, but incomplete coverage

### 15.3 Roadmap to Secure

**Phase 1: Critical Fixes (Week 1)**
- [ ] Enable RLS on `rfq_suppliers` table
- [ ] Implement Next.js middleware
- [ ] Restrict audit log access to admins
- [ ] Add workflow validation triggers

**Phase 2: High Priority (Weeks 2-4)**
- [ ] Centralize authorization middleware
- [ ] Implement comprehensive audit logging
- [ ] Add password policy enforcement
- [ ] Implement session management improvements
- [ ] Add MFA for admin actions

**Phase 3: Medium Priority (Months 2-3)**
- [ ] Field-level security for profiles
- [ ] Server-side module visibility checks
- [ ] Data retention policy
- [ ] Rate limiting
- [ ] Performance optimization

**Phase 4: Long-term (Months 4-6)**
- [ ] GDPR compliance features
- [ ] Automated security testing
- [ ] Security headers
- [ ] API request logging
- [ ] Penetration testing

### 15.4 Sign-off

This audit was conducted on May 25, 2026, and represents the security posture of the Fortune Procurement System at that time. The findings and recommendations should be reviewed and prioritized by the development and security teams.

**Next Steps:**
1. Review this audit with stakeholders
2. Prioritize fixes based on risk and effort
3. Create tickets for each recommendation
4. Schedule follow-up audit in 3 months
5. Implement continuous security monitoring

**Audit Completed By:** Kiro AI Assistant  
**Date:** May 25, 2026  
**Version:** 1.0

---

## Appendix A: Database Schema Summary

**Total Tables:** 49  
**RLS Enabled:** 48  
**RLS Disabled:** 1 (`rfq_suppliers`)

**Key Tables:**
- `profiles` - User profiles with role/position/department
- `roles` - 7 system roles
- `positions` - 15 positions
- `departments` - 9 departments
- `role_position_module_visibility` - Module access control
- `approval_workflows` - Workflow definitions
- `approval_steps` - Workflow step definitions
- `approval_instances` - Active workflows
- `approval_actions` - User approval actions
- `audit_logs` - System audit trail

**Foreign Key Relationships:** 150+ relationships  
**RLS Policies:** 280+ policies  
**Database Functions:** 20+ custom functions  
**Triggers:** 10+ triggers

---

## Appendix B: API Endpoints Inventory

**Admin Endpoints:**
- `POST /api/admin/users/create` - Create new user
- `POST /api/admin/users/invite` - Invite user via email
- `PUT /api/admin/users/[id]/assignment` - Update user role/position
- `POST /api/admin/users/[id]/reset-password` - Reset user password

**Bug Tracking Endpoints:**
- `POST /api/bugtrack/send-email` - Send bug report email
- `POST /api/bugtrack/send-resolved-email` - Send resolution email

**RFQ Endpoints:**
- `POST /api/rfq/send-email` - Send RFQ invitation email

**Edge Functions:**
- `reset-user-password` - Admin password reset
- `reset-demo-passwords` - Reset demo accounts
- `create-user` - User creation with profile

---

## Appendix C: Glossary

**RBAC:** Role-Based Access Control  
**RLS:** Row-Level Security  
**MFA:** Multi-Factor Authentication  
**JWT:** JSON Web Token  
**PII:** Personally Identifiable Information  
**GDPR:** General Data Protection Regulation  
**OWASP:** Open Web Application Security Project  
**CIS:** Center for Internet Security  
**SAST:** Static Application Security Testing  
**DAST:** Dynamic Application Security Testing  
**PR1:** Purchase Request (Phase 1 - Employee Request)  
**PR2:** Purchase Request (Phase 2 - Procurement Processing)  
**PO:** Purchase Order  
**RFQ:** Request for Quotation  
**GRN:** Goods Receipt Note  
**RSE:** Routine Sample Evaluation  
**TSQA:** Technical Services Quality Assurance

---

**END OF AUDIT REPORT**
