'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import StatusChip from '@/components/shared/StatusChip';
import StatusFilterTabs from '@/components/shared/StatusFilterTabs';
import { Skeleton } from '@/components/ui/skeleton';
import type { StatusVariant } from '@/components/shared/StatusChip';
import { getAllProductsForProcurement } from '@/lib/supplier-products';
import type { ProductQueueRow } from '@/lib/supplier-products';
import { format } from 'date-fns';
import { PackageSearch, ArrowRight } from 'lucide-react';

// ─── Status helpers ───────────────────────────────────────────────────────────

function productChip(status: string): { variant: StatusVariant; label: string } {
  const map: Record<string, { variant: StatusVariant; label: string }> = {
    draft:        { variant: 'draft',     label: 'Draft' },
    submitted:    { variant: 'pending',   label: 'Submitted' },
    under_review: { variant: 'in_review', label: 'Under Procurement Review' },
    pending_tsqa: { variant: 'in_review', label: 'Under Technical Evaluation' },
    verified:     { variant: 'validated', label: 'Verified' },
    rejected:     { variant: 'rejected',  label: 'Rejected' },
    inactive:     { variant: 'cancelled', label: 'Inactive' },
    withdrawn:    { variant: 'cancelled', label: 'Withdrawn' },
  };
  return map[status] ?? { variant: 'draft', label: status };
}

// ─── Filter tab definitions ───────────────────────────────────────────────────

type FilterKey = 'pending' | 'tsqa' | 'verified' | 'rejected' | 'all';

const PENDING_STATUSES = ['submitted', 'under_review'];

function getFilteredRows(rows: ProductQueueRow[], filter: FilterKey): ProductQueueRow[] {
  switch (filter) {
    case 'pending':
      return rows.filter(r => PENDING_STATUSES.includes(r.status));
    case 'tsqa':
      return rows.filter(r => r.status === 'pending_tsqa');
    case 'verified':
      return rows.filter(r => r.status === 'verified');
    case 'rejected':
      return rows.filter(r => r.status === 'rejected');
    case 'all':
    default:
      return rows;
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProductReviewQueuePage() {
  const [allRows, setAllRows] = useState<ProductQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [activeTab, setActiveTab] = useState<FilterKey>('pending');

  useEffect(() => {
    setLoading(true);
    setError('');
    getAllProductsForProcurement()
      .then(setAllRows)
      .catch((err: unknown) =>
        setError((err as Error)?.message || 'Failed to load product review queue.')
      )
      .finally(() => setLoading(false));
  }, []);

  // Compute counts for tabs
  const counts = useMemo(() => ({
    pending:  allRows.filter(r => PENDING_STATUSES.includes(r.status)).length,
    tsqa:     allRows.filter(r => r.status === 'pending_tsqa').length,
    verified: allRows.filter(r => r.status === 'verified').length,
    rejected: allRows.filter(r => r.status === 'rejected').length,
    all:      allRows.length,
  }), [allRows]);

  // Filter rows based on active tab
  const filteredRows = useMemo(
    () => getFilteredRows(allRows, activeTab),
    [allRows, activeTab]
  );

  const tabs = [
    { key: 'pending',  label: 'Pending',  count: counts.pending },
    { key: 'tsqa',     label: 'Under TSQA', count: counts.tsqa },
    { key: 'verified', label: 'Verified', count: counts.verified },
    { key: 'rejected', label: 'Rejected', count: counts.rejected },
    { key: 'all',      label: 'All',      count: counts.all },
  ];

  return (
    <AppShell title="Product Review">
      <PageHeader
        title="Supplier Product Review"
        description="Review products submitted by suppliers for procurement verification. Verify directly or create an RSE for TSQA evaluation."
      />

      {/* Status Filter Tabs */}
      {!loading && !error && (
        <div className="mb-4">
          <StatusFilterTabs
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={(key) => setActiveTab(key as FilterKey)}
          />
        </div>
      )}

      {loading ? (
        <ProductQueueSkeleton />
      ) : error ? (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">
          {error}
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="bg-white rounded-md border border-pq-neutral-200">
          <EmptyState
            title={activeTab === 'pending' ? 'No products pending review' : `No ${activeTab} products`}
            description={
              activeTab === 'pending'
                ? 'Supplier product submissions will appear here when they are ready for Procurement review.'
                : 'No products match this filter.'
            }
            icon={PackageSearch}
          />
        </div>
      ) : (
        <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
          {/* Column headers */}
          <div className="hidden md:grid grid-cols-[1fr_1fr_140px_120px] gap-4 px-5 py-2.5 bg-pq-neutral-50 border-b border-pq-neutral-200">
            <p className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Product</p>
            <p className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Supplier</p>
            <p className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Status</p>
            <p className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Submitted</p>
          </div>
          <div className="divide-y divide-pq-neutral-200">
            {filteredRows.map(row => (
              <ProductQueueRowItem key={row.id} row={row} />
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}

// ─── Product queue row ────────────────────────────────────────────────────────

function ProductQueueRowItem({ row }: { row: ProductQueueRow }) {
  const chip = productChip(row.status);
  const isActionable = ['submitted', 'under_review'].includes(row.status);

  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-pq-neutral-50 transition">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="font-medium text-sm text-pq-neutral-900 truncate">
            {row.product_name}
          </span>
          <StatusChip status={chip.variant} label={chip.label} size="sm" />
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {row.supplier_full_name && (
            <span className="text-xs text-pq-neutral-400">{row.supplier_full_name}</span>
          )}
          {row.product_code && (
            <span className="text-xs text-pq-neutral-400">#{row.product_code}</span>
          )}
          {row.category && (
            <span className="text-xs text-pq-neutral-400">{row.category}</span>
          )}
          {row.submitted_at && (
            <span className="text-xs text-pq-neutral-400">
              {format(new Date(row.submitted_at), 'MMM d, yyyy')}
            </span>
          )}
        </div>
      </div>

      <Link
        href={`/accreditation/products/${row.id}`}
        className="shrink-0 flex items-center gap-1 text-xs font-semibold text-pq-neutral-500 hover:text-pq-neutral-900 transition"
      >
        {isActionable ? 'Review' : 'View'}
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}

// ─── Skeleton loading ─────────────────────────────────────────────────────────

function ProductQueueSkeleton() {
  return (
    <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden" aria-busy="true" aria-label="Loading product queue">
      {/* Column headers skeleton */}
      <div className="hidden md:grid grid-cols-[1fr_1fr_140px_120px] gap-4 px-5 py-2.5 bg-pq-neutral-50 border-b border-pq-neutral-200">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-20" />
      </div>
      {/* Row skeletons */}
      <div className="divide-y divide-pq-neutral-200">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-5 w-28 rounded-full" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-4 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}
