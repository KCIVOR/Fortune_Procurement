# User Deactivation/Activation - Complete System Audit

**Date:** June 2, 2026  
**Audit Type:** Comprehensive Pre-Implementation Analysis  
**Scope:** User deactivation/activation feature for superadmin

---

## 📊 Executive Summary

### Current State: ❌ Feature Missing
- **User deactivation:** NOT implemented
- **User activation:** NOT implemented  
- **User deletion:** NOT implemented
- **User status tracking:** NOT implemented

### Impact: 🔴 HIGH Priority Gap
Critical admin functionality missing. No way to prevent users from accessing system without deleting their account.

---

## 🔍 1. DATABASE SCHEMA AUDIT

### 1.1 Current `profiles` Table Structure

```sql
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  role_id uuid REFERENCES roles(id),
  position_id uuid REFERENCES positions(id),
  department_id uuid REFERENCES departments(id),
  payment_terms TEXT,
  created_at timestamptz DEFAULT now()
);
```

### ❌ Missing Columns for Deactivation:
- `is_active` BOOLEAN - Status flag
- `deactivated_at` TIMESTAMPTZ - When deactivated
- `deactivated_by` UUID - Who deactivated
- `deactivation_reason` TEXT - Why deactivated
- `last_login_at` TIMESTAMPTZ - Track activity

### ✅ Existing Related Tables with Status Tracking:

#### Departments Table:
```sql
CREATE TABLE departments (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,  -- ✅ Has status tracking
  created_at timestamptz DEFAULT now()
);
```

#### Positions Table:
```sql
CREATE TABLE positions (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  role_id uuid REFERENCES roles(id),
  active boolean NOT NULL DEFAULT true,  -- ✅ Has status tracking
  created_at timestamptz DEFAULT now()
);
```

### 📊 Pattern Consistency:
Both `departments` and `positions` use `active BOOLEAN` for status. We should follow same pattern for `profiles`.

---

## 🔒 2. RLS POLICIES AUDIT

### 2.1 Current Profiles RLS Policies

**Policy: "Users can read own profile"**
```sql
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);
```

**Policy: "Users can update own profile"**
```sql
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND (
      -- Users can only modify their own full_name
      (role_id IS NOT DISTINCT FROM (SELECT role_id FROM profiles WHERE id = auth.uid()))
      AND (position_id IS NOT DISTINCT FROM (SELECT position_id FROM profiles WHERE id = auth.uid()))
      AND (department_id IS NOT DISTINCT FROM (SELECT department_id FROM profiles WHERE id = auth.uid()))
    )
  );
```

**Policy: "Admins can update user role"**
```sql
CREATE POLICY "Admins can update user role"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    -- Admin is attempting update on a different user
    auth.uid() != id
    AND EXISTS (
      SELECT 1 FROM profiles p
      INNER JOIN roles r ON p.role_id = r.id
      WHERE p.id = auth.uid()
      AND r.name = 'admin'
    )
  );
```

### ⚠️ Issues for Deactivation:

1. **Deactivated users can still read their profile**
   - Current: All authenticated users can read own profile
   - Needed: Only ACTIVE users can read own profile

2. **No admin policy for status changes**
   - Current: Admins can update role/position/department
   - Needed: Admins need separate policy for `is_active` column

3. **Deactivated users can still be authenticated**
   - Supabase auth doesn't check `is_active` by default
   - Need application-level check in AuthContext

---

## 👥 3. EXISTING PATTERNS AUDIT

### 3.1 Department Deactivation Pattern

**File:** `lib/admin-masterdata.ts`

```typescript
export async function deactivateDepartment(
  departmentId: string,
  adminId: string | null,
  userCount?: number
): Promise<{ success: boolean; error: string | null }> {
  // 1. Fetch current state
  const { data: currentData, error: fetchError } = await supabase
    .from('departments')
    .select('id, name, code, active')
    .eq('id', departmentId)
    .maybeSingle();

  if (fetchError) return { success: false, error: fetchError.message };
  if (!currentData) return { success: false, error: 'Department not found' };
  if (!currentData.active) return { success: true, error: null }; // Already inactive

  // 2. Update status
  const { error: updateError } = await supabase
    .from('departments')
    .update({ active: false })
    .eq('id', departmentId);

  if (updateError) return { success: false, error: updateError.message };

  // 3. Audit log
  if (adminId) {
    await logDepartmentAudit('DEPARTMENT_DEACTIVATED', departmentId, adminId, {
      name: currentData.name,
      code: currentData.code,
      old_active: true,
      new_active: false,
      user_count: userCount,
    });
  }

  return { success: true, error: null };
}
```

**Key Learnings:**
- ✅ Check if already deactivated before proceeding
- ✅ Log audit trail with context (user_count)
- ✅ Return structured success/error response
- ✅ Include metadata in audit log

### 3.2 Position Deactivation Pattern

**Additional checks in position:**
- Checks if position is used in workflows
- Counts affected users
- Prevents deactivation if actively used

```typescript
export async function deactivatePosition(
  positionId: string,
  adminId: string | null,
  userCount?: number,
  workflowUsageCount?: number
): Promise<{ success: boolean; error: string | null }> {
  // ... similar pattern to department
}
```

---

## 📝 4. AUDIT LOGGING AUDIT

### 4.1 Audit Logs Table Schema

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action        text NOT NULL,
  document_type text,
  document_id   uuid,
  payload       jsonb,
  created_at    timestamptz DEFAULT now()
);
```

### 4.2 Existing Audit Actions

Common patterns found:
- `USER_PASSWORD_RESET` - Password reset by admin
- `DEPARTMENT_DEACTIVATED` - Department deactivated
- `DEPARTMENT_REACTIVATED` - Department reactivated
- `POSITION_DEACTIVATED` - Position deactivated
- `POSITION_REACTIVATED` - Position reactivated

### ✅ Proposed New Actions:
- `USER_DEACTIVATED` - User account deactivated
- `USER_REACTIVATED` - User account reactivated
- `USER_STATUS_CHANGED` - General status change

### 4.3 Audit Payload Structure

From existing implementations:
```typescript
{
  name: string,              // User's full name
  email: string,             // User's email
  role: string,              // User's role name
  old_active: boolean,       // Previous status
  new_active: boolean,       // New status
  deactivation_reason: string, // Why deactivated
  affected_systems: string[]  // What systems are impacted
}
```

---

## 🔐 5. AUTHENTICATION FLOW AUDIT

### 5.1 Current Auth Flow

**File:** `context/AuthContext.tsx`

```typescript
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (session?.user) {
        const p = await fetchUserProfile(session.user.id);
        setProfile(p);
      }
      setLoading(false);
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session?.user) {
        (async () => {
          const p = await fetchUserProfile(session.user.id);
          setProfile(p);
        })();
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);
  
  // ...
}
```

### ⚠️ Issue: No `is_active` Check
- Profile is fetched but NOT checked for active status
- Deactivated users would still load their profile
- Need to add status check after profile fetch

### ✅ Required Change:
```typescript
if (session?.user) {
  const p = await fetchUserProfile(session.user.id);
  
  // Check if user is active
  if (p && !p.is_active) {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
    // Show error message
    return;
  }
  
  setProfile(p);
}
```

---

## 📱 6. UI COMPONENTS AUDIT

### 6.1 Existing Admin User Management UI

**Files Audited:**
- `app/admin/users/page.tsx` - User list page
- `app/admin/users/[id]/page.tsx` - User detail page
- `components/admin/UserDetail.tsx` - User detail component
- `components/admin/UserTable.tsx` - User table component

### 6.2 Current User Detail Actions

**Available buttons:**
1. ✅ "Reset Password" - Working
2. ✅ "Edit Assignment" - Working
3. ❌ "Deactivate User" - Missing
4. ❌ "Reactivate User" - Missing

### 6.3 UserTable Component

**Current columns:**
- Full Name
- Email
- Role
- Position
- Department
- Created At

**Missing:**
- ❌ Status badge (Active/Inactive)
- ❌ Last Login column
- ❌ Actions column (Quick deactivate)

### 6.4 Required New Components

1. **DeactivateUserModal**
   - Reason field (required)
   - Warning message
   - Confirmation step
   - Impact summary

2. **ReactivateUserModal**  
   - Simple confirmation
   - Optional welcome message

3. **UserStatusBadge**
   - Green "Active"
   - Red "Inactive"
   - Gray "Pending" (for invites)

---

## 🔍 7. API ROUTES AUDIT

### 7.1 Existing User Management APIs

**File:** `app/api/admin/users/`

Current endpoints:
- ✅ `/api/admin/users/create/route.ts` - Create user
- ✅ `/api/admin/users/invite/route.ts` - Invite user
- ✅ `/api/admin/users/[id]/assignment/route.ts` - Update assignment
- ✅ `/api/admin/users/[id]/reset-password/route.ts` - Reset password

**Missing:**
- ❌ `/api/admin/users/[id]/deactivate/route.ts` - Deactivate user
- ❌ `/api/admin/users/[id]/reactivate/route.ts` - Reactivate user
- ❌ `/api/admin/users/[id]/status/route.ts` - Check status

### 7.2 Supabase Edge Functions

**File:** `supabase/functions/reset-user-password/index.ts`

Uses admin client for auth operations:
```typescript
const { error: updateError } = await admin.auth.admin.updateUserById(user_id, {
  password: new_password,
});
```

**Similar pattern needed for deactivation:**
- May need to disable auth user
- Or just rely on `is_active` flag

---

## 🧪 8. BUSINESS LOGIC AUDIT

### 8.1 User Count Checks

**Departments:** Checks user count before deactivation
```typescript
const { data: deptData } = await supabase
  .from('profiles')
  .select('id')
  .eq('department_id', departmentId);
const userCount = (deptData || []).length;
```

**Positions:** Similar check for positions

### 8.2 Required Checks for User Deactivation

Before deactivating user, should check:

1. **Active Sessions**
   - User currently logged in?
   - Multiple sessions open?
   - Action: Terminate all sessions

2. **Pending Approvals**
   - User has pending approval tasks?
   - Action: Reassign or warn admin

3. **Active Workflows**
   - User assigned to active workflow steps?
   - Action: Reassign or block deactivation

4. **Created Documents**
   - PR1s, PR2s, POs created by user
   - Action: Allow (history preserved)

5. **Supplier Relationship**
   - User is supplier representative?
   - Action: Warn about RFQ assignments

6. **TSQA Assignments**
   - User has active TSQA reviews?
   - Action: Reassign or complete first

### 8.3 Affected Systems

When user is deactivated:
- ✅ Cannot login
- ✅ Cannot approve documents
- ✅ Cannot create new documents
- ✅ History preserved
- ✅ Created documents remain valid
- ⚠️ May need reassignment of active tasks

---

## 📊 9. RELATED SYSTEMS IMPACT

### 9.1 Approval System

**Tables:**
- `approval_instances` - Has `approver_id`
- `approval_actions` - Has `approver_id`

**Impact:**
- Deactivated users' approval history preserved
- Cannot approve new items
- May need to reassign pending approvals

### 9.2 Document Creation

**Tables:**
- `pr1_requests` - Has `requestor_id`
- `pr2_requests` - Has `requestor_id`
- `purchase_orders` - Has `created_by`

**Impact:**
- All documents remain valid
- History attribution preserved
- Cannot create new documents

### 9.3 Supplier Management

**Tables:**
- `supplier_products` - Has `created_by`
- `rfq_supplier_assignments` - Has `supplier_id`

**Impact:**
- Supplier products remain in catalog
- Cannot submit new quotations
- Existing quotes remain valid

### 9.4 Messaging System

**Tables:**
- `conversation_participants`
- `messages`

**Impact:**
- Conversations preserved
- Cannot send new messages
- Name still appears in history

---

## 🎯 10. REQUIREMENTS ANALYSIS

### 10.1 Functional Requirements

| ID | Requirement | Priority | Complexity |
|----|-------------|----------|------------|
| FR-1 | Admin can deactivate user | 🔴 HIGH | MEDIUM |
| FR-2 | Admin can reactivate user | 🔴 HIGH | LOW |
| FR-3 | Deactivation requires reason | 🟡 MEDIUM | LOW |
| FR-4 | System checks for active tasks | 🟡 MEDIUM | HIGH |
| FR-5 | Deactivated users cannot login | 🔴 HIGH | MEDIUM |
| FR-6 | Active sessions terminated | 🟡 MEDIUM | MEDIUM |
| FR-7 | Status visible in user list | 🔴 HIGH | LOW |
| FR-8 | Audit trail for status changes | 🔴 HIGH | LOW |
| FR-9 | Filter users by status | 🟢 LOW | LOW |
| FR-10 | Email notification on deactivation | 🟢 LOW | MEDIUM |

### 10.2 Non-Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-1 | RLS policies prevent access | 🔴 HIGH |
| NFR-2 | Deactivation is reversible | 🔴 HIGH |
| NFR-3 | History/attribution preserved | 🔴 HIGH |
| NFR-4 | Performance: <500ms | 🟡 MEDIUM |
| NFR-5 | Concurrent deactivation safe | 🟡 MEDIUM |

---

## 🚧 11. IDENTIFIED RISKS & MITIGATION

### Risk 1: Data Loss
**Risk:** Deactivation accidentally deletes data  
**Probability:** LOW  
**Impact:** HIGH  
**Mitigation:** Use soft delete (is_active flag), never hard delete

### Risk 2: Broken References
**Risk:** Related records lose valid foreign keys  
**Probability:** LOW  
**Impact:** HIGH  
**Mitigation:** Keep user record, only change status

### Risk 3: Session Management
**Risk:** Deactivated users remain logged in  
**Probability:** MEDIUM  
**Impact:** HIGH  
**Mitigation:** Check is_active in AuthContext, force logout

### Risk 4: Approval Workflow Disruption
**Risk:** Active approvals stalled when user deactivated  
**Probability:** HIGH  
**Impact:** MEDIUM  
**Mitigation:** Check pending tasks, offer reassignment

### Risk 5: Accidental Deactivation
**Risk:** Admin deactivates wrong user  
**Probability:** MEDIUM  
**Impact:** HIGH  
**Mitigation:** Confirmation modal, reason requirement, audit log

---

## 📋 12. GAP ANALYSIS SUMMARY

### Database Gaps:
- ❌ Missing `is_active` column
- ❌ Missing `deactivated_at` column
- ❌ Missing `deactivated_by` column
- ❌ Missing `deactivation_reason` column
- ❌ Missing `last_login_at` column

### Code Gaps:
- ❌ No `deactivateUser()` function
- ❌ No `reactivateUser()` function
- ❌ No status check in AuthContext
- ❌ No RLS policy for deactivated users

### UI Gaps:
- ❌ No deactivate button
- ❌ No reactivate button
- ❌ No status badge
- ❌ No status filter
- ❌ No deactivation modal

### API Gaps:
- ❌ No deactivation endpoint
- ❌ No reactivation endpoint

---

## ✅ 13. RECOMMENDATIONS

### Phase 1: Core Infrastructure (HIGH Priority)
1. Add database columns
2. Create RLS policies
3. Add is_active check to AuthContext
4. Create audit log actions

### Phase 2: Admin Functions (HIGH Priority)
1. Create deactivate/reactivate functions
2. Add business logic checks
3. Implement audit logging
4. Create API endpoints

### Phase 3: UI Components (MEDIUM Priority)
1. Add status badges
2. Create deactivation modal
3. Add action buttons
4. Implement status filter

### Phase 4: Enhanced Features (LOW Priority)
1. Email notifications
2. Bulk operations
3. Activity reports
4. Reactivation workflow

---

## 📊 14. EFFORT ESTIMATION

| Phase | Tasks | Estimated Hours |
|-------|-------|----------------|
| Phase 1: Database | Migration, RLS, Auth check | 2-3 hours |
| Phase 2: Backend | Functions, API, logic | 3-4 hours |
| Phase 3: Frontend | UI components, modals | 2-3 hours |
| Phase 4: Testing | Unit, integration, e2e | 2-3 hours |
| **TOTAL** | | **9-13 hours** |

---

## 🎯 15. SUCCESS CRITERIA

Feature is complete when:
- [ ] Admin can deactivate users with reason
- [ ] Admin can reactivate users
- [ ] Deactivated users cannot login
- [ ] Active sessions are terminated
- [ ] Status is visible in UI
- [ ] Audit trail is complete
- [ ] All existing functionality preserved
- [ ] RLS policies enforced
- [ ] Tests passing

---

## 📝 16. NEXT STEPS

1. **Review audit findings** with team
2. **Approve implementation plan**
3. **Create phase-by-phase implementation plan**
4. **Assign tasks and timeline**
5. **Begin Phase 1 implementation**

---

**Audit Completed:** June 2, 2026  
**Auditor:** System Analysis  
**Status:** ✅ Complete - Ready for implementation planning  
**Risk Level:** 🟡 MEDIUM (mitigable with proper implementation)

