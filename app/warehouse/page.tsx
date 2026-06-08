'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import { TableSkeleton } from '@/components/shared/structural-skeletons';
import PaginationControls from '@/components/shared/PaginationControls';
import {
  fetchWarehouseQueuePaged,
  fetchWarehouseQueueStatCounts,
} from '@/lib/warehouse';
import type { PR1QueueRow } from '@/types/warehouse';
import FilterBar from '@/components/shared/FilterBar';
import type { FilterConfig } from '@/components/shared/FilterBar.types';
import { StatCard } from '@/components/shared/StatCard';
import { KPI_GRID_CLASS } from '@/components/shared/kpi-grid';
import { PackageSearch, ClipboardCheck, Clock, CircleCheck as CheckCircle2, Circle as XCircle, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import PriorityChip from '@/components/shared/PriorityChip';

export default function WarehouseQueuePage() {
  const [queue, setQueue] = useState<PR1QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [statCounts, setStatCounts] = useState({
    pendingReview: 0,
    sufficient: 0,
    insufficient: 0,
  });

  useEffect(() => {
    setLoading(true);
    setError('');
    const offset = (currentPage - 1) * rowsPerPage;

    void (async () => {
      try {
        const stats = await fetchWarehouseQueueStatCounts();
        const page = await fetchWarehouseQueuePaged({
          limit:    rowsPerPage,
          offset,
          search:   appliedSearch.trim() || undefined,
          priority: selectedPriority,
        });
        setStatCounts(stats);
        setQueue(page.queue);
        setTotalCount(page.total_count);
      } catch (err) {
        console.error('Warehouse load error:', err);
        setError(
          (err as { message?: string })?.message ||
            'Failed to load queue.'
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [currentPage, rowsPerPage, appliedSearch, selectedPriority]);

  const totalPages = Math.ceil(totalCount / rowsPerPage);

  return (
    <AppShell title="Warehouse Queue">
      <PageHeader
        title="Warehouse Validation Queue"
        description="Review incoming purchase requests and validate stock availability."
      />

      <FilterBar
        filters={[
          {
            type: 'search',
            id: 'wh-search',
            label: 'Search',
            placeholder: 'Search PR1, requestor, department, or purpose...',
            value: search,
            onChange: (value) => setSearch(value as string),
          },
          {
            type: 'select',
            id: 'wh-priority',
            label: 'Priority',
            placeholder: 'All priorities',
            value: selectedPriority,
            onChange: (value) => {
              setSelectedPriority(value as string);
              setCurrentPage(1);
            },
            options: [
              { value: 'all', label: 'All Priorities' },
              { value: 'normal', label: 'Normal' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
            ],
          },
        ] as FilterConfig[]}
        onApply={() => { setAppliedSearch(search); setCurrentPage(1); }}
        onClear={() => { setSearch(''); setAppliedSearch(''); setSelectedPriority('all'); setCurrentPage(1); }}
        loading={loading}
        resultCount={totalCount}
        resultLabel="item"
        className="mb-4"
      />

      {loading ? (
        <TableSkeleton rows={5} cols={9} />
      ) : error ? (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">{error}</div>
      ) : totalCount === 0 ? (
        <div className="bg-white rounded-md border border-pq-neutral-200">
          <EmptyState
            title="No items pending validation"
            description={
              appliedSearch.trim() || selectedPriority !== 'all'
                ? 'No requests match your filters. Try adjusting search or priority.'
                : 'PR1s submitted by employees will appear here once routed to the warehouse.'
            }
            icon={PackageSearch}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {/* Stats row */}
          <div className={`${KPI_GRID_CLASS} mb-2`}>
            <StatCard
              label="Pending Review"
              value={statCounts.pendingReview}
              icon={<Clock className="w-5 h-5" />}
              accent="amber"
              isLoading={loading}
            />
            <StatCard
              label="Marked Sufficient"
              value={statCounts.sufficient}
              icon={<CheckCircle2 className="w-5 h-5" />}
              accent="green"
              isLoading={loading}
            />
            <StatCard
              label="Insufficient — Pending Approval"
              value={statCounts.insufficient}
              icon={<ArrowRight className="w-5 h-5" />}
              accent="blue"
              isLoading={loading}
            />
          </div>

          {/* Queue table */}
          <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pq-neutral-200 bg-pq-neutral-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">PR1 No.</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Requestor</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Department</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Purpose</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Priority</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Date Required</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Submitted</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Validation</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-pq-neutral-200">
                {queue.map((row) => (
                  <tr key={row.id} className="hover:bg-pq-neutral-50 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-semibold text-pq-neutral-900">{row.pr1_number}</td>
                    <td className="px-5 py-3.5 text-pq-neutral-900">{row.requisitioner_name_snapshot}</td>
                    <td className="px-5 py-3.5 text-pq-neutral-500">{row.department_name_snapshot}</td>
                    <td className="px-5 py-3.5 text-pq-neutral-500 max-w-[180px] truncate">{row.purpose || '—'}</td>
                    <td className="px-5 py-3.5">
                      <PriorityChip priority={row.priority || 'normal'} />
                    </td>
                    <td className="px-5 py-3.5 text-pq-neutral-500">
                      {row.date_required ? format(new Date(row.date_required), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-pq-neutral-500 text-xs">
                      {row.submitted_at ? format(new Date(row.submitted_at), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <ValidationBadge decision={row.validation_decision} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/warehouse/${row.id}`}
                        className="inline-flex items-center gap-1.5 text-pq-primary-600 hover:text-pq-primary-600 text-xs font-medium transition"
                      >
                        <ClipboardCheck className="w-3.5 h-3.5" />
                        {row.validation_decision ? 'Review' : 'Validate'}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          {totalCount > 0 && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={rowsPerPage}
              totalCount={totalCount}
              entityLabel="items"
              loading={loading}
              onPageChange={(page) => {
                if (page < currentPage) setCurrentPage((p) => Math.max(1, p - 1));
                else setCurrentPage((p) => p + 1);
              }}
              className="rounded-md border border-pq-neutral-200"
            />
          )}
        </div>
      )}
    </AppShell>
  );
}

function ValidationBadge({ decision }: { decision: string | null }) {
  if (!decision) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-pq-warning-600 bg-pq-warning-100 border border-pq-warning-100 rounded-full px-2.5 py-1">
        <span className="w-1.5 h-1.5 rounded-full bg-pq-warning-1000" />
        Pending
      </span>
    );
  }
  if (decision === 'sufficient') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-pq-success-600 bg-pq-success-100 border border-pq-success-100 rounded-full px-2.5 py-1">
        <CheckCircle2 className="w-3 h-3" />
        Sufficient
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-pq-primary-700 bg-pq-primary-50 border border-pq-primary-200 rounded-full px-2.5 py-1">
      <XCircle className="w-3 h-3" />
      Insufficient
    </span>
  );
}

