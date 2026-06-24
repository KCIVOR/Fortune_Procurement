'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import PaginationControls from '@/components/shared/PaginationControls';
import FilterBar from '@/components/shared/FilterBar';
import type { FilterConfig } from '@/components/shared/FilterBar.types';
import { StatCard } from '@/components/shared/StatCard';
import { fetchSupplierPOsPaged, fetchSupplierPOStatCounts } from '@/lib/po-approvals';
import { useAuth } from '@/context/AuthContext';
import type { SupplierPORow } from '@/types/po';
import {
  ShoppingCart, ArrowRight, Clock, CircleCheck as CheckCircle2,
} from 'lucide-react';
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

  // Filter configuration for FilterBar
  const filters: FilterConfig[] = [
    {
      type: 'search',
      id: 'supplier-po-search',
      label: 'Search',
      placeholder: 'Search PO number or purpose...',
      value: search,
      onChange: (value) => setSearch(value as string),
    },
    {
      type: 'select',
      id: 'supplier-po-status',
      label: 'Status',
      placeholder: 'All Statuses',
      value: selectedStatus,
      onChange: (value) => {
        setSelectedStatus(value as string);
        setCurrentPage(1);
      },
      options: [
        { value: 'all', label: 'All Statuses' },
        { value: 'approved', label: 'Awaiting Acknowledgment' },
        { value: 'sent', label: 'Acknowledged' },
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

  return (
    <AppShell title="Purchase Orders">
      <PageHeader
        title="Purchase Orders"
        description="Purchase orders issued to your company. Acknowledge receipt and confirm your delivery commitment date."
      />

      {/* Stats - KPI Cards first */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard 
          label="Awaiting Acknowledgment" 
          value={statCounts.pending} 
          accent="amber"
          icon={<Clock className="w-5 h-5" />}
        />
        <StatCard 
          label="Acknowledged" 
          value={statCounts.acknowledged} 
          accent="green"
          icon={<CheckCircle2 className="w-5 h-5" />}
        />
        <StatCard 
          label="Total POs" 
          value={statCounts.total} 
          accent="blue"
          icon={<ShoppingCart className="w-5 h-5" />}
        />
      </div>

      {/* Filter bar */}
      <FilterBar
        filters={filters}
        onApply={handleApply}
        onClear={handleClear}
        loading={loading}
        resultCount={totalCount}
        resultLabel="purchase order"
        className="mb-6"
      />

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
          {pending.length > 0 && (
            <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
              <div className="px-5 py-2.5 border-b border-pq-neutral-200 bg-pq-neutral-50 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-pq-warning-500" />
                <span className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Awaiting Your Acknowledgment ({pending.length})</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-pq-neutral-200 bg-pq-neutral-50/50">
                      <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">PO No.</th>
                      <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Purpose</th>
                      <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Warehouse</th>
                      <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Payment Terms</th>
                      <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Date Required</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pq-neutral-200">
                    {pending.map(row => <PORow key={row.po_id} row={row} />)}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {acknowledged.length > 0 && (
            <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
              <div className="px-5 py-2.5 border-b border-pq-neutral-200 bg-pq-neutral-50 flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-pq-success-500" />
                <span className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Acknowledged ({acknowledged.length})</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-pq-neutral-200 bg-pq-neutral-50/50">
                      <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">PO No.</th>
                      <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Purpose</th>
                      <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Warehouse</th>
                      <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Payment Terms</th>
                      <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Date Required</th>
                      <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Delivery</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pq-neutral-200">
                    {acknowledged.map(row => <PORow key={row.po_id} row={row} />)}
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
    <tr className="hover:bg-pq-neutral-50 transition">
      <td className="px-5 py-3.5 font-mono text-xs font-bold text-pq-neutral-900 whitespace-nowrap">{row.po_number}</td>
      <td className="px-5 py-3.5 text-pq-neutral-500 max-w-[180px] truncate">{row.purpose}</td>
      <td className="px-5 py-3.5 text-pq-neutral-400 text-xs whitespace-nowrap">{row.warehouse}</td>
      <td className="px-5 py-3.5 text-pq-neutral-400 text-xs whitespace-nowrap">{row.payment_terms}</td>
      <td className="px-5 py-3.5 text-pq-neutral-400 text-xs whitespace-nowrap">{format(new Date(row.date_required), 'MMM d, yyyy')}</td>
      {row.receipt?.commitment_date && (
        <td className="px-5 py-3.5 text-pq-primary-600 text-xs whitespace-nowrap">{format(new Date(row.receipt.commitment_date), 'MMM d, yyyy')}</td>
      )}
      {!row.receipt?.commitment_date && (
        <td className="px-5 py-3.5 text-pq-neutral-400 text-xs">—</td>
      )}
      <td className="px-5 py-3.5 text-right">
        <Link
          href={`/supplier/po/${row.po_id}`}
          className={`inline-flex items-center gap-1 text-xs font-semibold transition ${
            needsAck ? 'text-pq-warning-600 hover:text-pq-neutral-900' : 'text-pq-neutral-500 hover:text-pq-neutral-900'
          }`}
        >
          {needsAck ? 'Acknowledge PO' : 'View PO'}
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </td>
    </tr>
  );
}
