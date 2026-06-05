# Phase 3 — Pre-Implementation Audit

**Audited:** 2026-06-04  
**Scope:** Route middleware + `config/route-access.ts` (app layer only; RLS unchanged)

---

## Executive summary

| Area | Finding |
|------|---------|
| `middleware.ts` | **Missing** — direct URLs work for any logged-in role |
| Page-level role guards | **~12 routes** guarded; **~63 app pages** unguarded |
| `AppShell` | Session only — **no role check** |
| Sidebar (`ROLE_NAV`) | Hides links — **not security** |
| Session storage | **localStorage** via `@supabase/supabase-js` — middleware cannot read it without `@supabase/ssr` cookies |
| Phase 2 API routes | Protected with Bearer — **excluded** from middleware matcher |

**Phase 3 requires:** `@supabase/ssr` browser client (cookie sync) + middleware allow-list aligned to D1–D3.

---

## Target behavior (D1–D3) vs current gaps

| Decision | Violation today (example) |
|----------|---------------------------|
| D1 Employee no `/grn` | Employee can open `/grn` URL |
| D2 Approver no logistics lists | Approver can open `/grn`, `/po`, `/rfq`, `/delivery` |
| D3 Employee own PR1 only | Partial — `app/pr1/[id]` checks owner; list/middleware absent |

---

## Routes with existing page guards (keep as defense-in-depth)

| Route | Guard |
|-------|--------|
| `/pr1`, `/pr1/new` | `employee` |
| `/pr1/[id]` | employee owner or non-employee roles |
| `/warehouse/history` | `warehouse` |
| `/approvals/history` | `approver`, `procurement` |
| `/admin/**` (most pages) | `admin` |
| `/tsqa/**` | `tsqa`, `admin` |

**Unguarded high-risk:** `/grn`, `/warehouse`, `/rfq`, `/po`, `/pr2`, `/approvals/*` (except history), `/supplier/**`, `/delivery`, `/accreditation`.

---

## Planned middleware map (from implementation plan)

| Prefix | Allowed roles |
|--------|----------------|
| `/admin` | `admin` |
| `/warehouse` | `warehouse` |
| `/grn` | `warehouse`, `procurement` |
| `/rfq`, `/pr2`, `/po` | `procurement` |
| `/pr1` (list) | `employee` |
| `/pr1/*` (detail/edit/print) | `employee`, `warehouse`, `procurement`, `approver`, `admin` |
| `/pr1/new` | `employee` |
| `/approvals` | `approver`, `procurement` |
| `/accreditation` | `procurement`, `tsqa`, `admin` |
| `/supplier` | `supplier` |
| `/tsqa` | `tsqa`, `admin` |
| `/substitutes` | `employee` |
| `/delivery` | `employee`, `warehouse`, `procurement` |
| `/dashboard`, `/messages`, `/profile`, `/bugtrack` | all authenticated |
| `/test-dashboard`, `/test-filter` | **blocked** (production) |

**Admin bypass:** `admin` may access any route except `/supplier/*` and test pages.

**Public:** `/login`, `/forgot-password`, `/reset-password`, `/invite/complete`

---

## Phase 3 exit criteria (to verify after implementation)

| Test | Expected |
|------|----------|
| Employee GET `/grn` | Redirect → `/dashboard?access=denied` |
| Approver GET `/grn` | Redirect |
| Warehouse GET `/grn` | OK |
| Procurement GET `/grn` | OK |
| curl `/api/rfq/send-email` without auth | Still **401** (unchanged) |

---

## Implementation notes

1. Install `@supabase/ssr`; migrate `lib/supabase.ts` to `createBrowserClient` for cookie-backed sessions.
2. `middleware.ts` uses `createServerClient` + `config/route-access.ts`.
3. Phase 4 will add page-level `RequireRoles` — not in Phase 3 scope.
