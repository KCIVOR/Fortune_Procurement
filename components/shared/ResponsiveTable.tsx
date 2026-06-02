import React from 'react';
import { cn } from '@/lib/utils';

interface ResponsiveTableProps {
  children: React.ReactNode;
  mobileView?: React.ReactNode;
  className?: string;
}

/**
 * ResponsiveTable - Wrapper component for tables with mobile optimization
 * 
 * Usage:
 * <ResponsiveTable
 *   mobileView={<MobileCardLayout />}
 * >
 *   <table>...</table>
 * </ResponsiveTable>
 * 
 * If mobileView is not provided, table will use horizontal scroll on mobile
 */
export default function ResponsiveTable({
  children,
  mobileView,
  className,
}: ResponsiveTableProps) {
  if (mobileView) {
    return (
      <>
        {/* Desktop: Table */}
        <div className={cn('hidden md:block', className)}>
          <div className="overflow-x-auto">
            {children}
          </div>
        </div>

        {/* Mobile: Card Layout */}
        <div className="md:hidden">
          {mobileView}
        </div>
      </>
    );
  }

  // Fallback: horizontal scroll on mobile
  return (
    <div className={cn('overflow-x-auto', className)}>
      {children}
    </div>
  );
}
