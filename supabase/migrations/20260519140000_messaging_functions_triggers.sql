-- ============================================================================
-- PHASE 3: MESSAGING RPC FUNCTIONS & TRIGGERS
-- ============================================================================
-- Migration: 20260519140000_messaging_functions_triggers
-- Source of Truth: docs/MESSAGING_SURGICAL_IMPLEMENTATION_PLAN.md (Phase 3)
-- Description:
--   Creates the secure RPC function for conversation creation/retrieval and
--   the trigger function + triggers for automatic conversation metadata
--   updates when messages are inserted or updated.
--
-- Design Notes:
--   * create_or_get_conversation is SECURITY DEFINER so it can INSERT into
--     conversations despite no INSERT RLS policy existing. This is the ONLY
--     sanctioned path for conversation creation.
--   * The function enforces: authentication, self-messaging prevention,
--     target user existence, canonical participant ordering, and idempotency.
--   * update_conversation_on_message is SECURITY DEFINER so it can UPDATE
--     the conversation row regardless of which participant sent the message.
--   * Both functions use SET search_path = public to prevent search_path
--     injection attacks.
--
-- Risk Level: LOW (functions isolated, no frontend exposure yet)
-- Reversible: YES - see rollback notes at end of file
-- Touches Existing Procurement Logic: NO
-- Date: 2026-05-19
-- ============================================================================

-- ─── RPC: CREATE OR GET CONVERSATION ───────────────────────────────────────
-- Secure, idempotent conversation creation. Returns the conversation UUID.
-- If a conversation already exists between the two users, returns the existing
-- one. Otherwise creates a new one with canonical ordering enforced.
CREATE OR REPLACE FUNCTION public.create_or_get_conversation(other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  user_a uuid;
  user_b uuid;
  conv_id uuid;
BEGIN
  -- 1. Authentication check
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Self-messaging prevention
  IF current_user_id = other_user_id THEN
    RAISE EXCEPTION 'Cannot create conversation with yourself';
  END IF;

  -- 3. Target user existence check
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = other_user_id) THEN
    RAISE EXCEPTION 'User does not exist';
  END IF;

  -- 4. Canonical ordering (user_a_id < user_b_id)
  IF current_user_id < other_user_id THEN
    user_a := current_user_id;
    user_b := other_user_id;
  ELSE
    user_a := other_user_id;
    user_b := current_user_id;
  END IF;

  -- 5. Idempotent lookup-or-create
  SELECT id INTO conv_id
  FROM conversations
  WHERE user_a_id = user_a AND user_b_id = user_b;

  IF conv_id IS NULL THEN
    INSERT INTO conversations (user_a_id, user_b_id)
    VALUES (user_a, user_b)
    RETURNING id INTO conv_id;
  END IF;

  RETURN conv_id;
END;
$$;

-- Grant execute to authenticated users only
GRANT EXECUTE ON FUNCTION public.create_or_get_conversation(uuid) TO authenticated;

-- ─── TRIGGER FUNCTION: UPDATE CONVERSATION ON MESSAGE ──────────────────────
-- Automatically updates conversation metadata (last_message_at, preview,
-- updated_at) whenever a message is inserted or updated. Runs as SECURITY
-- DEFINER so it can update the conversation row regardless of which
-- participant triggered the action.
CREATE OR REPLACE FUNCTION public.update_conversation_on_message()
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

-- ─── TRIGGERS ──────────────────────────────────────────────────────────────
-- Trigger 1: After a new message is inserted, update conversation metadata.
CREATE TRIGGER trigger_update_conversation_on_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_on_message();

-- Trigger 2: After a message is updated (edit or soft-delete), update
-- conversation metadata only if content or deletion status changed.
CREATE TRIGGER trigger_update_conversation_on_message_update
  AFTER UPDATE ON public.messages
  FOR EACH ROW
  WHEN (OLD.is_deleted IS DISTINCT FROM NEW.is_deleted OR OLD.content IS DISTINCT FROM NEW.content)
  EXECUTE FUNCTION public.update_conversation_on_message();

-- ============================================================================
-- ROLLBACK (for reference; apply via a separate migration if needed)
-- ----------------------------------------------------------------------------
-- DROP TRIGGER IF EXISTS trigger_update_conversation_on_message_update ON public.messages;
-- DROP TRIGGER IF EXISTS trigger_update_conversation_on_message ON public.messages;
-- DROP FUNCTION IF EXISTS public.update_conversation_on_message() CASCADE;
-- DROP FUNCTION IF EXISTS public.create_or_get_conversation(uuid) CASCADE;
-- ============================================================================
