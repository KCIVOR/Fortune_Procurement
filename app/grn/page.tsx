'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import { TableSkeleton } from '@/components/shared/structural-skeletons';
import EmptyState from '@/components/shared/EmptyState';
import PaginationControls from '@/components/shared/PaginationControls';
import FilterBar from '@/components/shared/FilterBar';
import type { FilterConfig, TabFilter } from '@/components/shared/FilterBar.types';
import { useAuth } from '@/context/AuthContext';
import type { GRNListTab } from '@/lib/grn';
import { fetchGRNQueuePaged, fetchGRNTabCounts } from '@/lib/grn';
import type { GRNQueueRow, GRNStatus } from '@/types/grn';
import { GRN_STATUS_LABELS } from '@/types/grn';
import { format } from 'date-fns';
import { PackageCheck, Clock, CircleCheck as CheckCircle2, ExternalLink } from 'lucide-react';
import { RequestTypeBadge } from '@/components/shared/RequestTypeBadge';
import PriorityChip from '@/components/shared/PriorityChip';

const STATUS_STYLES: Record<GRNStatus, string> = {
  open:   'bg-pq-warning-100 text-pq-warning-600 border-pq-warning-100',
  closed: 'bg-pq-success-100 text-pq-success-600 border-pq-success-100',
};

const STATUS_ICONS: Record<GRNStatus, React.ElementType> = {
  open:   Clock,
  closed: CheckCircle2,
};

export default function GRNListPage() {
  const { profile } = useAuth();
  const [grns, setGRNs]       = useState<GRNQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [filter, setFilter]   = useState<GRNListTab>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [tabCounts, setTabCounts] = useState<Record<GRNListTab, number> | null>(null);
  const [search, setSearch]               = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('all');

  useEffect(() => {
    if (!profile) return;
    fetchGRNTabCounts()
      .then(setTabCounts)
      .catch(() => {});
  }, [profile]);

  useEffect(() => {
    if (!profile) return;

    setLoading(true);
    setError('');
    const offset = (currentPage - 1) * rowsPerPage;

    fetchGRNQueuePaged({
      statusFilter: filter,
      limit: rowsPerPage,
      offset,
      search: appliedSearch.trim() || undefined,
      priority: selectedPriority,
    })
      .then((page) => {
        setGRNs(page.grns);
        setTotalCount(page.total_count);
      })
      .catch(() => setError('Failed to load GRNs.'))
      .finally(() => setLoading(false));
  }, [profile, filter, currentPage, rowsPerPage, appliedSearch, selectedPriority]);

  const counts = tabCounts ?? { all: 0, open: 0, closed: 0 };
  const totalPages = Math.ceil(totalCount / rowsPerPage);

  const tabs: TabFilter[] = [
    { value: 'all',    label: `All GRNs (${counts.all})` },
    { value: 'open',   label: `${GRN_STATUS_LABELS.open} (${counts.open})` },
    { value: 'closed', label: `${GRN_STATUS_LABELS.closed} (${counts.closed})` },
  ];

  const filters: FilterConfig[] = [
    {
      type: 'search',
      id: 'grn-search',
      label: 'Search',
      placeholder: 'GRN number, PO, supplier, department, warehouse…',
      value: search,
      onChange: (value) => setSearch(value as string),
    },
    {
      type: 'select',
      id: 'grn-priority',
      label: 'Priority',
      placeholder: 'All priorities',
      value: selectedPriority,
      onChange: (value) => {
        setSelectedPriority(value as string);
        setCurrentPage(1);
      },
      options: [
        { value: 'all',    label: 'All Priorities' },
        { value: 'normal', label: 'Normal' },
        { value: 'medium', label: 'Medium' },
        { value: 'high',   label: 'High' },
      ],
    },
  ];

  const handleTabChange = (value: string) => {
    setFilter(value as GRNListTab);
    setCurrentPage(1);
  };

  const handleApply = () => {
    setAppliedSearch(search);
    setCurrentPage(1);
  };

  const handleClear = () => {
    setSearch('');
    setAppliedSearch('');
    setFilter('all');
    setSelectedPriority('all');
    setCurrentPage(1);
  };

  if (!profile) {
    return (
      <AppShell title="Goods Receipt">
        <TableSkeleton rows={5} cols={7} />
      </AppShell>
    );
  }

  return (
    <AppShell title="Goods Receipt">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <PackageCheck className="w-5 h-5 text-pq-neutral-500" />
            <h1 className="text-xl font-bold text-pq-neutral-900">Goods Receipt Notes</h1>
          </div>
          <p className="text-sm text-pq-neutral-500">Record and close incoming deliveries from suppliers.</p>
        </div>
      </div>

      {error && (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600 mb-4">{error}</div>
      )}

      <FilterBar
        tabs={tabs}
        activeTab={filter}
        onTabChange={handleTabChange}
        filters={filters}
        onApply={handleApply}
        onClear={handleClear}
        loading={loading}
        resultCount={totalCount}
        resultLabel="GRN"
        className="mb-5"
      />

      {loading ? (
        <TableSkeleton rows={5} cols={7} />
      ) : totalCount === 0 ? (
        <div className="bg-white rounded-md border border-pq-neutral-200">
          <EmptyState
            icon={PackageCheck}
            title="No goods receipts found"
            description={filter === 'all' && !appliedSearch.trim()
              ? 'GRNs will appear here once deliveries are marked as received.'
              : filter === 'all'
                ? 'No GRNs match your search. Try different keywords.'
                : `No ${GRN_STATUS_LABELS[filter as GRNStatus]?.toLowerCase() ?? ''} GRNs${appliedSearch.trim() ? ' for this search' : ''}.`}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-pq-neutral-200 bg-pq-neutral-50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">GRN No.</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">PO Ref</th>
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-center">Type</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Supplier</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Department</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Warehouse</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Date</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Received By</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Priority</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Status</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-pq-neutral-200">
                  {grns.map(g => {
                    const Icon = STATUS_ICONS[g.status];
                    return (
                      <tr key={g.id} className="hover:bg-pq-neutral-50 transition-colors">
                        <td className="px-5 py-3.5 font-mono font-semibold text-pq-neutral-900">{g.grn_number}</td>
                        <td className="px-5 py-3.5 font-mono text-xs text-pq-neutral-500">{g.po_number_snapshot}</td>
                        <td className="px-5 py-3.5 text-center">
                          <RequestTypeBadge type={g.request_type ?? 'goods'} />
                        </td>
                        <td className="px-5 py-3.5 text-pq-neutral-900">{g.supplier_name_snapshot}</td>
                        <td className="px-5 py-3.5 text-pq-neutral-500">{g.department_name_snapshot}</td>
                        <td className="px-5 py-3.5 text-pq-neutral-500">{g.warehouse}</td>
                        <td className="px-5 py-3.5 text-pq-neutral-500 text-xs">
                          {format(new Date(g.transaction_date), 'MMM d, yyyy')}
                        </td>
                        <td className="px-5 py-3.5 text-pq-neutral-500 text-xs">
                          {g.received_by_name_snapshot || '—'}
                        </td>
                        <td className="px-5 py-3.5"><PriorityChip priority={g.priority ?? 'normal'} /></td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold border rounded-full px-2.5 py-0.5 ${STATUS_STYLES[g.status]}`}>
                            <Icon className="w-3 h-3" />
                            {GRN_STATUS_LABELS[g.status]}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Link
                            href={`/grn/${g.id}`}
                            className="inline-flex items-center gap-1.5 text-pq-primary-600 hover:text-pq-primary-700 text-xs font-medium transition"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            {g.status === 'open' ? 'Close GRN' : 'View'}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
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
              entityLabel="GRNs"
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
