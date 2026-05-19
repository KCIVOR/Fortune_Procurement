import { cn } from '@/lib/utils';

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      /* v2.0: Shifted from legacy HSL bg-muted to crisp neutral token bg-pq-neutral-200 */
      className={cn('animate-pulse rounded-md bg-pq-neutral-200', className)}
      {...props}
    />
  );
}

export { Skeleton };

