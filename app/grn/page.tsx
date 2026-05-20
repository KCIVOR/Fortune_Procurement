'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import { CardListSkeleton } from '@/components/shared/structural-skeletons';
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
import { PackageCheck, Building2, Calendar, ChevronRight, Clock, CircleCheck as CheckCircle2, ClipboardList } from 'lucide-react';

const STATUS_CONFIG: Record<GRNStatus, {
  bg: string; text: string; border: string; icon: React.ElementType;
}> = {
  open:   { bg: 'bg-pq-warning-100',   text: 'text-pq-warning-600',   border: 'border-pq-warning-100',   icon: Clock },
  closed: { bg: 'bg-pq-success-100', text: 'text-pq-success-600', border: 'border-pq-success-100', icon: CheckCircle2 },
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
    })
      .then((page) => {
        setGRNs(page.grns);
        setTotalCount(page.total_count);
      })
      .catch(() => setError('Failed to load GRNs.'))
      .finally(() => setLoading(false));
  }, [profile, filter, currentPage, rowsPerPage, appliedSearch]);

  const counts = tabCounts ?? { all: 0, open: 0, closed: 0 };

  const totalPages = Math.ceil(totalCount / rowsPerPage);

  // Tab configuration for FilterBar
  const tabs: TabFilter[] = [
    { value: 'all', label: `All GRNs (${counts.all})` },
    { value: 'open', label: `${GRN_STATUS_LABELS.open} (${counts.open})` },
    { value: 'closed', label: `${GRN_STATUS_LABELS.closed} (${counts.closed})` },
  ];

  // Filter configuration for FilterBar
  const filters: FilterConfig[] = [
    {
      type: 'search',
      id: 'grn-search',
      label: 'Search',
      placeholder: 'GRN number, PO, supplier, department, warehouse…',
      value: search,
      onChange: (value) => setSearch(value as string),
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
    setCurrentPage(1);
  };

  if (!profile) {
    return (
      <AppShell title="Goods Receipt">
        <CardListSkeleton cards={4} />
      </AppShell>
    );
  }

  return (
    <AppShell title="Goods Receipt">
      {/* Header */}
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

      {/* FilterBar with tabs */}
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
        <CardListSkeleton cards={4} />
      ) : totalCount === 0 ? (
        <EmptyState
          icon={PackageCheck}
          title="No goods receipts found"
          description={filter === 'all' && !appliedSearch.trim()
            ? 'GRNs will appear here once deliveries are marked as received.'
            : filter === 'all'
              ? 'No GRNs match your search. Try different keywords.'
              : `No ${GRN_STATUS_LABELS[filter as GRNStatus]?.toLowerCase() ?? ''} GRNs${appliedSearch.trim() ? ' for this search' : ''}.`}
        />
      ) : (
        <div className="space-y-4">
          <div className="space-y-3">
            {grns.map(g => <GRNCard key={g.id} grn={g} />)}
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

function GRNCard({ grn: g }: { grn: GRNQueueRow }) {
  const cfg  = STATUS_CONFIG[g.status];
  const Icon = cfg.icon;

  return (
    <Link href={`/grn/${g.id}`} className="block group">
      <div className="bg-white border border-pq-neutral-200 rounded-md p-5 hover:border-pq-primary-600 transition flex items-center gap-4">
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${cfg.bg} border ${cfg.border}`}>
          <Icon className={`w-4 h-4 ${cfg.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="font-mono font-bold text-pq-neutral-900 text-sm">{g.grn_number}</span>
            <span className="text-xs text-pq-neutral-400 font-mono">PO {g.po_number_snapshot}</span>
            <span className={`inline-flex items-center gap-1 text-xs font-semibold border rounded-full px-2 py-0.5 ${cfg.bg} ${cfg.text} ${cfg.border}`}>
              <Icon className="w-3 h-3" />
              {GRN_STATUS_LABELS[g.status]}
            </span>
          </div>
          <p className="text-sm text-pq-neutral-900 font-medium truncate">{g.supplier_name_snapshot}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-pq-neutral-400 flex-wrap">
            <span className="flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              {g.department_name_snapshot} · {g.warehouse}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {format(new Date(g.transaction_date), 'MMM d, yyyy')}
            </span>
            {g.received_by_name_snapshot && (
              <span className="flex items-center gap-1">
                <ClipboardList className="w-3 h-3" />
                {g.received_by_name_snapshot}
              </span>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          {g.closed_at ? (
            <p className="text-xs text-pq-success-600 font-medium">
              Closed {format(new Date(g.closed_at), 'MMM d, yyyy')}
            </p>
          ) : (
            <p className="text-xs text-pq-warning-600 font-medium">Pending close</p>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-pq-neutral-400 flex-shrink-0 group-hover:text-pq-neutral-500 transition" />
      </div>
    </Link>
  );
}
