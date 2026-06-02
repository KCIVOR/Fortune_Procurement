'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { getUnreadMessageCount } from '@/lib/messages';

/**
 * Header icon for messaging with unread badge.
 * Follows the same pattern as NotificationBell.
 * Navigates to /messages on click.
 */
export default function MessageIcon() {
  const { profile } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  // Unique instance ID to prevent channel collisions
  const instanceIdRef = useRef<string>(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  // Fetch unread count on mount
  useEffect(() => {
    if (!profile) return;
    getUnreadMessageCount(profile.id)
      .then(setUnreadCount)
      .catch(() => {});
  }, [profile]);

  // Periodic refresh of unread count (every 30s) as a fallback
  useEffect(() => {
    if (!profile) return;

    const interval = setInterval(() => {
      getUnreadMessageCount(profile.id)
        .then(setUnreadCount)
        .catch(() => {});
    }, 30_000);

    return () => clearInterval(interval);
  }, [profile]);

  // Realtime subscription for immediate updates when messages change
  useEffect(() => {
    if (!profile) return;

    const channel = supabase
      .channel(`message-icon:${profile.id}:${instanceIdRef.current}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          // When messages are updated (e.g., read_at set), refetch count
          getUnreadMessageCount(profile.id)
            .then(setUnreadCount)
            .catch(() => {});
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          // When new messages arrive, refetch count
          const record = payload.new as any;
          // Only refetch if message is NOT from current user
          if (record && record.sender_id !== profile.id) {
            getUnreadMessageCount(profile.id)
              .then(setUnreadCount)
              .catch(() => {});
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [profile]);

  if (!profile) return null;

  return (
    <Link
      href="/messages"
      className="relative flex items-center justify-center w-8 h-8 rounded-md text-pq-neutral-500 hover:text-pq-primary-600 hover:bg-pq-neutral-50 transition"
      aria-label="Messages"
      title="Messages"
    >
      <MessageSquare className="w-4 h-4" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-pq-danger-600 text-white text-[10px] font-bold leading-none px-1 pointer-events-none">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  );
}
