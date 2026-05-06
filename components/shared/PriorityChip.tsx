import React from 'react';
import { cn, getPriorityColors } from '@/lib/utils';

export default function PriorityChip({
  priority,
  className,
}: {
  priority?: string;
  className?: string;
}) {
  if (!priority) return null;

  const colors = getPriorityColors(priority);

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full text-xs font-medium px-2.5 py-1',
        colors.bg,
        colors.text,
        className
      )}
    >
      {colors.label}
    </span>
  );
}
