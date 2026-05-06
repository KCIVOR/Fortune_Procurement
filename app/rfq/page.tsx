'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import PaginationControls from '@/components/shared/PaginationControls';
import { fetchCanvassingQueuePaged, createRfq } from '@/lib/canvassing';
import { useAuth } from '@/context/AuthContext';
import type { CanvassingQueueRow } from '@/types/canvassing';
import { SendHorizontal as SendHorizonal, ArrowRight, Clock, Plus, CalendarDays, Building2, CircleDot, CheckCheck, CircleAlert as AlertCircle, TriangleAlert as AlertTriangle, Search } from 'lucide-react';
import { format } from 'date-fns';
import PriorityChip from '@/components/shared/PriorityChip';
import { Label } from '@/components/ui/label';

const RFQ_STATUS_LABEL: Record<string, string> = {
  draft:     'Draft',
  open:      'Open',
  closed:    'Closed',
  cancelled: 'Cancelled',
};

const RFQ_STATUS_COLOR: Record<string, string> = {
  draft:     'bg-[#F7F9FC] text-[#40527A] border-[#D8E2FF]',
  open:      'bg-amber-50 text-amber-700 border-amber-200',
  closed:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-50 text-red-600 border-red-200',
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

  const [creating, setCreating]       = useState(false);
  const [selectedPr1, setSelectedPr1] = useState<CanvassingQueueRow | null>(null);
  const [deadline, setDeadline]       = useState('');
  const [notes, setNotes]             = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [createError, setCreateError] = useState('');

  const load = () => {
    const offset = (currentPage - 1) * rowsPerPage;
    setLoading(true);
    fetchCanvassingQueuePaged({
      limit:  rowsPerPage,
      offset,
      search: appliedSearch.trim() || undefined,
    })
      .then(result => {
        setRows(result.rows);
        setTotalCount(result.total_count);
      })
      .catch(() => setError('Failed to load canvassing queue.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [currentPage, appliedSearch]); // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <AppShell title="Canvassing Queue">
      <PageHeader
        title="Canvassing Queue"
        description="PR1s approved for canvassing. Create and manage RFQs to collect supplier quotations."
      />

      <div className="bg-white rounded-[4px] border border-[#D8E2FF] p-4 mb-4">
        <Label htmlFor="rfq-search" className="text-xs font-semibold text-[#40527A] uppercase tracking-wide block mb-1.5">
          Search
        </Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#BFC7D5]" />
            <input
              id="rfq-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setAppliedSearch(search); setCurrentPage(1); } }}
              placeholder="PR1 number, purpose, department, requester, or RFQ number…"
              disabled={loading}
              className="w-full pl-9 pr-3 py-2 border border-[#D8E2FF] rounded-[4px] text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] focus:border-transparent transition disabled:opacity-50"
            />
          </div>
          <button
            type="button"
            onClick={() => { setAppliedSearch(search); setCurrentPage(1); }}
            disabled={loading}
            className="px-3 py-2 bg-[#1E4BFF] hover:bg-[#0F1F3A] text-white text-xs font-semibold rounded-[4px] transition disabled:opacity-50 whitespace-nowrap"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => { setSearch(''); setAppliedSearch(''); setCurrentPage(1); }}
            disabled={loading}
            className="px-3 py-2 text-xs font-medium text-[#40527A] bg-[#F7F9FC] border border-[#D8E2FF] rounded-[4px] hover:bg-[#E5EAFF] disabled:opacity-50 transition whitespace-nowrap"
          >
            Clear
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <LoadingState message="Loading queue..." />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-[4px] p-4 text-sm text-red-700">{error}</div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-[4px] border border-[#D8E2FF]">
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard label="Awaiting RFQ"         value={noRfq.length}  color="amber"   icon={Clock} />
            <StatCard label="Active RFQs"           value={hasRfq.filter(r => r.rfq_status === 'open').length}   color="blue"    icon={CircleDot} />
            <StatCard label="Canvassing Complete"   value={hasRfq.filter(r => r.rfq_status === 'closed').length} color="emerald" icon={CheckCheck} />
          </div>

          {noRfq.length > 0 && (
            <Section title="Awaiting RFQ" accent="amber" count={noRfq.length}>
              <div className="divide-y divide-[#D8E2FF]">
                {noRfq.map(row => (
                  <QueueRow key={row.pr1_id} row={row} onCreateRfq={handleOpenCreate} />
                ))}
              </div>
            </Section>
          )}

          {hasRfq.length > 0 && (
            <Section title="RFQ Issued" accent="slate" count={hasRfq.length}>
              <div className="divide-y divide-[#D8E2FF]">
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
          <div className="bg-white rounded-[4px] w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-5 border-b border-[#D8E2FF]">
              <h2 className="text-base font-semibold text-[#0F1F3A]">Create RFQ</h2>
              <p className="text-xs text-[#40527A] mt-0.5">
                For PR1 <span className="font-mono font-semibold">{selectedPr1.pr1_number}</span>
                {' '}— {selectedPr1.purpose}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#40527A] uppercase tracking-wide mb-1.5">
                  Quotation Deadline <span className="text-[#BFC7D5] font-normal normal-case">(optional)</span>
                </label>
                <input
                  type="date"
                  value={deadline}
                  onChange={e => setDeadline(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D8E2FF] rounded-[4px] text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#40527A] uppercase tracking-wide mb-1.5">
                  Notes <span className="text-[#BFC7D5] font-normal normal-case">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Specifications, brand preferences, delivery requirements..."
                  className="w-full px-3 py-2.5 border border-[#D8E2FF] rounded-[4px] text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] resize-none"
                />
              </div>
              {createError && (
                <p className="text-sm text-red-600">{createError}</p>
              )}
            </div>
            <div className="px-6 pb-5 flex items-center justify-end gap-3">
              <button
                onClick={() => setCreating(false)}
                disabled={submitting}
                className="px-4 py-2 text-sm text-[#40527A] hover:text-[#0F1F3A] transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="px-5 py-2 bg-[#1E4BFF] hover:bg-[#0F1F3A] text-white text-sm font-semibold rounded-[4px] transition disabled:opacity-50"
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
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-[#F7F9FC] transition">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-mono text-xs font-bold text-[#0F1F3A]">{row.pr1_number}</span>
          <PriorityChip priority={row.priority || 'normal'} />
          {row.rfq_number && (
            <span className="font-mono text-xs text-[#1E4BFF] font-semibold">→ {row.rfq_number}</span>
          )}
          {row.rfq_status && (
            <span className={`inline-flex items-center text-xs font-medium border rounded-full px-2 py-0.5 ${RFQ_STATUS_COLOR[row.rfq_status] ?? ''}`}>
              {RFQ_STATUS_LABEL[row.rfq_status] ?? row.rfq_status}
            </span>
          )}
        </div>
        <p className="text-sm text-[#0F1F3A] truncate">{row.purpose}</p>
        <div className="flex items-center gap-3 mt-1">
          <span className="inline-flex items-center gap-1 text-xs text-[#BFC7D5]">
            <Building2 className="w-3 h-3" />
            {row.department_name_snapshot}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-[#BFC7D5]">
            <CalendarDays className="w-3 h-3" />
            Need by {format(new Date(row.date_required), 'MMM d, yyyy')}
          </span>
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-2">
        {!row.rfq_id ? (
          <button
            onClick={() => onCreateRfq(row)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1E4BFF] hover:bg-[#0F1F3A] text-white text-xs font-semibold rounded-[4px] transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Create RFQ
          </button>
        ) : (
          <Link
            href={`/rfq/${row.rfq_id}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E4BFF] hover:text-[#0F1F3A] transition"
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
    amber:   'border-amber-300 bg-amber-50 text-amber-700',
    slate:   'border-[#D8E2FF] bg-[#F7F9FC] text-[#40527A]',
    blue:    'border-blue-200 bg-blue-50 text-blue-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  }[accent];

  return (
    <div className="bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[#D8E2FF]">
        <h2 className="text-sm font-semibold text-[#0F1F3A]">{title}</h2>
        <span className={`text-xs font-semibold border rounded-full px-2 py-0.5 ${accentClass}`}>{count}</span>
      </div>
      {children}
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
  color: 'amber' | 'blue' | 'emerald' | 'slate';
  icon: React.ElementType;
}) {
  const colorClass = {
    amber:   'text-amber-600 bg-amber-50',
    blue:    'text-blue-600 bg-blue-50',
    emerald: 'text-emerald-600 bg-emerald-50',
    slate:   'text-[#40527A] bg-[#F7F9FC]',
  }[color];

  return (
    <div className="bg-white rounded-[4px] border border-[#D8E2FF] p-4">
      <div className={`inline-flex items-center justify-center w-9 h-9 rounded-[4px] mb-3 ${colorClass}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-[#0F1F3A]">{value}</p>
      <p className="text-xs text-[#40527A] mt-0.5">{label}</p>
    </div>
  );
}
