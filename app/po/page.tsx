'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/structural-skeletons';
import PaginationControls from '@/components/shared/PaginationControls';
import { useAuth } from '@/context/AuthContext';
import { listPOsWithCount, fetchPOStatusCounts } from '@/lib/po';
import type { POStatusCounts } from '@/lib/po';
import type { PORequest } from '@/types/po';
import { PO_STATUS_LABELS } from '@/types/po';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import {
  ShoppingCart, Plus, Building2, User, CalendarDays,
  FileText, Package, ChevronRight,
} from 'lucide-react';

const STATUS_STYLES: Record<string, string> = {
  draft:        'bg-pq-neutral-50 text-pq-neutral-500 border-pq-neutral-200',
  for_approval: 'bg-pq-warning-100 text-pq-warning-600 border-pq-warning-100',
  approved:     'bg-pq-success-100 text-pq-success-600 border-pq-success-100',
  sent:         'bg-sky-50 text-sky-700 border-sky-200',
  cancelled:    'bg-pq-danger-100 text-pq-danger-600 border-pq-danger-100',
};

const STATUS_DOT: Record<string, string> = {
  draft:        'bg-pq-neutral-400',
  for_approval: 'bg-pq-warning-1000 animate-pulse',
  approved:     'bg-pq-success-1000',
  sent:         'bg-sky-500',
  cancelled:    'bg-red-400',
};

export default function POListPage() {
  const { profile } = useAuth();
  const [pos, setPOs] = useState<PORequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 25;
  const [totalCount, setTotalCount] = useState(0);
  const [statusCounts, setStatusCounts] = useState<POStatusCounts>({
    total: 0,
    draft: 0,
    for_approval: 0,
    approved: 0,
  });

  // Load global stat counts once on mount — independent of filters/pagination.
  useEffect(() => {
    fetchPOStatusCounts()
      .then(setStatusCounts)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const offset = (currentPage - 1) * rowsPerPage;
    setLoading(true);
    setError('');

    listPOsWithCount({
      search: appliedSearch || undefined,
      status: selectedStatus !== 'all' ? selectedStatus : undefined,
      limit: rowsPerPage,
      offset,
    })
      .then(result => {
        setPOs(result.pos);
        setTotalCount(result.total_count);
      })
      .catch(() => setError('Failed to load purchase orders.'))
      .finally(() => setLoading(false));
  }, [currentPage, appliedSearch, selectedStatus]);

  const isBuyer = profile?.role === 'procurement' && profile.position === 'Buyer';

  const totalPages = Math.ceil(totalCount / rowsPerPage);

  function handlePreviousPage() {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  }

  function handleNextPage() {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  }

  function handleResetFilters() {
    setSearch('');
    setAppliedSearch('');
    setSelectedStatus('all');
    setCurrentPage(1);
  }

  return (
    <AppShell title="Purchase Orders">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-pq-neutral-900">Purchase Orders</h1>
          <p className="text-sm text-pq-neutral-500 mt-0.5">
            Manage issued purchase orders and track supplier deliveries.
          </p>
        </div>
        {isBuyer && (
          <Link
            href="/po/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-sm font-semibold rounded-md transition"
          >
            <Plus className="w-4 h-4" />
            Generate PO
          </Link>
        )}
      </div>

      {/* Stats — global totals, independent of active filters/pagination */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total POs"    value={statusCounts.total}        color="slate" />
        <StatCard label="Draft"        value={statusCounts.draft}        color="slate" />
        <StatCard label="For Approval" value={statusCounts.for_approval} color="amber" />
        <StatCard label="Approved"     value={statusCounts.approved}     color="emerald" />
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-md border border-pq-neutral-200 p-6 mb-6 space-y-4">
        <h3 className="font-semibold text-pq-neutral-900">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="space-y-1.5">
            <Label htmlFor="po-search" className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
              Search
            </Label>
            <div className="flex gap-2">
              <input
                id="po-search"
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { setAppliedSearch(search); setCurrentPage(1); } }}
                placeholder="PO number or purpose..."
                disabled={loading}
                className="flex-1 px-3 py-2 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] focus:border-transparent transition disabled:opacity-50"
              />
              <button
                onClick={() => { setAppliedSearch(search); setCurrentPage(1); }}
                disabled={loading}
                className="px-3 py-2 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-xs font-semibold rounded-md transition disabled:opacity-50 whitespace-nowrap"
              >
                Apply
              </button>
            </div>
          </div>

          {/* Status Filter */}
          <div className="space-y-1.5">
            <Label htmlFor="status-filter" className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
              Status
            </Label>
            <Select value={selectedStatus} onValueChange={s => { setSelectedStatus(s); setCurrentPage(1); }} disabled={loading}>
              <SelectTrigger id="status-filter" className="text-sm">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="for_approval">For Approval</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reset Button */}
          <div className="flex items-end">
            <button
              onClick={handleResetFilters}
              disabled={loading}
              className="w-full px-3 py-2 text-sm font-medium text-pq-neutral-500 bg-pq-neutral-50 border border-pq-neutral-200 rounded-md hover:bg-pq-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : error ? (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">{error}</div>
      ) : pos.length === 0 ? (
        <div className="bg-white rounded-md border border-pq-neutral-200">
          <EmptyState
            title="No purchase orders found"
            description={appliedSearch || selectedStatus !== 'all' ? 'Try adjusting your filters.' : 'Generate a PO from a fully approved PR2 to get started.'}
            icon={ShoppingCart}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
            <div className="px-6 py-3 border-b border-pq-neutral-200 bg-pq-neutral-50 flex items-center gap-2">
              <ShoppingCart className="w-3.5 h-3.5 text-pq-neutral-400" />
              <span className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                {pos.length} Purchase Order{pos.length !== 1 ? 's' : ''}
              </span>
            </div>
            <ul className="divide-y divide-pq-neutral-200">
              {pos.map(po => (
                <li key={po.id}>
                  <Link
                    href={`/po/${po.id}`}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-pq-neutral-50 transition group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap mb-1">
                        <span className="font-mono font-bold text-pq-neutral-900 text-sm">{po.po_number}</span>
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold border rounded-full px-2.5 py-0.5 ${STATUS_STYLES[po.status] ?? STATUS_STYLES.draft}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[po.status] ?? 'bg-pq-neutral-400'}`} />
                          {PO_STATUS_LABELS[po.status] ?? po.status}
                        </span>
                      </div>
                      <p className="text-sm text-pq-neutral-500 truncate">{po.purpose}</p>
                      <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-xs text-pq-neutral-400">
                          <Package className="w-3 h-3" />
                          {po.supplier_name_snapshot}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-pq-neutral-400">
                          <Building2 className="w-3 h-3" />
                          {po.department_name_snapshot}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-pq-neutral-400">
                          <User className="w-3 h-3" />
                          {po.requisitioner_name_snapshot}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-pq-neutral-400">
                          <CalendarDays className="w-3 h-3" />
                          {format(new Date(po.date_required), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>

                    <div className="hidden md:flex flex-col gap-1 text-right shrink-0">
                      <span className="inline-flex items-center gap-1 text-xs text-pq-neutral-400">
                        <FileText className="w-3 h-3" />
                        <span className="font-mono">{po.pr2_number_snapshot}</span>
                      </span>
                      <span className="text-xs text-pq-neutral-400">
                        {format(new Date(po.generated_at), 'MMM d, yyyy')}
                      </span>
                    </div>

                    <ChevronRight className="w-4 h-4 text-pq-neutral-400 group-hover:text-pq-neutral-500 shrink-0 transition" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Pagination Controls */}
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={rowsPerPage}
            totalCount={totalCount}
            entityLabel="POs"
            loading={loading}
            onPageChange={(page) => {
              if (page < currentPage) handlePreviousPage();
              else handleNextPage();
            }}
            className="rounded-md border border-pq-neutral-200 space-y-4"
          />
        </div>
      )}
    </AppShell>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    slate:   'bg-white border-pq-neutral-200 text-pq-neutral-900',
    amber:   'bg-pq-warning-100 border-pq-warning-100 text-pq-warning-600',
    emerald: 'bg-pq-success-100 border-pq-success-100 text-pq-success-600',
  };
  return (
    <div className={`rounded-md border p-4 ${colorMap[color] ?? colorMap.slate}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium mt-0.5 opacity-70">{label}</p>
    </div>
  );
}
