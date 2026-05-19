'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import StatusChip from '@/components/shared/StatusChip';
import type { StatusVariant } from '@/components/shared/StatusChip';
import { useAuth } from '@/context/AuthContext';
import { getRSEQueueForTSQA, getRSEStatsForTSQA, type RSEQueueRow, type RSEStats } from '@/lib/rse';
import { format } from 'date-fns';
import {
  FlaskConical,
  ClipboardList,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Tag,
} from 'lucide-react';

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

export default function TSQADashboardPage() {
  const { profile } = useAuth();
  const router      = useRouter();

  const [rows, setRows]         = useState<RSEQueueRow[]>([]);
  const [stats, setStats]       = useState<RSEStats | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  useEffect(() => {
    if (profile && profile.role !== 'tsqa' && profile.role !== 'admin') {
      router.replace('/dashboard');
      return;
    }
    if (!profile) return;

    setLoading(true);
    Promise.all([
      getRSEQueueForTSQA(profile),
      getRSEStatsForTSQA(profile),
    ])
      .then(([activeRows, rseStats]) => {
        setRows(activeRows);
        setStats(rseStats);
      })
      .catch((err: unknown) => setError((err as Error)?.message || 'Failed to load dashboard.'))
      .finally(() => setLoading(false));
  }, [profile, router]);

  const recentRows = rows.slice(0, 5);

  return (
    <AppShell title="TSQA Dashboard">
      <PageHeader
        title="TSQA Dashboard"
        description="Technical and Scientific Quality Assurance — product and sample evaluation queue."
        action={
          <Link
            href="/tsqa/rse"
            className="flex items-center gap-1.5 px-4 py-2 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-sm font-semibold rounded-md transition"
          >
            <ClipboardList className="w-4 h-4" />
            View RSE Queue
          </Link>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <LoadingState message="Loading dashboard…" />
        </div>
      ) : error ? (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">
          {error}
        </div>
      ) : (
        <div className="space-y-5">
          {/* ── Stat cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatCard label="Open / Created"  value={stats?.created      ?? 0} color="slate"   icon={Tag} />
            <StatCard label="Assigned"         value={stats?.assigned     ?? 0} color="amber"   icon={Clock} />
            <StatCard label="Under Review"     value={stats?.under_review ?? 0} color="blue"    icon={Eye} />
            <StatCard label="Passed"           value={stats?.passed       ?? 0} color="emerald" icon={CheckCircle2} />
            <StatCard label="Failed"           value={stats?.failed       ?? 0} color="red"     icon={XCircle} />
          </div>

          {/* ── Recent active RSE ── */}
          <div className="bg-white rounded-md border border-pq-neutral-200">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-pq-neutral-200">
              <h2 className="text-sm font-semibold text-pq-neutral-900">Active RSE Records</h2>
              <Link
                href="/tsqa/rse"
                className="text-xs text-pq-primary-600 hover:text-pq-neutral-900 font-medium transition"
              >
                View all
              </Link>
            </div>

            {rows.length === 0 ? (
              <div className="p-10 text-center">
                <FlaskConical className="w-6 h-6 text-pq-neutral-400 mx-auto mb-2" />
                <p className="text-sm text-pq-neutral-500">No active RSE records assigned to you.</p>
                <p className="text-xs text-pq-neutral-400 mt-1">
                  Procurement will assign RSE records when product evaluation is required.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-pq-neutral-200">
                {recentRows.map(row => (
                  <RSEMiniRow key={row.id} row={row} />
                ))}
                {rows.length > 5 && (
                  <div className="px-5 py-3.5 text-center">
                    <Link
                      href="/tsqa/rse"
                      className="text-xs text-pq-primary-600 hover:text-pq-neutral-900 font-medium transition"
                    >
                      View {rows.length - 5} more →
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RSEMiniRow({ row }: { row: RSEQueueRow }) {
  const chip = rseChip(row.status);
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-pq-neutral-50 transition">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs font-bold text-pq-neutral-900">
            {row.rse_number ?? row.id.slice(0, 8).toUpperCase()}
          </span>
          <StatusChip status={chip.variant} label={chip.label} size="sm" />
        </div>
        <p className="text-sm text-pq-neutral-500 truncate mt-0.5">
          {row.product_name ?? '—'}
          {row.supplier_full_name ? ` · ${row.supplier_full_name}` : ''}
        </p>
      </div>
      <Link
        href={`/tsqa/rse/${row.id}`}
        className="shrink-0 flex items-center gap-1 text-xs font-semibold text-pq-neutral-500 hover:text-pq-neutral-900 transition"
      >
        Evaluate
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
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
  color: 'slate' | 'amber' | 'blue' | 'emerald' | 'red';
  icon: React.ElementType;
}) {
  const colorClass = {
    slate:   'text-pq-neutral-500 bg-pq-neutral-50',
    amber:   'text-pq-warning-600 bg-pq-warning-100',
    blue:    'text-pq-primary-600 bg-pq-primary-50',
    emerald: 'text-pq-success-600 bg-pq-success-100',
    red:     'text-pq-danger-600 bg-pq-danger-100',
  }[color];

  return (
    <div className="bg-white rounded-md border border-pq-neutral-200 p-4">
      <div className={`inline-flex items-center justify-center w-9 h-9 rounded-md mb-3 ${colorClass}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-pq-neutral-900">{value}</p>
      <p className="text-xs text-pq-neutral-500 mt-0.5">{label}</p>
    </div>
  );
}
