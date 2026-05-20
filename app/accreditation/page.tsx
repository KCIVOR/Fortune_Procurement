'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import StatusChip from '@/components/shared/StatusChip';
import FilterBar from '@/components/shared/FilterBar';
import type { FilterConfig, TabFilter } from '@/components/shared/FilterBar.types';
import PaginationControls from '@/components/shared/PaginationControls';
import { Skeleton } from '@/components/ui/skeleton';
import type { StatusVariant } from '@/components/shared/StatusChip';
import { getAllAccreditationsForProcurement } from '@/lib/accreditation';
import type { AccreditationQueueRow } from '@/lib/accreditation';
import { format } from 'date-fns';
import { BadgeCheck, ArrowRight, AlertCircle } from 'lucide-react';

// ─── Status helpers ───────────────────────────────────────────────────────────

function accreditationChip(status: string): { variant: StatusVariant; label: string } {
  const map: Record<string, { variant: StatusVariant; label: string }> = {
    draft:             { variant: 'draft',     label: 'Draft' },
    submitted:         { variant: 'pending',   label: 'Submitted' },
    under_review:      { variant: 'in_review', label: 'Under Procurement Review' },
    missing_documents: { variant: 'pending',   label: 'Missing Documents Requested' },
    approved:          { variant: 'approved',  label: 'Accredited' },
    rejected:          { variant: 'rejected',  label: 'Rejected' },
    withdrawn:         { variant: 'cancelled', label: 'Withdrawn' },
  };
  return map[status] ?? { variant: 'draft', label: status };
}

// ─── Filter tab definitions ───────────────────────────────────────────────────

type FilterKey = 'pending' | 'approved' | 'rejected' | 'all';

const PENDING_STATUSES = ['submitted', 'under_review', 'missing_documents'];

const PAGE_SIZE = 20;

function getFilteredRows(rows: AccreditationQueueRow[], filter: FilterKey): AccreditationQueueRow[] {
  switch (filter) {
    case 'pending':
      return rows.filter(r => PENDING_STATUSES.includes(r.status));
    case 'approved':
      return rows.filter(r => r.status === 'approved');
    case 'rejected':
      return rows.filter(r => r.status === 'rejected');
    case 'all':
    default:
      return rows;
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AccreditationQueuePage() {
  const [allRows, setAllRows] = useState<AccreditationQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [activeTab, setActiveTab] = useState<FilterKey>('pending');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    setError('');
    getAllAccreditationsForProcurement()
      .then(setAllRows)
      .catch((err: unknown) =>
        setError((err as Error)?.message || 'Failed to load accreditation queue.')
      )
      .finally(() => setLoading(false));
  }, []);

  // Compute counts for tabs
  const counts = useMemo(() => ({
    pending:  allRows.filter(r => PENDING_STATUSES.includes(r.status)).length,
    approved: allRows.filter(r => r.status === 'approved').length,
    rejected: allRows.filter(r => r.status === 'rejected').length,
    all:      allRows.length,
  }), [allRows]);

  // Filter rows based on active tab and search
  const filteredRows = useMemo(() => {
    let rows = getFilteredRows(allRows, activeTab);
    if (appliedSearch.trim()) {
      const searchLower = appliedSearch.toLowerCase();
      rows = rows.filter(r =>
        (r.supplier_full_name && r.supplier_full_name.toLowerCase().includes(searchLower)) ||
        (r.supplier_email && r.supplier_email.toLowerCase().includes(searchLower))
      );
    }
    return rows;
  }, [allRows, activeTab, appliedSearch]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const paginatedRows = filteredRows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const tabs: TabFilter[] = [
    { value: 'pending',  label: `Pending (${counts.pending})` },
    { value: 'approved', label: `Approved (${counts.approved})` },
    { value: 'rejected', label: `Rejected (${counts.rejected})` },
    { value: 'all',      label: `All (${counts.all})` },
  ];

  const handleClear = () => {
    setSearch('');
    setAppliedSearch('');
    setActiveTab('pending');
    setCurrentPage(1);
  };

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, appliedSearch]);

  return (
    <AppShell title="Supplier Accreditation">
      <PageHeader
        title="Supplier Accreditation"
        description="Review and process supplier accreditation applications submitted for Procurement approval."
      />

      {/* FilterBar with tabs and search */}
      {!loading && !error && (
        <FilterBar
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(value) => setActiveTab(value as FilterKey)}
          filters={[
            {
              type: 'search',
              id: 'accreditation-search',
              label: 'Search',
              placeholder: 'Search by supplier name or email...',
              value: search,
              onChange: (value) => setSearch(value as string),
            },
          ] as FilterConfig[]}
          onApply={() => { setAppliedSearch(search); setCurrentPage(1); }}
          onClear={handleClear}
          loading={loading}
          resultCount={filteredRows.length}
          resultLabel="application"
          className="mb-4"
        />
      )}

      {loading ? (
        <AccreditationQueueSkeleton />
      ) : error ? (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">
          {error}
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="bg-white rounded-md border border-pq-neutral-200">
          <EmptyState
            title={activeTab === 'pending' ? 'No pending applications' : `No ${activeTab} applications`}
            description={
              activeTab === 'pending'
                ? 'Submitted supplier accreditation applications will appear here for review.'
                : 'No accreditation applications match this filter.'
            }
            icon={BadgeCheck}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
            {/* Column headers */}
            <div className="hidden md:grid grid-cols-[1fr_180px_140px_120px] gap-4 px-5 py-2.5 bg-pq-neutral-50 border-b border-pq-neutral-200">
              <p className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Supplier</p>
              <p className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Status</p>
              <p className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Submitted</p>
              <p className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Reviewed</p>
            </div>
            <div className="divide-y divide-pq-neutral-200">
              {paginatedRows.map(row => (
                <QueueRow key={row.id} row={row} />
              ))}
            </div>
          </div>

          {/* Pagination */}
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={PAGE_SIZE}
            totalCount={filteredRows.length}
            entityLabel="applications"
            loading={loading}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </AppShell>
  );
}

// ─── Queue row ────────────────────────────────────────────────────────────────

function QueueRow({ row }: { row: AccreditationQueueRow }) {
  const chip = accreditationChip(row.status);
  const isActionable = ['submitted', 'under_review', 'missing_documents'].includes(row.status);

  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-pq-neutral-50 transition">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="font-medium text-sm text-pq-neutral-900">
            {row.supplier_full_name ?? 'Unknown Supplier'}
          </span>
          {row.status === 'missing_documents' && (
            <span className="inline-flex items-center gap-1 text-xs text-pq-warning-600 bg-pq-warning-100 border border-pq-warning-100 rounded-full px-2 py-0.5">
              <AlertCircle className="w-3 h-3" />
              Action Required
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {row.supplier_email && (
            <span className="text-xs text-pq-neutral-400">{row.supplier_email}</span>
          )}
          {row.submitted_at && (
            <span className="text-xs text-pq-neutral-400">
              Submitted {format(new Date(row.submitted_at), 'MMM d, yyyy')}
            </span>
          )}
          {row.reviewed_at && (
            <span className="text-xs text-pq-neutral-400">
              Reviewed {format(new Date(row.reviewed_at), 'MMM d, yyyy')}
            </span>
          )}
        </div>
      </div>

      <div className="shrink-0 hidden sm:block">
        <StatusChip status={chip.variant} label={chip.label} size="sm" />
      </div>

      <Link
        href={`/accreditation/${row.id}`}
        className="shrink-0 flex items-center gap-1 text-xs font-semibold text-pq-neutral-500 hover:text-pq-neutral-900 transition"
      >
        {isActionable ? 'Review' : 'View'}
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}

// ─── Skeleton loading ─────────────────────────────────────────────────────────

function AccreditationQueueSkeleton() {
  return (
    <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden" aria-busy="true" aria-label="Loading accreditation queue">
      {/* Column headers skeleton */}
      <div className="hidden md:grid grid-cols-[1fr_180px_140px_120px] gap-4 px-5 py-2.5 bg-pq-neutral-50 border-b border-pq-neutral-200">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-18" />
      </div>
      {/* Row skeletons */}
      <div className="divide-y divide-pq-neutral-200">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            <div className="flex-1 min-w-0 space-y-2">
              <Skeleton className="h-4 w-48" />
              <div className="flex items-center gap-3">
                <Skeleton className="h-3 w-36" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
            <Skeleton className="h-6 w-32 rounded-full hidden sm:block" />
            <Skeleton className="h-4 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}
