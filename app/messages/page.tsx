'use client';

import { useState, useCallback, useEffect } from 'react';
import AppShell from '@/components/layout/AppShell';
import { ConversationList, UserSearch } from '@/components/messages';
import { MessageThread } from '@/components/messages';
import { useAuth } from '@/context/AuthContext';
import LoadingState from '@/components/shared/LoadingState';
import type { Profile } from '@/types/database';
import { createOrGetConversation, type ConversationWithProfiles, type ProfileInfo } from '@/lib/messages';
import { MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Hook to detect if viewport is mobile (< 768px)
 * Returns undefined during SSR, then true/false after hydration
 */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

export default function MessagesPage() {
  const { profile, loading } = useAuth();
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithProfiles | null>(null);
  const isMobile = useIsMobile();

  // Get the other user's profile from the selected conversation
  const getOtherUserProfile = useCallback((): ProfileInfo | null => {
    if (!selectedConversation || !profile) return null;
    return selectedConversation.user_a_id === profile.id
      ? selectedConversation.user_b_profile
      : selectedConversation.user_a_profile;
  }, [selectedConversation, profile]);

  const handleSelectConversation = useCallback((conversation: ConversationWithProfiles) => {
    setSelectedConversation(conversation);
  }, []);

  const handleBackToList = useCallback(() => {
    setSelectedConversation(null);
  }, []);

  const handleSelectUserForNewMessage = useCallback(
    async (user: Pick<Profile, 'id' | 'full_name' | 'email'>) => {
      if (!profile) return;

      // Prevent self-messaging
      if (user.id === profile.id) {
        toast.error('You cannot message yourself.');
        return;
      }

      try {
        await createOrGetConversation(user.id);
        toast.success(`Conversation with ${user.full_name} ready.`);
      } catch (err: any) {
        console.error('Failed to create conversation:', err);
        const message = err?.message || 'Failed to start conversation.';
        toast.error(message);
      }
    },
    [profile]
  );

  if (loading || !profile) {
    return (
      <AppShell title="Messages">
        <div className="flex items-center justify-center h-64">
          <LoadingState message="Loading messages..." />
        </div>
      </AppShell>
    );
  }

  // During SSR/hydration, show a loading state to prevent layout shift
  if (isMobile === undefined) {
    return (
      <AppShell title="Messages">
        <div className="fixed inset-0 top-[64px] left-0 lg:left-[240px] right-0 bottom-0 p-6">
          <div className="bg-white rounded-lg border border-pq-neutral-200 shadow-sm overflow-hidden h-full flex flex-col items-center justify-center">
            <LoadingState message="Loading..." size="sm" />
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Messages">
      <div className="fixed inset-0 top-[64px] left-0 lg:left-[240px] right-0 bottom-0 p-6">
        <div className="bg-white rounded-lg border border-pq-neutral-200 shadow-sm overflow-hidden h-full flex flex-col">
        {isMobile ? (
          /* Mobile: single-panel layout - only ONE component instance */
          <div className="h-full">
            {selectedConversation ? (
              <div className="flex flex-col h-full">
                {/* Mobile back header */}
                <div className="px-4 py-3 border-b border-pq-neutral-200 bg-pq-neutral-50 flex items-center gap-3 shrink-0">
                  <button
                    onClick={handleBackToList}
                    className="text-xs font-semibold text-pq-primary-600 hover:text-pq-primary-700 transition"
                  >
                    ← Back
                  </button>
                  <span className="text-sm font-semibold text-pq-neutral-900 truncate">
                    Conversation
                  </span>
                </div>
                <div className="flex-1 min-h-0">
                  <MessageThread
                    conversationId={selectedConversation.id}
                    currentUserId={profile.id}
                    otherUserProfile={getOtherUserProfile()}
                  />
                </div>
              </div>
            ) : (
              <div className="h-full overflow-y-auto">
                <div className="px-4 py-3 border-b border-pq-neutral-100 bg-pq-neutral-50">
                  <UserSearch
                    currentUserId={profile.id}
                    onSelectUser={handleSelectUserForNewMessage}
                  />
                </div>
                <ConversationList
                  currentUserId={profile.id}
                  selectedConversationId={null}
                  onSelectConversation={handleSelectConversation}
                />
              </div>
            )}
          </div>
        ) : (
          /* Desktop: side-by-side layout - only ONE of each component */
          <div className="flex h-full">
            {/* Conversation list panel */}
            <div className="w-80 border-r border-pq-neutral-200 overflow-y-auto shrink-0">
              <div className="px-4 py-3 border-b border-pq-neutral-100 bg-pq-neutral-50">
                <UserSearch
                  currentUserId={profile.id}
                  onSelectUser={handleSelectUserForNewMessage}
                />
              </div>
              <ConversationList
                currentUserId={profile.id}
                selectedConversationId={selectedConversation?.id}
                onSelectConversation={handleSelectConversation}
              />
            </div>

            {/* Message thread panel */}
            <div className="flex-1 min-w-0">
              {selectedConversation ? (
                <MessageThread
                  conversationId={selectedConversation.id}
                  currentUserId={profile.id}
                  otherUserProfile={getOtherUserProfile()}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center px-6">
                  <div className="w-12 h-12 rounded-md bg-pq-neutral-50 border border-pq-neutral-200 flex items-center justify-center mb-3">
                    <MessageSquare className="w-6 h-6 text-pq-neutral-400" />
                  </div>
                  <h3 className="text-base font-semibold text-pq-neutral-900 mb-1">
                    Select a conversation
                  </h3>
                  <p className="text-sm text-pq-neutral-500 max-w-xs">
                    Choose a conversation from the list or start a new one.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      </div>
    </AppShell>
  );
}
