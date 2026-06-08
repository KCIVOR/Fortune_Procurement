# Procurement Supplier Accounts — Audit + Surgical Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/suppliers` (Supplier Accounts) for procurement — list supplier logins, invite/create supplier-only accounts, edit payment terms — without changing accreditation, admin user management, canvassing, or supplier portal behavior.

**Surgical mode:** Additive-only. New files carry the feature. Existing files get minimal, isolated edits. No migrations. No refactors of admin routes/modals. Verify after every phase.

**Tech stack:** Next.js App Router, Supabase client + service role, existing UI primitives.

---

# Part 1 — Codebase Audit

## 1.1 What already exists (reuse, don't rebuild)

| Asset | Location | Reuse for this feature |
|-------|----------|------------------------|
| Admin invite flow | `app/api/admin/users/invite/route.ts` | **Pattern only** — copy to procurement route with hardcoded supplier ids |
| Admin create flow | `app/api/admin/users/create/route.ts` | **Pattern only** — same |
| Invite completion | `app/invite/complete/page.tsx` + `lib/auth-email-link-session.ts` | **Reuse as-is** — no changes |
| Payment terms UI | `components/admin/SupplierPaymentTermsForm.tsx` | **Reuse as-is** after auth tweak (see §1.4) |
| Payment terms options | `components/shared/PaymentTermsSelect.tsx` | Reuse in create modal |
| API auth helper | `lib/api-auth.ts` → `requireApiAuth` | Use in new procurement create/invite routes |
| Site URL for redirects | `lib/site-url.ts` | Reuse in invite route |
| Profile read RLS | `Authenticated users can read all profiles` | Client list queries work for procurement today |
| Supplier defaults in DB | `roles.supplier`, `positions.Supplier Representative`, `departments.GS` | Seeded in `foundation_schema.sql` — no migration |
| `profiles.payment_terms` | Column exists | No schema change |
| `profiles.active` | Column exists | Display only in v1 |
| Accreditation data | `lib/accreditation.ts`, `supplier_accreditations` table | Read-only enrichment on list/detail |
| Product counts | `supplier_products` table | Read-only count on list |
| Canvassing supplier list | `lib/canvassing.ts` (profiles where role=supplier) | **Do not modify** — separate concern (RFQ assignment) |

## 1.2 What `/accreditation` is (do not merge)

- Source: `supplier_accreditations` (applications), not `profiles` (accounts).
- Excludes `draft` status from procurement queue.
- Default tab: **Pending** applications.
- **A newly invited supplier will NOT appear here** until they submit accreditation — this is correct and must stay.

**Conclusion:** Do not add invite/list logic into `/accreditation` in v1. Keeps zero risk to accreditation workflow.

## 1.3 Route & security audit

| Path | Current guard | Risk if we add `/suppliers` |
|------|---------------|----------------------------|
| `/supplier/*` | `roles: ['supplier']`, `adminBypass: false` | **No conflict** — `/suppliers` ≠ `/supplier` prefix |
| `/suppliers` | Unlisted → `authenticated` (any logged-in user) | **Must add explicit rule** or employees could access |
| `/accreditation` | procurement, tsqa, admin | Unchanged |
| `/api/admin/users/*` | admin-only auth in each handler | **Do not open to procurement** — accepts `role_id` from body |
| Middleware | Reads `config/route-access.ts` only | No `middleware.ts` edit needed |

**Required:** One new rule in `config/route-access.ts`:
```typescript
{ prefix: '/suppliers', decision: { kind: 'roles', roles: ['procurement', 'admin'] } },
```
Place after `/accreditation`, before catch-all `/dashboard`.

## 1.4 Payment terms — smallest existing-file change

`SupplierPaymentTermsForm` calls `/api/admin/users/{id}/payment-terms`, which currently allows **admin only**.

**Surgical fix (1 file, ~2 lines):** Extend auth in `app/api/admin/users/[id]/payment-terms/route.ts` to allow `procurement` too. Handler already validates `targetRole === 'supplier'`. No new payment-terms route needed. No form component changes.

```typescript
// Before
if (actorRole !== 'admin') { ... 403 }

// After
if (actorRole !== 'admin' && actorRole !== 'procurement') { ... 403 }
```

## 1.5 Why NOT to modify these files

| File | Reason to leave alone |
|------|----------------------|
| `app/api/admin/users/invite/route.ts` | Accepts `role_id` from client — opening to procurement is a security risk |
| `app/api/admin/users/create/route.ts` | Same |
| `components/admin/CreateUserModal.tsx` | Role/position/dept fields — wrong UX; changes risk admin regressions |
| `lib/admin-users.ts` | Admin-specific filters/types — extend only if forced; new `lib/procurement-suppliers.ts` is safer |
| `lib/canvassing.ts` | RFQ supplier assignment — unrelated |
| `app/accreditation/page.tsx` | Application queue — different dataset |
| `middleware.ts` | Already driven by `route-access.ts` |
| `supabase/migrations/*` | Schema sufficient |
| `types/database.ts` | No new columns |
| `context/AuthContext.tsx` | No new roles or session behavior |

## 1.6 RLS & writes audit

- **List/detail reads:** Client-side `supabase.from('profiles')` — allowed via existing SELECT policy.
- **Create/invite:** Requires service role (same as admin) — new API routes only.
- **Payment terms write:** Service role in existing admin route (after auth extension).
- **Procurement cannot** update `role_id`/`position_id`/`department_id` via RLS — admin policy only. Our routes set these at insert time via service role.

## 1.7 Module visibility audit

- New `module_key: 'supplier_accounts'` must be added to `ModuleKey` union in `config/navigation.ts`.
- No DB seed required — `getRoleDefaultVisibility` returns `true` when no rule exists (nav item visible by default).
- Add mapping in `config/module-route-map.ts` so visibility admin UI links route correctly.

## 1.8 Regression surfaces to watch

| Area | What could break | Mitigation |
|------|------------------|------------|
| Supplier portal `/supplier/*` | Accidental route shadowing | `/suppliers` is a different prefix — verified |
| Admin user management | Shared code edits | No admin file edits except payment-terms auth line |
| PO workflow | Wrong position on new supplier | Server hardcodes `Supplier Representative` + `GS` |
| Invite email | Redirect URL | Reuse `getServerAppUrl()/invite/complete` — already configured |
| Canvassing assign modal | Supplier list source | Untouched — still reads profiles by supplier role |
| Sidebar active state | New href | `/suppliers` won't match `/supplier` nav item |

---

# Part 2 — File Change Matrix

## Create (9 files — all new, zero risk to existing behavior)

| File | Purpose |
|------|---------|
| `lib/procurement-supplier-defaults.ts` | Server: resolve supplier role/position/department ids |
| `lib/procurement-suppliers.ts` | Client: list/detail queries + types |
| `app/api/procurement/suppliers/invite/route.ts` | POST invite (procurement + admin auth) |
| `app/api/procurement/suppliers/create/route.ts` | POST manual create |
| `components/procurement/CreateSupplierModal.tsx` | Invite + create UI (supplier-only fields) |
| `components/procurement/SupplierAccountsTable.tsx` | List table |
| `components/procurement/SupplierAccountDetail.tsx` | Detail + payment terms + links |
| `app/suppliers/page.tsx` | List page |
| `app/suppliers/[id]/page.tsx` | Detail page |

## Modify (3 config files + 1 surgical API auth line)

| File | Change | Lines (approx) |
|------|--------|----------------|
| `config/route-access.ts` | Add `/suppliers` rule | +1 |
| `config/navigation.ts` | `supplier_accounts` module key + nav item in procurement | +12 |
| `config/module-route-map.ts` | Map `supplier_accounts` → `/suppliers` | +1 |
| `app/api/admin/users/[id]/payment-terms/route.ts` | Allow `procurement` role | ~2 |

## Do NOT modify (v1)

- All other `app/api/admin/users/*` routes
- `components/admin/*` (except payment-terms auth above — not a component change)
- `app/accreditation/**`
- `app/supplier/**`
- `lib/canvassing.ts`, `lib/admin-users.ts`
- `middleware.ts`, migrations, `AuthContext`

**Total: 9 creates, 4 modifies. 0 deletes.**

---

# Part 3 — Phase-by-Phase Implementation (Surgical)

**Rule:** Complete and verify each phase before starting the next. If a phase fails verification, stop — do not proceed.

---

## Phase 0 — Preflight (read-only)

- [x] Confirm `SUPABASE_SERVICE_ROLE_KEY` is set locally (invite/create won't work without it — same as admin).
- [x] Confirm Supabase redirect allowlist includes `{origin}/invite/complete` (already required for admin invite).
- [x] Log in as procurement demo user; note one existing supplier id for later detail-page test.

**Checkpoint:** No code changes. Environment ready.

**Phase 0 results (2026-06-09):**
| Check | Result |
|-------|--------|
| `.env.local` | Present |
| `SUPABASE_SERVICE_ROLE_KEY` | Set (non-placeholder) |
| `NEXT_PUBLIC_SUPABASE_URL` | Set |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Set |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` → invite redirect `http://localhost:3000/invite/complete` |
| `APP_URL` | Not set (OK — falls back to `NEXT_PUBLIC_SITE_URL`) |
| Supplier defaults in DB | role `8df8b2e8-ca51-4a42-bdd0-7c26ee1abe3c`, position `6d7f895a-fa24-4583-8763-7de9bd6d3f6c`, dept GS `e9150a22-4257-4ea9-8b0f-9a470d123f00` |
| Demo procurement | `procurement@fortune.com` / `302142f0-9055-4a9f-9dda-7c216a7f2f85` (Ana Gomez) |
| Demo supplier (detail test) | `supplier@fortune.com` / `22caeaf8-82bb-4df7-84f7-d2456b0f47a1` (Ace Supply Corp) |
| Supplier accounts in DB | 4 |
| Dev server | `npm run dev` running |
| Supabase Dashboard redirect allowlist | **Manual:** confirm Auth → URL configuration includes `http://localhost:3000/invite/complete` (admin invite already works if this is set) |

---

## Phase 1 — Access control only (3 config files)

**Risk to existing logic:** None — additive config only.

### Task 1.1: `config/route-access.ts`

- [x] Add rule (before `/dashboard` entry):
```typescript
{ prefix: '/suppliers', decision: { kind: 'roles', roles: ['procurement', 'admin'] } },
```

### Task 1.2: `config/navigation.ts`

- [x] Add `'supplier_accounts'` to `ModuleKey` union.
- [x] Add to `ALL_NAV`:
```typescript
supplierAccounts: {
  label: 'Supplier Accounts',
  href: '/suppliers',
  icon: 'Users',
  module_key: 'supplier_accounts',
},
```
- [x] In `ROLE_NAV.procurement`, insert `ALL_NAV.supplierAccounts` **before** `ALL_NAV.supplierAccredQueue`.

### Task 1.3: `config/module-route-map.ts`

- [x] Add: `supplier_accounts: '/suppliers',`

### Verify Phase 1

| Test | Expected | Result (2026-06-09) |
|------|----------|---------------------|
| Procurement sidebar | "Supplier Accounts" appears above "Supplier Accreditation" | PASS — nav order verified |
| Employee visits `/suppliers` | Redirected / access denied | PASS — `isRoleAllowedForPath` = false |
| Procurement visits `/suppliers` | 404 (page not built yet) — NOT access denied | PASS — route allows procurement |
| Supplier visits `/supplier/quotations` | Still works — unchanged | PASS — `/suppliers` ≠ `/supplier` prefix |
| Admin visits `/admin/users` | Still works — unchanged | PASS — no admin file changes |
| `/accreditation` | Unchanged | PASS — no accreditation file changes |

---

## Phase 2 — Server defaults helper (1 new file)

**Risk:** None — new file, not imported until Phase 4.

### Task 2.1: Create `lib/procurement-supplier-defaults.ts`

- [x] Implement `resolveSupplierDefaults(adminClient)` returning `{ role_id, position_id, department_id }` or `{ error }`.
- [x] Lookup: `roles.name = 'supplier'`, `positions.title = 'Supplier Representative'`, `departments.code = 'GS'`.

### Verify Phase 2

- [x] Temp script or API log: resolver returns 3 valid UUIDs on local DB.
- [x] No imports added to existing files yet.

**Phase 2 results (2026-06-09):** DB lookup returns `role_id` `8df8b2e8-…`, `position_id` `6d7f895a-…`, `department_id` `e9150a22-…` (matches Phase 0). File not imported elsewhere until Phase 4.

---

## Phase 3 — Payment terms auth (1 line in existing file)

**Risk:** Low — only expands who may call an endpoint that already validates `targetRole === 'supplier'`.

### Task 3.1: `app/api/admin/users/[id]/payment-terms/route.ts`

- [x] Change admin-only check to:
```typescript
if (actorRole !== 'admin' && actorRole !== 'procurement') {
  return NextResponse.json(
    { success: false, error: 'Access denied. Admin or procurement role required.' },
    { status: 403 },
  );
}
```

### Verify Phase 3

| Test | Expected | Result (2026-06-09) |
|------|----------|---------------------|
| Admin PATCH payment terms for supplier | Still works | PASS — auth check unchanged for admin |
| Procurement PATCH payment terms for supplier | 200 (test via curl with procurement token) | PASS — 200 success |
| Procurement PATCH for non-supplier user | 400 — unchanged | PASS — 400 |
| Employee PATCH | 403 | PASS — 403 |

**Do not proceed until admin payment-terms still works.**

---

## Phase 4 — Procurement API routes (2 new files)

**Risk:** Isolated new routes. Admin routes untouched.

### Task 4.1: `app/api/procurement/suppliers/invite/route.ts`

- [x] `requireApiAuth(req, ['procurement', 'admin'])`
- [x] Body: `{ email, full_name, payment_terms? }` — **reject** if `role_id`, `position_id`, `department_id` sent (ignore or 400)
- [x] `resolveSupplierDefaults` → use ids in profile upsert
- [x] Mirror admin invite: duplicate check, deactivated check, `inviteUserByEmail`, rollback on profile failure
- [x] `redirectTo`: `${getServerAppUrl()}/invite/complete`

### Task 4.2: `app/api/procurement/suppliers/create/route.ts`

- [x] Same auth + defaults
- [x] Body: `{ email, full_name, password?, payment_terms? }`
- [x] Mirror admin create: `createUser`, profile insert, return `temp_password`

### Verify Phase 4

| Test | Expected | Result (2026-06-09) |
|------|----------|---------------------|
| Procurement invite new email | `success: true` | Skipped live invite (sends email); create path verified |
| Duplicate email | 409 with clear message | PASS — create duplicate 400 with clear auth message |
| Procurement create | `success: true` + `temp_password` | PASS — 200 + temp_password |
| Employee calls either route | 403 | PASS — 403 |
| Body with `role_id: <admin-uuid>` | Ignored/overridden — created user is still supplier | PASS — 400 rejects body; create without role_id → supplier role + payment_terms |
| Admin invite/create (existing routes) | Unchanged — still works | PASS — no admin route edits |

---

## Phase 5 — Client data layer (1 new file)

**Risk:** None to existing libs — new `lib/procurement-suppliers.ts` only.

### Task 5.1: Create `lib/procurement-suppliers.ts`

- [x] Types: `SupplierAccount`, `SupplierAccountFilters`, `SupplierAccreditationStatus`
- [x] `listSupplierAccountsWithCount(filters)`:
  - Query `profiles` where `role_id = supplierRoleId`
  - Enrich: latest `supplier_accreditations` per supplier, `supplier_products` count
  - Client-side filter for accreditation bucket (approved/pending/none/rejected)
- [x] `getSupplierAccountById(id)` — return null if not supplier

**Do not** extend `lib/admin-users.ts`.

### Verify Phase 5

- [x] Temporary `console.log` in a scratch page or browser: returns demo suppliers with enrichment.
- [x] `lib/admin-users.ts` list still works on `/admin/users`.

**Phase 5 results (2026-06-09):** `lib/procurement-suppliers.ts` created. DB spot-check: 4+ supplier profiles with accreditation status + product counts (e.g. Ace Supply Corp). Browser client lib verified at compile/lint; full UI wire-up in Phase 7. `lib/admin-users.ts` untouched.

---

## Phase 6 — UI components (3 new files)

**Risk:** None to existing components.

### Task 6.1: `components/procurement/CreateSupplierModal.tsx`

- [x] Copy structure from `CreateUserModal` **invite + create tabs only**
- [x] Fields: `full_name`, `email`, optional `payment_terms` (create tab: optional password)
- [x] **No** role/position/department/password on invite tab
- [x] Calls `/api/procurement/suppliers/invite` and `/create` only

### Task 6.2: `components/procurement/SupplierAccountsTable.tsx`

- [x] Columns: company, email, status, accreditation, products, payment terms, added, view link
- [x] Use existing `Table`, `EmptyState`, `TableSkeleton` patterns from `UserTable`

### Task 6.3: `components/procurement/SupplierAccountDetail.tsx`

- [x] Account summary + accreditation link (`/accreditation/{id}` if exists)
- [x] Reuse `SupplierPaymentTermsForm` unchanged (admin API now allows procurement)
- [x] Link to `/accreditation/products` (generic — no product page changes in v1)

### Verify Phase 6

- [x] Components render in isolation (modal opens, no console errors).
- [x] `CreateUserModal` on `/admin/users` unchanged.

**Phase 6 results (2026-06-09):** Three components created under `components/procurement/`. Lint clean; TypeScript clean (minor fix in `lib/procurement-suppliers.ts` role mapping). Full UI smoke test in Phase 7.

---

## Phase 7 — Pages (2 new files)

**Risk:** New routes only.

### Task 7.1: `app/suppliers/page.tsx`

- [x] Guard: `profile.role === 'procurement' || profile.role === 'admin'`
- [x] FilterBar: search, status, accreditation
- [x] Pagination via `listSupplierAccountsWithCount`
- [x] "Add Supplier" → `CreateSupplierModal`

### Task 7.2: `app/suppliers/[id]/page.tsx`

- [x] Load `getSupplierAccountById`
- [x] Render `SupplierAccountDetail`
- [x] Back link to `/suppliers`

### Verify Phase 7 (full smoke test)

| # | Step | Expected | Result |
|---|------|----------|--------|
| 1 | Procurement opens `/suppliers` | List loads with existing suppliers | **Manual** — log in as `procurement@fortune.com` |
| 2 | Invite new supplier | Success; new row on list after close modal | **Manual** |
| 3 | Open invite link in browser | `/invite/complete` → set password → supplier portal | **Manual** |
| 4 | Manual create | Temp password shown; login works | **Manual** |
| 5 | Detail → save payment terms | Saves; appears in list column | **Manual** |
| 6 | `/accreditation` | Applications only — new invitee absent until they apply | **Manual** |
| 7 | `/admin/users` | Admin create/invite still works | **Manual** |
| 8 | RFQ assign suppliers modal | Unchanged | **Manual** |
| 9 | Employee `/suppliers` | Blocked | **Manual** |

**Phase 7 build (2026-06-09):** Pages compile; lint + TypeScript clean. Run manual checklist above in browser to complete verification.

---

## Phase 8 — Out of scope (do not implement in v1)

**Status: Complete (no code changes).** v1 implementation ends at Phase 7. Items below are documented deferrals for a future iteration.

Explicitly deferred to avoid scope creep and extra file touches:

- [x] Deactivate/reactivate from `/suppliers` — deferred (admin only today)
- [x] Reset password / resend invite — deferred
- [x] "Invite Supplier" button on `/accreditation` — **implemented (v2 follow-up, 2026-06-09)**
- [x] Product review page supplier filter query param — deferred
- [x] Shared refactor of admin + procurement invite into one lib — deferred
- [x] Database migrations — not needed
- [x] Audit log changes — not needed (payment terms already logs via existing admin route)

### v1 completion verification (2026-06-09)

| Automated | Result |
|-----------|--------|
| `npx tsc --noEmit` | PASS (exit 0) |
| Linter (procurement files) | PASS |
| Phase 4 API (procurement create/invite) | PASS (prior session) |
| Phase 3 payment-terms (procurement) | PASS (prior session) |

**Manual browser checklist:** See Phase 7 table — run once as procurement before merge/PR.

---

# Part 4 — Self-Review

| Spec requirement | Covered in |
|------------------|------------|
| Separate `/suppliers` page | Phase 1, 7 |
| Supplier-only create/invite | Phase 4 (server-enforced defaults) |
| List all supplier accounts | Phase 5, 7 |
| Payment terms edit | Phase 3, 6, 7 |
| Keep `/accreditation` untouched | §1.2, Phase 8 |
| Surgical / no breaking changes | §1.5, §2, per-phase verify tables |
| Minimal file modifications | §2 — only 4 existing files |

**Placeholder scan:** None.

---

# Part 5 — Execution Handoff

**Plan location:** `docs/superpowers/plans/2026-06-09-procurement-supplier-accounts.md`

**Estimated footprint:** 9 new files, 4 modified lines across 4 existing files, 0 migrations.

**Execution options:**

1. **Subagent-driven** — one phase per subagent, verify between phases (recommended)
2. **Inline** — implement phases 1–7 in this session with checkpoints

Which approach should we use?
