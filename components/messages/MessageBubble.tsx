'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Pencil, Trash2, Check, X, Paperclip } from 'lucide-react';
import { editMessage, deleteMessage } from '@/lib/messages';
import { getMessageAttachments } from '@/lib/message-attachments';
import type { Message, MessageAttachment } from '@/types/database';
import { AttachmentGrid } from './AttachmentPreview';
import { cn } from '@/lib/utils';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  onEdit?: (messageId: string, newContent: string) => void;
  onDelete?: (messageId: string) => void;
}

export default function MessageBubble({
  message,
  isOwn,
  onEdit,
  onDelete,
}: MessageBubbleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);

  const isDeleted = message.is_deleted;
  const isEdited = !!message.edited_at && !isDeleted;
  const hasAttachments = (message.attachment_count ?? 0) > 0;
  const hasContent = message.content && message.content.trim().length > 0 && message.content !== 'Message deleted';

  // Load attachments when message has them
  useEffect(() => {
    if (hasAttachments && !isDeleted) {
      setLoadingAttachments(true);
      getMessageAttachments(message.id)
        .then(setAttachments)
        .catch((err) => {
          console.error('Failed to load attachments:', err);
          setAttachments([]);
        })
        .finally(() => setLoadingAttachments(false));
    }
  }, [message.id, hasAttachments, isDeleted, message.attachment_count]);

  async function handleSaveEdit() {
    const trimmed = editContent.trim();
    if (!trimmed || trimmed === message.content) {
      setIsEditing(false);
      return;
    }

    setIsSubmitting(true);
    try {
      await editMessage(message.id, trimmed);
      onEdit?.(message.id, trimmed);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to edit message:', err);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    setIsSubmitting(true);
    try {
      await deleteMessage(message.id);
      onDelete?.(message.id);
    } catch (err) {
      console.error('Failed to delete message:', err);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCancelEdit() {
    setEditContent(message.content);
    setIsEditing(false);
  }

  const timestamp = message.created_at
    ? format(new Date(message.created_at), 'h:mm a')
    : '';

  return (
    <div
      className={cn(
        'flex w-full group mb-2',
        isOwn ? 'justify-end' : 'justify-start'
      )}
    >
      <div className={cn('max-w-[75%] relative', isOwn ? 'items-end' : 'items-start')}>
        {/* Bubble */}
        <div
          className={cn(
            'rounded-lg text-sm leading-relaxed break-words',
            isDeleted
              ? 'bg-pq-neutral-50 text-pq-neutral-400 italic border border-pq-neutral-200 px-4 py-2.5'
              : isOwn
                ? 'bg-pq-primary-600 text-white rounded-br-none'
                : 'bg-pq-neutral-100 text-pq-neutral-900 rounded-bl-none',
            // Adjust padding based on content
            !isDeleted && (hasContent || isEditing) && 'px-4 py-2.5',
            !isDeleted && !hasContent && !isEditing && attachments.length > 0 && 'p-1.5'
          )}
        >
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full min-h-[60px] bg-white/90 text-pq-neutral-900 text-sm rounded-md border border-pq-neutral-300 px-2.5 py-2 resize-none focus:outline-none focus:border-pq-primary-500 focus:ring-1 focus:ring-pq-primary-500/25"
                disabled={isSubmitting}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSaveEdit();
                  }
                  if (e.key === 'Escape') {
                    handleCancelEdit();
                  }
                }}
              />
              <div className="flex items-center gap-1.5 justify-end">
                <button
                  onClick={handleCancelEdit}
                  disabled={isSubmitting}
                  className="p-1 rounded text-pq-neutral-500 hover:text-pq-neutral-700 hover:bg-pq-neutral-100 transition"
                  aria-label="Cancel edit"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={isSubmitting}
                  className="p-1 rounded text-pq-success-600 hover:text-pq-success-700 hover:bg-pq-success-50 transition"
                  aria-label="Save edit"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Text content */}
              {hasContent && <span>{message.content}</span>}
              
              {/* Attachments */}
              {!isDeleted && attachments.length > 0 && (
                <AttachmentGrid 
                  attachments={attachments} 
                  isOwn={isOwn}
                />
              )}
              
              {/* Loading attachments indicator */}
              {!isDeleted && loadingAttachments && hasAttachments && (
                <div className={cn(
                  'flex items-center gap-1.5 text-xs',
                  isOwn ? 'text-white/70' : 'text-pq-neutral-500'
                )}>
                  <Paperclip className="w-3 h-3" />
                  <span>Loading attachments...</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Meta row: timestamp + edited indicator + attachment count */}
        <div
          className={cn(
            'flex items-center gap-1.5 mt-1.5 px-1',
            isOwn ? 'justify-end' : 'justify-start'
          )}
        >
          {timestamp && (
            <span className="text-[10px] text-pq-neutral-400">{timestamp}</span>
          )}
          {isEdited && (
            <span className="text-[10px] text-pq-neutral-400 italic">edited</span>
          )}
          {hasAttachments && !isDeleted && (
            <span className="text-[10px] text-pq-neutral-400 flex items-center gap-0.5">
              <Paperclip className="w-2.5 h-2.5" />
              {message.attachment_count}
            </span>
          )}
        </div>

        {/* Action buttons (own messages only, not deleted, not editing) */}
        {isOwn && !isDeleted && !isEditing && (
          <div
            className={cn(
              'absolute top-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity',
              isOwn ? '-left-16' : '-right-16'
            )}
          >
            <button
              onClick={() => setIsEditing(true)}
              className="p-1.5 rounded-md text-pq-neutral-400 hover:text-pq-primary-600 hover:bg-pq-neutral-50 transition"
              aria-label="Edit message"
              title="Edit"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDelete}
              disabled={isSubmitting}
              className="p-1.5 rounded-md text-pq-neutral-400 hover:text-pq-danger-600 hover:bg-pq-danger-50 transition"
              aria-label="Delete message"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
