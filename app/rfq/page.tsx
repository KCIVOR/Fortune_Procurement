'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/structural-skeletons';
import PaginationControls from '@/components/shared/PaginationControls';
import FilterBar from '@/components/shared/FilterBar';
import type { FilterConfig } from '@/components/shared/FilterBar.types';
import { fetchCanvassingQueuePaged, createRfq } from '@/lib/canvassing';
import { fetchDepartmentOptions } from '@/lib/pr2';
import { useAuth } from '@/context/AuthContext';
import type { CanvassingQueueRow } from '@/types/canvassing';
import { SendHorizontal as SendHorizonal, ArrowRight, Clock, Plus, CalendarDays, Building2, CircleDot, CheckCheck } from 'lucide-react';
import { format } from 'date-fns';
import PriorityChip from '@/components/shared/PriorityChip';
import { StatCard } from '@/components/shared/StatCard';
import { KPI_GRID_CLASS } from '@/components/shared/kpi-grid';

const RFQ_STATUS_LABEL: Record<string, string> = {
  draft:     'Draft',
  open:      'Open',
  closed:    'Closed',
  cancelled: 'Cancelled',
};

const RFQ_STATUS_COLOR: Record<string, string> = {
  draft:     'bg-pq-neutral-50 text-pq-neutral-500 border-pq-neutral-200',
  open:      'bg-pq-warning-100 text-pq-warning-600 border-pq-warning-100',
  closed:    'bg-pq-success-100 text-pq-success-600 border-pq-success-100',
  cancelled: 'bg-pq-danger-100 text-pq-danger-600 border-pq-danger-100',
};

export default function RFQQueuePage() {
  const { profile } = useAuth();
  const [rows, setRows]       = useState<CanvassingQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 20;
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch]               = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selectedDept, setSelectedDept]   = useState('all');
  const [deptOptions, setDeptOptions]     = useState<{ id: string; name: string }[]>([]);

  const canFilterByDept = profile?.role === 'admin' || profile?.role === 'procurement';

  const [creating, setCreating]       = useState(false);
  const [selectedPr1, setSelectedPr1] = useState<CanvassingQueueRow | null>(null);
  const [deadline, setDeadline]       = useState('');
  const [notes, setNotes]             = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    if (!canFilterByDept) return;
    fetchDepartmentOptions()
      .then(setDeptOptions)
      .catch(() => {});
  }, [canFilterByDept]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = () => {
    const offset = (currentPage - 1) * rowsPerPage;
    setLoading(true);
    fetchCanvassingQueuePaged({
      limit:  rowsPerPage,
      offset,
      search: appliedSearch.trim() || undefined,
      departmentId: canFilterByDept && selectedDept !== 'all' ? selectedDept : undefined,
    })
      .then(result => {
        setRows(result.rows);
        setTotalCount(result.total_count);
      })
      .catch(() => setError('Failed to load canvassing queue.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [currentPage, appliedSearch, selectedDept, canFilterByDept]); // eslint-disable-line react-hooks/exhaustive-deps

  const noRfq    = rows.filter(r => !r.rfq_id);
  const hasRfq   = rows.filter(r => !!r.rfq_id);
  const totalPages = Math.ceil(totalCount / rowsPerPage);

  const handleOpenCreate = (row: CanvassingQueueRow) => {
    setSelectedPr1(row);
    setDeadline('');
    setNotes('');
    setCreateError('');
    setCreating(true);
  };

  const handleCreate = async () => {
    if (!selectedPr1 || !profile) return;
    setSubmitting(true);
    setCreateError('');
    try {
      const rfqId = await createRfq(selectedPr1.pr1_id, deadline || null, notes, profile);
      setCreating(false);
      setCurrentPage(1);
      window.location.href = `/rfq/${rfqId}`;
    } catch (e: any) {
      setCreateError(e.message ?? 'Failed to create RFQ.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter configuration for FilterBar
  const filters: FilterConfig[] = [
    {
      type: 'search',
      id: 'rfq-search',
      label: 'Search',
      placeholder: 'PR1 number, purpose, department, requester, or RFQ number…',
      value: search,
      onChange: (value) => setSearch(value as string),
    },
    ...(canFilterByDept ? [{
      type: 'select' as const,
      id: 'rfq-dept',
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
    setSelectedDept('all');
    setCurrentPage(1);
  };

  return (
    <AppShell title="Canvassing Queue">
      <PageHeader
        title="Canvassing Queue"
        description="PR1s approved for canvassing. Create and manage RFQs to collect supplier quotations."
      />

      <FilterBar
        filters={filters}
        onApply={handleApply}
        onClear={handleClear}
        loading={loading}
        resultCount={totalCount}
        resultLabel="item"
        className="mb-4"
      />

      {loading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : error ? (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">{error}</div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-md border border-pq-neutral-200">
          <EmptyState
            title={appliedSearch.trim() ? 'No matching PR1s' : 'No PR1s for canvassing'}
            description={
              appliedSearch.trim()
                ? 'No queue items match your search. Try different keywords or Clear search.'
                : 'PR1s that have completed the approval workflow will appear here.'
            }
            icon={SendHorizonal}
          />
        </div>
      ) : (
        <div className="space-y-6">
          <div className={`${KPI_GRID_CLASS} mb-1`}>
            <StatCard
              label="Awaiting RFQ"
              value={noRfq.length}
              accent="amber"
              icon={<Clock className="w-5 h-5" />}
            />
            <StatCard
              label="Active RFQs"
              value={hasRfq.filter(r => r.rfq_status === 'open').length}
              accent="blue"
              icon={<CircleDot className="w-5 h-5" />}
            />
            <StatCard
              label="Canvassing Complete"
              value={hasRfq.filter(r => r.rfq_status === 'closed').length}
              accent="green"
              icon={<CheckCheck className="w-5 h-5" />}
            />
          </div>

          {noRfq.length > 0 && (
            <Section title="Awaiting RFQ" accent="amber" count={noRfq.length}>
              <div className="divide-y divide-pq-neutral-200">
                {noRfq.map(row => (
                  <QueueRow key={row.pr1_id} row={row} onCreateRfq={handleOpenCreate} />
                ))}
              </div>
            </Section>
          )}

          {hasRfq.length > 0 && (
            <Section title="RFQ Issued" accent="slate" count={hasRfq.length}>
              <div className="divide-y divide-pq-neutral-200">
                {hasRfq.map(row => (
                  <QueueRow key={row.pr1_id} row={row} onCreateRfq={handleOpenCreate} />
                ))}
              </div>
            </Section>
          )}

          {totalCount > 0 && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={rowsPerPage}
              totalCount={totalCount}
              entityLabel="items"
              loading={loading}
              onPageChange={(page) => {
                if (page < currentPage) setCurrentPage(p => Math.max(1, p - 1));
                else setCurrentPage(p => Math.min(totalPages, p + 1));
              }}
            />
          )}
        </div>
      )}

      {creating && selectedPr1 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-md w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-5 border-b border-pq-neutral-200">
              <h2 className="text-base font-semibold text-pq-neutral-900">Create RFQ</h2>
              <p className="text-xs text-pq-neutral-500 mt-0.5">
                For PR1 <span className="font-mono font-semibold">{selectedPr1.pr1_number}</span>
                {' '}— {selectedPr1.purpose}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
                  Quotation Deadline <span className="text-pq-neutral-400 font-normal normal-case">(optional)</span>
                </label>
                <input
                  type="date"
                  value={deadline}
                  onChange={e => setDeadline(e.target.value)}
                  className="w-full px-3 py-2 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
                  Notes <span className="text-pq-neutral-400 font-normal normal-case">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Specifications, brand preferences, delivery requirements..."
                  className="w-full px-3 py-2.5 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] resize-none"
                />
              </div>
              {createError && (
                <p className="text-sm text-pq-danger-600">{createError}</p>
              )}
            </div>
            <div className="px-6 pb-5 flex items-center justify-end gap-3">
              <button
                onClick={() => setCreating(false)}
                disabled={submitting}
                className="px-4 py-2 text-sm text-pq-neutral-500 hover:text-pq-neutral-900 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="px-5 py-2 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-sm font-semibold rounded-md transition disabled:opacity-50"
              >
                {submitting ? 'Creating...' : 'Create RFQ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function QueueRow({
  row,
  onCreateRfq,
}: {
  row: CanvassingQueueRow;
  onCreateRfq: (row: CanvassingQueueRow) => void;
}) {
  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-pq-neutral-50 transition">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-mono text-xs font-bold text-pq-neutral-900">{row.pr1_number}</span>
          <PriorityChip priority={row.priority || 'normal'} />
          {row.rfq_number && (
            <span className="font-mono text-xs text-pq-primary-600 font-semibold">→ {row.rfq_number}</span>
          )}
          {row.rfq_status && (
            <span className={`inline-flex items-center text-xs font-medium border rounded-full px-2 py-0.5 ${RFQ_STATUS_COLOR[row.rfq_status] ?? ''}`}>
              {RFQ_STATUS_LABEL[row.rfq_status] ?? row.rfq_status}
            </span>
          )}
        </div>
        <p className="text-sm text-pq-neutral-900 truncate">{row.purpose}</p>
        <div className="flex items-center gap-3 mt-1">
          <span className="inline-flex items-center gap-1 text-xs text-pq-neutral-400">
            <Building2 className="w-3 h-3" />
            {row.department_name_snapshot}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-pq-neutral-400">
            <CalendarDays className="w-3 h-3" />
            Need by {format(new Date(row.date_required), 'MMM d, yyyy')}
          </span>
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-2">
        {!row.rfq_id ? (
          <button
            onClick={() => onCreateRfq(row)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-xs font-semibold rounded-md transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Create RFQ
          </button>
        ) : (
          <Link
            href={`/rfq/${row.rfq_id}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-pq-primary-600 hover:text-pq-neutral-900 transition"
          >
            Open RFQ
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  accent,
  count,
  children,
}: {
  title: string;
  accent: 'amber' | 'slate' | 'blue' | 'emerald';
  count: number;
  children: React.ReactNode;
}) {
  const accentClass = {
    amber:   'border-amber-300 bg-pq-warning-100 text-pq-warning-600',
    slate:   'border-pq-neutral-200 bg-pq-neutral-50 text-pq-neutral-500',
    blue:    'border-pq-primary-200 bg-pq-primary-50 text-pq-primary-700',
    emerald: 'border-pq-success-100 bg-pq-success-100 text-pq-success-600',
  }[accent];

  return (
    <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-pq-neutral-200">
        <h2 className="text-sm font-semibold text-pq-neutral-900">{title}</h2>
        <span className={`text-xs font-semibold border rounded-full px-2 py-0.5 ${accentClass}`}>{count}</span>
      </div>
      {children}
    </div>
  );
}
