import React from 'react';
import { cn } from '@/lib/utils';

export default function DetailTitleRow({
  children,
  wrap,
  mb,
  className,
}: {
  children: React.ReactNode;
  wrap?: boolean;
  mb?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3',
        wrap ? 'flex-wrap' : null,
        mb ? 'mb-1' : null,
        className
      )}
    >
      {children}
    </div>
  );
}

