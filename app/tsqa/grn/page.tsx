'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import { TableSkeleton } from '@/components/shared/structural-skeletons';
import StatusChip from '@/components/shared/StatusChip';
import type { StatusVariant } from '@/components/shared/StatusChip';
import { useAuth } from '@/context/AuthContext';
import { fetchTSQAGRNQueue, type TSQAGRNQueueRow } from '@/lib/grn-tsqa';
import { GRN_STATUS_LABELS } from '@/types/grn';
import { format } from 'date-fns';
import { ClipboardList, ArrowRight, FlaskConical, CheckCircle2 } from 'lucide-react';

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

  const [rows, setRows] = useState<TSQAGRNQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (profile && profile.role !== 'tsqa' && profile.role !== 'admin') {
      router.replace('/dashboard');
      return;
    }
    if (!profile) return;

    setLoading(true);
    fetchTSQAGRNQueue()
      .then(setRows)
      .catch((err: unknown) => setError((err as Error)?.message || 'Failed to load GRN QA queue.'))
      .finally(() => setLoading(false));
  }, [profile, router]);

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

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <LoadingState message="Loading GRN QA queue…" />
        </div>
      ) : error ? (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">
          {error}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="No GRNs pending QA"
          description="Warehouse-flagged items will appear here when QA inspection is required."
        />
      ) : (
        <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
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
                  <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-right">Pending</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-pq-neutral-200">
                {rows.map((row) => {
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
                      <td className="px-5 py-3.5 text-right font-mono text-xs font-semibold text-pq-warning-600">
                        {row.pending_qa_count}
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
      )}
    </AppShell>
  );
}
