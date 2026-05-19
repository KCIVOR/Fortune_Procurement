'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import StatusChip from '@/components/shared/StatusChip';
import type { StatusVariant } from '@/components/shared/StatusChip';
import { getAccreditationQueueForProcurement } from '@/lib/accreditation';
import type { AccreditationQueueRow } from '@/lib/accreditation';
import { format } from 'date-fns';
import { BadgeCheck, ArrowRight, AlertCircle } from 'lucide-react';

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
  };
  return map[status] ?? { variant: 'draft', label: status };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AccreditationQueuePage() {
  const [rows, setRows]       = useState<AccreditationQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    getAccreditationQueueForProcurement()
      .then(setRows)
      .catch((err: unknown) =>
        setError((err as Error)?.message || 'Failed to load accreditation queue.')
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell title="Supplier Accreditation">
      <PageHeader
        title="Supplier Accreditation"
        description="Review and process supplier accreditation applications submitted for Procurement approval."
      />

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <LoadingState message="Loading accreditation queue…" />
        </div>
      ) : error ? (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-md border border-pq-neutral-200">
          <EmptyState
            title="No accreditation applications"
            description="Submitted supplier accreditation applications will appear here for review."
            icon={BadgeCheck}
          />
        </div>
      ) : (
        <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
          {/* Column headers */}
          <div className="hidden md:grid grid-cols-[1fr_180px_140px_120px] gap-4 px-5 py-2.5 bg-pq-neutral-50 border-b border-pq-neutral-200">
            <p className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Supplier</p>
            <p className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Status</p>
            <p className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Submitted</p>
            <p className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Reviewed</p>
          </div>
          <div className="divide-y divide-pq-neutral-200">
            {rows.map(row => (
              <QueueRow key={row.id} row={row} />
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}

// ─── Queue row ────────────────────────────────────────────────────────────────

function QueueRow({ row }: { row: AccreditationQueueRow }) {
  const chip = accreditationChip(row.status);

  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-pq-neutral-50 transition">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="font-medium text-sm text-pq-neutral-900">
            {row.supplier_full_name ?? 'Unknown Supplier'}
          </span>
          {row.status === 'missing_documents' && (
            <span className="inline-flex items-center gap-1 text-xs text-pq-warning-600 bg-pq-warning-100 border border-pq-warning-100 rounded-full px-2 py-0.5">
              <AlertCircle className="w-3 h-3" />
              Action Required
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {row.supplier_email && (
            <span className="text-xs text-pq-neutral-400">{row.supplier_email}</span>
          )}
          {row.submitted_at && (
            <span className="text-xs text-pq-neutral-400">
              Submitted {format(new Date(row.submitted_at), 'MMM d, yyyy')}
            </span>
          )}
          {row.reviewed_at && (
            <span className="text-xs text-pq-neutral-400">
              Reviewed {format(new Date(row.reviewed_at), 'MMM d, yyyy')}
            </span>
          )}
        </div>
      </div>

      <div className="shrink-0 hidden sm:block">
        <StatusChip status={chip.variant} label={chip.label} size="sm" />
      </div>

      <Link
        href={`/accreditation/${row.id}`}
        className="shrink-0 flex items-center gap-1 text-xs font-semibold text-pq-neutral-500 hover:text-pq-neutral-900 transition"
      >
        Review
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
