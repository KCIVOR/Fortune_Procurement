'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import PaginationControls from '@/components/shared/PaginationControls';
import FilterBar from '@/components/shared/FilterBar';
import type { FilterConfig, TabFilter } from '@/components/shared/FilterBar.types';
import { fetchSupplierInboxPaged, fetchSupplierInboxCounts } from '@/lib/canvassing';
import { useAuth } from '@/context/AuthContext';
import type { SupplierRfqInboxRow } from '@/types/canvassing';
import { Tag, ArrowRight, Clock, CircleCheck as CheckCircle2, PackageSearch, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { TableSkeleton } from '@/components/shared/structural-skeletons';

// ─── Types ────────────────────────────────────────────────────────────────────

type InboxTab = 'invited' | 'submitted' | 'declined';

const ROWS_PER_PAGE = 20;

const EMPTY_COUNTS = { invited: 0, submitted: 0, declined: 0, total: 0 };

const SUPPLIER_STATUS_BADGE: Record<string, string> = {
  invited:   'bg-pq-warning-100 text-pq-warning-600 border-pq-warning-100',
  submitted: 'bg-pq-success-100 text-pq-success-600 border-pq-success-100',
  declined:  'bg-pq-danger-100 text-pq-danger-600 border-pq-danger-100',
};
const SUPPLIER_STATUS_LABEL: Record<string, string> = {
  invited:   'Awaiting Response',
  submitted: 'Submitted',
  declined:  'Declined',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SupplierQuotationsPage() {
  const { profile } = useAuth();

  const [activeTab, setActiveTab]   = useState<InboxTab>('invited');
  const [currentPage, setCurrentPage] = useState(1);
  const [inbox, setInbox]           = useState<SupplierRfqInboxRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [search, setSearch]         = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [tabCounts, setTabCounts]   = useState<typeof EMPTY_COUNTS | null>(null);

  // Load global counts once on mount
  useEffect(() => {
    if (!profile) return;
    fetchSupplierInboxCounts(profile.id)
      .then(setTabCounts)
      .catch(() => {});
  }, [profile]);

  // Load current tab's data whenever tab / page / search changes
  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    setError('');
    const offset = (currentPage - 1) * ROWS_PER_PAGE;
    fetchSupplierInboxPaged(profile.id, {
      limit: ROWS_PER_PAGE,
      offset,
      statusFilter: activeTab,
    })
      .then(result => {
        setInbox(result.inbox);
        setTotalCount(result.total_count);
      })
      .catch(() => setError('Failed to load RFQ inbox.'))
      .finally(() => setLoading(false));
  }, [profile, activeTab, currentPage]);

  const counts     = tabCounts ?? EMPTY_COUNTS;
  const totalPages = Math.ceil(totalCount / ROWS_PER_PAGE);

  // Client-side search on current page results
  const visibleRows = appliedSearch.trim()
    ? inbox.filter(r =>
        r.rfq_number.toLowerCase().includes(appliedSearch.toLowerCase()) ||
        r.purpose.toLowerCase().includes(appliedSearch.toLowerCase()) ||
        r.department_name.toLowerCase().includes(appliedSearch.toLowerCase())
      )
    : inbox;

  const tabs: TabFilter[] = [
    { value: 'invited',   label: `Awaiting Response (${counts.invited})` },
    { value: 'submitted', label: `Submitted (${counts.submitted})` },
    { value: 'declined',  label: `Declined (${counts.declined})` },
  ];

  const filters: FilterConfig[] = [
    {
      type: 'search',
      id: 'rfq-search',
      label: 'Search',
      placeholder: 'Search by RFQ number, purpose, or department...',
      value: search,
      onChange: (value) => setSearch(value as string),
    },
  ];

  const handleTabChange = (value: string) => {
    setActiveTab(value as InboxTab);
    setCurrentPage(1);
    setSearch('');
    setAppliedSearch('');
  };

  const handleApply = () => {
    setAppliedSearch(search);
    setCurrentPage(1);
  };

  const handleClear = () => {
    setSearch('');
    setAppliedSearch('');
    setCurrentPage(1);
  };

  if (!profile) {
    return (
      <AppShell title="Quotations">
        <TableSkeleton rows={5} cols={6} />
      </AppShell>
    );
  }

  return (
    <AppShell title="Quotations">
      <PageHeader
        title="RFQ Inbox"
        description="Requests for quotation sent to your company. Submit your pricing for each open RFQ."
      />

      {/* KPI Cards — global counts, never page-scoped */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <StatCard label="Awaiting Response" value={counts.invited}   color="amber"   icon={Clock} />
        <StatCard label="Submitted"          value={counts.submitted} color="emerald" icon={CheckCircle2} />
        <StatCard label="Total RFQs"         value={counts.total}     color="slate"   icon={PackageSearch} />
      </div>

      {error && (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600 mb-4">{error}</div>
      )}

      <FilterBar
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        filters={filters}
        onApply={handleApply}
        onClear={handleClear}
        loading={loading}
        resultCount={totalCount}
        resultLabel="RFQ"
        className="mb-5"
      />

      {loading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : visibleRows.length === 0 ? (
        <div className="bg-white rounded-md border border-pq-neutral-200">
          <EmptyState
            icon={activeTab === 'declined' ? XCircle : Tag}
            title={
              activeTab === 'invited'   ? 'No RFQs awaiting response' :
              activeTab === 'submitted' ? 'No submitted quotes yet' :
                                          'No declined RFQs'
            }
            description={
              activeTab === 'invited'
                ? 'When procurement sends you an RFQ, it will appear here.'
                : activeTab === 'submitted'
                ? 'RFQs you have submitted quotes for will appear here.'
                : 'RFQs you declined will appear here.'
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-pq-neutral-200 bg-pq-neutral-50">
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">RFQ No.</th>
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Status</th>
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Purpose</th>
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Department</th>
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Items</th>
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Deadline</th>
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-pq-neutral-200">
                  {visibleRows.map(row => (
                    <InboxRow key={row.rfq_supplier_id} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalCount > 0 && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={ROWS_PER_PAGE}
              totalCount={totalCount}
              entityLabel="RFQs"
              loading={loading}
              onPageChange={(page) => {
                if (page < currentPage) setCurrentPage(p => Math.max(1, p - 1));
                else setCurrentPage(p => Math.min(totalPages, p + 1));
              }}
              className="rounded-md border border-pq-neutral-200"
            />
          )}
        </div>
      )}
    </AppShell>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function InboxRow({ row }: { row: SupplierRfqInboxRow }) {
  const canRespond = row.rfq_status === 'open' && row.supplier_status === 'invited';
  const hasPartial = row.quotes_submitted > 0 && row.quotes_submitted < row.item_count;

  return (
    <tr className="hover:bg-pq-neutral-50 transition">
      <td className="px-5 py-3.5 font-mono text-xs font-bold text-pq-neutral-900 whitespace-nowrap">{row.rfq_number}</td>
      <td className="px-5 py-3.5">
        <span className={`inline-flex items-center text-xs font-medium border rounded-full px-2 py-0.5 ${SUPPLIER_STATUS_BADGE[row.supplier_status]}`}>
          {SUPPLIER_STATUS_LABEL[row.supplier_status]}
        </span>
        {hasPartial && (
          <span className="ml-1 inline-flex items-center text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5">
            {row.quotes_submitted}/{row.item_count} quoted
          </span>
        )}
      </td>
      <td className="px-5 py-3.5 text-pq-neutral-500 max-w-[200px] truncate">{row.purpose}</td>
      <td className="px-5 py-3.5 text-pq-neutral-400 text-xs whitespace-nowrap">{row.department_name}</td>
      <td className="px-5 py-3.5 text-pq-neutral-400 text-xs whitespace-nowrap">{row.item_count} item{row.item_count !== 1 ? 's' : ''}</td>
      <td className="px-5 py-3.5 text-pq-neutral-400 text-xs whitespace-nowrap">
        {row.rfq_deadline ? format(new Date(row.rfq_deadline), 'MMM d, yyyy') : '—'}
      </td>
      <td className="px-5 py-3.5 text-right">
        {canRespond || row.supplier_status === 'submitted' ? (
          <Link
            href={`/supplier/quotations/${row.rfq_supplier_id}`}
            className={`inline-flex items-center gap-1 text-xs font-semibold transition ${
              canRespond ? 'text-pq-primary-600 hover:text-pq-neutral-900' : 'text-pq-neutral-500 hover:text-pq-neutral-900'
            }`}
          >
            {canRespond ? 'Submit Quote' : 'View Quote'}
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        ) : (
          <span className="text-xs text-pq-neutral-400">Closed</span>
        )}
      </td>
    </tr>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: number;
  color: 'amber' | 'emerald' | 'slate';
  icon: React.ElementType;
}) {
  const colorClass = {
    amber:   'text-pq-warning-600 bg-pq-warning-100',
    emerald: 'text-pq-success-600 bg-pq-success-100',
    slate:   'text-pq-neutral-500 bg-pq-neutral-50',
  }[color];

  return (
    <div className="bg-white rounded-md border border-pq-neutral-200 p-4">
      <div className={`inline-flex items-center justify-center w-9 h-9 rounded-md mb-3 ${colorClass}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-pq-neutral-900">{value}</p>
      <p className="text-xs text-pq-neutral-500 mt-0.5">{label}</p>
    </div>
  );
}
