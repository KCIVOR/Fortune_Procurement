import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pq-primary-500/25 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        /* ── Legacy variants (preserved for backward compatibility) ───── */
        default: 'bg-pq-primary-600 text-pq-white hover:bg-pq-primary-700',
        destructive:
          'bg-pq-danger-600 text-pq-white hover:bg-pq-danger-700',
        outline:
          'border border-pq-neutral-300 bg-pq-white text-pq-neutral-700 hover:bg-pq-neutral-50 hover:text-pq-neutral-900',
        secondary:
          'bg-pq-neutral-100 text-pq-neutral-700 hover:bg-pq-neutral-150',
        ghost: 'text-pq-neutral-700 hover:bg-pq-neutral-100 hover:text-pq-neutral-900',
        link: 'text-pq-primary-600 underline-offset-4 hover:text-pq-primary-700 hover:underline',

        /* ── v2.0 Premium Button Variants (Light Mode ONLY) ───────────── */
        subtle:
          'border border-transparent bg-pq-primary-50 text-pq-primary-600 hover:bg-pq-primary-100',
        'outline-primary':
          'border border-pq-primary-300 bg-pq-white text-pq-primary-600 hover:bg-pq-primary-50 focus-visible:ring-pq-primary-500/25',
        success:
          'border border-transparent bg-pq-success-600 text-pq-white hover:bg-pq-success-700 focus-visible:ring-pq-success-500/25',
        warning:
          'border border-transparent bg-pq-warning-600 text-pq-white hover:bg-pq-warning-700 focus-visible:ring-pq-warning-500/25',
        danger:
          'border border-transparent bg-pq-danger-600 text-pq-white hover:bg-pq-danger-700 focus-visible:ring-pq-danger-500/25',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        xl: 'h-12 rounded-md px-10 text-base', /* Added premium size */
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
