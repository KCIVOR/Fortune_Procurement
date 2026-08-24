'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { KPI_GRID_CLASS } from '@/components/shared/kpi-grid';
import { DashboardQueueSkeleton } from '@/components/shared/structural-skeletons';
import { useAuth } from '@/context/AuthContext';
import { fetchTSQAGRNQueue, type TSQAGRNQueueRow } from '@/lib/grn-tsqa';
import {
  ClipboardList, PackageSearch, Clock, CircleCheck as CheckCircle2,
  Circle as XCircle, ArrowRight,
} from 'lucide-react';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TSQADashboardPage() {
  const { profile } = useAuth();
  const router      = useRouter();

  const [rows, setRows] = useState<TSQAGRNQueueRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile && profile.role !== 'tsqa' && profile.role !== 'admin') {
      router.replace('/dashboard');
    }
  }, [profile, router]);

  useEffect(() => {
    if (!profile) return;
    fetchTSQAGRNQueue()
      .then(setRows)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [profile]);

  const totalPendingItems = useMemo(
    () => rows.reduce((sum, r) => sum + r.pending_qa_count, 0),
    [rows],
  );
  const totalRejectedItems = useMemo(
    () => rows.reduce((sum, r) => sum + r.rejected_qa_count, 0),
    [rows],
  );
  const fullyApprovedCount = useMemo(
    () => rows.filter((r) => r.pending_qa_count === 0 && r.rejected_qa_count === 0).length,
    [rows],
  );

  const pendingQueue = useMemo(
    () => rows.filter((r) => r.pending_qa_count > 0).slice(0, 8),
    [rows],
  );

  return (
    <AppShell title="TSQA Dashboard">
      <PageHeader
        title="TSQA Dashboard"
        description="Technical and Scientific Quality Assurance — goods receipt QA queue."
        action={
          <Link
            href="/tsqa/grn"
            className="flex items-center gap-1.5 px-4 py-2 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-sm font-semibold rounded-md transition"
          >
            <ClipboardList className="w-4 h-4" />
            View GRN QA Queue
          </Link>
        }
      />

      <div className={`${KPI_GRID_CLASS} mb-4`}>
        <StatCard
          label="GRNs in Queue"
          value={rows.length}
          icon={<PackageSearch className="w-5 h-5" />}
          accent="blue"
          isLoading={loading}
        />
        <StatCard
          label="Items Pending QA"
          value={totalPendingItems}
          icon={<Clock className="w-5 h-5" />}
          accent="amber"
          isLoading={loading}
        />
        <StatCard
          label="Items Rejected"
          value={totalRejectedItems}
          icon={<XCircle className="w-5 h-5" />}
          accent="red"
          isLoading={loading}
        />
        <StatCard
          label="Fully Approved"
          value={fullyApprovedCount}
          icon={<CheckCircle2 className="w-5 h-5" />}
          accent="green"
          isLoading={loading}
        />
      </div>

      <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-pq-neutral-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-pq-neutral-900">Pending QA Inspection</h2>
          <Link href="/tsqa/grn" className="text-xs text-pq-primary-600 hover:text-pq-primary-600 font-medium flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {loading ? (
          <DashboardQueueSkeleton rows={4} />
        ) : pendingQueue.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <PackageSearch className="w-6 h-6 text-pq-neutral-400 mx-auto mb-2" />
            <p className="text-sm text-pq-neutral-500">
              Goods receipts pending QA review appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-pq-neutral-200">
            {pendingQueue.map((row) => (
              <Link
                key={row.grn_id}
                href={`/tsqa/grn/${row.grn_id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-pq-neutral-50 transition-colors group"
              >
                <div className="min-w-0">
                  <p className="text-sm font-mono font-semibold text-pq-neutral-900">{row.grn_number}</p>
                  <p className="text-xs text-pq-neutral-500 truncate">
                    {row.supplier_name_snapshot} · {row.po_number_snapshot}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  <span className="text-xs text-pq-neutral-500">
                    {row.transaction_date ? format(new Date(row.transaction_date), 'MMM d') : '—'}
                  </span>
                  <span className="text-xs font-medium text-pq-warning-600 bg-pq-warning-100 border border-pq-warning-100 rounded-full px-2.5 py-0.5">
                    {row.pending_qa_count} pending
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-pq-neutral-400 group-hover:text-pq-neutral-900 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
