-- ============================================================================
-- MESSAGE ATTACHMENTS SCHEMA - PHASE 1: DATABASE FOUNDATION
-- ============================================================================
-- Migration: 20260520100000_message_attachments_schema
-- Source of Truth: .kiro/implementation/MESSAGE-ATTACHMENTS-AUDIT-AND-PLAN.md
-- Description:
--   Creates `message_attachments` table for storing file attachment metadata.
--   Adds `attachment_count` column to messages table for quick queries.
--   Updates messages constraint to allow empty content when attachments exist.
--   Creates trigger to auto-update attachment_count.
--
-- Risk Level: LOW (additive, no breaking changes)
-- Reversible: YES - see rollback notes at end of file
-- Breaking Changes: NONE
-- Date: 2026-05-20
-- ============================================================================

-- ─── MESSAGE ATTACHMENTS TABLE ─────────────────────────────────────────────
-- Stores metadata for files attached to messages. Actual files are stored in
-- the 'message-attachments' storage bucket (created in Phase 2).
-- Path convention: messages/{conversation_id}/{message_id}/{timestamp}_{filename}

CREATE TABLE IF NOT EXISTS message_attachments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id       uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  conversation_id  uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  file_name        text NOT NULL,
  file_path        text NOT NULL UNIQUE,
  file_size        bigint NOT NULL,
  mime_type        text NOT NULL,
  uploaded_by      uuid NOT NULL REFERENCES profiles(id),
  created_at       timestamptz DEFAULT now(),

  -- Constraints
  CONSTRAINT file_name_not_empty CHECK (char_length(trim(file_name)) > 0),
  CONSTRAINT file_size_positive CHECK (file_size > 0),
  CONSTRAINT file_size_limit CHECK (file_size <= 10485760) -- 10 MB max
);

-- ─── INDEXES ───────────────────────────────────────────────────────────────
-- Fast lookup of attachments by message
CREATE INDEX IF NOT EXISTS idx_message_attachments_message
  ON message_attachments(message_id);

-- Conversation-scoped queries with recency ordering
CREATE INDEX IF NOT EXISTS idx_message_attachments_conversation
  ON message_attachments(conversation_id, created_at DESC);

-- Uploader lookup (for user's own attachments)
CREATE INDEX IF NOT EXISTS idx_message_attachments_uploader
  ON message_attachments(uploaded_by);

-- ─── ADD ATTACHMENT COUNT TO MESSAGES ──────────────────────────────────────
-- Denormalized count for quick queries without JOIN
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS attachment_count integer DEFAULT 0;

-- ─── UPDATE MESSAGES CONSTRAINT ────────────────────────────────────────────
-- Relax the content_not_empty constraint to allow attachment-only messages.
-- New rule: message must have content OR be deleted OR have attachments.

-- First, drop the existing constraint
ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS content_not_empty;

-- Add new constraint that allows empty content if attachments exist
-- Note: We use a function-based check since subqueries aren't allowed in CHECK
-- The trigger below ensures attachment_count stays in sync
ALTER TABLE messages
  ADD CONSTRAINT content_or_attachments_required
  CHECK (
    char_length(trim(content)) > 0
    OR is_deleted = true
    OR attachment_count > 0
  );

-- ─── ATTACHMENT COUNT TRIGGER ──────────────────────────────────────────────
-- Automatically updates messages.attachment_count when attachments are
-- inserted or deleted. This keeps the denormalized count in sync.

CREATE OR REPLACE FUNCTION update_message_attachment_count()
RETURNS TRIGGER AS $$
DECLARE
  target_message_id uuid;
BEGIN
  -- Get the message_id from either NEW (insert) or OLD (delete)
  target_message_id := COALESCE(NEW.message_id, OLD.message_id);
  
  -- Update the attachment count on the parent message
  UPDATE messages
  SET attachment_count = (
    SELECT COUNT(*)::integer
    FROM message_attachments
    WHERE message_id = target_message_id
  )
  WHERE id = target_message_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger fires after INSERT or DELETE on message_attachments
CREATE TRIGGER trg_update_attachment_count
  AFTER INSERT OR DELETE ON message_attachments
  FOR EACH ROW
  EXECUTE FUNCTION update_message_attachment_count();

-- ─── RLS POSTURE ───────────────────────────────────────────────────────────
-- RLS is enabled but policies are added in Phase 2 migration.
-- This ensures the table is secure by default.
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ROLLBACK (for reference; apply via a separate migration if needed)
-- ----------------------------------------------------------------------------
-- -- Drop trigger and function
-- DROP TRIGGER IF EXISTS trg_update_attachment_count ON message_attachments;
-- DROP FUNCTION IF EXISTS update_message_attachment_count();
--
-- -- Remove attachment_count column from messages
-- ALTER TABLE messages DROP COLUMN IF EXISTS attachment_count;
--
-- -- Restore original constraint on messages
-- ALTER TABLE messages DROP CONSTRAINT IF EXISTS content_or_attachments_required;
-- ALTER TABLE messages ADD CONSTRAINT content_not_empty
--   CHECK (char_length(trim(content)) > 0 OR is_deleted = true);
--
-- -- Drop indexes
-- DROP INDEX IF EXISTS idx_message_attachments_uploader;
-- DROP INDEX IF EXISTS idx_message_attachments_conversation;
-- DROP INDEX IF EXISTS idx_message_attachments_message;
--
-- -- Drop table
-- DROP TABLE IF EXISTS message_attachments CASCADE;
-- ============================================================================
