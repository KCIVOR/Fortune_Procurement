'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getUnreadMessageCount } from '@/lib/messages';

/**
 * Header icon for messaging with unread badge.
 * Follows the same pattern as NotificationBell.
 * Navigates to /messages on click.
 */
export default function MessageIcon() {
  const { profile } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread count on mount
  useEffect(() => {
    if (!profile) return;
    getUnreadMessageCount(profile.id)
      .then(setUnreadCount)
      .catch(() => {});
  }, [profile]);

  // Periodic refresh of unread count (every 30s) as a lightweight supplement
  // until the messaging page is open with full realtime subscriptions
  useEffect(() => {
    if (!profile) return;

    const interval = setInterval(() => {
      getUnreadMessageCount(profile.id)
        .then(setUnreadCount)
        .catch(() => {});
    }, 30_000);

    return () => clearInterval(interval);
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
