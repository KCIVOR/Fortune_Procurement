'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import { useAuth } from '@/context/AuthContext';
import { fetchSupplierDeliveries } from '@/lib/delivery';
import type { Delivery, DeliveryStatus } from '@/types/delivery';
import { DELIVERY_STATUS_LABELS } from '@/types/delivery';
import { format } from 'date-fns';
import { Truck, Building2, Package, Calendar, ChevronRight, Clock, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, Navigation, Ban } from 'lucide-react';

const STATUS_CONFIG: Record<DeliveryStatus, {
  bg: string; text: string; border: string; icon: React.ElementType; actionLabel: string;
}> = {
  pending:    { bg: 'bg-slate-100',   text: 'text-slate-600',   border: 'border-slate-200',   icon: Clock,         actionLabel: 'Update Status' },
  scheduled:  { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    icon: Calendar,      actionLabel: 'Update Status' },
  in_transit: { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   icon: Navigation,    actionLabel: 'Update Status' },
  delayed:    { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     icon: AlertTriangle, actionLabel: 'Provide Update' },
  delivered:  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle2,  actionLabel: 'View' },
  cancelled:  { bg: 'bg-slate-100',  text: 'text-slate-500',   border: 'border-slate-200',   icon: Ban,           actionLabel: 'View' },
};

export default function SupplierDeliveryQueuePage() {
  const { profile } = useAuth();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');

  useEffect(() => {
    if (!profile) return;
    fetchSupplierDeliveries(profile.id)
      .then(setDeliveries)
      .catch(() => setError('Failed to load deliveries.'))
      .finally(() => setLoading(false));
  }, [profile]);

  const active    = deliveries.filter(d => d.status !== 'delivered' && d.status !== 'cancelled');
  const completed = deliveries.filter(d => d.status === 'delivered' || d.status === 'cancelled');

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
            <Truck className="w-5 h-5 text-[#40527A]" />
            <h1 className="text-xl font-bold text-[#0F1F3A]">My Deliveries</h1>
          </div>
          <p className="text-sm text-[#40527A]">Update delivery status for your purchase orders.</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-[#40527A]">{active.length} active</span>
          <span className="text-[#BFC7D5]">·</span>
          <span className="text-[#BFC7D5]">{completed.length} completed</span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-[4px] p-4 text-sm text-red-700 mb-4">{error}</div>
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
              <h2 className="text-xs font-bold text-[#40527A] uppercase tracking-wide mb-3">Active Deliveries</h2>
              <div className="space-y-3">
                {active.map(d => <SupplierDeliveryCard key={d.id} delivery={d} />)}
              </div>
            </section>
          )}
          {completed.length > 0 && (
            <section>
              <h2 className="text-xs font-bold text-[#40527A] uppercase tracking-wide mb-3">Completed</h2>
              <div className="space-y-3">
                {completed.map(d => <SupplierDeliveryCard key={d.id} delivery={d} />)}
              </div>
            </section>
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
      <div className="bg-white border border-[#D8E2FF] rounded-[4px] p-5 hover:border-[#0F1F3A] transition flex items-center gap-4">
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${cfg.bg} border ${cfg.border}`}>
          <Icon className={`w-4.5 h-4.5 ${cfg.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="font-mono font-bold text-[#0F1F3A] text-sm">{d.po_number_snapshot}</span>
            <span className={`inline-flex items-center gap-1 text-xs font-semibold border rounded-full px-2 py-0.5 ${cfg.bg} ${cfg.text} ${cfg.border}`}>
              <Icon className="w-3 h-3" />
              {DELIVERY_STATUS_LABELS[d.status]}
            </span>
          </div>
          <p className="text-sm text-[#0F1F3A] font-medium truncate">{d.purpose}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-[#BFC7D5] flex-wrap">
            <span className="flex items-center gap-1"><Package className="w-3 h-3" />{d.warehouse}</span>
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{dateLabel}</span>
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-sm font-bold text-[#0F1F3A] font-mono">
            ₱{d.grand_total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs font-medium text-[#1E4BFF] mt-1">{cfg.actionLabel}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0 group-hover:text-slate-600 transition" />
      </div>
    </Link>
  );
}
