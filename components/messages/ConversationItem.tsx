'use client';

import { formatDistanceToNow } from 'date-fns';
import type { Conversation } from '@/types/database';
import { cn } from '@/lib/utils';

interface ConversationItemProps {
  conversation: Conversation;
  currentUserId: string;
  isSelected?: boolean;
  hasUnread?: boolean;
  onClick: () => void;
  /** Resolved display name of the other participant */
  otherUserName?: string;
}

export default function ConversationItem({
  conversation,
  currentUserId,
  isSelected = false,
  hasUnread = false,
  onClick,
  otherUserName,
}: ConversationItemProps) {
  // Determine the other user's ID for display
  const otherUserId =
    conversation.user_a_id === currentUserId
      ? conversation.user_b_id
      : conversation.user_a_id;

  const displayName = otherUserName || 'User';
  const initial = displayName.charAt(0).toUpperCase();

  const preview = conversation.last_message_preview || 'No messages yet';
  const timeAgo = conversation.last_message_at
    ? formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: true })
    : '';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-3 flex items-center gap-3 transition-all group border-l-2',
        isSelected
          ? 'bg-pq-primary-50 border-l-pq-primary-600'
          : hasUnread
            ? 'bg-pq-primary-50/60 hover:bg-pq-primary-50 border-l-transparent'
            : 'hover:bg-pq-neutral-50 border-l-transparent'
      )}
      aria-label={
        hasUnread
          ? `Conversation with ${displayName}, unread messages`
          : `Conversation with ${displayName}`
      }
      aria-current={isSelected ? 'page' : undefined}
    >
      {/* Avatar */}
      <div
        className={cn(
          'w-9 h-9 rounded-md flex items-center justify-center shrink-0 transition font-semibold text-xs',
          isSelected
            ? 'bg-pq-primary-600 text-white'
            : 'bg-pq-neutral-100 text-pq-neutral-600 group-hover:bg-pq-primary-100 group-hover:text-pq-primary-700'
        )}
      >
        {initial}
      </div>

      {/* Content */}
      <div className="flex flex-1 min-w-0 items-start gap-2">
        {hasUnread && (
          <span
            className="mt-2 w-1.5 h-1.5 rounded-full shrink-0 bg-pq-primary-600"
            aria-hidden
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span
              className={cn(
                'text-sm truncate',
                isSelected
                  ? 'font-semibold text-pq-primary-700'
                  : hasUnread
                    ? 'font-bold text-pq-neutral-900'
                    : 'font-semibold text-pq-neutral-900'
              )}
            >
              {displayName}
            </span>
            {timeAgo && (
              <span
                className={cn(
                  'text-[10px] shrink-0',
                  hasUnread && !isSelected ? 'text-pq-neutral-600' : 'text-pq-neutral-400'
                )}
              >
                {timeAgo}
              </span>
            )}
          </div>
          <p
            className={cn(
              'text-xs truncate',
              hasUnread && !isSelected
                ? 'font-medium text-pq-neutral-800'
                : 'text-pq-neutral-500'
            )}
          >
            {preview}
          </p>
        </div>
      </div>
    </button>
  );
}
