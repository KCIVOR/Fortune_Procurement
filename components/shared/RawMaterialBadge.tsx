'use client';

import { FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 4 (Raw Mats): visual indicator for line items classified as raw
 * materials. Used across PR1 detail/print, approval detail, warehouse
 * validation, canvassing, and (later phases) PR2/PO/GRN/delivery surfaces.
 *
 * Design intent:
 *  - Compact pill suitable for table cells and item-row headers.
 *  - Returns `null` when `isRawMaterial` is falsy so callers can drop it
 *    inline without wrapper conditionals.
 *  - `dim` variant softens the chip for monitoring views (e.g. read-only
 *    contexts where the row is not actionable).
 */
export interface RawMaterialBadgeProps {
  isRawMaterial?: boolean | null;
  /** Use a smaller/no-label variant inside tight cells. */
  size?: 'sm' | 'md';
  /** When `true` show only the icon (e.g. tight table cells). */
  iconOnly?: boolean;
  /** Subtle styling for read-only/monitoring views. */
  dim?: boolean;
  className?: string;
  /** Override the default tooltip copy. */
  title?: string;
}

const DEFAULT_TITLE =
  'Raw Material — used for production inputs (e.g. chemicals). Verified products are preferred; ' +
  'when offered with an unverified or manual-entry quote, procurement must record a written justification before awarding.';

export default function RawMaterialBadge({
  isRawMaterial,
  size = 'md',
  iconOnly = false,
  dim = false,
  className,
  title,
}: RawMaterialBadgeProps) {
  if (!isRawMaterial) return null;

  const colorClass = dim
    ? 'bg-pq-neutral-100 text-pq-neutral-600 border-pq-neutral-200'
    : 'bg-pq-primary-50 text-pq-primary-700 border-pq-primary-200';

  if (iconOnly) {
    return (
      <span
        title={title ?? DEFAULT_TITLE}
        className={cn(
          'inline-flex items-center justify-center rounded-md border align-middle',
          size === 'sm' ? 'w-5 h-5' : 'w-6 h-6',
          colorClass,
          className,
        )}
        aria-label="Raw material"
      >
        <FlaskConical className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      </span>
    );
  }

  return (
    <span
      title={title ?? DEFAULT_TITLE}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-semibold uppercase tracking-wide whitespace-nowrap align-middle',
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]',
        colorClass,
        className,
      )}
    >
      <FlaskConical className={size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
      Raw Mat.
    </span>
  );
}
