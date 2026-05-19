'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/structural-skeletons';
import PaginationControls from '@/components/shared/PaginationControls';
import { useAuth } from '@/context/AuthContext';
import { fetchPR2ApprovalQueue, canActOnPR2Step } from '@/lib/pr2-approvals';
import type { PR2ApprovalQueueRow } from '@/types/approvals';
import {
  SquareCheck as CheckSquare,
  ClipboardList,
  Clock,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { format } from 'date-fns';
import PriorityChip from '@/components/shared/PriorityChip';
import StepChip from '@/components/shared/StepChip';
import ApprovalQueueTableShell from '@/components/shared/ApprovalQueueTableShell';
import { ApprovalQueueHeaderRow, ApprovalQueueHeadCell } from '@/components/shared/ApprovalQueueTableHeader';

export default function PR2ApprovalsPage() {
  const { profile } = useAuth();
  const [pr2Queue, setPR2Queue] = useState<PR2ApprovalQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionablePage, setActionablePage] = useState(1);
  const [readonlyPage, setReadonlyPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    fetchPR2ApprovalQueue()
      .then(setPR2Queue)
      .catch(() => setError('Failed to load PR2 approval queue.'))
      .finally(() => setLoading(false));
  }, []);

  const canActPR2 = (row: PR2ApprovalQueueRow) =>
    profile ? canActOnPR2Step(profile, row.step_role_required, row.step_position_required) : false;

  const actionablePR2  = pr2Queue.filter(canActPR2);
  const readonlyRows   = pr2Queue.filter(r => !canActPR2(r));
  const totalReadonly  = readonlyRows.length;
  const actionablePages = Math.ceil(actionablePR2.length / pageSize);
  const readonlyPages  = Math.ceil(totalReadonly / pageSize);
  const actionableSlice = actionablePR2.slice((actionablePage - 1) * pageSize, actionablePage * pageSize);
  const readonlySlice  = readonlyRows.slice((readonlyPage - 1) * pageSize, readonlyPage * pageSize);

  return (
    <AppShell title="PR2 Requests">
      <PageHeader
        title="PR2 Requests"
        description="Procurement purchase requests pending your review and approval."
      />

      {loading ? (
        <TableSkeleton rows={5} cols={8} />
      ) : error ? (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">{error}</div>
      ) : pr2Queue.length === 0 ? (
        <div className="bg-white rounded-md border border-pq-neutral-200">
          <EmptyState
            title="No pending PR2 approvals"
            description="Procurement purchase requests routed for approval will appear here."
            icon={CheckSquare}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard label="Total Pending" value={pr2Queue.length} color="slate" icon={ClipboardList} />
            <StatCard label="Awaiting My Action" value={actionablePR2.length} color="amber" icon={Clock} />
            <StatCard label="Pending Other Steps" value={totalReadonly} color="slate" icon={Lock} />
          </div>

          {/* Actionable */}
          {actionablePR2.length > 0 && (
            <Section title="Awaiting My Action" accent="amber">
              <PR2QueueTable rows={actionableSlice} canAct={() => true} />
              <div className="w-full pt-2 pb-4">
                <PaginationControls
                  className="border-pq-neutral-200 rounded-md"
                  currentPage={actionablePage}
                  totalPages={Math.max(1, actionablePages)}
                  pageSize={pageSize}
                  totalCount={actionablePR2.length}
                  entityLabel="items"
                  onPageChange={(page) => {
                    if (page < actionablePage) setActionablePage(p => Math.max(1, p - 1));
                    else setActionablePage(p => Math.min(actionablePages, p + 1));
                  }}
                />
              </div>
            </Section>
          )}

          {/* Read-only */}
          {totalReadonly > 0 && (
            <Section
              title="Pending Other Steps"
              accent="slate"
              subtitle="These are awaiting a different signatory before you can act."
            >
              <PR2QueueTable rows={readonlySlice} canAct={() => false} />
              <div className="w-full pt-2 pb-4">
                <PaginationControls
                  className="border-pq-neutral-200 rounded-md"
                  currentPage={readonlyPage}
                  totalPages={Math.max(1, readonlyPages)}
                  pageSize={pageSize}
                  totalCount={totalReadonly}
                  entityLabel="items"
                  onPageChange={(page) => {
                    if (page < readonlyPage) setReadonlyPage(p => Math.max(1, p - 1));
                    else setReadonlyPage(p => Math.min(readonlyPages, p + 1));
                  }}
                />
              </div>
            </Section>
          )}
        </div>
      )}
    </AppShell>
  );
}

// ─── PR2 queue table ──────────────────────────────────────────────────────────

function PR2QueueTable({
  rows,
  canAct,
}: {
  rows: PR2ApprovalQueueRow[];
  canAct: (row: PR2ApprovalQueueRow) => boolean;
}) {
  const PHASE_LABELS: Record<string, string> = {
    PR2_PHASE1: 'Phase 1',
    PR2_PHASE2: 'Phase 2',
  };

  return (
    <ApprovalQueueTableShell
      title="PR2 — Procurement Purchase Requests"
      icon={<ClipboardList className="w-3.5 h-3.5 text-pq-neutral-400" />}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <ApprovalQueueHeaderRow>
              <ApprovalQueueHeadCell>PR2 No.</ApprovalQueueHeadCell>
              <ApprovalQueueHeadCell>Requestor</ApprovalQueueHeadCell>
              <ApprovalQueueHeadCell>Department</ApprovalQueueHeadCell>
              <ApprovalQueueHeadCell>Purpose</ApprovalQueueHeadCell>
              <ApprovalQueueHeadCell>Date Required</ApprovalQueueHeadCell>
              <ApprovalQueueHeadCell align="center" className="w-24">Priority</ApprovalQueueHeadCell>
              <ApprovalQueueHeadCell>Current Step</ApprovalQueueHeadCell>
              <ApprovalQueueHeadCell className="px-5 py-3" />
            </ApprovalQueueHeaderRow>
          </thead>
          <tbody className="divide-y divide-pq-neutral-200">
            {rows.map((row) => {
              const active = canAct(row);
              const phaseLabel = PHASE_LABELS[row.workflow_code] ?? row.workflow_code;
              return (
                <tr key={row.instance_id} className={`transition-colors ${active ? 'hover:bg-pq-neutral-50' : 'opacity-60'}`}>
                  <td className="px-5 py-3.5">
                    <span className="font-mono font-semibold text-pq-neutral-900">{row.pr2_number}</span>
                    <span className="ml-2 text-xs text-pq-neutral-400">{phaseLabel}</span>
                  </td>
                  <td className="px-5 py-3.5 text-pq-neutral-900">{row.requisitioner_name_snapshot}</td>
                  <td className="px-5 py-3.5 text-pq-neutral-500">{row.department_name_snapshot}</td>
                  <td className="px-5 py-3.5 text-pq-neutral-500 max-w-[180px] truncate">{row.purpose}</td>
                  <td className="px-5 py-3.5 text-pq-neutral-500 text-xs">{format(new Date(row.date_required), 'MMM d, yyyy')}</td>
                  <td className="px-5 py-3.5 text-center">
                    <PriorityChip priority={row.pr1_priority} />
                  </td>
                  <td className="px-5 py-3.5">
                    <StepChip stepName={`Step ${row.current_step}: ${row.step_position_required}`} canAct={active} />
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {active ? (
                      <Link href={`/approvals/pr2/${row.instance_id}`} className="inline-flex items-center gap-1.5 text-pq-primary-600 hover:text-pq-neutral-900 text-xs font-semibold transition">
                        <ArrowRight className="w-3.5 h-3.5" /> Review
                      </Link>
                    ) : (
                      <Link href={`/approvals/pr2/${row.instance_id}`} className="inline-flex items-center gap-1.5 text-pq-neutral-400 hover:text-pq-neutral-500 text-xs font-medium transition">
                        View
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </ApprovalQueueTableShell>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function Section({
  title, subtitle, accent, children,
}: {
  title: string; subtitle?: string; accent: 'amber' | 'slate'; children: React.ReactNode;
}) {
  const bar = accent === 'amber' ? 'bg-pq-primary-600' : 'bg-pq-neutral-200';
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-1 h-5 rounded-full ${bar}`} />
        <div>
          <h2 className="text-sm font-semibold text-pq-neutral-900">{title}</h2>
          {subtitle && <p className="text-xs text-pq-neutral-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function StatCard({
  label, value, color, icon: Icon,
}: {
  label: string; value: number; color: 'amber' | 'slate'; icon: React.ElementType;
}) {
  const styles = { amber: 'bg-pq-neutral-50 border-pq-neutral-200 text-pq-neutral-900', slate: 'bg-white border-pq-neutral-200 text-pq-neutral-900' };
  const iconStyles = { amber: 'text-pq-neutral-500', slate: 'text-pq-neutral-400' };
  return (
    <div className={`rounded-md border px-5 py-4 flex items-center gap-4 ${styles[color]}`}>
      <Icon className={`w-5 h-5 shrink-0 ${iconStyles[color]}`} />
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs font-medium opacity-80">{label}</p>
      </div>
    </div>
  );
}
