'use client';

import { useState, useRef, useCallback } from 'react';
import { Send, Paperclip, X, Loader2 } from 'lucide-react';
import { sendMessage } from '@/lib/messages';
import { 
  uploadMessageAttachment, 
  MESSAGE_ATTACHMENT_LIMITS,
  formatFileSize 
} from '@/lib/message-attachments';
import type { Message } from '@/types/database';
import type { UserProfile } from '@/types/auth';
import { PendingFilePreview } from './AttachmentPreview';
import { cn } from '@/lib/utils';

/** Maximum message length in characters */
const MAX_MESSAGE_LENGTH = 2000;

interface MessageInputProps {
  conversationId: string;
  senderId: string;
  profile: UserProfile;
  onMessageSent?: (message: Message) => void;
  className?: string;
}

export default function MessageInput({
  conversationId,
  senderId,
  profile,
  onMessageSent,
  className,
}: MessageInputProps) {
  const [content, setContent] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const trimmedLength = content.trim().length;
  const isOverLimit = trimmedLength > MAX_MESSAGE_LENGTH;
  const hasContent = trimmedLength > 0;
  const hasFiles = pendingFiles.length > 0;
  const canSend = (hasContent || hasFiles) && !isOverLimit && !sending;

  // ─── File Selection ─────────────────────────────────────────────────────────

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);

    const newFiles: File[] = [];
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Check total count
      if (pendingFiles.length + newFiles.length >= MESSAGE_ATTACHMENT_LIMITS.maxAttachmentsPerMessage) {
        errors.push(`Maximum ${MESSAGE_ATTACHMENT_LIMITS.maxAttachmentsPerMessage} files per message`);
        break;
      }

      // Check file size
      if (file.size > MESSAGE_ATTACHMENT_LIMITS.maxFileSize) {
        errors.push(`${file.name} exceeds ${MESSAGE_ATTACHMENT_LIMITS.maxFileSizeMB}MB limit`);
        continue;
      }

      // Check file type
      if (!MESSAGE_ATTACHMENT_LIMITS.allowedMimeTypes.includes(file.type)) {
        errors.push(`${file.name} has unsupported file type`);
        continue;
      }

      // Check for duplicates
      const isDuplicate = pendingFiles.some(
        f => f.name === file.name && f.size === file.size
      );
      if (isDuplicate) {
        continue;
      }

      newFiles.push(file);
    }

    if (errors.length > 0) {
      setError(errors[0]); // Show first error
    }

    if (newFiles.length > 0) {
      setPendingFiles(prev => [...prev, ...newFiles]);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [pendingFiles]);

  const handleRemoveFile = useCallback((index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
    setError(null);
  }, []);

  const triggerFileInput = () => {
    if (sending) return;
    fileInputRef.current?.click();
  };

  // ─── Send Message ───────────────────────────────────────────────────────────

  async function handleSend() {
    const trimmed = content.trim();
    if ((!trimmed && pendingFiles.length === 0) || sending || isOverLimit) return;

    setError(null);
    setSending(true);

    try {
      // 1. Create the message (with hasAttachments flag if we have files)
      const newMessage = await sendMessage(
        conversationId, 
        senderId, 
        trimmed,
        pendingFiles.length > 0 // hasAttachments
      );

      // 2. Immediately notify parent to add to known IDs and state
      // This MUST happen before uploading attachments to prevent
      // the realtime INSERT event from creating a duplicate
      onMessageSent?.(newMessage);

      // 3. Upload attachments if any
      if (pendingFiles.length > 0) {
        setUploadProgress(`Uploading 0/${pendingFiles.length}...`);
        
        for (let i = 0; i < pendingFiles.length; i++) {
          setUploadProgress(`Uploading ${i + 1}/${pendingFiles.length}...`);
          await uploadMessageAttachment(
            conversationId,
            newMessage.id,
            pendingFiles[i],
            profile
          );
        }
      }

      // 4. Clear state
      setContent('');
      setPendingFiles([]);
      setUploadProgress(null);

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setError(err instanceof Error ? err.message : 'Failed to send. Try again.');
    } finally {
      setSending(false);
      setUploadProgress(null);
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

  // ─── Drag & Drop ────────────────────────────────────────────────────────────

  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!sending) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (!sending) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  // ─── Accepted file types for input ──────────────────────────────────────────

  const acceptedTypes = MESSAGE_ATTACHMENT_LIMITS.allowedMimeTypes.join(',');

  return (
    <div 
      className={cn('space-y-1', className)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedTypes}
        multiple
        onChange={(e) => handleFileSelect(e.target.files)}
        className="hidden"
        disabled={sending}
      />

      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-pq-primary-50/90 border-2 border-dashed border-pq-primary-400 rounded-lg flex items-center justify-center z-10">
          <div className="text-center">
            <Paperclip className="w-8 h-8 text-pq-primary-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-pq-primary-700">Drop files to attach</p>
          </div>
        </div>
      )}

      {/* Pending files preview */}
      {pendingFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1 pb-2">
          {pendingFiles.map((file, index) => (
            <PendingFilePreview
              key={`${file.name}-${file.size}-${index}`}
              file={file}
              onRemove={() => handleRemoveFile(index)}
              disabled={sending}
            />
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2">
        {/* Attach button */}
        <button
          type="button"
          onClick={triggerFileInput}
          disabled={sending || pendingFiles.length >= MESSAGE_ATTACHMENT_LIMITS.maxAttachmentsPerMessage}
          className={cn(
            'shrink-0 flex items-center justify-center w-10 h-10 rounded-md transition',
            'text-pq-neutral-400 hover:text-pq-primary-600 hover:bg-pq-neutral-50',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-pq-neutral-400'
          )}
          aria-label="Attach file"
          title={pendingFiles.length >= MESSAGE_ATTACHMENT_LIMITS.maxAttachmentsPerMessage 
            ? `Maximum ${MESSAGE_ATTACHMENT_LIMITS.maxAttachmentsPerMessage} files` 
            : 'Attach file'}
        >
          <Paperclip className="w-4 h-4" />
        </button>

        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={pendingFiles.length > 0 ? "Add a message (optional)..." : "Type a message..."}
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
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Validation feedback */}
      {(error || isOverLimit || uploadProgress || trimmedLength > MAX_MESSAGE_LENGTH * 0.9) && (
        <div className="flex items-center justify-between px-1">
          {error && (
            <span className="text-[11px] text-pq-danger-600">{error}</span>
          )}
          {uploadProgress && !error && (
            <span className="text-[11px] text-pq-primary-600">{uploadProgress}</span>
          )}
          {!error && !uploadProgress && isOverLimit && (
            <span className="text-[11px] text-pq-danger-600">
              Message too long ({trimmedLength.toLocaleString()}/{MAX_MESSAGE_LENGTH.toLocaleString()})
            </span>
          )}
          {!error && !uploadProgress && !isOverLimit && trimmedLength > MAX_MESSAGE_LENGTH * 0.9 && (
            <span className="text-[11px] text-pq-neutral-400">
              {trimmedLength.toLocaleString()}/{MAX_MESSAGE_LENGTH.toLocaleString()}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
