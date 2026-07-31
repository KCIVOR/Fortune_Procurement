'use client';

import { useEffect, useRef, useState } from 'react';
import { ImageIcon, Paperclip, Trash2, X, ZoomIn } from 'lucide-react';
import type { PR1Attachment } from '@/types/pr1';
import { uploadPR1Attachment, deletePR1Attachment } from '@/lib/pr1';
import { useAuth } from '@/context/AuthContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogPortal } from '@/components/ui/dialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';

// ─── Shared lightbox ──────────────────────────────────────────────────────────

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <DialogPrimitive.Root open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
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
            onClick={(e) => e.stopPropagation()}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// ─── Read-only gallery (detail / approval / warehouse / print pages) ──────────

interface PR1AttachmentsGalleryProps {
  attachments: PR1Attachment[];
}

export function PR1AttachmentsGallery({ attachments }: PR1AttachmentsGalleryProps) {
  const [lightbox, setLightbox] = useState<string | null>(null);

  if (attachments.length === 0) {
    return <span className="text-xs text-pq-neutral-300">—</span>;
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-pq-neutral-200 hover:border-pq-primary-400 hover:text-pq-primary-600 bg-white text-xs font-semibold text-pq-neutral-700 transition"
        >
          <Paperclip className="w-3.5 h-3.5 text-pq-neutral-400" />
          <span>View ({attachments.length})</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md p-5 bg-pq-white">
        <DialogHeader className="border-b border-pq-neutral-100 pb-2 mb-4">
          <DialogTitle className="text-sm font-semibold text-pq-neutral-900 uppercase tracking-wide">
            Item Attachments
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap gap-3 justify-start py-2">
          {attachments.map((att) => (
            <button
              key={att.id}
              type="button"
              onClick={() => att.signed_url && setLightbox(att.signed_url)}
              className="group relative w-20 h-20 rounded-md border border-pq-neutral-200 overflow-hidden bg-pq-neutral-50 hover:border-pq-primary-400 transition focus:outline-none focus:ring-2 focus:ring-pq-primary-500"
              title={att.file_name}
            >
              {att.signed_url ? (
                <img src={att.signed_url} alt={att.file_name} className="w-full h-full object-cover" />
              ) : (
                <div className="flex items-center justify-center w-full h-full">
                  <ImageIcon className="w-5 h-5 text-pq-neutral-300" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center">
                <ZoomIn className="w-3.5 h-3.5 text-white opacity-0 group-hover:opacity-100 transition" />
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
      {lightbox && (
        <Lightbox url={lightbox} onClose={() => setLightbox(null)} />
      )}
    </Dialog>
  );
}

// ─── Per-item attachment button (used inside the PR1Form items table) ─────────
// Compact: shows a paperclip icon + count badge.
// Clicking opens a hidden file input. Uploaded files appear as small thumbnails
// below the trigger that can be individually removed.

interface PR1ItemAttachmentButtonProps {
  existingAttachments: PR1Attachment[];
  pendingFiles: File[];
  onAddFiles: (files: File[]) => void;
  onRemovePendingFile: (index: number) => void;
  onRemoveExistingAttachment: (att: PR1Attachment) => void;
}

function PendingFilePreview({
  file,
  onRemove,
  onPreview,
}: {
  file: File;
  onRemove: () => void;
  onPreview: (url: string) => void;
}) {
  const [url, setUrl] = useState<string>('');

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  if (!url) return null;

  return (
    <div className="relative group w-12 h-12">
      <button
        type="button"
        onClick={() => onPreview(url)}
        className="w-full h-full rounded border border-pq-neutral-200 overflow-hidden bg-pq-neutral-50 hover:border-pq-primary-400 transition focus:outline-none"
        title={`${file.name} (pending upload)`}
      >
        <img src={url} alt={file.name} className="w-full h-full object-cover" />
      </button>
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

export function PR1ItemAttachmentButton({
  existingAttachments = [],
  pendingFiles = [],
  onAddFiles,
  onRemovePendingFile,
  onRemoveExistingAttachment,
}: PR1ItemAttachmentButtonProps) {
  const [error, setError] = useState('');
  const [lightbox, setLightbox] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const MAX_SIZE = 10 * 1024 * 1024;
  const MAX_ATTACHMENTS = 3;

  const totalCount = existingAttachments.length + pendingFiles.length;
  const atLimit = totalCount >= MAX_ATTACHMENTS;

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    const valid: File[] = [];
    const errs: string[] = [];
    let remaining = MAX_ATTACHMENTS - totalCount;
    Array.from(files).forEach((f) => {
      if (!ACCEPTED_MIME.includes(f.type)) errs.push(`${f.name}: unsupported format.`);
      else if (f.size > MAX_SIZE) errs.push(`${f.name}: exceeds 10 MB.`);
      else if (remaining <= 0) errs.push(`${f.name}: maximum ${MAX_ATTACHMENTS} attachments reached.`);
      else { valid.push(f); remaining -= 1; }
    });
    if (errs.length) {
      setError(errs.join(' '));
    } else {
      setError('');
    }
    if (!valid.length) return;

    onAddFiles(valid);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            title="Attach images to this item"
            className={`
              relative inline-flex items-center justify-center w-7 h-7 rounded-md border transition
              border-pq-neutral-200 text-pq-neutral-400 hover:border-pq-primary-400 hover:text-pq-primary-600 bg-white
            `}
          >
            <Paperclip className="w-3.5 h-3.5" />
            {totalCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 flex items-center justify-center rounded-full bg-pq-primary-600 text-white text-[9px] font-bold px-0.5">
                {totalCount}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="center" className="w-64 p-3.5 bg-pq-white">
          <div className="flex items-center justify-between border-b border-pq-neutral-100 pb-2 mb-2.5">
            <span className="text-xs font-semibold text-pq-neutral-700 uppercase tracking-wide">
              Attachments ({totalCount}/{MAX_ATTACHMENTS})
            </span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={atLimit}
              className="text-xs font-semibold text-pq-primary-600 hover:text-pq-neutral-900 transition disabled:text-pq-neutral-300 disabled:cursor-not-allowed"
            >
              + Add
            </button>
          </div>

          {totalCount === 0 ? (
            <div className="py-4 text-center">
              <p className="text-xs text-pq-neutral-400 italic">No attachments yet.</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1">
              {/* Existing database attachments */}
              {existingAttachments.map((att) => (
                <div key={att.id} className="relative group w-12 h-12">
                  <button
                    type="button"
                    onClick={() => att.signed_url && setLightbox(att.signed_url)}
                    className="w-full h-full rounded border border-pq-neutral-200 overflow-hidden bg-pq-neutral-50 hover:border-pq-primary-400 transition focus:outline-none"
                    title={att.file_name}
                  >
                    {att.signed_url ? (
                      <img src={att.signed_url} alt={att.file_name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex items-center justify-center w-full h-full">
                        <ImageIcon className="w-4 h-4 text-pq-neutral-300" />
                      </div>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Remove "${att.file_name}"?`)) {
                        onRemoveExistingAttachment(att);
                      }
                    }}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-pq-danger-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                    title="Remove"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}

              {/* Pending files */}
              {pendingFiles.map((file, pIdx) => (
                <PendingFilePreview
                  key={pIdx}
                  file={file}
                  onRemove={() => onRemovePendingFile(pIdx)}
                  onPreview={(url) => setLightbox(url)}
                />
              ))}
            </div>
          )}

          {atLimit && !error && (
            <p className="text-[10px] text-pq-neutral-400 mt-2 text-center">Maximum {MAX_ATTACHMENTS} attachments reached.</p>
          )}
          {error && <p className="text-[10px] text-pq-danger-600 mt-2 text-center">{error}</p>}
        </PopoverContent>
      </Popover>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        multiple
        disabled={atLimit}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {lightbox && <Lightbox url={lightbox} onClose={() => setLightbox(null)} />}
    </>
  );
}

// ─── Full uploader (kept for any future standalone use) ───────────────────────

interface PR1AttachmentsUploaderProps {
  pr1Id: string | undefined;
  pr1ItemId: string | undefined;
  initialAttachments?: PR1Attachment[];
}

export function PR1AttachmentsUploader({
  pr1Id,
  pr1ItemId,
  initialAttachments = [],
}: PR1AttachmentsUploaderProps) {
  const { profile } = useAuth();
  const [attachments, setAttachments] = useState<PR1Attachment[]>(initialAttachments);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const MAX_SIZE_BYTES = 10 * 1024 * 1024;
  const MAX_ATTACHMENTS = 3;
  const disabled = !pr1Id || !pr1ItemId || attachments.length >= MAX_ATTACHMENTS;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || !pr1Id || !pr1ItemId) return;
    const validFiles: File[] = [];
    const errors: string[] = [];
    let remaining = MAX_ATTACHMENTS - attachments.length;
    Array.from(files).forEach((f) => {
      if (!ACCEPTED_MIME.includes(f.type)) errors.push(`${f.name}: unsupported format.`);
      else if (f.size > MAX_SIZE_BYTES) errors.push(`${f.name}: exceeds 10 MB.`);
      else if (remaining <= 0) errors.push(`${f.name}: maximum ${MAX_ATTACHMENTS} attachments reached.`);
      else { validFiles.push(f); remaining -= 1; }
    });
    if (errors.length) setUploadError(errors.join(' '));
    else setUploadError('');
    if (!validFiles.length) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(
        validFiles.map((f) => uploadPR1Attachment(pr1Id, pr1ItemId, f)),
      );
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (err: any) {
      setUploadError(err.message ?? 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(att: PR1Attachment) {
    if (!confirm(`Remove "${att.file_name}"?`)) return;
    setDeleting(att.id);
    try {
      await deletePR1Attachment(att, profile?.id);
      setAttachments((prev) => prev.filter((a) => a.id !== att.id));
    } catch (err: any) {
      setUploadError(err.message ?? 'Failed to remove.');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <>
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!disabled) handleFiles(e.dataTransfer.files); }}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-2 p-4 rounded-md border-2 border-dashed transition cursor-pointer select-none
          ${disabled ? 'border-pq-neutral-200 bg-pq-neutral-50 cursor-not-allowed opacity-60'
            : dragOver ? 'border-pq-primary-400 bg-pq-primary-50'
              : 'border-pq-neutral-200 bg-pq-neutral-50 hover:border-pq-primary-300 hover:bg-pq-primary-50/40'}`}
      >
        <Paperclip className={`w-4 h-4 ${dragOver ? 'text-pq-primary-500' : 'text-pq-neutral-400'}`} />
        <p className="text-xs text-pq-neutral-500 text-center">
          {uploading ? 'Uploading…' : attachments.length >= MAX_ATTACHMENTS ? `Maximum ${MAX_ATTACHMENTS} attachments reached` : 'Drag & drop images or click to browse'}
        </p>
        <p className="text-[10px] text-pq-neutral-400">JPEG · PNG · GIF · WebP · max 10 MB · up to {MAX_ATTACHMENTS} files</p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={disabled || uploading}
      />
      {uploadError && <p className="text-xs text-pq-danger-600 mt-1">{uploadError}</p>}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-3 mt-3">
          {attachments.map((att) => (
            <div key={att.id} className="relative group w-20 h-20">
              <button
                type="button"
                onClick={() => att.signed_url && setLightbox(att.signed_url)}
                className="w-full h-full rounded-md border border-pq-neutral-200 overflow-hidden bg-pq-neutral-50 hover:border-pq-primary-400 transition focus:outline-none"
                title={att.file_name}
              >
                {att.signed_url
                  ? <img src={att.signed_url} alt={att.file_name} className="w-full h-full object-cover" />
                  : <div className="flex items-center justify-center w-full h-full"><ImageIcon className="w-5 h-5 text-pq-neutral-300" /></div>}
              </button>
              <button
                type="button"
                disabled={deleting === att.id}
                onClick={() => handleDelete(att)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-pq-danger-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                title="Remove"
              >
                {deleting === att.id
                  ? <span className="w-2.5 h-2.5 border border-white border-t-transparent rounded-full animate-spin" />
                  : <Trash2 className="w-2.5 h-2.5" />}
              </button>
            </div>
          ))}
        </div>
      )}
      {lightbox && <Lightbox url={lightbox} onClose={() => setLightbox(null)} />}
    </>
  );
}
