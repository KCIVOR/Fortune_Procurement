'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import PaginationControls from '@/components/shared/PaginationControls';
import { fetchSupplierPOsPaged, fetchSupplierPOStatCounts } from '@/lib/po-approvals';
import { useAuth } from '@/context/AuthContext';
import type { SupplierPORow } from '@/types/po';
import {
  ShoppingCart, ArrowRight, Clock, CircleCheck as CheckCircle2,
  CalendarDays, CreditCard, Warehouse, Search,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';

const PO_STATUS_BADGE: Record<string, string> = {
  approved: 'bg-pq-success-100 text-pq-success-600 border-pq-success-100',
  sent:     'bg-pq-neutral-50 text-pq-neutral-900 border-pq-neutral-200',
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
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 20;
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch]                 = useState('');
  const [appliedSearch, setAppliedSearch]   = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [statCounts, setStatCounts] = useState({ pending: 0, acknowledged: 0, total: 0 });

  // Fetch global stat counts once on mount (not affected by filters or page changes)
  useEffect(() => {
    if (!profile) return;
    fetchSupplierPOStatCounts(profile.id)
      .then(setStatCounts)
      .catch((err) => console.error('Supplier PO stat counts error:', err));
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const offset = (currentPage - 1) * rowsPerPage;
    setLoading(true);
    setError('');
    fetchSupplierPOsPaged(profile.id, {
      limit:  rowsPerPage,
      offset,
      search: appliedSearch.trim() || undefined,
      status: selectedStatus,
    })
      .then(result => {
        setRows(result.rows);
        setTotalCount(result.total_count);
      })
      .catch((err) => {
        console.error('Supplier PO load error:', err);
        setError(err?.message || 'Failed to load purchase orders.');
      })
      .finally(() => setLoading(false));
  }, [profile, currentPage, appliedSearch, selectedStatus]);

  const pending      = rows.filter(r => r.po_status === 'approved' && !r.receipt);
  const acknowledged = rows.filter(r => r.receipt || r.po_status === 'sent');
  const totalPages   = Math.ceil(totalCount / rowsPerPage);

  return (
    <AppShell title="Purchase Orders">
      <PageHeader
        title="Purchase Orders"
        description="Purchase orders issued to your company. Acknowledge receipt and confirm your delivery commitment date."
      />

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
        <Select
          value={selectedStatus}
          onValueChange={(v) => { setSelectedStatus(v); setCurrentPage(1); }}
        >
          <SelectTrigger className="w-full sm:w-44 text-sm border-pq-neutral-200">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="approved">Awaiting Acknowledgment</SelectItem>
            <SelectItem value="sent">Acknowledged</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <LoadingState message="Loading purchase orders..." />
        </div>
      ) : error ? (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">{error}</div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-md border border-pq-neutral-200">
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
            <StatCard label="Awaiting Acknowledgment" value={statCounts.pending}      color="amber"   icon={Clock} />
            <StatCard label="Acknowledged"            value={statCounts.acknowledged} color="emerald" icon={CheckCircle2} />
            <StatCard label="Total POs"               value={statCounts.total}        color="slate"   icon={ShoppingCart} />
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

          {totalCount > 0 && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={rowsPerPage}
              totalCount={totalCount}
              entityLabel="purchase orders"
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

function PORow({ row }: { row: SupplierPORow }) {
  const needsAck = row.po_status === 'approved' && !row.receipt;

  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-pq-neutral-50 transition">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="font-mono text-xs font-bold text-pq-neutral-900">{row.po_number}</span>
          <span className={`inline-flex items-center text-xs font-medium border rounded-full px-2 py-0.5 ${PO_STATUS_BADGE[row.po_status] ?? 'bg-pq-neutral-50 text-pq-neutral-500 border-pq-neutral-200'}`}>
            {PO_STATUS_LABEL[row.po_status] ?? row.po_status}
          </span>
          {row.receipt && (
            <span className="inline-flex items-center gap-1 text-xs text-pq-success-600 bg-pq-success-100 border border-pq-success-100 rounded-full px-2 py-0.5">
              <CheckCircle2 className="w-3 h-3" />
              Acknowledged
            </span>
          )}
        </div>
        <p className="text-sm text-pq-neutral-900 truncate">{row.purpose}</p>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <span className="inline-flex items-center gap-1 text-xs text-pq-neutral-400">
            <CalendarDays className="w-3 h-3" />
            Required by: {format(new Date(row.date_required), 'MMM d, yyyy')}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-pq-neutral-400">
            <Warehouse className="w-3 h-3" />
            {row.warehouse}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-pq-neutral-400">
            <CreditCard className="w-3 h-3" />
            {row.payment_terms}
          </span>
          {row.receipt?.commitment_date && (
            <span className="inline-flex items-center gap-1 text-xs text-pq-primary-600">
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
              ? 'text-pq-warning-600 hover:text-pq-warning-600'
              : 'text-pq-neutral-500 hover:text-pq-neutral-900'
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
    amber:   'border-amber-300 bg-pq-warning-100 text-pq-warning-600',
    emerald: 'border-pq-success-100 bg-pq-success-100 text-pq-success-600',
    slate:   'border-pq-neutral-200 bg-pq-neutral-50 text-pq-neutral-500',
  }[accent];

  return (
    <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-pq-neutral-200">
        <h2 className="text-sm font-semibold text-pq-neutral-900">{title}</h2>
      </div>
      <div className="divide-y divide-pq-neutral-200">{children}</div>
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
