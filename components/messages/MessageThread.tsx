'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, ChevronUp, Loader2, Building2, Briefcase, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchConversationMessages, markMessagesAsRead, type ProfileInfo } from '@/lib/messages';
import type { Message, MessageAttachment } from '@/types/database';
import type { UserProfile } from '@/types/auth';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import { cn } from '@/lib/utils';

/** Number of messages to fetch per page */
const PAGE_SIZE = 40;

interface MessageThreadProps {
  conversationId: string;
  currentUserId: string;
  profile: UserProfile;
  otherUserProfile?: ProfileInfo | null;
  onMessageSent?: () => void;
  className?: string;
}

export default function MessageThread({
  conversationId,
  currentUserId,
  profile,
  otherUserProfile,
  onMessageSent,
  className,
}: MessageThreadProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Track known message IDs to prevent duplicates from realtime + optimistic updates
  const knownIdsRef = useRef<Set<string>>(new Set());

  // Unique channel ID per component instance to avoid binding mismatch
  // when multiple instances mount (e.g., responsive layouts)
  const instanceIdRef = useRef<string>(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  useEffect(() => {
    loadMessages();
  }, [conversationId]);

  // ─── Realtime subscription for this conversation's messages ────────────────
  useEffect(() => {
    if (!conversationId) return;

    // Single postgres_changes binding with client-side filtering
    // Channel name includes unique instance ID to prevent collisions
    const channel = supabase
      .channel(`messages:${conversationId}:${instanceIdRef.current}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const record = payload.new as Message;

          // Client-side filter: only process messages for this conversation
          if (!record || record.conversation_id !== conversationId) {
            return;
          }

          // Handle INSERT events
          if (payload.eventType === 'INSERT') {
            // Deduplicate: skip if we already have this message (optimistic insert)
            if (knownIdsRef.current.has(record.id)) {
              return;
            }

            knownIdsRef.current.add(record.id);
            setMessages((prev) => [...prev, record]);

            // Auto-mark as read if from the other user
            if (record.sender_id !== currentUserId) {
              markMessagesAsRead(conversationId, currentUserId).catch(() => {});
            }
          }

          // Handle UPDATE events (including attachment_count updates)
          if (payload.eventType === 'UPDATE') {
            setMessages((prev) =>
              prev.map((m) => (m.id === record.id ? record : m))
            );
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId]);

  /** Load the latest page of messages (initial load) */
  async function loadMessages() {
    setLoading(true);
    setError(null);
    setHasMore(true);
    try {
      const data = await fetchConversationMessages(conversationId, PAGE_SIZE);
      setMessages(data);

      // If we got fewer than PAGE_SIZE, there are no older messages
      setHasMore(data.length >= PAGE_SIZE);

      // Rebuild known IDs set from fetched data
      knownIdsRef.current = new Set(data.map((m) => m.id));

      // Mark messages as read
      await markMessagesAsRead(conversationId, currentUserId).catch(() => {});
    } catch (err) {
      console.error('Failed to load messages:', err);
      setError('Failed to load messages.');
    } finally {
      setLoading(false);
    }
  }

  /** Load older messages (pagination) */
  const loadOlderMessages = useCallback(async () => {
    if (loadingOlder || !hasMore || messages.length === 0) return;

    setLoadingOlder(true);
    try {
      // Get the oldest message's timestamp as cursor
      const oldestMessage = messages[0];
      const olderData = await fetchConversationMessages(
        conversationId,
        PAGE_SIZE,
        oldestMessage.created_at ?? undefined
      );

      if (olderData.length === 0) {
        setHasMore(false);
        return;
      }

      // If we got fewer than PAGE_SIZE, no more older messages
      if (olderData.length < PAGE_SIZE) {
        setHasMore(false);
      }

      // Prepend older messages and update known IDs
      const newIds = olderData.map((m) => m.id);
      newIds.forEach((id) => knownIdsRef.current.add(id));
      setMessages((prev) => [...olderData, ...prev]);
    } catch (err) {
      console.error('Failed to load older messages:', err);
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, loadingOlder, hasMore, messages]);

  const handleMessageSent = useCallback(
    (newMessage: Message) => {
      // Add to known IDs immediately to prevent realtime duplicate
      knownIdsRef.current.add(newMessage.id);
      setMessages((prev) => [...prev, newMessage]);
      onMessageSent?.();
    },
    [onMessageSent]
  );

  function handleMessageEdited(messageId: string, newContent: string) {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, content: newContent, edited_at: new Date().toISOString() }
          : m
      )
    );
  }

  function handleMessageDeleted(messageId: string) {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, is_deleted: true, content: 'Message deleted' }
          : m
      )
    );
  }

  if (loading) {
    return (
      <div className={cn('flex flex-col h-full', className)}>
        <div className="flex-1 flex items-center justify-center">
          <LoadingState message="Loading messages..." size="sm" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('flex flex-col h-full', className)}>
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <p className="text-sm text-pq-danger-600 text-center">{error}</p>
          <button
            onClick={loadMessages}
            className="mt-3 text-xs font-semibold text-pq-primary-600 hover:text-pq-primary-700 transition"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* User header */}
      {otherUserProfile && (
        <div className="shrink-0 px-4 py-3 border-b border-pq-neutral-200 bg-pq-neutral-50">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-pq-primary-600 flex items-center justify-center shrink-0">
              <span className="text-sm font-semibold text-white">
                {otherUserProfile.full_name?.charAt(0).toUpperCase() || '?'}
              </span>
            </div>
            {/* User info */}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-pq-neutral-900 truncate">
                {otherUserProfile.full_name}
              </h3>
              <div className="flex items-center gap-3 text-xs text-pq-neutral-500 mt-0.5">
                {otherUserProfile.position?.title && (
                  <span className="flex items-center gap-1 truncate">
                    <Briefcase className="w-3 h-3 shrink-0" />
                    {otherUserProfile.position.title}
                  </span>
                )}
                {otherUserProfile.department?.name && (
                  <span className="flex items-center gap-1 truncate">
                    <Building2 className="w-3 h-3 shrink-0" />
                    {otherUserProfile.department.name}
                  </span>
                )}
                {otherUserProfile.role?.name && !otherUserProfile.position?.title && (
                  <span className="flex items-center gap-1 truncate">
                    <User className="w-3 h-3 shrink-0" />
                    {otherUserProfile.role.name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Messages area - column-reverse anchors content to bottom like Messenger */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 flex flex-col-reverse"
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center flex-1">
            <EmptyState
              icon={MessageSquare}
              title="No messages yet"
              description="Send the first message to start the conversation."
            />
          </div>
        ) : (
          <div className="space-y-0.5">
            {/* Load older messages button */}
            {hasMore && (
              <div className="flex justify-center py-3">
                <button
                  onClick={loadOlderMessages}
                  disabled={loadingOlder}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-pq-neutral-600 hover:text-pq-primary-600 bg-pq-neutral-50 hover:bg-pq-primary-50 border border-pq-neutral-200 rounded-md transition disabled:opacity-50"
                >
                  {loadingOlder ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <ChevronUp className="w-3 h-3" />
                      Load older messages
                    </>
                  )}
                </button>
              </div>
            )}

            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isOwn={message.sender_id === currentUserId}
                onEdit={handleMessageEdited}
                onDelete={handleMessageDeleted}
              />
            ))}
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-pq-neutral-200 bg-white px-4 py-2.5">
        <MessageInput
          conversationId={conversationId}
          senderId={currentUserId}
          profile={profile}
          onMessageSent={handleMessageSent}
        />
      </div>
    </div>
  );
}
