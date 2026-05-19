'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

// ─── 1. TABLE SKELETON ──────────────────────────────────────────────────────
interface TableSkeletonProps {
  rows?: number;
  cols?: number;
  showHeader?: boolean;
  className?: string;
}

export function TableSkeleton({
  rows = 5,
  cols = 5,
  showHeader = true,
  className,
}: TableSkeletonProps) {
  return (
    <div
      className={cn('w-full border border-pq-neutral-200 rounded-lg bg-white overflow-hidden', className)}
      aria-busy="true"
      aria-label="Loading data table"
    >
      {showHeader && (
        <div className="flex gap-4 p-4 border-b border-pq-neutral-200 bg-pq-neutral-50">
          {Array.from({ length: cols }, (_, i) => (
            <Skeleton key={`head-${i}`} className="h-4 flex-1 bg-pq-neutral-200" />
          ))}
        </div>
      )}
      <div className="divide-y divide-pq-neutral-100">
        {Array.from({ length: rows }, (_, r) => (
          <div key={`row-${r}`} className="flex gap-4 p-4 items-center">
            {Array.from({ length: cols }, (_, c) => (
              <Skeleton key={`cell-${r}-${c}`} className="h-3.5 flex-1 bg-pq-neutral-150" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 2. DETAIL PAGE SKELETON ────────────────────────────────────────────────
interface DetailPageSkeletonProps {
  sections?: number;
  fieldsPerSection?: number;
  showHeader?: boolean;
  className?: string;
}

export function DetailPageSkeleton({
  sections = 2,
  fieldsPerSection = 4,
  showHeader = true,
  className,
}: DetailPageSkeletonProps) {
  return (
    <div
      className={cn('space-y-6', className)}
      aria-busy="true"
      aria-label="Loading detail page content"
    >
      {showHeader && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-48 bg-pq-neutral-200" />
          <Skeleton className="h-8 w-80 bg-pq-neutral-200" />
        </div>
      )}

      {/* Primary Detail Blocks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-6">
          {Array.from({ length: sections }, (_, s) => (
            <div key={`section-${s}`} className="border border-pq-neutral-200 rounded-xl bg-white p-5 space-y-4">
              <Skeleton className="h-5 w-40 bg-pq-neutral-200" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Array.from({ length: fieldsPerSection }, (_, f) => (
                  <div key={`field-${s}-${f}`} className="space-y-2">
                    <Skeleton className="h-3 w-20 bg-pq-neutral-200" />
                    <Skeleton className="h-4 w-44 bg-pq-neutral-150" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar Column */}
        <div className="space-y-6">
          <div className="border border-pq-neutral-200 rounded-xl bg-white p-5 space-y-4">
            <Skeleton className="h-5 w-32 bg-pq-neutral-200" />
            <div className="space-y-3">
              <Skeleton className="h-10 w-full bg-pq-neutral-150" />
              <Skeleton className="h-10 w-full bg-pq-neutral-150" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 3. DASHBOARD QUEUE SKELETON ───────────────────────────────────────────
interface DashboardQueueSkeletonProps {
  rows?: number;
  className?: string;
}

export function DashboardQueueSkeleton({
  rows = 3,
  className,
}: DashboardQueueSkeletonProps) {
  return (
    <div
      className={cn('divide-y divide-pq-neutral-200 bg-white rounded-lg', className)}
      aria-busy="true"
      aria-label="Loading queue"
    >
      {Array.from({ length: rows }, (_, i) => (
        <div key={`q-row-${i}`} className="flex items-center justify-between p-4 gap-4">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-28 bg-pq-neutral-200" />
            <Skeleton className="h-3 w-48 bg-pq-neutral-150" />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Skeleton className="h-6 w-16 rounded-full bg-pq-neutral-200" />
            <Skeleton className="h-6 w-6 rounded bg-pq-neutral-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── 4. FORM SKELETON ───────────────────────────────────────────────────────
interface FormSkeletonProps {
  sections?: number;
  fields?: number;
  className?: string;
}

export function FormSkeleton({
  sections = 1,
  fields = 4,
  className,
}: FormSkeletonProps) {
  return (
    <div
      className={cn('space-y-6 bg-white border border-pq-neutral-200 rounded-xl p-6', className)}
      aria-busy="true"
      aria-label="Loading form structure"
    >
      {Array.from({ length: sections }, (_, s) => (
        <div key={`form-sec-${s}`} className="space-y-4">
          <Skeleton className="h-5 w-36 bg-pq-neutral-200" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: fields }, (_, f) => (
              <div key={`form-field-${s}-${f}`} className="space-y-2">
                <Skeleton className="h-3.5 w-24 bg-pq-neutral-200" />
                <Skeleton className="h-10 w-full bg-pq-neutral-150 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="flex justify-end gap-2 pt-4 border-t border-pq-neutral-200">
        <Skeleton className="h-9 w-20 bg-pq-neutral-200" />
        <Skeleton className="h-9 w-28 bg-pq-neutral-200" />
      </div>
    </div>
  );
}

// ─── 5. CARD LIST SKELETON ──────────────────────────────────────────────────
interface CardListSkeletonProps {
  cards?: number;
  className?: string;
}

export function CardListSkeleton({
  cards = 4,
  className,
}: CardListSkeletonProps) {
  return (
    <div
      className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4', className)}
      aria-busy="true"
      aria-label="Loading list"
    >
      {Array.from({ length: cards }, (_, i) => (
        <div key={`card-${i}`} className="border border-pq-neutral-200 rounded-xl bg-white p-5 space-y-4">
          <div className="flex justify-between items-start">
            <Skeleton className="h-5 w-24 bg-pq-neutral-200" />
            <Skeleton className="h-8 w-8 rounded-full bg-pq-neutral-200" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-40 bg-pq-neutral-150" />
            <Skeleton className="h-3 w-28 bg-pq-neutral-150" />
          </div>
          <div className="pt-2 border-t border-pq-neutral-100 flex justify-between items-center">
            <Skeleton className="h-3.5 w-16 bg-pq-neutral-200" />
            <Skeleton className="h-6 w-20 rounded-full bg-pq-neutral-200" />
          </div>
        </div>
      ))}
    </div>
  );
}
