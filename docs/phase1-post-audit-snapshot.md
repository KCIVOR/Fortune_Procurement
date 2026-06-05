# Phase 1 — Post-Implementation Audit

**Project ref:** `emddvbocupvufzvhcacz`  
**Audited:** 2026-06-04  
**Method:** `npx supabase db query --linked` (elevated CLI role) + repo/migration review  
**Compared to:** [`docs/phase0-baseline-snapshot.md`](phase0-baseline-snapshot.md), [`docs/SECURITY_RBAC_IMPLEMENTATION_PLAN.md`](SECURITY_RBAC_IMPLEMENTATION_PLAN.md)

---

## Executive summary

| Area | Verdict |
|------|---------|
| Phase 1 DB migrations (1A–1E) | **PASS** — schema matches plan on live DB |
| Phase 1 exit criteria (F1, F2, F3, F7, F8) | **PASS** at RLS layer |
| JWT / app smoke tests (1A.3–1E.4) | **NOT RUN** — required before treating Phase 1 as production-safe |
| App / API / middleware (F4–F6, F9–F12) | **UNCHANGED** — still open; Phase 2+ |

**Recommendation:** Run the manual smoke matrix below (15–20 min), then proceed to **Phase 2** (API & Edge hardening). Do **not** skip JWT tests — CLI queries run as superuser and do not prove `auth.uid()` behavior.

---

## 1. Migration & schema verification (live DB)

### 1.1 RLS coverage

| Check | Phase 0 | Post–Phase 1 |
|-------|---------|----------------|
| Tables without RLS | **1** (`rfq_suppliers`) | **0** |
| `rfq_suppliers.rls_enabled` | `false` | **`true`** (F3 closed) |

### 1.2 Removed policies (must be absent)

Query for legacy global policies returned **0 rows**:

- `Authenticated users can read all PR1s`
- `Authenticated users can read all PR1 items`
- `Authenticated users can update approval instances`
- `Authenticated users can read audit logs`
- `Authenticated users can read warehouse validations`
- `Authenticated users can insert warehouse validations`

### 1.3 New helpers

| Function | Present |
|----------|---------|
| `is_role(text)` | ✅ |
| `can_read_pr1(uuid)` | ✅ |
| `can_read_warehouse_validation(uuid)` | ✅ |

### 1.4 Target table policies (summary)

| Table | Phase 1 change | Current state |
|-------|----------------|---------------|
| `rfq_suppliers` | Enable RLS (1A) | 7 scoped policies; RLS on |
| `pr1_requests` / `pr1_items` | Scoped SELECT (1B) | `Scoped users can read …` via `can_read_pr1()` |
| `approval_instances` | Scoped UPDATE (1C) | `Approvers…` + `Procurement…` UPDATE only; global UPDATE removed |
| `audit_logs` | Admin SELECT (1D) | `Admins can read audit logs`; open INSERT retained |
| `warehouse_validations` / `warehouse_validation_items` | Scope + warehouse write (1E) | Scoped SELECT; warehouse-only INSERT/UPDATE |

### 1.5 Permissive policies (`qual` / `with_check` = `true`)

| Metric | Phase 0 | Post–Phase 1 | Delta |
|--------|---------|----------------|-------|
| Count | **20** | **14** | **−6** (expected) |

**Removed from permissive list (fixed):** global PR1 read (×2), global `approval_instances` UPDATE, global `audit_logs` SELECT, global `warehouse_validations` SELECT, global `warehouse_validation_items` SELECT.

**Still permissive (intentional or deferred):**

| Table | Policy | Risk | Phase |
|-------|--------|------|-------|
| `approval_actions` | Global SELECT | Info leak (who approved what) | Later RLS tightening |
| `approval_instances` | Global SELECT + INSERT | Read leak; any role can INSERT | 1C kept INSERT; consider RPC in later phase |
| `approval_steps` / `approval_workflows` | Global SELECT | Low (config) | OK |
| `audit_logs` | Open INSERT | Spoofed audit rows if app abused | App trust model |
| `notifications` | Open INSERT | **F12** | Later |
| `profiles` / `departments` / `positions` / `roles` | Directory reads | Low | OK |
| `bugtrack_settings` | Everyone SELECT | Low | OK |
| `pr1_requests` | Priority UPDATE `with_check: true` | USING is role-scoped | OK |

---

## 2. Finding resolution (Phase 1 scope)

| ID | Finding | Phase 1 status | Evidence |
|----|---------|----------------|----------|
| **F1** | Global PR1 read | **Resolved (RLS)** | Scoped policies + `can_read_pr1()` |
| **F2** | Global `approval_instances` UPDATE | **Resolved (RLS)** | Approver + procurement UPDATE only |
| **F3** | `rfq_suppliers` RLS off | **Resolved (RLS)** | RLS enabled; 7 policies active |
| **F7** | Global audit log read | **Resolved (RLS)** | Admin-only SELECT |
| **F8** | Warehouse validation scope | **Resolved (RLS)** | `can_read_warehouse_validation()` + warehouse-only write |

---

## 3. Regression & design risks (code review)

These are **not failures** of Phase 1 but items to validate in app smoke tests or later phases.

### 3.1 `can_read_pr1()` role matrix

| Role | Access path |
|------|-------------|
| Employee | Own `requisitioner_id` only |
| Warehouse | `pending_warehouse` **or** existing `warehouse_validations` row |
| Approver | PR1 with matching `approval_instances` (`document_type = 'PR1'`) |
| Procurement / Admin | Full read via `is_role()` |

**Note:** Demo “Director” accounts use **`approver`** role (`director@fortune.com`) — covered by approver path once an instance exists. No separate `director` app role.

### 3.2 Warehouse → approval instance INSERT

`lib/warehouse.ts` still **INSERTs** `approval_instances` on `insufficient` decision. Phase 1C did **not** restrict INSERT (only UPDATE). Policy `Authenticated users can insert approval instances` remains — **required** for this flow.

### 3.3 Approval UPDATE callers

Client `.update()` on `approval_instances` is limited to:

- `lib/approvals.ts` (PR1 — approver)
- `lib/pr2-approvals.ts` (procurement + approver)
- `lib/po-approvals.ts` (procurement + approver)

No admin `UPDATE` on instances found in `workflow-admin.ts`. **Aligns with 1C policies.**

### 3.4 Employee read of warehouse validations

`can_read_warehouse_validation()` allows **PR1 owners** to SELECT their validation — intentional for status visibility; employees still cannot INSERT (warehouse role only).

### 3.5 Empty PR1 dataset on live DB

Phase 0 noted **0 PR1 rows** on live DB. JWT isolation tests need seed data or creating two employee PR1s in UI.

---

## 4. Still open (out of Phase 1 scope)

| ID | Issue | Layer | Next phase |
|----|-------|-------|------------|
| **F4** | `/api/rfq/send-email`, bugtrack email routes — no session check | App | **2** |
| **F5** | Edge functions `create-user`, `reset-user-password`, `reset-demo-passwords` | Edge | **2** |
| **F6** | No `middleware.ts` | App | **3** |
| **F9** | Approver broad logistics RLS + open URLs | RLS + App | **3–4** |
| **F10** | Module visibility fail-open | App | **5** |
| **F11** | `/test-dashboard` | App | **7** |
| **F12** | `notifications` open INSERT | RLS | Later |

**Quick code check (unchanged since Phase 0):**

- No `middleware.ts` in repo root.
- `app/api/rfq/send-email/route.ts` — POST with no auth (Brevo send).
- `app/api/bugtrack/send-email/route.ts` — POST with no auth.

---

## 5. Manual smoke test matrix (required before Phase 2)

Use demo passwords from login page / `Fortune2024!` pattern. Log out between roles.

| # | User | Action | Expected |
|---|------|--------|----------|
| T1 | `employee@fortune.com` | List `/pr1` | Own PR1 only |
| T2 | Employee A vs B | Open other user’s `/pr1/[id]` if URL known | Empty / RLS error (not other user’s data) |
| T3 | `warehouse@fortune.com` | `/warehouse` queue | Loads `pending_warehouse` PR1s |
| T4 | Warehouse | Submit validation (sufficient + insufficient) | Saves; insufficient creates approval instance |
| T5 | `supervisor@fortune.com` or approver | Approve/reject PR1 in queue | Instance updates; PR1 status advances |
| T6 | `procurement@fortune.com` | PR2 phase approval path | Instance update works |
| T7 | Employee | `/admin/audit` or direct audit query | No rows / access denied in UI |
| T8 | `admin@fortune.com` | `/admin/audit` | Loads |
| T9 | Employee | Attempt warehouse validation save (devtools or UI) | INSERT blocked |
| T10 | Employee | RFQ supplier rows for own PR1 only | No other users’ RFQ supplier rows |
| T11 | `supplier@fortune.com` | Supplier portal RFQ rows | Own rows only |

Record pass/fail in the plan doc checkboxes (1A.3–1E.4) when complete.

---

## 6. Phase 2 readiness

| Prerequisite | Status |
|--------------|--------|
| Phase 1 migrations on remote | ✅ Verified via SQL |
| Legacy policies dropped | ✅ |
| Smoke tests T1–T11 | ⬜ **User/agent** |
| Product owner sign-off on D1–D6 | Assumed from plan |

**Green light for Phase 2** after smoke tests pass (or known failures are triaged). Phase 2 does not depend on smoke tests for *deployment safety of email endpoints* — those are currently **more critical** than another RLS pass because F4 is exploitable without login.

---

## 7. Artifacts

| File | Purpose |
|------|---------|
| `scripts/phase1-verify-rls.sql` | Re-run CLI checks |
| `supabase/migrations/20260604120000` … `120400` | Phase 1 migrations |
| This document | Post–Phase 1 audit record |
