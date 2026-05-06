import React from 'react';
import { cn } from '@/lib/utils';

export default function DetailInfoGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('p-6 grid grid-cols-2 md:grid-cols-3 gap-5', className)}>
      {children}
    </div>
  );
}

