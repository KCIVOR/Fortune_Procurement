import React from 'react';
import { cn } from '@/lib/utils';

export default function DetailCard({
  children,
  className,
  overflow,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  overflow?: boolean;
  title?: string;
}) {
  void title;
  return (
    <div
      className={cn(
        'bg-white rounded-md border border-pq-neutral-200',
        overflow ? 'overflow-hidden' : null,
        className
      )}
    >
      {children}
    </div>
  );
}

