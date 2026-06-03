/**
 * Unified count badge component for notifications, messages, and other counts.
 * Displays a small rounded badge with a count number.
 */
interface CountBadgeProps {
  count: number;
  maxCount?: number;
  className?: string;
}

export default function CountBadge({ 
  count, 
  maxCount = 99,
  className = '' 
}: CountBadgeProps) {
  if (count <= 0) return null;

  const displayCount = count > maxCount ? `${maxCount}+` : count;

  return (
    <span 
      className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-pq-danger-600 text-white text-[10px] font-bold leading-none px-1 pointer-events-none border-2 border-white shadow-sm ${className}`}
      aria-label={`${count} unread`}
    >
      {displayCount}
    </span>
  );
}
