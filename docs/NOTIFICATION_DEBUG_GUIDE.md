# Notification Badge Debug Guide

**Date:** June 2, 2026  
**Status:** 🔍 Debug Logging Active  
**Issue:** Red badge not showing when notification received (Realtime enabled but still not working)

---

## 🎯 What Was Added

Added comprehensive debug logging to trace the complete notification flow:

### Files Modified:
1. ✅ `components/layout/NotificationBell.tsx` - Component lifecycle and realtime events
2. ✅ `lib/notifications.ts` - Database queries and operations

---

## 📊 What to Look For in Console

### 1. **Component Mount** (Should see immediately on page load)

```
🚀 [NotificationBell] Component mounted
👤 [NotificationBell] User ID: <your-user-id>
🔢 [NotificationBell] Initial unread count: 0
```

**Expected:** Shows your user ID and initial count (usually 0)

---

### 2. **Initial Count Fetch** (Happens right after mount)

```
📥 [NotificationBell] Fetching initial unread count for user: <user-id>
🔢 [notifications.ts] Fetching unread count for user: <user-id>
✅ [notifications.ts] Unread count: 0
✅ [NotificationBell] Initial count fetched: 0
🔄 [NotificationBell] Unread count changed to: 0
```

**Expected:** Fetches count from database on mount

---

### 3. **Realtime Subscription Setup** (Critical!)

```
📡 [NotificationBell] Setting up realtime subscription for user: <user-id>
📡 [NotificationBell] Channel name: notifications:<user-id>
📡 [NotificationBell] Subscription status: SUBSCRIBED
✅ [NotificationBell] Successfully SUBSCRIBED to realtime!
```

**✅ If you see "SUBSCRIBED":** Realtime is working!  
**❌ If you see "CHANNEL_ERROR" or "TIMED_OUT":** Realtime connection failed  
**❌ If you see nothing:** Subscription not connecting at all

---

### 4. **Polling Setup** (Backup mechanism)

```
⏰ [NotificationBell] Starting polling interval (30s) for user: <user-id>
```

**Expected:** Starts immediately after mount  
**Note:** You'll see polling fetch every 30 seconds

---

### 5. **When New Notification is Created** (The CRITICAL test!)

#### Expected Console Output:
```
🔔 [NotificationBell] REALTIME INSERT EVENT RECEIVED!
🔔 [NotificationBell] Payload: { ... notification data ... }
📊 [NotificationBell] Current count before refresh: 0
🔢 [notifications.ts] Fetching unread count for user: <user-id>
✅ [notifications.ts] Unread count: 1
✅ [NotificationBell] Count after INSERT: 1
🔄 [NotificationBell] Unread count changed to: 1
```

**✅ If you see this:** Realtime is working perfectly! Badge should appear.  
**❌ If you DON'T see INSERT event:** Realtime is NOT receiving events (main issue!)

---

### 6. **Polling Fetch** (Every 30 seconds)

```
⏰ [NotificationBell] Polling: Fetching unread count...
🔢 [notifications.ts] Fetching unread count for user: <user-id>
✅ [notifications.ts] Unread count: 1
✅ [NotificationBell] Polling: Count fetched: 1
🔄 [NotificationBell] Unread count changed to: 1
```

**Expected:** Runs every 30 seconds as backup

---

### 7. **When Notification is Clicked**

```
👆 [NotificationBell] Notification clicked: <notification-id>
📖 [NotificationBell] Marking notification as read: <notification-id>
📖 [notifications.ts] Marking notification as read: <notification-id>
✅ [notifications.ts] Marked as read successfully
✅ [NotificationBell] Marked as read
📊 [NotificationBell] Decremented count: 1 → 0
🔄 [NotificationBell] Unread count changed to: 0
```

**Expected:** Badge count decreases, UPDATE event may fire

---

## 🧪 Test Procedure

### Test 1: Check Realtime Connection

1. **Load the page** where NotificationBell is rendered (usually in header)
2. **Open browser console** (F12 → Console tab)
3. **Look for:**
   ```
   ✅ [NotificationBell] Successfully SUBSCRIBED to realtime!
   ```

**Result:**
- ✅ **If you see it:** Realtime connection is working
- ❌ **If you don't:** Realtime is NOT connecting (check error messages)

---

### Test 2: Create Test Notification via SQL

1. **Get your user ID** from console:
   ```
   👤 [NotificationBell] User ID: abc-123-def-456
   ```

2. **Go to Supabase Dashboard** → SQL Editor

3. **Run this SQL** (replace `<your-user-id>` with actual ID from step 1):
   ```sql
   INSERT INTO notifications (user_id, title, body, type, read)
   VALUES (
     '<your-user-id>',
     'Test Notification - Debug',
     'If you see this instantly, realtime is working!',
     'info',
     false
   );
   ```

4. **Watch the console immediately** - you should see:
   ```
   🔔 [NotificationBell] REALTIME INSERT EVENT RECEIVED!
   ```

**Results:**
- ✅ **Event received instantly:** Realtime is working! Badge should show.
- ⏰ **Event received after ~30 seconds:** Realtime NOT working, polling caught it.
- ❌ **No event even after 30+ seconds:** Neither realtime nor polling is working.

---

### Test 3: Create Notification Through App

1. **Perform an action** that creates a notification (e.g., submit PR1 for approval)

2. **Check console** for:
   ```
   📝 [notifications.ts] Creating notification: {...}
   ✅ [notifications.ts] Notification created successfully
   🔔 [NotificationBell] REALTIME INSERT EVENT RECEIVED!
   ```

3. **Check badge** appears instantly

---

## 🔍 Common Issues & Solutions

### Issue 1: "SUBSCRIBED" but no INSERT events

**Symptom:**
```
✅ [NotificationBell] Successfully SUBSCRIBED to realtime!
(create notification)
❌ No INSERT event received
```

**Possible Causes:**
1. **User ID mismatch:** The `user_id` in notification doesn't match `profile.id`
2. **Filter issue:** Realtime filter `user_id=eq.<id>` not matching
3. **Realtime publication settings:** Realtime enabled but not publishing INSERT events

**Solutions:**

#### Check User ID Match:
```sql
-- In Supabase SQL Editor
SELECT id, email FROM profiles WHERE email = 'your-email@example.com';
-- Note the ID, then:
SELECT * FROM notifications WHERE user_id = '<that-id>' ORDER BY created_at DESC LIMIT 5;
```

Compare the user ID from console with the notification user_id.

#### Check Realtime Publication Settings:
1. Supabase Dashboard → Database → Replication
2. Click on `notifications` table
3. Ensure:
   - ✅ Realtime: Enabled
   - ✅ INSERT events: Enabled
   - ✅ UPDATE events: Enabled

---

### Issue 2: Subscription fails (CHANNEL_ERROR or TIMED_OUT)

**Symptom:**
```
📡 [NotificationBell] Subscription status: CHANNEL_ERROR
❌ [NotificationBell] Channel error - Realtime may not be working
```

**Possible Causes:**
1. Realtime not fully enabled on Supabase project
2. Network/firewall blocking WebSocket connections
3. Supabase project issue

**Solutions:**

#### Check Network Tab:
1. Open DevTools → Network tab
2. Filter by "WS" (WebSocket)
3. Look for Supabase realtime connection
4. Should show: `Status: 101 Switching Protocols`

#### Check Supabase Realtime Status:
1. Supabase Dashboard → Project Settings → API
2. Look for "Realtime URL" - should be enabled
3. Check project status (not paused/suspended)

#### Add Realtime Config to Supabase Client:

Edit `lib/supabase.ts`:
```typescript
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
```

---

### Issue 3: No subscription status message at all

**Symptom:**
```
📡 [NotificationBell] Setting up realtime subscription...
(nothing else)
```

**Possible Causes:**
1. Supabase client not initialized properly
2. Profile/user not loaded
3. Component unmounting too quickly

**Solutions:**
- Check that you're logged in
- Check console for user ID: `👤 [NotificationBell] User ID: ...`
- If user ID is undefined, auth context may be broken

---

### Issue 4: Count fetched but badge doesn't show

**Symptom:**
```
✅ [notifications.ts] Unread count: 3
🔄 [NotificationBell] Unread count changed to: 3
(but no red badge visible)
```

**Possible Causes:**
1. CSS issue - badge hidden
2. Z-index problem
3. Color not rendering

**Solutions:**

#### Quick CSS Test:
Add inline styles to badge in `NotificationBell.tsx`:
```tsx
{unreadCount > 0 && (
  <span 
    className="..." 
    style={{ 
      backgroundColor: 'red', 
      color: 'white', 
      zIndex: 9999,
      display: 'flex'
    }}
  >
    {unreadCount}
  </span>
)}
```

#### Check Tailwind Config:
Verify `bg-pq-danger-1000` is defined in your Tailwind config.

---

## 📊 Debug Checklist

Run through this checklist with console open:

- [ ] Console shows: `✅ Successfully SUBSCRIBED to realtime!`
- [ ] WebSocket connection visible in Network tab (Status: 101)
- [ ] Create test notification via SQL
- [ ] Console shows: `🔔 REALTIME INSERT EVENT RECEIVED!`
- [ ] Console shows: `🔄 Unread count changed to: 1` (or higher)
- [ ] Badge appears on bell icon
- [ ] Badge shows correct count
- [ ] Clicking notification triggers: `👆 Notification clicked`
- [ ] Badge count decreases after clicking
- [ ] Console shows: `🔔 REALTIME UPDATE EVENT RECEIVED!` (when marking read)

---

## 🎯 Expected Full Flow

### Perfect Working State:

```
// Page Load
🚀 [NotificationBell] Component mounted
👤 [NotificationBell] User ID: abc-123-def
📥 [NotificationBell] Fetching initial unread count...
✅ [NotificationBell] Initial count fetched: 0
🔄 [NotificationBell] Unread count changed to: 0
📡 [NotificationBell] Setting up realtime subscription...
📡 [NotificationBell] Subscription status: SUBSCRIBED
✅ [NotificationBell] Successfully SUBSCRIBED to realtime!
⏰ [NotificationBell] Starting polling interval (30s)...

// New Notification Created
🔔 [NotificationBell] REALTIME INSERT EVENT RECEIVED!
🔢 [notifications.ts] Fetching unread count...
✅ [notifications.ts] Unread count: 1
✅ [NotificationBell] Count after INSERT: 1
🔄 [NotificationBell] Unread count changed to: 1
↑↑↑ BADGE APPEARS HERE ↑↑↑

// User Clicks Bell
📥 [NotificationBell] Loading notifications for dropdown...
📥 [notifications.ts] Fetching notifications...
✅ [notifications.ts] Fetched notifications: 1
✅ [NotificationBell] Loaded notifications: 1

// User Clicks Notification
👆 [NotificationBell] Notification clicked: xyz-789
📖 [NotificationBell] Marking notification as read...
✅ [notifications.ts] Marked as read successfully
📊 [NotificationBell] Decremented count: 1 → 0
🔄 [NotificationBell] Unread count changed to: 0
🔄 [NotificationBell] REALTIME UPDATE EVENT RECEIVED!
↑↑↑ BADGE DISAPPEARS HERE ↑↑↑
```

---

## 🔧 Next Steps

1. **Load your app with console open**
2. **Copy the entire console output** (especially the subscription status part)
3. **Run Test 2** (SQL insert) and copy those logs too
4. **Share the logs** to identify exact issue

The logs will tell us:
- ✅ Is realtime connecting?
- ✅ Are events being received?
- ✅ Is the count updating?
- ✅ Where exactly is the flow breaking?

---

**Created:** June 2, 2026  
**Status:** Debug logging active - awaiting test results  
**Action Required:** Run tests and check console output

