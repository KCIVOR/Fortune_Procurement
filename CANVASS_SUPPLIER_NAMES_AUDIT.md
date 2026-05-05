# Canvass Supplier Names Audit - Root Cause Analysis

**Date:** 2026-05-04  
**Issue:** Other Supplier Quotes show "Unknown" instead of supplier names  
**Status:** Root cause identified, audit complete

---

## Symptom

PR2 approval page displays canvass quotes but all supplier names show as "Unknown":

```
Other Supplier Quotes:
  ├─ Unknown - $50.00 - Lead time: 5 days
  ├─ Unknown - $48.00 - Lead time: 7 days
  └─ Unknown - $45.00 - Lead time: 3 days
```

Expected: Actual supplier names (ABC Corp, XYZ Ltd, etc.)

---

## Data Layer Verification

### rfq_suppliers Table

| Metric | Value | Status |
|--------|-------|--------|
| Total suppliers | 63 | ✓ |
| With supplier_name_snapshot | 63 (100%) | ✓ |
| Empty names | 0 | ✓ |
| Database integrity | All data present | ✓ |

**Conclusion:** All supplier names exist in the database.

### rfq_item_quotes Access

| Item | Status |
|------|--------|
| Director RLS policy exists | ✓ |
| Director can read quotes | ✓ |
| Total quotes in system | 52 |
| Valid rfq_supplier_id FKs | ✓ |

**Conclusion:** Director can successfully read rfq_item_quotes.

---

## Root Cause: Missing RLS Policy on rfq_suppliers

### RLS Policies on rfq_suppliers

**Current policies (SELECT only):**

1. "Procurement can select rfq_suppliers"
   - Condition: `role = 'procurement'`
   - Who can access: Procurement team

2. "Requestors can view rfq_suppliers for their own PR1s"
   - Condition: `is_own_rfq_supplier(id)`
   - Who can access: Requestors viewing their own RFQs

3. "Suppliers can view own rfq_suppliers rows"
   - Condition: `supplier_id = auth.uid()`
   - Who can access: Individual suppliers

**Missing policy:**

```
"Directors can view all rfq_suppliers"  ← NOT CREATED
  - Condition: role = 'approver' AND position = 'Director'
```

**Result:** Director has NO SELECT permission on rfq_suppliers table.

---

## Data Flow Analysis: Why "Unknown" Appears

### Step 1: Query rfq_item_quotes

```typescript
.from('rfq_item_quotes')
.select('pr1_item_id, unit_price, lead_time_days, rfq_supplier_id, 
         rfq_suppliers!rfq_item_quotes_rfq_supplier_id_fkey(supplier_name_snapshot)')
.in('pr1_item_id', pr1ItemIds)
```

**Result:** ✓ Success
- RLS policy "Directors can view all quotes" exists on rfq_item_quotes
- Director has access
- Returns 52 rows with `rfq_supplier_id` populated

### Step 2: FK Relationship Expansion

PostgREST attempts to expand the FK relationship:
```
rfq_suppliers!rfq_item_quotes_rfq_supplier_id_fkey(supplier_name_snapshot)
```

**Step 2a:** PostgREST identifies FK constraint
- Column: `rfq_item_quotes.rfq_supplier_id`
- References: `rfq_suppliers.id`
- ✓ FK constraint found

**Step 2b:** PostgREST tries to read related rfq_suppliers rows
- **RLS blocks Director**
- Checks all rfq_suppliers SELECT policies:
  - "Procurement can select" → Director is NOT procurement ✗
  - "Requestors can view own" → Director is NOT a requestor ✗
  - "Suppliers can view own" → Director is NOT a supplier ✗
  
**No policy matches → Access DENIED**

**Result:** ✗ Failed
- `rfq_suppliers` field returns `null` in each quote row
- FK expansion blocked by RLS

### Step 3: Mapping Logic Extracts Names

```typescript
quotes.forEach((q: any) => {
  qMap[q.pr1_item_id].push({
    supplier: q.rfq_suppliers?.supplier_name_snapshot || 'Unknown',
    // ...
  });
});
```

**Result:**
- `q.rfq_suppliers = null` (RLS-blocked)
- `q.rfq_suppliers?.supplier_name_snapshot = undefined`
- Fallback to: `'Unknown'`

**Final output:** All supplier names show as "Unknown"

---

## Root Cause Diagram

```
Director opens PR2 approval page
    ↓
Query rfq_item_quotes with FK relationship join
    ↓
    ├─ First part: Read rfq_item_quotes
    │  └─ RLS policy: "Directors can view all quotes" ✓
    │     Result: Returns 52 rows ✓
    │
    └─ Second part: Expand rfq_suppliers via FK
       └─ PostgREST attempts to read rfq_suppliers
          └─ RLS checks:
             - "Procurement can select" ✗
             - "Requestors can view own" ✗
             - "Suppliers can view own" ✗
             No policy allows Director access
             Result: RLS BLOCKS ✗
          
          Returns: rfq_suppliers = null
              ↓
          Mapping logic:
          supplier: q.rfq_suppliers?.supplier_name_snapshot || 'Unknown'
              ↓
          Result: 'Unknown'
```

---

## Exact Root Cause

**Location:** Missing RLS policy on `rfq_suppliers` table  
**Affected column:** `supplier_name_snapshot`  
**Affected role:** Director (approver position)  
**Effect:** FK relationship expansion blocked by RLS  
**Symptom:** q.rfq_suppliers returns null → Falls back to "Unknown"

The issue is **not** in the frontend query or mapping logic.  
The issue is **not** in the database data (all names exist).  
The issue **is** a missing RLS permission layer.

---

## Verification Checklist

| Check | Result | Notes |
|-------|--------|-------|
| rfq_suppliers has supplier_name_snapshot | ✓ All 63 rows | Data is present |
| Director can read rfq_item_quotes | ✓ Yes | RLS policy exists |
| Director can read rfq_suppliers | ✗ NO | **RLS BLOCKS** |
| Query returns rfq_suppliers as null | ✓ Yes | Result of RLS block |
| Mapping falls back to "Unknown" | ✓ Yes | Expected behavior |

---

## Minimum Fix Required

Create a new RLS policy on the `rfq_suppliers` table to allow Director access:

```sql
CREATE POLICY "Directors can view all rfq_suppliers"
  ON rfq_suppliers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM (
        profiles p 
        JOIN roles r ON r.id = p.role_id
        JOIN positions pos ON pos.id = p.position_id
      )
      WHERE p.id = auth.uid() 
        AND r.name = 'approver' 
        AND pos.title = 'Director'
    )
  );
```

**Effect:**
- ✓ Director gains SELECT access to rfq_suppliers
- ✓ FK relationship expansion succeeds
- ✓ q.rfq_suppliers returns actual data (not null)
- ✓ Mapping extracts real supplier names
- ✓ UI displays supplier names instead of "Unknown"

**No changes needed to:**
- Frontend query (already correct)
- Mapping logic (already correct)
- UI code (already correct)

---

## Why This is a Database Layer Problem, Not Frontend

The frontend query and mapping are **correct**:

```typescript
// Query is correct:
.select('..., rfq_suppliers!rfq_item_quotes_rfq_supplier_id_fkey(supplier_name_snapshot)')

// Mapping is correct:
supplier: q.rfq_suppliers?.supplier_name_snapshot || 'Unknown'
```

The problem is that `q.rfq_suppliers` comes back as `null` due to RLS blocking the read.

This is **not** a coding issue. It's a **permissions issue**.

---

## Comparison: Why Other Queries Work

### lib/pr2.ts (Procurement backend function)

Uses separate queries, which work because:
1. Procurement user can read rfq_item_quotes ✓
2. Procurement user can read rfq_suppliers ✓
3. Both queries succeed

This pattern wouldn't work for Director either without the RLS policy.

---

## Security Impact

This is actually **correct security design**:

- Director role does NOT have blanket access to all rfq_suppliers data
- Only policies that explicitly allow Director access should work
- The missing policy is an oversight, not a bug

Adding the policy is the **correct fix**, not a workaround.

---

## Testing After Fix

After adding the RLS policy:

1. Login as director@fortune.com
2. Navigate to PR2 Approval page
3. Open DevTools Console
4. Check logs:
   ```
   Quotes query error: null  ✓
   Quotes query result: Array(52) [...]  ✓
   quotesMap: Object {
     "pr1-id": [
       { supplier: "ABC Corp", ... },  ← NOT "Unknown"
       { supplier: "XYZ Ltd", ... }
     ]
   }
   ```
5. Check UI: Supplier names display correctly

---

## Summary

| Aspect | Details |
|--------|---------|
| **Issue** | Supplier names show as "Unknown" in canvass |
| **Root Cause** | Missing RLS policy on rfq_suppliers for Director |
| **Why** | FK relationship expansion blocked by RLS |
| **Data** | All supplier names exist in database ✓ |
| **Frontend** | Query and mapping are correct ✓ |
| **Backend** | Missing permission layer ✗ |
| **Fix** | Add RLS policy to rfq_suppliers |
| **Effort** | Single SQL statement in migration |
| **Side Effects** | None (only adds Director access to existing data) |
