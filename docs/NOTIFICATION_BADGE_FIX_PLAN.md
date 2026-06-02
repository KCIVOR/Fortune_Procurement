# Notification Badge Fix - Action Plan

**Date:** June 2, 2026  
**Issue:** Red badge not showing when user receives notification  
**Confidence:** 90% it's a Supabase Realtime configuration issue

---

## 🎯 Most Likely Cause

**Supabase Realtime is NOT enabled on the `notifications` table**

This is the #1 most common issue. The code is correct, but Realtime needs to be manually enabled in the Supabase dashboard for each table.

---

## ⚡ Quick Fix (5 minutes)

### Step 1: Enable Realtime in Supabase

1. **Go to:** [Supabase Dashboard](https://supabase.com/dashboard)
2. **Select:** Your project
3. **Navigate to:** Database → Replication
4. **Find:** `notifications` table in the list
5. **Check:** Is "Realtime" toggled ON?
   - ✅ If YES → Go to Step 2
   - ❌ If NO → **Toggle it ON** and save

### Step 2: Test Immediately

Create a test notification using SQL Editor:

```sql
-- Replace 'your-user-id' with actual user ID
INSERT INTO notifications (user_id, title, body, type, read)
VALUES (
  'your-user-id',
  'Test Notification',
  'Badge should appear instantly!',
  'info',
  false
);
```

**Expected Result:**
- Badge appears instantly (no refresh needed)
- Shows count "1"
- If you're logged in, you should see the red dot immediately

---

## 🔍 If That Doesn't Work

### Add Debug Logging

Temporarily add this to `components/layout/NotificationBell.tsx`:

```tsx
// Inside the realtime subscription useEffect
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
      console.log('🔔 REALTIME EVENT:', payload);
      fetchUnreadNotificationCount(profile.id)
        .then(count => {
          console.log('📊 New count:', count);
          setUnreadCount(count);
        })
        .catch(err => console.error('❌ Error:', err));
    }
  )
  .subscribe((status, err) => {
    if (err) console.error('❌ Subscription error:', err);
    console.log('📡 Status:', status);
  });
```

**Open browser console and check:**
- ✅ "📡 Status: SUBSCRIBED" → Realtime is working
- ❌ No output → Realtime not connecting

---

## 📋 Verification Checklist

After enabling Realtime:

- [ ] Realtime enabled in Supabase Dashboard
- [ ] Browser console shows: `📡 Status: SUBSCRIBED`
- [ ] Create test notification via SQL
- [ ] Badge appears instantly (no page refresh)
- [ ] Badge shows correct count
- [ ] Badge disappears when all notifications marked as read

---

## 🎯 Why This Happens

Supabase Realtime is **opt-in per table** for security and performance reasons.

**Default State:** OFF  
**Required State:** ON (for real-time badge updates)

**Without Realtime enabled:**
- ❌ Badge updates delayed by 30 seconds (polling interval)
- ❌ Or requires page refresh
- ❌ Or requires clicking the bell icon

**With Realtime enabled:**
- ✅ Badge updates instantly
- ✅ No delay
- ✅ No refresh needed

---

## 🔧 Alternative Solutions

### If you can't enable Realtime:

### Option 1: Increase Polling Frequency

Change polling from 30s to 10s:

```tsx
const interval = setInterval(() => {
  fetchUnreadNotificationCount(profile.id)
    .then(setUnreadCount)
    .catch(() => {});
}, 10_000); // Changed from 30_000 to 10_000 (10 seconds)
```

**Pros:** Badge updates more frequently  
**Cons:** More database queries, still 10s delay

---

### Option 2: Force Refresh on User Actions

Add manual refresh when user performs actions:

```tsx
// In any page where notifications are created
const handleAction = async () => {
  // ... your action code ...
  
  // Force notification count refresh
  if (window.dispatchEvent) {
    window.dispatchEvent(new Event('notification-created'));
  }
};

// In NotificationBell.tsx
useEffect(() => {
  const handleNotificationCreated = () => {
    if (profile) {
      fetchUnreadNotificationCount(profile.id)
        .then(setUnreadCount)
        .catch(() => {});
    }
  };
  
  window.addEventListener('notification-created', handleNotificationCreated);
  return () => window.removeEventListener('notification-created', handleNotificationCreated);
}, [profile]);
```

**Pros:** Works without Realtime  
**Cons:** Only works for actions in current session

---

## 🚀 Recommended Approach

**Primary:** Enable Supabase Realtime (best solution)  
**Backup:** Increase polling frequency to 10s  
**Last Resort:** Manual refresh on user actions

---

## 📞 Support

If issue persists after enabling Realtime:

1. Check Supabase project status
2. Check browser console for errors
3. Check Network tab for WebSocket connection
4. Verify user ID matches notification user_id
5. Refer to full audit: `NOTIFICATION_BADGE_AUDIT.md`

---

**Created:** June 2, 2026  
**Priority:** HIGH (User experience issue)  
**Estimated Fix Time:** 5 minutes  
**Confidence:** 90%
