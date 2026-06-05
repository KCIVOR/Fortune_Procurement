# Security & RBAC — Full Audit + Surgical Implementation Plan

**Project:** Fortune Procurement System  
**Created:** 2026-06-04  
**Status:** Phase 0–1 complete on `emddvbocupvufzvhcacz` — Phase 2+ pending  
**Database target:** `emddvbocupvufzvhcacz` (Fortune Procurement)  
**Phase 0 snapshot:** [`docs/phase0-baseline-snapshot.md`](phase0-baseline-snapshot.md)  
**Related docs:** `docs/rbac-audit/`, `RLS_POLICY_DIRECTOR_QUOTES_IMPLEMENTATION.md`, `ENVIRONMENT_SETUP.md`

---

## How to use this document

1. Read **Part 1 (Audit)** — current state vs risk.  
2. Confirm **Part 2 (Target behavior)** — policy assumptions.  
3. Execute **Part 3 (Phases)** in order; check boxes as you go.  
4. Run verification SQL/scripts after **each** phase before moving on.

**Surgical rule:** Prefer **new forward migrations** + small additive app files. Do **not** edit historical migration files that may already be applied on any environment.

---

## Progress tracker (high level)

| Phase | Name | Status |
|-------|------|--------|
| 0 | Baseline verification on live DB | ✅ Complete (2026-06-04) |
| 1 | Critical RLS hotfixes | ✅ Complete (2026-06-04) |
| 2 | API & Edge Function hardening | ⬜ Not started |
| 3 | Route middleware (allow-list) | ⬜ Not started |
| 4 | Page-level guards (by route group) | ⬜ Not started |
| 5 | Module visibility fail-closed | ⬜ Not started |
| 6 | UI price / related-records alignment | ⬜ Not started |
| 7 | Dev route cleanup + regression matrix | ⬜ Not started |

---

# Part 1 — Full audit (2026-06-04)

## 1.1 Architecture summary

| Layer | Mechanism | Enforces access? |
|-------|-----------|------------------|
| Auth | Supabase Auth + `AuthContext` | Login only |
| Shell | `AppShell` | Session required |
| Navigation | `ROLE_NAV` + `role_position_module_visibility` | **UI only** (explicitly not routes/RLS) |
| Pages | Sparse `profile.role` checks | **~15% of routes** |
| Data | Postgres RLS | **Primary gate today** (uneven) |
| Admin APIs | Next.js route handlers | Admin session checks ✅ |
| Other APIs | RFQ/BugTrack email | **No auth** ❌ |
| Edge Functions | `create-user`, `reset-password`, etc. | **No caller auth** ❌ |

**Missing:** `middleware.ts` at project root.

---

## 1.2 Database inventory

### Tables in `public` schema (from migrations)

| Domain | Tables | RLS enabled in repo? |
|--------|--------|----------------------|
| Foundation | `departments`, `roles`, `positions`, `profiles` | ✅ |
| PR1 | `pr1_requests`, `pr1_items` | ✅ (policies weak — see §1.4) |
| Warehouse | `warehouse_validations`, `warehouse_validation_items` | ✅ (policies weak) |
| Workflow | `controlled_form_templates`, `controlled_form_versions`, `approval_workflows`, `approval_steps`, `approval_instances`, `approval_actions` | ✅ (policies weak) |
| Notifications / audit | `notifications`, `audit_logs` | ✅ (policies weak) |
| PR2 | `pr2_requests`, `pr2_items` | ✅ (mostly role-scoped) |
| Canvassing | `rfq_batches`, `rfq_suppliers`, `rfq_item_quotes`, `supplier_item_selections` | ⚠️ **`rfq_suppliers` — no `ENABLE RLS` in repo** |
| PO | `po_requests`, `po_items`, `po_receipts` | ✅ |
| Delivery | `deliveries`, `delivery_status_history` | ✅ |
| GRN | `grn_receipts`, `grn_items` | ✅ |
| Substitutes | `substitute_decisions` | ✅ |
| Supplier accred. | `supplier_accreditations`, `supplier_products`, `supplier_documents`, `rse_records`, `tsqa_reviews` | ✅ |
| Messaging | `conversations`, `messages`, `message_attachments` | ✅ |
| Admin config | `role_position_module_visibility` | ✅ |
| BugTrack | `bug_reports`, `bugtrack_settings` | ✅ |

**Approx. count:** 38 application tables; **37** have `ENABLE ROW LEVEL SECURITY` in migrations; **`rfq_suppliers` is the documented gap**.

### Storage buckets (from migrations)

| Bucket | Purpose |
|--------|---------|
| `delivery-receipts` | DR attachments |
| `accreditation-docs` | Supplier accreditation files |
| `message-attachments` | Messaging files |

Storage uses object-level policies in migration files — verify on live project after Phase 0.

### SQL helpers (SECURITY DEFINER)

| Function | Purpose |
|----------|---------|
| `is_own_rfq_batch`, `is_own_rfq_supplier` | Requestor RFQ access without RLS recursion |
| `generate_rfq_number`, `generate_grn_number` | Document numbers |
| Messaging RPCs (`create_or_get_conversation`, etc.) | Controlled writes |
| Accreditation / withdrawn helpers | Status transitions |

**Surgical note:** Reuse these patterns when tightening policies; avoid new recursion between `rfq_batches` ↔ `rfq_suppliers`.

---

## 1.3 Policies using `USING (true)` or global write (highest risk)

These are the **confirmed** permissive policies in migration files:

| Table | Policy / behavior | Risk |
|-------|-------------------|------|
| `pr1_requests` | SELECT `USING (true)` — all authenticated | 🔴 Any role reads all PR1s |
| `pr1_items` | SELECT `USING (true)` | 🔴 |
| `warehouse_validations` | SELECT + INSERT for any authenticated (`validator_id = auth.uid()`) | 🔴 Non-warehouse can insert validations |
| `warehouse_validation_items` | SELECT `USING (true)` | 🟡 |
| `approval_instances` | SELECT + UPDATE `USING (true)` | 🔴 Any user can update any instance |
| `approval_actions` | SELECT `USING (true)` | 🟡 Leak approval history |
| `approval_workflows` / `approval_steps` | SELECT `USING (true)` | 🟢 Low (config); OK for read |
| `controlled_form_*` | SELECT `USING (true)` | 🟢 Low |
| `audit_logs` | SELECT `USING (true)` | 🔴 All users read audit trail |
| `notifications` | INSERT `WITH CHECK (true)` | 🔴 Spoof notifications to any user |
| `departments`, `roles`, `positions` | SELECT `USING (true)` | 🟢 Acceptable directory |
| `profiles` | SELECT all profiles `USING (true)` | 🟡 Directory exposure (email, role) |
| `bugtrack_settings` | SELECT `USING (true)` | 🟡 |

**Already tightened (keep):**

- `profiles` self-update: column grant **full_name only** (`20260430023558_fix_profile_rls_column_restrictions.sql`)
- `bug_reports` SELECT: admin + own reporter (`20260521160000_update_bugtrack_rls_policies.sql`)
- Director RFQ quotes: position-scoped (`20260504111934_*`, `20260504115152_*`)
- Employee PO: own requisition only (`20260504185201_*`)
- Messaging: participant-scoped (`20260519130000_*`)

---

## 1.4 RLS by domain (current vs intended)

Legend: ✅ aligned · ⚠️ partial · ❌ misaligned

| Domain | Current RLS (summary) | Intended | Gap |
|--------|---------------------|----------|-----|
| PR1 read | All authenticated | Owner + workflow participants + warehouse queue + admin | ❌ |
| PR1 write | Owner + approver transitions + warehouse transition | Same | ⚠️ verify approver policy scope |
| PR2 | Procurement + approver read; requestor own; approver UPDATE broad | Same + tighten approver UPDATE to status-only paths | ⚠️ |
| RFQ batches | Procurement, supplier, requestor own, approver select | Procurement, supplier, requestor own; **no approver list browse** | ⚠️ |
| RFQ suppliers | Policies exist; **RLS may be off** | Procurement + supplier + requestor own | ❌ |
| RFQ quotes | Procurement, supplier, requestor, Director | Same; keep Director | ✅ |
| PO | Procurement, approver, supplier, employee own | Same | ✅ |
| Delivery | Role-scoped + employee own | Same; **remove approver read-all** if policy added | ⚠️ |
| GRN | Warehouse write; procurement/approver/employee read | Warehouse write; procurement read; **no employee page**; **no approver read-all** | ⚠️ |
| Approvals | Instances UPDATE wide open | Step-scoped or RPC-only | ❌ |
| Audit | All read | Admin only | ❌ |
| Warehouse validation | All read; any insert as self | Warehouse role only | ❌ |
| Supplier portal | Generally scoped | Same | ✅ |
| Messaging | Participant scoped | Same | ✅ |
| Module visibility | Admin manage; users read own rules | Same | ✅ |

---

## 1.5 Application audit — routes (72 `page.tsx` files)

### Routes with **hard** role guard (redirect or block before data)

| Route | Guard |
|-------|--------|
| `/pr1`, `/pr1/new` | `employee` only |
| `/warehouse/history` | `warehouse` only |
| `/approvals/history` | `approver` \| `procurement` |
| `/tsqa`, `/tsqa/rse`, `/tsqa/rse/[id]` | `tsqa` \| `admin` |
| `/admin/*` (most) | `admin` (error state) |
| `/admin` | redirect non-admin |

### Routes with **partial** UI guard (no redirect)

| Route | Behavior |
|-------|----------|
| `/pr1/[id]` | Edit actions gated; **any user can load any id** (RLS allows) |
| `/pr1/[id]/edit` | Redirect if not draft path |
| `/po/page` | `canCreatePO` button only |
| `/grn/[id]` | `isReadOnly` unless `warehouse` |
| `/delivery/[id]` | procurement/warehouse flags for actions |
| `/approvals/pr2/[id]` | `canViewPrice` / `canViewCanvass` by role+position |
| `/bugtrack/[id]` | Admin-only detail (toast); list open to all |

### Routes with **no** role guard (session only)

Includes but not limited to:

`/grn`, `/grn/[id]`, `/po`, `/po/[id]`, `/po/new`, `/rfq`, `/rfq/[id]`, `/pr2`, `/pr2/[id]`, `/warehouse`, `/warehouse/[id]`, `/delivery`, `/delivery/[id]`, `/approvals`, `/approvals/pr1`, `/approvals/pr2`, `/approvals/po`, `/approvals/[id]`, `/approvals/po/[id]`, `/accreditation/**`, `/supplier/**`, `/substitutes/**`, `/messages/**`, `/bugtrack`, `/profile`, `/dashboard`, print variants.

### Routes with **no auth**

| Route | Risk |
|-------|------|
| `/test-dashboard` | Demo UI + links to real modules |
| `/test-filter` | Component demo |

### Global chrome (not in `ROLE_NAV`)

| Entry | Exposure |
|-------|----------|
| `TopHeader` → `/bugtrack` | All logged-in users |
| `MessageIcon` → `/messages` | All logged-in users (RLS OK) |

---

## 1.6 API & Edge audit

| Path | Auth today | Should be |
|------|------------|-----------|
| `POST /api/admin/users/create` | Session + admin | ✅ keep |
| `POST /api/admin/users/invite` | Session + admin | ✅ keep |
| `PATCH /api/admin/users/[id]/assignment` | Session + admin | ✅ keep |
| `POST /api/admin/users/[id]/reset-password` | Session + admin | ✅ keep |
| `POST /api/rfq/send-email` | **None** | Session + procurement |
| `POST /api/bugtrack/send-email` | **None** | Session + any authenticated (rate limit) |
| `POST /api/bugtrack/send-resolved-email` | **None** | Session + admin |
| Edge `create-user` | **None** + service role | Admin JWT or deprecate in favor of API |
| Edge `reset-user-password` | **None** + service role | Admin JWT only |
| Edge `reset-demo-passwords` | **None** | Disable in production |

---

## 1.7 Codebase modules (security-relevant)

| Path | Role |
|------|------|
| `config/navigation.ts` | `ROLE_NAV`, `ModuleKey`, `ALL_NAV` |
| `lib/module-visibility.ts` | Sidebar resolution; **defaults visible = true** |
| `hooks/use-module-visibility.ts` | **Fail-open** on error |
| `components/layout/AppShell.tsx` | Session gate only |
| `components/layout/Sidebar.tsx` | Filtered nav |
| `components/shared/RelatedRecords.tsx` | Hides chain for non approver/procurement/admin |
| `lib/approvals.ts` | `canActOnStep` — app-layer only |
| `lib/supabase.ts` | Anon client (correct) |
| `context/AuthContext.tsx` | Profile + role hydration |

---

## 1.8 Critical findings ranked

| # | Finding | Severity | Layer |
|---|---------|----------|--------|
| F1 | `pr1_requests` / `pr1_items` SELECT all authenticated | 🔴 Critical | RLS |
| F2 | `approval_instances` UPDATE `USING (true)` | 🔴 Critical | RLS |
| F3 | `rfq_suppliers` RLS not enabled in migrations | 🔴 Critical | RLS |
| F4 | Unauthenticated email API routes | 🔴 Critical | API |
| F5 | Edge functions without caller verification | 🔴 Critical | Edge |
| F6 | No Next.js middleware | 🟠 High | App |
| F7 | `audit_logs` SELECT all authenticated | 🟠 High | RLS |
| F8 | Warehouse validation INSERT for any user | 🟠 High | RLS |
| F9 | Approver read-all on GRN/delivery/PO (migrations) + open URLs | 🟠 High | RLS + App |
| F10 | Module visibility fail-open | 🟡 Medium | App |
| F11 | `/test-dashboard` public | 🟡 Medium | App |
| F12 | `notifications` INSERT any `user_id` | 🟡 Medium | RLS |

---

# Part 2 — Target behavior (approved assumptions)

Use these unless product owner changes them:

| # | Decision | Choice |
|---|----------|--------|
| D1 | Employee `/grn` | **No access** (track via Delivery Status only) |
| D2 | Approver logistics lists (`/grn`, `/delivery`, `/po`, `/rfq`, `/pr2`) | **No access** for non-Director approvers; **Director** position may access (middleware + `DIRECTOR_LOGISTICS_PREFIXES`) |
| D3 | Employee PR1 | **Own PR1 only** (no cross-user `/pr1/[id]`) |
| D4 | Director canvass / prices on PR2 approval | **Keep** (existing RLS + UI) |
| D5 | Procurement GRN | **Read-only** (warehouse closes) |
| D6 | Module visibility | Must match route allow-list when Phase 5 done — see `config/module-route-map.ts` (nav only; routes enforced by middleware) |
| D7 | Commercial price visibility | **Visible:** `procurement`, `admin`, `approver` + position `Director`. **Hidden:** warehouse, employee, other approvers. **Supplier portal:** unchanged (own quotes). UI: `lib/price-visibility.ts` + `formatCommercialAmount()` on GRN/PO/PR2 detail+print, PR2/PO approval, RFQ matrix, delivery `grand_total`, substitute unit price |

---

# Part 3 — Surgical implementation plan

## General surgical rules

1. **One concern per migration file** — name: `YYYYMMDDHHMMSS_security_<area>.sql`.
2. **Never** change applied migrations; only add new ones.
3. **Drop + recreate** policies by exact name from §1.3 (use `DROP POLICY IF EXISTS`).
4. After RLS changes, run **smoke tests** with JWT for each demo role (see Phase 7 matrix).
5. **Do not** refactor `lib/approvals.ts` / workflow logic in security phases unless a test proves RLS blocks a previously working path — then add minimal RPC, not a rewrite.
6. **Preserve** Director quote policies and `is_own_rfq_*` helpers.

### Do-not-touch list (unless fixing a named bug)

- RFQ number / GRN number generators  
- Messaging RPCs and triggers  
- Supplier accreditation SECURITY DEFINER flows  
- `canActOnStep` / approval business rules in TS (only add guards, don’t rewrite workflow)  
- Seed / demo password migrations  
- Raw materials / PR2 phase workflow migrations unrelated to security  

---

## Phase 0 — Baseline verification (no app code)

**Goal:** Confirm live DB matches repo expectations on `emddvbocupvufzvhcacz`.

| # | Task | Status |
|---|------|--------|
| 0.1 | Run `supabase db push` (or confirm all migrations applied) | ✅ 105 local = 105 remote |
| 0.2 | SQL: list tables without RLS | ✅ Only `rfq_suppliers` |
| 0.3 | SQL: list policies with `qual` / `with_check` containing `true` | ✅ 20 rows (see snapshot) |
| 0.4 | SQL: confirm `rfq_suppliers.rowsecurity` | ✅ **`rls_enabled = false`** (F3 confirmed) |
| 0.5 | Document demo user UUIDs per role for test matrix | ✅ 14 `@fortune.com` users (no TSQA) |
| 0.6 | Export policy inventory to Phase 0 appendix (optional) | ✅ Appendix D below |

**Verification SQL (run in Supabase SQL editor):**

```sql
-- Tables without RLS
SELECT c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND NOT c.relrowsecurity
ORDER BY 1;

-- Permissive policies (simplified)
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual = 'true' OR with_check = 'true')
ORDER BY tablename, policyname;
```

**Exit criteria:** Written baseline snapshot stored; F3 confirmed true/false on live DB. **All met** — see [`docs/phase0-baseline-snapshot.md`](phase0-baseline-snapshot.md).

**Artifacts added:**

- `scripts/phase0-baseline-verification.sql` — reusable SQL
- `docs/phase0-baseline-snapshot.md` — full results

---

## Phase 1 — Critical RLS hotfixes (DB only)

**Goal:** Close data-layer holes without changing application logic.  
**Risk:** Medium — test approval + PR1 flows after each migration.

### Migration 1A — `rfq_suppliers` enable RLS

| # | Task | Status |
|---|------|--------|
| 1A.1 | Create migration: `ENABLE ROW LEVEL SECURITY` on `rfq_suppliers` | ✅ `20260604120000` |
| 1A.2 | Verify existing policies attach (procurement, supplier, requestor helpers) | ✅ 7 policies active |
| 1A.3 | Test: employee sees only own RFQ suppliers; supplier sees own rows | ⬜ App login (JWT) |

### Migration 1B — PR1 read scope

| # | Task | Status |
|---|------|--------|
| 1B.1 | Drop `"Authenticated users can read all PR1s"` / items equivalent | ✅ |
| 1B.2 | Add `can_read_pr1()` + scoped SELECT policies | ✅ `20260604120100` |
| 1B.3 | Test: employee A cannot SELECT employee B PR1 | ⬜ App login (JWT) |
| 1B.4 | Test: warehouse queue still loads | ⬜ App login (JWT) |
| 1B.5 | Test: approver queue still loads | ⬜ App login (JWT) |

**Surgical tip:** Consider SECURITY DEFINER `can_read_pr1(pr1_id uuid)` to avoid policy recursion with `approval_instances`.

### Migration 1C — `approval_instances` UPDATE lockdown

| # | Task | Status |
|---|------|--------|
| 1C.1 | Drop `"Authenticated users can update approval instances"` | ✅ |
| 1C.2 | Option B: approver + procurement UPDATE policies | ✅ `20260604120200` |
| 1C.3 | Audit client `.update()` on instances | ✅ `lib/approvals.ts`, `pr2-approvals.ts`, `po-approvals.ts` |
| 1C.4 | Test: full PR1 approve / reject / revision path | ⬜ App login (JWT) |
| 1C.5 | Test: PR2 phase approval still advances status | ⬜ App login (JWT) |

**Surgical tip:** Option A is safest but needs thin RPC wrappers matching existing TS update payloads — **do not** change approval decision logic inside RPC, only gate auth.

### Migration 1D — Audit logs admin-only read

| # | Task | Status |
|---|------|--------|
| 1D.1 | Drop `"Authenticated users can read audit logs"` | ✅ |
| 1D.2 | Add `"Admins can read audit logs"` | ✅ `20260604120300` |
| 1D.3 | Keep authenticated INSERT (actor from app) | ✅ unchanged |
| 1D.4 | Test: `/admin/audit` works for admin; fails for employee | ⬜ App login (JWT) |

### Migration 1E — Warehouse validation scope

| # | Task | Status |
|---|------|--------|
| 1E.1 | Scoped SELECT via `can_read_warehouse_validation()` | ✅ `20260604120400` |
| 1E.2 | INSERT/UPDATE warehouse role only | ✅ |
| 1E.3 | Test: warehouse queue + submit validation | ⬜ App login (JWT) |
| 1E.4 | Test: employee cannot INSERT validation | ⬜ App login (JWT) |

**Phase 1 exit criteria:** F1–F3, F7, F8 resolved on live DB ✅ (schema); approval smoke tests ⬜ pending app login.

**Post–Phase 1 audit (2026-06-04):** See [`docs/phase1-post-audit-snapshot.md`](phase1-post-audit-snapshot.md). CLI verification: 0 tables without RLS; 6 permissive policies removed (20→14); legacy policy names absent; helpers present. **Proceed to Phase 2 only after** manual smoke matrix §5 in that doc (or documented exceptions).

**Migrations applied (110 total):**

| File | Phase |
|------|--------|
| `20260604120000_security_enable_rfq_suppliers_rls.sql` | 1A |
| `20260604120100_security_pr1_read_scope.sql` | 1B (+ `is_role`, `can_read_pr1`) |
| `20260604120200_security_approval_instances_update.sql` | 1C |
| `20260604120300_security_audit_logs_admin_read.sql` | 1D |
| `20260604120400_security_warehouse_validation_scope.sql` | 1E (+ `can_read_warehouse_validation`) |

**Post-push verification:** All `public` tables have RLS; `rfq_suppliers.rls_enabled = true`; removed global policies absent.

---

## Phase 2 — API & Edge hardening

**Goal:** Stop unauthenticated abuse; no change to happy-path UI yet.

| # | Task | Files | Status |
|---|------|-------|--------|
| 2.1 | Add shared `requireSession()` + `requireRole()` helpers for API routes | `lib/api-auth.ts` (new) | ✅ |
| 2.2 | Protect `app/api/rfq/send-email/route.ts` — procurement only; validate body shape | ✅ |
| 2.3 | Protect `app/api/bugtrack/send-email/route.ts` — authenticated | ✅ |
| 2.4 | Protect `app/api/bugtrack/send-resolved-email/route.ts` — admin only | ✅ |
| 2.5 | Edge: verify JWT + admin role in `create-user`, `reset-user-password` | `supabase/functions/*` + `_shared/admin-auth.ts` | ✅ (deploy functions) |
| 2.6 | Confirm production disables `reset-demo-passwords` | `ALLOW_DEMO_PASSWORD_RESET` must be `true` to invoke; default blocked | ✅ code gate |
| 2.7 | Optional: rate limit email endpoints | middleware or route | ⬜ skipped |

**Client:** `lib/authenticated-fetch.ts` — callers updated (`rfq`, `canvassing`, bugtrack).

**Phase 2 exit criteria:** curl without session returns 401; non-proc cannot call RFQ email. **Deploy edge functions** after merge: `npx supabase functions deploy create-user reset-user-password reset-demo-passwords`.

---

## Phase 3 — Route middleware (allow-list)

**Goal:** Block direct URLs by role prefix; align with D1–D3.

| # | Task | Files | Status |
|---|------|-------|--------|
| 3.1 | Create `config/route-access.ts` — single map: `pathPrefix → AppRole[]` | `config/route-access.ts` | ✅ |
| 3.2 | Create `middleware.ts` — read session from cookie; redirect to `/dashboard` or 403 page | `middleware.ts` + `@supabase/ssr` | ✅ |
| 3.3 | Map prefixes per §3.1 table below | ✅ see `ROUTE_ACCESS_RULES` | ✅ |
| 3.4 | Exclude public routes: `/login`, `/forgot-password`, `/reset-password`, `/invite/complete` | ✅ |
| 3.5 | Test matrix Phase 7 for URL bypass attempts | ⬜ manual |

### Proposed `route-access` map (middleware)

| Prefix | Allowed roles |
|--------|----------------|
| `/admin` | `admin` |
| `/warehouse` | `warehouse` |
| `/grn` | `warehouse`, `procurement` |
| `/rfq` | `procurement` |
| `/po` | `procurement`, `supplier` (supplier only `/supplier/po` — use explicit paths) |
| `/pr2` | `procurement` |
| `/pr1/new`, `/pr1` (list) | `employee` |
| `/pr1/` (detail) | `employee`, `warehouse`, `procurement`, `approver`, `admin` (RLS still enforces row) |
| `/approvals` | `approver`, `procurement` |
| `/accreditation` | `procurement`, `tsqa`, `admin` (split fine-grained in Phase 4) |
| `/supplier` | `supplier` |
| `/tsqa` | `tsqa`, `admin` |
| `/substitutes` | `employee` |
| `/delivery` | `employee`, `warehouse`, `procurement` |
| `/messages`, `/profile`, `/dashboard`, `/bugtrack` | all authenticated |
| `/test-dashboard`, `/test-filter` | **block in production** |

**Surgical note:** `/supplier` vs `/po` — middleware should list `/supplier` before generic `/po` rules. Prefer explicit path arrays over naive prefix if collisions occur.

**Phase 3 exit criteria:** Employee GET `/grn` → redirect; approver GET `/grn` → redirect; warehouse OK.

**Pre–Phase 3 audit:** [`docs/phase3-pre-audit-snapshot.md`](phase3-pre-audit-snapshot.md)

**Post–Phase 3:** `lib/supabase.ts` migrated to `createBrowserClient` (`@supabase/ssr`) so sessions sync to cookies for middleware. Denied users → `/dashboard?access=denied`. Admin bypasses role rules except `/supplier/*` and test pages. **Users must re-login once** if middleware redirects unexpectedly (legacy localStorage-only sessions).

---

## Phase 4 — Page-level guards (surgical, by group)

**Goal:** Defense in depth + better UX than bare redirect; **mirror middleware**.

Add `hooks/use-require-roles.ts` or use shared layout wrappers — **do not** duplicate logic in 72 files individually.

| Group | Routes | Guard | Status |
|-------|--------|-------|--------|
| A | `/grn/**` | `warehouse` \| `procurement` (read UI) | ✅ AppShell |
| B | `/warehouse/**` (except history done) | `warehouse` | ✅ AppShell |
| C | `/rfq/**`, `/pr2/**` | `procurement` | ✅ AppShell |
| D | `/po/**` (non-supplier) | `procurement` | ✅ AppShell |
| E | `/approvals/**` (except history) | `approver` \| `procurement` | ✅ AppShell |
| F | `/supplier/**` | `supplier` | ✅ AppShell |
| G | `/accreditation/**` | `procurement` \| `tsqa` \| `admin` | ✅ AppShell |
| H | `/pr1/[id]` | If `employee` → require `requisitioner_id === profile.id` | ✅ `lib/pr1-access.ts` + detail/edit pages |
| I | Print routes | Same as parent resource | ✅ print `layout.tsx` × 4 |

**Files (expected touch):**

- `app/grn/page.tsx`, `app/grn/[id]/page.tsx`, `app/grn/[id]/print/page.tsx`
- `app/warehouse/page.tsx`, `app/warehouse/[id]/page.tsx`
- `app/rfq/page.tsx`, `app/rfq/[id]/page.tsx`
- `app/po/page.tsx`, `app/po/[id]/page.tsx`, `app/po/new/page.tsx`
- `app/pr2/page.tsx`, `app/pr2/[id]/page.tsx`
- `app/approvals/pr1/page.tsx`, `app/approvals/pr2/page.tsx`, `app/approvals/po/page.tsx`, detail pages
- `app/supplier/**/page.tsx` (layout-level guard preferred)
- `components/layout/RequireRoles.tsx` (new, small)

**Phase 4 delivered:** `RequireRoles`, `AccessDenied`, `hooks/use-require-roles.ts`, `isRoleAllowedForPath()` in `config/route-access.ts`, **AppShell** pathname guard, print layouts, PR1 employee owner guard.

**Phase 4 exit criteria:** UI shows Access Denied before flash of protected data; no regression for allowed roles.

---

## Phase 5 — Module visibility fail-closed

| # | Task | Files | Status |
|---|------|-------|--------|
| 5.1 | On fetch error: set `rules` to hide non-essential modules (not `[]` fail-open) | `hooks/use-module-visibility.ts` | ✅ `status: 'error'` fail-closed |
| 5.2 | While loading: don't treat as visible (`isModuleVisible` → false except dashboard) | same | ✅ |
| 5.3 | Optional: sync module keys for `/grn` → `goods_receipt` in admin UI docs | `config/module-route-map.ts` + docs | ✅ |
| 5.4 | Document: module visibility must mirror `route-access.ts` | plan + `MODULE_VISIBILITY_ADD_MODE.md` | ✅ |

**Pre–Phase 5 audit:** [`docs/phase5-pre-audit-snapshot.md`](phase5-pre-audit-snapshot.md)

**Phase 5 exit criteria:** Simulated fetch failure hides procurement modules.

---

## Phase 6 — UI alignment (prices & related records)

**Goal:** Match UI to RLS intent; no policy changes unless gap found.

**Pre–Phase 6 audit:** [`docs/phase6-pre-audit-snapshot.md`](phase6-pre-audit-snapshot.md) — superseded by **D7** (warehouse hides prices; procurement/Director/admin see them).

| # | Task | Status |
|---|------|--------|
| 6.1 | GRN/PO/PR2 detail + print: mask commercial amounts per D7 | ✅ `lib/price-visibility.ts` |
| 6.2 | PR2/PO approval + RFQ matrix + delivery totals + substitutes | ✅ shared helper |
| 6.3 | Director logistics routes (D2 exception) | ✅ `config/route-access.ts` + middleware position |
| 6.4 | PR1 detail: no line prices today | ✅ no change |

---

## Phase 7 — Dev cleanup & regression matrix

| # | Task | Status |
|---|------|--------|
| 7.1 | Gate `/test-dashboard`, `/test-filter` — dev only (`layout.tsx` + `isProductionBlockedPath`) | ✅ |
| 7.2 | Route matrix code-verified | ✅ [`docs/phase7-post-audit-snapshot.md`](phase7-post-audit-snapshot.md) |
| 7.3 | Run `npm run typecheck` + `npm run build` | ✅ (June 4, 2026) |
| 7.4 | Update `docs/rbac-audit/SECURITY_CHECKLIST.md` | ✅ RBAC track section added |

### Regression matrix (manual)

For each role, mark **Pass** if: nav OK, allowed URLs load, blocked URLs redirect, RLS returns no extra rows.

| URL | Employee | Warehouse | Procurement | Approver | Supplier | Admin |
|-----|----------|-----------|-------------|----------|----------|-------|
| `/pr1` | ✅ own | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/pr1/{other}` | ❌ | ⚠️ queue | ⚠️ | ⚠️ | ❌ | ✅ |
| `/warehouse` | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/grn` | ❌ | ✅ | ✅ read | ❌ | ❌ | ❌ |
| `/rfq` | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `/po` | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `/approvals/pr1` | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| `/supplier/quotations` | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `/admin/users` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `/api/rfq/send-email` | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |

---

## Phase 8 — Optional follow-ups (post-MVP security)

| Item | Notes |
|------|-------|
| Restrict `approval_actions` SELECT | Actor + document participants |
| `notifications` INSERT | `user_id = auth.uid()` or service role only |
| Narrow `profiles` SELECT | Views exposing `full_name` only for directory |
| Approver RFQ read policy removal | Migration `20260504200444` review |
| Central audit RPC | Replace client INSERT audit_logs |
| Automated RLS tests | pgTAP or Supabase test suite per role JWT |

---

# Appendix A — File change forecast (by phase)

| Phase | New files | Modified files (estimate) |
|-------|-----------|---------------------------|
| 0 | — | — |
| 1 | 3–6 SQL migrations | — |
| 2 | `lib/api-auth.ts` | 3 API routes, 2–3 edge functions |
| 3 | `middleware.ts`, `config/route-access.ts` | — |
| 4 | `components/layout/RequireRoles.tsx`, hook | ~15–20 page wrappers or layouts |
| 5 | — | 2 hooks/libs |
| 6 | — | 2–5 components |
| 7 | — | 2 test pages |

---

# Appendix B — Policy names to drop (Phase 1 checklist)

```
pr1_requests: "Authenticated users can read all PR1s"
pr1_items: "Authenticated users can read all PR1 items"
approval_instances: "Authenticated users can update approval instances"
audit_logs: "Authenticated users can read audit logs"
warehouse_validations: "Authenticated users can read warehouse validations"
warehouse_validations: "Authenticated users can insert warehouse validations"
warehouse_validation_items: "Authenticated users can read validation items"
```

---

# Appendix C — References

- Prior behavior spec: conversation 2026-06-04 (employee no GRN, approver no logistics, PR1 own-only)
- `docs/rbac-audit/RBAC_SECURITY_AUDIT.md` — May 2026 audit (partially stale; this doc supersedes for implementation tracking)
- `docs/rbac-audit/QUICK_FIXES.md` — SQL snippets for rfq_suppliers + audit_logs
- `RLS_POLICY_DIRECTOR_QUOTES_IMPLEMENTATION.md` — preserve Director quote access

---

# Appendix D — Phase 0 live DB results (`emddvbocupvufzvhcacz`)

Captured 2026-06-04 via Supabase CLI. Full narrative: [`phase0-baseline-snapshot.md`](phase0-baseline-snapshot.md).

### Migrations

- **105** files; local and remote identical.

### RLS gap (F3)

| Table | `rls_enabled` | Policies defined |
|-------|---------------|------------------|
| `rfq_suppliers` | **false** | 7 (inactive until Phase 1A) |

### Critical permissive policies (live)

Confirmed present: `pr1_requests` + `pr1_items` global SELECT; `approval_instances` global UPDATE; `audit_logs` global SELECT; `notifications` open INSERT.

### Policy counts (public schema, 41 tables)

| tablename | policy_count |
|-----------|--------------|
| deliveries | 10 |
| supplier_products | 9 |
| po_requests | 8 |
| delivery_status_history | 8 |
| supplier_documents | 8 |
| rse_records | 8 |
| grn_items / grn_receipts | 6 each |
| rfq_batches / rfq_item_quotes / rfq_suppliers | 6 / 6 / 7 |
| pr1_requests | 7 |
| … | (see snapshot for full list) |

### Demo test accounts

Use `employee@fortune.com`, `warehouse@fortune.com`, `procurement@fortune.com`, `director@fortune.com`, `supplier@fortune.com`, `admin@fortune.com` — UUIDs in snapshot. **No TSQA user** on this database yet.

---

**Next step:** Phase **2** — API & Edge Function auth (`/api/rfq/send-email`, bugtrack routes, edge functions). Then Phase **3** middleware.

**Manual smoke tests (Phase 1):** Log in as `employee@fortune.com` and `warehouse@fortune.com`; confirm PR1 isolation, warehouse validation, and approvals still work. See `scripts/phase1-verify-rls.sql`.
