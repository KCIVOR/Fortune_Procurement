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
import type { DeliveryListTab } from '@/lib/delivery';
import {
  fetchDeliveryQueuePaged,
  fetchDeliveryTabCounts,
} from '@/lib/delivery';
import type { Delivery, DeliveryStatus } from '@/types/delivery';
import { DELIVERY_STATUS_LABELS } from '@/types/delivery';
import { canViewCommercialPricing, formatCommercialAmount } from '@/lib/price-visibility';
import { format } from 'date-fns';
import { Truck, Package, Calendar, Building2, ChevronRight, Clock, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, Navigation, Ban } from 'lucide-react';

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

  // Tab configuration for FilterBar
  const tabs: TabFilter[] = [
    { value: 'all', label: `All (${counts.all})` },
    { value: 'pending', label: `${DELIVERY_STATUS_LABELS.pending} (${counts.pending})` },
    { value: 'scheduled', label: `${DELIVERY_STATUS_LABELS.scheduled} (${counts.scheduled})` },
    { value: 'in_transit', label: `${DELIVERY_STATUS_LABELS.in_transit} (${counts.in_transit})` },
    { value: 'delayed', label: `${DELIVERY_STATUS_LABELS.delayed} (${counts.delayed})` },
    { value: 'delivered', label: `${DELIVERY_STATUS_LABELS.delivered} (${counts.delivered})` },
  ];

  // Filter configuration for FilterBar
  const filters: FilterConfig[] = [
    {
      type: 'search',
      id: 'delivery-search',
      label: 'Search',
      placeholder: 'PO number, purpose, supplier, or warehouse...',
      value: search,
      onChange: (value) => setSearch(value as string),
    },
  ];

  const handleTabChange = (value: string) => {
    setFilter(value as DeliveryListTab);
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
        resultLabel="delivery"
        className="mb-5"
      />

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
              <DeliveryCard key={d.id} delivery={d} canViewPrices={canViewCommercialPricing(profile)} />
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

function DeliveryCard({ delivery: d, canViewPrices }: { delivery: Delivery; canViewPrices: boolean }) {
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
            {formatCommercialAmount(d.grand_total, canViewPrices)}
          </p>
          <p className="text-xs text-pq-neutral-400 mt-0.5">PR1 Ref: {d.pr1_number_snapshot}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-pq-neutral-400 flex-shrink-0 group-hover:text-pq-neutral-500 transition" />
      </div>
    </Link>
  );
}
