'use client';

import { useState, useEffect } from 'react';
import { 
  X, 
  FileText, 
  Image as ImageIcon, 
  FileSpreadsheet, 
  Presentation, 
  Download,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  isImageMimeType, 
  isPdfMimeType, 
  formatFileSize,
  getAttachmentSignedUrl 
} from '@/lib/message-attachments';
import type { MessageAttachment } from '@/types/database';

// ─── File Icon Helper ─────────────────────────────────────────────────────────

function getFileIcon(mimeType: string) {
  if (isImageMimeType(mimeType)) {
    return <ImageIcon className="w-6 h-6 text-pq-primary-500" />;
  }
  if (isPdfMimeType(mimeType)) {
    return <FileText className="w-6 h-6 text-red-500" />;
  }
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
    return <FileSpreadsheet className="w-6 h-6 text-green-600" />;
  }
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) {
    return <Presentation className="w-6 h-6 text-orange-500" />;
  }
  return <FileText className="w-6 h-6 text-pq-primary-500" />;
}

// ─── Pending File Preview (before upload) ─────────────────────────────────────

interface PendingFilePreviewProps {
  file: File;
  onRemove: () => void;
  disabled?: boolean;
}

export function PendingFilePreview({ file, onRemove, disabled }: PendingFilePreviewProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const isImage = file.type.startsWith('image/');

  useEffect(() => {
    if (isImage) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file, isImage]);

  return (
    <div className="relative group">
      <div className={cn(
        'w-16 h-16 rounded-lg border border-pq-neutral-200 overflow-hidden',
        'flex items-center justify-center bg-pq-neutral-50'
      )}>
        {isImage && preview ? (
          <img 
            src={preview} 
            alt={file.name}
            className="w-full h-full object-cover"
          />
        ) : (
          getFileIcon(file.type)
        )}
      </div>
      
      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className={cn(
          'absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full',
          'bg-pq-neutral-700 text-white flex items-center justify-center',
          'opacity-0 group-hover:opacity-100 transition-opacity',
          'hover:bg-pq-danger-600',
          disabled && 'cursor-not-allowed opacity-50'
        )}
        aria-label={`Remove ${file.name}`}
      >
        <X className="w-3 h-3" />
      </button>
      
      {/* File info tooltip */}
      <div className="mt-1 max-w-[64px]">
        <p className="text-[10px] text-pq-neutral-600 truncate" title={file.name}>
          {file.name}
        </p>
        <p className="text-[9px] text-pq-neutral-400">
          {formatFileSize(file.size)}
        </p>
      </div>
    </div>
  );
}

// ─── Uploaded Attachment Preview (in message bubble) ──────────────────────────

interface AttachmentPreviewProps {
  attachment: MessageAttachment;
  isOwn?: boolean;
  onView?: (attachment: MessageAttachment) => void;
}

export function AttachmentPreview({ attachment, isOwn, onView }: AttachmentPreviewProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const isImage = isImageMimeType(attachment.mime_type);

  // Load image preview for image attachments
  useEffect(() => {
    if (isImage) {
      setLoading(true);
      getAttachmentSignedUrl(attachment.file_path, 3600) // 1 hour for images
        .then(setImageUrl)
        .catch(() => setImageUrl(null))
        .finally(() => setLoading(false));
    }
  }, [attachment.file_path, isImage]);

  async function handleDownload() {
    setDownloading(true);
    try {
      const url = await getAttachmentSignedUrl(attachment.file_path, 60);
      
      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.file_name;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to download attachment:', err);
    } finally {
      setDownloading(false);
    }
  }

  async function handleView() {
    if (onView) {
      onView(attachment);
      return;
    }
    
    // Default: open in new tab
    try {
      const url = await getAttachmentSignedUrl(attachment.file_path, 300);
      window.open(url, '_blank');
    } catch (err) {
      console.error('Failed to view attachment:', err);
    }
  }

  return (
    <div className={cn(
      'group relative rounded-lg overflow-hidden',
      isImage ? 'max-w-[200px]' : 'w-full'
    )}>
      {isImage ? (
        // Image attachment
        <div 
          className="cursor-pointer"
          onClick={handleView}
        >
          {loading ? (
            <div className="w-[200px] h-[150px] bg-pq-neutral-100 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-pq-neutral-400 animate-spin" />
            </div>
          ) : imageUrl ? (
            <img
              src={imageUrl}
              alt={attachment.file_name}
              className="max-w-[200px] max-h-[200px] rounded-lg object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-[200px] h-[150px] bg-pq-neutral-100 flex items-center justify-center">
              <ImageIcon className="w-8 h-8 text-pq-neutral-400" />
            </div>
          )}
          
          {/* Hover overlay for images */}
          <div className={cn(
            'absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity',
            'flex items-center justify-center gap-2'
          )}>
            <button
              onClick={(e) => { e.stopPropagation(); handleView(); }}
              className="p-2 rounded-full bg-white/90 text-pq-neutral-700 hover:bg-white transition"
              title="View"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleDownload(); }}
              disabled={downloading}
              className="p-2 rounded-full bg-white/90 text-pq-neutral-700 hover:bg-white transition disabled:opacity-50"
              title="Download"
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      ) : (
        // Non-image attachment (document)
        <div className={cn(
          'flex items-center gap-3 p-2.5 rounded-lg',
          isOwn 
            ? 'bg-white/10 hover:bg-white/20' 
            : 'bg-pq-neutral-50 hover:bg-pq-neutral-100',
          'transition cursor-pointer'
        )}
        onClick={handleView}
        >
          <div className="shrink-0">
            {getFileIcon(attachment.mime_type)}
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn(
              'text-xs font-medium truncate',
              isOwn ? 'text-white' : 'text-pq-neutral-800'
            )} title={attachment.file_name}>
              {attachment.file_name}
            </p>
            <p className={cn(
              'text-[10px]',
              isOwn ? 'text-white/70' : 'text-pq-neutral-500'
            )}>
              {formatFileSize(attachment.file_size)}
            </p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); handleDownload(); }}
            disabled={downloading}
            className={cn(
              'shrink-0 p-1.5 rounded-md transition',
              isOwn 
                ? 'text-white/70 hover:text-white hover:bg-white/10' 
                : 'text-pq-neutral-400 hover:text-pq-neutral-600 hover:bg-pq-neutral-200',
              'disabled:opacity-50'
            )}
            title="Download"
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Attachment Grid (multiple attachments) ───────────────────────────────────

interface AttachmentGridProps {
  attachments: MessageAttachment[];
  isOwn?: boolean;
  onView?: (attachment: MessageAttachment) => void;
}

export function AttachmentGrid({ attachments, isOwn, onView }: AttachmentGridProps) {
  if (attachments.length === 0) return null;

  // Separate images and documents
  const images = attachments.filter(a => isImageMimeType(a.mime_type));
  const documents = attachments.filter(a => !isImageMimeType(a.mime_type));

  return (
    <div className="space-y-2">
      {/* Image grid */}
      {images.length > 0 && (
        <div className={cn(
          'flex flex-wrap gap-1.5',
          images.length === 1 ? '' : 'max-w-[300px]'
        )}>
          {images.map((attachment) => (
            <AttachmentPreview
              key={attachment.id}
              attachment={attachment}
              isOwn={isOwn}
              onView={onView}
            />
          ))}
        </div>
      )}
      
      {/* Document list */}
      {documents.length > 0 && (
        <div className="space-y-1.5 max-w-[280px]">
          {documents.map((attachment) => (
            <AttachmentPreview
              key={attachment.id}
              attachment={attachment}
              isOwn={isOwn}
              onView={onView}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default AttachmentPreview;
