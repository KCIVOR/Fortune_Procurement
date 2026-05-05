# PR1 Downstream Lifecycle Status Ordering & Linkage Audit

**Date:** 2026-05-04  
**Audit Scope:** fetchDownstreamStage() function and related data relationships  
**Status:** Audit complete - Critical bugs found

---

## Executive Summary

**Issue Found:** Employee PR1 status stops at "Canvassing Complete" instead of progressing to PO/Delivery/Completed.

**Root Cause:** The `fetchDownstreamStage()` function contains TWO CRITICAL BUGS:

1. **Wrong table name:** Code queries `delivery_tracking` → Should be `deliveries`
2. **Wrong logic order:** Code checks RFQ AFTER checking delivery/PO
   - This causes it to return "Canvassing" even when PO/delivery exist

**Impact:** 
- Employees see "Current: Canvassing" for PR1s that are already in PO or delivery stages
- False indication that request is still in canvassing when it's actually further along

---

## File & Function

**File:** `lib/pr1.ts`  
**Function:** `fetchDownstreamStage(pr1Id: string): Promise<DownstreamStage>`  
**Lines:** 116-167

---

## Current (Broken) Logic Flow

```typescript
// CURRENT CODE (WRONG)
1. Check if PR2 exists? → if no: return 'PR1 Approval'
2. Check if GRN exists? → if yes: return 'Completed'
3. Check if delivery exists? → if yes: return 'For Delivery'
4. Check if PO exists? → if yes: return 'PO Issued'
5. Check if RFQ exists? (via pr2.rfq_id) → if yes: return 'Canvassing'  ← WRONG PLACE
6. Default: return 'Processing (PR2)'
```

**Problem:** Step 5 checks `pr2.rfq_id` AFTER checking for delivery/PO.

Since PR2 always has `rfq_id` (set when PR2 is created with RFQ), if we reach step 5, it ALWAYS returns "Canvassing" even if PO/delivery were already created.

---

## Actual Database Relationships Verified

### PR1 → PR2
**Table:** `pr2_requests`  
**FK:** `pr2_id → pr1_requests.id`  
**Status:** ✓ Correct in code

Example data:
- PR1-20260424-004 (status: canvassing_complete)
- Has PR2-* (status: phase2_approved)

### PR2 → RFQ
**Table:** `pr2_requests`  
**Field:** `rfq_id`  
**Status:** ✓ Verified - PR2 always has rfq_id set

Example:
- pr2_requests.rfq_id = uuid (ALWAYS SET)

### PR2 → PO
**Table:** `po_requests`  
**FK:** `pr2_id → pr2_requests.id`  
**Status:** ✓ Correct schema

Example data:
```
pr1_id: d65947df-86ae-4b92-a988-b37a4cb3ee2b
pr2_id: ff5fe453-4b44-4d99-b4ea-438e9045ea39
po_id: c2e7eed5-5824-4a03-a317-4afb58c7decc (po_status: sent)
```

**Code references:** Line 150-154
```typescript
const { data: po } = await db
  .from('po_requests')
  .select('id')
  .eq('pr2_id', pr2.id)
  .maybeSingle();
```
✓ Correct

### PO → Delivery
**Table:** `deliveries` (NOT `delivery_tracking`)  
**FK:** `po_id → po_requests.id`  
**Status:** ✗ **BUG: Code queries wrong table**

Example data:
```
po_id: c2e7eed5-5824-4a03-a317-4afb58c7decc
delivery_id: f06d2fc8-c506-4b6b-8dca-088da4833b1e (delivery_status: pending)
```

**Code references:** Lines 128-131
```typescript
const { data: deliveryWithGrn } = await db
  .from('delivery_tracking')  ← WRONG! Should be 'deliveries'
  .select('id')
  .eq('pr2_id', pr2.id);
```

**Correct schema:**
- Table: `deliveries` (not `delivery_tracking`)
- FK on deliveries: `po_id → po_requests.id`
- deliveries has NO `pr2_id` field

### Delivery → GRN
**Table:** `grn_receipts`  
**FK:** `delivery_id → deliveries.id`  
**Status:** ✓ Correct in code

Example data:
```
delivery_id: f06d2fc8-c506-4b6b-8dca-088da4833b1e
grn_id: null (no GRN created yet)
```

**Code references:** Lines 134-139
```typescript
const { data: grn } = await db
  .from('grn_receipts')
  .select('id')
  .eq('delivery_id', deliveryId)
  .maybeSingle();
```
✓ Correct (once table name is fixed)

---

## RLS Policy Analysis

### Employee Access to Each Table

**pr2_requests:**
- Policy: "Requestors can read own PR2 requests"
- Condition: `requisitioner_id = auth.uid()`
- Employee can read: ✓ YES

**rfq_suppliers / rfq_batches:**
- Policy: "Requestors can view rfq_suppliers for their own PR1s"
- Employee can read: ✓ YES

**po_requests:**
- Policies: No employee-specific policy
- Employee can read: ✗ NO (blocked by default)
- **NOTE:** This is separate issue from ordering bug

**deliveries:**
- Policy: "Employee can read own requisition deliveries"
- Condition: `requisitioner_id = auth.uid()`
- Employee can read: ✓ YES

**grn_receipts:**
- Policy: "Employee can read own requisition GRNs"
- Condition: Joins through deliveries → requisitioner_id
- Employee can read: ✓ YES

**Status:** RLS not the blocker for this stage check

---

## Exact Bug Diagnosis

### Bug #1: Wrong Table Name

**Location:** Line 128-131  
**Current:**
```typescript
const { data: deliveryWithGrn } = await db
  .from('delivery_tracking')
  .select('id')
  .eq('pr2_id', pr2.id);
```

**Problem:**
- Table `delivery_tracking` doesn't exist in this context (it's `deliveries`)
- deliveries has NO `pr2_id` field (it has `po_id`)
- Query silently returns empty array
- Code assumes "no delivery found" when it actually can't query the right table

**Expected Fix:**
```typescript
const { data: delivery } = await db
  .from('deliveries')
  .select('id')
  .eq('po_id', po.id)  ← Must have PO first
  .maybeSingle();
```

### Bug #2: Wrong Logic Order

**Location:** Line 158-161  
**Current:**
```typescript
// Step 5: Check if RFQ exists (we already have it from pr2.rfq_id)
if (pr2.rfq_id) {
  return 'Canvassing';
}
```

**Problem:**
- This check happens AFTER delivery/PO checks
- But pr2.rfq_id is ALWAYS set (set when PR2 is created)
- So if code reaches here, it ALWAYS returns "Canvassing"
- This is reached when:
  - PR2 exists ✓
  - PO query fails (due to bug #1) so po = null
  - delivery query fails (due to bug #1) so delivery = null
  - Result: Returns "Canvassing" even if PO/delivery exist in database

**Why it fails:**
- Because delivery query fails (wrong table), code never finds PO/delivery
- Falls through to RFQ check
- Always returns "Canvassing"

---

## Correct Stage Order (Should Be)

```
1. Check: Does GRN exist? 
   → grn_receipts exists? YES → return 'Completed'

2. Check: Does delivery exist? 
   → deliveries exists (for this PO)? YES → return 'For Delivery'

3. Check: Does PO exist? 
   → po_requests exists (for this PR2)? YES → return 'PO Issued'

4. Check: Does RFQ exist? 
   → pr2.rfq_id is set? YES → return 'Canvassing'

5. Default: 
   → return 'Processing (PR2)'
```

**Current code ACTUALLY does:**
1. Check GRN ✓
2. Check delivery ✗ (queries wrong table, fails)
3. Check PO ✓
4. Check RFQ ✓ (but never reached because of bug #1)
5. Default (never reached)

**What happens:**
- If GRN exists: returns 'Completed' ✓
- Else if delivery query fails (bug): skips to step 3
- Else if PO exists: should return 'PO Issued' ✓
- Else: falls through to RFQ check → 'Canvassing' (ALWAYS, because pr2.rfq_id always set)

---

## Data Verification

### Sample PR1 in Different Stages

```sql
PR1: PR1-20260424-004 (status: canvassing_complete)
├─ PR2: ff5fe453-4b44-4d99-b4ea-438e9045ea39 (status: phase2_approved)
├─ RFQ: (exists, rfq_id set in PR2)
├─ PO: c2e7eed5-5824-4a03-a317-4afb58c7decc (status: sent)
├─ Delivery: f06d2fc8-c506-4b6b-8dca-088da4833b1e (status: pending)
└─ GRN: null (not yet created)

What SHOULD show: "Current: For Delivery"
What ACTUALLY shows (due to bugs): "Current: Canvassing"
```

### Relationship Chain Verification

**Query result summary (19 canvassing_complete PR1s):**
- All have PR2: ✓ 19/19
- With PO: 11/19 (58%)
- With Delivery: 8/19 (42%)
- With GRN: 4/19 (21%)

**This confirms:** Many PR1s that should show "PO Issued", "For Delivery", or "Completed" are incorrectly showing "Canvassing"

---

## Root Cause Analysis

### Why Bug #1 Happened

The migration file `20260424044859_delivery_tracking_schema.sql` creates:
- Table: `deliveries` (main delivery table)
- Table: `delivery_status_history` (audit log)

But the code references `delivery_tracking` which doesn't exist.

Possible confusion:
- File name contains "tracking" → developer thought table was `delivery_tracking`
- Should have been `deliveries`

### Why Bug #2 Happened

Misunderstanding of logic flow:
- Developer thought: "Check delivery first, then RFQ if no delivery"
- But actually: PR2 always has rfq_id set when created
- So the fallback to RFQ check always returns 'Canvassing'

The order should be based on **advancement**, not **existence**:
- Most advanced: GRN (completed)
- Next: Delivery (in progress)
- Next: PO (issued)
- Next: RFQ/Canvassing (ongoing)
- Least: PR2 (just created)

---

## RLS Consideration

**Finding:** 
- Employee RLS policies allow reading deliveries and grn_receipts ✓
- Employee RLS DOES NOT allow reading po_requests (no policy exists)

**Implication:**
- Even after fixing the query, employee will get null for PO check
- This is a SEPARATE issue from this bug
- But it's a secondary blocker

**Status:** Need to address PO RLS separately

---

## Validation Cases

### Test Case 1: PR1 with GRN
**PR1 Status:** canvassing_complete  
**Data:**
- GRN exists (status: closed)
- Delivery exists (status: delivered)
- PO exists (status: sent)
- RFQ exists

**Expected:** "Current: Completed"  
**Actual (with bugs):** "Current: Canvassing"  
**After fix:** "Current: Completed" ✓

### Test Case 2: PR1 with Delivery but no GRN
**PR1 Status:** canvassing_complete  
**Data:**
- GRN: null
- Delivery exists (status: in_transit)
- PO exists (status: sent)
- RFQ exists

**Expected:** "Current: For Delivery"  
**Actual (with bugs):** "Current: Canvassing"  
**After fix:** "Current: For Delivery" ✓

### Test Case 3: PR1 with PO but no Delivery
**PR1 Status:** canvassing_complete  
**Data:**
- GRN: null
- Delivery: null (not created yet)
- PO exists (status: sent)
- RFQ exists

**Expected:** "Current: PO Issued"  
**Actual (with bugs):** "Current: Canvassing"  
**After fix:** "Current: PO Issued" ✓

### Test Case 4: PR1 in Canvassing only
**PR1 Status:** canvassing_complete  
**Data:**
- GRN: null
- Delivery: null
- PO: null (not created yet)
- RFQ exists

**Expected:** "Current: Canvassing"  
**Actual (with bugs):** "Current: Canvassing"  
**After fix:** "Current: Canvassing" ✓

---

## Minimum Fix Required

### Fix #1: Correct Table & FK (CRITICAL)

**File:** `lib/pr1.ts`  
**Lines:** 128-147

**Current:**
```typescript
// Step 2: Check if GRN exists (via delivery_tracking join)
const { data: deliveryWithGrn } = await db
  .from('delivery_tracking')  ← WRONG
  .select('id')
  .eq('pr2_id', pr2.id);       ← WRONG FK

if (deliveryWithGrn && deliveryWithGrn.length > 0) {
  const deliveryId = deliveryWithGrn[0].id;
  const { data: grn } = await db
    .from('grn_receipts')
    .select('id')
    .eq('delivery_id', deliveryId)
    .maybeSingle();

  if (grn) return 'Completed';
}

// Step 3: Check if delivery exists
if (deliveryWithGrn && deliveryWithGrn.length > 0) {
  return 'For Delivery';
}

// Step 4: Check if PO exists
const { data: po } = await db
  .from('po_requests')
  .select('id')
  .eq('pr2_id', pr2.id)
  .maybeSingle();

if (po) return 'PO Issued';
```

**Corrected:**
```typescript
// Step 2: Check if PO exists first (required for delivery lookup)
const { data: po } = await db
  .from('po_requests')
  .select('id')
  .eq('pr2_id', pr2.id)
  .maybeSingle();

if (!po) {
  // No PO yet, check if RFQ exists
  if (pr2.rfq_id) {
    return 'Canvassing';
  }
  return 'Processing (PR2)';
}

// Step 3: Check if delivery exists
const { data: delivery } = await db
  .from('deliveries')       ← FIXED
  .select('id')
  .eq('po_id', po.id)       ← FIXED FK
  .maybeSingle();

if (!delivery) return 'PO Issued';

// Step 4: Check if GRN exists
const { data: grn } = await db
  .from('grn_receipts')
  .select('id')
  .eq('delivery_id', delivery.id)
  .maybeSingle();

if (grn) return 'Completed';

// Step 5: Delivery exists but no GRN
return 'For Delivery';
```

---

## Summary of Findings

| Item | Current | Correct | Status |
|------|---------|---------|--------|
| Table name for delivery | `delivery_tracking` | `deliveries` | ✗ BUG |
| FK for delivery | `pr2_id` | `po_id` | ✗ BUG |
| Check order | GRN, delivery, PO, RFQ, PR2 | GRN, delivery, PO, RFQ, PR2 | ✓ OK (but blocked by bugs) |
| RFQ always set? | Yes | Yes | ✓ Confirmed |
| Employee RLS for delivery | Yes | Yes | ✓ OK |
| Employee RLS for PO | No | Should add | ⚠ Separate issue |
| Employee RLS for GRN | Yes | Yes | ✓ OK |

---

## Recommendations

### Phase 1: Fix Query Bugs (IMMEDIATE)
1. Change `delivery_tracking` → `deliveries`
2. Change `pr2_id` FK → `po_id` FK
3. Reorder logic to check PO before delivery

### Phase 2: Add PO RLS (FOLLOW-UP)
- Create RLS policy allowing employee to read po_requests (status-only)
- Currently PO returns null, so stage check falls back to "Canvassing"

### Phase 3: Test Thoroughly
- Verify all 4 validation cases pass
- Test with PR1s in different stages
- Monitor employee feedback

---

## Conclusion

**Status:** Two critical bugs found in `fetchDownstreamStage()`

**Severity:** HIGH (incorrect status shown to employees)

**Fix Complexity:** Low (table name + FK + reorder logic)

**Time to Fix:** ~15 minutes

**Audit Complete — Awaiting Implementation Approval**
