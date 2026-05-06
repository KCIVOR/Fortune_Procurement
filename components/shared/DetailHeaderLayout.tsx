import React from 'react';
import { cn } from '@/lib/utils';

export default function DetailHeaderLayout({
  left,
  right,
  wrap,
  className,
}: {
  left: React.ReactNode;
  right?: React.ReactNode;
  wrap?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        wrap
          ? 'flex items-start justify-between mb-6 flex-wrap gap-3'
          : 'flex items-start justify-between mb-6',
        className
      )}
    >
      {left}
      {right}
    </div>
  );
}

