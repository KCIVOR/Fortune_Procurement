'use client';

import { useEffect, useRef, useState } from 'react';
import { ImageIcon, Paperclip, X, ZoomIn } from 'lucide-react';
import type { PR2ItemAttachment } from '@/types/pr2';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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

// ─── Read-only gallery (detail / print pages) ─────────────────────────────────

interface PR2AttachmentsGalleryProps {
  attachments: PR2ItemAttachment[];
}

export function PR2AttachmentsGallery({ attachments }: PR2AttachmentsGalleryProps) {
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

// ─── Per-item attachment button (used inside RawMaterialPR2ItemsEditor) ───────
// Compact: shows a paperclip icon + count badge. Clicking opens a hidden file
// input. Uploaded files appear as small thumbnails that can be individually
// removed. Mirrors PR1ItemAttachmentButton exactly, typed to PR2ItemAttachment.

interface PR2ItemAttachmentButtonProps {
  existingAttachments: PR2ItemAttachment[];
  pendingFiles: File[];
  onAddFiles: (files: File[]) => void;
  onRemovePendingFile: (index: number) => void;
  onRemoveExistingAttachment: (att: PR2ItemAttachment) => void;
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

export function PR2ItemAttachmentButton({
  existingAttachments = [],
  pendingFiles = [],
  onAddFiles,
  onRemovePendingFile,
  onRemoveExistingAttachment,
}: PR2ItemAttachmentButtonProps) {
  const [error, setError] = useState('');
  const [lightbox, setLightbox] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const MAX_SIZE = 10 * 1024 * 1024;

  const totalCount = existingAttachments.length + pendingFiles.length;

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    const valid: File[] = [];
    const errs: string[] = [];
    Array.from(files).forEach((f) => {
      if (!ACCEPTED_MIME.includes(f.type)) errs.push(`${f.name}: unsupported format.`);
      else if (f.size > MAX_SIZE) errs.push(`${f.name}: exceeds 10 MB.`);
      else valid.push(f);
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
              Attachments ({totalCount})
            </span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs font-semibold text-pq-primary-600 hover:text-pq-neutral-900 transition"
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

          {error && <p className="text-[10px] text-pq-danger-600 mt-2 text-center">{error}</p>}
        </PopoverContent>
      </Popover>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {lightbox && <Lightbox url={lightbox} onClose={() => setLightbox(null)} />}
    </>
  );
}
