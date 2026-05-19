import React from 'react';
import { cn } from '@/lib/utils';

export default function DetailWideInfoRow({
  label,
  children,
  className,
  valueClassName,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={cn('col-span-2 md:col-span-3', className)}>
      <div className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1">
        {label}
      </div>
      <div className={cn('text-sm text-pq-neutral-900', valueClassName)}>{children}</div>
    </div>
  );
}
