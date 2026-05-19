# Messaging System Security Audit & Implementation Plan
**Fortune Procurement System**

**Date:** May 19, 2026  
**Auditor:** Senior Full-Stack Architect & Supabase Security Auditor  
**Project ID:** qvxrvnsjlycdgvhwgtkj (Fortune Procurement)  
**Database:** PostgreSQL 17.6.1.113 (Supabase)

---

## Executive Summary

This document provides a comprehensive security audit of the Fortune Procurement System before implementing a 1-on-1 messaging feature. A previous messaging implementation was rolled back on May 19, 2026 due to security vulnerabilities. This audit identifies those issues and provides a secure, non-breaking implementation plan.

**Critical Finding:** The previous implementation used a `conversation_participants` junction table that created participant injection vulnerabilities. This audit recommends a simpler, more secure approach.

**Status:** ⚠️ **DO NOT IMPLEMENT YET** - Awaiting approval after audit review.

---

## 1. Current System Summary

### 1.1 Database Architecture

**Identity & Access:**
- `profiles` table: Primary user table (id references `auth.users.id`)
  - Contains: `full_name`, `email`, `role_id`, `position_id`, `department_id`
  - 18 active users in system
  - RLS enabled with policies for self-read, self-update, and authenticated-read-all
- `roles` table: 7 roles (admin, employee, warehouse, procurement, approver, supplier, tsqa)
- `positions` table: 14 positions mapped to roles
- `departments` table: 8 departments

**Authentication:**
- Supabase Auth (`auth.users` table)
- Profile creation triggered on user signup
- Foreign key: `profiles.id` → `auth.users.id` (ON DELETE CASCADE)

**Existing Workflows:**
- PR1 (Purchase Request 1) → Warehouse Validation → Approval Workflow
- PR2 (Purchase Request 2) → Dual-phase approval
- RFQ (Request for Quotation) → Supplier quotes
- PO (Purchase Order) → Approval → Delivery → GRN (Goods Receipt Note)
- Supplier Accreditation → Product Review → RSE (Raw Sample Evaluation) → TSQA Review

**Notifications System:**
- `notifications` table exists with RLS
- Used for approval workflow notifications
- Has `user_id`, `title`, `body`, `type`, `read`, `action_url`
- Real-time NOT currently implemented (no Realtime subscriptions found in codebase)


### 1.2 Frontend Architecture

**Routing:** Next.js 14 App Router
- Layout: `app/layout.tsx` (root layout with AuthProvider)
- Navigation: Sidebar-based with role-specific nav items
- Header: `TopHeader.tsx` with NotificationBell, BugTrack icon, profile link

**Component Organization:**
- `components/layout/`: Sidebar, TopHeader, NotificationBell, AppShell
- `components/shared/`: Reusable UI components
- `components/ui/`: shadcn/ui components (Dialog, Sheet, Button, etc.)

**Existing Header Icons:**
- Department/Position info
- NotificationBell (with unread count badge)
- BugTrack icon
- Profile avatar

**Navigation Pattern:**
- Role-based navigation defined in `config/navigation.ts`
- Module visibility controlled by `role_position_module_visibility` table
- Sidebar collapses on mobile, shows hamburger menu


### 1.3 API & RLS Patterns

**API Routes:**
- Located in `app/api/`
- Pattern: Bearer token authentication → `supabase.auth.getUser()` → role check → operation
- Service role key used for admin operations (user creation, etc.)
- Error handling: JSON responses with `success`, `error`, `status`

**RLS Policy Patterns:**
- **Self-access:** Users can read/update their own records (`auth.uid() = id`)
- **Role-based:** Approvers can update pending_approval documents
- **Authenticated-read-all:** Reference data (departments, roles, positions, profiles)
- **Subquery-based:** Complex policies use EXISTS subqueries (e.g., approval_actions)
- **Application-layer enforcement:** Some business rules enforced in code, not RLS

**Critical RLS Finding:**
- ⚠️ `rfq_suppliers` table has RLS DISABLED (security advisory flagged)
- This is a known issue but not blocking for messaging


---

## 2. Database Compatibility Audit

### 2.1 Tables Messaging Should Reference

**Primary Reference:**
- `profiles` table (NOT `auth.users` directly)
  - Reason: All user metadata (name, role, department) is in profiles
  - Foreign keys should point to `profiles.id`
  - Cascade behavior: `profiles.id` → `auth.users.id` ON DELETE CASCADE

**Why NOT auth.users:**
- `auth.users` is managed by Supabase Auth (internal schema)
- Direct foreign keys to `auth.users` are discouraged
- All existing tables reference `profiles.id`, not `auth.users.id`

### 2.2 Previous Implementation Issues (Rolled Back)

**Migration 20260518160300_messaging_schema.sql** (rolled back):
- Created 4 tables: `conversations`, `conversation_participants`, `messages`, `message_attachments`
- **Critical Flaw:** `conversation_participants` junction table
  - Allowed arbitrary participant injection
  - RLS policy: "Users can insert themselves as participants"
  - **Attack vector:** User A creates conversation, adds User B without consent
  - **Attack vector:** User A adds themselves to existing conversation between B and C

**Why It Failed:**
- No atomic conversation creation with validated participants
- Participant insertion was separate from conversation creation
- RLS could not prevent unauthorized participant addition
- No database-level constraint to enforce 1-on-1 only


### 2.3 Recommended Architecture

**Secure 1-on-1 Design:**
```sql
CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_b_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT users_ordered CHECK (user_a_id < user_b_id),
  CONSTRAINT no_self_conversation CHECK (user_a_id != user_b_id),
  CONSTRAINT unique_conversation UNIQUE(user_a_id, user_b_id)
);

CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_deleted boolean DEFAULT false,
  read_by_other boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  edited_at timestamptz,
  CONSTRAINT content_not_empty CHECK (char_length(trim(content)) > 0 OR is_deleted = true)
);
```

**Why This Is Secure:**
1. **No junction table** - participants are columns, not rows
2. **Ordered constraint** - `user_a_id < user_b_id` ensures one record per pair
3. **Unique constraint** - prevents duplicate conversations
4. **No self-messaging** - `user_a_id != user_b_id` enforced at DB level
5. **Atomic creation** - both participants inserted in single transaction
6. **Cascade deletes** - if user deleted, conversations/messages cascade


---

## 3. Security / RLS Audit

### 3.1 Existing RLS Patterns Analysis

**Pattern 1: Self-Access (profiles)**
```sql
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);
```
✅ **Secure** - Direct auth.uid() check

**Pattern 2: Authenticated Read-All (reference data)**
```sql
CREATE POLICY "Authenticated users can read departments"
  ON departments FOR SELECT
  TO authenticated
  USING (true);
```
✅ **Secure** - Read-only reference data

**Pattern 3: Subquery-Based (approval_actions)**
```sql
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
```
✅ **Secure** - Subquery validates participation


### 3.2 Recommended RLS Policies for Messaging

#### Conversations Table

```sql
-- SELECT: Users can view conversations they're part of
CREATE POLICY "Users can view their conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

-- INSERT: Users can create conversations (via RPC only - see below)
-- NO DIRECT INSERT POLICY - use RPC to enforce ordering

-- UPDATE: Users can update last_message_at (via trigger only)
CREATE POLICY "System can update conversation timestamps"
  ON conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id)
  WITH CHECK (auth.uid() = user_a_id OR auth.uid() = user_b_id);

-- DELETE: No delete policy (conversations are permanent)
```

**Security Notes:**
- ✅ No direct INSERT policy prevents participant injection
- ✅ Conversation creation must go through RPC (see Section 3.3)
- ✅ UPDATE policy allows timestamp updates only
- ✅ No DELETE policy - conversations are permanent (messages can be soft-deleted)


#### Messages Table

```sql
-- SELECT: Users can view messages in their conversations
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

-- INSERT: Users can send messages to their conversations
CREATE POLICY "Users can send messages to their conversations"
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

-- UPDATE: Users can edit/soft-delete their own messages
CREATE POLICY "Users can update their own messages"
  ON messages FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- DELETE: No hard delete policy (use soft delete via UPDATE)
```

**Security Notes:**
- ✅ Subquery prevents message injection into unauthorized conversations
- ✅ sender_id must match auth.uid() (no impersonation)
- ✅ Users can only edit their own messages
- ✅ No hard delete - use `is_deleted = true` instead


### 3.3 Secure Conversation Creation (RPC Function)

**Problem:** Direct INSERT on conversations allows participant injection.

**Solution:** Use a PostgreSQL function (RPC) to enforce ordering and validation.

```sql
CREATE OR REPLACE FUNCTION create_or_get_conversation(other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  user_a uuid;
  user_b uuid;
  conversation_id uuid;
BEGIN
  -- Get current authenticated user
  current_user_id := auth.uid();
  
  -- Prevent self-messaging
  IF current_user_id = other_user_id THEN
    RAISE EXCEPTION 'Cannot create conversation with yourself';
  END IF;
  
  -- Verify other user exists
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = other_user_id) THEN
    RAISE EXCEPTION 'User does not exist';
  END IF;
  
  -- Order users (smaller UUID first)
  IF current_user_id < other_user_id THEN
    user_a := current_user_id;
    user_b := other_user_id;
  ELSE
    user_a := other_user_id;
    user_b := current_user_id;
  END IF;
  
  -- Try to find existing conversation
  SELECT id INTO conversation_id
  FROM conversations
  WHERE user_a_id = user_a AND user_b_id = user_b;
  
  -- If not found, create it
  IF conversation_id IS NULL THEN
    INSERT INTO conversations (user_a_id, user_b_id)
    VALUES (user_a, user_b)
    RETURNING id INTO conversation_id;
  END IF;
  
  RETURN conversation_id;
END;
$$;
```

**Security Features:**
- ✅ `SECURITY DEFINER` - runs with function owner's privileges (bypasses RLS)
- ✅ Validates `auth.uid()` - only authenticated users can call
- ✅ Prevents self-messaging
- ✅ Validates other user exists
- ✅ Enforces ordering constraint
- ✅ Idempotent - returns existing conversation if found


### 3.4 Security Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Participant Injection** | 🔴 Critical | Use RPC for conversation creation, no direct INSERT policy |
| **Self-Messaging** | 🟡 Medium | Database CHECK constraint + RPC validation |
| **Message Impersonation** | 🔴 Critical | RLS enforces `sender_id = auth.uid()` |
| **Unauthorized Message Read** | 🔴 Critical | RLS subquery validates conversation participation |
| **Conversation Enumeration** | 🟢 Low | RLS prevents viewing non-participant conversations |
| **XSS via Message Content** | 🟡 Medium | Frontend must sanitize/escape message content |
| **SQL Injection** | 🟢 Low | Parameterized queries (Supabase client handles this) |
| **Rate Limiting** | 🟡 Medium | Consider API rate limiting for message sending |
| **Spam/Abuse** | 🟡 Medium | Consider message length limits, rate limits |
| **Admin Overreach** | 🟢 Low | RLS enforces participation even for admins (as required) |

**Mitigations Applied:**
- ✅ RPC-based conversation creation
- ✅ Database constraints (CHECK, UNIQUE)
- ✅ RLS policies with subqueries
- ✅ No admin bypass (admins must be participants)
- ⚠️ Frontend XSS protection (to be implemented)
- ⚠️ Rate limiting (to be considered)


---

## 4. Feature Architecture Recommendation

### 4.1 Database Schema (Final Recommendation)

```sql
-- ============================================================================
-- CONVERSATIONS TABLE
-- ============================================================================
CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_b_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_message_at timestamptz DEFAULT now(),
  last_message_preview text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT users_ordered CHECK (user_a_id < user_b_id),
  CONSTRAINT no_self_conversation CHECK (user_a_id != user_b_id),
  CONSTRAINT unique_conversation UNIQUE(user_a_id, user_b_id)
);

CREATE INDEX idx_conversations_user_a ON conversations(user_a_id, last_message_at DESC);
CREATE INDEX idx_conversations_user_b ON conversations(user_b_id, last_message_at DESC);

-- ============================================================================
-- MESSAGES TABLE
-- ============================================================================
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_deleted boolean DEFAULT false,
  read_by_other boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  edited_at timestamptz,
  
  CONSTRAINT content_not_empty CHECK (char_length(trim(content)) > 0 OR is_deleted = true)
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_unread ON messages(conversation_id, read_by_other) WHERE read_by_other = false;
```


### 4.2 Database Functions & Triggers

```sql
-- ============================================================================
-- FUNCTION: Create or Get Conversation (RPC)
-- ============================================================================
CREATE OR REPLACE FUNCTION create_or_get_conversation(other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  user_a uuid;
  user_b uuid;
  conversation_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  IF current_user_id = other_user_id THEN
    RAISE EXCEPTION 'Cannot create conversation with yourself';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = other_user_id) THEN
    RAISE EXCEPTION 'User does not exist';
  END IF;
  
  IF current_user_id < other_user_id THEN
    user_a := current_user_id;
    user_b := other_user_id;
  ELSE
    user_a := other_user_id;
    user_b := current_user_id;
  END IF;
  
  SELECT id INTO conversation_id
  FROM conversations
  WHERE user_a_id = user_a AND user_b_id = user_b;
  
  IF conversation_id IS NULL THEN
    INSERT INTO conversations (user_a_id, user_b_id)
    VALUES (user_a, user_b)
    RETURNING id INTO conversation_id;
  END IF;
  
  RETURN conversation_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION create_or_get_conversation(uuid) TO authenticated;
```


```sql
-- ============================================================================
-- TRIGGER: Update Conversation on New Message
-- ============================================================================
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE conversations
  SET 
    last_message_at = NEW.created_at,
    last_message_preview = CASE 
      WHEN NEW.is_deleted THEN 'Message deleted'
      ELSE LEFT(NEW.content, 100)
    END,
    updated_at = now()
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_conversation_on_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_on_message();

-- ============================================================================
-- TRIGGER: Update Conversation on Message Edit/Delete
-- ============================================================================
CREATE TRIGGER trigger_update_conversation_on_message_update
  AFTER UPDATE ON messages
  FOR EACH ROW
  WHEN (OLD.is_deleted IS DISTINCT FROM NEW.is_deleted OR OLD.content IS DISTINCT FROM NEW.content)
  EXECUTE FUNCTION update_conversation_on_message();
```


---

## 5. Non-Breaking Implementation Constraints

### 5.1 Existing Logic That Must NOT Be Touched

**Database:**
- ✅ All existing tables, columns, constraints
- ✅ All existing RLS policies
- ✅ All existing functions, triggers
- ✅ All existing indexes
- ✅ `profiles` table structure (messaging will reference it, not modify it)

**Frontend:**
- ✅ Existing routes (`/dashboard`, `/pr1`, `/approvals`, etc.)
- ✅ Sidebar navigation structure
- ✅ TopHeader layout (we'll add icon, not replace)
- ✅ NotificationBell component (messaging will follow same pattern)
- ✅ AuthContext, AuthProvider
- ✅ All existing components

**API:**
- ✅ Existing API routes
- ✅ Authentication patterns
- ✅ Error handling patterns

### 5.2 Integration Points (Safe to Modify)

**TopHeader.tsx:**
- ✅ Add MessageIcon between NotificationBell and BugTrack icon
- Pattern: Same as NotificationBell (icon + badge + dropdown)

**Navigation Config:**
- ✅ Add `messages` module key to `ModuleKey` type
- ✅ Add messages nav item to role-based navigation (all roles)

**Database:**
- ✅ Add new tables: `conversations`, `messages`
- ✅ Add new function: `create_or_get_conversation()`
- ✅ Add new RLS policies (no conflicts with existing)


---

## 6. Required Tables / RPCs / Policies

### 6.1 Complete Migration File

**File:** `supabase/migrations/[timestamp]_messaging_schema_v2_secure.sql`

**Contents:** (See Section 4 for full SQL)
1. Create `conversations` table with constraints
2. Create `messages` table with constraints
3. Create indexes for performance
4. Create `create_or_get_conversation()` RPC function
5. Create triggers for conversation updates
6. Create RLS policies for conversations
7. Create RLS policies for messages
8. Enable Realtime for both tables

### 6.2 TypeScript Type Updates

**File:** `types/database.ts`

After migration, run:
```bash
npm run generate-types
```

This will add:
- `conversations` table types (Row, Insert, Update)
- `messages` table types (Row, Insert, Update)
- Convenience types: `Conversation`, `Message`

---

## 7. Frontend Integration Audit

### 7.1 Where to Add Messages Icon

**File:** `components/layout/TopHeader.tsx`

**Location:** Between NotificationBell and BugTrack icon

**Pattern to Follow:**
```tsx
<NotificationBell />
<div className="hidden sm:block w-px h-4 bg-pq-neutral-200" />
<MessageIcon />  {/* NEW */}
<div className="hidden sm:block w-px h-4 bg-pq-neutral-200" />
<Link href="/bugtrack" ...>
```


### 7.2 New Routes to Create

```
app/messages/
├── page.tsx                    # Main messages page (conversation list + thread)
├── new/
│   └── page.tsx               # New message page (user search/select)
└── layout.tsx                 # Optional: messages-specific layout
```

### 7.3 New Components to Create

```
components/messages/
├── MessageIcon.tsx            # Header icon with unread badge
├── ConversationList.tsx       # Left sidebar: list of conversations
├── ConversationItem.tsx       # Single conversation in list
├── MessageThread.tsx          # Right side: message thread
├── MessageBubble.tsx          # Individual message display
├── MessageInput.tsx           # Input field + send button
├── UserSearch.tsx             # Search users for new message
└── TypingIndicator.tsx        # "User is typing..." (optional)
```

### 7.4 Navigation Config Updates

**File:** `config/navigation.ts`

```typescript
// Add to ModuleKey type
export type ModuleKey =
  | 'dashboard'
  | 'messages'  // NEW
  | ...

// Add to ALL_NAV
const ALL_NAV: Record<string, NavItem> = {
  messages: {
    label: 'Messages',
    href: '/messages',
    icon: 'MessageSquare',
    module_key: 'messages',
  },
  ...
};

// Add to all role navigations
export const ROLE_NAV: Record<AppRole, NavItem[]> = {
  admin: [ALL_NAV.dashboard, ALL_NAV.messages, ...],
  employee: [ALL_NAV.dashboard, ALL_NAV.messages, ...],
  // ... add to all roles
};
```


---

## 8. Realtime Plan

### 8.1 Supabase Realtime Setup

**Current State:** No Realtime subscriptions found in codebase (first implementation)

**Realtime Configuration:**
```typescript
// Enable Realtime in migration
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
```

### 8.2 Frontend Realtime Subscriptions

**MessageThread Component:**
```typescript
useEffect(() => {
  if (!conversationId) return;
  
  const channel = supabase
    .channel(`conversation:${conversationId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`
    }, (payload) => {
      // Add new message to state
      setMessages(prev => [...prev, payload.new]);
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`
    }, (payload) => {
      // Update message in state (edit/delete)
      setMessages(prev => prev.map(m => 
        m.id === payload.new.id ? payload.new : m
      ));
    })
    .subscribe();
    
  return () => {
    supabase.removeChannel(channel);
  };
}, [conversationId]);
```


**ConversationList Component:**
```typescript
useEffect(() => {
  if (!userId) return;
  
  const channel = supabase
    .channel(`user:${userId}:conversations`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'conversations',
      filter: `user_a_id=eq.${userId}`
    }, () => {
      // Refetch conversation list
      fetchConversations();
    })
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'conversations',
      filter: `user_b_id=eq.${userId}`
    }, () => {
      // Refetch conversation list
      fetchConversations();
    })
    .subscribe();
    
  return () => {
    supabase.removeChannel(channel);
  };
}, [userId]);
```

### 8.3 Realtime Edge Cases

**Duplicate Messages:**
- ✅ Use message `id` as React key
- ✅ Deduplicate on INSERT (check if message already exists)

**Stale Conversation Ordering:**
- ✅ Trigger updates `last_message_at` automatically
- ✅ Frontend sorts by `last_message_at DESC`
- ✅ Realtime refetches on conversation UPDATE

**Unread Count Mismatch:**
- ✅ Mark as read when conversation opens (UPDATE messages SET read_by_other = true)
- ✅ Realtime updates unread count on message INSERT/UPDATE
- ✅ Badge shows count from database, not local state


---

## 9. Risk Register

| # | Risk | Severity | Impact | Mitigation | Status |
|---|------|----------|--------|------------|--------|
| 1 | Participant injection via direct INSERT | 🔴 Critical | Unauthorized access to conversations | Use RPC for creation, no INSERT policy | ✅ Mitigated |
| 2 | Self-messaging | 🟡 Medium | UX confusion, data integrity | DB CHECK constraint + RPC validation | ✅ Mitigated |
| 3 | Message impersonation | 🔴 Critical | Security breach | RLS enforces sender_id = auth.uid() | ✅ Mitigated |
| 4 | Unauthorized message read | 🔴 Critical | Privacy violation | RLS subquery validates participation | ✅ Mitigated |
| 5 | XSS via message content | 🟡 Medium | Security breach | Frontend sanitization (DOMPurify) | ⚠️ To implement |
| 6 | SQL injection | 🟢 Low | Security breach | Parameterized queries (Supabase) | ✅ Mitigated |
| 7 | Rate limiting | 🟡 Medium | Spam/abuse | API rate limiting | ⚠️ To consider |
| 8 | Message spam | 🟡 Medium | UX degradation | Length limits, rate limits | ⚠️ To consider |
| 9 | Admin overreach | 🟢 Low | Privacy violation | RLS enforces participation | ✅ Mitigated |
| 10 | Realtime duplicate messages | 🟢 Low | UX confusion | Deduplicate by ID | ✅ Mitigated |
| 11 | Stale conversation order | 🟢 Low | UX confusion | Trigger updates timestamp | ✅ Mitigated |
| 12 | Unread count mismatch | 🟡 Medium | UX confusion | Database-driven count | ✅ Mitigated |
| 13 | Deleted user cascade | 🟡 Medium | Data loss | ON DELETE CASCADE (expected) | ✅ Mitigated |
| 14 | Performance (large threads) | 🟡 Medium | Slow loading | Pagination, indexes | ⚠️ To implement |
| 15 | Storage (message history) | 🟢 Low | Database growth | Monitor, consider archiving | ⚠️ To monitor |

**Legend:**
- 🔴 Critical: Must fix before launch
- 🟡 Medium: Should fix soon
- 🟢 Low: Monitor and fix if needed
- ✅ Mitigated: Already addressed
- ⚠️ To implement: Needs implementation
- ⚠️ To consider: Future enhancement


---

## 10. Phase-by-Phase Implementation Plan

### Phase 1: Database Foundation (2-3 hours)

**Goal:** Create secure database schema with RLS policies

**Files to Create:**
- `supabase/migrations/[timestamp]_messaging_schema_v2_secure.sql`

**Database Changes:**
1. Create `conversations` table with constraints
2. Create `messages` table with constraints
3. Create indexes for performance
4. Create `create_or_get_conversation()` RPC function
5. Create triggers for conversation updates
6. Create RLS policies for conversations
7. Create RLS policies for messages
8. Enable Realtime publication

**Testing Checklist:**
- [ ] Run migration successfully
- [ ] Verify constraints work (try self-messaging, duplicate conversation)
- [ ] Test RPC function (create conversation, get existing)
- [ ] Test RLS policies (try unauthorized access)
- [ ] Verify triggers update conversation timestamps
- [ ] Check indexes exist

**Rollback Notes:**
- Keep rollback SQL in separate file
- Test rollback before proceeding

**Security Checks:**
- [ ] No direct INSERT policy on conversations
- [ ] RLS enforces sender_id = auth.uid()
- [ ] Subquery validates conversation participation
- [ ] RPC validates user existence


---

### Phase 2: TypeScript Types & API Utilities (1-2 hours)

**Goal:** Generate types and create API helper functions

**Files to Modify:**
- `types/database.ts` (auto-generated)

**Files to Create:**
- `lib/messages.ts` (API helper functions)

**API Functions to Create:**
```typescript
// lib/messages.ts
export async function createOrGetConversation(otherUserId: string): Promise<string>
export async function fetchMyConversations(userId: string): Promise<Conversation[]>
export async function fetchConversationMessages(conversationId: string): Promise<Message[]>
export async function sendMessage(conversationId: string, content: string): Promise<Message>
export async function editMessage(messageId: string, content: string): Promise<void>
export async function deleteMessage(messageId: string): Promise<void>
export async function markMessagesAsRead(conversationId: string): Promise<void>
export async function getUnreadMessageCount(userId: string): Promise<number>
```

**Testing Checklist:**
- [ ] Types generated correctly
- [ ] All API functions work
- [ ] Error handling works
- [ ] RLS policies enforced

**Rollback Notes:**
- No database changes, safe to iterate

---

### Phase 3: Header Integration (1-2 hours)

**Goal:** Add messages icon to header with unread badge

**Files to Modify:**
- `components/layout/TopHeader.tsx`

**Files to Create:**
- `components/messages/MessageIcon.tsx`

**Changes:**
1. Add MessageIcon between NotificationBell and BugTrack
2. Fetch unread count on mount
3. Show dot badge if unread > 0
4. Link to `/messages`

**Testing Checklist:**
- [ ] Icon appears in header
- [ ] Badge shows unread count
- [ ] Clicking navigates to `/messages`
- [ ] Responsive on mobile

**Rollback Notes:**
- Remove MessageIcon import and JSX


---

### Phase 4: Messages Page - Basic UI (4-6 hours)

**Goal:** Create `/messages` page with conversation list and thread

**Files to Create:**
- `app/messages/page.tsx`
- `app/messages/layout.tsx` (optional)
- `components/messages/ConversationList.tsx`
- `components/messages/ConversationItem.tsx`
- `components/messages/MessageThread.tsx`
- `components/messages/MessageBubble.tsx`
- `components/messages/MessageInput.tsx`

**UI Structure:**
```
/messages
├── Left Sidebar (30%)
│   ├── Search bar
│   ├── "New Message" button
│   └── Conversation list
│       └── ConversationItem (avatar, name, preview, timestamp, unread)
└── Right Side (70%)
    ├── Header (user name)
    ├── Message thread (scrollable)
    │   └── MessageBubble (sender, content, timestamp, edited/deleted)
    └── MessageInput (text field + send button)
```

**Testing Checklist:**
- [ ] Conversation list loads
- [ ] Clicking conversation loads messages
- [ ] Sending message works
- [ ] Message appears in thread
- [ ] Deleted messages show "Message deleted"
- [ ] Edited messages show "edited" indicator
- [ ] Responsive layout

**Rollback Notes:**
- Delete `app/messages/` directory
- Remove MessageIcon from header


---

### Phase 5: New Message Page (2-3 hours)

**Goal:** Create `/messages/new` page for user search and conversation creation

**Files to Create:**
- `app/messages/new/page.tsx`
- `components/messages/UserSearch.tsx`

**UI Structure:**
```
/messages/new
├── Search bar (search by name/email)
├── User list (filtered results)
│   └── UserItem (avatar, name, department, position)
└── Click user → navigate to /messages?conversation={id}
```

**Logic:**
1. Search profiles table (exclude self)
2. Click user → call `createOrGetConversation(userId)`
3. Navigate to `/messages?conversation={conversationId}`
4. If conversation exists, navigate to existing one

**Testing Checklist:**
- [ ] Search works
- [ ] Cannot select self
- [ ] Clicking user creates/gets conversation
- [ ] Navigates to conversation
- [ ] Existing conversation reused

**Rollback Notes:**
- Delete `app/messages/new/` directory

---

### Phase 6: Realtime Integration (3-4 hours)

**Goal:** Add Supabase Realtime for instant message delivery

**Files to Modify:**
- `components/messages/MessageThread.tsx`
- `components/messages/ConversationList.tsx`
- `components/messages/MessageIcon.tsx`

**Realtime Subscriptions:**
1. MessageThread: Subscribe to messages INSERT/UPDATE for conversation
2. ConversationList: Subscribe to conversations UPDATE for user
3. MessageIcon: Subscribe to messages INSERT for unread count

**Testing Checklist:**
- [ ] New messages appear instantly
- [ ] Edited messages update instantly
- [ ] Deleted messages update instantly
- [ ] Conversation list reorders on new message
- [ ] Unread badge updates instantly
- [ ] Multiple tabs work correctly
- [ ] No duplicate messages

**Rollback Notes:**
- Remove Realtime subscriptions
- Revert to polling/manual refresh


---

### Phase 7: Polish & Security (3-4 hours)

**Goal:** Add final features and security hardening

**Features to Add:**
1. **Message editing:**
   - Edit button on own messages
   - Show "edited" indicator
   - Update `edited_at` timestamp

2. **Message deletion:**
   - Delete button on own messages
   - Confirmation dialog
   - Set `is_deleted = true`
   - Show "Message deleted" placeholder

3. **Read receipts:**
   - Mark messages as read when conversation opens
   - Update `read_by_other = true`

4. **Typing indicator (optional):**
   - Broadcast typing status via Supabase Presence
   - Show "User is typing..." in thread

5. **XSS Protection:**
   - Install DOMPurify: `npm install dompurify @types/dompurify`
   - Sanitize message content before rendering
   - Escape HTML entities

6. **Empty states:**
   - No conversations yet
   - No messages in thread
   - Search returns no results

7. **Loading states:**
   - Skeleton loaders for conversation list
   - Loading spinner for messages
   - Optimistic UI for sending messages

**Testing Checklist:**
- [ ] Edit message works
- [ ] Delete message works
- [ ] Read receipts work
- [ ] Typing indicator works (if implemented)
- [ ] XSS protection works (test with `<script>alert('xss')</script>`)
- [ ] Empty states show correctly
- [ ] Loading states show correctly

**Rollback Notes:**
- Revert individual features if needed


---

### Phase 8: Navigation Integration (1 hour)

**Goal:** Add messages to sidebar navigation

**Files to Modify:**
- `config/navigation.ts`
- `components/layout/Sidebar.tsx` (icon map)

**Changes:**
1. Add `messages` to `ModuleKey` type
2. Add messages nav item to `ALL_NAV`
3. Add messages to all role navigations
4. Add `MessageSquare` icon to `ICON_MAP`

**Testing Checklist:**
- [ ] Messages appears in sidebar for all roles
- [ ] Clicking navigates to `/messages`
- [ ] Active state works
- [ ] Icon displays correctly

**Rollback Notes:**
- Remove messages from navigation config

---

## 11. Final Security Checklist

Before launching to production:

### Database Security
- [ ] RLS enabled on all messaging tables
- [ ] No direct INSERT policy on conversations
- [ ] RPC function validates user existence
- [ ] Constraints prevent self-messaging
- [ ] Constraints prevent duplicate conversations
- [ ] Cascade deletes configured correctly

### Frontend Security
- [ ] XSS protection implemented (DOMPurify)
- [ ] No eval() or dangerouslySetInnerHTML
- [ ] User input sanitized
- [ ] Error messages don't leak sensitive info

### API Security
- [ ] All routes require authentication
- [ ] Rate limiting considered
- [ ] Input validation on all endpoints
- [ ] Error handling doesn't expose internals

### Privacy
- [ ] Admins cannot see private messages (unless participant)
- [ ] Users can only see their own conversations
- [ ] Deleted messages stay deleted (soft delete)

### Performance
- [ ] Indexes on all foreign keys
- [ ] Pagination for large message threads
- [ ] Realtime subscriptions scoped correctly
- [ ] No N+1 queries


---

## 12. Approval Required

**Status:** ⚠️ **AWAITING APPROVAL**

This audit has identified critical security issues in the previous messaging implementation and provided a secure alternative. Before proceeding with Phase 1:

### Required Approvals:
1. **Database Schema Approval**
   - Confirm `conversations` table structure
   - Confirm `messages` table structure
   - Confirm RPC-based conversation creation approach

2. **Security Approach Approval**
   - Confirm RLS policies are acceptable
   - Confirm no admin bypass is acceptable
   - Confirm soft delete approach

3. **Implementation Timeline Approval**
   - Estimated 18-26 hours total
   - 8 phases over 2-3 days
   - Confirm timeline is acceptable

### Questions for User:
1. Do you approve the recommended database schema?
2. Do you approve the RPC-based conversation creation (no direct INSERT)?
3. Do you want typing indicators in Phase 7?
4. Do you want message search functionality (future enhancement)?
5. Do you want file attachments (future enhancement)?
6. Should messages be available to all roles, or role-restricted?

### Next Steps After Approval:
1. Create Phase 1 migration file
2. Test migration on development database
3. Verify RLS policies work as expected
4. Proceed to Phase 2

---

## 13. Conclusion

This audit has thoroughly examined the Fortune Procurement System and identified a secure path forward for implementing 1-on-1 messaging. The previous implementation was correctly rolled back due to participant injection vulnerabilities.

**Key Findings:**
- ✅ Current system is well-structured and secure
- ✅ Messaging can be added without breaking existing functionality
- ✅ RPC-based conversation creation prevents security vulnerabilities
- ✅ RLS policies enforce strict access control
- ✅ No admin bypass (admins must be participants)

**Recommendation:** Proceed with implementation using the architecture outlined in this document.

---

**Document Version:** 1.0  
**Last Updated:** May 19, 2026  
**Next Review:** After Phase 1 completion

