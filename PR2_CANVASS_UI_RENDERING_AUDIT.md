# PR2 Canvass UI Rendering Audit

**Date:** 2026-05-04  
**File:** `app/approvals/pr2/[id]/page.tsx`  
**Goal:** Find where canvass UI is rendered and identify why it's not visible  
**Status:** AUDIT ONLY (no changes made)

---

## EXECUTIVE SUMMARY

**Finding:** ✓ UI is correctly placed, but likely invisible due to **empty quotesMap** (no data from query)

The canvass UI structure, placement, and logic are all correct. The invisibility is almost certainly a **data issue**, not a rendering issue.

---

## LOCATION MAP

| Component | Line | Status |
|-----------|------|--------|
| State: quotesMap | 42 | ✓ Defined |
| useEffect: Data fetch | 44-82 | ✓ Correct |
| Guard: canViewCanvass | 146 | ✓ Correct |
| Items loop start | 256 | ✓ Correct |
| Quotes extraction | 257 | ✓ Correct |
| Canvass condition | 279 | ✓ Correct |
| Canvass UI (details) | 282-297 | ✓ Correct |

---

## SECTION 1: ITEM TABLE RENDERING

### Location
- **File:** `app/approvals/pr2/[id]/page.tsx`
- **Lines:** 255-304 (tbody)
- **Structure:** `detail.items.map(item => { ... })`

### Code
```tsx
<tbody className="divide-y divide-[#D8E2FF]">
  {detail.items.map(item => {
    const quotes = item.pr1_item_id ? quotesMap[item.pr1_item_id] || [] : [];
    return (
      <>
        {/* Item row here */}
      </>
    );
  })}
</tbody>
```

**Status:** ✓ Correct

---

## SECTION 2: CANVASS UI PLACEMENT

### Placement Verification

| Check | Result | Location |
|-------|--------|----------|
| Inside tbody | ✓ YES | Lines 255-304 |
| After item <tr> | ✓ YES | After line 278 |
| Using fragment | ✓ YES | Lines 259-301 |
| Conditional render | ✓ YES | Line 279 |

### Code Structure
```tsx
<tbody>
  {items.map(item => (
    <>
      <tr>...</tr>                    {/* Line 260-278 */}
      {canViewCanvass && ...          {/* Line 279 - THIS IS CORRECT */}
        <tr className="...">          {/* Canvass row */}
          ...
        </tr>
      }
    </>
  ))}
</tbody>
```

**Status:** ✓ CORRECT PLACEMENT

---

## SECTION 3: VISIBILITY CONDITION

### Guard Definition (Line 146)

```typescript
const canViewCanvass = profile?.role === 'procurement' 
  || (profile?.role === 'approver' && profile?.position === 'Director');
```

### Logic Breakdown
- **Check 1:** `profile?.role === 'procurement'` ✓
- **Check 2:** `profile?.role === 'approver'` ✓
- **Check 3:** `profile?.position === 'Director'` ✓

### Who Can See Canvass
| Role/Position | Access |
|---|---|
| Procurement | ✓ YES (role check) |
| Director | ✓ YES (role + position) |
| Department Head | ✗ NO (position fails) |
| Others | ✗ NO (role fails) |

**Status:** ✓ CORRECT LOGIC

---

## SECTION 4: RENDERING CONDITION

### Line 279
```tsx
{canViewCanvass && quotes.length > 0 && (
  <tr className="bg-[#F9FBFF] border-t border-[#E8F0FF]">
    ...
  </tr>
)}
```

### Condition Breakdown
1. `canViewCanvass` — Authorization gate ✓
2. `quotes.length > 0` — Data existence check ✓
3. Both must be true for display ✓

**Status:** ✓ CORRECT CONDITION

---

## SECTION 5: DATA FETCHING

### useEffect Structure (Lines 44-82)

```typescript
useEffect(() => {
  if (!instanceId) return;
  (async () => {
    try {
      const d = await fetchPR2ApprovalDetail(instanceId);
      setDetail(d);
      
      // FETCH CANVASS DATA
      const pr1ItemIds = d.items.map(i => i.pr1_item_id).filter(Boolean);
      if (pr1ItemIds.length > 0) {
        const { data: quotes, error: quotesErr } = await supabase
          .from('rfq_item_quotes')
          .select('pr1_item_id, supplier_item_selections(supplier_name), unit_price, lead_time_days')
          .in('pr1_item_id', pr1ItemIds);
        
        if (!quotesErr && quotes) {
          const qMap = {};
          quotes.forEach((q) => {
            if (!qMap[q.pr1_item_id]) qMap[q.pr1_item_id] = [];
            qMap[q.pr1_item_id].push({
              supplier: q.supplier_item_selections?.supplier_name || 'Unknown',
              unit_price: q.unit_price,
              lead_time: q.lead_time_days || 0
            });
          });
          setQuotesMap(qMap);
        }
      }
    } catch (err) {
      setError('Failed to load approval details.');
    }
  })();
}, [instanceId]);
```

### Query Details
- **Table:** `rfq_item_quotes`
- **Join:** `pr1_item_id IN (...)`
- **Relationship:** `supplier_item_selections(supplier_name)`
- **Fields:** `unit_price`, `lead_time_days`

**Status:** ✓ CORRECT FETCH

---

## SECTION 6: DATA MAPPING

### Line 257: Quote Extraction
```typescript
const quotes = item.pr1_item_id ? quotesMap[item.pr1_item_id] || [] : [];
```

### quotesMap Structure
```
quotesMap = {
  'pr1-item-123': [
    { supplier: 'ABC Corp', unit_price: 100, lead_time: 5 },
    { supplier: 'XYZ Ltd', unit_price: 95, lead_time: 7 }
  ],
  'pr1-item-456': [
    { supplier: 'DEF Inc', unit_price: 110, lead_time: 3 }
  ]
}
```

### Mapping Logic
1. Extract `pr1_item_id` from item
2. Look up `quotesMap[pr1_item_id]`
3. Default to empty array if not found
4. Pass to `quotes` variable

**Status:** ✓ CORRECT MAPPING

---

## SECTION 7: UI DISPLAY

### Canvass Section (Lines 282-297)

```tsx
<details className="cursor-pointer">
  <summary className="text-xs font-semibold text-[#40527A] hover:text-[#0F1F3A]">
    Other Supplier Quotes ({quotes.length})
  </summary>
  <div className="mt-2 ml-2 text-xs">
    <div className="inline-grid grid-cols-3 gap-4">
      {quotes.map((q, idx) => (
        <div key={idx} className="text-[#40527A]">
          <div className="font-mono">{q.supplier}</div>
          <div className="text-[#0F1F3A] font-semibold">
            ₱{q.unit_price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[#BFC7D5] text-xs">{q.lead_time}d</div>
        </div>
      ))}
    </div>
  </div>
</details>
```

### Display Format
- **Element:** `<details>` (expandable)
- **Summary:** "Other Supplier Quotes (N)"
- **Content:** Grid of 3 columns
- **Per Quote:** Supplier name, unit price, lead time

**Status:** ✓ CORRECT UI

---

## ROOT CAUSE ANALYSIS

### What's Working ✓
1. **UI Placement:** Correctly positioned after item row
2. **Role Guard:** Properly checks procurement/director
3. **Rendering Logic:** Correct conditional rendering
4. **Data Structure:** quotesMap correctly mapped
5. **Query:** Fetches rfq_item_quotes with relationship

### Why It's Not Visible ✗
**Most Likely Cause: quotesMap is EMPTY**

Evidence:
- `quotes.length > 0` check will fail if quotesMap is empty
- Rendering condition won't execute if `quotes.length === 0`
- UI code is correct, so data fetch must be the issue

---

## LIKELY ROOT CAUSES (In Order of Probability)

### 1. quotesMap Empty — Data Fetch Failing (HIGH PROBABILITY)

**Symptoms:**
- No canvass section appears
- quotesMap state remains `{}`
- quotes array is always `[]`

**Possible Causes:**
- `quotesErr` is set (query error)
- `quotes` is null/undefined
- Silent error handling (not logged)

**Where to Check:**
```typescript
// Line 63-74
if (!quotesErr && quotes) {
  // This block may not be executing
  // quotesErr might be non-null OR quotes might be null
}
```

### 2. supplier_item_selections Relationship Missing (HIGH PROBABILITY)

**Symptoms:**
- Query returns data but supplier_name is NULL
- Supplier shows as "Unknown"
- quotesMap populates but with empty supplier names

**Root Cause:**
- `supplier_item_selections` table doesn't exist
- Relationship is misconfigured
- RLS policies block the relationship fetch

### 3. No Data in rfq_item_quotes (MEDIUM PROBABILITY)

**Symptoms:**
- Database query returns empty array
- No quotes exist for any PR1 items
- RFQ has no supplier quotes

**Where to Check:**
- Does the PR2 link to an RFQ?
- Does that RFQ have supplier submissions?
- Are quotes linked to pr1_item_id?

### 4. RLS Policy Blocking Query (MEDIUM PROBABILITY)

**Symptoms:**
- Query fails silently
- quotesErr is set but not logged
- quotesMap stays empty

**Where to Check:**
- `rfq_item_quotes` RLS policies
- Is the authenticated user allowed to read?
- Does procurement role have access?

### 5. Profile Not Authorized (LOW PROBABILITY)

**Symptoms:**
- canViewCanvass is false even for procurement
- UI is correctly hidden per business rules

**Where to Check:**
- `profile?.role` is NOT "procurement"
- `profile?.position` is NOT "Director" (if approver)

---

## DEBUGGING CHECKLIST

### Step 1: Verify quotesMap Has Data

Add to useEffect (after line 73):
```typescript
console.log('quotesMap populated:', qMap);
console.log('quotesMap size:', Object.keys(qMap).length);
```

### Step 2: Verify pr1ItemIds Are Collected

Add to useEffect (after line 56):
```typescript
console.log('pr1ItemIds:', pr1ItemIds);
console.log('pr1ItemIds count:', pr1ItemIds.length);
```

### Step 3: Verify Query Result

Add to useEffect (after line 61):
```typescript
console.log('quotes query result:', quotes);
console.log('quotes error:', quotesErr);
console.log('quotes count:', quotes?.length);
```

### Step 4: Verify Profile Authorization

Add before render (around line 145):
```typescript
console.log('profile.role:', profile?.role);
console.log('profile.position:', profile?.position);
console.log('canViewCanvass:', canViewCanvass);
```

### Step 5: Verify quotes Per Item

Add in render loop (around line 257):
```typescript
console.log(`Item ${item.item_order}:`, {
  pr1_item_id: item.pr1_item_id,
  quotesCount: quotes.length,
  quotes: quotes
});
```

---

## SECTION 8: DATABASE RELATIONSHIP CHECK

### Expected Schema

**rfq_item_quotes:**
```
id: uuid
rfq_supplier_id: uuid (FK → rfq_suppliers)
pr1_item_id: uuid (FK → pr1_requests.items? or pr1_items?)
unit_price: numeric
lead_time_days: integer
quoted_description: text
is_alternative: boolean
```

**supplier_item_selections (if exists):**
```
id: uuid
rfq_supplier_id: uuid
supplier_name: text
```

### Query Validation

Current query (line 60):
```typescript
.select('pr1_item_id, supplier_item_selections(supplier_name), unit_price, lead_time_days')
```

**Questions:**
- ✓ Does `pr1_item_id` column exist in `rfq_item_quotes`?
- ? Does `supplier_item_selections` relationship exist?
- ? Is relationship configured in Supabase?
- ? Does the authenticated user have RLS access?

---

## SECTION 9: RLS POLICY CHECK

### rfq_item_quotes RLS

Expected policies:
```sql
-- Procurement can read all
CREATE POLICY "Procurement can view all quotes"
  ON rfq_item_quotes FOR SELECT
  TO authenticated
  USING (auth.jwt()->>'role' = 'procurement');

-- Suppliers can read their own
CREATE POLICY "Suppliers can read own quotes"
  ON rfq_item_quotes FOR SELECT
  TO authenticated
  USING (EXISTS(
    SELECT 1 FROM rfq_suppliers rs
    WHERE rs.id = rfq_item_quotes.rfq_supplier_id
    AND rs.supplier_id = auth.uid()
  ));
```

**Check:**
- Are these policies configured?
- Does procurement role have access?

---

## CONCLUSION

### UI Rendering: ✓ CORRECT
- Placement is correct (after item row, inside tbody)
- Condition is correct (canViewCanvass && quotes.length > 0)
- Structure is correct (details/summary/grid)

### Data Flow: ✗ LIKELY BROKEN
- quotesMap is probably empty
- Either query fails or returns no data
- Relationship `supplier_item_selections` may not exist

### Next Action
**Run debug console.logs to identify which step is failing:**
1. Is pr1ItemIds collected? (YES/NO)
2. Does query execute? (YES/NO)
3. Does query return data? (YES/NO)
4. Is relationship accessible? (YES/NO)
5. Is quotesMap populated? (YES/NO)
6. Is canViewCanvass true? (YES/NO)

---

## AUDIT STATUS: COMPLETE

**Recommendation:** Add debugging logs, then identify which data layer is failing.