# Phase 7 — Post-audit snapshot

**Date:** June 4, 2026  
**Scope:** Dev test-route gating, static route-matrix verification, build/typecheck

---

## 7.1 Test pages (`/test-dashboard`, `/test-filter`)

| Control | Status |
|---------|--------|
| `isProductionBlockedPath()` in middleware | ✅ Redirects to `/dashboard?access=denied` in production |
| Server `layout.tsx` on each test route | ✅ `notFound()` in production (defense in depth) |
| Development access | ✅ Authenticated users only (no longer `kind: 'blocked'` in `ROUTE_ACCESS_RULES`) |

---

## 7.2 Route matrix (code-verified via `config/route-access.ts` + Director bypass)

Legend: **Allow** = role passes `isRoleAllowedForPath`; **Deny** = redirect; **Director** = approver + position `Director` only.

| URL | Employee | Warehouse | Procurement | Approver (non-Director) | Director | Supplier | Admin |
|-----|----------|-----------|-------------|-------------------------|----------|----------|-------|
| `/pr1` (list) | Allow | Deny | Deny | Deny | Deny | Deny | Allow |
| `/pr1/{id}` | Own* | Allow | Allow | Allow | Allow | Deny | Allow |
| `/warehouse` | Deny | Allow | Deny | Deny | Deny | Deny | Allow |
| `/grn` | Deny | Allow | Allow | Deny | **Allow** | Deny | Allow |
| `/rfq`, `/pr2`, `/po` | Deny | Deny | Allow | Deny | **Allow** | Deny | Allow |
| `/delivery` | Allow | Allow | Allow | Deny | **Allow** | Deny | Allow |
| `/approvals/*` | Deny | Deny | Allow | Allow | Allow | Deny | Allow |
| `/supplier/quotations` | Deny | Deny | Deny | Deny | Deny | Allow | Deny |
| `/admin/users` | Deny | Deny | Deny | Deny | Deny | Deny | Allow |
| `/api/rfq/send-email` | Deny | Deny | Allow† | Deny | Deny | Deny | Deny‡ |

\* Employee cross-user PR1 blocked in page guard (Phase 4), not middleware alone.  
† `requireApiAuth(req, ['procurement'])` in `app/api/rfq/send-email/route.ts`.  
‡ Admin API bypass not enabled on this route by design.

**Commercial prices (D7):** Hidden for warehouse, employee, non-Director approvers on GRN/PO/PR2/RFQ/delivery UI.

---

## 7.3 Build verification

Run locally:

```bash
npm run typecheck
npm run build
```

| Command | Result (June 4, 2026) |
|---------|------------------------|
| `npm run typecheck` | ✅ Exit 0 |
| `npm run build` | ✅ Exit 0 (Supabase edge warnings only) |

---

## Manual smoke (recommended)

| Account | Check |
|---------|--------|
| `warehouse@fortune.com` | `/grn` OK; GRN detail shows "Price hidden" |
| `director@fortune.com` | `/grn`, `/rfq` OK; PR2 approval shows amounts |
| `supervisor@fortune.com` | `/grn` denied; `/approvals/pr2` OK without prices |
| Production deploy | `/test-dashboard` → 404 or access denied |
