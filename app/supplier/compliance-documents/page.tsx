'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/structural-skeletons';
import PaginationControls from '@/components/shared/PaginationControls';
import FilterBar from '@/components/shared/FilterBar';
import type { FilterConfig } from '@/components/shared/FilterBar.types';
import { StatCard } from '@/components/shared/StatCard';
import { useAuth } from '@/context/AuthContext';
import {
  fetchSupplierCompliancePOs,
  summarizeSupplierComplianceCounts,
  type CompliancePOSummary,
} from '@/lib/compliance-documents';
import { format } from 'date-fns';
import {
  FileCheck2, Clock, CheckCircle2 as CheckCircle, FileText, ShoppingCart,
} from 'lucide-react';

/** PO-level status for the row badge: pending if any item still needs an upload. */
function poOverallStatus(po: CompliancePOSummary): 'pending' | 'uploaded' {
  return po.items.some(i => i.documents.length === 0) ? 'pending' : 'uploaded';
}

const STATUS_STYLES: Record<string, string> = {
  pending:  'bg-pq-warning-100 text-pq-warning-600 border-pq-warning-100',
  uploaded: 'bg-pq-success-100 text-pq-success-600 border-pq-success-100',
};
const STATUS_LABELS: Record<string, string> = {
  pending:  'Pending Upload',
  uploaded: 'All Uploaded',
};

export default function SupplierComplianceDocumentsListPage() {
  const { profile } = useAuth();
  const router = useRouter();

  const [allPOs, setAllPOs] = useState<CompliancePOSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 20;

  const isServiceSupplier = profile?.supplier_supply_type === 'service';

  const load = () => {
    if (!profile) return;
    setLoading(true);
    setError('');
    fetchSupplierCompliancePOs(profile.id)
      .then(setAllPOs)
      .catch((err: unknown) => setError((err as Error)?.message || 'Failed to load.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!profile) return;
    if (profile.role !== 'supplier' || profile.supplier_supply_type !== 'service') {
      router.replace('/dashboard');
      return;
    }
    load();
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => summarizeSupplierComplianceCounts(allPOs), [allPOs]);

  const filteredPOs = useMemo(() => {
    let rows = allPOs;
    if (appliedSearch.trim()) {
      const term = appliedSearch.trim().toLowerCase();
      rows = rows.filter(po => po.po_number.toLowerCase().includes(term));
    }
    if (selectedStatus !== 'all') {
      rows = rows.filter(po => poOverallStatus(po) === selectedStatus);
    }
    return rows;
  }, [allPOs, appliedSearch, selectedStatus]);

  const totalCount = filteredPOs.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / rowsPerPage));
  const pagedPOs = filteredPOs.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const filters: FilterConfig[] = [
    {
      type: 'search',
      id: 'supplier-compliance-search',
      label: 'Search',
      placeholder: 'PO number...',
      value: search,
      onChange: (value) => setSearch(value as string),
    },
    {
      type: 'select',
      id: 'supplier-compliance-status',
      label: 'Status',
      placeholder: 'All statuses',
      value: selectedStatus,
      onChange: (value) => {
        setSelectedStatus(value as string);
        setCurrentPage(1);
      },
      options: [
        { value: 'all',      label: 'All statuses' },
        { value: 'pending',  label: 'Pending Upload' },
        { value: 'uploaded', label: 'All Uploaded' },
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

  if (!isServiceSupplier) return null;

  return (
    <AppShell title="Compliance Documents">
      <PageHeader
        title="Compliance Documents"
        description="Upload certification and compliance documents required for your service deliveries (e.g., Certificates of Calibration)."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Total POs"
          value={counts.total_pos}
          accent="blue"
          icon={<ShoppingCart className="w-5 h-5" />}
        />
        <StatCard
          label="Pending Upload"
          value={counts.pending_items}
          accent="amber"
          icon={<Clock className="w-5 h-5" />}
        />
        <StatCard
          label="Uploaded"
          value={counts.uploaded_items}
          accent="green"
          icon={<CheckCircle className="w-5 h-5" />}
        />
      </div>

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
        <TableSkeleton rows={5} cols={5} />
      ) : error ? (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">{error}</div>
      ) : pagedPOs.length === 0 ? (
        <div className="bg-white rounded-md border border-pq-neutral-200">
          <EmptyState
            icon={FileCheck2}
            title="No compliance documents required"
            description={appliedSearch || selectedStatus !== 'all' ? 'Try adjusting your filters.' : 'When a service PO requires certification or compliance documentation, it will appear here.'}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
            <div className="px-5 py-2.5 border-b border-pq-neutral-200 bg-pq-neutral-50 flex items-center gap-2">
              <FileCheck2 className="w-3.5 h-3.5 text-pq-neutral-400" />
              <span className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                {totalCount} Purchase Order{totalCount !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-pq-neutral-200 bg-pq-neutral-50/50">
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">PO No.</th>
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Status</th>
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-right">Items</th>
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-right">Uploaded</th>
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">PO Sent</th>
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-pq-neutral-200">
                  {pagedPOs.map(po => {
                    const overall = poOverallStatus(po);
                    const uploaded = po.items.filter(i => i.documents.length > 0).length;
                    return (
                      <tr key={po.po_id} className="hover:bg-pq-neutral-50 transition">
                        <td className="px-5 py-3.5 font-mono font-bold text-pq-neutral-900 whitespace-nowrap">{po.po_number}</td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold border rounded-full px-2 py-0.5 ${STATUS_STYLES[overall]}`}>
                            {STATUS_LABELS[overall]}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-xs text-pq-neutral-500">{po.items.length}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-xs font-semibold text-pq-success-600">
                          {uploaded}/{po.items.length}
                        </td>
                        <td className="px-5 py-3.5 text-pq-neutral-400 text-xs whitespace-nowrap">
                          {po.sent_at ? format(new Date(po.sent_at), 'MMM d, yyyy') : '—'}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Link
                            href={`/supplier/compliance-documents/${po.po_id}`}
                            className={`inline-flex items-center gap-1 text-xs font-semibold transition ${
                              overall === 'pending' ? 'text-pq-warning-600 hover:text-pq-neutral-900' : 'text-pq-neutral-500 hover:text-pq-neutral-900'
                            }`}
                          >
                            {overall === 'pending' ? 'Upload' : 'View'} <FileText className="w-3.5 h-3.5" />
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
            entityLabel="purchase orders"
            loading={loading}
            onPageChange={(page) => setCurrentPage(page)}
            className="rounded-md border border-pq-neutral-200 space-y-4"
          />
        </div>
      )}
    </AppShell>
  );
}
