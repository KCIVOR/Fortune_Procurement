'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, Loader2, MessageSquare } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  fetchMyConversations,
  getUnreadConversationIds,
  type ConversationWithProfiles,
} from '@/lib/messages';
import ConversationItem from './ConversationItem';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import { cn } from '@/lib/utils';

interface ConversationListProps {
  currentUserId: string;
  selectedConversationId?: string | null;
  onSelectConversation: (conversation: ConversationWithProfiles) => void;
  className?: string;
}

export default function ConversationList({
  currentUserId,
  selectedConversationId,
  onSelectConversation,
  className,
}: ConversationListProps) {
  const [conversations, setConversations] = useState<ConversationWithProfiles[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadConversationIds, setUnreadConversationIds] = useState<Set<string>>(new Set());

  const PAGE_SIZE = 20;

  // Debounce refetch to prevent rapid-fire updates from multiple realtime events
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unreadRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Unique channel ID per component instance to avoid binding mismatch
  // when multiple instances mount (e.g., responsive layouts)
  const instanceIdRef = useRef<string>(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  useEffect(() => {
    loadConversations();
  }, []);

  const refreshUnreadIds = useCallback(async () => {
    try {
      const ids = await getUnreadConversationIds(currentUserId);
      setUnreadConversationIds(new Set(ids));
    } catch (err) {
      console.error('Failed to refresh unread conversations:', err);
    }
  }, [currentUserId]);

  const debouncedRefreshUnreadIds = useCallback(() => {
    if (unreadRefreshTimerRef.current) {
      clearTimeout(unreadRefreshTimerRef.current);
    }
    unreadRefreshTimerRef.current = setTimeout(() => {
      refreshUnreadIds();
    }, 300);
  }, [refreshUnreadIds]);

  // Clear unread highlight for the open conversation (read happens in MessageThread)
  useEffect(() => {
    if (!selectedConversationId) return;
    setUnreadConversationIds((prev) => {
      if (!prev.has(selectedConversationId)) return prev;
      const next = new Set(prev);
      next.delete(selectedConversationId);
      return next;
    });
  }, [selectedConversationId]);

  /**
   * Debounced refetch: coalesces rapid realtime events (e.g., multiple messages
   * in quick succession) into a single refetch after 500ms of quiet.
   */
  const debouncedRefetch = useCallback(() => {
    if (refetchTimerRef.current) {
      clearTimeout(refetchTimerRef.current);
    }
    refetchTimerRef.current = setTimeout(() => {
      refetchConversations();
    }, 500);
  }, []);

  // ─── Realtime subscription for conversation updates ────────────────────────
  useEffect(() => {
    if (!currentUserId) return;

    // Single postgres_changes binding with client-side filtering
    // Channel name includes unique instance ID to prevent collisions
    const channel = supabase
      .channel(`conversations:${currentUserId}:${instanceIdRef.current}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        (payload) => {
          // Client-side filter: only process if current user is a participant
          const record = payload.new as any;
          if (record && (record.user_a_id === currentUserId || record.user_b_id === currentUserId)) {
            debouncedRefetch();
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
      if (refetchTimerRef.current) {
        clearTimeout(refetchTimerRef.current);
      }
    };
  }, [currentUserId, debouncedRefetch]);

  // Realtime: keep unread indicators in sync when messages arrive or are read
  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(`conversation-unread:${currentUserId}:${instanceIdRef.current}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const record = payload.new as { sender_id?: string; conversation_id?: string };
          if (
            record?.conversation_id &&
            record.sender_id &&
            record.sender_id !== currentUserId
          ) {
            setUnreadConversationIds((prev) => {
              const next = new Set(prev);
              next.add(record.conversation_id!);
              return next;
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        () => {
          debouncedRefreshUnreadIds();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
      if (unreadRefreshTimerRef.current) {
        clearTimeout(unreadRefreshTimerRef.current);
      }
    };
  }, [currentUserId, debouncedRefreshUnreadIds]);

  /** Silent refetch — resets to the first page without showing the main spinner. */
  async function refetchConversations() {
    try {
      const data = await fetchMyConversations(PAGE_SIZE);
      setConversations(data);
      setHasMore(data.length >= PAGE_SIZE);
    } catch (err) {
      // Silent failure on background refetch — don't disrupt UI
      console.error('Background conversation refetch failed:', err);
    }
  }

  async function loadConversations() {
    setLoading(true);
    setError(null);
    setHasMore(true);
    try {
      const [data, unreadIds] = await Promise.all([
        fetchMyConversations(PAGE_SIZE),
        getUnreadConversationIds(currentUserId),
      ]);
      setConversations(data);
      setHasMore(data.length >= PAGE_SIZE);
      setUnreadConversationIds(new Set(unreadIds));
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setError('Failed to load conversations.');
    } finally {
      setLoading(false);
    }
  }

  const loadOlderConversations = useCallback(async () => {
    if (loadingOlder || !hasMore || conversations.length === 0) return;

    setLoadingOlder(true);
    try {
      const oldest = conversations[conversations.length - 1];
      const olderData = await fetchMyConversations(
        PAGE_SIZE,
        oldest.last_message_at ?? undefined,
        oldest.last_message_at ? undefined : oldest.created_at ?? undefined
      );

      if (olderData.length === 0) {
        setHasMore(false);
        return;
      }

      if (olderData.length < PAGE_SIZE) {
        setHasMore(false);
      }

      setConversations((prev) => [...prev, ...olderData]);
    } catch (err) {
      console.error('Failed to load older conversations:', err);
    } finally {
      setLoadingOlder(false);
    }
  }, [loadingOlder, hasMore, conversations, PAGE_SIZE]);

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center py-16', className)}>
        <LoadingState message="Loading conversations..." size="sm" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-16 px-4', className)}>
        <p className="text-sm text-pq-danger-600 text-center">{error}</p>
        <button
          onClick={loadConversations}
          className="mt-3 text-xs font-semibold text-pq-primary-600 hover:text-pq-primary-700 transition"
        >
          Try again
        </button>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className={className}>
        <EmptyState
          icon={MessageSquare}
          title="No conversations"
          description="Start a new conversation by searching for a user."
        />
      </div>
    );
  }

  return (
    <div className={cn('divide-y divide-pq-neutral-100', className)}>
      {conversations.map((conversation) => {
        // Resolve the other participant's name from joined profiles
        const otherUserName =
          conversation.user_a_id === currentUserId
            ? conversation.user_b_profile?.full_name
            : conversation.user_a_profile?.full_name;

        const isSelected = selectedConversationId === conversation.id;
        const hasUnread =
          unreadConversationIds.has(conversation.id) && !isSelected;

        return (
          <ConversationItem
            key={conversation.id}
            conversation={conversation}
            currentUserId={currentUserId}
            isSelected={isSelected}
            hasUnread={hasUnread}
            onClick={() => onSelectConversation(conversation)}
            otherUserName={otherUserName || undefined}
          />
        );
      })}

      {hasMore && (
        <div className="flex justify-center py-3 border-t border-pq-neutral-100">
          <button
            type="button"
            onClick={loadOlderConversations}
            disabled={loadingOlder}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-pq-neutral-600 hover:text-pq-primary-600 bg-pq-neutral-50 hover:bg-pq-primary-50 border border-pq-neutral-200 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
            title="Load older conversations"
          >
            {loadingOlder ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" />
                Load older conversations
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
