import * as React from 'react';

import { cn } from '@/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        /* v2.0: Shifted from HSL variables to crisp neutral borders and premium primary focus shadow transitions */
        className={cn(
          'flex h-10 w-full rounded-md border border-pq-neutral-300 bg-pq-white px-3 py-2 text-sm text-pq-neutral-900 placeholder:text-pq-neutral-400 focus-visible:outline-none focus-visible:border-pq-primary-500 focus-visible:ring-2 focus-visible:ring-pq-primary-500/25 transition disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-pq-neutral-50 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-pq-neutral-900',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
