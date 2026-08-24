'use client';

import { useState, useCallback, useEffect } from 'react';
import AppShell, { useSidebarState } from '@/components/layout/AppShell';
import { ConversationList, NewConversationModal } from '@/components/messages';
import { MessageThread } from '@/components/messages';
import { useAuth } from '@/context/AuthContext';
import LoadingState from '@/components/shared/LoadingState';
import { type ConversationWithProfiles, type ProfileInfo } from '@/lib/messages';
import { MessageSquare, SquarePen } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  return (
    <AppShell title="Messages">
      <MessagesContent />
    </AppShell>
  );
}

function MessagesContent() {
  const { profile, loading } = useAuth();
  const { isCollapsed } = useSidebarState();
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithProfiles | null>(null);
  const [isNewConvOpen, setIsNewConvOpen] = useState(false);
  const isMobile = useIsMobile();

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

  const handleConversationReady = useCallback((conversation: ConversationWithProfiles) => {
    setSelectedConversation(conversation);
    setIsNewConvOpen(false);
  }, []);

  if (loading || !profile) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingState message="Loading messages..." />
      </div>
    );
  }

  if (isMobile === undefined) {
    return (
      <div className={cn(
        'fixed inset-0 top-[64px] left-0 right-0 bottom-0 p-6 transition-all duration-200',
        'lg:left-[240px]',
        isCollapsed && 'lg:left-16'
      )}>
        <div className="bg-white rounded-lg border border-pq-neutral-200 shadow-sm overflow-hidden h-full flex flex-col items-center justify-center">
          <LoadingState message="Loading..." size="sm" />
        </div>
      </div>
    );
  }

  // ─── Shared conversation list panel header ─────────────────────────────────
  const ConvPanelHeader = (
    <div className="px-4 py-3 border-b border-pq-neutral-100 bg-pq-neutral-50 flex items-center justify-between shrink-0">
      <span className="text-sm font-semibold text-pq-neutral-700">Messages</span>
      <button
        type="button"
        onClick={() => setIsNewConvOpen(true)}
        className="w-8 h-8 flex items-center justify-center rounded-md text-pq-neutral-500 hover:text-pq-primary-600 hover:bg-pq-primary-50 transition"
        title="New conversation"
        aria-label="New conversation"
      >
        <SquarePen className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <>
      <div className={cn(
        'fixed inset-0 top-[64px] left-0 right-0 bottom-0 p-6 transition-all duration-200',
        'lg:left-[240px]',
        isCollapsed && 'lg:left-16'
      )}>
        <div className="bg-white rounded-lg border border-pq-neutral-200 shadow-sm overflow-hidden h-full flex flex-col">
          {isMobile ? (
            /* Mobile: single-panel layout */
            <div className="h-full flex flex-col">
              {selectedConversation ? (
                <>
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
                      profile={profile}
                      otherUserProfile={getOtherUserProfile()}
                    />
                  </div>
                </>
              ) : (
                <div className="h-full flex flex-col">
                  {ConvPanelHeader}
                  <div className="flex-1 overflow-y-auto">
                    <ConversationList
                      currentUserId={profile.id}
                      selectedConversationId={null}
                      onSelectConversation={handleSelectConversation}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Desktop: side-by-side layout */
            <div className="flex h-full">
              {/* Conversation list panel */}
              <div className="w-80 border-r border-pq-neutral-200 flex flex-col shrink-0">
                {ConvPanelHeader}
                <div className="flex-1 overflow-y-auto">
                  <ConversationList
                    currentUserId={profile.id}
                    selectedConversationId={selectedConversation?.id}
                    onSelectConversation={handleSelectConversation}
                  />
                </div>
              </div>

              {/* Message thread panel */}
              <div className="flex-1 min-w-0">
                {selectedConversation ? (
                  <MessageThread
                    conversationId={selectedConversation.id}
                    currentUserId={profile.id}
                    profile={profile}
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
                      Choose a conversation from the list, or click{' '}
                      <SquarePen className="inline w-3.5 h-3.5 mb-0.5" /> to message someone new.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New conversation modal */}
      <NewConversationModal
        isOpen={isNewConvOpen}
        onClose={() => setIsNewConvOpen(false)}
        currentUserId={profile.id}
        currentUserRole={profile.role}
        onConversationReady={handleConversationReady}
      />
    </>
  );
}
