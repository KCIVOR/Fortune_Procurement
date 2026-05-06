import React from 'react';
import { cn } from '@/lib/utils';

export default function DetailCard({
  children,
  className,
  overflow,
}: {
  children: React.ReactNode;
  className?: string;
  overflow?: boolean;
}) {
  return (
    <div
      className={cn(
        'bg-white rounded-[4px] border border-[#D8E2FF]',
        overflow ? 'overflow-hidden' : null,
        className
      )}
    >
      {children}
    </div>
  );
}

