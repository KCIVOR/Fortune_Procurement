# Phase 3 — Post-Implementation Snapshot

**Completed:** 2026-06-04

---

## Delivered

| Artifact | Purpose |
|----------|---------|
| `docs/phase3-pre-audit-snapshot.md` | Pre-implementation gap analysis |
| `config/route-access.ts` | Single allow-list (`ROUTE_ACCESS_RULES` + `evaluateRouteAccess`) |
| `middleware.ts` | Cookie session + role enforcement |
| `lib/supabase/middleware.ts` | `createServerClient` for middleware |
| `lib/supabase.ts` | `createBrowserClient` (`@supabase/ssr`) — cookie-backed sessions |
| `@supabase/ssr` dependency | Required for middleware auth |

---

## Behavior

| Case | Result |
|------|--------|
| No session on protected path | Redirect → `/login?redirect=…` |
| Wrong role | Redirect → `/dashboard?access=denied` |
| `admin` | Allowed on all routes **except** `/supplier/*` (no bypass) |
| Public paths | `/login`, `/forgot-password`, `/reset-password`, `/invite/complete` |
| Test pages | `/test-dashboard`, `/test-filter` → denied (always; extra block in production) |
| `/api/*` | **Excluded** from matcher (Phase 2 Bearer auth unchanged) |

---

## Manual verification (exit criteria)

| # | Role | URL | Expected |
|---|------|-----|----------|
| 1 | employee | `/grn` | Denied → dashboard |
| 2 | approver | `/grn` | Denied |
| 3 | warehouse | `/grn` | OK |
| 4 | procurement | `/grn` | OK |
| 5 | employee | `/rfq` | Denied |
| 6 | supplier | `/supplier/quotations` | OK |
| 7 | supplier | `/po` | Denied (procurement path) |
| 8 | Logged out | `/dashboard` | Login redirect |

**Note:** After deploy, sign out and sign in once so auth cookies sync (migration from localStorage-only sessions).

---

## Not in Phase 3 (Phase 4)

- Page-level `RequireRoles` / `use-require-roles`
- Employee `/pr1/[id]` owner check in middleware (RLS + existing page guard remain)
- Module visibility fail-closed (Phase 5)
