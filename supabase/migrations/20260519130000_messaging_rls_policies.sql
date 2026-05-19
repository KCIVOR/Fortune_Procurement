-- ============================================================================
-- PHASE 2: MESSAGING RLS POLICIES (SECURITY LAYER)
-- ============================================================================
-- Migration: 20260519130000_messaging_rls_policies
-- Source of Truth: docs/MESSAGING_SURGICAL_IMPLEMENTATION_PLAN.md (Phase 2)
-- Description:
--   Enables RLS on `conversations` and `messages` and installs the security
--   policies for Phase 2. No functions, no triggers, no realtime, no schema
--   changes. Strictly the security layer.
--
-- Design Notes:
--   * INSERT on conversations is intentionally NOT policy-allowed in Phase 2.
--     Conversation creation will go through SECURITY DEFINER RPC in Phase 3
--     so participant ordering/identity cannot be forged client-side.
--   * DELETE is intentionally NOT policy-allowed on either table.
--     Conversations are permanent; messages are soft-deleted via UPDATE.
--   * Messages UPDATE is restricted to the sender (own-message edits and
--     soft-delete only). Recipient-side actions (read receipts, etc.) will
--     be handled via dedicated RPC in a later phase, not by widening this
--     policy.
--
-- Risk Level: MEDIUM (security layer, but tables not yet exposed to UI/API)
-- Reversible: YES - see rollback notes at end of file
-- Touches Existing Procurement Logic: NO
-- Touches Existing RLS On Other Tables: NO
-- Date: 2026-05-19
-- ============================================================================

-- ─── ENABLE ROW LEVEL SECURITY ─────────────────────────────────────────────
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages       ENABLE ROW LEVEL SECURITY;

-- ─── CONVERSATIONS POLICIES ────────────────────────────────────────────────
-- SELECT: a user may read a conversation row only if they are one of its two
-- canonical participants.
CREATE POLICY "Users can view their conversations"
  ON public.conversations
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_a_id
    OR auth.uid() = user_b_id
  );

-- UPDATE: a participant may update conversation metadata (last_message_at,
-- preview, updated_at) but cannot pivot the conversation onto another user
-- because the WITH CHECK clause re-asserts membership against the new row.
CREATE POLICY "Users can update their conversations"
  ON public.conversations
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_a_id
    OR auth.uid() = user_b_id
  )
  WITH CHECK (
    auth.uid() = user_a_id
    OR auth.uid() = user_b_id
  );

-- INSERT on conversations: intentionally absent (handled via Phase 3 RPC).
-- DELETE on conversations: intentionally absent (conversations are permanent).

-- ─── MESSAGES POLICIES ─────────────────────────────────────────────────────
-- SELECT: a user may read a message only if they participate in its
-- conversation. Implemented via EXISTS against conversations - safe because
-- conversations policies do not reference messages, so no policy recursion.
CREATE POLICY "Users can view messages in their conversations"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
    )
  );

-- INSERT: a user may insert a message only if (a) they are the declared
-- sender and (b) they participate in the target conversation. The sender_id
-- = auth.uid() guard prevents impersonation; the EXISTS guard prevents
-- writing into conversations the user is not part of.
CREATE POLICY "Users can send messages to their conversations"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
    )
  );

-- UPDATE: a user may update only their own messages (used for edits and for
-- soft-delete via setting is_deleted = true). WITH CHECK blocks rewriting
-- sender_id away from auth.uid().
CREATE POLICY "Users can update their own messages"
  ON public.messages
  FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- DELETE on messages: intentionally absent (soft-delete only, via UPDATE).

-- ============================================================================
-- ROLLBACK (for reference; apply via a separate migration if needed)
-- ----------------------------------------------------------------------------
-- DROP POLICY IF EXISTS "Users can update their own messages"          ON public.messages;
-- DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.messages;
-- DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
-- DROP POLICY IF EXISTS "Users can update their conversations"         ON public.conversations;
-- DROP POLICY IF EXISTS "Users can view their conversations"           ON public.conversations;
-- ALTER TABLE public.messages       DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.conversations DISABLE ROW LEVEL SECURITY;
-- ============================================================================
