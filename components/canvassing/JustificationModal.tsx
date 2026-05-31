'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TriangleAlert, FlaskConical } from 'lucide-react';
import { QUOTE_JUSTIFICATION_MIN_LENGTH } from '@/lib/canvassing';

/**
 * Phase 7 (Raw Mats): justification capture for awarding an unverified or
 * manual-entry quote on a raw-mats line.
 *
 * Procurement opens this modal when `saveItemSelection` returns
 * `{ ok: false, reason: 'needs_justification' }`. Submitting the modal
 * re-invokes selection with the typed justification appended.
 */
export interface JustificationContext {
  rfqId: string;
  pr1ItemId: string;
  rfqSupplierId: string;
  verification: 'unverified' | 'manual';
  productName: string | null;
  productStatus: string | null;
  /** Display-only metadata so the modal can show what is being awarded. */
  itemDescription: string;
  supplierName: string;
}

export interface JustificationModalProps {
  open: boolean;
  context: JustificationContext | null;
  busy?: boolean;
  /** Submit the typed justification. Must satisfy MIN_LENGTH (validated here too). */
  onSubmit: (justification: string) => void | Promise<void>;
  /** Close the modal without saving. */
  onCancel: () => void;
}

export default function JustificationModal({
  open,
  context,
  busy,
  onSubmit,
  onCancel,
}: JustificationModalProps) {
  const [text, setText] = useState('');
  const [touched, setTouched] = useState(false);

  // Reset content whenever the modal opens for a different award
  useEffect(() => {
    if (open) {
      setText('');
      setTouched(false);
    }
  }, [open, context?.pr1ItemId, context?.rfqSupplierId]);

  const trimmed = text.trim();
  const tooShort = trimmed.length < QUOTE_JUSTIFICATION_MIN_LENGTH;
  const showError = touched && tooShort;

  const verificationLabel =
    context?.verification === 'unverified'
      ? `Unverified product${context.productName ? ` — ${context.productName}` : ''}`
      : 'Manual entry (no catalog product linked)';

  const productHint =
    context?.verification === 'unverified' && context.productStatus
      ? ` (current status: ${context.productStatus.replace(/_/g, ' ')})`
      : '';

  const handleSubmit = async () => {
    setTouched(true);
    if (tooShort) return;
    await onSubmit(trimmed);
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-lg w-[95vw] sm:rounded-lg border-pq-neutral-200 bg-white p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-pq-neutral-200 text-left space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-pq-warning-100 text-pq-warning-700 border border-pq-warning-200">
              <FlaskConical className="w-3.5 h-3.5" />
            </span>
            <DialogTitle className="text-base font-semibold text-pq-neutral-900">
              Justification required
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-pq-neutral-500">
            This is a <strong>raw material</strong> line. Awarding an{' '}
            {context?.verification === 'manual' ? 'unlinked manual entry' : 'unverified product'}
            {productHint} requires a written justification for audit.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-3">
          {context && (
            <div className="rounded-md border border-pq-neutral-200 bg-pq-neutral-50 px-3 py-2 text-xs text-pq-neutral-700 space-y-1">
              <div>
                <span className="font-semibold text-pq-neutral-500 uppercase tracking-wide text-[10px]">Item</span>{' '}
                {context.itemDescription}
              </div>
              <div>
                <span className="font-semibold text-pq-neutral-500 uppercase tracking-wide text-[10px]">Supplier</span>{' '}
                {context.supplierName}
              </div>
              <div className="flex items-center gap-1.5">
                <TriangleAlert className="w-3 h-3 text-pq-warning-700 shrink-0" />
                <span>{verificationLabel}</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
              Why are you awarding this quote despite the verification gap?
              <span className="text-pq-danger-600 ml-0.5">*</span>
            </label>
            <textarea
              rows={4}
              value={text}
              onChange={e => setText(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="e.g. Sole supplier with current stock; TSQA verification fast-tracked under reference …"
              className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] resize-none ${
                showError
                  ? 'border-pq-danger-300 bg-pq-danger-50'
                  : 'border-pq-neutral-200'
              }`}
              disabled={busy}
            />
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className={showError ? 'text-pq-danger-600' : 'text-pq-neutral-400'}>
                {showError
                  ? `Minimum ${QUOTE_JUSTIFICATION_MIN_LENGTH} characters required.`
                  : `Minimum ${QUOTE_JUSTIFICATION_MIN_LENGTH} characters.`}
              </span>
              <span className={tooShort ? 'text-pq-neutral-400' : 'text-pq-success-600'}>
                {trimmed.length} / {QUOTE_JUSTIFICATION_MIN_LENGTH}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-3 border-t border-pq-neutral-200 bg-pq-neutral-50 flex-row justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={busy}
            className="border-pq-neutral-200 text-pq-neutral-700 hover:bg-pq-neutral-100"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={busy || tooShort}
            className="bg-pq-primary-600 hover:bg-pq-neutral-900 text-white"
          >
            {busy ? 'Awarding…' : 'Award with justification'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
