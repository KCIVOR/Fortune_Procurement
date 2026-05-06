'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import StatusChip from '@/components/shared/StatusChip';
import type { StatusVariant } from '@/components/shared/StatusChip';
import { useAuth } from '@/context/AuthContext';
import { getRSEQueueForTSQA, getRSEHistoryForTSQA, type RSEQueueRow } from '@/lib/rse';
import { format } from 'date-fns';
import { FlaskConical, ArrowRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ─── Status helpers ───────────────────────────────────────────────────────────

function rseChip(status: string): { variant: StatusVariant; label: string } {
  const map: Record<string, { variant: StatusVariant; label: string }> = {
    created:      { variant: 'pending',   label: 'Created' },
    assigned:     { variant: 'pending',   label: 'Assigned' },
    under_review: { variant: 'in_review', label: 'Under Review' },
    passed:       { variant: 'approved',  label: 'Passed' },
    failed:       { variant: 'rejected',  label: 'Failed' },
    cancelled:    { variant: 'cancelled', label: 'Cancelled' },
  };
  return map[status] ?? { variant: 'draft', label: status };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TSQARSEQueuePage() {
  const { profile } = useAuth();
  const router      = useRouter();

  const [activeRows,    setActiveRows]    = useState<RSEQueueRow[]>([]);
  const [completedRows, setCompletedRows] = useState<RSEQueueRow[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');
  const [statusFilter,  setStatusFilter]  = useState('all');

  useEffect(() => {
    if (profile && profile.role !== 'tsqa' && profile.role !== 'admin') {
      router.replace('/dashboard');
      return;
    }
    if (!profile) return;

    setLoading(true);
    setError('');
    Promise.all([
      getRSEQueueForTSQA(profile),
      getRSEHistoryForTSQA(profile),
    ])
      .then(([active, completed]) => {
        setActiveRows(active);
        setCompletedRows(completed);
      })
      .catch((err: unknown) => setError((err as Error)?.message || 'Failed to load RSE queue.'))
      .finally(() => setLoading(false));
  }, [profile, router]);

  // Merge all rows and apply filter
  const allRows = [...activeRows, ...completedRows];
  const filtered =
    statusFilter === 'all'
      ? allRows
      : allRows.filter(r => r.status === statusFilter);

  return (
    <AppShell title="RSE Queue">
      <PageHeader
        title="RSE Queue"
        description="Sample evaluation requests assigned to you. Start review, submit test findings, and mark pass or fail."
      />

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-52">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="text-sm border-[#D8E2FF]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="created">Created</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="passed">Passed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span className="text-xs text-[#BFC7D5]">
          {filtered.length} record{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <LoadingState message="Loading RSE queue…" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-[4px] p-4 text-sm text-red-700">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-[4px] border border-[#D8E2FF]">
          <EmptyState
            title={statusFilter === 'all' ? 'No RSE records found' : `No ${statusFilter} records`}
            description={
              statusFilter === 'all'
                ? 'Procurement will assign RSE records when product/sample evaluation is required.'
                : 'Try selecting a different status filter.'
            }
            icon={FlaskConical}
          />
        </div>
      ) : (
        <div className="bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden">
          {/* Column headers */}
          <div className="hidden md:grid grid-cols-[1fr_1fr_140px_120px] gap-4 px-5 py-2.5 bg-[#F7F9FC] border-b border-[#D8E2FF]">
            <p className="text-xs font-semibold text-[#40527A] uppercase tracking-wide">RSE / Product</p>
            <p className="text-xs font-semibold text-[#40527A] uppercase tracking-wide">Supplier</p>
            <p className="text-xs font-semibold text-[#40527A] uppercase tracking-wide">Status</p>
            <p className="text-xs font-semibold text-[#40527A] uppercase tracking-wide">Date</p>
          </div>
          <div className="divide-y divide-[#D8E2FF]">
            {filtered.map(row => (
              <RSERow key={row.id} row={row} />
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}

// ─── RSE row ─────────────────────────────────────────────────────────────────

function RSERow({ row }: { row: RSEQueueRow }) {
  const chip     = rseChip(row.status);
  const isActive = row.status === 'created' || row.status === 'assigned' || row.status === 'under_review';
  const dateStr  = row.completed_at
    ? `Completed ${format(new Date(row.completed_at), 'MMM d, yyyy')}`
    : row.assigned_at
    ? `Assigned ${format(new Date(row.assigned_at), 'MMM d, yyyy')}`
    : `Created ${format(new Date(row.created_at), 'MMM d, yyyy')}`;

  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-[#F7F9FC] transition">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="font-mono text-xs font-bold text-[#0F1F3A]">
            {row.rse_number ?? row.id.slice(0, 8).toUpperCase()}
          </span>
          <StatusChip status={chip.variant} label={chip.label} size="sm" />
        </div>
        <p className="text-sm text-[#0F1F3A] truncate">{row.product_name ?? '—'}</p>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {row.supplier_full_name && (
            <span className="text-xs text-[#BFC7D5]">{row.supplier_full_name}</span>
          )}
          <span className="text-xs text-[#BFC7D5]">{dateStr}</span>
        </div>
      </div>

      <Link
        href={`/tsqa/rse/${row.id}`}
        className={`shrink-0 flex items-center gap-1 text-xs font-semibold transition ${
          isActive ? 'text-[#1E4BFF] hover:text-[#0F1F3A]' : 'text-[#40527A] hover:text-[#0F1F3A]'
        }`}
      >
        {isActive ? 'Evaluate' : 'View'}
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
