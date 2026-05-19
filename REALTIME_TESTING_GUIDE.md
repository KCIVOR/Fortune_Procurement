# Realtime Messaging - Testing Guide

## Quick Test (5 minutes)

### Setup
1. Open the app in two browser windows/tabs
2. Log in as User A in window 1
3. Log in as User B in window 2
4. Both users navigate to `/messages`

### Test 1: Send Message (Real-time)
**Expected**: Message appears instantly without refresh

1. User A: Click on a conversation or create new one with User B
2. User A: Type "Hello from A" and press Enter
3. **Verify**: Message appears immediately in User A's thread
4. User B: Check the same conversation
5. **Verify**: Message appears immediately in User B's thread (no refresh needed)

### Test 2: Edit Message (Real-time)
**Expected**: Edit appears instantly in both threads

1. User A: Hover over the message and click the pencil icon
2. User A: Change text to "Hello from A (edited)" and press Enter
3. **Verify**: Edit appears immediately in User A's thread
4. User B: Check the same conversation
5. **Verify**: Edit appears immediately in User B's thread with "edited" label

### Test 3: Delete Message (Real-time)
**Expected**: Delete appears instantly in both threads

1. User A: Hover over a message and click the trash icon
2. **Verify**: Message shows "Message deleted" immediately in User A's thread
3. User B: Check the same conversation
4. **Verify**: Message shows "Message deleted" immediately in User B's thread

### Test 4: Conversation List Update
**Expected**: Conversation moves to top with latest message preview

1. User A: Send a message in a conversation
2. **Verify**: Conversation appears at top of list in User A's sidebar
3. **Verify**: Last message preview shows the new message
4. User B: Check conversation list
5. **Verify**: Conversation appears at top with latest message preview

### Test 5: Unread Badge
**Expected**: Badge appears when receiving message, clears when opening

1. User A: Send a message to User B
2. User B: Check conversation list
3. **Verify**: Unread badge appears on the conversation
4. User B: Click on the conversation to open it
5. **Verify**: Unread badge disappears
6. User B: Go back to conversation list
7. **Verify**: No unread badge (message is marked as read)

---

## Comprehensive Test (15 minutes)

### Test 6: Pagination
**Expected**: Latest messages shown first, can load older

1. User A: Open a conversation with many messages (40+)
2. **Verify**: Latest messages are visible at bottom
3. **Verify**: "Load older messages" button appears at top
4. User A: Click "Load older messages"
5. **Verify**: Older messages load above current messages
6. **Verify**: Scroll position is preserved (doesn't jump to bottom)
7. User B: Send a new message
8. **Verify**: New message appears at bottom in real-time

### Test 7: Multiple Conversations
**Expected**: Each conversation has independent realtime subscriptions

1. User A: Open conversation 1
2. User B: Send message in conversation 1
3. **Verify**: Message appears in User A's thread
4. User A: Open conversation 2
5. User B: Send message in conversation 2
6. **Verify**: Message appears in User A's thread
7. User A: Switch back to conversation 1
8. **Verify**: Conversation 1 still shows correct messages

### Test 8: Rapid Messages
**Expected**: No duplicate messages, all appear in order

1. User A: Send 5 messages rapidly (1 per second)
2. **Verify**: All 5 messages appear in User B's thread
3. **Verify**: No duplicates
4. **Verify**: Messages are in correct order

### Test 9: Network Disconnect/Reconnect
**Expected**: Realtime reconnects automatically

1. User A: Open browser DevTools (F12)
2. User A: Go to Network tab
3. User A: Click "Offline" to simulate network disconnect
4. User B: Send a message
5. **Verify**: Message doesn't appear in User A (offline)
6. User A: Click "Online" to reconnect
7. **Verify**: Message appears after reconnection
8. **Verify**: Realtime subscription re-establishes

### Test 10: Tab Switch
**Expected**: Realtime continues working when switching tabs

1. User A: Open conversation in tab 1
2. User A: Switch to another tab (tab 2)
3. User B: Send a message
4. User A: Switch back to tab 1
5. **Verify**: Message appears (realtime was still working in background)

---

## Edge Cases

### Test 11: Self-Messaging Prevention
**Expected**: Cannot create conversation with self

1. User A: Try to start a new message with themselves
2. **Verify**: Error message or conversation doesn't create

### Test 12: Unauthorized Access
**Expected**: Cannot see other users' conversations

1. User A: Open conversation with User B
2. User A: Try to access conversation ID in URL directly
3. **Verify**: Can view (it's their conversation)
4. User A: Try to access a conversation between User C and User D
5. **Verify**: Access denied or empty (RLS blocks it)

### Test 13: Message Length Limit
**Expected**: Cannot send messages over 2000 characters

1. User A: Try to paste a message with 2001+ characters
2. **Verify**: Character counter shows red
3. **Verify**: Send button is disabled
4. **Verify**: Error message appears

### Test 14: Empty Message Prevention
**Expected**: Cannot send empty or whitespace-only messages

1. User A: Try to send just spaces
2. **Verify**: Send button is disabled
3. **Verify**: Cannot send

### Test 15: Newline Support
**Expected**: Shift+Enter adds newlines, Enter sends

1. User A: Type "Line 1" + Shift+Enter + "Line 2"
2. **Verify**: Message has two lines
3. User A: Press Enter
4. **Verify**: Message sends
5. User B: Verify message shows two lines

---

## Mobile Testing

### Test 16: Mobile Layout
**Expected**: Single-panel layout on mobile

1. Open app on mobile device or use DevTools mobile emulation
2. **Verify**: Conversation list and thread are not side-by-side
3. User A: Click on a conversation
4. **Verify**: Thread opens full-screen
5. User A: Click "Back" button
6. **Verify**: Returns to conversation list

### Test 17: Mobile Input
**Expected**: Input works on mobile keyboard

1. Open app on mobile
2. Open a conversation
3. **Verify**: Input field is accessible
4. **Verify**: Keyboard appears when tapping input
5. Type a message and send
6. **Verify**: Message sends successfully

---

## Performance Checks

### Test 18: Large Conversation
**Expected**: No lag with 100+ messages

1. Create a conversation with 100+ messages
2. **Verify**: Page loads quickly
3. **Verify**: Scrolling is smooth
4. **Verify**: Pagination works smoothly

### Test 19: Multiple Realtime Subscriptions
**Expected**: No memory leaks with multiple conversations

1. Open 5 different conversations
2. **Verify**: No console errors
3. **Verify**: Browser memory usage is reasonable
4. Close conversations
5. **Verify**: Memory is released (no leaks)

---

## Console Checks

### Test 20: No Console Errors
**Expected**: No errors or warnings related to messaging

1. Open browser DevTools (F12)
2. Go to Console tab
3. Open a conversation
4. Send a message
5. Edit a message
6. Delete a message
7. **Verify**: No red errors
8. **Verify**: No warnings about realtime subscriptions

---

## Success Criteria

✅ All tests pass  
✅ No console errors  
✅ No duplicate messages  
✅ Realtime works instantly  
✅ Mobile layout works  
✅ Pagination works  
✅ RLS prevents unauthorized access  
✅ Input validation works  

**Result**: System is production-ready ✅

---

## Troubleshooting

### Messages not appearing in real-time
1. Check browser console for errors
2. Verify both users are in the same conversation
3. Check Supabase project status
4. Try refreshing the page
5. Check network tab for failed requests

### Duplicate messages
1. Clear browser cache
2. Hard refresh (Ctrl+Shift+R)
3. Check if `knownIdsRef` is working in console

### Unread badge not clearing
1. Verify `markMessagesAsRead` RPC is being called
2. Check database for `read_at` timestamp
3. Verify RLS policy allows read marking

### Pagination not working
1. Verify conversation has 40+ messages
2. Check "Load older messages" button appears
3. Verify `fetchConversationMessages` is called with cursor
4. Check database query in Supabase logs

---

## Monitoring

### Supabase Dashboard Checks
1. Go to Supabase Dashboard
2. Check Realtime status (should be green)
3. Check Database logs for errors
4. Monitor API usage
5. Check RLS policy violations

### Application Monitoring
1. Monitor browser console for errors
2. Check network requests for failures
3. Monitor memory usage
4. Check for memory leaks
5. Monitor CPU usage during heavy messaging

---

## Sign-Off

- [ ] All tests passed
- [ ] No console errors
- [ ] Realtime working correctly
- [ ] Mobile layout working
- [ ] Pagination working
- [ ] Security verified
- [ ] Ready for production

**Tested by**: _______________  
**Date**: _______________  
**Status**: ✅ APPROVED / ❌ NEEDS FIXES
