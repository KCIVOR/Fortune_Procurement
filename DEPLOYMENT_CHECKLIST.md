# Realtime Messaging - Deployment Checklist

## Pre-Deployment Verification

### ✅ Code Quality
- [x] TypeScript compilation: `npx tsc --noEmit` ✅ PASSED
- [x] Build: `npm run build` ✅ PASSED
- [x] No console errors
- [x] No breaking changes
- [x] Backward compatible

### ✅ Database Migration
- [x] Migration applied: `enable_replica_identity_full_for_messaging`
- [x] Verified: `messages` table has REPLICA IDENTITY FULL
- [x] Verified: `conversations` table has REPLICA IDENTITY FULL
- [x] RLS policies intact
- [x] No data loss

### ✅ Security
- [x] RLS enabled on both tables
- [x] RLS policies verified
- [x] No service-role usage in frontend
- [x] No `dangerouslySetInnerHTML`
- [x] Input validation working
- [x] Secure RPCs in place

### ✅ Application Code
- [x] MessageThread component correct
- [x] ConversationList component correct
- [x] MessageInput component correct
- [x] MessageBubble component correct
- [x] Realtime subscriptions correct
- [x] Pagination working
- [x] Scroll behavior correct

---

## Deployment Steps

### Step 1: Backup Database
```bash
# Supabase automatically backs up, but verify:
# 1. Go to Supabase Dashboard
# 2. Project Settings → Backups
# 3. Verify latest backup exists
```

### Step 2: Apply Migration
```bash
# The migration has already been applied to the development database
# For production, run:

# Option A: Via Supabase Dashboard
# 1. Go to SQL Editor
# 2. Create new query
# 3. Paste:
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
# 4. Click "Run"

# Option B: Via Supabase CLI
supabase db push --linked
```

### Step 3: Verify Migration
```sql
-- Run this query to verify:
SELECT nspname, relname, 
  CASE relreplident
    WHEN 'd' THEN 'DEFAULT (PK only)'
    WHEN 'f' THEN 'FULL (all columns)'
    WHEN 'i' THEN 'INDEX'
    WHEN 'n' THEN 'NOTHING'
  END as replica_identity
FROM pg_class 
JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
WHERE relname IN ('messages', 'conversations') 
AND nspname = 'public';

-- Expected result:
-- conversations | FULL (all columns)
-- messages      | FULL (all columns)
```

### Step 4: Deploy Application
```bash
# Build for production
npm run build

# Deploy to your hosting platform
# (Vercel, Netlify, etc.)
```

### Step 5: Test in Production
```
1. Open app in two browser windows
2. Log in as different users
3. Send message from User A
4. Verify message appears instantly in User B (no refresh)
5. Edit message from User A
6. Verify edit appears instantly in User B
7. Delete message from User A
8. Verify delete appears instantly in User B
```

---

## Post-Deployment Verification

### ✅ Realtime Messaging
- [ ] Send message: appears instantly
- [ ] Edit message: appears instantly
- [ ] Delete message: appears instantly
- [ ] No duplicate messages
- [ ] No console errors

### ✅ Conversation List
- [ ] New message moves conversation to top
- [ ] Last message preview updates
- [ ] Unread badge appears
- [ ] Unread badge clears when opening

### ✅ Pagination
- [ ] Initial load shows latest 40 messages
- [ ] "Load older messages" button works
- [ ] Scroll position preserved
- [ ] New messages still append correctly

### ✅ Mobile
- [ ] Single-panel layout on mobile
- [ ] Input works on mobile keyboard
- [ ] Messages send correctly
- [ ] Realtime works on mobile

### ✅ Performance
- [ ] No lag with 100+ messages
- [ ] Smooth scrolling
- [ ] No memory leaks
- [ ] No console errors

### ✅ Security
- [ ] Cannot see other users' conversations
- [ ] Cannot edit other users' messages
- [ ] Cannot delete other users' messages
- [ ] RLS policies enforced

---

## Monitoring

### Supabase Dashboard
1. Go to Supabase Dashboard
2. Select your project
3. Check:
   - [ ] Realtime status (green)
   - [ ] Database status (green)
   - [ ] API status (green)
   - [ ] No error logs

### Application Monitoring
1. Open browser DevTools
2. Check:
   - [ ] No console errors
   - [ ] No failed network requests
   - [ ] WebSocket connection active
   - [ ] Memory usage reasonable

### Database Monitoring
1. Supabase Dashboard → Database
2. Check:
   - [ ] Query performance
   - [ ] No slow queries
   - [ ] RLS policy violations (should be 0)
   - [ ] Replication lag (should be <1s)

---

## Rollback Plan

If issues occur, rollback is simple:

### Option 1: Revert to Previous Replica Identity
```sql
-- This would revert to DEFAULT (not recommended)
ALTER TABLE public.messages REPLICA IDENTITY DEFAULT;
ALTER TABLE public.conversations REPLICA IDENTITY DEFAULT;

-- But this will break realtime again, so don't do this
```

### Option 2: Restore from Backup
```
1. Supabase Dashboard → Project Settings → Backups
2. Click "Restore" on a previous backup
3. Confirm restoration
4. Test application
```

### Option 3: Redeploy Previous Version
```bash
# If application code was changed (it wasn't)
git revert <commit-hash>
npm run build
# Deploy
```

**Note**: The migration is safe and doesn't require rollback. It only changes metadata, not data.

---

## Troubleshooting

### Issue: Messages still not appearing in real-time

**Diagnosis**:
1. Check browser console for errors
2. Check Supabase logs for errors
3. Verify REPLICA IDENTITY is FULL:
   ```sql
   SELECT relname, relreplident FROM pg_class 
   WHERE relname IN ('messages', 'conversations');
   ```
4. Check WebSocket connection in Network tab

**Solution**:
1. Hard refresh browser (Ctrl+Shift+R)
2. Clear browser cache
3. Check Supabase status page
4. Verify RLS policies are correct
5. Check database logs for errors

### Issue: Duplicate messages appearing

**Diagnosis**:
1. Check if `knownIdsRef` is working
2. Check browser console for errors
3. Verify deduplication logic

**Solution**:
1. Clear browser cache
2. Hard refresh
3. Check if realtime subscription is being set up multiple times
4. Verify `useEffect` dependencies are correct

### Issue: Unread badge not clearing

**Diagnosis**:
1. Check if `markMessagesAsRead` RPC is being called
2. Check database for `read_at` timestamp
3. Verify RLS policy allows read marking

**Solution**:
1. Check browser console for errors
2. Verify RPC is being called
3. Check database logs
4. Verify RLS policy on messages table

### Issue: Pagination not working

**Diagnosis**:
1. Verify conversation has 40+ messages
2. Check if "Load older messages" button appears
3. Verify `fetchConversationMessages` is called with cursor

**Solution**:
1. Check browser console for errors
2. Verify database query in Supabase logs
3. Check if cursor is being passed correctly
4. Verify RLS policy allows SELECT

---

## Success Criteria

✅ All tests pass  
✅ No console errors  
✅ Realtime works instantly  
✅ No duplicate messages  
✅ Pagination works  
✅ Mobile layout works  
✅ Security verified  
✅ Performance acceptable  

---

## Sign-Off

- [ ] Pre-deployment verification complete
- [ ] Migration applied successfully
- [ ] Application deployed
- [ ] Post-deployment testing complete
- [ ] Monitoring in place
- [ ] Rollback plan understood
- [ ] Ready for production

**Deployed by**: _______________  
**Date**: _______________  
**Time**: _______________  
**Status**: ✅ APPROVED / ❌ NEEDS FIXES

---

## Contact & Support

If issues occur:
1. Check Supabase status page
2. Review Supabase logs
3. Check browser console
4. Review this deployment checklist
5. Contact Supabase support if needed

---

## Additional Resources

- [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime)
- [PostgreSQL REPLICA IDENTITY](https://www.postgresql.org/docs/current/sql-altertable.html)
- [Supabase RLS Docs](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Audit Report](./REALTIME_MESSAGING_AUDIT_REPORT.md)
- [Testing Guide](./REALTIME_TESTING_GUIDE.md)
- [Architecture Docs](./REALTIME_ARCHITECTURE.md)
