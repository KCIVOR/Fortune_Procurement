# External Vendor Notices — Implementation Plan

Adds an amber "External vendor" badge and contextual notices to every downstream
document (PO, PO Approval, PR2, PR2 Approval, GRN) so reviewers always know a
quote was entered manually by Procurement rather than submitted through the supplier
portal.

---

## Guiding principles

- **No new DB columns.** `supplier_id IS NULL` on `po_requests` / `deliveries`
  is the authoritative external-vendor signal on PO-side documents.
  `rfq_suppliers.is_external` is the authoritative signal on RFQ/PR2-side documents.
- **Data first, UI second.** Phases that need a new field in the query are split
  from the UI change so each phase compiles and runs independently.
- **Zero touch to existing logic paths.** Every change gates on the new field;
  the registered-supplier code path is left byte-for-byte identical.
- **Surgical edits.** Each phase touches the minimum number of files needed.

---

## Phase 1 — PO Detail page  *(pure UI — no data change)*

**Signal available:** `po.supplier_id === null` — already fetched by `fetchPOById`.

**Files touched:** `app/po/[id]/page.tsx` only.

### What to add

| Location | Change |
|---|---|
| Supplier field in the header card (line ~330) | Amber **External vendor** badge next to `po.supplier_name_snapshot` |
| Action/status area | Replace the standard "Mark as Ordered" section description with a short note: *"This PO is for an external vendor. Place the order directly, then click Mark as Ordered to trigger delivery tracking."* |

### Guard condition
```tsx
const isExternal = !po.supplier_id;
```

### Badge component (reuse across all phases)
```tsx
{isExternal && (
  <span className="inline-flex items-center gap-1 text-[10px] font-semibold
    text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
    <Store className="w-2.5 h-2.5" />
    External vendor
  </span>
)}
```

### Risk
None — `po.supplier_id` is already in scope; the condition can't affect the
registered-supplier rendering path.

---

## Phase 2 — GRN / Delivery Detail page  *(pure UI — no data change)*

**Signal available:** `delivery.supplier_id === null` — already in
`Delivery` type (`types/delivery.ts:33`) and mapped by `lib/delivery.ts:25`.

**Files touched:** `app/delivery/[id]/page.tsx` only.

### What to add

| Location | Change |
|---|---|
| Supplier field (line ~221) | Amber **External vendor** badge |
| Commitment date section (line ~282) | If `!delivery.supplier_id && !delivery.commitment_date`, show: *"No supplier commitment date — this delivery was created from a manually ordered PO."* |

### Guard condition
```tsx
const isExternal = !delivery.supplier_id;
```

### Risk
None — same pattern as Phase 1.

---

## Phase 3 — PO Approval page  *(requires type + lib + UI changes)*

**Problem:** `POApprovalDetail` type and `fetchPOApprovalDetail` query do **not**
expose `supplier_id`. It is selected on `po_requests` but excluded from the
mapped return value.

**Files touched (in order):**
1. `types/approvals.ts` — add field to type
2. `lib/po-approvals.ts` — add field to select + mapping
3. `app/approvals/po/[id]/page.tsx` — UI badge + acknowledgment section

### Step 3-A — `types/approvals.ts`

Find `POApprovalDetail` interface. Add after `supplier_name_snapshot`:
```ts
supplier_id:             string | null;
```

### Step 3-B — `lib/po-approvals.ts`

Two places:

**`fetchPOApprovalDetail` — main PO select (line ~142):**
```ts
// Before
.select('id, po_number, pr2_id, supplier_name_snapshot, ..., status')
// After — add supplier_id
.select('id, po_number, pr2_id, supplier_id, supplier_name_snapshot, ..., status')
```

**Both mapping sites (line ~194 and ~308) — add:**
```ts
supplier_id: po.supplier_id ?? null,
```

### Step 3-C — `app/approvals/po/[id]/page.tsx`

```tsx
const isExternal = !detail.supplier_id;
```

| Location | Change |
|---|---|
| Supplier field (line ~209) | Amber badge |
| Supplier Acknowledgment section (line ~389–545) | If `isExternal`: replace "Awaiting Supplier Acknowledgment" with *"External vendor — no portal account. Procurement marks this PO as ordered manually."* and hide the supplier step timeline row. If not external: unchanged. |

### Risk
`supplier_id` is a nullable column on `po_requests` — adding it to the select
cannot break existing rows. Both mapping sites must be updated together or the
TypeScript build will fail (type guards the completeness).

---

## Phase 4 — PR2 Detail page  *(requires query change + UI)*

**Problem:** The PR2 detail page fetches `rfq_suppliers` to check which supplier
profile IDs have pending POs, but only selects `id, supplier_id`. It does not
fetch `is_external`, so we cannot tell which items have an external vendor.

**Files touched:**
1. `app/pr2/[id]/page.tsx` — extend rfq_suppliers query + build lookup + badge

### Step 4-A — Extend rfq_suppliers query (line ~169)

```ts
// Before
.select('id, supplier_id')
// After
.select('id, supplier_id, is_external')
```

### Step 4-B — Build external supplier lookup

After the query result, add:
```ts
const externalRfqSupplierIds = new Set<string>(
  (rs ?? [])
    .filter((r: any) => r.is_external)
    .map((r: any) => r.id as string)
);
```

Store this in component state: `const [externalRfqIds, setExternalRfqIds] = useState(new Set<string>())`.

### Step 4-C — Badge on the items table (line ~636)

```tsx
const isExternal = item.selected_rfq_supplier_id
  ? externalRfqIds.has(item.selected_rfq_supplier_id)
  : false;

// In the supplier cell:
<p className="text-xs font-medium text-pq-neutral-900">
  {item.supplier_name_snapshot}
</p>
{isExternal && <ExternalVendorBadge />}
```

### Risk
Adding `is_external` to an existing select is additive. The `externalRfqIds` Set
is used only for the badge; the existing `uniqueProfileIds` / `pending` logic
(which already filters out null `supplier_id`) is not touched.

---

## Phase 5 — PR2 Approval page  *(requires query change + UI)*

**Problem:** The approval page fetches `rfq_item_quotes` joined to
`rfq_suppliers` for the comparison quote panel, but only pulls
`supplier_name_snapshot`. `is_external` is not fetched anywhere on this page.

**Files touched:**
1. `app/approvals/pr2/[id]/page.tsx` — extend join + derive isExternal + badge

### Step 5-A — Extend rfq_suppliers join (line ~86)

```ts
// Before
.select('pr1_item_id, unit_price, lead_time_days, rfq_supplier_id,
  rfq_suppliers!rfq_item_quotes_rfq_supplier_id_fkey(supplier_name_snapshot)')
// After
.select('pr1_item_id, unit_price, lead_time_days, rfq_supplier_id,
  rfq_suppliers!rfq_item_quotes_rfq_supplier_id_fkey(supplier_name_snapshot, is_external)')
```

### Step 5-B — Map `is_external` into the quotes state (line ~95–99)

```ts
// Existing
supplier: q.rfq_suppliers?.supplier_name_snapshot || 'Unknown',

// Add
is_external: q.rfq_suppliers?.is_external ?? false,
```

Also add `is_external: boolean` to the `quotesMap` value type.

### Step 5-C — Badge in items table supplier cell (line ~376) and
comparison quote rows (line ~397)

```tsx
// Supplier column — winning supplier
{item.supplier_name_snapshot}
{/* isExternal determined by checking quotesMap for this item's winning rfq_supplier_id */}

// Comparison panel — each competitor quote row
{q.supplier}
{q.is_external && <ExternalVendorBadge />}
```

### Risk
The join addition is additive. `is_external` defaults to `false` in the DB
(`DEFAULT false`), so old rows without the column value set will render cleanly.
The `quotesMap` type extension is caught by TypeScript — the build enforces
completeness before deploy.

---

## Shared badge component

To avoid duplicating the amber badge JSX across 5 files, consider extracting it
before Phase 1:

**`components/shared/ExternalVendorBadge.tsx`**
```tsx
import { Store } from 'lucide-react';

export default function ExternalVendorBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold
      text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
      <Store className="w-2.5 h-2.5 shrink-0" />
      External vendor
    </span>
  );
}
```

Import in all 5 pages. Zero logic — purely presentational.

---

## Execution order

| Phase | Risk | Query change | Type change | Files |
|---|---|---|---|---|
| Shared badge component | None | — | — | 1 new |
| 1 — PO Detail | None | ✗ | ✗ | 1 |
| 2 — GRN Detail | None | ✗ | ✗ | 1 |
| 3 — PO Approval | Low | `po_requests` select | `POApprovalDetail` | 3 |
| 4 — PR2 Detail | Low | `rfq_suppliers` select | — | 1 |
| 5 — PR2 Approval | Low | rfq_suppliers join | `quotesMap` local type | 1 |

Run `npx tsc --noEmit` after each phase before moving to the next.
