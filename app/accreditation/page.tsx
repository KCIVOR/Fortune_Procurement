'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import StatusChip from '@/components/shared/StatusChip';
import FilterBar from '@/components/shared/FilterBar';
import type { FilterConfig, TabFilter } from '@/components/shared/FilterBar.types';
import PaginationControls from '@/components/shared/PaginationControls';
import { Skeleton } from '@/components/ui/skeleton';
import type { StatusVariant } from '@/components/shared/StatusChip';
import { getAllAccreditationsForProcurement } from '@/lib/accreditation';
import type { AccreditationQueueRow } from '@/lib/accreditation';
import {
  SUPPLY_TYPE_FILTER_OPTIONS,
  matchesSupplyTypeFilter,
  supplyTypeLabel,
  type SupplyTypeFilter,
} from '@/lib/supplier-supply-type';
import CreateSupplierModal from '@/components/procurement/CreateSupplierModal';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';
import { BadgeCheck, ArrowRight, AlertCircle, Plus } from 'lucide-react';

// ─── Status helpers ───────────────────────────────────────────────────────────

function accreditationChip(status: string): { variant: StatusVariant; label: string } {
  const map: Record<string, { variant: StatusVariant; label: string }> = {
    draft:             { variant: 'draft',     label: 'Draft' },
    submitted:         { variant: 'pending',   label: 'Submitted' },
    under_review:      { variant: 'in_review', label: 'Under Procurement Review' },
    missing_documents: { variant: 'pending',   label: 'Missing Documents Requested' },
    approved:          { variant: 'approved',  label: 'Accredited' },
    rejected:          { variant: 'rejected',  label: 'Rejected' },
    withdrawn:         { variant: 'cancelled', label: 'Withdrawn' },
    expired:           { variant: 'cancelled', label: 'Expired' },
  };
  return map[status] ?? { variant: 'draft', label: status };
}

// ─── Filter tab definitions ───────────────────────────────────────────────────

type FilterKey = 'pending' | 'approved' | 'expired' | 'rejected' | 'all';

const PENDING_STATUSES = ['submitted', 'under_review', 'missing_documents'];

const PAGE_SIZE = 20;

function getFilteredRows(rows: AccreditationQueueRow[], filter: FilterKey): AccreditationQueueRow[] {
  switch (filter) {
    case 'pending':
      return rows.filter(r => PENDING_STATUSES.includes(r.status));
    case 'approved':
      return rows.filter(r => r.status === 'approved');
    case 'expired':
      return rows.filter(r => r.status === 'expired');
    case 'rejected':
      return rows.filter(r => r.status === 'rejected');
    case 'all':
    default:
      return rows;
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AccreditationQueuePage() {
  const { profile } = useAuth();
  const [allRows, setAllRows] = useState<AccreditationQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [activeTab, setActiveTab] = useState<FilterKey>('pending');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [supplyTypeFilter, setSupplyTypeFilter] = useState<SupplyTypeFilter>('all');
  const [appliedSupplyTypeFilter, setAppliedSupplyTypeFilter] = useState<SupplyTypeFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const canInviteSupplier =
    profile?.role === 'procurement' || profile?.role === 'admin';

  useEffect(() => {
    setLoading(true);
    setError('');
    getAllAccreditationsForProcurement()
      .then(setAllRows)
      .catch((err: unknown) =>
        setError((err as Error)?.message || 'Failed to load accreditation queue.')
      )
      .finally(() => setLoading(false));
  }, []);

  // Compute counts for tabs
  const counts = useMemo(() => ({
    pending:  allRows.filter(r => PENDING_STATUSES.includes(r.status)).length,
    approved: allRows.filter(r => r.status === 'approved').length,
    expired:  allRows.filter(r => r.status === 'expired').length,
    rejected: allRows.filter(r => r.status === 'rejected').length,
    all:      allRows.length,
  }), [allRows]);

  // Filter rows based on active tab, search, and supply type
  const filteredRows = useMemo(() => {
    let rows = getFilteredRows(allRows, activeTab);
    if (appliedSearch.trim()) {
      const searchLower = appliedSearch.toLowerCase();
      rows = rows.filter(r =>
        (r.supplier_full_name && r.supplier_full_name.toLowerCase().includes(searchLower)) ||
        (r.supplier_email && r.supplier_email.toLowerCase().includes(searchLower))
      );
    }
    if (appliedSupplyTypeFilter !== 'all') {
      rows = rows.filter(r =>
        matchesSupplyTypeFilter(r.supplier_supply_type, appliedSupplyTypeFilter)
      );
    }
    return rows;
  }, [allRows, activeTab, appliedSearch, appliedSupplyTypeFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const paginatedRows = filteredRows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const tabs: TabFilter[] = [
    { value: 'pending',  label: `Pending (${counts.pending})` },
    { value: 'approved', label: `Approved (${counts.approved})` },
    { value: 'expired',  label: `Expired (${counts.expired})` },
    { value: 'rejected', label: `Rejected (${counts.rejected})` },
    { value: 'all',      label: `All (${counts.all})` },
  ];

  const handleClear = () => {
    setSearch('');
    setAppliedSearch('');
    setSupplyTypeFilter('all');
    setAppliedSupplyTypeFilter('all');
    setActiveTab('pending');
    setCurrentPage(1);
  };

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, appliedSearch, appliedSupplyTypeFilter]);

  return (
    <AppShell title="Supplier Accreditation">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <PageHeader
          title="Supplier Accreditation"
          description="Review and process supplier accreditation applications submitted for Procurement approval."
        />
        {canInviteSupplier && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsInviteModalOpen(true)}
            className="shrink-0 text-xs font-medium"
          >
            <Plus className="w-4 h-4 mr-2" />
            Invite Supplier
          </Button>
        )}
      </div>

      {/* FilterBar with tabs and search */}
      {!loading && !error && (
        <FilterBar
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(value) => setActiveTab(value as FilterKey)}
          filters={[
            {
              type: 'search',
              id: 'accreditation-search',
              label: 'Search',
              placeholder: 'Search by supplier name or email...',
              value: search,
              onChange: (value) => setSearch(value as string),
            },
            {
              type: 'select',
              id: 'accreditation-supply-type',
              label: 'Supply type',
              placeholder: 'All supply types',
              value: supplyTypeFilter,
              onChange: (value) => setSupplyTypeFilter(value as SupplyTypeFilter),
              options: SUPPLY_TYPE_FILTER_OPTIONS,
            },
          ] as FilterConfig[]}
          onApply={() => {
            setAppliedSearch(search);
            setAppliedSupplyTypeFilter(supplyTypeFilter);
            setCurrentPage(1);
          }}
          onClear={handleClear}
          loading={loading}
          resultCount={filteredRows.length}
          resultLabel="application"
          className="mb-4"
        />
      )}

      {loading ? (
        <AccreditationQueueSkeleton />
      ) : error ? (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">
          {error}
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="bg-white rounded-md border border-pq-neutral-200">
          <EmptyState
            title={activeTab === 'pending' ? 'No pending applications' : `No ${activeTab} applications`}
            description={
              activeTab === 'pending'
                ? 'Submitted supplier accreditation applications will appear here for review.'
                : 'No accreditation applications match this filter.'
            }
            icon={BadgeCheck}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-pq-neutral-200 bg-pq-neutral-50/50">
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Supplier</th>
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Email</th>
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Supply type</th>
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Status</th>
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Submitted</th>
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Reviewed</th>
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-pq-neutral-200">
                  {paginatedRows.map(row => (
                    <QueueRow key={row.id} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={PAGE_SIZE}
            totalCount={filteredRows.length}
            entityLabel="applications"
            loading={loading}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {canInviteSupplier && (
        <CreateSupplierModal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
        />
      )}
    </AppShell>
  );
}

// ─── Queue row ────────────────────────────────────────────────────────────────

function QueueRow({ row }: { row: AccreditationQueueRow }) {
  const chip = accreditationChip(row.status);
  const isActionable = ['submitted', 'under_review', 'missing_documents'].includes(row.status);

  return (
    <tr className="hover:bg-pq-neutral-50 transition">
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm text-pq-neutral-900">{row.supplier_full_name ?? 'Unknown Supplier'}</span>
          {row.status === 'missing_documents' && (
            <span className="inline-flex items-center gap-1 text-xs text-pq-warning-600 bg-pq-warning-100 border border-pq-warning-100 rounded-full px-2 py-0.5">
              <AlertCircle className="w-3 h-3" />
              Action Required
            </span>
          )}
        </div>
      </td>
      <td className="px-5 py-3.5 text-pq-neutral-400 text-xs">{row.supplier_email ?? '—'}</td>
      <td className="px-5 py-3.5 text-pq-neutral-700 text-xs whitespace-nowrap">
        {supplyTypeLabel(row.supplier_supply_type)}
      </td>
      <td className="px-5 py-3.5">
        <StatusChip status={chip.variant} label={chip.label} size="sm" />
      </td>
      <td className="px-5 py-3.5 text-pq-neutral-400 text-xs whitespace-nowrap">
        {row.submitted_at ? format(new Date(row.submitted_at), 'MMM d, yyyy') : '—'}
      </td>
      <td className="px-5 py-3.5 text-pq-neutral-400 text-xs whitespace-nowrap">
        {row.reviewed_at ? format(new Date(row.reviewed_at), 'MMM d, yyyy') : '—'}
      </td>
      <td className="px-5 py-3.5 text-right">
        <Link
          href={`/accreditation/${row.id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-pq-neutral-500 hover:text-pq-neutral-900 transition"
        >
          {isActionable ? 'Review' : 'View'}
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </td>
    </tr>
  );
}

// ─── Skeleton loading ─────────────────────────────────────────────────────────

function AccreditationQueueSkeleton() {
  return (
    <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden" aria-busy="true" aria-label="Loading accreditation queue">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-pq-neutral-200 bg-pq-neutral-50/50">
              {['Supplier', 'Email', 'Supply type', 'Status', 'Submitted', 'Reviewed', ''].map((h, i) => (
                <th key={i} className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">
                  {h && <Skeleton className="h-3 w-16" />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-pq-neutral-200">
            {Array.from({ length: 5 }, (_, i) => (
              <tr key={i}>
                <td className="px-5 py-3.5"><Skeleton className="h-4 w-40" /></td>
                <td className="px-5 py-3.5"><Skeleton className="h-3 w-36" /></td>
                <td className="px-5 py-3.5"><Skeleton className="h-3 w-20" /></td>
                <td className="px-5 py-3.5"><Skeleton className="h-5 w-32 rounded-full" /></td>
                <td className="px-5 py-3.5"><Skeleton className="h-3 w-24" /></td>
                <td className="px-5 py-3.5"><Skeleton className="h-3 w-24" /></td>
                <td className="px-5 py-3.5"><Skeleton className="h-4 w-14" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
