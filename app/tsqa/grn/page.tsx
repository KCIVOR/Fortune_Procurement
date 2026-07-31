'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/structural-skeletons';
import PaginationControls from '@/components/shared/PaginationControls';
import FilterBar from '@/components/shared/FilterBar';
import type { FilterConfig } from '@/components/shared/FilterBar.types';
import { StatCard } from '@/components/shared/StatCard';
import StatusChip from '@/components/shared/StatusChip';
import type { StatusVariant } from '@/components/shared/StatusChip';
import { useAuth } from '@/context/AuthContext';
import { fetchTSQAGRNQueue, type TSQAGRNQueueRow } from '@/lib/grn-tsqa';
import { GRN_STATUS_LABELS } from '@/types/grn';
import { format } from 'date-fns';
import {
  ClipboardList, ArrowRight, FlaskConical, CheckCircle2, PackageSearch, Clock, XCircle,
} from 'lucide-react';

function grnChip(status: string): { variant: StatusVariant; label: string } {
  if (status === 'pending_qa') return { variant: 'in_review', label: GRN_STATUS_LABELS.pending_qa };
  if (status === 'closed') return { variant: 'approved', label: GRN_STATUS_LABELS.closed };
  return { variant: 'pending', label: GRN_STATUS_LABELS.open };
}

export default function TSQAGRNQueuePage() {
  const { profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const qaComplete = searchParams.get('qa_complete') === '1';

  const [allRows, setAllRows] = useState<TSQAGRNQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedQaStatus, setSelectedQaStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 20;

  const load = () => {
    if (!profile) return;
    setLoading(true);
    setError('');
    fetchTSQAGRNQueue()
      .then(setAllRows)
      .catch((err: unknown) => setError((err as Error)?.message || 'Failed to load GRN QA queue.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (profile && profile.role !== 'tsqa' && profile.role !== 'admin') {
      router.replace('/dashboard');
      return;
    }
    load();
  }, [profile, router]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPendingItems = useMemo(
    () => allRows.reduce((sum, r) => sum + r.pending_qa_count, 0),
    [allRows],
  );

  const totalRejectedItems = useMemo(
    () => allRows.reduce((sum, r) => sum + r.rejected_qa_count, 0),
    [allRows],
  );

  const filteredRows = useMemo(() => {
    let rows = allRows;
    if (appliedSearch.trim()) {
      const term = appliedSearch.trim().toLowerCase();
      rows = rows.filter(r =>
        r.grn_number.toLowerCase().includes(term) ||
        r.po_number_snapshot.toLowerCase().includes(term) ||
        r.supplier_name_snapshot.toLowerCase().includes(term)
      );
    }
    if (selectedStatus !== 'all') {
      rows = rows.filter(r => r.status === selectedStatus);
    }
    if (selectedQaStatus === 'pending') {
      rows = rows.filter(r => r.pending_qa_count > 0);
    } else if (selectedQaStatus === 'rejected') {
      rows = rows.filter(r => r.rejected_qa_count > 0);
    } else if (selectedQaStatus === 'approved') {
      rows = rows.filter(r => r.approved_qa_count > 0);
    }
    return rows;
  }, [allRows, appliedSearch, selectedStatus, selectedQaStatus]);

  const totalCount = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / rowsPerPage));
  const pagedRows = filteredRows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const filters: FilterConfig[] = [
    {
      type: 'search',
      id: 'grn-qa-search',
      label: 'Search',
      placeholder: 'GRN number, PO ref, or supplier...',
      value: search,
      onChange: (value) => setSearch(value as string),
    },
    {
      type: 'select',
      id: 'grn-qa-status',
      label: 'Status',
      placeholder: 'All statuses',
      value: selectedStatus,
      onChange: (value) => {
        setSelectedStatus(value as string);
        setCurrentPage(1);
      },
      options: [
        { value: 'all',        label: 'All statuses' },
        { value: 'pending_qa', label: 'Pending QA' },
        { value: 'open',       label: 'Open' },
        { value: 'closed',     label: 'Closed' },
      ],
    },
    {
      type: 'select',
      id: 'grn-qa-item-status',
      label: 'QA Item Status',
      placeholder: 'All',
      value: selectedQaStatus,
      onChange: (value) => {
        setSelectedQaStatus(value as string);
        setCurrentPage(1);
      },
      options: [
        { value: 'all',      label: 'All' },
        { value: 'pending',  label: 'Pending' },
        { value: 'approved', label: 'Approved' },
        { value: 'rejected', label: 'Rejected' },
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
    setSelectedQaStatus('all');
    setCurrentPage(1);
  };

  return (
    <AppShell title="GRN QA Queue">
      <PageHeader
        title="GRN QA Queue"
        description="Inspect and approve flagged receipt items requiring QA inspection."
      />

      {qaComplete && (
        <div className="flex items-start gap-3 bg-pq-success-100 border border-pq-success-100 rounded-md px-5 py-4 mb-4">
          <CheckCircle2 className="w-4 h-4 text-pq-success-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-pq-success-600">All QA items approved</p>
            <p className="text-xs text-pq-success-600 mt-0.5">Warehouse may close the GRN when ready.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="GRNs in Queue"
          value={allRows.length}
          accent="blue"
          icon={<PackageSearch className="w-5 h-5" />}
        />
        <StatCard
          label="Items Pending QA"
          value={totalPendingItems}
          accent="amber"
          icon={<Clock className="w-5 h-5" />}
        />
        <StatCard
          label="Items Rejected"
          value={totalRejectedItems}
          accent="red"
          icon={<XCircle className="w-5 h-5" />}
        />
        <StatCard
          label="Fully Approved"
          value={allRows.filter(r => r.pending_qa_count === 0 && r.rejected_qa_count === 0).length}
          accent="green"
          icon={<CheckCircle2 className="w-5 h-5" />}
        />
      </div>

      <FilterBar
        filters={filters}
        onApply={handleApply}
        onClear={handleClear}
        loading={loading}
        resultCount={totalCount}
        resultLabel="GRN"
        className="mb-6"
      />

      {loading ? (
        <TableSkeleton rows={5} cols={7} />
      ) : error ? (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">
          {error}
        </div>
      ) : pagedRows.length === 0 ? (
        <div className="bg-white rounded-md border border-pq-neutral-200">
          <EmptyState
            icon={FlaskConical}
            title="No GRNs found"
            description={appliedSearch || selectedStatus !== 'all' || selectedQaStatus !== 'all' ? 'Try adjusting your filters.' : 'Warehouse-flagged items will appear here when QA inspection is required.'}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
            <div className="px-5 py-2.5 border-b border-pq-neutral-200 bg-pq-neutral-50 flex items-center gap-2">
              <ClipboardList className="w-3.5 h-3.5 text-pq-neutral-400" />
              <span className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                {totalCount} GRN{totalCount !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-pq-neutral-200 bg-pq-neutral-50/50">
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">GRN No.</th>
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Status</th>
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">PO Ref</th>
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Supplier</th>
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Warehouse</th>
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Txn Date</th>
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-right">QA Items</th>
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-pq-neutral-200">
                  {pagedRows.map((row) => {
                    const chip = grnChip(row.status);
                    return (
                      <tr key={row.grn_id} className="hover:bg-pq-neutral-50 transition">
                        <td className="px-5 py-3.5 font-mono text-xs font-bold text-pq-neutral-900 whitespace-nowrap">
                          {row.grn_number}
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusChip status={chip.variant} label={chip.label} size="sm" />
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs text-pq-neutral-500">{row.po_number_snapshot}</td>
                        <td className="px-5 py-3.5 text-pq-neutral-500 max-w-[180px] truncate">{row.supplier_name_snapshot}</td>
                        <td className="px-5 py-3.5 text-pq-neutral-400 text-xs">{row.warehouse}</td>
                        <td className="px-5 py-3.5 text-pq-neutral-400 text-xs whitespace-nowrap">
                          {row.transaction_date ? format(new Date(row.transaction_date), 'MMM d, yyyy') : '—'}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="inline-flex items-center gap-2 font-mono text-xs font-semibold">
                            {row.pending_qa_count > 0 && (
                              <span className="text-pq-warning-600">{row.pending_qa_count} pending</span>
                            )}
                            {row.rejected_qa_count > 0 && (
                              <span className="text-pq-danger-600">{row.rejected_qa_count} rejected</span>
                            )}
                            {row.approved_qa_count > 0 && (
                              <span className="text-pq-success-600">{row.approved_qa_count} approved</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Link
                            href={`/tsqa/grn/${row.grn_id}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-pq-neutral-500 hover:text-pq-neutral-900 transition"
                          >
                            Inspect
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={rowsPerPage}
            totalCount={totalCount}
            entityLabel="GRNs"
            loading={loading}
            onPageChange={(page) => setCurrentPage(page)}
            className="rounded-md border border-pq-neutral-200 space-y-4"
          />
        </div>
      )}
    </AppShell>
  );
}
