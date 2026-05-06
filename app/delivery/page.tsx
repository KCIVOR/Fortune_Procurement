'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
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
import { Truck, Package, Calendar, Building2, ChevronRight, Clock, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, Navigation, Ban } from 'lucide-react';

const STATUS_CONFIG: Record<DeliveryStatus, {
  label: string;
  bg: string;
  text: string;
  border: string;
  icon: React.ElementType;
}> = {
  pending:    { label: 'Pending',    bg: 'bg-[#F7F9FC]',   text: 'text-[#40527A]',   border: 'border-[#D8E2FF]',   icon: Clock },
  scheduled:  { label: 'Scheduled', bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    icon: Calendar },
  in_transit: { label: 'In Transit',bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   icon: Navigation },
  delayed:    { label: 'Delayed',   bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     icon: AlertTriangle },
  delivered:  { label: 'Delivered', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle2 },
  cancelled:  { label: 'Cancelled', bg: 'bg-[#F7F9FC]',  text: 'text-[#40527A]',   border: 'border-[#D8E2FF]',   icon: Ban },
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
    })
      .then((page) => {
        setDeliveries(page.deliveries);
        setTotalCount(page.total_count);
      })
      .catch(() => setError('Failed to load deliveries.'))
      .finally(() => setLoading(false));
  }, [profile, isEmployee, filter, currentPage, rowsPerPage]);

  const counts = tabCounts ?? EMPTY_TAB_COUNTS;

  const totalPages = Math.ceil(totalCount / rowsPerPage);

  const setFilterAndResetPage = (s: DeliveryListTab) => {
    setFilter(s);
    setCurrentPage(1);
  };

  if (!profile) {
    return (
      <AppShell title="Delivery Tracking">
        <div className="flex items-center justify-center h-64">
          <LoadingState message="Loading deliveries..." />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Delivery Tracking">
      {/* Page header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Truck className="w-5 h-5 text-[#40527A]" />
            <h1 className="text-xl font-bold text-[#0F1F3A]">
              {isEmployee ? 'My Delivery Status' : 'Delivery Tracking'}
            </h1>
          </div>
          <p className="text-sm text-[#40527A]">
            {isEmployee
              ? 'Track delivery progress for your purchase requisitions.'
              : 'Monitor all active and completed deliveries.'}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-[4px] p-4 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

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
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-xs font-semibold border transition ${
                active
                  ? 'bg-[#0F1F3A] text-white border-[#0F1F3A]'
                  : 'bg-white text-[#40527A] border-[#D8E2FF] hover:border-[#0F1F3A] hover:bg-[#F7F9FC]'
              }`}
            >
              {s === 'all' ? 'All' : DELIVERY_STATUS_LABELS[s]}
              <span className={`inline-flex items-center justify-center rounded-full text-xs min-w-[18px] h-[18px] px-1 ${
                active ? 'bg-white/20 text-white' : 'bg-[#F7F9FC] text-[#40527A]'
              }`}>{count}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 mb-4">
          <LoadingState message="Loading deliveries..." />
        </div>
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

          {deliveries.length > 0 && (
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
              className="rounded-[4px] border border-[#D8E2FF]"
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
      <div className="bg-white border border-[#D8E2FF] rounded-[4px] p-5 hover:border-[#0F1F3A] transition flex items-center gap-4">
        {/* Status icon */}
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${cfg.bg} border ${cfg.border}`}>
          <Icon className={`w-4.5 h-4.5 ${cfg.text}`} />
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="font-mono font-bold text-[#0F1F3A] text-sm">{d.po_number_snapshot}</span>
            <span className={`inline-flex items-center gap-1 text-xs font-semibold border rounded-full px-2 py-0.5 ${cfg.bg} ${cfg.text} ${cfg.border}`}>
              <Icon className="w-3 h-3" />
              {cfg.label}
            </span>
          </div>
          <p className="text-sm text-[#0F1F3A] font-medium truncate">{d.purpose}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-[#BFC7D5] flex-wrap">
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
          <p className="text-sm font-bold text-[#0F1F3A] font-mono">
            ₱{d.grand_total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-[#BFC7D5] mt-0.5">PR1: {d.pr1_number_snapshot}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-[#BFC7D5] flex-shrink-0 group-hover:text-[#40527A] transition" />
      </div>
    </Link>
  );
}
