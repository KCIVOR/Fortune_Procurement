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
      <div className="text-xs font-semibold text-[#40527A] uppercase tracking-wide mb-1">
        {label}
      </div>
      <div className={cn('text-sm text-[#0F1F3A]', valueClassName)}>{children}</div>
    </div>
  );
}
