# PR2 Director Price Visibility Audit

**Date:** 2026-05-04  
**Goal:** Confirm where PR2 price visibility is controlled and how to enable Director to see pricing  
**Audit Type:** Complete data flow and role/position analysis (no changes made)

---

## OBJECTIVE

Audit where PR2 price visibility is controlled and identify minimum changes needed to enable:
1. **Director position** to see selected supplier pricing
2. **Director position** to see all supplier canvass offers (not just the selected supplier)

Current state: Only procurement role can see pricing. All approvers (including Directors) see "Price Hidden".

---

## FILES INVOLVED

| File | Purpose | Role in Price Control |
|------|---------|----------------------|
| `app/approvals/pr2/[id]/page.tsx` | PR2 approval detail page | **Enforces visibility** (line 114) |
| `lib/pr2-approvals.ts` | Fetches approval data | **Fetches prices** (lines 273-277) |
| `types/approvals.ts` | Type definitions | Includes price fields |

---

## CURRENT PRICE VISIBILITY LOGIC

### Location: `app/approvals/pr2/[id]/page.tsx` (Line 114)

```typescript
const canViewPrice = profile?.role === "procurement";
```

### Logic Breakdown

- **Source of `profile.role`:** AuthContext (derived from auth.users table)
- **Role Values:** "procurement", "approver", "employee", "supplier", "warehouse"
- **Source of `profile.position`:** AuthContext (derived from user_assignments table → positions.title)

### Current Behavior

| Role/Position | Can View Prices |
|---------------|-----------------|
| Role = "procurement" | ✓ **YES** |
| Role = "approver", Position = "Department Head" | ✗ **NO** |
| Role = "approver", Position = "Director" | ✗ **NO** (should be YES) |
| Role = "approver", Position = "Finance Director" | ✗ **NO** (should be YES) |
| Role = "employee" | ✗ **NO** |
| Role = "warehouse" | ✗ **NO** |
| Role = "supplier" | ✗ **NO** |

### Display Usage

**Lines 235-242, 247-257:**

```typescript
if (canViewPrice) {
  // Show unit_price and total_price in table
  <td>₱{item.unit_price.toLocaleString(...)}</td>
  <td>₱{(item.unit_price * item.quantity_to_purchase).toLocaleString(...)}</td>
} else {
  // Show "Price Hidden" text
  <td colSpan={2}>Price Hidden</td>
}
```

---

## DIRECTOR DETECTION

### How Director is Identified

**In Database:**
- Table: `positions`
- Column: `title` = "Director"
- Linked to: `roles.name` = "approver"

**In Profile Object:**
```typescript
{
  id: string,
  role: "approver",           // All approvers share this
  position: "Director",        // Specific position (varies per person)
  // ... other fields
}
```

### Current Problem

- ✗ `canViewPrice` only checks `role === "procurement"`
- ✗ Does **NOT** check `position`
- ✗ Cannot differentiate Director from Department Head (both have role="approver")
- ✗ Finance Director also treated the same

### Solution Approach

Must check **BOTH**:
```typescript
profile.role === "approver" && profile.position === "Director"
```

---

## DATA FETCHING

### Selected Supplier Price Data

**Source:** `lib/pr2-approvals.ts` (Lines 273-277)

**Query:**
```sql
SELECT id, item_order, item_code, description, unit_of_measure,
       quantity_requested, qty_on_hand, qty_incoming,
       quantity_to_purchase, supplier_name_snapshot,
       unit_price, total_price
FROM pr2_items
WHERE pr2_id = ?
ORDER BY item_order ASC
```

**Status:**
- ✓ `unit_price` **ALWAYS fetched**
- ✓ `total_price` **ALWAYS fetched**
- ✓ Prices not filtered at database level
- ✓ All data available in `PR2ApprovalDetail.items`

**Storage:**
- Table: `pr2_items`
- Columns: `unit_price`, `total_price`
- Sourced from: `generatePR2FromRfq()` which fetches quotes from `rfq_item_quotes`

**Display Logic:**
- Data always fetched from database
- Display page checks `canViewPrice`
- If `false`: prices hidden (rendered as text, not null)

---

## CANVASS DATA AVAILABILITY

### All Supplier Offers Storage

**Table:** `rfq_item_quotes`

**Fields:**
- `rfq_supplier_id` → Which supplier submitted the quote
- `pr1_item_id` → Which PR1 item this quote is for
- `unit_price` → The quoted price
- `quoted_description` → What exactly was quoted
- `is_alternative` → Is this an alternate/substitute item?
- `lead_time_days` → Delivery timeframe

### Access Path from PR2

**Current:**
```
PR2 Item → (has pr1_item_id)
         → RFQ Item Quotes (filter: pr1_item_id)
         → Shows ONLY selected supplier price
```

**Potential:**
```
PR2 Item → pr1_item_id
         → rfq_item_quotes (filter: pr1_item_id)
         → Display ALL supplier quotes for comparison
```

### Current Status

- ✗ PR2 approval page does **NOT** fetch `rfq_item_quotes`
- ✗ Only shows the one selected supplier's price
- ✗ No UI exists to show competing offers
- ✓ Data IS available in database and accessible
- ✓ Relationship chain intact (can fetch all quotes if needed)

---

## DATA RELATIONSHIP MAP

```
PR2 Approval Detail View
├── PR2 Request
│   ├── pr2_id
│   ├── rfq_id ← Link to RFQ batch
│   ├── pr1_id ← Link to PR1 request
│   └── pr1_priority
│
├── PR2 Items (from pr2_items table)
│   ├── unit_price ← Selected supplier price ✓ Available
│   ├── total_price ← Calculated: unit_price × quantity_to_purchase
│   ├── supplier_name_snapshot ← Selected supplier name
│   ├── selected_rfq_supplier_id ← Link to rfq_suppliers
│   └── pr1_item_id ← Link back to PR1 items
│
└── (Not currently fetched but accessible)
    ├── RFQ Batch (via pr2.rfq_id)
    │   └── rfq_id
    │
    └── RFQ Item Quotes (via pr1_item_id)
        ├── rfq_supplier_id (multiple rows - different suppliers)
        ├── unit_price (each supplier's quote)
        ├── quoted_description
        └── lead_time_days
```

---

## CURRENT VISIBILITY RULES

### Who Can See Prices?

| Role/Position | Selected Supplier Price | Competing Offers | Grand Total |
|---------------|------------------------|------------------|-------------|
| Procurement | ✓ YES | ✗ NO (not fetched) | ✓ YES |
| Director | ✗ NO | ✗ NO | ✗ NO |
| Department Head | ✗ NO | ✗ NO | ✗ NO |
| Finance Director | ✗ NO | ✗ NO | ✗ NO |
| Employee | ✗ NO | ✗ NO | ✗ NO |

---

## ROOT CAUSES & GAPS

### Problem 1: Role-Only Visibility Check

**Current:**
```typescript
canViewPrice = profile?.role === "procurement"
```

**Gap:** No position differentiation within "approver" role

**Impact:** All approvers treated identically (cannot give Director special access)

### Problem 2: Position Field Not Used

**Current:** `profile.position` exists but never consulted for visibility

**Gap:** Cannot distinguish Director from Department Head

**Impact:** Directors cannot see pricing in PR2 approvals

### Problem 3: No Canvass Offer Display

**Current:** PR2 approval only shows selected supplier price

**Gap:** Director cannot see competing bids/offers

**Impact:** Limited strategic context for Director approval decision

---

## MINIMUM FIX RECOMMENDATION

### Phase 1: Enable Director Price Visibility (Simple)

**File:** `app/approvals/pr2/[id]/page.tsx` (Line 114)

**Current:**
```typescript
const canViewPrice = profile?.role === "procurement";
```

**Proposed:**
```typescript
const canViewPrice = profile?.role === "procurement"
  || (profile?.role === "approver" && profile?.position === "Director");
```

**Changes:**
- 1 line modified
- No database changes
- No new types needed
- No additional data fetching

**Effect:**
- ✓ Director can see selected supplier prices
- ✓ Department Head still CANNOT see (fails position check)
- ✓ Finance Director still CANNOT see (fails position check)
- ✓ Other roles unchanged

### Phase 2: Display All Canvass Offers (Optional, Complex)

Would require:
1. New data fetch: `rfq_item_quotes` for each `pr1_item_id`
2. New UI section: expandable/modal to show all suppliers' quotes
3. Price comparison table
4. Decision: Should it be limited to Director only, or shown after Phase 1 approval?

---

## RISKS & UNCLEAR ITEMS

### Risk 1: Position Value Consistency

**Question:** Is `profile.position` always exactly "Director" for director role?

**Risk:** If position stored as "director" (lowercase) or "Dir" or other variant, check fails silently

**Mitigation:** Verify actual position value in AuthContext before implementing

### Risk 2: Other Director Positions

**Question:** Should "Finance Director" also see prices?

**Business Decision Needed:** Yes or No?

**Proposed Answer:** YES (they approve PR2 phase 2)

### Risk 3: Phase 2 vs Phase 1 Director Access

**Question:** Finance Director is in phase 2. Should they see phase 1 prices?

**Options:**
- A: Restrict by phase (only see when approving that phase)
- B: Show all (full context regardless of phase)

**Proposed Answer:** Option B (full context for better decisions)

### Risk 4: Canvass Sensitivity

**Question:** Should Director see competing supplier quotes?

**Business Decision Needed:** Policy on quote visibility?

**Proposed Answer:** YES for Director (strategic oversight role)

---

## QUESTIONS REQUIRING APPROVAL

Before implementation, confirm:

| # | Question | Proposed Answer |
|---|----------|-----------------|
| 1 | Should "Director" position see PR2 pricing? | YES |
| 2 | Should "Finance Director" also see prices? | YES |
| 3 | Should canvass offers be visible to Director? | YES (phase 2) |
| 4 | Should Department Head see prices? | NO |
| 5 | Is `profile.position` reliably "Director" (exact value)? | **NEED VERIFICATION** |
| 6 | Should other approvers (e.g., CEO) have price visibility? | Define policy |

---

## WHAT NOT TO CHANGE

✓ Do NOT modify database schema  
✓ Do NOT change PR2 data fetching (prices always fetch)  
✓ Do NOT change PR2 creation/generation logic  
✓ Do NOT expose prices to Employee or Warehouse roles  
✓ Do NOT refactor unrelated approval code  

---

## CONCLUSION

**Current State:** ✗ Director cannot see PR2 pricing

**Root Cause:** Visibility check only uses `role`, not `position`

**Fix Complexity:** Low (1 line change for Phase 1)

**Risk Level:** Low (additive change, existing data already fetched)

**Data Availability:** ✓ All required pricing data already fetched

**Canvass Offers:** ⚠ Accessible but not currently displayed (requires UI work)

---

## AUDIT STATUS: COMPLETE - AWAITING APPROVAL

Ready for implementation when authorized.

