import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function DetailBackButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <div className={cn(className)}>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 text-xs text-pq-neutral-500 hover:text-pq-neutral-900 transition"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        Back
      </button>
    </div>
  );
}

