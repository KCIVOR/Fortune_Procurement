'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { FileText, ImageIcon, Paperclip, X, ZoomIn } from 'lucide-react';
import type { RfqQuoteAttachment } from '@/types/canvassing';
import {
  uploadRfqQuoteAttachment,
  deleteRfqQuoteAttachment,
  getRfqQuoteAttachmentUrl,
} from '@/lib/canvassing';
import * as DialogPrimitive from '@radix-ui/react-dialog';

const MAX_ATTACHMENTS = 3;
const ALLOWED_TYPES  = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']);
const IMAGE_TYPES    = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_SIZE       = 10 * 1024 * 1024;

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <DialogPrimitive.Root open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/80" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 focus:outline-none"
          onClick={onClose}
        >
          <DialogPrimitive.Close className="absolute top-4 right-4 text-white hover:text-pq-neutral-300 transition focus:outline-none">
            <X className="w-6 h-6" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
          <img
            src={url}
            alt="Attachment preview"
            className="max-w-full max-h-full rounded-md shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// ─── Staged-file thumbnail (image preview via object URL) ─────────────────────

function StagedFileThumbnail({
  file,
  onRemove,
  onPreview,
}: {
  file: File;
  onRemove: () => void;
  onPreview: (url: string) => void;
}) {
  const [objectUrl, setObjectUrl] = useState('');
  const isImage = IMAGE_TYPES.has(file.type);

  useEffect(() => {
    if (!isImage) return;
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, isImage]);

  return (
    <div className="relative group w-16 h-16">
      <button
        type="button"
        onClick={() => isImage && objectUrl && onPreview(objectUrl)}
        className="w-full h-full rounded-md border border-pq-neutral-200 overflow-hidden bg-pq-neutral-50 hover:border-pq-primary-400 transition focus:outline-none"
        title={`${file.name} (pending)`}
      >
        {isImage && objectUrl ? (
          <img src={objectUrl} alt={file.name} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center justify-center w-full h-full gap-0.5">
            <FileText className="w-5 h-5 text-pq-neutral-400" />
            <span className="text-[8px] text-pq-neutral-400 font-semibold uppercase">PDF</span>
          </div>
        )}
        {isImage && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center">
            <ZoomIn className="w-3 h-3 text-white opacity-0 group-hover:opacity-100 transition" />
          </div>
        )}
      </button>
      {/* Pending badge */}
      <span className="absolute -bottom-1 -left-1 w-3.5 h-3.5 rounded-full bg-pq-warning-500 border-2 border-white" title="Will upload on submit" />
      <button
        type="button"
        onClick={onRemove}
        className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-pq-danger-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
        title="Remove"
      >
        <X className="w-2.5 h-2.5" />
      </button>
    </div>
  );
}

// ─── Submitted attachment thumbnail ───────────────────────────────────────────

function SubmittedThumbnail({
  att,
  signedUrl,
  onRemove,
  onPreview,
}: {
  att: RfqQuoteAttachment;
  signedUrl: string;
  onRemove: (() => void) | null;
  onPreview: (url: string) => void;
}) {
  const isImage = IMAGE_TYPES.has(att.mime_type ?? '');

  return (
    <div className="relative group w-16 h-16">
      <button
        type="button"
        onClick={() => { if (isImage && signedUrl) onPreview(signedUrl); else if (signedUrl) window.open(signedUrl, '_blank', 'noopener'); }}
        className="w-full h-full rounded-md border border-pq-neutral-200 overflow-hidden bg-pq-neutral-50 hover:border-pq-primary-400 transition focus:outline-none"
        title={att.file_name}
      >
        {isImage && signedUrl ? (
          <img src={signedUrl} alt={att.file_name} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center justify-center w-full h-full gap-0.5">
            <FileText className="w-5 h-5 text-pq-neutral-400" />
            <span className="text-[8px] text-pq-neutral-400 font-semibold uppercase">PDF</span>
          </div>
        )}
        {isImage && signedUrl && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center">
            <ZoomIn className="w-3 h-3 text-white opacity-0 group-hover:opacity-100 transition" />
          </div>
        )}
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-pq-danger-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
          title="Remove"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  rfqId:               string;
  rfqSupplierId:       string;
  rfqItemQuoteId:      string | null;
  /** pr1_items.id, or (Phase 3, Raw Mats) pr2_items.id when isRawMaterial. */
  pr1ItemId:           string;
  /** Phase 3 (Raw Mats): when true, pr1ItemId is actually a pr2_items.id. */
  isRawMaterial?:      boolean;
  initialAttachments:  RfqQuoteAttachment[];
  stagedFiles:         File[];
  onStagedFilesChange: (files: File[]) => void;
  readOnly?:           boolean;
}

export default function RfqQuoteAttachmentSection({
  rfqId,
  rfqSupplierId,
  rfqItemQuoteId,
  pr1ItemId,
  isRawMaterial = false,
  initialAttachments,
  stagedFiles,
  onStagedFilesChange,
  readOnly = false,
}: Props) {
  const { profile } = useAuth();
  const [attachments, setAttachments]     = useState<RfqQuoteAttachment[]>(initialAttachments);
  const [signedUrls, setSignedUrls]       = useState<Record<string, string>>({});
  const [uploading, setUploading]         = useState(false);
  const [uploadError, setUploadError]     = useState<string | null>(null);
  const [deletingId, setDeletingId]       = useState<string | null>(null);
  const [lightbox, setLightbox]           = useState<string | null>(null);
  const [dragOver, setDragOver]           = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalCount = attachments.length + stagedFiles.length;
  const atLimit    = totalCount >= MAX_ATTACHMENTS;

  // Fetch signed URLs for submitted attachments on mount / when list changes
  useEffect(() => {
    const missing = attachments.filter(a => !signedUrls[a.id]);
    if (missing.length === 0) return;
    Promise.all(
      missing.map(a =>
        getRfqQuoteAttachmentUrl(a.storage_path)
          .then(url => ({ id: a.id, url }))
          .catch(() => null)
      )
    ).then(results => {
      const additions: Record<string, string> = {};
      for (const r of results) {
        if (r) additions[r.id] = r.url;
      }
      setSignedUrls(prev => ({ ...prev, ...additions }));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachments]);

  function validate(file: File): string | null {
    if (!ALLOWED_TYPES.has(file.type)) return `File type not allowed. Use JPEG, PNG, WebP, GIF, or PDF.`;
    if (file.size > MAX_SIZE) return `File exceeds the 10 MB limit.`;
    return null;
  }

  async function processFile(file: File) {
    setUploadError(null);
    const err = validate(file);
    if (err) { setUploadError(err); return; }
    if (atLimit) return;

    if (rfqItemQuoteId === null) {
      onStagedFilesChange([...stagedFiles, file]);
      return;
    }

    setUploading(true);
    try {
      const result = await uploadRfqQuoteAttachment({
        rfqId,
        rfqSupplierId,
        rfqItemQuoteId,
        pr1ItemId: isRawMaterial ? null : pr1ItemId,
        pr2ItemId: isRawMaterial ? pr1ItemId : null,
        file,
      });
      setAttachments(prev => [...prev, result]);
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    files.forEach(processFile);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (readOnly) return;
    Array.from(e.dataTransfer.files).forEach(processFile);
  }

  async function handleDelete(att: RfqQuoteAttachment) {
    if (!confirm(`Remove "${att.file_name}"?`)) return;
    setDeletingId(att.id);
    try {
      await deleteRfqQuoteAttachment(att.id, att.storage_path, profile?.id);
      setAttachments(prev => prev.filter(a => a.id !== att.id));
      setSignedUrls(prev => { const n = { ...prev }; delete n[att.id]; return n; });
    } catch {
      // silently ignore
    } finally {
      setDeletingId(null);
    }
  }

  const noAttachments = attachments.length === 0 && stagedFiles.length === 0;
  if (readOnly && noAttachments) return null;

  return (
    <>
      <div className="space-y-2.5">
        <p className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
          Attachments
          <span className="text-pq-neutral-400 font-normal normal-case ml-1">
            (optional · images &amp; PDF · max {MAX_ATTACHMENTS})
          </span>
        </p>

        {/* Thumbnails grid */}
        {totalCount > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map(att => (
              <SubmittedThumbnail
                key={att.id}
                att={att}
                signedUrl={signedUrls[att.id] ?? ''}
                onRemove={!readOnly && deletingId !== att.id ? () => handleDelete(att) : null}
                onPreview={setLightbox}
              />
            ))}
            {stagedFiles.map((file, idx) => (
              <StagedFileThumbnail
                key={idx}
                file={file}
                onRemove={() => onStagedFilesChange(stagedFiles.filter((_, i) => i !== idx))}
                onPreview={setLightbox}
              />
            ))}
          </div>
        )}

        {/* Upload zone */}
        {!readOnly && !atLimit && (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-1.5 px-4 py-3 rounded-md border-2 border-dashed transition cursor-pointer select-none
              ${dragOver
                ? 'border-pq-primary-400 bg-pq-primary-50'
                : 'border-pq-neutral-200 bg-pq-neutral-50 hover:border-pq-primary-300 hover:bg-pq-primary-50/40'}`}
          >
            <Paperclip className={`w-4 h-4 ${dragOver ? 'text-pq-primary-500' : 'text-pq-neutral-400'}`} />
            <p className="text-xs text-pq-neutral-500">
              {uploading ? 'Uploading…' : 'Drag & drop or click to attach'}
            </p>
            <p className="text-[10px] text-pq-neutral-400">
              JPEG · PNG · WebP · GIF · PDF · max 10 MB
              {rfqItemQuoteId === null && (
                <span className="ml-1 text-pq-warning-600">· uploads on submit</span>
              )}
            </p>
          </div>
        )}

        {!readOnly && atLimit && (
          <p className="text-[10px] text-pq-neutral-400">Maximum {MAX_ATTACHMENTS} attachments reached.</p>
        )}

        {uploadError && <p className="text-xs text-pq-danger-600">{uploadError}</p>}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
        multiple
        className="hidden"
        onChange={handleInputChange}
        disabled={uploading}
      />

      {lightbox && <Lightbox url={lightbox} onClose={() => setLightbox(null)} />}
    </>
  );
}
