'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, ChevronDown, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  fetchMyNotifications,
  fetchUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/lib/notifications';
import type { Notification } from '@/types/database';
import CountBadge from '@/components/ui/CountBadge';

const TYPE_DOT: Record<string, string> = {
  action_required: 'bg-pq-warning-1000',
  approved:        'bg-pq-success-1000',
  rejected:        'bg-pq-danger-1000',
  info:            'bg-blue-400',
};

export default function NotificationBell() {
  console.log('🚨 [DEBUG] NotificationBell component is being rendered!');
  const { profile } = useAuth();
  const router = useRouter();

  const [open, setOpen]                     = useState(false);
  const [notifications, setNotifications]   = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount]       = useState(0);
  const [loading, setLoading]               = useState(false);
  const [loadingOlder, setLoadingOlder]     = useState(false);
  const [hasMore, setHasMore]               = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);

  // Number of notifications to fetch per page
  const PAGE_SIZE = 20;

  // Debug: Component mount
  useEffect(() => {
    console.log('🚀 [NotificationBell] Component mounted');
    console.log('👤 [NotificationBell] User ID:', profile?.id);
    console.log('🔢 [NotificationBell] Initial unread count:', unreadCount);
  }, []);

  // Debug: Track unread count changes
  useEffect(() => {
    console.log('🔄 [NotificationBell] Unread count changed to:', unreadCount);
  }, [unreadCount]);

  // Fetch unread count on mount
  useEffect(() => {
    if (!profile) return;
    console.log('📥 [NotificationBell] Fetching initial unread count for user:', profile.id);
    fetchUnreadNotificationCount(profile.id)
      .then(count => {
        console.log('✅ [NotificationBell] Initial count fetched:', count);
        setUnreadCount(count);
      })
      .catch(err => {
        console.error('❌ [NotificationBell] Error fetching initial count:', err);
      });
  }, [profile]);

  // Polling interval: refresh unread count every 30 seconds
  useEffect(() => {
    if (!profile) return;
    console.log('⏰ [NotificationBell] Starting polling interval (30s) for user:', profile.id);

    const interval = setInterval(() => {
      console.log('⏰ [NotificationBell] Polling: Fetching unread count...');
      fetchUnreadNotificationCount(profile.id)
        .then(count => {
          console.log('✅ [NotificationBell] Polling: Count fetched:', count);
          setUnreadCount(count);
        })
        .catch(err => {
          console.error('❌ [NotificationBell] Polling: Error:', err);
        });
    }, 30_000);

    return () => {
      console.log('🛑 [NotificationBell] Stopping polling interval');
      clearInterval(interval);
    };
  }, [profile]);

  // Realtime subscription: instant update when new notification arrives
  useEffect(() => {
    if (!profile) return;

    console.log('📡 [NotificationBell] Setting up realtime subscription for user:', profile.id);
    console.log('📡 [NotificationBell] Channel name:', `notifications:${profile.id}`);

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
        (payload) => {
          console.log('🔔 [NotificationBell] REALTIME INSERT EVENT RECEIVED!');
          console.log('🔔 [NotificationBell] Payload:', payload);
          console.log('📊 [NotificationBell] Current count before refresh:', unreadCount);
          
          // New notification inserted — refresh count
          fetchUnreadNotificationCount(profile.id)
            .then(count => {
              console.log('✅ [NotificationBell] Count after INSERT:', count);
              setUnreadCount(count);
            })
            .catch(err => {
              console.error('❌ [NotificationBell] Error fetching count after INSERT:', err);
            });
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
        (payload) => {
          console.log('🔄 [NotificationBell] REALTIME UPDATE EVENT RECEIVED!');
          console.log('🔄 [NotificationBell] Payload:', payload);
          console.log('📊 [NotificationBell] Current count before refresh:', unreadCount);
          
          // Notification updated (e.g., marked read) — refresh count
          fetchUnreadNotificationCount(profile.id)
            .then(count => {
              console.log('✅ [NotificationBell] Count after UPDATE:', count);
              setUnreadCount(count);
            })
            .catch(err => {
              console.error('❌ [NotificationBell] Error fetching count after UPDATE:', err);
            });
        }
      )
      .subscribe((status, err) => {
        if (err) {
          console.error('❌ [NotificationBell] Subscription ERROR:', err);
        }
        console.log('📡 [NotificationBell] Subscription status:', status);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ [NotificationBell] Successfully SUBSCRIBED to realtime!');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ [NotificationBell] Channel error - Realtime may not be working');
        } else if (status === 'TIMED_OUT') {
          console.error('❌ [NotificationBell] Subscription timed out');
        } else if (status === 'CLOSED') {
          console.log('🔌 [NotificationBell] Subscription closed');
        }
      });

    return () => {
      console.log('🛑 [NotificationBell] Cleaning up realtime subscription');
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
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    
    if (open) {
      document.addEventListener('mousedown', handle);
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when dropdown is open on mobile
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  const loadNotifications = useCallback(async () => {
    if (!profile) return;
    console.log('📥 [NotificationBell] Loading notifications for dropdown...');
    setLoading(true);
    setHasMore(true);
    try {
      const [notifs, count] = await Promise.all([
        fetchMyNotifications(profile.id, PAGE_SIZE),
        fetchUnreadNotificationCount(profile.id),
      ]);
      console.log('✅ [NotificationBell] Loaded notifications:', notifs.length);
      console.log('✅ [NotificationBell] Refreshed count:', count);
      setNotifications(notifs);
      setUnreadCount(count);
      
      // If we got fewer than PAGE_SIZE, there are no more notifications
      setHasMore(notifs.length >= PAGE_SIZE);
    } catch (err) {
      console.error('❌ [NotificationBell] Error loading notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [profile, PAGE_SIZE]);

  const loadOlderNotifications = useCallback(async () => {
    if (!profile || loadingOlder || !hasMore || notifications.length === 0) return;
    
    console.log('📥 [NotificationBell] Loading older notifications...');
    setLoadingOlder(true);
    try {
      // Get the oldest notification's timestamp as cursor
      const oldestNotification = notifications[notifications.length - 1];
      const olderNotifs = await fetchMyNotifications(
        profile.id,
        PAGE_SIZE,
        oldestNotification.created_at
      );
      
      console.log('✅ [NotificationBell] Loaded older notifications:', olderNotifs.length);
      
      if (olderNotifs.length === 0) {
        setHasMore(false);
        return;
      }
      
      // If we got fewer than PAGE_SIZE, no more older notifications
      if (olderNotifs.length < PAGE_SIZE) {
        setHasMore(false);
      }
      
      // Append older notifications to the list
      setNotifications(prev => [...prev, ...olderNotifs]);
    } catch (err) {
      console.error('❌ [NotificationBell] Error loading older notifications:', err);
    } finally {
      setLoadingOlder(false);
    }
  }, [profile, loadingOlder, hasMore, notifications, PAGE_SIZE]);

  const handleBellClick = () => {
    const next = !open;
    setOpen(next);
    if (next) loadNotifications();
  };

  const handleNotificationClick = async (notif: Notification) => {
    console.log('👆 [NotificationBell] Notification clicked:', notif.id);
    setOpen(false);

    if (!notif.read) {
      console.log('📖 [NotificationBell] Marking notification as read:', notif.id);
      try {
        await markNotificationRead(notif.id);
        console.log('✅ [NotificationBell] Marked as read');
        setNotifications(prev =>
          prev.map(n => (n.id === notif.id ? { ...n, read: true } : n))
        );
        setUnreadCount(prev => {
          const newCount = Math.max(0, prev - 1);
          console.log('📊 [NotificationBell] Decremented count:', prev, '→', newCount);
          return newCount;
        });
      } catch (err) {
        console.error('❌ [NotificationBell] Error marking as read:', err);
      }
    }

    if (notif.action_url) {
      console.log('🔗 [NotificationBell] Navigating to:', notif.action_url);
      router.push(notif.action_url);
    }
  };

  const handleMarkAsRead = async (notif: Notification, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent notification click
    console.log('📖 [NotificationBell] Mark as read button clicked:', notif.id);
    
    if (notif.read) return; // Already read

    try {
      await markNotificationRead(notif.id);
      console.log('✅ [NotificationBell] Marked as read');
      setNotifications(prev =>
        prev.map(n => (n.id === notif.id ? { ...n, read: true } : n))
      );
      setUnreadCount(prev => {
        const newCount = Math.max(0, prev - 1);
        console.log('📊 [NotificationBell] Decremented count:', prev, '→', newCount);
        return newCount;
      });
    } catch (err) {
      console.error('❌ [NotificationBell] Error marking as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!profile || unreadCount === 0) return;
    
    console.log('📖 [NotificationBell] Mark all as read clicked');
    
    try {
      await markAllNotificationsRead(profile.id);
      console.log('✅ [NotificationBell] All marked as read');
      
      // Update local state
      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true }))
      );
      setUnreadCount(0);
      console.log('📊 [NotificationBell] Count reset to 0');
    } catch (err) {
      console.error('❌ [NotificationBell] Error marking all as read:', err);
    }
  };

  if (!profile) return null;

  // Debug: Log when badge should be visible
  if (unreadCount > 0) {
    console.log('🔴 [NotificationBell] Badge SHOULD BE VISIBLE with count:', unreadCount);
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Bell trigger */}
      <button
        type="button"
        onClick={handleBellClick}
        aria-label="Notifications"
        aria-expanded={open}
        className="relative flex items-center justify-center w-10 h-10 sm:w-8 sm:h-8 rounded-md text-pq-neutral-500 hover:text-pq-neutral-900 hover:bg-pq-neutral-50 active:bg-pq-neutral-100 transition-colors"
      >
        <Bell className="w-4 h-4" />
        <CountBadge count={unreadCount} />
      </button>

      {/* Dropdown panel with backdrop on mobile */}
      {open && (
        <>
          {/* Mobile backdrop */}
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[90] sm:hidden"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          
          {/* Dropdown */}
          <div className="fixed sm:absolute right-2 sm:right-0 top-16 sm:top-full mt-0 sm:mt-2 w-[calc(100vw-1rem)] sm:w-96 max-w-[calc(100vw-1rem)] sm:max-w-md bg-white border border-pq-neutral-200 rounded-lg shadow-2xl z-[100] overflow-hidden">
            {/* Panel header */}
            <div className="px-4 py-3 border-b border-pq-neutral-200 bg-pq-neutral-50 sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                  Notifications
                </span>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <>
                      <span className="text-[10px] font-semibold text-pq-primary-600 bg-pq-primary-50 border border-pq-primary-200 rounded-full px-2 py-0.5">
                        {unreadCount} unread
                      </span>
                      <button
                        type="button"
                        onClick={handleMarkAllAsRead}
                        className="text-[10px] font-semibold text-pq-primary-600 hover:text-pq-primary-700 hover:bg-pq-primary-50 border border-pq-primary-200 hover:border-pq-primary-300 rounded-full px-2 py-0.5 transition-colors"
                        title="Mark all as read"
                      >
                        Mark all read
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

          {/* Notification list */}
          <div className="max-h-[calc(100vh-8rem)] sm:max-h-[70vh] md:max-h-[500px] overflow-y-auto divide-y divide-pq-neutral-100">
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
              <>
                {notifications.map(notif => (
                  <div
                    key={notif.id}
                    className={`relative group ${
                      !notif.read ? 'bg-pq-primary-50/60' : 'bg-white'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleNotificationClick(notif)}
                      className={`w-full text-left px-4 py-4 hover:bg-pq-neutral-50 active:bg-pq-neutral-100 transition-colors`}
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
                        <div className="flex-1 min-w-0 pr-8">
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
                    
                    {/* Mark as Read button - only show for unread notifications */}
                    {!notif.read && (
                      <button
                        type="button"
                        onClick={(e) => handleMarkAsRead(notif, e)}
                        className="absolute top-4 right-4 p-1.5 rounded-md text-pq-neutral-400 hover:text-pq-primary-600 hover:bg-pq-primary-50 border border-transparent hover:border-pq-primary-200 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Mark as read"
                        aria-label="Mark as read"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                
                {/* Load older notifications button */}
                {hasMore && (
                  <div className="flex justify-center py-3 border-t border-pq-neutral-100">
                    <button
                      type="button"
                      onClick={loadOlderNotifications}
                      disabled={loadingOlder}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-pq-neutral-600 hover:text-pq-primary-600 bg-pq-neutral-50 hover:bg-pq-primary-50 border border-pq-neutral-200 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Load older notifications"
                    >
                      {loadingOlder ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3 h-3" />
                          Load older notifications
                        </>
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        </>
      )}
    </div>
  );
}
