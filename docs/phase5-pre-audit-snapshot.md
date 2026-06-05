# Phase 5 — Pre-Implementation Audit (Module Visibility)

**Audited:** 2026-06-04  
**Finding ID:** F10 (fail-open on error/loading)

---

## Executive summary

| Check | Current behavior | Risk |
|-------|------------------|------|
| Fetch **error** | `setRules([])` + log "failing open" | **High** — empty rules = all modules **visible** (`getRoleDefaultVisibility` defaults `true`) |
| **Loading** (`rules === null`) | `isModuleVisible` returns **`true`** for all keys | **Medium** — dashboards mostly use `rulesLoading` skeletons; hook itself is fail-open |
| Sidebar loading | Returns `navItems = null` (skeleton) | OK |
| Sidebar after error | Would use `rules=[]` → **full ROLE_NAV visible** | **High** |
| Route security | Middleware + AppShell (Phase 3–4) | OK — visibility is UX only per migration comment |
| DB table purpose | `role_position_module_visibility` — sidebar only, not routes | Documented in migration |

**Phase 5 goal:** Fail-**closed** on load/error — only `dashboard` module visible until rules load successfully.

---

## Code paths audited

### `hooks/use-module-visibility.ts` (F10 root cause)

```typescript
// Line 52: while loading, ALL modules reported visible
if (rules === null) return true;

// Line 41: on error, empty array → same as "no hide rules" → ALL visible
if (!cancelled) setRules([]);
```

### `lib/module-visibility.ts`

- `getRoleDefaultVisibility()` — no rule row → **`return true`**
- Empty `rules[]` therefore means **show everything** (intentional for "no admin overrides")

### Consumers

| Consumer | Loading handling | Error handling today |
|----------|------------------|---------------------|
| `Sidebar.tsx` | `rulesLoading \|\| rules === null` → skeleton | Would fail-open if `rules=[]` |
| `ProcurementDashboard.tsx` | `rulesLoading` skeleton | Would show all KPIs after error |
| `WarehouseDashboard.tsx` | same | same |
| `EmployeeDashboard.tsx` | same | same |
| `ApproverDashboard.tsx` | same | same |
| `SupplierDashboard.tsx` | same | same |

---

## Module key ↔ route alignment (D6 / task 5.3)

| Module key | Nav href | `route-access.ts` prefix |
|------------|----------|--------------------------|
| `goods_receipt` | `/grn` | `/grn` |
| `warehouse_validation` | `/warehouse` | `/warehouse` |
| `canvassing_rfq` | `/rfq` | `/rfq` |
| `purchase_requests` | `/pr2` | `/pr2` |
| `purchase_orders` | `/po` | `/po` |
| `my_requests` | `/pr1` | `/pr1` (exact list) |
| `approval_queue` | `/approvals` | `/approvals` |

**Note:** Module visibility can **hide** nav items but must not **grant** route access. Phases 3–4 enforce routes; Phase 5 prevents misleading nav when rules cannot be loaded.

---

## Planned changes (Phase 5)

1. `useModuleVisibility` — tri-state: `loading` | `ready` | `error`
2. `isModuleVisible` — `false` except `dashboard` when loading or error
3. `Sidebar` — on error, show **dashboard only** (not full nav)
4. `config/module-route-map.ts` + docs cross-link to `route-access.ts`

---

## Exit criteria (manual)

Simulate fetch failure (offline / block `role_position_module_visibility` in DevTools):

- Procurement sidebar hides RFQ, PO, PR2, etc. — **dashboard only**
- Procurement dashboard hides procurement KPI bands
