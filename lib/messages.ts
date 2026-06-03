import { supabase } from '@/lib/supabase';
import type { Conversation, Message } from '@/types/database';

const db = supabase as any;

// ─── Conversation helpers ─────────────────────────────────────────────────────

/**
 * Creates or retrieves an existing conversation with another user.
 * Uses the `create_or_get_conversation` RPC (SECURITY DEFINER) which
 * enforces user ordering, prevents self-messaging, and validates user existence.
 */
export async function createOrGetConversation(otherUserId: string): Promise<string> {
  const { data, error } = await db.rpc('create_or_get_conversation', {
    other_user_id: otherUserId,
  });
  if (error) throw error;
  return data as string;
}

/**
 * Fetches all conversations for the current authenticated user.
 * RLS ensures only conversations where the user is a participant are returned.
 * Joins profiles to resolve participant names and details.
 * Ordered by most recent message first.
 */
export interface ProfileInfo {
  id: string;
  full_name: string;
  email: string;
  role: { name: string } | null;
  position: { title: string } | null;
  department: { name: string } | null;
}

export interface ConversationWithProfiles extends Conversation {
  user_a_profile: ProfileInfo | null;
  user_b_profile: ProfileInfo | null;
}

/**
 * Fetches conversations for the current user, ordered by most recent activity.
 * Supports cursor-based pagination via `beforeLastMessageAt` or `beforeCreatedAt`
 * (for conversations with no messages yet).
 */
export async function fetchMyConversations(
  limit = 20,
  beforeLastMessageAt?: string,
  beforeCreatedAt?: string
): Promise<ConversationWithProfiles[]> {
  let query = db
    .from('conversations')
    .select(`
      *,
      user_a_profile:profiles!conversations_user_a_id_fkey(
        id,
        full_name,
        email,
        role:roles(name),
        position:positions(title),
        department:departments(name)
      ),
      user_b_profile:profiles!conversations_user_b_id_fkey(
        id,
        full_name,
        email,
        role:roles(name),
        position:positions(title),
        department:departments(name)
      )
    `)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (beforeLastMessageAt) {
    query = query.lt('last_message_at', beforeLastMessageAt);
  } else if (beforeCreatedAt) {
    query = query.is('last_message_at', null).lt('created_at', beforeCreatedAt);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ConversationWithProfiles[];
}

// ─── Message helpers ──────────────────────────────────────────────────────────

/**
 * Fetches messages for a specific conversation.
 * RLS ensures the user can only read messages from their own conversations.
 * Returns messages in chronological order (oldest first) for display.
 * Supports cursor-based pagination via `before` timestamp.
 *
 * Uses DESC ordering + reverse to always fetch the LATEST page first,
 * ensuring the initial load shows the newest messages.
 */
export async function fetchConversationMessages(
  conversationId: string,
  limit = 40,
  before?: string
): Promise<Message[]> {
  let query = db
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) {
    query = query.lt('created_at', before);
  }

  const { data, error } = await query;
  if (error) throw error;
  // Reverse to chronological order (oldest → newest) for display
  return ((data ?? []) as Message[]).reverse();
}

/**
 * Sends a new message to a conversation.
 * RLS INSERT policy enforces:
 *   - sender_id must equal auth.uid()
 *   - user must be a participant in the conversation
 * Client-side validation: max 2000 characters.
 * 
 * Note: Content can be empty if hasAttachments is true (attachment-only messages).
 * The database constraint allows empty content when attachment_count > 0.
 * 
 * @param conversationId - The conversation to send the message to
 * @param senderId - The sender's user ID
 * @param content - The message text content
 * @param hasAttachments - If true, allows empty content (for attachment-only messages)
 * @param expectedAttachmentCount - Pending uploads; satisfies DB check until attachments are saved
 * @returns The created message
 */
export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
  hasAttachments: boolean = false,
  expectedAttachmentCount: number = 0
): Promise<Message> {
  const trimmed = content.trim();
  
  // Validate: must have content OR attachments
  if (!trimmed && !hasAttachments) {
    throw new Error('Message content cannot be empty');
  }

  if (hasAttachments && expectedAttachmentCount < 1) {
    throw new Error('Attachment count is required for attachment-only messages');
  }
  
  if (trimmed.length > 2000) {
    throw new Error('Message exceeds maximum length');
  }

  const insertRow: Record<string, unknown> = {
    conversation_id: conversationId,
    sender_id: senderId,
    content: trimmed || '',
  };

  // DB constraint requires attachment_count > 0 OR non-empty content at insert time.
  // Attachments are uploaded after the row exists; set count from pending files.
  if (hasAttachments && expectedAttachmentCount > 0) {
    insertRow.attachment_count = expectedAttachmentCount;
  }

  const { data, error } = await db
    .from('messages')
    .insert(insertRow)
    .select()
    .single();

  if (error) throw error;
  return data as Message;
}

/**
 * Soft-deletes a message created by the sender (e.g. rollback failed attachment upload).
 * Hard DELETE is not allowed by RLS; updates is_deleted instead.
 */
export async function rollbackUnsentMessage(
  messageId: string,
  senderId: string
): Promise<void> {
  const { error } = await db
    .from('messages')
    .update({
      is_deleted: true,
      content: 'Message deleted',
      updated_at: new Date().toISOString(),
    })
    .eq('id', messageId)
    .eq('sender_id', senderId);
  if (error) throw error;
}

/**
 * Edits an existing message's content.
 * RLS UPDATE policy ensures only the sender can edit their own messages.
 * Sets `edited_at` timestamp to track edit history.
 */
export async function editMessage(messageId: string, newContent: string): Promise<void> {
  const { error } = await db
    .from('messages')
    .update({
      content: newContent.trim(),
      edited_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', messageId);
  if (error) throw error;
}

/**
 * Soft-deletes a message by setting `is_deleted = true`.
 * RLS UPDATE policy ensures only the sender can delete their own messages.
 * Content is cleared to prevent data leakage; trigger updates conversation preview.
 */
export async function deleteMessage(messageId: string): Promise<void> {
  const { error } = await db
    .from('messages')
    .update({
      is_deleted: true,
      content: 'Message deleted',
      updated_at: new Date().toISOString(),
    })
    .eq('id', messageId);
  if (error) throw error;
}

// ─── Read receipts & unread count ─────────────────────────────────────────────

/**
 * Marks all unread messages in a conversation as read (for the current user).
 * Uses a SECURITY DEFINER RPC that restricts the operation to ONLY setting read_at.
 * The RPC validates the caller is a participant and only updates received messages.
 */
export async function markMessagesAsRead(
  conversationId: string,
  _currentUserId: string
): Promise<void> {
  const { error } = await db.rpc('mark_messages_as_read', {
    p_conversation_id: conversationId,
  });
  if (error) {
    console.error('Failed to mark messages as read:', error);
    throw error;
  }
}

/**
 * Returns conversation IDs that have at least one unread message for the user.
 * RLS ensures only the user's conversations are included.
 */
export async function getUnreadConversationIds(currentUserId: string): Promise<string[]> {
  const { data, error } = await db
    .from('messages')
    .select('conversation_id')
    .neq('sender_id', currentUserId)
    .is('read_at', null)
    .eq('is_deleted', false);
  if (error) throw error;

  const ids = new Set<string>();
  for (const row of data ?? []) {
    if (row.conversation_id) ids.add(row.conversation_id as string);
  }
  return Array.from(ids);
}

/**
 * Gets the total count of unread messages across all conversations for the user.
 * RLS SELECT policy ensures only messages in the user's conversations are counted.
 * Only counts messages NOT sent by the user themselves.
 */
export async function getUnreadMessageCount(currentUserId: string): Promise<number> {
  const { count, error } = await db
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .neq('sender_id', currentUserId)
    .is('read_at', null)
    .eq('is_deleted', false);
  if (error) throw error;
  return count ?? 0;
}
