-- ============================================================================
-- ROLLBACK MESSAGING SCHEMA
-- ============================================================================
-- Migration: 20260519000000_rollback_messaging_schema
-- Description: Removes all messaging tables, RLS policies, triggers, and storage bucket
-- Reason: Rolling back messaging feature due to security vulnerabilities
-- Date: 2026-05-19
-- ============================================================================

-- Drop all RLS policies first
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can create direct conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can view their own participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can insert themselves as participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can update their own participant record" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can soft-delete their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view attachments in their conversations" ON public.message_attachments;
DROP POLICY IF EXISTS "Users can upload attachments to their messages" ON public.message_attachments;
DROP POLICY IF EXISTS "Users can soft-delete their own attachments" ON public.message_attachments;

-- Drop triggers
DROP TRIGGER IF EXISTS update_conversations_updated_at ON public.conversations;
DROP TRIGGER IF EXISTS update_messages_updated_at ON public.messages;
DROP TRIGGER IF EXISTS update_conversation_last_message ON public.messages;

-- Drop functions
DROP FUNCTION IF EXISTS public.update_conversation_last_message() CASCADE;

-- Drop tables (in reverse dependency order)
DROP TABLE IF EXISTS public.message_attachments CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.conversation_participants CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;

-- Note: Storage bucket 'message-attachments' must be deleted manually via Supabase Dashboard
-- or Storage API due to protection against accidental deletion
-- Dashboard: Storage > message-attachments > Settings > Delete bucket

-- Drop storage policies (if they exist)
DROP POLICY IF EXISTS "Users can view attachments in their conversations" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload attachments to their conversations" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own attachments" ON storage.objects;

-- Drop realtime publication for messaging tables
DROP PUBLICATION IF EXISTS supabase_realtime_messaging;

-- Log the rollback
DO $$
BEGIN
  RAISE NOTICE 'Messaging schema rollback completed successfully';
  RAISE NOTICE 'Removed tables: conversations, conversation_participants, messages, message_attachments';
  RAISE NOTICE 'NOTE: Storage bucket "message-attachments" must be deleted manually via Dashboard';
  RAISE NOTICE 'Removed all associated RLS policies, triggers, and functions';
END $$;
