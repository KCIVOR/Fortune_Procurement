# Messaging System Implementation Plan

## Overview
Building a real-time 1-on-1 messaging system for the Fortune Procurement System. Users can send direct messages to any other user in the system with real-time delivery, read receipts, and message management.

---

## Requirements Summary

### Core Features
- **1-on-1 messaging only** (no group chats)
- **Message anyone** in the system (no role restrictions)
- **Prevent self-messaging**
- **Real-time message delivery** using Supabase Realtime
- **Message edit/delete** with "Message deleted" placeholder
- **Auto-mark as read** when conversation is opened
- **Typing indicators** (optional enhancement)
- **Search and filter** conversations
- **Last message preview** in conversation list
- **Unread badge** (dot) on header icon
- **Timestamp on every message**

### User Flow
1. User clicks messages icon in header → navigates to `/messages`
2. Sees list of conversations (left sidebar) + active thread (right side)
3. Can click "New Message" → goes to `/messages/new` to search/select user
4. If conversation exists, navigates to it; if not, creates new one
5. Messages appear instantly via real-time subscriptions
6. Conversation list reorders by most recent activity

---

## Database Schema

### Tables

#### `conversations`
Stores unique pairs of users who have messaged each other.

```sql
CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_b_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT users_ordered CHECK (user_a_id < user_b_id),
  CONSTRAINT unique_conversation UNIQUE(user_a_id, user_b_id)
);

CREATE INDEX idx_conversations_user_a ON conversations(user_a_id);
CREATE INDEX idx_conversations_user_b ON conversations(user_b_id);
CREATE INDEX idx_conversations_updated_at ON conversations(updated_at DESC);
```

**Key Design Decisions:**
- `user_a_id < user_b_id` ensures only one record per pair (no duplicates)
- `updated_at` tracks last activity for sorting
- Indexes on both user IDs for fast lookups

#### `messages`
Stores individual messages within conversations.

```sql
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_deleted boolean DEFAULT false,
  read_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  edited_at timestamptz
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_read_at ON messages(conversation_id, read_at) WHERE read_at IS NULL;
```

**Key Design Decisions:**
- `is_deleted` marks deleted messages (soft delete)
- `read_at` null = unread, timestamp = read
- `edited_at` tracks when message was last edited
- Index on `conversation_id + created_at` for fast thread loading
- Partial index on unread messages for performance

### RLS Policies

#### `conversations`
```sql
-- Users can see conversations they're part of
CREATE POLICY "Users can view their conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

-- Users can create conversations
CREATE POLICY "Users can create conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_a_id OR auth.uid() = user_b_id);

-- Users can update their conversations (for updated_at)
CREATE POLICY "Users can update their conversations"
  ON conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);
```

#### `messages`
```sql
-- Users can see messages in their conversations
CREATE POLICY "Users can view messages in their conversations"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND (conversations.user_a_id = auth.uid() OR conversations.user_b_id = auth.uid())
    )
  );

-- Users can send messages
CREATE POLICY "Users can send messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_id
      AND (conversations.user_a_id = auth.uid() OR conversations.user_b_id = auth.uid())
    )
  );

-- Users can update their own messages (for edits)
CREATE POLICY "Users can update their own messages"
  ON messages FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid());

-- Users can delete their own messages (soft delete)
CREATE POLICY "Users can delete their own messages"
  ON messages FOR DELETE
  TO authenticated
  USING (sender_id = auth.uid());
```

---

## Implementation Phases

### Phase 1: Database Setup
**Goal:** Create tables, indexes, RLS policies, and update TypeScript types.

**Tasks:**
1. Create migration file: `supabase/migrations/[timestamp]_messaging_schema.sql`
2. Define `conversations` table with constraints
3. Define `messages` table with indexes
4. Add RLS policies for both tables
5. Create database function to get/create conversation (helper)
6. Run migration and verify
7. Generate TypeScript types: `npm run generate-types`
8. Update `types/database.ts` with new table types

**Deliverables:**
- Migration file
- Updated `database.ts` types
- Verified RLS policies

---

### Phase 2: Backend API Routes
**Goal:** Create API endpoints for messaging operations.

**Tasks:**
1. **GET `/api/messages/conversations`** - List user's conversations with last message
2. **GET `/api/messages/conversations/[id]`** - Get messages in a conversation
3. **POST `/api/messages/conversations`** - Create or get conversation with user
4. **POST `/api/messages/send`** - Send a message
5. **PATCH `/api/messages/[id]`** - Edit a message
6. **DELETE `/api/messages/[id]`** - Soft delete a message (set `is_deleted = true`)
7. **PATCH `/api/messages/mark-read`** - Mark messages as read
8. **GET `/api/messages/unread-count`** - Get unread message count for badge

**Deliverables:**
- API route files in `app/api/messages/`
- Error handling and validation
- Proper authentication checks

---

### Phase 3: Frontend - Messages Page
**Goal:** Build the main `/messages` page with conversation list and thread view.

**File Structure:**
```
app/messages/
├── page.tsx                    # Main messages page (layout)
├── new/
│   └── page.tsx               # New message page (user search)
└── [conversationId]/
    └── page.tsx               # Individual conversation thread
```

**Components to Build:**
```
components/messages/
├── ConversationList.tsx       # Left sidebar with conversations
├── ConversationItem.tsx       # Single conversation in list
├── MessageThread.tsx          # Right side message thread
├── MessageBubble.tsx          # Individual message display
├── MessageInput.tsx           # Input field + send button
├── UserSearch.tsx             # Search users for new message
└── TypingIndicator.tsx        # "User is typing..." indicator
```

**Tasks:**
1. Create `/messages` page layout (split view)
2. Build `ConversationList` component
   - Fetch conversations from API
   - Show last message preview
   - Display unread indicators
   - Sort by most recent
   - Add search/filter functionality
3. Build `MessageThread` component
   - Fetch messages for selected conversation
   - Display messages with timestamps
   - Handle deleted messages ("Message deleted")
   - Auto-scroll to bottom on new messages
4. Build `MessageInput` component
   - Text input with send button
   - Handle message submission
   - Optional: typing indicator broadcast
5. Build `/messages/new` page
   - User search/select interface
   - Navigate to conversation on selection
6. Add loading states and error handling

**Deliverables:**
- Functional `/messages` page
- All messaging components
- Basic styling (responsive)

---

### Phase 4: Real-time Integration
**Goal:** Add Supabase Realtime subscriptions for instant message delivery.

**Tasks:**
1. Set up Realtime subscription in `MessageThread`
   - Subscribe to `messages` table filtered by `conversation_id`
   - Listen for INSERT, UPDATE, DELETE events
   - Update UI when events occur
2. Set up Realtime subscription in `ConversationList`
   - Subscribe to `conversations` table for user
   - Listen for new conversations
   - Reorder list on new messages
3. Implement auto-mark-as-read logic
   - When conversation opens, mark all unread messages as read
   - Update `read_at` timestamp
4. Add typing indicator (optional)
   - Broadcast typing status via Supabase Presence
   - Display indicator in thread
5. Handle edge cases:
   - User goes offline/online
   - Connection drops and reconnects
   - Multiple tabs open

**Deliverables:**
- Real-time message delivery
- Real-time conversation list updates
- Auto-mark-as-read functionality
- Typing indicators (optional)

---

### Phase 5: Header Integration
**Goal:** Add messages icon to header navigation with unread badge.

**Tasks:**
1. Locate header/navigation component
2. Add messages icon (SVG) next to other nav items
3. Fetch unread message count from API
4. Display dot badge when unread > 0
5. Add real-time subscription to update badge
6. Link icon to `/messages` route
7. Style icon and badge to match existing design

**Deliverables:**
- Messages icon in header
- Unread badge (dot indicator)
- Real-time badge updates

---

### Phase 6: Polish & Enhancements
**Goal:** Refine UX and add nice-to-have features.

**Tasks:**
1. **Message editing:**
   - Add edit button to user's own messages
   - Show "edited" indicator
   - Update `edited_at` timestamp
2. **Message deletion:**
   - Add delete button to user's own messages
   - Show confirmation modal
   - Display "Message deleted" placeholder
3. **Search conversations:**
   - Filter by user name
   - Search message content (optional)
4. **Timestamps:**
   - Group messages by date
   - Show relative time ("2 minutes ago")
   - Show full timestamp on hover
5. **Empty states:**
   - No conversations yet
   - No messages in thread
   - Search returns no results
6. **Accessibility:**
   - Keyboard navigation
   - Screen reader support
   - Focus management
7. **Performance:**
   - Pagination for message threads
   - Virtual scrolling for long conversations
   - Optimize re-renders

**Deliverables:**
- Polished UI/UX
- All edge cases handled
- Accessible and performant

---

## Technical Stack

- **Database:** Supabase (PostgreSQL)
- **Real-time:** Supabase Realtime
- **Frontend:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS (assumed based on project structure)
- **State Management:** React hooks + Supabase client
- **TypeScript:** Full type safety

---

## Security Considerations

1. **RLS Policies:** Ensure users can only access their own conversations
2. **Input Validation:** Sanitize message content (prevent XSS)
3. **Rate Limiting:** Prevent spam (consider API rate limits)
4. **Content Moderation:** Optional - flag inappropriate messages
5. **Admin Access:** No admin access to private messages (as per requirements)

---

## Testing Strategy

1. **Unit Tests:**
   - API route handlers
   - Helper functions (get/create conversation)
   - Message formatting utilities

2. **Integration Tests:**
   - Create conversation flow
   - Send/receive messages
   - Mark as read functionality
   - Real-time subscriptions

3. **E2E Tests:**
   - Full user flow: login → new message → send → receive
   - Multiple users messaging each other
   - Real-time updates across tabs

4. **Manual Testing:**
   - Test on different screen sizes
   - Test with slow network
   - Test with multiple tabs open
   - Test edge cases (deleted users, etc.)

---

## Future Enhancements (Post-MVP)

- **Message reactions** (emoji reactions)
- **File attachments** (images, documents)
- **Voice messages**
- **Message search** (full-text search)
- **Message forwarding**
- **Block/mute users**
- **Message notifications** (email, push)
- **Read receipts** (show "seen by" timestamp)
- **Message threading** (reply to specific messages)
- **Rich text formatting** (bold, italic, links)

---

## Success Criteria

✅ Users can send 1-on-1 messages to anyone in the system
✅ Messages appear instantly via real-time subscriptions
✅ Conversation list updates and reorders in real-time
✅ Unread badge shows on header icon
✅ Messages can be edited/deleted
✅ Deleted messages show "Message deleted" placeholder
✅ Messages auto-mark as read when conversation opens
✅ Search/filter conversations works
✅ UI is responsive and accessible
✅ No performance issues with large message threads
✅ RLS policies prevent unauthorized access

---

## Timeline Estimate

- **Phase 1 (Database):** 1-2 hours
- **Phase 2 (API Routes):** 3-4 hours
- **Phase 3 (Frontend):** 6-8 hours
- **Phase 4 (Real-time):** 3-4 hours
- **Phase 5 (Header):** 1-2 hours
- **Phase 6 (Polish):** 4-6 hours

**Total:** ~18-26 hours (2-3 days of focused work)

---

## Notes

- Start with Phase 1 (database) and verify everything works before moving forward
- Test RLS policies thoroughly to ensure privacy
- Consider pagination early if expecting high message volume
- Keep real-time subscriptions scoped to avoid performance issues
- Follow existing project patterns for consistency
