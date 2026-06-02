-- ============================================================================
-- ADD MISSING mark_messages_as_read RPC FUNCTION
-- ============================================================================
-- Migration: 20260602000000_add_mark_messages_as_read_rpc
-- Description:
--   Creates the mark_messages_as_read RPC function that was referenced in
--   types but never actually created in the database.
--
-- Security:
--   - SECURITY DEFINER allows updating read_at without RLS policy
--   - Validates caller is a participant in the conversation
--   - Only updates messages where sender_id != caller (can't mark own messages as read)
--   - Only updates messages where read_at IS NULL (already-read messages unchanged)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_messages_as_read(p_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  -- Get authenticated user
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Verify user is a participant in this conversation
  IF NOT EXISTS (
    SELECT 1
    FROM conversations
    WHERE id = p_conversation_id
      AND (user_a_id = current_user_id OR user_b_id = current_user_id)
  ) THEN
    RAISE EXCEPTION 'User is not a participant in this conversation';
  END IF;
  
  -- Mark unread messages as read (excluding user's own messages)
  UPDATE messages
  SET 
    read_at = now(),
    updated_at = now()
  WHERE conversation_id = p_conversation_id
    AND sender_id != current_user_id  -- Don't mark own messages as read
    AND read_at IS NULL;              -- Only mark currently unread messages
    
  -- Note: No RETURN needed for void function
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.mark_messages_as_read(uuid) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION public.mark_messages_as_read IS 
  'Marks all unread messages in a conversation as read for the calling user. SECURITY DEFINER function that validates caller is a participant.';

-- ============================================================================
-- ROLLBACK (for reference)
-- ----------------------------------------------------------------------------
-- DROP FUNCTION IF EXISTS public.mark_messages_as_read(uuid);
-- ============================================================================
