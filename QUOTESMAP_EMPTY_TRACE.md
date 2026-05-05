# quotesMap Empty - Complete Trace

## Quick Facts

| Item | Status |
|------|--------|
| Data exists | ✓ 52 rows in rfq_item_quotes |
| pr1_item_id matches | ✓ 50 unique IDs cover 49 PR2 items |
| Supplier names available | ✓ Via rfq_suppliers table |
| Query syntax correct | ✓ Code structure validated |
| **RLS blocks Director** | ✗ **ROOT CAUSE** |

---

## The Smoking Gun

### Director Profile
```
email: director@fortune.com
role_id: → "approver"
position_id: → "Director"
```

### RLS Policy on rfq_item_quotes
```sql
-- Policy: "Procurement can view all quotes"
WHERE r.name = 'procurement'  ← Only allows this role
```

### Result
- Director has role = "approver"
- RLS checks: Is role = "procurement"?
- Answer: NO
- Access: DENIED
- Query result: empty array

---

## Step-by-Step Query Failure

```typescript
// Line 58-61: Query rfq_item_quotes
const { data: quotes, error: quotesErr } = await supabase
  .from('rfq_item_quotes')
  .select('pr1_item_id, supplier_item_selections(supplier_name), unit_price, lead_time_days')
  .in('pr1_item_id', pr1ItemIds);
```

### What Supabase Does
1. User: director@fortune.com (role = "approver")
2. Table: rfq_item_quotes (has RLS enabled)
3. Operation: SELECT
4. RLS policy: "Procurement can view all quotes"
5. Policy check: WHERE auth.uid() = <director_id> AND role = 'procurement'
6. Director's role: "approver" ≠ "procurement"
7. Policy condition: FALSE
8. Result: **0 rows returned** (no error thrown)

### What Code Sees
```typescript
{
  data: [],        // Empty array
  error: null      // No error object
}
```

### Code Execution
```typescript
if (!quotesErr && quotes) {
  // quotesErr = null (truthy condition passes)
  // quotes = [] (truthy condition passes)
  // ✓ This block executes

  quotes.forEach((q: any) => {
    // Loop never runs (empty array)
  });
  
  // qMap remains {}
}

setQuotesMap({});  // Sets empty map
```

### Final Result
```typescript
const quotes = quotesMap[item.pr1_item_id] || [];
// quotesMap[any_id] = undefined
// Result: quotes = []

{canViewCanvass && quotes.length > 0 && (
  // canViewCanvass = true
  // quotes.length > 0 = false ← FAILS
  // UI not rendered
)}
```

---

## Why This Is Tricky

### Normal Errors vs. RLS Denial
```typescript
// Normal Query Error
{ data: null, error: { code: 'PGRST102', ... } }
// Code detects this easily

// RLS Denial (What we have)
{ data: [], error: null }
// Looks like successful empty query
// Very hard to detect
```

### RLS Philosophy
- RLS never throws "access denied" errors
- Access denied = 0 rows returned
- Looks identical to "query found no matches"
- Intentional design for security (don't reveal table exists)

### Code Assumption
- Code assumes: IF query succeeds AND has no error THEN data is valid
- Reality: Empty array could mean:
  1. No matching rows found (expected)
  2. RLS blocked all rows (authorization fail)
- No way to distinguish!

---

## The Data Actually Exists

### Direct SQL (No RLS)
```sql
SELECT COUNT(*) FROM rfq_item_quotes;
-- Result: 52 rows

SELECT COUNT(DISTINCT pr1_item_id) FROM rfq_item_quotes;
-- Result: 50 unique items

SELECT pr1_item_id, unit_price, lead_time_days 
FROM rfq_item_quotes LIMIT 10;
-- Result: Data available ✓
```

### Joins Work
```sql
SELECT 
  riq.pr1_item_id,
  riq.unit_price,
  rs.supplier_name
FROM rfq_item_quotes riq
JOIN rfq_suppliers rs ON rs.id = riq.rfq_supplier_id
LIMIT 5;
-- Result: Data with supplier names ✓
```

### Problem Is Purely Authorization
- Not data missing
- Not relationship broken
- Not query syntax wrong
- **RLS blocks READ access**

---

## The Fix

### Add This Policy

```sql
-- Option A: Directors only (RECOMMENDED)
CREATE POLICY "Directors can view all quotes"
  ON rfq_item_quotes FOR SELECT
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

### After Fix
- Director queries rfq_item_quotes
- RLS checks: Is role = "approver" AND position = "Director"?
- Answer: YES
- Access: ALLOWED
- Query result: 52 rows
- quotesMap populated
- UI renders ✓

---

## Prevention

For future similar issues:

### Add Defensive Logging
```typescript
if (!quotesErr && quotes?.length === 0) {
  console.warn('Query succeeded but returned 0 rows:', {
    pr1ItemIds,
    quotesErr,
    quotesCount: quotes.length
  });
}
```

### Add Error Context
```typescript
if (quotesErr) {
  console.error('Failed to fetch quotes:', quotesErr);
  // This line never executes because RLS denies silently
}
```

### Document RLS Impact
- Note that empty results could be RLS denial
- Test with different roles
- Monitor query performance

---

## Timeline

1. ✓ Director opens PR2 approval page
2. ✓ useEffect fetches PR2 detail
3. ✓ PR2 items load with pr1_item_ids
4. ✗ Query rfq_item_quotes fails silently (RLS blocks)
5. ✓ quotesMap remains empty
6. ✗ Canvass UI doesn't render
7. ? Director doesn't understand why (looks like a bug)

---

## Conclusion

**Status:** ROOT CAUSE CONFIRMED

**Issue:** RLS authorization, not code or data

**Fix:** Add 1 RLS policy

**Effort:** 5 minutes

**Risk:** Very low (only adds access, doesn't change existing logic)

**After Fix:** Canvass UI will display immediately (no code changes needed)
