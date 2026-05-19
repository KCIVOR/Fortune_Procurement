'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import { CardListSkeleton } from '@/components/shared/structural-skeletons';
import EmptyState from '@/components/shared/EmptyState';
import PaginationControls from '@/components/shared/PaginationControls';
import { useAuth } from '@/context/AuthContext';
import type { DeliveryListTab } from '@/lib/delivery';
import {
  fetchDeliveryQueuePaged,
  fetchDeliveryTabCounts,
} from '@/lib/delivery';
import type { Delivery, DeliveryStatus } from '@/types/delivery';
import { DELIVERY_STATUS_LABELS } from '@/types/delivery';
import { format } from 'date-fns';
import { Truck, Package, Calendar, Building2, ChevronRight, Clock, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, Navigation, Ban, Search } from 'lucide-react';
import { Label } from '@/components/ui/label';

const STATUS_CONFIG: Record<DeliveryStatus, {
  label: string;
  bg: string;
  text: string;
  border: string;
  icon: React.ElementType;
}> = {
  pending:    { label: 'Pending',    bg: 'bg-pq-neutral-50',   text: 'text-pq-neutral-500',   border: 'border-pq-neutral-200',   icon: Clock },
  scheduled:  { label: 'Scheduled', bg: 'bg-pq-primary-50',    text: 'text-pq-primary-700',    border: 'border-pq-primary-200',    icon: Calendar },
  in_transit: { label: 'In Transit',bg: 'bg-pq-warning-100',   text: 'text-pq-warning-600',   border: 'border-pq-warning-100',   icon: Navigation },
  delayed:    { label: 'Delayed',   bg: 'bg-pq-danger-100',     text: 'text-pq-danger-600',     border: 'border-pq-danger-100',     icon: AlertTriangle },
  delivered:  { label: 'Delivered', bg: 'bg-pq-success-100', text: 'text-pq-success-600', border: 'border-pq-success-100', icon: CheckCircle2 },
  cancelled:  { label: 'Cancelled', bg: 'bg-pq-neutral-50',  text: 'text-pq-neutral-500',   border: 'border-pq-neutral-200',   icon: Ban },
};

const EMPTY_TAB_COUNTS: Record<DeliveryListTab, number> = {
  all: 0,
  pending: 0,
  scheduled: 0,
  in_transit: 0,
  delayed: 0,
  delivered: 0,
};

export default function DeliveryQueuePage() {
  const { profile } = useAuth();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [filter, setFilter]         = useState<DeliveryListTab>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [tabCounts, setTabCounts] = useState<Record<DeliveryListTab, number> | null>(null);
  const [search, setSearch]               = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  const isEmployee = profile?.role === 'employee';

  useEffect(() => {
    if (!profile) return;
    const mode = isEmployee ? 'employee' : 'procurement';
    fetchDeliveryTabCounts({
      mode,
      requisitionerId: isEmployee ? profile.id : undefined,
      requisitionerName: isEmployee ? profile.full_name : undefined,
    })
      .then(setTabCounts)
      .catch(() => {});
  }, [profile, isEmployee]);

  useEffect(() => {
    if (!profile) return;

    setLoading(true);
    setError('');
    const offset = (currentPage - 1) * rowsPerPage;
    const mode = isEmployee ? 'employee' : 'procurement';

    fetchDeliveryQueuePaged({
      mode,
      requisitionerId: isEmployee ? profile.id : undefined,
      requisitionerName: isEmployee ? profile.full_name : undefined,
      statusTab: filter,
      limit: rowsPerPage,
      offset,
      search: appliedSearch.trim() || undefined,
    })
      .then((page) => {
        setDeliveries(page.deliveries);
        setTotalCount(page.total_count);
      })
      .catch(() => setError('Failed to load deliveries.'))
      .finally(() => setLoading(false));
  }, [profile, isEmployee, filter, currentPage, rowsPerPage, appliedSearch]);

  const counts = tabCounts ?? EMPTY_TAB_COUNTS;

  const totalPages = Math.ceil(totalCount / rowsPerPage);

  const setFilterAndResetPage = (s: DeliveryListTab) => {
    setFilter(s);
    setCurrentPage(1);
  };

  if (!profile) {
    return (
      <AppShell title="Delivery Tracking">
        <CardListSkeleton cards={4} />
      </AppShell>
    );
  }

  return (
    <AppShell title="Delivery Tracking">
      {/* Page header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Truck className="w-5 h-5 text-pq-neutral-500" />
            <h1 className="text-xl font-bold text-pq-neutral-900">
              {isEmployee ? 'My Delivery Status' : 'Delivery Tracking'}
            </h1>
          </div>
          <p className="text-sm text-pq-neutral-500">
            {isEmployee
              ? 'Track delivery progress for your purchase requisitions.'
              : 'Monitor all active and completed deliveries.'}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600 mb-4">
          {error}
        </div>
      )}

      {/* Search filter */}
      <div className="bg-white rounded-md border border-pq-neutral-200 p-4 mb-4">
        <Label htmlFor="delivery-search" className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide block mb-1.5">
          Search
        </Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pq-neutral-400" />
            <input
              id="delivery-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setAppliedSearch(search); setCurrentPage(1); } }}
              placeholder="PO number, purpose, supplier, or warehouse..."
              disabled={loading}
              className="w-full pl-9 pr-3 py-2 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] focus:border-transparent transition disabled:opacity-50"
            />
          </div>
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

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap mb-5">
        {(['all', 'pending', 'scheduled', 'in_transit', 'delayed', 'delivered'] as const).map(s => {
          const count = counts[s] ?? 0;
          const active = filter === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setFilterAndResetPage(s)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition ${
                active
                  ? 'bg-pq-neutral-900 text-white border-pq-primary-600'
                  : 'bg-white text-pq-neutral-500 border-pq-neutral-200 hover:border-pq-primary-600 hover:bg-pq-neutral-50'
              }`}
            >
              {s === 'all' ? 'All' : DELIVERY_STATUS_LABELS[s]}
              <span className={`inline-flex items-center justify-center rounded-full text-xs min-w-[18px] h-[18px] px-1 ${
                active ? 'bg-white/20 text-white' : 'bg-pq-neutral-50 text-pq-neutral-500'
              }`}>{count}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <CardListSkeleton cards={4} />
      ) : totalCount === 0 ? (
        <EmptyState
          icon={Truck}
          title="No deliveries found"
          description={filter === 'all' ? 'Deliveries will appear here once POs are acknowledged by suppliers.' : `No deliveries with status "${filter}".`}
        />
      ) : (
        <div className="space-y-4">
          <div className="space-y-3">
            {deliveries.map(d => (
              <DeliveryCard key={d.id} delivery={d} />
            ))}
          </div>

          {totalCount > 0 && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={rowsPerPage}
              totalCount={totalCount}
              entityLabel="deliveries"
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

function DeliveryCard({ delivery: d }: { delivery: Delivery }) {
  const cfg = STATUS_CONFIG[d.status];
  const Icon = cfg.icon;

  const dateLabel = d.status === 'delivered' && d.actual_delivery_date
    ? `Delivered ${format(new Date(d.actual_delivery_date), 'MMM d, yyyy')}`
    : d.scheduled_date
      ? `Scheduled ${format(new Date(d.scheduled_date), 'MMM d, yyyy')}`
      : d.commitment_date
        ? `Committed ${format(new Date(d.commitment_date), 'MMM d, yyyy')}`
        : 'No delivery date set';

  return (
    <Link href={`/delivery/${d.id}`} className="block group">
      <div className="bg-white border border-pq-neutral-200 rounded-md p-5 hover:border-pq-primary-600 transition flex items-center gap-4">
        {/* Status icon */}
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${cfg.bg} border ${cfg.border}`}>
          <Icon className={`w-4.5 h-4.5 ${cfg.text}`} />
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="font-mono font-bold text-pq-neutral-900 text-sm">{d.po_number_snapshot}</span>
            <span className={`inline-flex items-center gap-1 text-xs font-semibold border rounded-full px-2 py-0.5 ${cfg.bg} ${cfg.text} ${cfg.border}`}>
              <Icon className="w-3 h-3" />
              {cfg.label}
            </span>
          </div>
          <p className="text-sm text-pq-neutral-900 font-medium truncate">{d.purpose}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-pq-neutral-400 flex-wrap">
            <span className="flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              {d.supplier_name_snapshot}
            </span>
            <span className="flex items-center gap-1">
              <Package className="w-3 h-3" />
              {d.warehouse}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {dateLabel}
            </span>
          </div>
        </div>

        {/* Amount + chevron */}
        <div className="flex-shrink-0 text-right">
          <p className="text-sm font-bold text-pq-neutral-900 font-mono">
            ₱{d.grand_total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-pq-neutral-400 mt-0.5">PR1 Ref: {d.pr1_number_snapshot}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-pq-neutral-400 flex-shrink-0 group-hover:text-pq-neutral-500 transition" />
      </div>
    </Link>
  );
}
