# Bug Fix: Duplicate Messages with Attachments

## Issue
Messages with attachments were appearing twice in the message thread UI. The duplicate would disappear on page refresh.

## Root Cause
The bug was caused by a **race condition** between the optimistic update and the realtime INSERT event:

### Original Flow (Buggy):
1. `sendMessage()` creates message in DB → triggers realtime INSERT event immediately
2. Realtime INSERT handler checks `knownIdsRef` → ID is NOT there yet → adds message to state
3. Attachments are uploaded (takes time)
4. `onMessageSent(newMessage)` is called → adds ID to `knownIdsRef` → adds message to state AGAIN
5. **Result: Duplicate message in UI**

### Why it disappeared on refresh:
On refresh, `loadMessages()` fetches from DB (which has only one message) and rebuilds `knownIdsRef` correctly.

## Solution
Move `onMessageSent()` call to **immediately after** creating the message, **before** uploading attachments:

### Fixed Flow:
1. `sendMessage()` creates message in DB → triggers realtime INSERT event
2. `onMessageSent(newMessage)` is called immediately → adds ID to `knownIdsRef` → adds message to state
3. Realtime INSERT handler checks `knownIdsRef` → ID IS there → skips (deduplication works!)
4. Attachments are uploaded
5. **Result: Single message in UI**

## Files Changed

### `components/messages/MessageInput.tsx`
- Moved `onMessageSent?.(newMessage)` call from after attachment uploads to immediately after `sendMessage()`
- Removed duplicate `onMessageSent` call at the end
- Updated comments to explain the timing requirement

### `components/messages/MessageThread.tsx` (previous fix)
- Removed redundant attachment INSERT subscription that was manually incrementing `attachment_count`

## Code Changes

```typescript
// BEFORE (buggy):
const newMessage = await sendMessage(...);
// Upload attachments (takes time)
for (let i = 0; i < pendingFiles.length; i++) {
  await uploadMessageAttachment(...);
}
// Clear state
setContent('');
onMessageSent?.(newMessage); // ❌ Too late! Realtime already added duplicate

// AFTER (fixed):
const newMessage = await sendMessage(...);
onMessageSent?.(newMessage); // ✅ Immediately add to knownIdsRef before realtime can
// Upload attachments
for (let i = 0; i < pendingFiles.length; i++) {
  await uploadMessageAttachment(...);
}
// Clear state
setContent('');
```

## Testing
After this fix:
- Messages with attachments should appear only once
- Messages without attachments should still work correctly
- Attachments should load correctly after upload completes
- No duplicate messages on send or refresh

## Related Files
- `components/messages/MessageThread.tsx` - Contains `handleMessageSent` callback and realtime subscription
- `lib/messages.ts` - `sendMessage()` function
- `lib/message-attachments.ts` - `uploadMessageAttachment()` function
