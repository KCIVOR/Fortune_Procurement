# PR1 Detail SOH Display Audit

**Date:** 2026-05-04  
**Issue:** Employee PR1 detail displays SOH=0 even after warehouse staff enters validated_soh  
**Audit Type:** Display data flow analysis (no changes made)

---

## EXECUTIVE SUMMARY

**Problem:** After warehouse validation with `validated_soh` entered, PR1 detail pages still show SOH=0.

**Root Cause:** Pages query only `pr1_items.stock_on_hand` (which is 0). They don't query `warehouse_validation_items.validated_soh`.

**Impact:** 
- ✗ Employees see SOH=0 without knowing warehouse verified a different value
- ⚠ Approvers lack inventory context
- ⚠ Confusion about what SOH represents

**Fix Type:** Display/data fetch enhancement (no schema changes needed)

---

## FILES INVOLVED

### Display Pages (Currently Show SOH=0)

| File | Role | Line | Current Display |
|------|------|------|-----------------|
| `app/pr1/[id]/page.tsx` | Employee | 204 | `item.stock_on_hand.toLocaleString()` |
| `app/approvals/[id]/page.tsx` | Approver | 256 | `item.stock_on_hand.toLocaleString()` |
| `app/pr1/[id]/print/page.tsx` | Print | 173 | `item.stock_on_hand.toLocaleString()` |

### Data Fetching Functions (Current - Incomplete)

| File | Function | What's Fetched | What's Missing |
|------|----------|----------------|-----------------|
| `lib/pr1.ts:42` | `fetchPR1ById()` | pr1_items only | warehouse_validation_items |
| `lib/approvals.ts:80` | `fetchApprovalDetail()` | pr1_items + warehouse_validations header | warehouse_validation_items per-item |

### Types (Need Enhancement)

| File | Type | Current Fields | Missing Fields |
|------|------|----------------|-----------------|
| `types/pr1.ts:13` | `PR1Item` | stock_on_hand | validated_soh |
| `types/approvals.ts` | Approval item type | stock_on_hand | validated_soh |

---

## DATA STRUCTURE

### Current Data Sources

**pr1_items table:**
```sql
id (PK)
pr1_id (FK)
stock_on_hand = 0  ← Always 0 (never entered by requestor)
quantity_requested
```

**warehouse_validation_items table:**
```sql
id (PK)
validation_id (FK) → warehouse_validations
pr1_item_id (FK) → pr1_items ✓
requestor_soh = 0  ← Snapshot of pr1_items.stock_on_hand
validated_soh      ← ⭐ WAREHOUSE-VERIFIED VALUE (what we need)
quantity_requested
availability
```

### Key Relationship
```
pr1_items.id ←FK─ warehouse_validation_items.pr1_item_id
```

This relationship exists and is safe to join.

---

## CURRENT DATA FLOW

### PR1 Detail Page (app/pr1/[id]/page.tsx)

```typescript
// Current flow
1. fetchPR1ById(id)
   ↓
2. Query: .select("*, pr1_items(*)")
   ↓
3. Returns PR1WithItems { items: PR1Item[] }
   ↓
4. Each item only has stock_on_hand (=0)
   ↓
5. Display: {item.stock_on_hand.toLocaleString()} → "0"

✗ Missing: warehouse_validation_items with validated_soh
```

### What Should Happen

```typescript
// Desired flow
1. fetchPR1ById(id)
   ↓
2. Query: .select("*, pr1_items(*)")
   ↓
3. If status !== 'draft':
   - Query warehouse_validations for pr1_id
   - Query warehouse_validation_items for each pr1_item_id
   - Merge validated_soh into items
   ↓
4. Returns PR1WithItems { 
     items: PR1Item[] 
     warehouse_decision?: 'sufficient' | 'insufficient'
     items[].validated_soh?: number | null
   }
   ↓
5. Display: 
   - If validated_soh exists: show validated_soh
   - Else if pending validation: show "Pending warehouse"
   - Else: show 0
```

---

## WAREHOUSE DATA AVAILABILITY

### Warehouse Validation Tables Exist and Are Populated

**warehouse_validations table:**
- Stores per-PR1 validation with `decision` field
- Already used in approval pages (lib/approvals.ts:105-108)

**warehouse_validation_items table:**
- Stores per-item validated SOH
- Already populated when warehouse staff fills validated_soh
- Already linked to pr1_items via `pr1_item_id` FK

### Evidence: Approval Page Already Accesses Warehouse Data

**lib/approvals.ts (line 105-108):**
```typescript
db.from('warehouse_validations')
  .select('decision, validator_name_snapshot, validated_at, notes')
  .eq('pr1_id', inst.document_id)
  .maybeSingle(),
```

✓ Approval pages know validation exists  
✗ But still display `pr1_items.stock_on_hand = 0` instead of `validated_soh`

---

## ROOT CAUSES

### Root Cause 1: Data Fetch Gap

**fetchPR1ById()** only fetches `pr1_items`:
```typescript
.select('*, pr1_items(*)')
```

**Missing:** `warehouse_validation_items` with `validated_soh`

**Why:** When the code was written, warehouse validation might not have been designed yet, or was treated as separate concern.

### Root Cause 2: Type System Doesn't Support Warehouse Data

**PR1Item interface:**
```typescript
interface PR1Item {
  stock_on_hand: number;  // Always 0 now
  // Missing: validated_soh?: number | null
}
```

**Impact:** Types can't represent warehouse-verified SOH, so display code can't use it.

### Root Cause 3: Display Logic Has No Conditional

**Current display:**
```typescript
<td>{item.stock_on_hand.toLocaleString()}</td>
```

**Missing:**
```typescript
<td>
  {item.validated_soh !== undefined && item.validated_soh !== null
    ? item.validated_soh.toLocaleString()
    : item.stock_on_hand.toLocaleString()}
</td>
```

---

## CURRENT BEHAVIOR VS. DESIRED

### Scenario: Warehouse Validates Item as Insufficient

#### Current (Broken)
```
Employee views PR1 detail:
  Item: Widget A
  SOH: 0 ← Wrong! Warehouse said 45
  Qty Req: 100
  
Employee thinks: "Why SOH is 0? What does it mean?"
```

#### Desired
```
Employee views PR1 detail:
  Item: Widget A
  SOH: 45 (Warehouse verified) ← Correct!
  Qty Req: 100
  
Employee thinks: "Clear, warehouse has 45, we need 100"
```

---

## EDGE CASES & HANDLING

### Edge Case 1: Draft PR1 (No Warehouse Validation Yet)
- `warehouse_validation_items` = none
- Display: SOH = 0 or "Not yet validated" ✓

### Edge Case 2: Warehouse Validation In Progress
- `warehouse_validations.decision` = NULL
- `warehouse_validation_items` partially filled
- Display: SOH = partial value or "Validation in progress" ✓

### Edge Case 3: Warehouse Validation Complete
- `warehouse_validations.decision` = 'sufficient' or 'insufficient'
- `warehouse_validation_items.validated_soh` = actual value
- Display: SOH = validated_soh ✓

### Edge Case 4: Multiple Items, Some Validated
- Items 1, 2 validated
- Item 3 not yet validated
- Display: 
  - Item 1: validated_soh
  - Item 2: validated_soh
  - Item 3: 0 or "Pending" ✓

---

## RISK ASSESSMENT

### Display Risk: LOW
- **Current State:** Users see SOH=0 consistently
- **Risk:** Confusion about meaning
- **Impact:** None on functionality, only understanding
- **Level:** LOW (no data loss, no broken workflows)

### Business Logic Risk: MEDIUM
- **Current State:** Approvers don't see warehouse-verified quantities
- **Risk:** Approvers lack context for approval decisions
- **Impact:** Decisions made without full inventory picture
- **Level:** MEDIUM (reduced decision quality)

### PR2 Generation Risk: LOW
- **Current State:** PR2 generated from pr1_items.stock_on_hand = 0
- **Risk:** PR2 shows qty_on_hand=0 instead of warehouse-verified
- **Impact:** Low (procurement can manually edit PR2 items)
- **Level:** LOW (easily corrected in PR2 form)

---

## JOIN RELATIONSHIPS

### Safe to Join?

**YES.** The relationship is:
```
pr1_items.id ←(FK)── warehouse_validation_items.pr1_item_id
```

This FK constraint ensures data consistency.

### Join Query Structure

To get warehouse data into PR1 detail:

**Step 1: Fetch PR1 + items (current)**
```typescript
SELECT r.*, pi.*
FROM pr1_requests r
LEFT JOIN pr1_items pi ON r.id = pi.pr1_id
```

**Step 2: If validation needed, fetch warehouse data**
```typescript
SELECT *
FROM warehouse_validations wv
WHERE wv.pr1_id = r.id

SELECT *
FROM warehouse_validation_items wvi
WHERE wvi.pr1_item_id IN (pi.id list)
```

**Step 3: Merge validated_soh into items (in code)**
```typescript
const itemsWithValidation = items.map(item => ({
  ...item,
  validated_soh: validationItemMap[item.id]?.validated_soh ?? null
}))
```

**Why separate queries?**
- Supabase doesn't support nested LEFT JOINs in one query
- Code-level merge is cleaner and more maintainable

---

## MINIMUM FIX RECOMMENDATION

### Option A: Minimal (Display Only)

**Files to modify:**
1. `types/pr1.ts` — Add `validated_soh?: number | null` to PR1Item
2. `app/pr1/[id]/page.tsx` — Update display logic to show validated_soh if available

**Changes:**
- ~5 lines per file
- No query changes
- No warehouse data fetched
- Limitation: Still won't show warehouse-verified value (but clearer display)

### Option B: Complete (Recommended)

**Files to modify:**
1. `lib/pr1.ts` — Enhance fetchPR1ById() to fetch warehouse data
2. `types/pr1.ts` — Add validated_soh, warehouse_decision to PR1Item
3. `app/pr1/[id]/page.tsx` — Update display logic
4. `app/approvals/[id]/page.tsx` — Update display logic
5. `app/pr1/[id]/print/page.tsx` — Update display logic

**Changes:**
- ~10 lines per file
- Enhanced queries for warehouse data
- Full warehouse-verified SOH display
- Better context for approvers

### Recommended: Option B

Reason: Shows actual warehouse-verified values, improves decision quality.

---

## IMPLEMENTATION NOTES

### What NOT to Change
- ✓ Schema (no new tables or columns)
- ✓ Warehouse validation logic (correct as-is)
- ✓ PR1 creation logic (SOH defaults to 0 correctly)
- ✓ Database relationships (already correct)

### What TO Change
- ✓ Data fetch functions (add warehouse query)
- ✓ Type definitions (add optional validated_soh field)
- ✓ Display logic (conditional to show validated_soh)
- ✓ User labels (clarify what SOH represents)

### Implementation Order
1. Update types first (low risk)
2. Update data fetching (medium risk)
3. Update display pages (low risk)
4. Test on PR1 detail, approvals, print

---

## QUESTIONS FOR APPROVAL

1. Should approved SOH always show warehouse-verified value, or show requestor value as audit trail?
2. Should we add labels like "Warehouse Verified:" to make source clear?
3. Should approval page prominently display warehouse decision and verified quantities?
4. Should print document show both requestor claim and warehouse verification?

---

## CONCLUSION

**Current State:** ✗ Display issue only (functional workflows intact)

**Root Cause:** Pages don't query warehouse_validation_items

**Fix Complexity:** Low-medium (queries + types + display logic)

**Risk:** Low (display-only changes, no functional impact)

**Recommended Action:** Implement Option B for complete warehouse visibility

