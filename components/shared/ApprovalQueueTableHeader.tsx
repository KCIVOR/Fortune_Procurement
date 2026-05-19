import React from 'react';
import { cn } from '@/lib/utils';

export function ApprovalQueueHeaderRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <tr className={cn('border-b border-pq-neutral-200 bg-pq-neutral-50/50', className)}>
      {children}
    </tr>
  );
}

export function ApprovalQueueHeadCell({
  children,
  align = 'left',
  className,
}: {
  children?: React.ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
}) {
  const alignClass = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';

  return (
    <th
      className={cn(
        'px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide',
        alignClass,
        className
      )}
    >
      {children}
    </th>
  );
}

