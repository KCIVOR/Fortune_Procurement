import React from 'react';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function StepChip({
  stepName,
  canAct,
  className,
}: {
  stepName?: string;
  canAct?: boolean;
  className?: string;
}) {
  if (!stepName) return null;

  if (canAct) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 text-xs font-medium text-pq-neutral-900 bg-pq-neutral-50 border border-pq-neutral-200 rounded-full px-2.5 py-1',
          className
        )}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-pq-primary-600 animate-pulse" />
        {stepName}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium text-pq-neutral-500 bg-pq-neutral-50 border border-pq-neutral-200 rounded-full px-2.5 py-1',
        className
      )}
    >
      <Lock className="w-3 h-3" />
      {stepName}
    </span>
  );
}
