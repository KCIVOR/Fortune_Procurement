'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import { fetchSupplierPOs } from '@/lib/po-approvals';
import { useAuth } from '@/context/AuthContext';
import type { SupplierPORow } from '@/types/po';
import {
  ShoppingCart, ArrowRight, Clock, CircleCheck as CheckCircle2,
  CalendarDays, CreditCard, Warehouse,
} from 'lucide-react';
import { format } from 'date-fns';

const PO_STATUS_BADGE: Record<string, string> = {
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  sent:     'bg-[#F7F9FC] text-[#0F1F3A] border-[#D8E2FF]',
};
const PO_STATUS_LABEL: Record<string, string> = {
  approved: 'Awaiting Acknowledgment',
  sent:     'Acknowledged',
};

export default function SupplierPOPage() {
  const { profile } = useAuth();
  const [rows, setRows]       = useState<SupplierPORow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!profile) return;
    fetchSupplierPOs(profile.id)
      .then(setRows)
      .catch(() => setError('Failed to load purchase orders.'))
      .finally(() => setLoading(false));
  }, [profile]);

  const pending      = rows.filter(r => r.po_status === 'approved' && !r.receipt);
  const acknowledged = rows.filter(r => r.receipt || r.po_status === 'sent');

  return (
    <AppShell title="Purchase Orders">
      <PageHeader
        title="Purchase Orders"
        description="Purchase orders issued to your company. Acknowledge receipt and confirm your delivery commitment date."
      />

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <LoadingState message="Loading purchase orders..." />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-[4px] p-4 text-sm text-red-700">{error}</div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-[4px] border border-[#D8E2FF]">
          <EmptyState
            title="No purchase orders yet"
            description="When procurement issues a PO for items you quoted, it will appear here."
            icon={ShoppingCart}
          />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard label="Awaiting Acknowledgment" value={pending.length}      color="amber"   icon={Clock} />
            <StatCard label="Acknowledged"            value={acknowledged.length} color="emerald" icon={CheckCircle2} />
            <StatCard label="Total POs"              value={rows.length}         color="slate"   icon={ShoppingCart} />
          </div>

          {pending.length > 0 && (
            <POSection title="Awaiting Your Acknowledgment" accent="amber">
              {pending.map(row => <PORow key={row.po_id} row={row} />)}
            </POSection>
          )}

          {acknowledged.length > 0 && (
            <POSection title="Acknowledged" accent="emerald">
              {acknowledged.map(row => <PORow key={row.po_id} row={row} />)}
            </POSection>
          )}
        </div>
      )}
    </AppShell>
  );
}

function PORow({ row }: { row: SupplierPORow }) {
  const needsAck = row.po_status === 'approved' && !row.receipt;

  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-[#F7F9FC] transition">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="font-mono text-xs font-bold text-[#0F1F3A]">{row.po_number}</span>
          <span className={`inline-flex items-center text-xs font-medium border rounded-full px-2 py-0.5 ${PO_STATUS_BADGE[row.po_status] ?? 'bg-[#F7F9FC] text-[#40527A] border-[#D8E2FF]'}`}>
            {PO_STATUS_LABEL[row.po_status] ?? row.po_status}
          </span>
          {row.receipt && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
              <CheckCircle2 className="w-3 h-3" />
              Acknowledged
            </span>
          )}
        </div>
        <p className="text-sm text-[#0F1F3A] truncate">{row.purpose}</p>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <span className="inline-flex items-center gap-1 text-xs text-[#BFC7D5]">
            <CalendarDays className="w-3 h-3" />
            Required by: {format(new Date(row.date_required), 'MMM d, yyyy')}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-[#BFC7D5]">
            <Warehouse className="w-3 h-3" />
            {row.warehouse}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-[#BFC7D5]">
            <CreditCard className="w-3 h-3" />
            {row.payment_terms}
          </span>
          {row.receipt?.commitment_date && (
            <span className="inline-flex items-center gap-1 text-xs text-[#1E4BFF]">
              <CalendarDays className="w-3 h-3" />
              Delivery: {format(new Date(row.receipt.commitment_date), 'MMM d, yyyy')}
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0">
        <Link
          href={`/supplier/po/${row.po_id}`}
          className={`inline-flex items-center gap-1 text-xs font-semibold transition ${
            needsAck
              ? 'text-amber-600 hover:text-amber-800'
              : 'text-[#40527A] hover:text-[#0F1F3A]'
          }`}
        >
          {needsAck ? 'Acknowledge PO' : 'View PO'}
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

function POSection({
  title,
  accent,
  children,
}: {
  title: string;
  accent: 'amber' | 'emerald' | 'slate';
  children: React.ReactNode;
}) {
  const accentClass = {
    amber:   'border-amber-300 bg-amber-50 text-amber-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    slate:   'border-[#D8E2FF] bg-[#F7F9FC] text-[#40527A]',
  }[accent];

  return (
    <div className="bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[#D8E2FF]">
        <h2 className="text-sm font-semibold text-[#0F1F3A]">{title}</h2>
      </div>
      <div className="divide-y divide-[#D8E2FF]">{children}</div>
    </div>
  );
}

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
    amber:   'text-amber-600 bg-amber-50',
    emerald: 'text-emerald-600 bg-emerald-50',
    slate:   'text-[#40527A] bg-[#F7F9FC]',
  }[color];

  return (
    <div className="bg-white rounded-[4px] border border-[#D8E2FF] p-4">
      <div className={`inline-flex items-center justify-center w-9 h-9 rounded-[4px] mb-3 ${colorClass}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-[#0F1F3A]">{value}</p>
      <p className="text-xs text-[#40527A] mt-0.5">{label}</p>
    </div>
  );
}
