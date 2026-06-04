'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { FilterBarProps, FilterConfig } from './FilterBar.types';
import { Search, X } from 'lucide-react';

/**
 * Unified FilterBar Component - Enterprise Grade UI/UX
 * 
 * Best practices implemented:
 * - Tabs integrated with underline style (modern pattern)
 * - Inline action buttons (no scrolling needed)
 * - Flexible layout (adapts to filter count)
 * - Clear visual hierarchy
 * 
 * Design system compliant with procurement-design-system (2).html
 */
export default function FilterBar({
  tabs,
  activeTab,
  onTabChange,
  filters,
  onApply,
  onClear,
  loading = false,
  resultCount,
  resultLabel = 'results',
  className,
  compact = false,
}: FilterBarProps) {
  return (
    <div className={cn('bg-white rounded-lg border border-pq-neutral-200 shadow-sm overflow-hidden', className)}>
      {/* Header: Tabs */}
      {tabs && tabs.length > 0 && (
        <div className="flex items-center px-4 sm:px-6 py-4 border-b border-pq-neutral-200 bg-pq-neutral-25 overflow-x-auto scrollbar-hide">
          <div className="flex gap-1 -mb-4 min-w-max">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => onTabChange?.(tab.value)}
                  disabled={loading}
                  className={cn(
                    'relative px-4 py-2 text-sm font-medium transition-all whitespace-nowrap',
                    isActive
                      ? 'text-pq-primary-600'
                      : 'text-pq-neutral-600 hover:text-pq-neutral-900',
                    loading && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {tab.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-pq-primary-600" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter Container */}
      <div className={cn(compact ? 'p-3 sm:p-4' : 'p-4 sm:p-6')}>
        {/* Filters Grid */}
        <div className={cn(
          'w-full grid gap-3 mb-3',
          compact && 'sm:gap-4 sm:mb-4',
          !compact && 'gap-4 mb-4',
          // Dynamic grid columns based on filter count
          filters.length === 1 && 'grid-cols-1',
          filters.length === 2 && 'grid-cols-1 sm:grid-cols-2',
          filters.length === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
          filters.length >= 4 && 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4',
        )}>
          {filters.map((filter) => (
            <FilterInput key={filter.id} filter={filter} loading={loading} compact={compact} />
          ))}
        </div>

        {/* Action Buttons - Full width on mobile, auto on larger screens */}
        <div className="flex flex-col sm:flex-row gap-2 w-full">
          {onApply && (
            <Button
              type="button"
              onClick={onApply}
              disabled={loading}
              className={cn(
                'w-full sm:w-auto bg-pq-primary-600 hover:bg-pq-primary-700 active:bg-pq-primary-800 text-white font-medium px-8 rounded-md transition-colors',
                compact ? 'h-10' : 'h-12 sm:h-11',
              )}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Applying...</span>
                </span>
              ) : (
                'Apply'
              )}
            </Button>
          )}
          <Button
            type="button"
            onClick={onClear}
            disabled={loading}
            variant="outline"
            className={cn(
              'w-full sm:w-auto text-pq-neutral-700 hover:text-pq-neutral-900 hover:bg-pq-neutral-50 active:bg-pq-neutral-100 border-pq-neutral-200 font-medium px-8 rounded-md transition-colors',
              compact ? 'h-10' : 'h-12 sm:h-11',
            )}
          >
            Clear All
          </Button>
        </div>

        {/* Result Count - Below Filters */}
        {resultCount !== undefined && !loading && (
          <div className={cn('border-t border-pq-neutral-200', compact ? 'mt-3 pt-3' : 'mt-4 pt-4')}>
            <p className="text-sm text-pq-neutral-600">
              <span className="font-semibold text-pq-neutral-900">{resultCount}</span> {resultLabel}
              {resultCount !== 1 ? 's' : ''} found
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Individual Filter Input Component
 * Renders the appropriate input based on filter type
 */
function FilterInput({
  filter,
  loading,
  compact = false,
}: {
  filter: FilterConfig;
  loading: boolean;
  compact?: boolean;
}) {
  const inputHeight = compact ? 'h-10' : 'h-12 sm:h-11';
  const containerClass = cn(
    'space-y-1.5',
    filter.className
  );

  switch (filter.type) {
    case 'search':
      return (
        <div className={containerClass}>
          <Label htmlFor={filter.id} className="text-xs font-semibold text-pq-neutral-700 uppercase tracking-wider">
            {filter.label}
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pq-neutral-400 pointer-events-none" />
            <Input
              id={filter.id}
              type="search"
              value={filter.value as string}
              onChange={(e) => filter.onChange(e.target.value)}
              placeholder={filter.placeholder}
              disabled={loading}
              className={cn('pl-9 text-sm focus:ring-2 focus:ring-pq-primary-600', inputHeight)}
            />
          </div>
        </div>
      );

    case 'select':
      return (
        <div className={containerClass}>
          <Label htmlFor={filter.id} className="text-xs font-semibold text-pq-neutral-700 uppercase tracking-wider">
            {filter.label}
          </Label>
          <Select
            value={filter.value as string}
            onValueChange={(value) => filter.onChange(value)}
            disabled={loading || filter.disabled}
          >
            <SelectTrigger id={filter.id} className={cn('text-sm focus:ring-2 focus:ring-pq-primary-600', inputHeight)}>
              <SelectValue placeholder={filter.placeholder} />
            </SelectTrigger>
            <SelectContent>
              {filter.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );

    case 'date':
      return (
        <div className={containerClass}>
          <Label htmlFor={filter.id} className="text-xs font-semibold text-pq-neutral-700 uppercase tracking-wider">
            {filter.label}
          </Label>
          <Input
            id={filter.id}
            type="date"
            value={filter.value as string}
            onChange={(e) => filter.onChange(e.target.value)}
            disabled={loading || filter.disabled}
            className={cn('text-sm focus:ring-2 focus:ring-pq-primary-600', inputHeight)}
          />
        </div>
      );

    case 'dateRange':
      const [fromDate, toDate] = filter.value as [string, string];
      return (
        <>
          <div className={containerClass}>
            <Label htmlFor={`${filter.id}-from`} className="text-xs font-semibold text-pq-neutral-700 uppercase tracking-wider">
              {filter.label} From
            </Label>
            <Input
              id={`${filter.id}-from`}
              type="date"
              value={fromDate}
              onChange={(e) => filter.onChange([e.target.value, toDate])}
              disabled={loading || filter.disabled}
              className={cn('text-sm focus:ring-2 focus:ring-pq-primary-600', inputHeight)}
            />
          </div>
          <div className={containerClass}>
            <Label htmlFor={`${filter.id}-to`} className="text-xs font-semibold text-pq-neutral-700 uppercase tracking-wider">
              {filter.label} To
            </Label>
            <Input
              id={`${filter.id}-to`}
              type="date"
              value={toDate}
              onChange={(e) => filter.onChange([fromDate, e.target.value])}
              disabled={loading || filter.disabled}
              className={cn('text-sm focus:ring-2 focus:ring-pq-primary-600', inputHeight)}
            />
          </div>
        </>
      );

    case 'custom':
      return (
        <div className={containerClass}>
          {filter.renderCustom?.()}
        </div>
      );

    default:
      return null;
  }
}
