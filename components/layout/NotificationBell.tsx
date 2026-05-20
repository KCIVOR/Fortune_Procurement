'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  fetchMyNotifications,
  fetchUnreadNotificationCount,
  markNotificationRead,
} from '@/lib/notifications';
import type { Notification } from '@/types/database';

const TYPE_DOT: Record<string, string> = {
  action_required: 'bg-pq-warning-1000',
  approved:        'bg-pq-success-1000',
  rejected:        'bg-pq-danger-1000',
  info:            'bg-blue-400',
};

export default function NotificationBell() {
  const { profile } = useAuth();
  const router = useRouter();

  const [open, setOpen]                     = useState(false);
  const [notifications, setNotifications]   = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount]       = useState(0);
  const [loading, setLoading]               = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch unread count on mount
  useEffect(() => {
    if (!profile) return;
    fetchUnreadNotificationCount(profile.id)
      .then(setUnreadCount)
      .catch(() => {});
  }, [profile]);

  // Polling interval: refresh unread count every 30 seconds
  useEffect(() => {
    if (!profile) return;

    const interval = setInterval(() => {
      fetchUnreadNotificationCount(profile.id)
        .then(setUnreadCount)
        .catch(() => {});
    }, 30_000);

    return () => clearInterval(interval);
  }, [profile]);

  // Realtime subscription: instant update when new notification arrives
  useEffect(() => {
    if (!profile) return;

    const channel = supabase
      .channel(`notifications:${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          // New notification inserted — refresh count
          fetchUnreadNotificationCount(profile.id)
            .then(setUnreadCount)
            .catch(() => {});
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          // Notification updated (e.g., marked read) — refresh count
          fetchUnreadNotificationCount(profile.id)
            .then(setUnreadCount)
            .catch(() => {});
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  // Close dropdown on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const [notifs, count] = await Promise.all([
        fetchMyNotifications(profile.id, 10),
        fetchUnreadNotificationCount(profile.id),
      ]);
      setNotifications(notifs);
      setUnreadCount(count);
    } catch {
      // best-effort
    } finally {
      setLoading(false);
    }
  }, [profile]);

  const handleBellClick = () => {
    const next = !open;
    setOpen(next);
    if (next) loadNotifications();
  };

  const handleNotificationClick = async (notif: Notification) => {
    setOpen(false);

    if (!notif.read) {
      try {
        await markNotificationRead(notif.id);
        setNotifications(prev =>
          prev.map(n => (n.id === notif.id ? { ...n, read: true } : n))
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch {
        // best-effort
      }
    }

    if (notif.action_url) {
      router.push(notif.action_url);
    }
  };

  if (!profile) return null;

  return (
    <div ref={containerRef} className="relative">
      {/* Bell trigger */}
      <button
        type="button"
        onClick={handleBellClick}
        aria-label="Notifications"
        className="relative flex items-center justify-center w-8 h-8 rounded-md text-pq-neutral-500 hover:text-pq-neutral-900 hover:bg-pq-neutral-50 transition"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-pq-danger-1000 text-white text-[10px] font-bold leading-none px-1 pointer-events-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-pq-neutral-200 rounded-md shadow-lg z-50 overflow-hidden">
          {/* Panel header */}
          <div className="px-4 py-2.5 border-b border-pq-neutral-200 flex items-center justify-between bg-pq-neutral-50">
            <span className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
              Notifications
            </span>
            {unreadCount > 0 && (
              <span className="text-[10px] font-semibold text-pq-primary-600 bg-pq-primary-50 border border-pq-primary-200 rounded-full px-2 py-0.5">
                {unreadCount} unread
              </span>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-[400px] overflow-y-auto divide-y divide-[#F7F9FC]">
            {loading ? (
              <div className="px-4 py-8 text-center text-xs text-pq-neutral-400">
                Loading…
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-10 flex flex-col items-center gap-2">
                <Bell className="w-7 h-7 text-pq-neutral-200" />
                <p className="text-sm text-pq-neutral-400">No notifications</p>
              </div>
            ) : (
              notifications.map(notif => (
                <button
                  key={notif.id}
                  type="button"
                  onClick={() => handleNotificationClick(notif)}
                  className={`w-full text-left px-4 py-3 hover:bg-pq-neutral-50 transition ${
                    !notif.read ? 'bg-pq-primary-50/60' : 'bg-white'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Type-coloured dot */}
                    <span
                      className={`mt-[5px] w-1.5 h-1.5 rounded-full shrink-0 ${
                        !notif.read
                          ? (TYPE_DOT[notif.type] ?? 'bg-pq-neutral-400')
                          : 'bg-pq-neutral-200'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold truncate ${
                        !notif.read ? 'text-pq-neutral-900' : 'text-pq-neutral-500'
                      }`}>
                        {notif.title}
                      </p>
                      <p className="text-xs text-pq-neutral-500 mt-0.5 line-clamp-2 leading-relaxed">
                        {notif.body}
                      </p>
                      <p className="text-[10px] text-pq-neutral-400 mt-1">
                        {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
