# SOH (Stock on Hand) Downstream Usage Audit

**Date:** 2026-05-04  
**Context:** PR1 form SOH field made read-only (requestor cannot enter, defaults to 0)  
**Scope:** Complete trace of where `pr1_items.stock_on_hand` is used downstream  

---

## EXECUTIVE SUMMARY

**Functional Impact:** ✓ **NONE**
- No logic breaks
- No calculations affected  
- Warehouse validation works correctly

**Data Flow Impact:** ✓ **MINIMAL**
- `pr1_items.stock_on_hand` = 0 (not entered by requestor)
- `warehouse_validation_items.requestor_soh` = 0 (snapshot)
- `warehouse_validation_items.validated_soh` = (warehouse enters actual value)
- All availability decisions based on `validated_soh` ✓

**UI/UX Impact:** ⚠ **MINOR**
- Approval pages will display SOH=0
- May confuse users about purpose of SOH field
- Not a functional issue, purely informational

---

## DETAILED FINDINGS

### 1. PR2 GENERATION (lib/pr2.ts)

**Location:** Line 98 - `generatePR2FromRfq()`

```typescript
// Fetch PR1 items
const { data: pr1Items, error: pr1ItemsErr } = await db
  .from('pr1_items')
  .select('id, item_order, item_code, description, unit_of_measure, quantity_requested, stock_on_hand')
  .eq('pr1_id', rfq.pr1_id)
```

**Current Behavior:**
- ✓ Fetches `stock_on_hand` from database
- ✓ Value will be 0 (requestor did not enter it)
- ✗ **NOT USED** in PR2 item creation (lines 199-219)

**PR2 Item Row Construction (lines 199-219):**
```typescript
return {
  pr2_id,
  item_order: item.item_order,
  item_code: item.item_code,
  description: item.description,
  unit_of_measure: item.unit_of_measure,
  pr1_item_id: item.id,
  quantity_requested: qty,         // FROM PR1
  qty_on_hand: 0,                  // HARDCODED ZERO
  qty_incoming: 0,                 // HARDCODED ZERO
  quantity_to_purchase: qty,       // DERIVED FROM qty_requested
  // ... other fields ...
}
```

**Verdict:** ✓ **SAFE**
- `stock_on_hand` is fetched but **never used**
- PR2 items hardcode `qty_on_hand=0` and `qty_incoming=0`
- PR2 then allows procurement to edit these values
- No impact from `stock_on_hand=0`

---

### 2. RFQ CREATION & DISPLAY (lib/canvassing.ts)

**Location:** Line 82 - `fetchRfqDetail()`

```typescript
const [pr1Res, itemsRes, suppliersRes] = await Promise.all([
  db.from('pr1_requests')
    .select('id, pr1_number, requisitioner_name_snapshot, department_name_snapshot, purpose, date_required')
    .eq('id', rfq.pr1_id)
    .maybeSingle(),
  db.from('pr1_items')
    .select('id, item_order, item_code, description, unit_of_measure, quantity_requested')
    .eq('pr1_id', rfq.pr1_id)
    .order('item_order', { ascending: true }),
  // ...
]);
```

**Current Behavior:**
- ✓ RFQ detail explicitly **does NOT select** `stock_on_hand`
- ✓ Procurement only sees: code, description, UOM, qty_requested
- ✓ Never references `stock_on_hand` in any function

**Verdict:** ✓ **SAFE**
- `stock_on_hand` is not part of RFQ workflow
- No change in behavior

---

### 3. WAREHOUSE VALIDATION (lib/warehouse.ts)

**Location:** Line 131 - `openValidation()`

```typescript
const itemRows = (pr1Items ?? []).map((item: any) => ({
  validation_id:      vRow.id,
  pr1_item_id:        item.id,
  item_order:         item.item_order,
  item_code:          item.item_code,
  description:        item.description,
  unit_of_measure:    item.unit_of_measure,
  requestor_soh:      item.stock_on_hand,    // COPIES FROM PR1
  validated_soh:      null,                   // WAREHOUSE FILLS THIS
  quantity_requested: item.quantity_requested,
  availability:       null,
  item_notes:         '',
}));
```

**Current Behavior:**
- ✓ Copies `pr1_items.stock_on_hand` → `warehouse_validation_items.requestor_soh`
- ✓ `requestor_soh` value will be 0
- ✓ `requestor_soh` is **read-only** (audit trail only)
- ✓ `validated_soh` is **NULL** initially (warehouse fills this)

**Warehouse Validation Page (app/warehouse/[id]/page.tsx):**

```typescript
// Auto-derive availability when validated_soh is entered
const handleValidatedSohChange = (idx: number, rawVal: string) => {
  const num = rawVal === '' ? '' : Number(rawVal);
  setItem(idx, 'validated_soh', num);
  if (rawVal !== '') {
    const qty = formValues.items[idx].quantity_requested;
    const soh = Number(rawVal);
    const auto: ItemAvailability = soh >= qty ? 'available' : 'unavailable';
    setItem(idx, 'availability', auto);
  }
};
```

**Key Logic:**
- ✓ Uses `validated_soh` for availability decision
- ✓ **NOT** using `requestor_soh` or `stock_on_hand`
- ✓ Warehouse staff enters actual inventory, availability auto-derived

**Verdict:** ✓ **SAFE**
- `requestor_soh=0` is correctly captured as snapshot
- Warehouse validation uses correct field (`validated_soh`)
- No impact from `requestor_soh=0`

---

### 4. APPROVAL PAGES DISPLAY

**Files:**
- `app/approvals/[id]/page.tsx` (line 256)
- `app/pr1/[id]/page.tsx` (line 204)
- `app/pr1/[id]/print/page.tsx` (line 173)

**Current Display:**
```jsx
<td className="px-4 py-3 text-right font-mono text-xs text-[#40527A]">
  {item.stock_on_hand.toLocaleString()}
</td>
```

**Current Behavior:**
- ✓ Display-only (not editable)
- ✓ Shows under "SOH" column header
- ✓ Value: 0 (from requestor who did not enter it)
- ✗ **May confuse approvers**: "Why is SOH always 0?"

**User Perspective:**
- Approver sees PR1 items with SOH=0
- No explanation that warehouse verified SOH elsewhere
- Potential confusion about where actual inventory is

**Verdict:** ⚠ **MINOR UI/UX ISSUE (Not Functional)**
- No calculations depend on this display value
- No logic breaks
- Pure informational/display issue
- Could be resolved with UI label enhancement

---

## COMPLETE FILE AUDIT

| File | Usage | Impact |
|------|-------|--------|
| **lib/pr1.ts** | Writes `stock_on_hand=0` on submit | ✓ SAFE |
| **lib/pr2.ts** | Fetches but **does NOT use** | ✓ SAFE |
| **lib/warehouse.ts** | Copies to `requestor_soh` only | ✓ SAFE |
| **lib/canvassing.ts** | Never selected or used | ✓ SAFE |
| **lib/approvals.ts** | Included in query, display only | ⚠ MINOR |
| **app/pr1/[id]/page.tsx** | Display-only, shows 0 | ⚠ MINOR |
| **app/approvals/[id]/page.tsx** | Display-only, shows 0 | ⚠ MINOR |
| **app/pr1/[id]/print/page.tsx** | Display-only in print | ⚠ MINOR |
| **app/warehouse/[id]/page.tsx** | Uses `validated_soh` (CORRECT) | ✓ SAFE |
| **app/pr2/[id]/page.tsx** | Not referenced | ✓ SAFE |

---

## DATA FLOW TRACE

### PR1 Creation → Submission
```
Requestor sees SOH field: "—" (read-only)
  ↓
Form state: stock_on_hand = "" (empty string)
  ↓
Submit to database: stock_on_hand = 0 (default)
  ↓
pr1_items record: stock_on_hand = 0
```

### Warehouse Validation
```
PR1 items fetched: stock_on_hand = 0
  ↓
warehouse_validation_items created:
  - requestor_soh = 0 (snapshot of PR1)
  - validated_soh = NULL (warehouse fills)
  ↓
Warehouse enters validated_soh (actual inventory)
  ↓
Availability: if (validated_soh >= qty) → available
```

### Approval Workflow
```
PR1 approval displays: stock_on_hand = 0
  ↓
Display-only, no logic depends on it
  ↓
Warehouse decision used instead (validated_soh)
```

### PR2 Generation
```
RFQ closed → generatePR2FromRfq()
  ↓
PR1 items fetched with stock_on_hand = 0
  ↓
PR2 items created:
  - quantity_requested (from PR1)
  - qty_on_hand = 0 (hardcoded)
  - qty_incoming = 0 (hardcoded)
  ↓
stock_on_hand field ignored (never used)
```

---

## RISK ASSESSMENT

### Critical Issues (Would Break Functionality)
**✓ NONE**

### Warnings (UI/UX or Informational)
1. **Approval pages display `stock_on_hand=0`**
   - Impact: May confuse approvers
   - Severity: Low (display-only)
   - Resolution: Optional UI enhancement with label/tooltip

### Safe (No Impact)
1. ✓ PR2 generation: `stock_on_hand` not used in calculations
2. ✓ RFQ creation: `stock_on_hand` not selected
3. ✓ Warehouse validation: uses `validated_soh` (correct field)
4. ✓ Availability logic: depends on `validated_soh`, not `stock_on_hand`
5. ✓ No downstream calculations affected
6. ✓ Warehouse can still enter and use validated inventory

---

## MINIMUM FIXES NEEDED

### Functional (Required)
**✓ NONE** - No code changes required

### Database (Required)
**✓ NONE** - No schema changes needed

### Optional (UI/UX Enhancement)
1. **Add label clarification to approval pages:**
   - Label column header: "Requested SOH" instead of just "SOH"
   - Or add tooltip: "Warehouse validates actual SOH"

2. **Optional: Hide or deprioritize the column:**
   - Since value is always 0 and doesn't affect decisions
   - Not critical, purely for clarity

3. **Optional: Show warehouse-validated SOH in approvals:**
   - Could display `warehouse_validations.validated_soh` instead
   - Gives approvers visibility to what warehouse actually verified
   - More informative than requestor's 0 value

---

## CONCLUSION

**Implementation Safe:** ✓ **YES**

The change to make `pr1_items.stock_on_hand` always 0 (read-only) has:
- ✓ **No functional impact** - no logic breaks
- ✓ **No data flow issues** - warehouse validation unaffected
- ✓ **No calculation errors** - all decisions use `validated_soh`
- ⚠ **Minor UI/UX consideration** - approval pages show 0, could confuse users

All downstream usage is either:
1. Safe (does not use the field)
2. Safe (uses correct field instead like `validated_soh`)
3. Minor (display-only, no logic)

**No code changes required to fix any breaks. The only enhancement would be UI/UX clarification.**

