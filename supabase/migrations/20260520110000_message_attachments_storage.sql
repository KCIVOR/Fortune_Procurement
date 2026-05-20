-- ============================================================================
-- MESSAGE ATTACHMENTS STORAGE - PHASE 2: STORAGE BUCKET & RLS
-- ============================================================================
-- Migration: 20260520110000_message_attachments_storage
-- Source of Truth: .kiro/implementation/MESSAGE-ATTACHMENTS-AUDIT-AND-PLAN.md
-- Description:
--   Creates 'message-attachments' storage bucket for file uploads.
--   Adds RLS policies for storage objects (upload/download).
--   Adds RLS policies for message_attachments table (CRUD).
--
-- Risk Level: LOW (isolated, bucket not exposed until Phase 3)
-- Reversible: YES - see rollback notes at end of file
-- Breaking Changes: NONE
-- Date: 2026-05-20
-- ============================================================================

-- ─── STORAGE BUCKET ────────────────────────────────────────────────────────
-- Private bucket for message attachments.
-- Path convention: messages/{conversation_id}/{message_id}/{timestamp}_{filename}
--   split_part indices: 1=messages, 2=conversation_id, 3=message_id, 4=filename

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-attachments',
  'message-attachments',
  FALSE,
  10485760, -- 10 MB
  ARRAY[
    'image/jpeg', 
    'image/png', 
    'image/gif', 
    'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ═══════════════════════════════════════════════════════════════════════════
-- STORAGE OBJECT RLS POLICIES
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Upload Policy: Users can upload to their own conversations ─────────────
-- Validates:
--   1. Path format: messages/{conversation_id}/{message_id}/{filename}
--   2. User is a participant in the conversation
--   3. Message belongs to the conversation and sender is current user

CREATE POLICY "message_attachments_upload"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'message-attachments'
  AND split_part(name, '/', 1) = 'messages'
  AND split_part(name, '/', 4) <> ''  -- filename must exist
  AND split_part(name, '/', 5) = ''   -- no extra path segments
  -- Verify user is participant in the conversation
  AND EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = split_part(name, '/', 2)::uuid
      AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
  )
  -- Verify message belongs to conversation and sender is current user
  AND EXISTS (
    SELECT 1 FROM messages m
    WHERE m.id = split_part(name, '/', 3)::uuid
      AND m.conversation_id = split_part(name, '/', 2)::uuid
      AND m.sender_id = auth.uid()
  )
);

-- ─── Download Policy: Conversation participants can download ────────────────
-- Any participant in the conversation can view/download attachments

CREATE POLICY "message_attachments_download"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'message-attachments'
  AND split_part(name, '/', 1) = 'messages'
  -- Verify user is participant in the conversation
  AND EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = split_part(name, '/', 2)::uuid
      AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
  )
);

-- ─── Admin Policy: Full read access ─────────────────────────────────────────
-- Admins can view all message attachments for moderation/support

CREATE POLICY "message_attachments_admin_select"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'message-attachments'
  AND EXISTS (
    SELECT 1 FROM profiles p 
    JOIN roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'admin'
  )
);

-- ═══════════════════════════════════════════════════════════════════════════
-- MESSAGE_ATTACHMENTS TABLE RLS POLICIES
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── SELECT: Conversation participants can view attachments ─────────────────

CREATE POLICY "message_attachments_select"
ON message_attachments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = conversation_id
      AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
  )
);

-- ─── INSERT: Message sender can add attachments ─────────────────────────────
-- Only the sender of a message can attach files to it

CREATE POLICY "message_attachments_insert"
ON message_attachments
FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM messages m
    WHERE m.id = message_id
      AND m.sender_id = auth.uid()
      AND m.conversation_id = conversation_id
  )
);

-- ─── DELETE: Message sender can delete their attachments ────────────────────
-- Only the uploader can delete their own attachments

CREATE POLICY "message_attachments_delete"
ON message_attachments
FOR DELETE TO authenticated
USING (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM messages m
    WHERE m.id = message_id 
      AND m.sender_id = auth.uid()
  )
);

-- ─── Admin: Full access to message_attachments table ────────────────────────

CREATE POLICY "message_attachments_admin"
ON message_attachments
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    JOIN roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p 
    JOIN roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'admin'
  )
);

-- ═══════════════════════════════════════════════════════════════════════════
-- ENABLE REALTIME FOR MESSAGE_ATTACHMENTS
-- ═══════════════════════════════════════════════════════════════════════════
-- This allows clients to subscribe to attachment changes in real-time

ALTER PUBLICATION supabase_realtime ADD TABLE message_attachments;

-- ============================================================================
-- ROLLBACK (for reference; apply via a separate migration if needed)
-- ----------------------------------------------------------------------------
-- -- Remove from realtime
-- ALTER PUBLICATION supabase_realtime DROP TABLE message_attachments;
--
-- -- Drop table RLS policies
-- DROP POLICY IF EXISTS "message_attachments_select" ON message_attachments;
-- DROP POLICY IF EXISTS "message_attachments_insert" ON message_attachments;
-- DROP POLICY IF EXISTS "message_attachments_delete" ON message_attachments;
-- DROP POLICY IF EXISTS "message_attachments_admin" ON message_attachments;
--
-- -- Drop storage RLS policies
-- DROP POLICY IF EXISTS "message_attachments_upload" ON storage.objects;
-- DROP POLICY IF EXISTS "message_attachments_download" ON storage.objects;
-- DROP POLICY IF EXISTS "message_attachments_admin_select" ON storage.objects;
--
-- -- Delete bucket (WARNING: Deletes all files!)
-- DELETE FROM storage.buckets WHERE id = 'message-attachments';
-- ============================================================================
