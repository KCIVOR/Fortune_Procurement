'use client';

import { useState, useRef } from 'react';
import { Send, Paperclip } from 'lucide-react';
import { sendMessage } from '@/lib/messages';
import type { Message } from '@/types/database';
import { cn } from '@/lib/utils';

/** Maximum message length in characters */
const MAX_MESSAGE_LENGTH = 2000;

interface MessageInputProps {
  conversationId: string;
  senderId: string;
  onMessageSent?: (message: Message) => void;
  className?: string;
}

export default function MessageInput({
  conversationId,
  senderId,
  onMessageSent,
  className,
}: MessageInputProps) {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const trimmedLength = content.trim().length;
  const isOverLimit = trimmedLength > MAX_MESSAGE_LENGTH;
  const canSend = trimmedLength > 0 && !isOverLimit && !sending;

  async function handleSend() {
    const trimmed = content.trim();
    if (!trimmed || sending || trimmed.length > MAX_MESSAGE_LENGTH) return;

    setError(null);
    setSending(true);
    try {
      const newMessage = await sendMessage(conversationId, senderId, trimmed);
      setContent('');
      onMessageSent?.(newMessage);

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send. Try again.');
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value);
    setError(null);

    // Auto-resize textarea
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-end gap-2">
        {/* Attach button */}
        <button
          type="button"
          disabled={sending}
          className="shrink-0 flex items-center justify-center w-10 h-10 rounded-md text-pq-neutral-400 hover:text-pq-primary-600 hover:bg-pq-neutral-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Attach file"
          title="Attach file (coming soon)"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={sending}
          rows={1}
          maxLength={MAX_MESSAGE_LENGTH + 100}
          className={cn(
            'flex-1 min-h-[40px] max-h-[120px] resize-none rounded-md border px-3 py-2.5 text-sm text-pq-neutral-900 placeholder:text-pq-neutral-400 focus-visible:outline-none focus-visible:ring-2 transition disabled:opacity-50',
            isOverLimit
              ? 'border-pq-danger-400 focus-visible:border-pq-danger-500 focus-visible:ring-pq-danger-500/25'
              : 'border-pq-neutral-300 bg-pq-white focus-visible:border-pq-primary-500 focus-visible:ring-pq-primary-500/25'
          )}
          aria-label="Message input"
          aria-invalid={isOverLimit}
        />

        {/* Send button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className={cn(
            'shrink-0 flex items-center justify-center w-10 h-10 rounded-md transition',
            canSend
              ? 'bg-pq-primary-600 text-white hover:bg-pq-primary-700'
              : 'bg-pq-neutral-100 text-pq-neutral-400 cursor-not-allowed'
          )}
          aria-label="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      {/* Validation feedback */}
      <div className="flex items-center justify-between px-1 min-h-[16px]">
        {error && (
          <span className="text-[11px] text-pq-danger-600">{error}</span>
        )}
        {!error && isOverLimit && (
          <span className="text-[11px] text-pq-danger-600">
            Message too long ({trimmedLength.toLocaleString()}/{MAX_MESSAGE_LENGTH.toLocaleString()})
          </span>
        )}
        {!error && !isOverLimit && trimmedLength > MAX_MESSAGE_LENGTH * 0.9 && (
          <span className="text-[11px] text-pq-neutral-400">
            {trimmedLength.toLocaleString()}/{MAX_MESSAGE_LENGTH.toLocaleString()}
          </span>
        )}
        {!error && !isOverLimit && trimmedLength <= MAX_MESSAGE_LENGTH * 0.9 && (
          <span />
        )}
      </div>
    </div>
  );
}
