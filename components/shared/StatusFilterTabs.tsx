'use client';

import { cn } from '@/lib/utils';

export interface StatusFilterTab {
  /** Unique key for the tab */
  key: string;
  /** Display label */
  label: string;
  /** Count of items (optional) */
  count?: number;
}

export interface StatusFilterTabsProps {
  /** Available tabs */
  tabs: StatusFilterTab[];
  /** Currently selected tab key */
  activeTab: string;
  /** Callback when tab changes */
  onTabChange: (key: string) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Horizontal status filter tabs component.
 * Used for filtering lists by status category.
 */
export default function StatusFilterTabs({
  tabs,
  activeTab,
  onTabChange,
  className,
}: StatusFilterTabsProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-1 p-1 bg-pq-neutral-100 rounded-lg w-fit',
        className
      )}
      role="tablist"
      aria-label="Filter by status"
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.key)}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-all',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-pq-primary-500 focus-visible:ring-offset-1',
              isActive
                ? 'bg-white text-pq-neutral-900 shadow-sm'
                : 'text-pq-neutral-500 hover:text-pq-neutral-700 hover:bg-pq-neutral-50'
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  'ml-1.5 px-1.5 py-0.5 text-xs rounded-full',
                  isActive
                    ? 'bg-pq-neutral-100 text-pq-neutral-600'
                    : 'bg-pq-neutral-200 text-pq-neutral-500'
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
