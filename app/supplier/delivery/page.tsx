'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import { useAuth } from '@/context/AuthContext';
import PaginationControls from '@/components/shared/PaginationControls';
import { fetchSupplierDeliveriesPaged, fetchSupplierDeliveryStatCounts } from '@/lib/delivery';
import type { Delivery, DeliveryStatus } from '@/types/delivery';
import { DELIVERY_STATUS_LABELS } from '@/types/delivery';
import { format } from 'date-fns';
import { Truck, Building2, Package, Calendar, ChevronRight, Clock, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, Navigation, Ban, Search } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pq-neutral-400" />
            <input
              type="text"
              placeholder="Search PO number or purpose..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setAppliedSearch(search); setCurrentPage(1); } }}
              className="w-full pl-9 pr-3 py-2 text-sm border border-pq-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] bg-white"
            />
          </div>
          <button
            onClick={() => { setAppliedSearch(search); setCurrentPage(1); }}
            className="px-3 py-2 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-xs font-semibold rounded-md transition whitespace-nowrap"
          >
            Apply
          </button>
          <button
            onClick={() => { setSearch(''); setAppliedSearch(''); setCurrentPage(1); }}
            className="px-3 py-2 text-xs font-medium text-pq-neutral-500 bg-pq-neutral-50 border border-pq-neutral-200 rounded-md hover:bg-pq-neutral-200 transition whitespace-nowrap"
          >
            Clear
          </button>
        </div>
        <Select
          value={selectedStatus}
          onValueChange={(v) => { setSelectedStatus(v); setCurrentPage(1); }}
        >
          <SelectTrigger className="w-full sm:w-44 text-sm border-pq-neutral-200">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="in_transit">In Transit</SelectItem>
            <SelectItem value="delayed">Delayed</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
          </SelectContent>
        </Select>
      </div>

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
        <div className="space-y-6">
          {active.length > 0 && (
            <section>
              <h2 className="text-xs font-bold text-pq-neutral-500 uppercase tracking-wide mb-3">Active Deliveries</h2>
              <div className="space-y-3">
                {active.map(d => <SupplierDeliveryCard key={d.id} delivery={d} />)}
              </div>
            </section>
          )}
          {completed.length > 0 && (
            <section>
              <h2 className="text-xs font-bold text-pq-neutral-500 uppercase tracking-wide mb-3">Completed</h2>
              <div className="space-y-3">
                {completed.map(d => <SupplierDeliveryCard key={d.id} delivery={d} />)}
              </div>
            </section>
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

function SupplierDeliveryCard({ delivery: d }: { delivery: Delivery }) {
  const cfg  = STATUS_CONFIG[d.status];
  const Icon = cfg.icon;

  const dateLabel = d.status === 'delivered' && d.actual_delivery_date
    ? `Delivered ${format(new Date(d.actual_delivery_date), 'MMM d, yyyy')}`
    : d.scheduled_date
      ? `Sched. ${format(new Date(d.scheduled_date), 'MMM d, yyyy')}`
      : d.commitment_date
        ? `Committed ${format(new Date(d.commitment_date), 'MMM d, yyyy')}`
        : 'No date set';

  return (
    <Link href={`/supplier/delivery/${d.id}`} className="block group">
      <div className="bg-white border border-pq-neutral-200 rounded-md p-5 hover:border-pq-primary-600 transition flex items-center gap-4">
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${cfg.bg} border ${cfg.border}`}>
          <Icon className={`w-4.5 h-4.5 ${cfg.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="font-mono font-bold text-pq-neutral-900 text-sm">{d.po_number_snapshot}</span>
            <span className={`inline-flex items-center gap-1 text-xs font-semibold border rounded-full px-2 py-0.5 ${cfg.bg} ${cfg.text} ${cfg.border}`}>
              <Icon className="w-3 h-3" />
              {DELIVERY_STATUS_LABELS[d.status]}
            </span>
          </div>
          <p className="text-sm text-pq-neutral-900 font-medium truncate">{d.purpose}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-pq-neutral-400 flex-wrap">
            <span className="flex items-center gap-1"><Package className="w-3 h-3" />{d.warehouse}</span>
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{dateLabel}</span>
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-sm font-bold text-pq-neutral-900 font-mono">
            ₱{d.grand_total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs font-medium text-pq-primary-600 mt-1">{cfg.actionLabel}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-pq-neutral-400 flex-shrink-0 group-hover:text-pq-neutral-600 transition" />
      </div>
    </Link>
  );
}
