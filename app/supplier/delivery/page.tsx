'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import { useAuth } from '@/context/AuthContext';
import PaginationControls from '@/components/shared/PaginationControls';
import FilterBar from '@/components/shared/FilterBar';
import type { FilterConfig } from '@/components/shared/FilterBar.types';
import { fetchSupplierDeliveriesPaged, fetchSupplierDeliveryStatCounts } from '@/lib/delivery';
import type { Delivery, DeliveryStatus } from '@/types/delivery';
import { DELIVERY_STATUS_LABELS } from '@/types/delivery';
import { format } from 'date-fns';
import { Truck, Package, Calendar, ArrowRight, Clock, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, Navigation, Ban } from 'lucide-react';

const STATUS_CONFIG: Record<DeliveryStatus, {
  bg: string; text: string; border: string; icon: React.ElementType; actionLabel: string;
}> = {
  pending:    { bg: 'bg-pq-neutral-100',   text: 'text-pq-neutral-600',   border: 'border-pq-neutral-200',   icon: Clock,         actionLabel: 'Update Status' },
  scheduled:  { bg: 'bg-pq-primary-50',    text: 'text-pq-primary-700',    border: 'border-pq-primary-200',    icon: Calendar,      actionLabel: 'Update Status' },
  in_transit: { bg: 'bg-pq-warning-100',   text: 'text-pq-warning-600',   border: 'border-pq-warning-100',   icon: Navigation,    actionLabel: 'Update Status' },
  delayed:    { bg: 'bg-pq-danger-100',     text: 'text-pq-danger-600',     border: 'border-pq-danger-100',     icon: AlertTriangle, actionLabel: 'Provide Update' },
  delivered:  { bg: 'bg-pq-success-100', text: 'text-pq-success-600', border: 'border-pq-success-100', icon: CheckCircle2,  actionLabel: 'View' },
  cancelled:  { bg: 'bg-pq-neutral-100',  text: 'text-pq-neutral-500',   border: 'border-pq-neutral-200',   icon: Ban,           actionLabel: 'View' },
};

export default function SupplierDeliveryQueuePage() {
  const { profile } = useAuth();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 20;
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch]               = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [statCounts, setStatCounts] = useState({ active: 0, completed: 0, total: 0 });

  // Fetch global stat counts once on mount (not affected by filters or page changes)
  useEffect(() => {
    if (!profile) return;
    fetchSupplierDeliveryStatCounts(profile.id)
      .then(setStatCounts)
      .catch((err) => console.error('Supplier delivery stat counts error:', err));
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const offset = (currentPage - 1) * rowsPerPage;
    setLoading(true);
    setError('');
    fetchSupplierDeliveriesPaged(profile.id, {
      limit:  rowsPerPage,
      offset,
      search: appliedSearch.trim() || undefined,
      status: selectedStatus,
    })
      .then(result => {
        setDeliveries(result.deliveries);
        setTotalCount(result.total_count);
      })
      .catch((err) => {
        console.error('Supplier delivery load error:', err);
        setError(err?.message || 'Failed to load deliveries.');
      })
      .finally(() => setLoading(false));
  }, [profile, currentPage, appliedSearch, selectedStatus]);

  const active    = deliveries.filter(d => d.status !== 'delivered' && d.status !== 'cancelled');
  const completed = deliveries.filter(d => d.status === 'delivered' || d.status === 'cancelled');
  const totalPages = Math.ceil(totalCount / rowsPerPage);

  // Filter configuration for FilterBar
  const filters: FilterConfig[] = [
    {
      type: 'search',
      id: 'supplier-delivery-search',
      label: 'Search',
      placeholder: 'Search PO number or purpose...',
      value: search,
      onChange: (value) => setSearch(value as string),
    },
    {
      type: 'select',
      id: 'supplier-delivery-status',
      label: 'Status',
      placeholder: 'All Statuses',
      value: selectedStatus,
      onChange: (value) => {
        setSelectedStatus(value as string);
        setCurrentPage(1);
      },
      options: [
        { value: 'all', label: 'All Statuses' },
        { value: 'pending', label: 'Pending' },
        { value: 'scheduled', label: 'Scheduled' },
        { value: 'in_transit', label: 'In Transit' },
        { value: 'delayed', label: 'Delayed' },
        { value: 'delivered', label: 'Delivered' },
      ],
    },
  ];

  const handleApply = () => {
    setAppliedSearch(search);
    setCurrentPage(1);
  };

  const handleClear = () => {
    setSearch('');
    setAppliedSearch('');
    setSelectedStatus('all');
    setCurrentPage(1);
  };

  if (loading) return (
    <AppShell title="My Deliveries">
      <div className="flex items-center justify-center h-64">
        <LoadingState message="Loading deliveries..." />
      </div>
    </AppShell>
  );

  return (
    <AppShell title="My Deliveries">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Truck className="w-5 h-5 text-pq-neutral-500" />
            <h1 className="text-xl font-bold text-pq-neutral-900">My Deliveries</h1>
          </div>
          <p className="text-sm text-pq-neutral-500">Update delivery status for your purchase orders.</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-pq-neutral-500">{statCounts.active} active</span>
          <span className="text-pq-neutral-400">·</span>
          <span className="text-pq-neutral-400">{statCounts.completed} completed</span>
          {statCounts.total > 0 && (
            <>
              <span className="text-pq-neutral-400">·</span>
              <span className="text-pq-neutral-400">{statCounts.total} total</span>
            </>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <FilterBar
        filters={filters}
        onApply={handleApply}
        onClear={handleClear}
        loading={loading}
        resultCount={totalCount}
        resultLabel="delivery"
        className="mb-4"
      />

      {error && (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600 mb-4">{error}</div>
      )}

      {deliveries.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No deliveries yet"
          description="Deliveries will appear here once you acknowledge a Purchase Order."
        />
      ) : (
        <div className="space-y-4">
          {active.length > 0 && (
            <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
              <div className="px-5 py-2.5 border-b border-pq-neutral-200 bg-pq-neutral-50 flex items-center gap-2">
                <Truck className="w-3.5 h-3.5 text-pq-neutral-400" />
                <span className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Active Deliveries ({active.length})</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-pq-neutral-200 bg-pq-neutral-50/50">
                      <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">PO No.</th>
                      <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Status</th>
                      <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Purpose</th>
                      <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Warehouse</th>
                      <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Date</th>
                      <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-right">Total</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pq-neutral-200">
                    {active.map(d => <DeliveryRow key={d.id} delivery={d} />)}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {completed.length > 0 && (
            <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
              <div className="px-5 py-2.5 border-b border-pq-neutral-200 bg-pq-neutral-50 flex items-center gap-2">
                <Package className="w-3.5 h-3.5 text-pq-neutral-400" />
                <span className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Completed ({completed.length})</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-pq-neutral-200 bg-pq-neutral-50/50">
                      <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">PO No.</th>
                      <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Status</th>
                      <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Purpose</th>
                      <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Warehouse</th>
                      <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Date</th>
                      <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-right">Total</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pq-neutral-200">
                    {completed.map(d => <DeliveryRow key={d.id} delivery={d} />)}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {totalCount > 0 && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={rowsPerPage}
              totalCount={totalCount}
              entityLabel="deliveries"
              loading={loading}
              onPageChange={(page) => {
                if (page < currentPage) setCurrentPage(p => Math.max(1, p - 1));
                else setCurrentPage(p => Math.min(totalPages, p + 1));
              }}
            />
          )}
        </div>
      )}
    </AppShell>
  );
}

function DeliveryRow({ delivery: d }: { delivery: Delivery }) {
  const cfg  = STATUS_CONFIG[d.status];
  const Icon = cfg.icon;

  const dateLabel = d.status === 'delivered' && d.actual_delivery_date
    ? format(new Date(d.actual_delivery_date), 'MMM d, yyyy')
    : d.scheduled_date
      ? format(new Date(d.scheduled_date), 'MMM d, yyyy')
      : d.commitment_date
        ? format(new Date(d.commitment_date), 'MMM d, yyyy')
        : 'No date set';

  return (
    <tr className="hover:bg-pq-neutral-50 transition">
      <td className="px-5 py-3.5 font-mono font-bold text-pq-neutral-900 whitespace-nowrap">{d.po_number_snapshot}</td>
      <td className="px-5 py-3.5">
        <span className={`inline-flex items-center gap-1 text-xs font-semibold border rounded-full px-2 py-0.5 ${cfg.bg} ${cfg.text} ${cfg.border}`}>
          <Icon className="w-3 h-3" />
          {DELIVERY_STATUS_LABELS[d.status]}
        </span>
      </td>
      <td className="px-5 py-3.5 text-pq-neutral-500 max-w-[180px] truncate">{d.purpose}</td>
      <td className="px-5 py-3.5 text-pq-neutral-500 text-xs whitespace-nowrap">{d.warehouse}</td>
      <td className="px-5 py-3.5 text-pq-neutral-500 text-xs whitespace-nowrap">{dateLabel}</td>
      <td className="px-5 py-3.5 font-mono font-semibold text-pq-neutral-900 text-right whitespace-nowrap">
        ₱{d.grand_total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
      </td>
      <td className="px-5 py-3.5 text-right">
        <Link href={`/supplier/delivery/${d.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-pq-neutral-500 hover:text-pq-neutral-900 transition">
          {cfg.actionLabel} <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </td>
    </tr>
  );
}
