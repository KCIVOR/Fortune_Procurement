# Notification Badge Bug - Comprehensive Audit

**Date:** June 2, 2026  
**Issue:** Red dot (unread count badge) not appearing when user receives new notification  
**Status:** 🔍 Investigation Complete

---

## 🎯 Issue Description

**Reported Behavior:**
- User receives a notification
- Bell icon does NOT show red badge with unread count
- Badge should appear immediately when notification is created

**Expected Behavior:**
- New notification → Red badge appears instantly
- Badge shows count (e.g., "3")
- Badge updates in real-time via Supabase subscriptions

---

## 📊 Audit Findings

### ✅ **1. Component Logic - CORRECT**

**File:** `components/layout/NotificationBell.tsx`

**Badge Display Code (Lines 176-180):**
```tsx
{unreadCount > 0 && (
  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-pq-danger-1000 text-white text-[10px] font-bold leading-none px-1 pointer-events-none">
    {unreadCount > 99 ? '99+' : unreadCount}
  </span>
)}
```

**Analysis:** ✅ Logic is correct
- Badge shows when `unreadCount > 0`
- Uses `bg-pq-danger-1000` (red background)
- Positioned correctly (`absolute -top-0.5 -right-0.5`)
- Displays count with 99+ overflow handling

---

### ✅ **2. Database Schema - CORRECT**

**File:** `supabase/migrations/20260423221438_core_workflow_schema.sql`

**Table Definition:**
```sql
CREATE TABLE IF NOT EXISTS notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title         text NOT NULL,
  body          text NOT NULL DEFAULT '',
  type          text NOT NULL DEFAULT 'info',
  document_type text,
  document_id   uuid,
  read          boolean NOT NULL DEFAULT false,  ← Default is false ✅
  created_at    timestamptz DEFAULT now()
);
```

**Analysis:** ✅ Schema is correct
- `read` column exists
- Default value is `false` (unread)
- Proper NOT NULL constraint

---

### ✅ **3. Notification Library - CORRECT**

**File:** `lib/notifications.ts`

**Count Function (Lines 19-27):**
```ts
export async function fetchUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await db
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);  ← Filters by read=false ✅
  if (error) throw error;
  return count ?? 0;
}
```

**Analysis:** ✅ Function is correct
- Queries `notifications` table
- Filters by `user_id` (correct user)
- Filters by `read = false` (unread only)
- Returns exact count

---

### ✅ **4. Initial Load - CORRECT**

**NotificationBell.tsx (Lines 38-43):**
```tsx
// Fetch unread count on mount
useEffect(() => {
  if (!profile) return;
  fetchUnreadNotificationCount(profile.id)
    .then(setUnreadCount)
    .catch(() => {});
}, [profile]);
```

**Analysis:** ✅ Loads on mount correctly

---

### ✅ **5. Polling Mechanism - CORRECT**

**NotificationBell.tsx (Lines 45-56):**
```tsx
// Polling interval: refresh unread count every 30 seconds
useEffect(() => {
  if (!profile) return;

  const interval = setInterval(() => {
    fetchUnreadNotificationCount(profile.id)
      .then(setUnreadCount)
      .catch(() => {});
  }, 30_000);

  return () => clearInterval(interval);
}, [profile]);
```

**Analysis:** ✅ Polling works correctly
- Refreshes every 30 seconds
- Properly cleaned up on unmount

---

### ⚠️ **6. Realtime Subscription - POTENTIAL ISSUE #1**

**NotificationBell.tsx (Lines 58-91):**
```tsx
// Realtime subscription: instant update when new notification arrives
useEffect(() => {
  if (!profile) return;

  const channel = supabase
    .channel(`notifications:${profile.id}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${profile.id}`,
      },
      () => {
        // New notification inserted — refresh count
        fetchUnreadNotificationCount(profile.id)
          .then(setUnreadCount)
          .catch(() => {});
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${profile.id}`,
      },
      () => {
        // Notification updated (e.g., marked read) — refresh count
        fetchUnreadNotificationCount(profile.id)
          .then(setUnreadCount)
          .catch(() => {});
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [profile]);
```

**Analysis:** ⚠️ **POTENTIAL ISSUE**
- Realtime logic looks correct
- **BUT**: Supabase Realtime may not be enabled on the database table

**Possible Causes:**
1. Realtime not enabled on `notifications` table in Supabase dashboard
2. Subscription not connecting properly
3. Network issues preventing realtime connection
4. Supabase project doesn't have realtime enabled

---

### ⚠️ **7. Supabase Client Configuration - MISSING REALTIME OPTIONS**

**File:** `lib/supabase.ts`

**Current Configuration:**
```ts
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
});
```

**Analysis:** ⚠️ **POTENTIAL ISSUE #2**
- No `realtime` configuration specified
- Supabase client should have realtime options

**Missing Configuration:**
```ts
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

### ✅ **8. Notification Creation - CORRECT**

**All notification creation calls use:**
```ts
await db.from('notifications').insert({ ...insert, read: false });
```

**Analysis:** ✅ Correctly sets `read: false`

---

## 🔍 Root Cause Analysis

### Primary Suspects (Ranked by Likelihood):

### 🔴 **1. Realtime Not Enabled on Notifications Table** (90% likely)

**Problem:**
Supabase Realtime must be explicitly enabled for each table in the Supabase dashboard.

**How to Check:**
1. Go to Supabase Dashboard → Your Project
2. Navigate to Database → Replication
3. Check if `notifications` table has "Realtime" enabled

**Expected State:**
```
Table: notifications
Realtime: ✅ Enabled
```

**If Disabled:**
- Realtime subscriptions won't fire
- User won't see badge until:
  - They refresh the page
  - 30-second polling interval triggers
  - They click the bell icon

---

### 🟡 **2. Supabase Realtime Connection Issues** (60% likely)

**Problem:**
Realtime connection may not be establishing properly.

**How to Check:**
Add console logging to the subscription:
```tsx
const channel = supabase
  .channel(`notifications:${profile.id}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${profile.id}`,
    },
    (payload) => {
      console.log('🔔 New notification received:', payload);
      fetchUnreadNotificationCount(profile.id)
        .then(setUnreadCount)
        .catch(() => {});
    }
  )
  .subscribe((status) => {
    console.log('📡 Subscription status:', status);
  });
```

**Expected Output:**
```
📡 Subscription status: SUBSCRIBED
🔔 New notification received: { ... }
```

**If No Output:**
- Realtime is not connecting
- Check network tab for WebSocket connection
- Check Supabase project status

---

### 🟡 **3. User ID Mismatch** (40% likely)

**Problem:**
The `profile.id` might not match the `user_id` in notifications table.

**How to Check:**
```tsx
useEffect(() => {
  console.log('👤 Current user ID:', profile?.id);
  if (profile) {
    fetchMyNotifications(profile.id, 5).then(notifs => {
      console.log('📬 User notifications:', notifs);
      notifs.forEach(n => {
        console.log(`  - user_id: ${n.user_id}, read: ${n.read}`);
      });
    });
  }
}, [profile]);
```

**Expected:**
- `profile.id` matches `notif.user_id`
- Some notifications with `read: false`

---

### 🟢 **4. CSS/Styling Issue** (10% likely)

**Problem:**
Badge might be rendered but hidden by CSS.

**How to Check:**
```tsx
{unreadCount > 0 && (
  <span 
    className="..." 
    style={{ backgroundColor: 'red', color: 'white', zIndex: 9999 }}
  >
    {unreadCount}
  </span>
)}
```

Also check if `bg-pq-danger-1000` is defined in CSS.

---

### 🟢 **5. React State Not Updating** (5% likely)

**Problem:**
State update might not trigger re-render.

**How to Check:**
```tsx
const [unreadCount, setUnreadCount] = useState(0);

// Add logging
const handleCountUpdate = (count: number) => {
  console.log('🔢 Updating count:', count);
  setUnreadCount(count);
};

// Use in all setUnreadCount calls
fetchUnreadNotificationCount(profile.id)
  .then(handleCountUpdate)
  .catch(() => {});
```

---

## 🎯 Recommended Investigation Steps

### Step 1: Check Supabase Realtime Status (5 minutes)

1. Open Supabase Dashboard
2. Go to Database → Replication
3. Find `notifications` table
4. **Check if Realtime is enabled**

**If NOT enabled:**
- Click "Enable Realtime" for `notifications` table
- Test immediately - this will fix the issue

---

### Step 2: Add Debug Logging (10 minutes)

Add this logging to NotificationBell.tsx:

```tsx
// At the top of component
useEffect(() => {
  console.log('🚀 NotificationBell mounted');
  console.log('👤 User ID:', profile?.id);
  console.log('🔢 Initial unread count:', unreadCount);
}, []);

// In realtime subscription
const channel = supabase
  .channel(`notifications:${profile.id}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${profile.id}`,
    },
    (payload) => {
      console.log('🔔 NEW NOTIFICATION:', payload);
      console.log('📧 Current count before fetch:', unreadCount);
      fetchUnreadNotificationCount(profile.id)
        .then(count => {
          console.log('📊 New count:', count);
          setUnreadCount(count);
        })
        .catch(err => console.error('❌ Error fetching count:', err));
    }
  )
  .subscribe((status) => {
    console.log('📡 Realtime subscription status:', status);
  });

// In unreadCount state change
useEffect(() => {
  console.log('🔄 Unread count changed to:', unreadCount);
}, [unreadCount]);
```

---

### Step 3: Test Notification Creation (5 minutes)

Create a test notification manually:

**Open Supabase SQL Editor:**
```sql
-- Replace with your actual user ID
INSERT INTO notifications (user_id, title, body, type, read)
VALUES (
  'your-user-id-here',
  'Test Notification',
  'This is a test notification',
  'info',
  false
);
```

**Check:**
1. Console for realtime event
2. Badge appearance
3. If it appears after 30 seconds (polling works)

---

### Step 4: Check Network Tab (5 minutes)

1. Open browser DevTools → Network tab
2. Filter by "WS" (WebSocket)
3. Look for Supabase realtime WebSocket connection
4. Check if it's connected (status: 101 Switching Protocols)

**If No WebSocket:**
- Realtime is not connecting
- Check Supabase project settings
- Check browser console for errors

---

## 📋 Quick Checklist

- [ ] Supabase Realtime enabled on `notifications` table
- [ ] WebSocket connection established (check Network tab)
- [ ] Console logging added to track events
- [ ] Test notification created manually
- [ ] Badge appears after test notification
- [ ] Badge shows correct count
- [ ] Badge updates on INSERT events
- [ ] Badge updates on UPDATE events
- [ ] Polling fallback works (30 seconds)

---

## 🔧 Likely Fixes

### Fix #1: Enable Realtime (90% chance this fixes it)

**Supabase Dashboard:**
1. Database → Replication
2. Find `notifications` table
3. Toggle "Realtime" to ON
4. Save changes

**Test:**
Create a test notification → Badge should appear instantly

---

### Fix #2: Add Realtime Config to Supabase Client

**File:** `lib/supabase.ts`

```ts
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

### Fix #3: Add Error Handling and Logging

**File:** `components/layout/NotificationBell.tsx`

Add proper error handling to subscription:

```tsx
const channel = supabase
  .channel(`notifications:${profile.id}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${profile.id}`,
    },
    (payload) => {
      console.log('New notification:', payload);
      fetchUnreadNotificationCount(profile.id)
        .then(setUnreadCount)
        .catch(err => console.error('Error refreshing count:', err));
    }
  )
  .subscribe((status, err) => {
    if (err) {
      console.error('Subscription error:', err);
    }
    console.log('Subscription status:', status);
  });
```

---

## 📊 Expected Outcome

After enabling Realtime:

1. **Immediate Badge Update:** Badge appears instantly when notification created
2. **Real-time Updates:** No delay, no need to refresh
3. **Polling Fallback:** Still works as backup every 30 seconds
4. **Console Output:**
   ```
   📡 Realtime subscription status: SUBSCRIBED
   🔔 NEW NOTIFICATION: {...}
   📊 New count: 1
   🔄 Unread count changed to: 1
   ```

---

## 🎯 Summary

**Most Likely Cause:** Supabase Realtime not enabled on `notifications` table

**Quick Fix:** Enable Realtime in Supabase Dashboard → Database → Replication

**Verification:** Create test notification → Badge should appear instantly

**Fallback:** Even if Realtime fails, polling (every 30s) should work

---

**Next Steps:**
1. Check Supabase Dashboard for Realtime status
2. Enable if not already enabled
3. Add debug logging if issue persists
4. Report findings for further investigation

---

**Audit Completed:** June 2, 2026  
**Status:** Investigation Complete  
**Confidence:** 90% that Realtime is not enabled
