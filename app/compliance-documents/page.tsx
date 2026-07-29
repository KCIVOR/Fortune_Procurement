'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import EmptyState from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/structural-skeletons';
import PaginationControls from '@/components/shared/PaginationControls';
import FilterBar from '@/components/shared/FilterBar';
import type { FilterConfig } from '@/components/shared/FilterBar.types';
import { StatCard } from '@/components/shared/StatCard';
import {
  fetchAllProcurementCompliancePOs,
  summarizeProcurementComplianceCounts,
  type ProcurementCompliancePO,
} from '@/lib/compliance-documents';
import { format } from 'date-fns';
import {
  FileCheck2, Clock, PackageSearch, CheckCircle2 as CheckCircle, FileText,
} from 'lucide-react';

const ROW_STATUS_STYLES: Record<string, string> = {
  awaiting_grn:   'bg-pq-neutral-50 text-pq-neutral-500 border-pq-neutral-200',
  pending_upload: 'bg-pq-warning-100 text-pq-warning-600 border-pq-warning-100',
  uploaded:       'bg-pq-success-100 text-pq-success-600 border-pq-success-100',
};

/** Overall PO-level status for the row badge: worst-case across its items. */
function poOverallStatus(po: ProcurementCompliancePO): 'awaiting_grn' | 'pending_upload' | 'uploaded' {
  if (po.awaiting_grn_count > 0) return 'awaiting_grn';
  if (po.pending_upload_count > 0) return 'pending_upload';
  return 'uploaded';
}

const STATUS_LABELS: Record<string, string> = {
  awaiting_grn:   'Awaiting GRN',
  pending_upload: 'Pending Upload',
  uploaded:       'All Uploaded',
};

export default function ComplianceDocumentsListPage() {
  const [allPOs, setAllPOs] = useState<ProcurementCompliancePO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 25;

  const load = () => {
    setLoading(true);
    setError('');
    fetchAllProcurementCompliancePOs()
      .then(setAllPOs)
      .catch(() => setError('Failed to load compliance documents.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const counts = useMemo(() => summarizeProcurementComplianceCounts(allPOs), [allPOs]);

  const filteredPOs = useMemo(() => {
    let rows = allPOs;
    if (appliedSearch.trim()) {
      const term = appliedSearch.trim().toLowerCase();
      rows = rows.filter(po =>
        po.po_number.toLowerCase().includes(term) ||
        po.supplier_name.toLowerCase().includes(term)
      );
    }
    if (selectedStatus !== 'all') {
      rows = rows.filter(po => {
        if (selectedStatus === 'awaiting_grn') return po.awaiting_grn_count > 0;
        if (selectedStatus === 'pending_upload') return po.pending_upload_count > 0;
        if (selectedStatus === 'uploaded') return poOverallStatus(po) === 'uploaded';
        return true;
      });
    }
    return rows;
  }, [allPOs, appliedSearch, selectedStatus]);

  const totalCount = filteredPOs.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / rowsPerPage));
  const pagedPOs = filteredPOs.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const filters: FilterConfig[] = [
    {
      type: 'search',
      id: 'compliance-search',
      label: 'Search',
      placeholder: 'PO number or supplier...',
      value: search,
      onChange: (value) => setSearch(value as string),
    },
    {
      type: 'select',
      id: 'compliance-status',
      label: 'Status',
      placeholder: 'All statuses',
      value: selectedStatus,
      onChange: (value) => {
        setSelectedStatus(value as string);
        setCurrentPage(1);
      },
      options: [
        { value: 'all',            label: 'All statuses' },
        { value: 'awaiting_grn',   label: 'Awaiting GRN' },
        { value: 'pending_upload', label: 'Pending Upload' },
        { value: 'uploaded',       label: 'All Uploaded' },
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
    <AppShell title="Compliance Documents">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-pq-neutral-900">Compliance Documents</h1>
          <p className="text-sm text-pq-neutral-500 mt-0.5">
            Track certification and compliance documents suppliers must upload for flagged services PO items.
          </p>
        </div>
      </div>

      {/* Stats — global totals, independent of active filters/pagination */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Flagged POs"
          value={counts.total_pos}
          accent="blue"
          icon={<FileCheck2 className="w-5 h-5" />}
        />
        <StatCard
          label="Awaiting GRN"
          value={counts.awaiting_grn}
          accent="blue"
          icon={<PackageSearch className="w-5 h-5" />}
        />
        <StatCard
          label="Pending Upload"
          value={counts.pending_upload}
          accent="amber"
          icon={<Clock className="w-5 h-5" />}
        />
        <StatCard
          label="Uploaded"
          value={counts.uploaded}
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
        <TableSkeleton rows={5} cols={6} />
      ) : error ? (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">{error}</div>
      ) : pagedPOs.length === 0 ? (
        <div className="bg-white rounded-md border border-pq-neutral-200">
          <EmptyState
            title="No compliance documents found"
            description={appliedSearch || selectedStatus !== 'all' ? 'Try adjusting your filters.' : 'Flag a services PO item as requiring a compliance document to see it here.'}
            icon={FileCheck2}
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
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Supplier</th>
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-right">Items</th>
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-right">Uploaded</th>
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">PO Sent</th>
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-pq-neutral-200">
                  {pagedPOs.map(po => {
                    const overall = poOverallStatus(po);
                    return (
                      <tr key={po.po_id} className="hover:bg-pq-neutral-50 transition">
                        <td className="px-5 py-3.5 font-mono font-bold text-pq-neutral-900 whitespace-nowrap">{po.po_number}</td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold border rounded-full px-2 py-0.5 ${ROW_STATUS_STYLES[overall]}`}>
                            {STATUS_LABELS[overall]}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-pq-neutral-500 whitespace-nowrap max-w-[220px] truncate">{po.supplier_name}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-xs text-pq-neutral-500">{po.items.length}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-xs font-semibold text-pq-success-600">
                          {po.uploaded_count}/{po.items.length}
                        </td>
                        <td className="px-5 py-3.5 text-pq-neutral-400 text-xs whitespace-nowrap">
                          {po.sent_at ? format(new Date(po.sent_at), 'MMM d, yyyy') : '—'}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Link
                            href={`/compliance-documents/${po.po_id}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-pq-neutral-500 hover:text-pq-neutral-900 transition"
                          >
                            View <FileText className="w-3.5 h-3.5" />
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
            entityLabel="POs"
            loading={loading}
            onPageChange={(page) => setCurrentPage(page)}
            className="rounded-md border border-pq-neutral-200 space-y-4"
          />
        </div>
      )}
    </AppShell>
  );
}
