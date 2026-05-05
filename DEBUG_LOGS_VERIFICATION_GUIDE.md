# Debug Logs for quotesMap Verification

**File Modified:** `app/approvals/pr2/[id]/page.tsx`  
**Date:** 2026-05-04  
**Purpose:** Identify exact point where quotesMap data flow breaks

---

## What Was Added

5 sets of temporary debug logs to trace data through the entire flow.

---

## The Five Debug Logs

### 1. PR2 Items Log (Lines 56-58)

```typescript
console.log('PR2 items:', d.items);
console.log('PR2 items count:', d.items.length);
console.log('Sample item pr1_item_id:', d.items[0]?.pr1_item_id);
```

**What it shows:**
- All PR2 items loaded from database
- Count of items (should be 49)
- First item's pr1_item_id value

**Expected output:**
```
PR2 items: Array(49) [{id: "...", pr1_item_id: "uuid", ...}, ...]
PR2 items count: 49
Sample item pr1_item_id: "a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6"
```

**If broken:**
- Count is 0 → PR2 detail not loading
- pr1_item_id is null/undefined → No link to quotes

---

### 2. PR1 Item IDs Log (Lines 62-63)

```typescript
console.log('PR1 item IDs:', pr1ItemIds);
console.log('PR1 item IDs count:', pr1ItemIds.length);
```

**What it shows:**
- Extracted IDs ready for query
- Count of valid (non-null) IDs

**Expected output:**
```
PR1 item IDs: Array(49) ["id1", "id2", "id3", ...]
PR1 item IDs count: 49
```

**If broken:**
- Count is 0 → All pr1_item_id values are null
- Count < 49 → Some items missing pr1_item_id

---

### 3. Quotes Query Error/Result Log (Lines 72-74)

```typescript
console.log('Quotes query error:', quotesErr);
console.log('Quotes query result:', quotes);
console.log('Quotes count:', quotes?.length);
```

**What it shows:**
- Whether RLS policy allows access
- Actual data returned
- Count of quotes

**Expected output:**
```
Quotes query error: null
Quotes query result: Array(52) [{pr1_item_id: "...", unit_price: 50, ...}, ...]
Quotes count: 52
```

**If broken - Scenario A (RLS Still Blocking):**
```
Quotes query error: null
Quotes query result: []
Quotes count: 0
```
→ RLS policy not working or Director not authorized

**If broken - Scenario B (Query Error):**
```
Quotes query error: {code: "...", message: "..."}
Quotes count: undefined
```
→ Actual error from database

---

### 4. quotesMap Log (Lines 86-87)

```typescript
console.log('quotesMap:', qMap);
console.log('quotesMap size:', Object.keys(qMap).length);
```

**What it shows:**
- Final populated map structure
- Number of entries

**Expected output:**
```
quotesMap: Object {
  "a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6": Array(2) [
    {supplier: "ABC Corp", unit_price: 50, lead_time: 5},
    {supplier: "XYZ Ltd", unit_price: 48, lead_time: 7}
  ],
  "b2c3d4e5-f6g7-h8i9-j0k1-l2m3n4o5p6q7": Array(1) [...]
  ...
}
quotesMap size: 49
```

**If broken - Scenario B (Mapping Failed):**
```
quotesMap: {}
quotesMap size: 0
```
→ Quotes array had data but mapping failed

---

### 5. Per-Item Lookup Log (Lines 278-285)

```typescript
if (item.item_order === 1) {
  console.log(`Item ${item.item_order}:`, {
    pr1_item_id: item.pr1_item_id,
    description: item.description,
    quotesFromMap: quotes,
    quotesCount: quotes.length,
    quotesMapKeys: Object.keys(quotesMap)
  });
}
```

**What it shows:**
- How first item looks up quotes
- Whether lookup succeeds
- All keys in map for comparison

**Expected output:**
```
Item 1: Object {
  pr1_item_id: "a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6",
  description: "Part ABC-123",
  quotesFromMap: Array(2) [{supplier: "...", ...}, {...}],
  quotesCount: 2,
  quotesMapKeys: Array(49) ["a1b2c3d4...", "b2c3d4e5...", ...]
}
```

**If broken - Scenario C (ID Mismatch):**
```
Item 1: Object {
  pr1_item_id: "a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6",
  quotesFromMap: [],
  quotesCount: 0,
  quotesMapKeys: ["xyz123...", "abc456...", ...]  ← Different IDs!
}
```
→ PR1 item IDs don't match rfq_item_quotes pr1_item_id values

---

## How to View Logs

### Step 1: Open DevTools
- Press `F12` on keyboard, OR
- Right-click → "Inspect" → "Console" tab

### Step 2: Login
- Log in as: `director@fortune.com`
- Password: (from demo data)

### Step 3: Navigate
- Go to Dashboard
- Click "PR2 Approvals"
- Click any PR2 approval detail

### Step 4: Check Console
- Look at Console tab
- Scroll to see all logs
- Logs appear in order as page loads

---

## Diagnostic Decision Tree

```
Is quotes query empty?
├─ YES (count = 0)
│  └─ SCENARIO A: RLS Blocking
│     • Check quotesErr for error
│     • Verify RLS policy exists
│     • Re-login as Director
│
└─ NO (count > 0)
   ├─ Is quotesMap empty?
   │  ├─ YES (size = 0)
   │  │  └─ SCENARIO B: Mapping Failed
   │  │     • Check quotes[0] structure
   │  │     • Verify supplier_item_selections field
   │  │
   │  └─ NO (size > 0)
   │     ├─ Does UI show canvass?
   │     │  ├─ YES → SUCCESS ✓
   │     │  │
   │     │  └─ NO → SCENARIO C: Render Condition
   │     │     • Check canViewCanvass value
   │     │     • Check profile?.role
   │     │     • Check profile?.position
   │
```

---

## Expected Log Sequence

Normal flow (page loads successfully):

```
1. PR2 items: Array(49) [...]
   PR2 items count: 49
   Sample item pr1_item_id: "uuid"

2. PR1 item IDs: Array(49) [...]
   PR1 item IDs count: 49

3. Quotes query error: null
   Quotes query result: Array(52) [...]
   Quotes count: 52

4. quotesMap: Object { ... }
   quotesMap size: 49

5. Item 1: Object { quotesCount: 2, ... }

6. [UI renders canvass section]
```

---

## Scenario Analysis

### Scenario A: RLS Still Blocking

**Logs show:**
```
Quotes query error: null
Quotes query result: []
Quotes count: 0
quotesMap: {}
quotesMap size: 0
```

**Diagnosis:**
- RLS policy not allowing Director
- OR Director not logged in correctly

**Next steps:**
1. Verify RLS policy exists:
   ```sql
   SELECT policyname FROM pg_policies WHERE tablename='rfq_item_quotes';
   ```
2. Check if Director profile has correct role/position
3. Verify Director can query other tables
4. Clear browser cache and re-login

---

### Scenario B: Mapping Failed

**Logs show:**
```
Quotes query error: null
Quotes query result: Array(52) [...]
Quotes count: 52
quotesMap: {}
quotesMap size: 0
```

**Diagnosis:**
- Data fetched successfully
- But map construction failed
- Likely: supplier_item_selections relationship returning null

**Next steps:**
1. Check first quote object:
   - Does it have `pr1_item_id`?
   - Does it have `supplier_item_selections`?
   - Is supplier_name null?

2. Add more defensive console.log:
   ```typescript
   console.log('quotes[0]:', quotes[0]);
   console.log('supplier_name:', quotes[0]?.supplier_item_selections?.supplier_name);
   ```

---

### Scenario C: Render Condition Failing

**Logs show:**
```
quotesMap: Object { ... }  (NOT empty)
quotesMap size: 49
Item 1: Object { quotesCount: 2, ... }
```

**BUT:** No canvass section visible

**Diagnosis:**
- Data exists and loads correctly
- Render condition at line 298 is false
- Likely: `canViewCanvass` is false

**Next steps:**
1. Add console.log in render section:
   ```typescript
   console.log('canViewCanvass:', canViewCanvass);
   console.log('profile:', profile);
   ```
2. Check if Director profile loaded
3. Verify Director's role and position in database

---

## Code Location Reference

| Log | Location | Lines |
|-----|----------|-------|
| PR2 items | useEffect data load | 56-58 |
| PR1 IDs | useEffect ID extraction | 62-63 |
| Query result | useEffect after query | 72-74 |
| quotesMap | useEffect after mapping | 86-87 |
| Per-item | render loop map function | 278-285 |

---

## Before/After

### Before Adding Logs
- quotesMap empty
- No visibility into where data stops
- Impossible to debug

### After Adding Logs
- Each step visible
- Exact failure point identifiable
- Root cause discoverable

---

## Removal Instructions

After identifying the issue, remove all debug logs:

1. Delete lines 56-58 (PR2 items log)
2. Delete lines 62-63 (PR1 IDs log)
3. Delete lines 72-74 (Query result log)
4. Delete lines 89-91 (Error fallback log)
5. Delete lines 86-87 (quotesMap log)
6. Delete lines 278-285 (Per-item log)

Total: ~20 lines to remove

---

## Summary

✓ **5 debug logs added**  
✓ **Syntax verified**  
✓ **No breaking changes**  
✓ **Ready for testing**

**Next:** Deploy, open browser console, test with Director account, report findings.
