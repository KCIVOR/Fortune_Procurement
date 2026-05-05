# Supplier Relationship Audit - rfq_item_quotes

**Date:** 2026-05-04  
**Status:** Audit Complete - Ready for Implementation

---

## Error Identified

```
PGRST200: Could not find a relationship between 
  rfq_item_quotes and supplier_item_selections
```

## Root Cause

The current query attempts to use `supplier_item_selections` as a nested object:

```typescript
.select('pr1_item_id, supplier_item_selections(supplier_name), unit_price, lead_time_days')
```

However:
- `rfq_item_quotes` does NOT have a direct FK to `supplier_item_selections`
- `supplier_item_selections` is a selection **tracking table**, not a supplier data table
- The relationship path is incorrect for fetching canvass quote supplier names

---

## Correct Relationship Path

### Table Structure

**rfq_item_quotes**
- `id` (PK)
- `rfq_supplier_id` (FK → rfq_suppliers.id) ← **KEY**
- `pr1_item_id`
- `unit_price`
- `lead_time_days`

**rfq_suppliers** (Supplier data source)
- `id` (PK)
- `supplier_name_snapshot` ← **TARGET COLUMN**

**supplier_item_selections** (Selection tracking - not relevant)
- `selected_rfq_supplier_id` (FK → rfq_suppliers.id)
- Used for approval workflow, not canvass display

### Foreign Key Reference

```
rfq_item_quotes.rfq_supplier_id 
  ↓ (FK constraint: rfq_item_quotes_rfq_supplier_id_fkey)
rfq_suppliers.id
  ↓ (Column: supplier_name_snapshot)
Supplier Name
```

---

## Correct Query Syntax

### Option A: Using PostgREST Relationship (Recommended)

```typescript
const { data: quotes, error: quotesErr } = await (supabase as any)
  .from('rfq_item_quotes')
  .select(`
    pr1_item_id,
    unit_price,
    lead_time_days,
    rfq_supplier_id,
    rfq_suppliers!rfq_item_quotes_rfq_supplier_id_fkey(supplier_name_snapshot)
  `)
  .in('pr1_item_id', pr1ItemIds);
```

**Key:** `rfq_suppliers!rfq_item_quotes_rfq_supplier_id_fkey`
- Tells Supabase to follow the FK constraint
- Returns nested `rfq_suppliers` object with `supplier_name_snapshot`

### Option B: Separate Queries (Guaranteed Compatibility)

```typescript
// Step 1: Fetch quotes
const { data: quotes, error: quotesErr } = await (supabase as any)
  .from('rfq_item_quotes')
  .select('pr1_item_id, rfq_supplier_id, unit_price, lead_time_days')
  .in('pr1_item_id', pr1ItemIds);

if (!quotesErr && quotes && quotes.length > 0) {
  // Step 2: Extract unique supplier IDs
  const supplierIds = Array.from(new Set(
    quotes.map((q: any) => q.rfq_supplier_id)
  ));

  // Step 3: Fetch supplier names
  const { data: suppliers } = await (supabase as any)
    .from('rfq_suppliers')
    .select('id, supplier_name_snapshot')
    .in('id', supplierIds);

  // Step 4: Create name map
  const supplierMap = Object.fromEntries(
    (suppliers ?? []).map((s: any) => [s.id, s.supplier_name_snapshot])
  );

  // Step 5: Enrich quotes
  quotes.forEach((q: any) => {
    q.supplier_name = supplierMap[q.rfq_supplier_id] || 'Unknown';
  });
}
```

Then update mapping from:
```typescript
supplier: q.supplier_item_selections?.supplier_name || 'Unknown'
```

To:
```typescript
supplier: q.supplier_name || 'Unknown'
```

---

## Existing Working Pattern

Reference implementation in **lib/pr2.ts** (lines 105-120):

```typescript
// Fetch all quotes for winning suppliers
const { data: quotes } = await db
  .from('rfq_item_quotes')
  .select('rfq_supplier_id, pr1_item_id, quoted_description, is_alternative, unit_price, lead_time_days, remarks')
  .in('rfq_supplier_id', winningSupplierIds);

// Fetch rfq_supplier names
const { data: rfqSuppliers } = await db
  .from('rfq_suppliers')
  .select('id, supplier_name_snapshot')
  .in('id', winningSupplierIds);

// Map supplier names
const supplierNameMap = Object.fromEntries(
  rfqSuppliers.map(rs => [rs.id, rs.supplier_name_snapshot])
);
```

This pattern uses **Option B** and is proven working in production.

---

## Why supplier_item_selections Doesn't Work

| Aspect | supplier_item_selections | rfq_suppliers |
|--------|--------------------------|---------------|
| **Purpose** | Track which supplier was selected | Store supplier quote data |
| **Related to rfq_item_quotes** | No direct FK | YES - via rfq_supplier_id |
| **Contains supplier names** | No | YES - supplier_name_snapshot |
| **Use case** | Approval workflow tracking | Canvass display |

For PR2 approval canvass:
- Need **ALL quotes** (for comparison, not just selected)
- Must show supplier names from the quote submission
- Must use `rfq_item_quotes → rfq_suppliers` relationship

---

## Minimum Fix Summary

| Item | Details |
|------|---------|
| **File** | app/approvals/pr2/[id]/page.tsx |
| **Lines** | 66-74 (quotes query) |
| **Exact FK Column** | `rfq_supplier_id` |
| **Target Table** | `rfq_suppliers` |
| **Target Column** | `supplier_name_snapshot` |
| **FK Constraint Name** | `rfq_item_quotes_rfq_supplier_id_fkey` |
| **Implementation** | Option A (relationship) or Option B (separate queries) |

---

## Recommendation

**Use Option A (PostgREST Relationship)** because:
1. Single query (more efficient)
2. Matches Supabase PostgREST conventions
3. Cleaner code with nested object
4. Better performance (one round trip)

**Fallback to Option B** if:
1. PostgREST relationship not supported
2. Query returns error "relationship not found"
3. Need maximum compatibility

---

## Next Steps

1. Apply chosen fix to app/approvals/pr2/[id]/page.tsx
2. Update quote mapping logic to use supplier name
3. Test with browser console logs
4. Verify canvass section displays
5. Remove temporary debug logs

---

## Appendix: Table Relationships Diagram

```
rfq_batches (RFQ Batch)
  │
  ├─→ rfq_suppliers (Multiple suppliers invited to quote)
  │   │
  │   └─→ rfq_item_quotes (All quotes from each supplier)
  │       │ ← Current query location
  │       └─ Contains: unit_price, lead_time_days
  │       └─ References: rfq_supplier_id → rfq_suppliers.id
  │
  └─→ supplier_item_selections (Approval tracking)
      ├─ Records which supplier was chosen
      └─ Not used for canvass display
```

**Path for canvass display:**
```
rfq_item_quotes 
  ├─ rfq_supplier_id
  └─→ rfq_suppliers(supplier_name_snapshot)
```
