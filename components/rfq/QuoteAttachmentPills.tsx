'use client';

import { useState } from 'react';
import { FileText, Paperclip, X, ZoomIn } from 'lucide-react';
import type { RfqQuoteAttachment } from '@/types/canvassing';
import { getRfqQuoteAttachmentUrl } from '@/lib/canvassing';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

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

// ─── Gallery dialog ───────────────────────────────────────────────────────────

function GalleryDialog({ attachments }: { attachments: RfqQuoteAttachment[] }) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loading, setLoading]       = useState(false);
  const [lightbox, setLightbox]     = useState<string | null>(null);

  async function handleOpen(open: boolean) {
    if (!open) return;
    const missing = attachments.filter(a => !signedUrls[a.id]);
    if (missing.length === 0) return;
    setLoading(true);
    const results = await Promise.all(
      missing.map(a =>
        getRfqQuoteAttachmentUrl(a.storage_path)
          .then(url => ({ id: a.id, url }))
          .catch(() => null)
      )
    );
    const additions: Record<string, string> = {};
    for (const r of results) { if (r) additions[r.id] = r.url; }
    setSignedUrls(prev => ({ ...prev, ...additions }));
    setLoading(false);
  }

  return (
    <>
      <Dialog onOpenChange={handleOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-pq-neutral-200 hover:border-pq-primary-400 hover:text-pq-primary-600 bg-white text-xs font-semibold text-pq-neutral-700 transition whitespace-nowrap"
          >
            <Paperclip className="w-3.5 h-3.5 shrink-0 text-pq-neutral-400" />
            <span>View ({attachments.length})</span>
          </button>
        </DialogTrigger>

        <DialogContent className="sm:max-w-md p-5 bg-pq-white">
          <DialogHeader className="border-b border-pq-neutral-100 pb-2 mb-4">
            <DialogTitle className="text-sm font-semibold text-pq-neutral-900 uppercase tracking-wide">
              Supplier Quote Attachments
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="py-6 text-center text-xs text-pq-neutral-400">Loading…</div>
          ) : (
            <div className="flex flex-wrap gap-3 justify-start py-2">
              {attachments.map(att => {
                const url     = signedUrls[att.id] ?? '';
                const isImage = IMAGE_TYPES.has(att.mime_type ?? '');
                return (
                  <button
                    key={att.id}
                    type="button"
                    onClick={() => {
                      if (isImage && url) setLightbox(url);
                      else if (url) window.open(url, '_blank', 'noopener');
                    }}
                    className="group relative w-20 h-20 rounded-md border border-pq-neutral-200 overflow-hidden bg-pq-neutral-50 hover:border-pq-primary-400 transition focus:outline-none focus:ring-2 focus:ring-pq-primary-500"
                    title={att.file_name}
                  >
                    {isImage && url ? (
                      <>
                        <img src={url} alt={att.file_name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center">
                          <ZoomIn className="w-3.5 h-3.5 text-white opacity-0 group-hover:opacity-100 transition" />
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center w-full h-full gap-1">
                        <FileText className="w-6 h-6 text-pq-neutral-400" />
                        <span className="text-[9px] text-pq-neutral-400 font-semibold uppercase px-1 truncate w-full text-center">
                          {att.file_name}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {lightbox && <Lightbox url={lightbox} onClose={() => setLightbox(null)} />}
    </>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function QuoteAttachmentPills({ attachments }: { attachments: RfqQuoteAttachment[] }) {
  if (!attachments || attachments.length === 0) return null;
  return <GalleryDialog attachments={attachments} />;
}
