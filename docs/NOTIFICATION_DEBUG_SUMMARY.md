# Notification Badge Debug - Quick Summary

**Date:** June 2, 2026  
**Status:** 🔍 Debug logging added, awaiting test results

---

## ✅ What Was Done

Added detailed console logging to trace notification badge behavior:

### Modified Files:
1. `components/layout/NotificationBell.tsx` - Added logging for:
   - Component lifecycle (mount, unmount)
   - Realtime subscription status and events
   - Count updates and state changes
   - User interactions (clicks, mark as read)
   
2. `lib/notifications.ts` - Added logging for:
   - Database queries (fetch count, fetch list)
   - Insert operations (create notification)
   - Update operations (mark as read)

---

## 🧪 Quick Test Instructions

### Step 1: Open Console
1. Load your app
2. Press F12 → Console tab
3. Look for: `✅ [NotificationBell] Successfully SUBSCRIBED to realtime!`

### Step 2: Create Test Notification

**Copy your user ID from console:**
```
👤 [NotificationBell] User ID: abc-123-def-456
```

**Go to Supabase SQL Editor and run:**
```sql
INSERT INTO notifications (user_id, title, body, type, read)
VALUES (
  'YOUR-USER-ID-HERE',
  'Test Notification',
  'Testing realtime badge update',
  'info',
  false
);
```

### Step 3: Watch Console

**✅ If Working (badge should appear instantly):**
```
🔔 [NotificationBell] REALTIME INSERT EVENT RECEIVED!
✅ [NotificationBell] Count after INSERT: 1
🔄 [NotificationBell] Unread count changed to: 1
```

**❌ If NOT Working (no event received):**
- Wait 30 seconds to see if polling catches it
- Check for subscription errors
- Check user ID matches

---

## 🎯 What Console Output Tells Us

| Console Message | Meaning |
|----------------|---------|
| `✅ Successfully SUBSCRIBED` | Realtime connection working |
| `❌ CHANNEL_ERROR` | Realtime connection failed |
| `🔔 REALTIME INSERT EVENT` | New notification detected instantly |
| `⏰ Polling: Fetching...` | Backup polling is running (every 30s) |
| `🔄 Unread count changed to: X` | State updated (badge should show if X > 0) |

---

## 📋 Debug Checklist

- [ ] Console shows subscription status (SUBSCRIBED or error)
- [ ] Create test notification via SQL
- [ ] Check if INSERT event appears in console
- [ ] Verify count changes in console
- [ ] Check if badge appears on screen
- [ ] Share console output for analysis

---

## 📄 Full Documentation

See `NOTIFICATION_DEBUG_GUIDE.md` for:
- Complete console output examples
- Detailed troubleshooting steps
- Common issues and solutions
- Network debugging instructions

---

**Next Step:** Run the test and share console output to identify the exact issue!

