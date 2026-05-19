import React from 'react';
import { cn } from '@/lib/utils';

export default function DetailCardHeader({
  left,
  right,
  className,
}: {
  left: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'px-6 py-4 border-b border-pq-neutral-200 bg-pq-neutral-50 flex items-center justify-between',
        className
      )}
    >
      {left}
      {right}
    </div>
  );
}

