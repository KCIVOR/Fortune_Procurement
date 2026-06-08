# User Deactivate / Reactivate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins soft-deactivate and reactivate user accounts without deleting data or breaking existing workflows, approvals, or historical records.

**Architecture:** Add `profiles.active` (default `true`, zero impact on existing rows). All status changes go through a single admin API route using the service role (same pattern as `assignment/route.ts`). Auth enforcement layers (login → AuthContext → middleware) block inactive users only after the API is verified. UI mirrors department/position deactivate dialogs.

**Tech Stack:** Next.js App Router, Supabase Auth admin API (`ban_duration`), Supabase Postgres, TypeScript, existing `audit_logs` table.

**Surgical principles:**
- Every phase leaves the app fully working for all current users.
- `active` defaults to `true`; treat `active === false` as the only blocked state (missing/`null`/`true` → allowed).
- No hard deletes, no FK changes, no workflow/approval schema changes.
- Additive changes only; do not refactor unrelated admin code.
- Auth enforcement is a separate phase so the API can be tested before anyone is blocked.

---

## Phase Overview

| Phase | What ships | Risk to existing logic |
|-------|-----------|------------------------|
| **1** | DB column `profiles.active` | None — default `true` |
| **2** | Types + read paths expose `active` | None — display only |
| **3** | Admin API `PATCH /status` | None until called |
| **4** | Auth enforcement (login/session/middleware) | Only affects `active=false` users |
| **5** | Admin UI (dialogs, detail, table) | None for other roles |
| **6** | Notifications + audit detail + edge cases | Narrow filter additions |
| **7** | Docs + manual verification | None |

**Stop and verify after each phase before continuing.**

---

## Phase 1 — Database Foundation

> Ship: migration only. App behavior unchanged.

### Task 1.1: Add `profiles.active` column

**Files:**
- Create: `supabase/migrations/20260606120000_add_profiles_active_flag.sql`

- [x] **Step 1: Create migration**

```sql
/*
  # Add active flag to profiles

  1. New Column
    - profiles.active (boolean, NOT NULL, DEFAULT true)
  2. Safety
    - All existing users remain active (default true)
    - No RLS changes — admin writes go through service-role API
    - No changes to auth.users
  3. Notes
    - Soft deactivate only; never hard-delete profiles
    - Follows departments/positions active pattern (20260429163647)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'active'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN active boolean NOT NULL DEFAULT true;
  END IF;
END $$;
```

- [x] **Step 2: Apply migration**

Run (local):
```bash
npx supabase db push
```
Or apply via your usual migration workflow.

Expected: migration succeeds; `SELECT active FROM profiles LIMIT 5` returns `true` for all rows.

- [x] **Step 3: Verify no app breakage**

Run: `npm run dev`
Expected: app loads; login works for all existing users.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260606120000_add_profiles_active_flag.sql
git commit -m "feat(db): add profiles.active for soft user deactivation"
```

**Phase 1 checkpoint:** All users still active. No UI or API changes yet.

---

## Phase 2 — Types & Read Paths (Display-Only)

> Ship: `active` flows through types and queries. No enforcement, no buttons.

### Task 2.1: Extend types

**Files:**
- Modify: `lib/admin-users.ts` (interface `AdminUser`)
- Modify: `types/auth.ts` (interface `UserProfile`)

- [x] **Step 1: Add `active` to `AdminUser`**

In `lib/admin-users.ts`, update the interface:

```typescript
export interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  role_id: string | null;
  role_name: string | null;
  position_id: string | null;
  position_title: string | null;
  department_id: string | null;
  department_name: string | null;
  created_at: string;
  active: boolean;
}
```

- [x] **Step 2: Add `active` to `UserProfile`**

In `types/auth.ts`:

```typescript
export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
  role_id: string;
  position: AppPosition;
  position_id: string;
  department: string;
  department_id: string;
  active: boolean;
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/admin-users.ts types/auth.ts
git commit -m "feat(types): add active field to user types"
```

### Task 2.2: Include `active` in profile queries

**Files:**
- Modify: `lib/admin-users.ts` — all select strings + mappers
- Modify: `lib/profile.ts` — `fetchUserProfile`

- [x] **Step 1: Update `lib/admin-users.ts` selects**

Add `active` to every `.select(...)` on `profiles` and every mapper return object:

```typescript
// In select strings, add: active
`id, full_name, email, role_id, position_id, department_id, created_at, active,
 roles(name), positions(title), departments(name)`

// In every mapper:
active: user.active ?? true,
```

Functions to update: `listAdminUsers`, `listAdminUsersWithCount`, `getAdminUserById`, and the API response mapper in `updateUserAssignment` (if it returns user).

- [x] **Step 2: Update `lib/profile.ts`**

```typescript
.select(`
  id,
  full_name,
  email,
  role_id,
  position_id,
  department_id,
  active,
  roles:role_id ( name ),
  positions:position_id ( title ),
  departments:department_id ( name )
`)

// In return object:
active: row.active ?? true,
```

- [x] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no new errors (fix any call sites that construct `UserProfile` manually).

- [ ] **Step 4: Commit**

```bash
git add lib/admin-users.ts lib/profile.ts
git commit -m "feat: include profiles.active in user read paths"
```

**Phase 2 checkpoint:** App works identically. `active` is always `true` in practice.

---

## Phase 3 — Admin Status API

> Ship: backend endpoint admins can call. Still no UI, still no login blocking.

### Task 3.1: Add client helper

**Files:**
- Modify: `lib/admin-users.ts`

- [x] **Step 1: Add `setUserActiveStatus` function**

```typescript
export async function setUserActiveStatus(
  userId: string,
  active: boolean
): Promise<{ success: boolean; error?: string; user?: AdminUser }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    if (!accessToken) {
      return { success: false, error: 'Not authenticated' };
    }

    const res = await fetch(
      `/api/admin/users/${encodeURIComponent(userId)}/status`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ active }),
      }
    );

    const json = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      error?: string;
      user?: AdminUser;
    };

    if (!res.ok || !json.success || !json.user) {
      return {
        success: false,
        error: json.error ?? `Request failed (${res.status})`,
      };
    }

    return { success: true, user: json.user };
  } catch (err) {
    console.error('Error updating user status:', err);
    return { success: false, error: 'Failed to update user status' };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/admin-users.ts
git commit -m "feat: add setUserActiveStatus client helper"
```

### Task 3.2: Create status API route

**Files:**
- Create: `app/api/admin/users/[id]/status/route.ts`

- [x] **Step 1: Create route** (mirror `assignment/route.ts` auth pattern)

```typescript
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

/** Permanent ban sentinel — unban by passing ban_duration: 'none' */
const PERMANENT_BAN = '876000h'; // ~100 years

type StatusBody = { active?: boolean };

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const targetUserId = params.id;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = authHeader.replace('Bearer ', '');

    const supabaseUser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser(accessToken);
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: actorProfile } = await supabaseUser
      .from('profiles')
      .select('role_id, roles(name)')
      .eq('id', user.id)
      .maybeSingle();

    const actorRole = (actorProfile as { roles?: { name?: string } } | null)?.roles?.name;
    if (actorRole !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Access denied. Admin role required.' },
        { status: 403 }
      );
    }

    if (!targetUserId) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    let body: StatusBody;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    if (typeof body.active !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'active (boolean) is required' },
        { status: 400 }
      );
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ success: false, error: 'Server configuration error' }, { status: 500 });
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Guard: cannot deactivate yourself
    if (targetUserId === user.id && body.active === false) {
      return NextResponse.json(
        { success: false, error: 'You cannot deactivate your own account' },
        { status: 400 }
      );
    }

    const { data: target, error: targetErr } = await admin
      .from('profiles')
      .select('id, full_name, email, role_id, position_id, department_id, active, roles(name)')
      .eq('id', targetUserId)
      .maybeSingle();

    if (targetErr || !target) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const row = target as {
      id: string;
      full_name: string;
      email: string;
      role_id: string | null;
      position_id: string | null;
      department_id: string | null;
      active: boolean;
      roles?: { name?: string };
    };

    if (row.active === body.active) {
      // Idempotent — return current user without side effects
      const { data: existing } = await admin
        .from('profiles')
        .select(
          `id, full_name, email, role_id, position_id, department_id, created_at, active,
           roles(name), positions(title), departments(name)`
        )
        .eq('id', targetUserId)
        .single();
      return NextResponse.json({ success: true, user: mapAdminUser(existing) });
    }

    // Guard: cannot deactivate last active admin
    if (body.active === false && row.roles?.name === 'admin') {
      const { data: adminRole } = await admin.from('roles').select('id').eq('name', 'admin').maybeSingle();
      if (adminRole?.id) {
        const { count } = await admin
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role_id', adminRole.id)
          .eq('active', true)
          .neq('id', targetUserId);
        if ((count ?? 0) === 0) {
          return NextResponse.json(
            { success: false, error: 'Cannot deactivate the last active administrator' },
            { status: 400 }
          );
        }
      }
    }

    const { data: updated, error: updateErr } = await admin
      .from('profiles')
      .update({ active: body.active })
      .eq('id', targetUserId)
      .select(
        `id, full_name, email, role_id, position_id, department_id, created_at, active,
         roles(name), positions(title), departments(name)`
      )
      .single();

    if (updateErr || !updated) {
      return NextResponse.json(
        { success: false, error: updateErr?.message ?? 'Failed to update user status' },
        { status: 400 }
      );
    }

    const { error: banErr } = await admin.auth.admin.updateUserById(targetUserId, {
      ban_duration: body.active ? 'none' : PERMANENT_BAN,
    });

    if (banErr) {
      // Roll back profile change to keep layers in sync
      await admin.from('profiles').update({ active: row.active }).eq('id', targetUserId);
      return NextResponse.json(
        { success: false, error: `Auth update failed: ${banErr.message}` },
        { status: 500 }
      );
    }

    const action = body.active ? 'USER_REACTIVATED' : 'USER_DEACTIVATED';
    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action,
      document_type: 'PROFILE',
      document_id: targetUserId,
      payload: {
        target_user_id: targetUserId,
        target_user_email: row.email,
        target_user_name: row.full_name,
        old_active: row.active,
        new_active: body.active,
      },
    });

    return NextResponse.json({ success: true, user: mapAdminUser(updated) });
  } catch (err) {
    console.error('[admin/users/status] Unexpected error:', err);
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

function mapAdminUser(data: unknown) {
  const u = data as Record<string, unknown>;
  const roles = u.roles as { name?: string } | undefined;
  const positions = u.positions as { title?: string } | undefined;
  const departments = u.departments as { name?: string } | undefined;
  return {
    id: u.id as string,
    full_name: u.full_name as string,
    email: u.email as string,
    role_id: u.role_id as string | null,
    role_name: roles?.name ?? null,
    position_id: u.position_id as string | null,
    position_title: positions?.title ?? null,
    department_id: u.department_id as string | null,
    department_name: departments?.name ?? null,
    created_at: u.created_at as string,
    active: (u.active as boolean) ?? true,
  };
}
```

- [x] **Step 2: Verify route compiles**

Run: `npx tsc --noEmit`

- [x] **Step 3: Manual API test** (use a non-production test user)

1. Log in as admin in browser.
2. Open DevTools → get session token or use the app while calling from a test script.
3. `PATCH /api/admin/users/<test-user-id>/status` with `{ "active": false }`.
4. Verify: `profiles.active = false`, auth ban applied, `audit_logs` row created.
5. `PATCH` with `{ "active": true }` to restore.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/users/[id]/status/route.ts
git commit -m "feat(api): admin PATCH user active status with auth ban"
```

**Phase 3 checkpoint:** API works via direct calls. No UI yet. Normal users unaffected.

---

## Phase 4 — Auth Enforcement

> Ship: inactive users cannot log in or keep sessions. **This is the first behavior-changing phase for deactivated accounts.**

### Task 4.1: Block inactive users at login

**Files:**
- Modify: `app/login/page.tsx`

- [x] **Step 1: Add post-login active check** (after successful `signInWithPassword`, before redirect)

```typescript
const userId = data.user?.id;
if (userId) {
  const profile = await fetchUserProfile(userId);
  if (profile && profile.active === false) {
    await supabase.auth.signOut();
    setError('This account has been deactivated. Contact your administrator.');
    setLoading(false);
    return;
  }
  router.push(profile?.role === 'tsqa' ? '/tsqa' : '/dashboard');
} else {
  router.push('/dashboard');
}
```

- [x] **Step 2: Manual test**

Deactivate a test user via API (Phase 3). Attempt login.
Expected: error message shown; no redirect.

- [ ] **Step 3: Commit**

```bash
git add app/login/page.tsx
git commit -m "feat(auth): block login for deactivated users"
```

### Task 4.2: Evict inactive sessions in AuthContext

**Files:**
- Modify: `context/AuthContext.tsx`

- [x] **Step 1: Add helper to check and evict**

After `fetchUserProfile` in both `initAuth` and `onAuthStateChange`:

```typescript
async function loadProfileOrSignOut(userId: string): Promise<UserProfile | null> {
  const p = await fetchUserProfile(userId);
  if (p && p.active === false) {
    await supabase.auth.signOut();
    return null;
  }
  return p;
}
```

Replace direct `fetchUserProfile` calls with `loadProfileOrSignOut`.

- [x] **Step 2: Manual test**

1. Log in as test user.
2. In another tab (admin), deactivate that user via API.
3. Refresh the test user's tab.
Expected: signed out (or blocked on next navigation via middleware).

- [ ] **Step 3: Commit**

```bash
git add context/AuthContext.tsx
git commit -m "feat(auth): sign out deactivated users on session refresh"
```

### Task 4.3: Middleware guard

**Files:**
- Modify: `middleware.ts`

- [x] **Step 1: Extend `fetchUserRoleAndPosition` to return `active`**

```typescript
async function fetchUserRoleAndPosition(
  supabase: ReturnType<typeof createMiddlewareSupabaseClient>['supabase'],
  userId: string,
): Promise<{ role: AppRole; position: string | null; active: boolean } | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('active, roles:role_id ( name ), positions:position_id ( title )')
    .eq('id', userId)
    .maybeSingle();

  // ... existing role/position parsing ...

  return {
    role: roleName as AppRole,
    position: positionTitle ?? null,
    active: (data as { active?: boolean }).active ?? true,
  };
}
```

- [x] **Step 2: Check active before role routing**

After fetching identity, before `isRoleAllowedForPath`:

```typescript
if (!identity.active) {
  const signOutResponse = loginRedirect(request);
  // Clear session cookies via supabase signOut in middleware client if needed
  await supabase.auth.signOut();
  return signOutResponse;
}
```

- [x] **Step 3: Manual test**

Deactivated user with stale JWT navigates to `/dashboard`.
Expected: redirect to `/login`.

- [ ] **Step 4: Commit**

```bash
git add middleware.ts
git commit -m "feat(auth): middleware blocks deactivated users"
```

### Task 4.4: Invite completion guard

**Files:**
- Modify: `app/invite/complete/page.tsx`

- [x] **Step 1: After session established, check active before password form**

In the `useEffect` after `establishSessionFromAuthRedirect`, fetch profile; if inactive, show error instead of form.

- [ ] **Step 2: Commit**

```bash
git add app/invite/complete/page.tsx
git commit -m "feat(auth): block invite completion for deactivated accounts"
```

**Phase 4 checkpoint:** Deactivated users cannot access the app. All other users unaffected.

---

## Phase 5 — Admin UI

> Ship: admins can deactivate/reactivate from the UI. Mirrors department/position pattern.

### Task 5.1: Deactivate dialog

**Files:**
- Create: `components/admin/UserDeactivateDialog.tsx`

- [x] **Step 1: Create component** — copy structure from `DepartmentDeactivateDialog.tsx`, adapt props:

```typescript
interface UserDeactivateDialogProps {
  user: AdminUser | null;
  isOpen: boolean;
  isLoading?: boolean;
  onConfirm: (user: AdminUser) => Promise<void>;
  onCancel: () => void;
}
```

Copy text:
> This user will no longer be able to sign in. Their historical PRs, approvals, and audit records will remain unchanged.

- [ ] **Step 2: Commit**

```bash
git add components/admin/UserDeactivateDialog.tsx
git commit -m "feat(ui): add user deactivate confirmation dialog"
```

### Task 5.2: Reactivate dialog

**Files:**
- Create: `components/admin/UserReactivateDialog.tsx`

- [x] **Step 1: Create component** — mirror `DepartmentReactivateDialog.tsx`

- [ ] **Step 2: Commit**

```bash
git add components/admin/UserReactivateDialog.tsx
git commit -m "feat(ui): add user reactivate confirmation dialog"
```

### Task 5.3: Wire UserDetail page

**Files:**
- Modify: `components/admin/UserDetail.tsx`
- Modify: `app/admin/users/[id]/page.tsx`

- [x] **Step 1: Update `UserDetail` props**

```typescript
interface UserDetailProps {
  user: AdminUser;
  isAdmin?: boolean;
  currentAdminId?: string;
  onStatusChanged?: (user: AdminUser) => void;
}
```

- [x] **Step 2: Add status badge** next to user name:
  - Active → green badge
  - Inactive → gray/red badge

- [x] **Step 3: Add action buttons**
  - If `user.active && user.id !== currentAdminId` → show **Deactivate**
  - If `!user.active` → show **Reactivate**
  - Keep existing Reset Password + Edit Assignment unchanged

- [x] **Step 4: Wire dialogs** calling `setUserActiveStatus(user.id, false|true)` from `lib/admin-users.ts`

- [x] **Step 5: Update `app/admin/users/[id]/page.tsx`**
  - Pass `currentAdminId={profile?.id}`
  - Pass `onStatusChanged` to refresh local `user` state

- [ ] **Step 6: Manual test**

1. Admin → Users → open a test user.
2. Deactivate → confirm → badge shows Inactive.
3. Reactivate → confirm → badge shows Active.

- [ ] **Step 7: Commit**

```bash
git add components/admin/UserDetail.tsx app/admin/users/[id]/page.tsx
git commit -m "feat(ui): deactivate/reactivate on user detail page"
```

### Task 5.4: User table status column (optional but recommended)

**Files:**
- Modify: `components/admin/UserTable.tsx`

- [x] **Step 1: Add Status column** between Department and Created

```typescript
{user.active ? (
  <span className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs">Active</span>
) : (
  <span className="px-2 py-1 bg-pq-neutral-100 text-pq-neutral-500 rounded text-xs">Inactive</span>
)}
```

- [ ] **Step 2: Commit**

```bash
git add components/admin/UserTable.tsx
git commit -m "feat(ui): show user active status in admin table"
```

**Phase 5 checkpoint:** Full admin workflow from UI. Feature is usable end-to-end.

---

## Phase 6 — Downstream Hardening

> Ship: edge cases closed. Small, isolated diffs.

### Task 6.1: Stop notifying inactive approvers

**Files:**
- Modify: `lib/notifications.ts`

- [x] **Step 1: Add `.eq('active', true)` to profile lookups**

In `notifyApproversForStep` (~line 147):
```typescript
.eq('role_id', roleRes.data.id)
.eq('position_id', posRes.data.id)
.eq('active', true);
```

In `notifyByRole` (~line 203):
```typescript
.eq('role_id', role.id)
.eq('active', true);
```

- [ ] **Step 2: Commit**

```bash
git add lib/notifications.ts
git commit -m "fix: exclude inactive users from approval notifications"
```

### Task 6.2: Audit log friendly display

**Files:**
- Modify: `components/admin/AuditLogDetail.tsx`

- [x] **Step 1: Add summary blocks for `USER_DEACTIVATED` and `USER_REACTIVATED`**

Mirror the `USER_ASSIGNMENT_UPDATED` block:
- Target user name + email
- Status change: Active → Inactive (or reverse)

- [ ] **Step 2: Commit**

```bash
git add components/admin/AuditLogDetail.tsx
git commit -m "feat(audit): friendly display for user status changes"
```

### Task 6.3: Re-invite deactivated user (edge case)

**Files:**
- Modify: `app/api/admin/users/invite/route.ts`

- [x] **Step 1: Before `inviteUserByEmail`, check for existing profile by email**

If profile exists and `active === false`:
- Return `400` with message: "User exists but is deactivated. Reactivate them from User Management instead."
- Do NOT create a duplicate auth user.

If profile exists and `active === true`:
- Keep existing behavior (likely fails at auth level — don't change).

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/users/invite/route.ts
git commit -m "fix: prevent invite of deactivated users without duplicate accounts"
```

**Phase 6 checkpoint:** No notifications to ghost approvers; audit readable; invite edge case handled.

---

## Phase 7 — Documentation & Verification

### Task 7.1: Update audit deliverables

**Files:**
- Modify: `docs/audit-deliverables/C-Database-Dictionary.md` — add `profiles.active`
- Modify: `docs/audit-deliverables/E-Role-Permission-Matrix.md` — add deactivate/reactivate
- Modify: `docs/audit-deliverables/A-Fortune-Procurement-System-User-Manual.md` — User Management section
- Modify: `docs/audit-deliverables/F-Screen-Inventory.md` — new dialogs

- [x] **Step 1: Apply doc updates**
- [ ] **Step 2: Commit**

```bash
git add docs/audit-deliverables/
git commit -m "docs: document user deactivate/reactivate feature"
```

### Task 7.2: Full manual test checklist

- [x] **AD-30 Deactivate:** API + UI verified; login blocked (`User is banned` + profile check)
- [x] **AD-31 Reactivate:** API verified; login restored after reactivate
- [x] **Self-guard:** API returns 400 — "You cannot deactivate your own account"
- [ ] **Last admin guard:** Implemented; manual UI test recommended (only 1 admin in demo DB)
- [ ] **Session eviction:** Implemented (AuthContext + middleware); manual browser refresh test recommended
- [x] **Historical data:** By design — soft deactivate; no FK/schema changes
- [x] **Notifications:** `notifyApproversForStep` / `notifyByRole` filter `.eq('active', true)`
- [x] **Audit log:** `USER_DEACTIVATED` / `USER_REACTIVATED` written; friendly detail in AuditLogDetail
- [x] **Invite edge case:** Deactivated email returns 400 with reactivate message
- [ ] **Regression:** Create user, invite user, reset password, edit assignment — manual smoke test recommended
- [ ] **Regression:** Department/position deactivate — manual smoke test recommended
- [ ] **Regression:** All role dashboards load for active users — manual smoke test recommended

---

## Files Summary

| Action | Path |
|--------|------|
| **Create** | `supabase/migrations/20260606120000_add_profiles_active_flag.sql` |
| **Create** | `app/api/admin/users/[id]/status/route.ts` |
| **Create** | `components/admin/UserDeactivateDialog.tsx` |
| **Create** | `components/admin/UserReactivateDialog.tsx` |
| **Modify** | `lib/admin-users.ts` |
| **Modify** | `lib/profile.ts` |
| **Modify** | `types/auth.ts` |
| **Modify** | `app/login/page.tsx` |
| **Modify** | `context/AuthContext.tsx` |
| **Modify** | `middleware.ts` |
| **Modify** | `app/invite/complete/page.tsx` |
| **Modify** | `components/admin/UserDetail.tsx` |
| **Modify** | `app/admin/users/[id]/page.tsx` |
| **Modify** | `components/admin/UserTable.tsx` |
| **Modify** | `lib/notifications.ts` |
| **Modify** | `components/admin/AuditLogDetail.tsx` |
| **Modify** | `app/api/admin/users/invite/route.ts` |
| **Modify** | 4× `docs/audit-deliverables/*.md` |

**Explicitly NOT modified:** workflow libs, approval RLS, PR1/PR2/PO pages, department/position admin, `assignment/route.ts`, `create/route.ts` (except optional explicit `active: true`).

---

## Rollback Strategy

| Phase rolled back | Effect |
|-------------------|--------|
| Phase 1 only | Drop column (only if no inactive users exist) |
| Phase 3–4 | Re-enable users: `UPDATE profiles SET active = true` + unban via Supabase dashboard |
| Phase 5–6 | UI hidden; API still works |
| Full rollback | Set all `active = true`, unban all users, revert code |

---

## Self-Review (plan vs requirements)

| Requirement | Covered in |
|-------------|-----------|
| Soft deactivate (not delete) | Phase 1, 3 |
| Admin-only | Phase 3 auth check |
| Reactivate | Phase 3, 5 |
| Block login | Phase 4 |
| Self-deactivate guard | Phase 3 |
| Last admin guard | Phase 3 |
| Audit trail | Phase 3, 6.2 |
| Historical data preserved | No FK/schema changes |
| Surgical / no breakage | Phased with checkpoints |
| UAT AD-30/AD-31 | Phase 7 checklist |

No placeholders. All file paths and key code provided.
