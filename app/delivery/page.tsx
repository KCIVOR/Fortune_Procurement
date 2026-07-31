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
import type { DeliveryListTab } from '@/lib/delivery';
import { fetchDeliveryQueuePaged, fetchDeliveryTabCounts } from '@/lib/delivery';
import type { Delivery, DeliveryStatus } from '@/types/delivery';
import { DELIVERY_STATUS_LABELS } from '@/types/delivery';
import { canViewCommercialPricing, formatCommercialAmount } from '@/lib/price-visibility';
import { format } from 'date-fns';
import {
  Truck,
  Clock,
  CircleCheck as CheckCircle2,
  TriangleAlert as AlertTriangle,
  Navigation,
  Calendar,
  Ban,
  ExternalLink,
  ClipboardList,
  Send,
} from 'lucide-react';
import { RequestTypeBadge } from '@/components/shared/RequestTypeBadge';
import PriorityChip from '@/components/shared/PriorityChip';

const STATUS_STYLES: Record<DeliveryStatus, string> = {
  pending:    'bg-pq-neutral-100 text-pq-neutral-600 border-pq-neutral-200',
  scheduled:  'bg-pq-primary-50 text-pq-primary-700 border-pq-primary-200',
  in_transit: 'bg-pq-warning-100 text-pq-warning-600 border-pq-warning-100',
  delayed:    'bg-pq-danger-100 text-pq-danger-600 border-pq-danger-100',
  delivered:  'bg-pq-success-100 text-pq-success-600 border-pq-success-100',
  cancelled:  'bg-pq-neutral-100 text-pq-neutral-500 border-pq-neutral-200',
};

const STATUS_ICONS: Record<DeliveryStatus, React.ElementType> = {
  pending:    Clock,
  scheduled:  Calendar,
  in_transit: Navigation,
  delayed:    AlertTriangle,
  delivered:  CheckCircle2,
  cancelled:  Ban,
};

const EMPTY_TAB_COUNTS: Record<DeliveryListTab, number> = {
  all: 0, pending: 0, scheduled: 0, in_transit: 0, delayed: 0, delivered: 0,
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
  const [selectedPriority, setSelectedPriority] = useState('all');

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
      priority: selectedPriority,
    })
      .then((page) => {
        setDeliveries(page.deliveries);
        setTotalCount(page.total_count);
      })
      .catch(() => setError('Failed to load deliveries.'))
      .finally(() => setLoading(false));
  }, [profile, isEmployee, filter, currentPage, rowsPerPage, appliedSearch, selectedPriority]);

  const counts = tabCounts ?? EMPTY_TAB_COUNTS;
  const totalPages = Math.ceil(totalCount / rowsPerPage);
  const canViewPrices = canViewCommercialPricing(profile);

  const tabs: TabFilter[] = [
    { value: 'all',        label: `All (${counts.all})` },
    { value: 'pending',    label: `${DELIVERY_STATUS_LABELS.pending} (${counts.pending})` },
    { value: 'scheduled',  label: `${DELIVERY_STATUS_LABELS.scheduled} (${counts.scheduled})` },
    { value: 'in_transit', label: `${DELIVERY_STATUS_LABELS.in_transit} (${counts.in_transit})` },
    { value: 'delayed',    label: `${DELIVERY_STATUS_LABELS.delayed} (${counts.delayed})` },
    { value: 'delivered',  label: `${DELIVERY_STATUS_LABELS.delivered} (${counts.delivered})` },
  ];

  const filters: FilterConfig[] = [
    {
      type: 'search',
      id: 'delivery-search',
      label: 'Search',
      placeholder: 'PO number, purpose, supplier, or warehouse...',
      value: search,
      onChange: (value) => setSearch(value as string),
    },
    {
      type: 'select',
      id: 'delivery-priority',
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
    setSelectedPriority('all');
    setCurrentPage(1);
  };

  if (!profile) {
    return (
      <AppShell title="Delivery Tracking">
        <TableSkeleton rows={5} cols={7} />
      </AppShell>
    );
  }

  return (
    <AppShell title="Delivery Tracking">
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
        resultLabel="delivery"
        className="mb-5"
      />

      {loading ? (
        <TableSkeleton rows={5} cols={7} />
      ) : totalCount === 0 ? (
        <div className="bg-white rounded-md border border-pq-neutral-200">
          <EmptyState
            icon={Truck}
            title="No deliveries found"
            description={filter === 'all'
              ? 'Deliveries appear here once POs are acknowledged by suppliers, or marked as ordered for external vendors.'
              : `No deliveries with status "${DELIVERY_STATUS_LABELS[filter as DeliveryStatus] ?? filter}".`}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-pq-neutral-200 bg-pq-neutral-50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">PO No.</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">PR1 Ref</th>
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-center">Type</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Supplier</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Department</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Purpose</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Delivery Date</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Priority</th>
                    {canViewPrices && (
                      <th className="text-right px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Amount</th>
                    )}
                    <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Status</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-pq-neutral-200">
                  {deliveries.map(d => {
                    const Icon = STATUS_ICONS[d.status];
                    const dateLabel = d.status === 'delivered' && d.actual_delivery_date
                      ? format(new Date(d.actual_delivery_date), 'MMM d, yyyy')
                      : d.scheduled_date
                        ? format(new Date(d.scheduled_date), 'MMM d, yyyy')
                        : d.commitment_date
                          ? format(new Date(d.commitment_date), 'MMM d, yyyy')
                          : '—';
                    return (
                      <tr key={d.id} className="hover:bg-pq-neutral-50 transition-colors">
                        <td className="px-5 py-3.5 font-mono font-semibold text-pq-neutral-900">{d.po_number_snapshot}</td>
                        <td className="px-5 py-3.5 font-mono text-xs text-pq-neutral-500">{d.pr1_number_snapshot}</td>
                        <td className="px-5 py-3.5 text-center">
                          <RequestTypeBadge type={d.request_type ?? 'goods'} />
                        </td>
                        <td className="px-5 py-3.5 text-pq-neutral-900">{d.supplier_name_snapshot}</td>
                        <td className="px-5 py-3.5 text-pq-neutral-500">{d.department_name_snapshot}</td>
                        <td className="px-5 py-3.5 text-pq-neutral-500 max-w-[160px] truncate">{d.purpose}</td>
                        <td className="px-5 py-3.5 text-pq-neutral-500 text-xs">{dateLabel}</td>
                        <td className="px-5 py-3.5"><PriorityChip priority={d.priority ?? 'normal'} /></td>
                        {canViewPrices && (
                          <td className="px-5 py-3.5 text-right font-mono text-xs font-semibold text-pq-neutral-900">
                            {formatCommercialAmount(d.grand_total, true)}
                          </td>
                        )}
                        <td className="px-5 py-3.5">
                          {d.status === 'delivered' && !d.has_grn && d.request_type === 'services' && !d.forwarded_to_procurement ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold border rounded-full px-2.5 py-0.5 bg-pq-warning-100 text-pq-warning-600 border-pq-warning-100">
                              <Clock className="w-3 h-3" />
                              Pending Warehouse Handoff
                            </span>
                          ) : d.status === 'delivered' && !d.has_grn && d.request_type === 'services' && d.forwarded_to_procurement ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold border rounded-full px-2.5 py-0.5 bg-teal-50 text-teal-700 border-teal-200">
                              <Send className="w-3 h-3" />
                              Forwarded — Awaiting GRN
                            </span>
                          ) : d.status === 'delivered' && !d.has_grn ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold border rounded-full px-2.5 py-0.5 bg-pq-warning-100 text-pq-warning-600 border-pq-warning-100">
                              <ClipboardList className="w-3 h-3" />
                              Awaiting GRN
                            </span>
                          ) : (
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold border rounded-full px-2.5 py-0.5 ${STATUS_STYLES[d.status]}`}>
                              <Icon className="w-3 h-3" />
                              {DELIVERY_STATUS_LABELS[d.status]}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Link
                            href={`/delivery/${d.id}`}
                            className="inline-flex items-center gap-1.5 text-pq-primary-600 hover:text-pq-primary-700 text-xs font-medium transition"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            View
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
