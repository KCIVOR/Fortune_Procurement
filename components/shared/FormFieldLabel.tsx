import React from 'react';
import { cn } from '@/lib/utils';

export function FormFieldLabel({
  label,
  required,
  className,
}: {
  label: React.ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={cn('text-xs font-semibold text-[#40527A] uppercase tracking-wide mb-1.5', className)}>
      {label}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );
}
