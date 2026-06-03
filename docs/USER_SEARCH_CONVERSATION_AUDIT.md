# User Search in Conversation Feature - Audit Report

## Executive Summary

The user search functionality in the conversation feature **ONLY searches by name**, NOT by email. This may limit discoverability when users only know someone's email address.

---

## Current Implementation

### Location
`components/messages/UserSearch.tsx`

### Search Query Analysis

```typescript
const { data, error } = await db
  .from('profiles')
  .select('id, full_name, email')
  .neq('id', currentUserId)
  .ilike('full_name', `%${query.trim()}%`)  // ← ONLY searches full_name
  .limit(8);
```

### Key Findings

#### ✅ What It Does Search:
- **`full_name`** field only
- Case-insensitive search (using `ilike`)
- Partial matches (using `%query%` pattern)
- Excludes current user (`.neq('id', currentUserId)`)
- Returns top 8 results (`.limit(8)`)

#### ❌ What It Does NOT Search:
- **Email address** - Not included in search criteria
- Department
- Position
- Role
- Any other profile fields

---

## User Experience Impact

### Current Behavior:

**Example 1: Search by Name** ✅ Works
```
Search: "John"
Result: Shows all users with "John" in their full_name
        - "John Doe"
        - "Johnny Smith"
        - "Mary Johnson"
```

**Example 2: Search by Email** ❌ Doesn't Work
```
Search: "john.doe@company.com"
Result: No users found (even if John Doe exists)
```

**Example 3: Partial Email** ❌ Doesn't Work
```
Search: "john.doe"
Result: No users found
```

### Display Information:
Even though email is fetched and **displayed** in the results:
```tsx
<p className="text-sm font-semibold text-pq-neutral-900 truncate">
  {user.full_name}  {/* ← Primary display */}
</p>
<p className="text-xs text-pq-neutral-400 truncate">
  {user.email}       {/* ← Secondary display (not searchable) */}
</p>
```

Users can **see** the email but cannot **search** by it.

---

## Comparison with Similar Features

Let me check if other user search components have different implementations:

### Admin UserSearch Component
Location: `components/admin/UserSearch.tsx`

*Note: Would need to check this file to compare search implementations*

---

## Potential Use Cases Affected

### Scenarios Where Email Search Would Help:

1. **New employee onboarding**
   - User has colleague's email from HR list
   - Doesn't know their full name yet
   - Cannot find them via search

2. **Email signature lookup**
   - User sees email in signature/footer
   - Wants to message the person
   - Must manually type their name

3. **Organization directory**
   - Company uses email-based directory
   - Users remember emails, not names
   - Search fails

4. **Multiple users with same name**
   - "John Smith" (Finance)
   - "John Smith" (Operations)
   - Email would help differentiate

5. **Preferred names vs legal names**
   - Profile shows: "Robert Johnson"
   - Known as: "Bob" or email "bob.johnson"
   - Search for "bob" fails

---

## Technical Analysis

### Current Search Performance:
```sql
-- Current query pattern:
SELECT id, full_name, email
FROM profiles
WHERE id != $currentUserId
  AND full_name ILIKE '%$query%'
LIMIT 8;
```

**Index Support:**
- Likely uses `profiles` table scan or GIN index on `full_name`
- Good for name searches

### Proposed Enhanced Search:
```sql
-- Enhanced query pattern:
SELECT id, full_name, email
FROM profiles
WHERE id != $currentUserId
  AND (
    full_name ILIKE '%$query%'
    OR email ILIKE '%$query%'
  )
LIMIT 8;
```

**Index Considerations:**
- Would benefit from GIN indexes on both `full_name` and `email`
- Slightly slower but more comprehensive

---

## Search Behavior Details

### Minimum Query Length:
```typescript
if (query.trim().length < 2) {
  setResults([]);
  setIsOpen(false);
  return;
}
```
- **Requires at least 2 characters** to search
- Prevents single-character searches
- Good for performance

### Debouncing:
```typescript
debounceRef.current = setTimeout(async () => {
  // Perform search
}, 300);
```
- **300ms delay** after user stops typing
- Reduces unnecessary API calls
- Good UX practice

### Results Limit:
```typescript
.limit(8);
```
- Shows **maximum 8 results**
- Dropdown shows scrollbar if needed
- Good for dropdown UI

---

## Recommendations

### Priority: Medium-High

### Option 1: Add Email to Search (Recommended) ⭐
**Impact:** High discoverability improvement
**Effort:** Low (single line change)

```typescript
.or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
```

**Pros:**
- Comprehensive search
- Minimal code change
- Better user experience

**Cons:**
- Slightly more complex query
- May need index optimization

### Option 2: Search Email Only if Contains "@" (Smart Detection)
**Impact:** Moderate improvement
**Effort:** Low

```typescript
const searchField = query.includes('@') ? 'email' : 'full_name';
// Then use searchField in query
```

**Pros:**
- Automatic field detection
- More efficient queries
- Smart UX

**Cons:**
- Cannot search both simultaneously
- User must know the pattern

### Option 3: Separate Email Search Mode (Toggle)
**Impact:** Moderate
**Effort:** Medium

Add toggle button to switch between name/email search.

**Pros:**
- Clear user intent
- Most efficient queries

**Cons:**
- Extra UI element
- User must manually switch

### Option 4: Full-Text Search with Ranking
**Impact:** High (best results)
**Effort:** High

Implement PostgreSQL full-text search with result ranking.

**Pros:**
- Most powerful search
- Ranked results
- Handles typos

**Cons:**
- Complex implementation
- Requires FTS indexes
- Overkill for simple search

---

## Comparison with Industry Standards

### Common Patterns:

| Platform | Search Fields |
|----------|---------------|
| **Slack** | Name, Email, Username |
| **Microsoft Teams** | Name, Email |
| **Gmail Chat** | Name, Email |
| **WhatsApp Web** | Name, Phone |
| **LinkedIn** | Name (Email separate) |
| **Our App** | ❌ Name only |

Most messaging platforms search both name and email.

---

## Testing Recommendations

If email search is added:

1. **Test email search**
   - Full email: "john.doe@company.com" ✓
   - Partial email: "john.doe" ✓
   - Domain: "@company.com" ✓

2. **Test name search still works**
   - Full name: "John Doe" ✓
   - First name: "John" ✓
   - Last name: "Doe" ✓

3. **Test combined results**
   - Query "john" should return both:
     - Users named "John"
     - Users with "john" in email

4. **Test performance**
   - Large user base (1000+ users)
   - Response time < 500ms
   - No UI lag

5. **Test edge cases**
   - Special characters in email
   - Unicode characters in names
   - Very long emails/names

---

## Current Code Location

```
File: components/messages/UserSearch.tsx
Line: 54 - Query implementation
Line: 55 - .ilike('full_name', ...)
```

---

## Conclusion

### Current State: ⚠️ Limited Search Capability
- **Searches:** Name only
- **Misses:** Email addresses
- **Impact:** Reduced discoverability

### Recommended Action: 
✅ **Add email to search criteria** (Option 1)

**Reasoning:**
- Low implementation effort
- High user experience improvement
- Aligns with industry standards
- No breaking changes

**Expected Outcome:**
- Users can find colleagues by email
- Better conversation initiation
- Fewer support tickets about "can't find user"

---

**Audit Date:** June 3, 2026  
**Auditor:** Kiro AI Assistant  
**Status:** ⚠️ Enhancement Recommended  
**Priority:** Medium-High
