'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import { TableSkeleton } from '@/components/shared/structural-skeletons';
import StatusChip from '@/components/shared/StatusChip';
import FilterBar from '@/components/shared/FilterBar';
import type { FilterConfig } from '@/components/shared/FilterBar.types';
import PaginationControls from '@/components/shared/PaginationControls';
import type { StatusVariant } from '@/components/shared/StatusChip';
import { useAuth } from '@/context/AuthContext';
import { getRSEQueueForTSQA, getRSEHistoryForTSQA, type RSEQueueRow } from '@/lib/rse';
import { format } from 'date-fns';
import { FlaskConical, ArrowRight } from 'lucide-react';

// ─── Status helpers ───────────────────────────────────────────────────────────

function rseChip(status: string): { variant: StatusVariant; label: string } {
  const map: Record<string, { variant: StatusVariant; label: string }> = {
    created:      { variant: 'pending',   label: 'Created' },
    assigned:     { variant: 'pending',   label: 'Assigned' },
    under_review: { variant: 'in_review', label: 'Under Review' },
    passed:       { variant: 'approved',  label: 'Passed' },
    failed:       { variant: 'rejected',  label: 'Failed' },
    cancelled:    { variant: 'cancelled', label: 'Cancelled' },
  };
  return map[status] ?? { variant: 'draft', label: status };
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'created', label: 'Created' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'passed', label: 'Passed' },
  { value: 'failed', label: 'Failed' },
];

const PAGE_SIZE = 20;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TSQARSEQueuePage() {
  const { profile } = useAuth();
  const router      = useRouter();

  const [activeRows,    setActiveRows]    = useState<RSEQueueRow[]>([]);
  const [completedRows, setCompletedRows] = useState<RSEQueueRow[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');
  const [statusFilter,  setStatusFilter]  = useState('all');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (profile && profile.role !== 'tsqa' && profile.role !== 'admin') {
      router.replace('/dashboard');
      return;
    }
    if (!profile) return;

    setLoading(true);
    setError('');
    Promise.all([
      getRSEQueueForTSQA(profile),
      getRSEHistoryForTSQA(profile),
    ])
      .then(([active, completed]) => {
        setActiveRows(active);
        setCompletedRows(completed);
      })
      .catch((err: unknown) => setError((err as Error)?.message || 'Failed to load RSE queue.'))
      .finally(() => setLoading(false));
  }, [profile, router]);

  // Merge all rows and apply filters
  const allRows = [...activeRows, ...completedRows];
  const filtered = allRows.filter((r) => {
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesSearch = !appliedSearch.trim() ||
      (r.rse_number && r.rse_number.toLowerCase().includes(appliedSearch.toLowerCase())) ||
      (r.product_name && r.product_name.toLowerCase().includes(appliedSearch.toLowerCase())) ||
      (r.supplier_full_name && r.supplier_full_name.toLowerCase().includes(appliedSearch.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginatedRows = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const handleApply = () => {
    setAppliedSearch(search);
    setCurrentPage(1);
  };

  const handleClear = () => {
    setSearch('');
    setAppliedSearch('');
    setStatusFilter('all');
    setCurrentPage(1);
  };

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [appliedSearch, statusFilter]);

  return (
    <AppShell title="RSE Queue">
      <PageHeader
        title="RSE Queue"
        description="Sample evaluation requests assigned to you. Start review, submit test findings, and mark pass or fail."
      />

      {/* FilterBar */}
      <FilterBar
        filters={[
          {
            type: 'search',
            id: 'rse-search',
            label: 'Search',
            placeholder: 'Search by RSE number, product, or supplier...',
            value: search,
            onChange: (value) => setSearch(value as string),
          },
          {
            type: 'select',
            id: 'rse-status',
            label: 'Status',
            placeholder: 'All statuses',
            value: statusFilter,
            onChange: (value) => setStatusFilter(value as string),
            options: STATUS_OPTIONS,
          },
        ] as FilterConfig[]}
        onApply={handleApply}
        onClear={handleClear}
        loading={loading}
        resultCount={filtered.length}
        resultLabel="record"
        className="mb-4"
      />

      {loading ? (
        <TableSkeleton rows={5} cols={4} />
      ) : error ? (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-md border border-pq-neutral-200">
          <EmptyState
            title={statusFilter === 'all' ? 'No RSE records found' : `No ${statusFilter} records`}
            description={
              statusFilter === 'all'
                ? 'Procurement will assign RSE records when product/sample evaluation is required.'
                : 'Try selecting a different status filter.'
            }
            icon={FlaskConical}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-pq-neutral-200 bg-pq-neutral-50/50">
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">RSE No.</th>
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Status</th>
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Product</th>
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Supplier</th>
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Date</th>
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-pq-neutral-200">
                  {paginatedRows.map(row => (
                    <RSERow key={row.id} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={PAGE_SIZE}
            totalCount={filtered.length}
            entityLabel="records"
            loading={loading}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </AppShell>
  );
}

// ─── RSE row ─────────────────────────────────────────────────────────────────

function RSERow({ row }: { row: RSEQueueRow }) {
  const chip     = rseChip(row.status);
  const isActive = row.status === 'created' || row.status === 'assigned' || row.status === 'under_review';
  const dateStr  = row.completed_at
    ? format(new Date(row.completed_at), 'MMM d, yyyy')
    : row.assigned_at
    ? format(new Date(row.assigned_at), 'MMM d, yyyy')
    : format(new Date(row.created_at), 'MMM d, yyyy');

  return (
    <tr className="hover:bg-pq-neutral-50 transition">
      <td className="px-5 py-3.5 font-mono text-xs font-bold text-pq-neutral-900 whitespace-nowrap">
        {row.rse_number ?? row.id.slice(0, 8).toUpperCase()}
      </td>
      <td className="px-5 py-3.5">
        <StatusChip status={chip.variant} label={chip.label} size="sm" />
      </td>
      <td className="px-5 py-3.5 text-pq-neutral-900 max-w-[180px] truncate">{row.product_name ?? '—'}</td>
      <td className="px-5 py-3.5 text-pq-neutral-400 text-xs">{row.supplier_full_name ?? '—'}</td>
      <td className="px-5 py-3.5 text-pq-neutral-400 text-xs whitespace-nowrap">{dateStr}</td>
      <td className="px-5 py-3.5 text-right">
        <Link
          href={`/tsqa/rse/${row.id}`}
          className={`inline-flex items-center gap-1 text-xs font-semibold transition ${
            isActive ? 'text-pq-primary-600 hover:text-pq-neutral-900' : 'text-pq-neutral-500 hover:text-pq-neutral-900'
          }`}
        >
          {isActive ? 'Evaluate' : 'View'}
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </td>
    </tr>
  );
}
