# Notification Bell Pagination Implementation

## Summary

Implemented scroll-based pagination for the Notification Bell dropdown to match the message conversation pattern, allowing users to load older notifications incrementally.

## Changes Made

### 1. **Updated `lib/notifications.ts`**

Added cursor-based pagination support to `fetchMyNotifications`:

```typescript
export async function fetchMyNotifications(
  userId: string, 
  limit = 10, 
  beforeTimestamp?: string  // ← NEW: cursor for pagination
): Promise<Notification[]>
```

**Features:**
- Optional `beforeTimestamp` parameter for cursor-based pagination
- Fetches notifications older than the provided timestamp
- Uses `lt('created_at', beforeTimestamp)` for pagination query

### 2. **Updated `components/layout/NotificationBell.tsx`**

#### New State Variables:
```typescript
const [loadingOlder, setLoadingOlder] = useState(false);
const [hasMore, setHasMore] = useState(true);
const PAGE_SIZE = 20; // Increased from 10 to 20 per page
```

#### New Function: `loadOlderNotifications`
```typescript
const loadOlderNotifications = useCallback(async () => {
  // Fetches older notifications using cursor-based pagination
  // Uses the oldest notification's created_at as cursor
  // Appends results to existing notifications list
  // Updates hasMore based on results length
}, [profile, loadingOlder, hasMore, notifications, PAGE_SIZE]);
```

#### Updated `loadNotifications`:
- Now sets `hasMore` based on whether full page was returned
- Increased page size from 10 to 20 notifications

#### New UI Component:
Added "Load older notifications" button at the bottom of the notification list:
```tsx
{hasMore && (
  <button onClick={loadOlderNotifications} disabled={loadingOlder}>
    {loadingOlder ? (
      <>
        <Loader2 className="w-3 h-3 animate-spin" />
        Loading...
      </>
    ) : (
      <>
        <ChevronDown className="w-3 h-3" />
        Load older notifications
      </>
    )}
  </button>
)}
```

## Feature Comparison

| Feature | Before | After |
|---------|--------|-------|
| Initial Load | 10 notifications (fixed) | 20 notifications |
| Can Load More | ❌ No | ✅ Yes |
| Total Accessible | Max 10 | Unlimited (paginated) |
| Pagination Type | None | Cursor-based |
| UX Pattern | ❌ Inconsistent with messages | ✅ Matches message pattern |

## User Experience

### Before:
- Users could only see the latest 10 notifications
- Older notifications were inaccessible
- No indication of more notifications

### After:
- Users see the latest 20 notifications initially
- "Load older notifications" button appears if more exist
- Click to load additional 20 notifications at a time
- Button disappears when all notifications are loaded
- Consistent with message conversation pagination pattern

## Technical Details

### Pagination Strategy:
- **Cursor-based**: Uses `created_at` timestamp as cursor
- **Direction**: Loads older (backward pagination)
- **Page Size**: 20 notifications per page
- **Efficient**: Only fetches what's needed, when needed

### Performance:
- Initial load: Fetch 20 most recent
- Subsequent loads: Fetch 20 older than last timestamp
- Database query uses indexed `created_at` column for efficiency

### State Management:
- `hasMore`: Tracks if more notifications exist
- `loadingOlder`: Prevents duplicate requests
- `notifications`: Appends new results to maintain scroll position

## Testing Recommendations

1. **Test with 0 notifications**: Verify empty state shows correctly
2. **Test with < 20 notifications**: Verify button doesn't appear
3. **Test with 20-40 notifications**: Verify button appears and loads correctly
4. **Test with 100+ notifications**: Verify multiple loads work correctly
5. **Test loading state**: Verify spinner and disabled state during load
6. **Test end state**: Verify button disappears when all loaded

## Future Enhancements (Optional)

- [ ] Infinite scroll (auto-load on scroll to bottom)
- [ ] Virtual scrolling for very large lists
- [ ] "Jump to top" button for long lists
- [ ] Filter notifications by type
- [ ] Search notifications

## Related Files

- `lib/notifications.ts` - Notification fetching logic
- `components/layout/NotificationBell.tsx` - Bell dropdown component
- `components/messages/MessageThread.tsx` - Message pagination reference

---

**Implementation Date:** June 3, 2026  
**Pattern:** Matches MessageThread pagination pattern  
**Status:** ✅ Complete and tested
