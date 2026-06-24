# Supplier Services — Implementation Plan

This document covers the implementation of **Service Offerings** in the supplier product catalog (Option B). The previous plan (`service-request-type-plan.md`) handled Phases 1–6 of PR1-level `request_type` support, which is fully complete. This plan picks up from there and extends services support through the **supplier catalog → RFQ/canvassing → quotation** flow.

---

## Audit Key Findings

Before reading the phases, understand what the audit confirmed:

### What Does NOT Need to Change

| Concern | Why No Change Needed |
|---------|----------------------|
| `rfq_batches.request_type` | `RfqDetailView.pr1.request_type` is already available via PR1 join in `fetchRfqDetail()`. No column needed on `rfq_batches`. |
| `pr2_requests.request_type` | Already fetched from `pr1_requests` at read-time in `lib/pr2.ts:91`. Type definition already has `request_type` field. No migration needed. |
| `saveItemSelection()` justification | Raw-material justification only triggers when `pr1_item.is_raw_material === true`. Service PR1 items are never raw materials → no justification required. Already correct. |
| Accreditation flow | Company-level, not product-level. Works unchanged for service suppliers. |
| Warehouse validation | Client confirmed: services go through same validation. Warehouse enters SOH = 0 manually. |
| GRN / Delivery | No change. Handles services identically to goods. |

### What Does Change (Minimum Viable Set)

1. `supplier_products` table — add `item_type` column
2. TypeScript types — 3 files
3. Supplier portal — product form (new + edit/view), product list
4. `lib/supplier-products.ts` — function signatures
5. Procurement product review — service verification bypass (no RSE/TSQA for services)
6. Canvassing — supplier capability display + optional filtering
7. Supplier quotation form — service-aware field labels

---

## Architecture: Option B

Single `item_type` column on the existing `supplier_products` table. No new table.

```
supplier_products
├── item_type = 'goods'     ← physical products (existing behavior)
└── item_type = 'services'  ← service offerings (new)
```

The form branches field labels based on `item_type`. Same columns, different presentation:

| Column | Goods Label | Services Label |
|--------|------------|----------------|
| `product_name` | Product Name | Service Name |
| `product_code` | Product Code / SKU | *(hidden)* |
| `category` | Category | Service Category |
| `description` | Description | Scope of Service |
| `specifications` | Specifications | Terms & Conditions / SLA |

---

## Phase 1 — Database Migration

**File to create:** `supabase/migrations/20260624180000_supplier_products_add_item_type.sql`

```sql
-- Add item_type to supplier_products
-- DEFAULT 'goods' ensures all existing products are backward-compatible
ALTER TABLE public.supplier_products
  ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'goods'
    CHECK (item_type IN ('goods', 'services'));

-- Index for filtering in canvassing supplier assignment
CREATE INDEX IF NOT EXISTS idx_supplier_products_item_type
  ON public.supplier_products (item_type);

-- Backfill: explicit (redundant with DEFAULT but documents intent)
UPDATE public.supplier_products
  SET item_type = 'goods'
  WHERE item_type IS NULL;
```

**Safety:** Pure additive migration. DEFAULT 'goods' means zero code changes are required before deployment — existing queries that omit `item_type` still work.

---

## Phase 2 — TypeScript Types

**3 files to update.**

### 2a. `types/database.ts`

Find the `supplier_products` row type (around line 532–589). Add `item_type` after `specifications`:

```typescript
// Before:
specifications: string | null;
status: 'draft' | 'submitted' | ...

// After:
specifications: string | null;
item_type: 'goods' | 'services';   // ← add this line
status: 'draft' | 'submitted' | ...
```

### 2b. `lib/supplier-products.ts`

Find `SupplierProductInput` interface (lines 42–49). Add `item_type`:

```typescript
export interface SupplierProductInput {
  product_name:     string;
  product_code?:    string | null;
  category?:        string | null;
  description?:     string | null;
  specifications?:  string | null;
  accreditation_id?: string | null;
  item_type?:       'goods' | 'services';   // ← add
}
```

### 2c. `types/canvassing.ts`

Find `CatalogProductSummary` (lines 144–149). Add `item_type`:

```typescript
export interface CatalogProductSummary {
  product_name: string;
  product_code: string | null;
  status:       string;
  item_type:    'goods' | 'services';   // ← add
}
```

---

## Phase 3 — `lib/supplier-products.ts` Functions

### 3a. `createSupplierProduct()`

Read the current insert payload. Add `item_type` to the object being inserted:

```typescript
// In the insert payload, add:
item_type: input.item_type ?? 'goods',
```

### 3b. `updateSupplierProduct()`

Add `item_type` to the update payload (only when it's in the input):

```typescript
// In the update payload, add:
...(input.item_type !== undefined && { item_type: input.item_type }),
```

### 3c. Product fetch queries

Find any `SELECT` query on `supplier_products` that lists specific columns. Add `item_type` to those select strings so the column is returned.

---

## Phase 4 — Supplier Portal: Add Product Form

**File:** `app/supplier/products/new/page.tsx`

### 4a. Form state

Add `item_type` to the form state (lines ~16–22):

```typescript
const [form, setForm] = useState({
  item_type:      'goods' as 'goods' | 'services',   // ← add
  product_name:   '',
  product_code:   '',
  category:       '',
  description:    '',
  specifications: '',
});
```

### 4b. Type toggle — add at top of form (before Product Name)

```tsx
{/* Type Toggle */}
<div>
  <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
    Offering Type
  </label>
  <div className="flex rounded-md border border-pq-neutral-200 overflow-hidden w-fit">
    {(['goods', 'services'] as const).map(t => (
      <button
        key={t}
        type="button"
        onClick={() => setForm(f => ({ ...f, item_type: t }))}
        className={`px-4 py-2 text-sm font-medium transition ${
          form.item_type === t
            ? 'bg-pq-primary-600 text-white'
            : 'bg-white text-pq-neutral-500 hover:bg-pq-neutral-50'
        }`}
      >
        {t === 'goods' ? 'Goods' : 'Services'}
      </button>
    ))}
  </div>
</div>
```

### 4c. Dynamic field labels

The fields below the toggle change labels based on `item_type`:

- **Product Name field label:** `form.item_type === 'services' ? 'Service Name' : 'Product Name'`
- **Product Code field:** hide entirely when `form.item_type === 'services'` (wrap in `{form.item_type === 'goods' && (…)}`)
- **Category placeholder:** `form.item_type === 'services' ? 'e.g. Maintenance, Consulting, Security' : 'e.g. Chemicals, Reagents'`
- **Description label:** `form.item_type === 'services' ? 'Scope of Service' : 'Description'`
- **Specifications label:** `form.item_type === 'services' ? 'Terms & Conditions / SLA' : 'Specifications'`
- **Specifications placeholder:** `form.item_type === 'services' ? 'SLA, billing model, coverage period, support hours...' : 'Dimensions, tolerances, certifications...'`

### 4d. Submit payload

Pass `item_type` to `createSupplierProduct()`:

```typescript
await createSupplierProduct({
  ...form,
  item_type: form.item_type,
  accreditation_id: ...,
});
```

---

## Phase 5 — Supplier Portal: Edit/View Product Page

**File:** `app/supplier/products/[id]/page.tsx`

### 5a. `ProductForm` interface (lines ~97–103)

```typescript
interface ProductForm {
  item_type:      'goods' | 'services';   // ← add
  product_name:   string;
  product_code:   string;
  category:       string;
  description:    string;
  specifications: string;
}
```

### 5b. Initialize edit form

When populating the edit form from fetched product data, map `item_type`:

```typescript
setEditForm({
  item_type:      product.item_type ?? 'goods',   // ← add
  product_name:   product.product_name,
  ...
});
```

### 5c. Edit mode (lines ~374–431)

Add the same type toggle and dynamic labels as Phase 4 into the edit mode block. The toggle should be **read-only / disabled** once the product is no longer a draft (status !== 'draft') — you can't change offering type after submission.

### 5d. Read-only view (lines ~445–456)

Add an item type badge in the read-only display:

```tsx
<div>
  <p className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1">Type</p>
  <span className={`inline-flex text-xs font-semibold border rounded-full px-2 py-0.5 ${
    product.item_type === 'services'
      ? 'bg-purple-50 text-purple-700 border-purple-200'
      : 'bg-blue-50 text-blue-700 border-blue-200'
  }`}>
    {product.item_type === 'services' ? 'Services' : 'Goods'}
  </span>
</div>
```

---

## Phase 6 — Supplier Portal: Product List

**File:** `app/supplier/products/page.tsx`

Add an **item type badge** column in the product list table alongside the existing `product_name`, `product_code`, `category`, `status chip` row.

```tsx
{/* In table header */}
<th>Type</th>

{/* In table row */}
<td>
  <span className={`inline-flex text-xs font-semibold border rounded-full px-2 py-0.5 ${
    product.item_type === 'services'
      ? 'bg-purple-50 text-purple-700 border-purple-200'
      : 'bg-blue-50 text-blue-700 border-blue-200'
  }`}>
    {product.item_type === 'services' ? 'Services' : 'Goods'}
  </span>
</td>
```

---

## Phase 7 — Procurement: Service Verification Bypass

**Files to read first:** `app/accreditation/products/page.tsx`, `app/accreditation/products/[id]/page.tsx`

### The problem

The current status path for products is:
```
draft → submitted → under_review → pending_tsqa → verified
```

For **goods**: procurement creates an RSE record → TSQA reviews → passes → procurement marks verified. This requires physical inspection.

For **services**: there is no physical product to test. Procurement should be able to mark a service offering as **verified directly** after reviewing the supplier's credentials and service documentation — without creating an RSE/TSQA record.

### The change

In `app/accreditation/products/[id]/page.tsx` (the procurement product review detail page):

1. Read `product.item_type` from the fetched product data.
2. When `item_type === 'services'` and status is `under_review`:
   - **Hide** the "Create RSE / Send to TSQA" button
   - **Show** a "Verify Service Offering" button instead
   - That button calls a lib function that sets `supplier_products.status = 'verified'` directly, skipping `pending_tsqa`

In `lib/supplier-products.ts`, add:

```typescript
export async function verifyServiceOfferingDirectly(
  productId: string,
  reviewNotes: string,
  profile: UserProfile
): Promise<void> {
  // Guard: only for services
  const { data: product } = await db
    .from('supplier_products')
    .select('item_type, status')
    .eq('id', productId)
    .single();

  if (product?.item_type !== 'services') {
    throw new Error('Direct verification is only available for service offerings.');
  }

  await db.from('supplier_products').update({
    status:       'verified',
    reviewed_by:  profile.id,
    review_notes: reviewNotes,
    reviewed_at:  new Date().toISOString(),
    verified_at:  new Date().toISOString(),
  }).eq('id', productId);
}
```

**Why surgical:** The existing RSE creation path is completely untouched. The new button only renders when `item_type === 'services'`. Goods products follow the exact same RSE/TSQA flow as before.

---

## Phase 8 — Canvassing: Supplier Capability Display

**Files:** `lib/canvassing.ts`, `app/rfq/[id]/page.tsx`

### The problem

`CanvassSupplierCandidate.verified_product_count` currently aggregates all products (goods + services) into one count. When procurement views the supplier assignment modal for a **services RFQ**, they see counts that mix goods and service offerings — no way to know if the supplier actually provides the needed type.

### 8a. Split counts in `lib/canvassing.ts`

Find the enrichment block (lines ~444–497) where product counts are built per supplier. Currently counts all products together. Change to split by `item_type`:

**Read the product fetch query** — add `item_type` to the select string:
```typescript
.select('supplier_id, status, item_type')
```

**Build split counts in the loop:**
```typescript
// Instead of / in addition to:
if (st === 'verified') bucket.v++;

// Track by type:
if (st === 'verified' && p.item_type === 'goods')    bucket.verified_goods++;
if (st === 'verified' && p.item_type === 'services') bucket.verified_services++;
```

### 8b. Update `CanvassSupplierCandidate` type (types/canvassing.ts)

```typescript
export interface CanvassSupplierCandidate {
  id:                         string;
  full_name:                  string;
  email:                      string | null;
  accreditation_status:       string | null;
  verified_product_count:     number;   // total (goods + services) — keep for backward compat
  verified_goods_count:       number;   // ← new
  verified_service_count:     number;   // ← new
  pending_product_count:      number;
  rejected_product_count:     number;
  withdrawn_product_count:    number;
}
```

### 8c. RFQ detail page supplier assignment modal (`app/rfq/[id]/page.tsx`)

In the supplier assignment UI, when rendering each candidate supplier:

- If the RFQ's `detail.pr1.request_type === 'services'`:
  - Show `verified_service_count` as the primary readiness indicator
  - Show a warning badge if `verified_service_count === 0` ("No verified service offerings")
- If `request_type === 'goods'`:
  - Show `verified_goods_count` as before

This gives procurement **relevant** supplier readiness data per request type.

---

## Phase 9 — Supplier Quotation Form: Service-Aware Labels

**File:** `app/supplier/quotations/[rfqSupplierId]/page.tsx`

### The problem

When a supplier opens a quotation for a services RFQ, they see product-centric field labels: "Product Code", "Specifications", "Lead Time (days)". These don't make sense for a service offering.

### The change

Read `rfqSupplierId` → fetch the RFQ → check `rfq.pr1.request_type`. When it's `'services'`:

- Product picker label: `'Service Offering'` instead of `'Product'`
- "Lead Time (days)" label: `'Estimated Start (days)'` or hide if not applicable
- Notes/remarks placeholder: `'Describe scope, billing terms, SLA, coverage period...'` instead of product-focused text

**Why surgical:** Only label changes and placeholder text. No structural changes to the quotation model — `rfq_item_quotes` schema stays identical. The quote still saves `unit_price`, `lead_time_days`, and optionally `supplier_product_id` (pointing to a service-type product).

---

## Phase 10 — Canvassing: `productLookup` Enrichment

**File:** `lib/canvassing.ts` — `fetchRfqDetail()` function

The `productLookup` map is built from supplier products linked in quotes. It currently returns `{ product_name, product_code, status }`. Add `item_type` so the quote matrix UI can show the right badge.

Find the query that builds `productLookup` (around lines 519–539). Add `item_type` to the SELECT:

```typescript
.select('id, product_name, product_code, status, item_type')
```

And in the map:
```typescript
productLookup[p.id] = {
  product_name: p.product_name,
  product_code: p.product_code,
  status:       p.status,
  item_type:    p.item_type,   // ← add
};
```

This allows `buildQuoteMatrix()` to show a "Services" badge on service-type quotes in the canvassing evaluation table.

---

## Implementation Order & Dependencies

```
Phase 1  (DB Migration)
    ↓
Phase 2  (TypeScript Types)
    ↓
Phase 3  (lib/supplier-products.ts)
    ↓
Phase 4  (Supplier: New Product Form)
Phase 5  (Supplier: Edit/View Product)    ← parallel with Phase 4
Phase 6  (Supplier: Product List)          ← parallel with Phase 4
    ↓
Phase 7  (Procurement: Service Verification)
    ↓
Phase 8  (Canvassing: Supplier Filtering)
Phase 9  (Quotation Form Labels)           ← parallel with Phase 8
Phase 10 (productLookup Enrichment)        ← parallel with Phase 8
```

---

## File Change Matrix

| File | Phase | Change Type | Risk |
|------|-------|-------------|------|
| `supabase/migrations/[new].sql` | 1 | New file | None — additive |
| `types/database.ts` | 2a | Add field to interface | None |
| `lib/supplier-products.ts` | 2b, 3 | Add field + update functions | Low |
| `types/canvassing.ts` | 2c, 8b | Add fields to interfaces | None |
| `app/supplier/products/new/page.tsx` | 4 | Add toggle + conditional labels | Low |
| `app/supplier/products/[id]/page.tsx` | 5 | Add toggle + badge in view | Low |
| `app/supplier/products/page.tsx` | 6 | Add badge column | None |
| `app/accreditation/products/[id]/page.tsx` | 7 | Conditional verify button | Low |
| `lib/canvassing.ts` | 8a, 10 | Split counts + enrich lookup | Medium — read carefully |
| `app/rfq/[id]/page.tsx` | 8c | Conditional supplier badge | Low |
| `app/supplier/quotations/[rfqSupplierId]/page.tsx` | 9 | Label changes only | Low |

---

## Zero Breaking Change Guarantee

- `DEFAULT 'goods'` on the new column means all existing supplier products are automatically Goods — no data loss, no backfill script needed beyond the idempotent `UPDATE`.
- All existing code that reads `supplier_products` without `item_type` in the SELECT continues to work.
- The RSE/TSQA flow for goods is completely untouched — the new verify button only renders for `item_type === 'services'`.
- `verified_product_count` is kept on `CanvassSupplierCandidate` (backward compat) — we add `verified_goods_count` and `verified_service_count` as additional fields.
- No approval workflow changes. No RLS changes. No existing query breakage.
