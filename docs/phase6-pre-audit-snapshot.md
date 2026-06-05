# Phase 6 — Pre-Implementation Audit (Prices & Related Records)

**Audited:** 2026-06-04  
**Scope:** UI alignment with RLS intent (D4, D5) — **no code changes in this step**  
**Plan reference:** [`SECURITY_RBAC_IMPLEMENTATION_PLAN.md`](SECURITY_RBAC_IMPLEMENTATION_PLAN.md) Phase 6

---

## Executive summary

| Task | Verdict | Action for Phase 6 |
|------|---------|-------------------|
| **6.1** GRN procurement hide unit price | **Gap** (if policy = hide commercial data) | Implement column/total masking for `procurement` on detail + print |
| **6.2** RelatedRecords off for employee on PR1 | **Pass** | Confirm only — no change |
| **6.3** PR2 Director `canViewPrice` / `canViewCanvass` | **Pass** | Confirm only — already correct |
| **6.4** Employee PO prices on PR1 detail | **Pass** | Confirm only — no line prices on PR1 |

**Clarification needed for 6.1:** D5 says procurement GRN is **read-only** (write path) — that is already true. The plan also says “hide unit price … **if policy**.” Today procurement **can see** unit price, line amount, and “Total Received” on GRN. Decide whether D5 implies **hide prices** or only **disable edits**.

---

## Target decisions (Part 2)

| ID | Requirement | Audit note |
|----|-------------|------------|
| D4 | Director keeps canvass/prices on PR2 approval | UI + RLS aligned for **Director** position |
| D5 | Procurement GRN read-only | Write UI blocked; **prices still visible** |

---

## 6.1 — GRN detail & print (procurement read-only)

### Current UI (`app/grn/[id]/page.tsx`)

```typescript
const isWarehouse = profile?.role === 'warehouse';
const isReadOnly  = grn?.status === 'closed' || !isWarehouse;
```

| Role | Can edit received/qty | Sees Unit Price / Amount / Total Received |
|------|----------------------|-------------------------------------------|
| `warehouse` | Yes (open GRN) | Yes |
| `procurement` | No (`isReadOnly`) | **Yes** — lines 344–345, 327, 409–413 |
| `admin` | No | Yes |

### Print (`app/grn/[id]/print/page.tsx`)

- Always renders **Unit Price** and **Amount** columns (no role check).
- Protected by Phase 4 print layout + middleware (`warehouse` \| `procurement`).

### RLS (`20260424050818_grn_schema.sql`)

- Procurement: `SELECT` on `grn_receipts` / `grn_items` — full row including `unit_price`.
- No column-level masking at DB layer.

### Phase 6 recommendation (if hiding prices is confirmed)

1. Add `canViewGrnPricing(role)` in `lib/grn-access.ts` (or shared `lib/price-visibility.ts`): `warehouse` + `admin` only; `procurement` false.
2. GRN detail: conditionally hide price columns, row amounts, header “Total Received”.
3. GRN print: same helper for procurement sessions.
4. **No migration** unless product requires DB-level hide (not in current plan).

---

## 6.2 — RelatedRecords on PR1 (employee)

### `components/shared/RelatedRecords.tsx`

```typescript
function canViewRelatedRecords(role: AppRole): boolean {
  return role === 'approver' || role === 'procurement' || role === 'admin';
}
```

| Role | PR1 detail renders `<RelatedRecords>` | Visible / fetches chain |
|------|--------------------------------------|-------------------------|
| `employee` | Yes (JSX present) | **No** — returns `null` |
| `warehouse` | On GRN/delivery pages | **No** |
| `approver` | Yes | Yes |
| `procurement` | Yes | Yes |
| `supplier` | RFQ/PO pages | Filtered to RFQ + PO only |

**Verdict:** **Pass** — employees do not see related-record chain or extra document links on PR1.

### Other pages using RelatedRecords

| Page | Employee access (route) | RelatedRecords |
|------|-------------------------|----------------|
| `/pr1/[id]` | Own PR1 only (Phase 4H) | Hidden |
| `/delivery/[id]` | Allowed | Hidden |
| `/grn/*` | Blocked (Phase 3) | N/A |

---

## 6.3 — PR2 approval: Director price & canvass (D4)

### `app/approvals/pr2/[id]/page.tsx` (lines 171–172)

```typescript
const canViewPrice = profile?.role === 'procurement'
  || (profile?.role === 'approver' && profile?.position === 'Director');
const canViewCanvass = /* same */;
```

| Actor | Prices | Canvass matrix |
|-------|--------|----------------|
| `procurement` | Visible | Visible (when quotes exist) |
| `approver` + **Director** | Visible | Visible |
| `approver` + Supervisor / Dept Head / **Finance Director** | “Price Hidden” | Hidden |
| `employee` | N/A (route blocked) | N/A |

### RLS (Director quotes)

- `20260504111934_20260504_add_director_rfq_quotes_rls.sql` — Director can `SELECT` `rfq_item_quotes` for canvass UI.
- Preserved per plan “do not touch” list.

**Verdict:** **Pass** for D4 as implemented (Director only, not Finance Director).

**Watch item (out of scope unless product says otherwise):** `app/approvals/po/[id]/page.tsx` shows **all** line prices to any approver/procurement on PO approval — no `canViewPrice` gate. Not listed in Phase 6 tasks.

---

## 6.4 — Employee PO / price visibility on PR1

### `app/pr1/[id]/page.tsx`

- Items table columns: code, description, type, unit, SOH, qty, warehouse route — **no `unit_price` or PO totals**.
- Lifecycle labels (e.g. “PO — Sent”) via `fetchPR1LifecycleSummaries` — status only, not commercial amounts.

### Employee delivery path (D1)

- `/grn` blocked; `/delivery` allowed.
- `app/delivery/page.tsx` and `[id]/page.tsx` show **`grand_total`** (order-level), not line unit prices — acceptable for “delivery status” tracking.

**Verdict:** **Pass** — no PO line pricing on PR1 detail for employees.

---

## Cross-cutting gaps (inform Phase 6 / later)

| Area | Finding | In Phase 6? |
|------|---------|-------------|
| GRN list (`app/grn/page.tsx`) | No per-row pricing | OK |
| `app/po/[id]/page.tsx`, `app/pr2/[id]/page.tsx` | Full prices for procurement | Expected |
| `app/rfq/[id]/page.tsx` | Quote prices for procurement | Expected; route-gated |
| Supervisor PR2 approval | Price hidden | Expected |
| Procurement GRN print | Prices shown | Fix in **6.1** if policy requires |

---

## Proposed Phase 6 implementation (minimal)

| # | Work | Files (estimate) |
|---|------|------------------|
| 6.1a | `canViewGrnCommercialFields(role)` helper | `lib/grn-access.ts` (new) |
| 6.1b | Hide price columns + totals on GRN detail | `app/grn/[id]/page.tsx` |
| 6.1c | Hide price columns on GRN print | `app/grn/[id]/print/page.tsx` |
| 6.2 | Document confirm in plan checkbox | docs only |
| 6.3 | Document confirm | docs only |
| 6.4 | Document confirm | docs only |

**Optional:** Extract PR2 `canViewPrice` to `lib/price-visibility.ts` for reuse — only if worth deduplicating; not required for exit criteria.

---

## Exit criteria (after Phase 6)

| Test | Role | Expected |
|------|------|----------|
| GRN detail prices | `procurement@fortune.com` | Unit price / amount **hidden** (if 6.1 approved) |
| GRN detail edit | `procurement@fortune.com` | Still read-only |
| GRN detail prices | `warehouse@fortune.com` | Visible + editable |
| PR1 related docs | `employee@fortune.com` | No Related Records section |
| PR2 approval prices | `director@fortune.com` | Prices + canvass visible |
| PR2 approval prices | `supervisor@fortune.com` | Price Hidden |
| PR1 items | `employee@fortune.com` | No unit price columns |

---

## Recommendation

Proceed with Phase 6 implementation focused on **6.1** (procurement GRN price masking) unless you explicitly want procurement to **see** GRN commercial values for reconciliation — in that case, mark 6.1 as “no change” and document D5 as operational read-only only.

Tasks **6.2–6.4** are verification-only; no code changes expected.
