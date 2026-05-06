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
        'px-6 py-4 border-b border-[#D8E2FF] bg-[#F7F9FC] flex items-center justify-between',
        className
      )}
    >
      {left}
      {right}
    </div>
  );
}

