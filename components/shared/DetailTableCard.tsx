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
        'bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden',
        className
      )}
    >
      {hasHeader && (
        <div
          className={cn(
            'px-6 py-4 border-b border-[#D8E2FF] flex items-center justify-between',
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

