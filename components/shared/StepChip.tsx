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
          'inline-flex items-center gap-1.5 text-xs font-medium text-[#0F1F3A] bg-[#F7F9FC] border border-[#D8E2FF] rounded-full px-2.5 py-1',
          className
        )}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#1E4BFF] animate-pulse" />
        {stepName}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium text-[#40527A] bg-[#F7F9FC] border border-[#D8E2FF] rounded-full px-2.5 py-1',
        className
      )}
    >
      <Lock className="w-3 h-3" />
      {stepName}
    </span>
  );
}
