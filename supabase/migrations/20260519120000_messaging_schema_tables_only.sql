-- ============================================================================
-- PHASE 1: MESSAGING SCHEMA FOUNDATION (TABLES ONLY)
-- ============================================================================
-- Migration: 20260519120000_messaging_schema_tables_only
-- Source of Truth: docs/MESSAGING_SURGICAL_IMPLEMENTATION_PLAN.md (Phase 1)
-- Description:
--   Creates `conversations` and `messages` tables with constraints and indexes.
--   Pure schema only - intentionally NO RLS, NO functions, NO triggers,
--   NO realtime, NO seed data. RLS, RPCs and triggers are added in
--   subsequent phases (Phase 2 and Phase 3).
--
-- Risk Level: LOW (additive, isolated, no exposure)
-- Reversible: YES - see rollback notes at end of file
-- Touches Existing Procurement Logic: NO
-- Date: 2026-05-19
-- ============================================================================

-- ─── CONVERSATIONS ─────────────────────────────────────────────────────────
-- 1:1 conversation envelope between two profiles. user_a_id < user_b_id is
-- enforced so a conversation pair has exactly one canonical row, allowing the
-- UNIQUE(user_a_id, user_b_id) constraint to act as a true uniqueness guard.
CREATE TABLE IF NOT EXISTS conversations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id             uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_b_id             uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_message_at       timestamptz DEFAULT now(),
  last_message_preview  text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),

  CONSTRAINT users_ordered        CHECK (user_a_id < user_b_id),
  CONSTRAINT no_self_conversation CHECK (user_a_id <> user_b_id),
  CONSTRAINT unique_conversation  UNIQUE (user_a_id, user_b_id)
);

-- ─── MESSAGES ──────────────────────────────────────────────────────────────
-- Individual message rows belonging to a conversation. Soft-delete is modeled
-- via `is_deleted` so message history remains intact for audit/threading.
CREATE TABLE IF NOT EXISTS messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content          text NOT NULL,
  is_deleted       boolean DEFAULT false,
  read_at          timestamptz,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  edited_at        timestamptz,

  CONSTRAINT content_not_empty
    CHECK (char_length(trim(content)) > 0 OR is_deleted = true)
);

-- ─── INDEXES ───────────────────────────────────────────────────────────────
-- Conversation lookups by participant, ordered by recency.
CREATE INDEX IF NOT EXISTS idx_conversations_user_a
  ON conversations (user_a_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_user_b
  ON conversations (user_b_id, last_message_at DESC);

-- Message thread retrieval (newest first within a conversation).
CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON messages (conversation_id, created_at DESC);

-- Sender-scoped queries (own messages, edit/delete authorization).
CREATE INDEX IF NOT EXISTS idx_messages_sender
  ON messages (sender_id);

-- Partial index supporting fast unread-count and unread-list queries.
CREATE INDEX IF NOT EXISTS idx_messages_unread
  ON messages (conversation_id, read_at)
  WHERE read_at IS NULL;

-- ─── RLS POSTURE ───────────────────────────────────────────────────────────
-- INTENTIONALLY LEFT DISABLED IN PHASE 1.
-- Tables are not exposed to any route, RPC, or component yet, so disabled RLS
-- here does not create a runtime exposure. RLS is enabled and policies are
-- introduced in Phase 2 (20260519130000_messaging_rls_policies.sql).
-- Do not enable RLS in this migration.

-- ============================================================================
-- ROLLBACK (for reference; apply via a separate migration if needed)
-- ----------------------------------------------------------------------------
-- DROP INDEX IF EXISTS idx_messages_unread;
-- DROP INDEX IF EXISTS idx_messages_sender;
-- DROP INDEX IF EXISTS idx_messages_conversation;
-- DROP INDEX IF EXISTS idx_conversations_user_b;
-- DROP INDEX IF EXISTS idx_conversations_user_a;
-- DROP TABLE IF EXISTS messages CASCADE;
-- DROP TABLE IF EXISTS conversations CASCADE;
-- ============================================================================
