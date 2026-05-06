'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import PaginationControls from '@/components/shared/PaginationControls';
import { useAuth } from '@/context/AuthContext';
import type { GRNListTab } from '@/lib/grn';
import { fetchGRNQueuePaged, fetchGRNTabCounts } from '@/lib/grn';
import type { GRNQueueRow, GRNStatus } from '@/types/grn';
import { GRN_STATUS_LABELS } from '@/types/grn';
import { format } from 'date-fns';
import { PackageCheck, Building2, Calendar, ChevronRight, Clock, CircleCheck as CheckCircle2, ClipboardList, Search } from 'lucide-react';
import { Label } from '@/components/ui/label';

const STATUS_CONFIG: Record<GRNStatus, {
  bg: string; text: string; border: string; icon: React.ElementType;
}> = {
  open:   { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   icon: Clock },
  closed: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle2 },
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

  const setFilterAndResetPage = (s: GRNListTab) => {
    setFilter(s);
    setCurrentPage(1);
  };

  if (!profile) {
    return (
      <AppShell title="Goods Receipt">
        <div className="flex items-center justify-center h-64">
          <LoadingState message="Loading GRNs..." />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Goods Receipt">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <PackageCheck className="w-5 h-5 text-[#40527A]" />
            <h1 className="text-xl font-bold text-[#0F1F3A]">Goods Receipt Notes</h1>
          </div>
          <p className="text-sm text-[#40527A]">Record and close incoming deliveries from suppliers.</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-[4px] p-4 text-sm text-red-700 mb-4">{error}</div>
      )}

      {/* Search filter */}
      <div className="bg-white rounded-[4px] border border-[#D8E2FF] p-4 mb-4">
        <Label htmlFor="grn-search" className="text-xs font-semibold text-[#40527A] uppercase tracking-wide block mb-1.5">
          Search
        </Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#BFC7D5]" />
            <input
              id="grn-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setAppliedSearch(search); setCurrentPage(1); } }}
              placeholder="GRN number, PO, supplier, department, warehouse…"
              disabled={loading}
              className="w-full pl-9 pr-3 py-2 border border-[#D8E2FF] rounded-[4px] text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] focus:border-transparent transition disabled:opacity-50"
            />
          </div>
          <button
            type="button"
            onClick={() => { setAppliedSearch(search); setCurrentPage(1); }}
            disabled={loading}
            className="px-3 py-2 bg-[#1E4BFF] hover:bg-[#0F1F3A] text-white text-xs font-semibold rounded-[4px] transition disabled:opacity-50 whitespace-nowrap"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => { setSearch(''); setAppliedSearch(''); setCurrentPage(1); }}
            disabled={loading}
            className="px-3 py-2 text-xs font-medium text-[#40527A] bg-[#F7F9FC] border border-[#D8E2FF] rounded-[4px] hover:bg-[#E5EAFF] disabled:opacity-50 transition whitespace-nowrap"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap mb-5">
        {(['all', 'open', 'closed'] as const).map(s => {
          const count  = counts[s];
          const active = filter === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setFilterAndResetPage(s)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-xs font-semibold border transition ${
                active
                  ? 'bg-[#0F1F3A] text-white border-[#0F1F3A]'
                  : 'bg-white text-[#40527A] border-[#D8E2FF] hover:border-[#0F1F3A] hover:bg-[#F7F9FC]'
              }`}
            >
              {s === 'all' ? 'All GRNs' : GRN_STATUS_LABELS[s]}
              <span className={`inline-flex items-center justify-center rounded-full text-xs min-w-[18px] h-[18px] px-1 ${
                active ? 'bg-white/20 text-white' : 'bg-[#F7F9FC] text-[#40527A]'
              }`}>{count}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <LoadingState message="Loading GRNs..." />
        </div>
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
              className="rounded-[4px] border border-[#D8E2FF]"
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
      <div className="bg-white border border-[#D8E2FF] rounded-[4px] p-5 hover:border-[#0F1F3A] transition flex items-center gap-4">
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${cfg.bg} border ${cfg.border}`}>
          <Icon className={`w-4 h-4 ${cfg.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="font-mono font-bold text-[#0F1F3A] text-sm">{g.grn_number}</span>
            <span className="text-xs text-[#BFC7D5] font-mono">PO {g.po_number_snapshot}</span>
            <span className={`inline-flex items-center gap-1 text-xs font-semibold border rounded-full px-2 py-0.5 ${cfg.bg} ${cfg.text} ${cfg.border}`}>
              <Icon className="w-3 h-3" />
              {GRN_STATUS_LABELS[g.status]}
            </span>
          </div>
          <p className="text-sm text-[#0F1F3A] font-medium truncate">{g.supplier_name_snapshot}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-[#BFC7D5] flex-wrap">
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
            <p className="text-xs text-emerald-600 font-medium">
              Closed {format(new Date(g.closed_at), 'MMM d, yyyy')}
            </p>
          ) : (
            <p className="text-xs text-amber-600 font-medium">Pending close</p>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-[#BFC7D5] flex-shrink-0 group-hover:text-[#40527A] transition" />
      </div>
    </Link>
  );
}
