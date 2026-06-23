'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import EmptyState from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/structural-skeletons';
import PaginationControls from '@/components/shared/PaginationControls';
import FilterBar from '@/components/shared/FilterBar';
import type { FilterConfig } from '@/components/shared/FilterBar.types';
import { StatCard } from '@/components/shared/StatCard';
import { useAuth } from '@/context/AuthContext';
import { listPOsWithCount, fetchPOStatusCounts, fetchRevisionDraftPOIds } from '@/lib/po';
import { fetchDepartmentOptions } from '@/lib/pr2';
import type { POStatusCounts } from '@/lib/po';
import type { PORequest } from '@/types/po';
import { PO_STATUS_LABELS } from '@/types/po';
import { format } from 'date-fns';
import {
  ShoppingCart, Plus, Building2, User, CalendarDays,
  FileText, Package, ChevronRight, Clock, CircleCheck as CheckCircle2,
  RotateCcw,
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
  const [selectedDept, setSelectedDept] = useState('all');
  const [deptOptions, setDeptOptions] = useState<{ id: string; name: string }[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 25;
  const [totalCount, setTotalCount] = useState(0);
  const [statusCounts, setStatusCounts] = useState<POStatusCounts>({
    total: 0,
    draft: 0,
    for_approval: 0,
    approved: 0,
  });
  const [revisionIds, setRevisionIds] = useState<string[]>([]);
  const revisionIdSet = useMemo(() => new Set(revisionIds), [revisionIds]);

  const canFilterByDept = profile?.role === 'admin' || profile?.role === 'procurement';

  // Load global stat counts and revision IDs once on mount — independent of filters/pagination.
  useEffect(() => {
    fetchPOStatusCounts().then(setStatusCounts).catch(() => {});
    fetchRevisionDraftPOIds().then(setRevisionIds).catch(() => {});
  }, []);

  useEffect(() => {
    if (!canFilterByDept) return;
    fetchDepartmentOptions()
      .then(setDeptOptions)
      .catch(() => {});
  }, [canFilterByDept]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const offset = (currentPage - 1) * rowsPerPage;
    setLoading(true);
    setError('');

    const isRevisionFilter = selectedStatus === 'revision';
    listPOsWithCount({
      search: appliedSearch || undefined,
      status: !isRevisionFilter && selectedStatus !== 'all' ? selectedStatus : undefined,
      ids: isRevisionFilter ? revisionIds : undefined,
      departmentId: canFilterByDept && selectedDept !== 'all' ? selectedDept : undefined,
      limit: rowsPerPage,
      offset,
    })
      .then(result => {
        setPOs(result.pos);
        setTotalCount(result.total_count);
      })
      .catch(() => setError('Failed to load purchase orders.'))
      .finally(() => setLoading(false));
  }, [currentPage, appliedSearch, selectedStatus, selectedDept, canFilterByDept, revisionIds]);

  // Allow PO creation for procurement role users OR users with Buyer position (regardless of role)
  const canCreatePO = profile?.role === 'procurement' || profile?.position === 'Buyer';

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

  // Filter configuration for FilterBar
  const filters: FilterConfig[] = [
    {
      type: 'search',
      id: 'po-search',
      label: 'Search',
      placeholder: 'PO number or purpose...',
      value: search,
      onChange: (value) => setSearch(value as string),
    },
    {
      type: 'select',
      id: 'po-status',
      label: 'Status',
      placeholder: 'All statuses',
      value: selectedStatus,
      onChange: (value) => {
        setSelectedStatus(value as string);
        setCurrentPage(1);
      },
      options: [
        { value: 'all', label: 'All statuses' },
        { value: 'draft', label: 'Draft' },
        { value: 'revision', label: 'Needs Revision' },
        { value: 'for_approval', label: 'For Approval' },
        { value: 'approved', label: 'Approved' },
        { value: 'sent', label: 'Sent' },
        { value: 'cancelled', label: 'Cancelled' },
      ],
    },
    ...(canFilterByDept ? [{
      type: 'select' as const,
      id: 'po-dept',
      label: 'Department',
      placeholder: 'All departments',
      value: selectedDept,
      onChange: (value: string | [string, string]) => {
        setSelectedDept(value as string);
        setCurrentPage(1);
      },
      options: [
        { value: 'all', label: 'All departments' },
        ...deptOptions.map(d => ({ value: d.id, label: d.name })),
      ],
    }] : []),
  ];

  const handleApply = () => {
    setAppliedSearch(search);
    setCurrentPage(1);
  };

  const handleClear = () => {
    setSearch('');
    setAppliedSearch('');
    setSelectedStatus('all');
    setSelectedDept('all');
    setCurrentPage(1);
  };

  return (
    <AppShell title="Purchase Orders">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-pq-neutral-900">Purchase Orders</h1>
          <p className="text-sm text-pq-neutral-500 mt-0.5">
            Manage issued purchase orders and track supplier deliveries.
          </p>
        </div>
        {canCreatePO && (
          <Link
            href="/po/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-sm font-semibold rounded-md transition"
          >
            <Plus className="w-4 h-4" />
            Generate PO
          </Link>
        )}
      </div>

      {revisionIds.length > 0 && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-md bg-pq-warning-50 border border-pq-warning-200">
          <RotateCcw className="w-4 h-4 text-pq-warning-600 shrink-0" />
          <span className="text-sm text-pq-warning-700 font-medium">
            {revisionIds.length} PO{revisionIds.length !== 1 ? 's' : ''} need revision
          </span>
          <button
            onClick={() => { setSelectedStatus('revision'); setCurrentPage(1); }}
            className="ml-auto text-xs font-semibold text-pq-warning-700 underline hover:text-pq-neutral-900 transition"
          >
            Filter to view
          </button>
        </div>
      )}

      {/* Stats — global totals, independent of active filters/pagination */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard 
          label="Total POs" 
          value={statusCounts.total} 
          accent="blue"
          icon={<ShoppingCart className="w-5 h-5" />}
        />
        <StatCard 
          label="Draft" 
          value={statusCounts.draft} 
          accent="blue"
          icon={<FileText className="w-5 h-5" />}
        />
        <StatCard 
          label="For Approval" 
          value={statusCounts.for_approval} 
          accent="amber"
          icon={<Clock className="w-5 h-5" />}
        />
        <StatCard 
          label="Approved" 
          value={statusCounts.approved} 
          accent="green"
          icon={<CheckCircle2 className="w-5 h-5" />}
        />
      </div>

      {/* Filter Bar */}
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
                        {revisionIdSet.has(po.id) ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold border rounded-full px-2.5 py-0.5 bg-pq-warning-100 text-pq-warning-700 border-pq-warning-200">
                            <RotateCcw className="w-3 h-3" />
                            Needs Revision
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold border rounded-full px-2.5 py-0.5 ${STATUS_STYLES[po.status] ?? STATUS_STYLES.draft}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[po.status] ?? 'bg-pq-neutral-400'}`} />
                            {PO_STATUS_LABELS[po.status] ?? po.status}
                          </span>
                        )}
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
