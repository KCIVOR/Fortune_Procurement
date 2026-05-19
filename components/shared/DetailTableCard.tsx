import React from 'react';
import { cn } from '@/lib/utils';

export default function DetailTableCard({
  title,
  right,
  children,
  className,
  headerClassName,
}: {
  title?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
}) {
  const hasHeader = title !== undefined || right !== undefined;

  return (
    <div
      className={cn(
        'bg-white rounded-md border border-pq-neutral-200 overflow-hidden',
        className
      )}
    >
      {hasHeader && (
        <div
          className={cn(
            'px-6 py-4 border-b border-pq-neutral-200 flex items-center justify-between',
            headerClassName
          )}
        >
          {title}
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

