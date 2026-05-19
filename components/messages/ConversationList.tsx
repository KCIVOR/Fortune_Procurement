'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchMyConversations, type ConversationWithProfiles } from '@/lib/messages';
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
  const [error, setError] = useState<string | null>(null);

  // Debounce refetch to prevent rapid-fire updates from multiple realtime events
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  /** Silent refetch — does not show loading spinner, just updates data. */
  async function refetchConversations() {
    try {
      const data = await fetchMyConversations();
      setConversations(data);
    } catch (err) {
      // Silent failure on background refetch — don't disrupt UI
      console.error('Background conversation refetch failed:', err);
    }
  }

  async function loadConversations() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMyConversations();
      setConversations(data);
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setError('Failed to load conversations.');
    } finally {
      setLoading(false);
    }
  }

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

        return (
          <ConversationItem
            key={conversation.id}
            conversation={conversation}
            currentUserId={currentUserId}
            isSelected={selectedConversationId === conversation.id}
            onClick={() => onSelectConversation(conversation)}
            otherUserName={otherUserName || undefined}
          />
        );
      })}
    </div>
  );
}
