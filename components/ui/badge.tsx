import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-pq-primary-500/25 focus:ring-offset-2 focus:ring-offset-pq-white',
  {
    variants: {
      variant: {
        /* ── Legacy variants (preserved for backward compatibility) ───── */
        default:
          'border-transparent bg-pq-primary-600 text-pq-white hover:bg-pq-primary-700',
        secondary:
          'border-transparent bg-pq-neutral-100 text-pq-neutral-700 hover:bg-pq-neutral-150',
        destructive:
          'border-transparent bg-pq-danger-600 text-pq-white hover:bg-pq-danger-700',
        outline: 'border-pq-neutral-300 bg-pq-white text-pq-neutral-900',

        /* ── v2.0 Premium Semantic Variants (Light Mode ONLY) ─────────── */
        success:
          'border-transparent bg-pq-success-100 text-pq-success-600 hover:bg-pq-success-100/80',
        warning:
          'border-transparent bg-pq-warning-100 text-pq-warning-600 hover:bg-pq-warning-100/80',
        danger:
          'border-transparent bg-pq-danger-100 text-pq-danger-600 hover:bg-pq-danger-100/80',
        info:
          'border-transparent bg-pq-accent-100 text-pq-accent-600 hover:bg-pq-accent-100/80',
        neutral:
          'border-transparent bg-pq-neutral-100 text-pq-neutral-700 hover:bg-pq-neutral-150',
        primary:
          'border-transparent bg-pq-primary-100 text-pq-primary-600 hover:bg-pq-primary-200',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
