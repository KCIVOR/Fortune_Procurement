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
        className="inline-flex items-center gap-1 text-xs text-[#40527A] hover:text-[#0F1F3A] transition"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        Back
      </button>
    </div>
  );
}

