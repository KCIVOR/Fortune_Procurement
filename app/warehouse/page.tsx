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
import { PackageSearch, ClipboardCheck, Clock, CircleCheck as CheckCircle2, Circle as XCircle, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import PriorityChip from '@/components/shared/PriorityChip';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

      <div className="bg-white rounded-md border border-pq-neutral-200 p-4 grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="wh-search" className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
            Search
          </Label>
          <div className="flex gap-2">
            <input
              id="wh-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setAppliedSearch(search); setCurrentPage(1); } }}
              placeholder="Search PR1, requestor, department, or purpose..."
              disabled={loading}
              className="flex-1 px-3 py-2 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] focus:border-transparent transition disabled:opacity-50"
            />
            <button
              onClick={() => { setAppliedSearch(search); setCurrentPage(1); }}
              disabled={loading}
              className="px-3 py-2 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-xs font-semibold rounded-md transition disabled:opacity-50 whitespace-nowrap"
            >
              Apply
            </button>
            <button
              onClick={() => { setSearch(''); setAppliedSearch(''); setCurrentPage(1); }}
              disabled={loading}
              className="px-3 py-2 text-xs font-medium text-pq-neutral-500 bg-pq-neutral-50 border border-pq-neutral-200 rounded-md hover:bg-pq-neutral-200 disabled:opacity-50 transition whitespace-nowrap"
            >
              Clear
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wh-priority" className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
            Priority
          </Label>
          <Select
            value={selectedPriority}
            onValueChange={(v) => {
              setSelectedPriority(v);
              setCurrentPage(1);
            }}
            disabled={loading}
          >
            <SelectTrigger id="wh-priority" className="text-sm">
              <SelectValue placeholder="All priorities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-2">
            <StatCard
              label="Pending Review"
              value={statCounts.pendingReview}
              color="amber"
              icon={Clock}
            />
            <StatCard
              label="Marked Sufficient"
              value={statCounts.sufficient}
              color="emerald"
              icon={CheckCircle2}
            />
            <StatCard
              label="Insufficient — Pending Approval"
              value={statCounts.insufficient}
              color="blue"
              icon={ArrowRight}
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

function StatCard({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: number;
  color: 'amber' | 'emerald' | 'blue';
  icon: React.ElementType;
}) {
  const colors = {
    amber:   'bg-pq-warning-100 border-pq-warning-100 text-pq-warning-600',
    emerald: 'bg-pq-success-100 border-pq-success-100 text-pq-success-600',
    blue:    'bg-pq-primary-50 border-pq-primary-200 text-pq-primary-700',
  };
  const iconColors = {
    amber:   'text-amber-500',
    emerald: 'text-emerald-500',
    blue:    'text-pq-primary-600',
  };

  return (
    <div className={`rounded-md border px-5 py-4 flex items-center gap-4 ${colors[color]}`}>
      <Icon className={`w-5 h-5 shrink-0 ${iconColors[color]}`} />
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs font-medium opacity-80">{label}</p>
      </div>
    </div>
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

