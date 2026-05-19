'use client';

import { cn } from '@/lib/utils';

interface TypingIndicatorProps {
  /** Whether to show the indicator */
  isVisible: boolean;
  /** Name of the user who is typing */
  userName?: string;
  className?: string;
}

/**
 * Typing indicator placeholder.
 * Currently a visual-only component. Realtime presence integration
 * will be added in Phase 8 — this component is ready to receive
 * `isVisible` from a realtime subscription.
 */
export default function TypingIndicator({
  isVisible,
  userName,
  className,
}: TypingIndicatorProps) {
  if (!isVisible) return null;

  return (
    <div className={cn('flex items-center gap-2 px-4 py-2', className)}>
      {/* Animated dots */}
      <div className="flex items-center gap-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-pq-neutral-400 animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-pq-neutral-400 animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-pq-neutral-400 animate-bounce [animation-delay:300ms]" />
      </div>
      {userName && (
        <span className="text-xs text-pq-neutral-400">
          {userName} is typing...
        </span>
      )}
    </div>
  );
}
