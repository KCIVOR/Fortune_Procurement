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
}: FilterBarProps) {
  return (
    <div className={cn('bg-white rounded-lg border border-pq-neutral-200 shadow-sm overflow-hidden', className)}>
      {/* Header: Tabs */}
      {tabs && tabs.length > 0 && (
        <div className="flex items-center px-6 py-4 border-b border-pq-neutral-200 bg-pq-neutral-25">
          <div className="flex gap-1 -mb-4">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => onTabChange?.(tab.value)}
                  disabled={loading}
                  className={cn(
                    'relative px-4 py-2 text-sm font-medium transition-all',
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
      <div className="p-6">
        {/* Filters + Actions in One Row */}
        <div className="flex flex-col lg:flex-row gap-4 items-end">
          {/* Filters - Flexible Grid that adapts to filter count */}
          <div className={cn(
            'flex-1 grid gap-4',
            // Dynamic grid columns based on filter count
            filters.length === 1 && 'grid-cols-1',
            filters.length === 2 && 'grid-cols-1 sm:grid-cols-2',
            filters.length === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
            filters.length >= 4 && 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4',
          )}>
            {filters.map((filter) => (
              <FilterInput key={filter.id} filter={filter} loading={loading} />
            ))}
          </div>

          {/* Action Buttons - Aligned to Bottom */}
          <div className="flex gap-2 shrink-0">
            {onApply && (
              <Button
                type="button"
                onClick={onApply}
                disabled={loading}
                className="bg-pq-primary-600 hover:bg-pq-primary-700 text-white font-medium h-[42px] px-6"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Applying...
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
              className="text-pq-neutral-700 hover:text-pq-neutral-900 hover:bg-pq-neutral-50 font-medium h-[42px] px-6"
            >
              Clear All
            </Button>
          </div>
        </div>

        {/* Result Count - Below Filters */}
        {resultCount !== undefined && !loading && (
          <div className="mt-4 pt-4 border-t border-pq-neutral-200">
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
}: {
  filter: FilterConfig;
  loading: boolean;
}) {
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
              className="pl-9 h-[42px] text-sm"
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
            <SelectTrigger id={filter.id} className="h-[42px] text-sm">
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
            className="h-[42px] text-sm"
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
              className="h-[42px] text-sm"
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
              className="h-[42px] text-sm"
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
