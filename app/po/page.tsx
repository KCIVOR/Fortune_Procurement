'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import { useAuth } from '@/context/AuthContext';
import { listPOsWithCount } from '@/lib/po';
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
  draft:        'bg-[#F7F9FC] text-[#40527A] border-[#D8E2FF]',
  for_approval: 'bg-amber-50 text-amber-700 border-amber-200',
  approved:     'bg-emerald-50 text-emerald-700 border-emerald-200',
  sent:         'bg-sky-50 text-sky-700 border-sky-200',
  cancelled:    'bg-red-50 text-red-500 border-red-200',
};

const STATUS_DOT: Record<string, string> = {
  draft:        'bg-[#BFC7D5]',
  for_approval: 'bg-amber-500 animate-pulse',
  approved:     'bg-emerald-500',
  sent:         'bg-sky-500',
  cancelled:    'bg-red-400',
};

export default function POListPage() {
  const { profile } = useAuth();
  const [pos, setPOs] = useState<PORequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 25;
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const offset = (currentPage - 1) * rowsPerPage;
    setLoading(true);
    setError('');

    listPOsWithCount({
      search: search || undefined,
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
  }, [currentPage, search, selectedStatus]);

  const isBuyer = profile?.role === 'procurement' && profile.position === 'Buyer';

  const stats = {
    total:    totalCount,
    draft:    0,
    pending:  0,
    approved: 0,
  };

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
    setSelectedStatus('all');
    setCurrentPage(1);
  }

  return (
    <AppShell title="Purchase Orders">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#0F1F3A]">Purchase Orders</h1>
          <p className="text-sm text-[#40527A] mt-0.5">
            Manage issued purchase orders and track supplier deliveries.
          </p>
        </div>
        {isBuyer && (
          <Link
            href="/po/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#1E4BFF] hover:bg-[#0F1F3A] text-white text-sm font-semibold rounded-[4px] transition"
          >
            <Plus className="w-4 h-4" />
            Generate PO
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total POs"    value={stats.total}    color="slate" />
        <StatCard label="Draft"        value={pos.filter(p => p.status === 'draft').length}    color="slate" />
        <StatCard label="For Approval" value={pos.filter(p => p.status === 'for_approval').length}  color="amber" />
        <StatCard label="Approved"     value={pos.filter(p => p.status === 'approved' || p.status === 'sent').length} color="emerald" />
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-[4px] border border-[#D8E2FF] p-6 mb-6 space-y-4">
        <h3 className="font-semibold text-[#0F1F3A]">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="space-y-1.5">
            <Label htmlFor="po-search" className="text-xs font-semibold text-[#40527A] uppercase tracking-wide">
              Search
            </Label>
            <input
              id="po-search"
              type="text"
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="PO number or purpose..."
              disabled={loading}
              className="w-full px-3 py-2 border border-[#D8E2FF] rounded-[4px] text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] focus:border-transparent transition disabled:opacity-50"
            />
          </div>

          {/* Status Filter */}
          <div className="space-y-1.5">
            <Label htmlFor="status-filter" className="text-xs font-semibold text-[#40527A] uppercase tracking-wide">
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
              className="w-full px-3 py-2 text-sm font-medium text-[#40527A] bg-[#F7F9FC] border border-[#D8E2FF] rounded-[4px] hover:bg-[#E5EAFF] disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <LoadingState message="Loading purchase orders..." />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-[4px] p-4 text-sm text-red-700">{error}</div>
      ) : pos.length === 0 ? (
        <div className="bg-white rounded-[4px] border border-[#D8E2FF]">
          <EmptyState
            title="No purchase orders found"
            description={search || selectedStatus !== 'all' ? 'Try adjusting your filters.' : 'Generate a PO from a fully approved PR2 to get started.'}
            icon={ShoppingCart}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden">
            <div className="px-6 py-3 border-b border-[#D8E2FF] bg-[#F7F9FC] flex items-center gap-2">
              <ShoppingCart className="w-3.5 h-3.5 text-[#BFC7D5]" />
              <span className="text-xs font-semibold text-[#40527A] uppercase tracking-wide">
                {pos.length} Purchase Order{pos.length !== 1 ? 's' : ''}
              </span>
            </div>
            <ul className="divide-y divide-[#D8E2FF]">
              {pos.map(po => (
                <li key={po.id}>
                  <Link
                    href={`/po/${po.id}`}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-[#F7F9FC] transition group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap mb-1">
                        <span className="font-mono font-bold text-[#0F1F3A] text-sm">{po.po_number}</span>
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold border rounded-full px-2.5 py-0.5 ${STATUS_STYLES[po.status] ?? STATUS_STYLES.draft}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[po.status] ?? 'bg-[#BFC7D5]'}`} />
                          {PO_STATUS_LABELS[po.status] ?? po.status}
                        </span>
                      </div>
                      <p className="text-sm text-[#40527A] truncate">{po.purpose}</p>
                      <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-xs text-[#BFC7D5]">
                          <Package className="w-3 h-3" />
                          {po.supplier_name_snapshot}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-[#BFC7D5]">
                          <Building2 className="w-3 h-3" />
                          {po.department_name_snapshot}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-[#BFC7D5]">
                          <User className="w-3 h-3" />
                          {po.requisitioner_name_snapshot}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-[#BFC7D5]">
                          <CalendarDays className="w-3 h-3" />
                          {format(new Date(po.date_required), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>

                    <div className="hidden md:flex flex-col gap-1 text-right shrink-0">
                      <span className="inline-flex items-center gap-1 text-xs text-[#BFC7D5]">
                        <FileText className="w-3 h-3" />
                        <span className="font-mono">{po.pr2_number_snapshot}</span>
                      </span>
                      <span className="text-xs text-[#BFC7D5]">
                        {format(new Date(po.generated_at), 'MMM d, yyyy')}
                      </span>
                    </div>

                    <ChevronRight className="w-4 h-4 text-[#BFC7D5] group-hover:text-[#40527A] shrink-0 transition" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Pagination Controls */}
          <div className="bg-white rounded-[4px] border border-[#D8E2FF] p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-[#40527A]">
                Showing {Math.min((currentPage - 1) * rowsPerPage + 1, totalCount)}–{Math.min(currentPage * rowsPerPage, totalCount)} of {totalCount} POs
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1 || loading}
                  className="px-3 py-1 text-xs font-medium text-[#40527A] bg-[#F7F9FC] border border-[#D8E2FF] rounded hover:bg-[#E5EAFF] disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Previous
                </button>
                <div className="text-xs text-[#40527A] font-medium">
                  Page {currentPage} of {totalPages}
                </div>
                <button
                  onClick={handleNextPage}
                  disabled={currentPage >= totalPages || loading}
                  className="px-3 py-1 text-xs font-medium text-[#40527A] bg-[#F7F9FC] border border-[#D8E2FF] rounded hover:bg-[#E5EAFF] disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    slate:   'bg-white border-[#D8E2FF] text-[#0F1F3A]',
    amber:   'bg-amber-50 border-amber-200 text-amber-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  };
  return (
    <div className={`rounded-[4px] border p-4 ${colorMap[color] ?? colorMap.slate}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium mt-0.5 opacity-70">{label}</p>
    </div>
  );
}
