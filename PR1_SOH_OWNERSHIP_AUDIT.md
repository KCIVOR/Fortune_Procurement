# PR1 SOH (Stock on Hand) Ownership Audit Report

## EXECUTIVE SUMMARY

**Current State:** SOH is REQUESTOR-CONTROLLED during PR1 creation  
**Issue:** Requestor can enter any SOH value; warehouse validation copies it  
**Goal:** Move SOH ownership to Warehouse Staff only

---

## SECTION 1: DATABASE SCHEMA

### pr1_items table
- **Column:** `stock_on_hand` (numeric 12,2)
- **Default:** 0
- **NOT NULL:** Yes
- **Current Owner:** REQUESTOR (filled during PR1 creation)
- **File:** `supabase/migrations/20260423225556_pr1_schema.sql`

### warehouse_validation_items table
- **Column:** `requestor_soh` (numeric 12,2)
  - Default: 0
  - NOT NULL: Yes
  - Purpose: Snapshot of what requestor entered (copy from pr1_items.stock_on_hand)
  
- **Column:** `validated_soh` (numeric 12,2)
  - Default: NULL
  - NOT NULL: No
  - Purpose: Warehouse-verified SOH (filled by warehouse staff)
  
- **File:** `supabase/migrations/20260423231825_warehouse_validation_schema.sql`

---

## SECTION 2: PR1 FORM (REQUESTOR CREATION)

**File:** `components/pr1/PR1Form.tsx`

### Current Behavior
- ✓ SOH field is **EDITABLE** during PR1 creation
- ✓ Line 376-378: Input field bound to `item.stock_on_hand`
- ✓ Type: number input
- ✓ Min: 0
- ✓ Placeholder: "0"
- ✓ User can enter any value

### Form State
- ✓ `PR1ItemDraft` includes: `stock_on_hand` (number | empty string)
- ✓ `buildInitialValues()` loads `stock_on_hand` from existing PR1
- ✓ `setItem()` updates `stock_on_hand` in form state

### Data Flow
```
1. Requestor enters SOH value in form
   ↓
2. Form state: item.stock_on_hand = requestor input
   ↓
3. On save/submit: syncItems() saves to pr1_items.stock_on_hand
   ↓
4. Value persisted with DEFAULT 0 if empty
```

---

## SECTION 3: PR1 SUBMISSION (REQUESTOR → DATABASE)

**File:** `lib/pr1.ts`

### Function: `syncItems()` (line 273-297)
- **Purpose:** Insert/update `pr1_items` from form state
- **Called by:** `submitPR1()` after header creation
- **Line 289:** `stock_on_hand: Number(item.stock_on_hand) || 0`
- **Effect:** REQUESTOR VALUE → `pr1_items.stock_on_hand`

### Function: `submitPR1()` (line 124-197)
1. Create `pr1_requests` header (status: draft)
2. Call `syncItems()` → stores requestor SOH
3. Update header status → `pending_warehouse`
4. Audit log (does NOT include SOH)

---

## SECTION 4: WAREHOUSE VALIDATION (WAREHOUSE STAFF)

**File:** `app/warehouse/[id]/page.tsx` (display/edit page)  
**File:** `lib/warehouse.ts` (business logic)

### Function: `openValidation()` (warehouse.ts line 80-150)
- **Purpose:** Create `warehouse_validations` + `warehouse_validation_items`
- **Triggers:** When warehouse staff clicks "Validate PR1"
- **Line 131:** `requestor_soh: item.stock_on_hand`
  - COPIES from `pr1_items.stock_on_hand`
  - Creates read-only snapshot of what requestor entered
- **Line 132:** `validated_soh: null`
  - Start with no warehouse-verified SOH

### Warehouse UI Display (warehouse/[id]/page.tsx)
- ✓ Line 258-260: `requestor_soh` shown as READ-ONLY
- ✓ Line 262-282: `validated_soh` shown as EDITABLE
- ✓ Line 276: Input field for warehouse to enter verified SOH
- ✓ `isReadOnly` flag (line 45) prevents edit if decision submitted

### Auto-derive Availability Logic (line 89-97)
```typescript
// When warehouse enters validated_soh:
if (validated_soh >= quantity_requested) → availability = 'available'
else → availability = 'unavailable'
```

### Function: `saveValidationProgress()` (warehouse.ts line 155-185)
- **Line 173:** `validated_soh: item.validated_soh === "" ? null : Number()`

---

## SECTION 5: DISPLAY ACROSS DOCUMENT LIFECYCLE

### PR1 Detail (app/pr1/[id]/page.tsx)
- ✓ Line 204: Displays `item.stock_on_hand` (REQUESTOR VALUE)
- ✓ READ-ONLY (not in form)

### PR1 Approval (app/approvals/[id]/page.tsx)
- ✓ Line 256: Displays `item.stock_on_hand` (REQUESTOR VALUE)
- ✓ READ-ONLY (display only)

### PR2 Approval (app/approvals/pr2/[id]/page.tsx)
- ✓ Line 209: Displays `item.stock_on_hand`
- ✓ READ-ONLY (not editable)

### PR1 Print (app/pr1/[id]/print/page.tsx)
- ✓ Line 173: Displays `item.stock_on_hand`
- ✓ Line 217: Section for "SOH Verified / Remarks"

---

## SECTION 6: DATA DEPENDENCIES & RISKS

### Dependency 1: Canvassing Decision
- **Where:** `warehouse_validations.decision` = "sufficient" | "insufficient"
- **Rule:** If item is available → PR1 status = `resolved_internal`
- **Risk:** Decision based on `warehouse.validated_soh` (not `requestor.stock_on_hand`)
- **Status:** ✓ SAFE - uses correct field

### Dependency 2: PR2 Generation
- **Where:** When PR1 status = `pending_approval` or `insufficient`
- **Data:** PR2 receives `pr1_items.stock_on_hand`
- **Risk:** PR2 uses REQUESTOR SOH, not warehouse-verified SOH
- **Status:** ⚠ POTENTIAL ISSUE - may be intentional for audit trail

### Dependency 3: RFQ Item Quotes
- **Where:** `rfq_items` table
- **Data:** Copied from `pr1_items`
- **Risk:** Uses requestor SOH
- **Status:** ⚠ POTENTIAL ISSUE - may need warehouse-verified value

---

## SECTION 7: SCHEMA CONSTRAINTS

### pr1_items.stock_on_hand
- ✓ NOT NULL DEFAULT 0
- ✓ Numeric type allows nullability in code
- ⚠ Risk: If made optional, existing records will have 0
- ⚠ Risk: Draft PR1 behavior undefined if SOH removed

### warehouse_validation_items.requestor_soh
- ✓ NOT NULL DEFAULT 0
- ✓ Snapshot - never changes after copy

### warehouse_validation_items.validated_soh
- ✓ Nullable (allows NULL while in progress)
- ✓ Warehouse can leave empty
- ✓ Auto-set to NULL if cleared

---

## SECTION 8: CURRENT REQUESTOR BEHAVIOR SUMMARY

### PR1 Create/Edit (Draft)
- ✓ Requestor CAN ENTER SOH value
- ✓ Form field is visible and editable (line 376-380)
- ✓ Default = 0
- ✓ No validation preventing requestor from filling SOH
- ✓ Value saved to `pr1_items.stock_on_hand`

### Business Rule Violation
- ✗ Requestor SHOULD NOT fill SOH
- ✗ Currently NO enforcement
- ✗ Warehouse can see requestor-filled value
- ✗ May cause confusion: is it validated or requested?

---

## SECTION 9: FILES INVOLVED IN SOH DATA FLOW

| File | Role | SOH Field | Current Access |
|------|------|-----------|-----------------|
| `components/pr1/PR1Form.tsx` | PR1 Form | `stock_on_hand` input | Editable by requestor |
| `lib/pr1.ts` | PR1 Logic | `stock_on_hand` in syncItems() | Writes requestor value |
| `app/pr1/[id]/page.tsx` | PR1 Detail | `stock_on_hand` display | Read-only |
| `app/approvals/[id]/page.tsx` | Approval | `stock_on_hand` display | Read-only |
| `app/warehouse/[id]/page.tsx` | Warehouse | `requestor_soh` display + `validated_soh` input | Editable by warehouse |
| `lib/warehouse.ts` | Warehouse Logic | `requestor_soh` copy + `validated_soh` write | Writes validated value |
| `types/pr1.ts` | Type Definitions | `stock_on_hand` in PR1Item | Defines field structure |
| `types/warehouse.ts` | Type Definitions | `requestor_soh`, `validated_soh` | Defines field structure |

---

## SECTION 10: MINIMUM FIX OPTIONS

### Option A: Hide SOH input from requestor (UI-only)
- **File:** `components/pr1/PR1Form.tsx`
- **Change:** Set SOH field to display-only or remove from form
- **Effect:** Requestor cannot enter; defaults to 0
- **Complexity:** EASY
- **Data impact:** Existing PR1s retain their SOH values
- **Reversibility:** HIGH (UI-only change)

### Option B: Make SOH nullable and optional
- **File:** supabase migration (schema change)
- **Change:** `pr1_items.stock_on_hand DEFAULT NULL`
- **File:** `components/pr1/PR1Form.tsx` (hide field)
- **Effect:** New PR1s start with NULL; warehouse must fill
- **Complexity:** MEDIUM
- **Data impact:** Existing PR1s have values; new ones NULL
- **Reversibility:** MEDIUM (schema change)

### Option C: Keep SOH in database but mark as audit-only
- **File:** `components/pr1/PR1Form.tsx` (hide input)
- **File:** `lib/pr1.ts` (clear SOH on submit)
- **Effect:** Store zeros or NULL for all new PR1s
- **Complexity:** EASY
- **Data impact:** Only affects new PR1s
- **Reversibility:** MEDIUM (code + data change)

### RECOMMENDATION: Option A (UI-only hide, no schema change)
- **Reason:** Simplest, reversible, minimal risk
- **Reason:** Keeps audit trail of what requestor intended to claim
- **Reason:** Allows easy rollback if business rule changes
- **Reason:** No database migration needed

---

## SECTION 11: QUESTIONS NEEDING CLARIFICATION

### Q1: Should existing draft PR1s keep their SOH values?
- If yes: Hidden field preserves data
- If no: Need migration to clear/reset

### Q2: Should submitted PR1s show requestor SOH as read-only label?
- Current: Yes, shown in PR1 detail and approvals
- Intent: Audit trail or confusion risk?

### Q3: Should PR2 items use warehouse-validated SOH or requestor SOH?
- Current: Uses `pr1_items.stock_on_hand` (requestor value)
- Issue: PR2 may reflect inaccurate starting inventory

### Q4: When warehouse decision = "sufficient", is PR1 closed?
- Current: status = `resolved_internal`
- Question: Is requestor SOH used for this logic?

### Q5: Are there downstream reports/exports using stock_on_hand?
- Current: Not found in explored files
- Question: Need to audit canvassing, PO, delivery modules

---

## SECTION 12: AUDIT FINDINGS - SUMMARY TABLE

| Area | Current State | Requirement | Status |
|------|---------------|-------------|--------|
| PR1 Form | SOH editable by requestor | SOH not editable | ❌ VIOLATION |
| PR1 Submit | SOH stored from form | SOH should be 0/NULL | ❌ VIOLATION |
| Warehouse Validation | Can see & correct SOH | Can verify & override | ✓ CORRECT |
| Display (Detail) | Shows requestor SOH | Shows as audit-only | ⚠ UNCLEAR |
| Display (Approval) | Shows requestor SOH | Shows as audit-only | ⚠ UNCLEAR |
| Database Schema | NOT NULL DEFAULT 0 | Optional or read-only | ⚠ UNCLEAR |

---

**AUDIT COMPLETE - AWAITING CLARIFICATION AND APPROVAL BEFORE IMPLEMENTATION**
