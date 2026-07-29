'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/structural-skeletons';
import PaginationControls from '@/components/shared/PaginationControls';
import { useAuth } from '@/context/AuthContext';
import { fetchApprovalQueue, canActOnStep } from '@/lib/approvals';
import { fetchPR2ApprovalQueue, canActOnPR2Step } from '@/lib/pr2-approvals';
import { canActOnRfqStep, getPr2QueueReviewUrl } from '@/lib/rfq-approvals';
import { fetchPOApprovalQueue, canActOnPOStep } from '@/lib/po-approvals';
import type { PR1ApprovalQueueRow } from '@/types/approvals';
import type { PR2ApprovalQueueRow } from '@/types/approvals';
import type { POApprovalQueueRow } from '@/types/po';
import {
  SquareCheck as CheckSquare,
  ClipboardList,
  Clock,
  Lock,
  ArrowRight,
  FileText,
  ShoppingCart,
} from 'lucide-react';
import { format } from 'date-fns';
import PriorityChip from '@/components/shared/PriorityChip';
import { RequestTypeBadge } from '@/components/shared/RequestTypeBadge';
import StepChip from '@/components/shared/StepChip';
import ApprovalQueueTableShell from '@/components/shared/ApprovalQueueTableShell';
import { ApprovalQueueHeaderRow, ApprovalQueueHeadCell } from '@/components/shared/ApprovalQueueTableHeader';
import { StatCard } from '@/components/shared/StatCard';
import { KPI_GRID_CLASS } from '@/components/shared/kpi-grid';

export default function ApprovalsPage() {
  const { profile } = useAuth();
  const [pr1Queue, setPR1Queue] = useState<PR1ApprovalQueueRow[]>([]);
  const [pr2Queue, setPR2Queue] = useState<PR2ApprovalQueueRow[]>([]);
  const [poQueue,  setPOQueue]  = useState<POApprovalQueueRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [pr1ActPage, setPR1ActPage] = useState(1);
  const [pr2ActPage, setPR2ActPage] = useState(1);
  const [poActPage,  setPOActPage]  = useState(1);
  const [pr1ReadPage, setPR1ReadPage] = useState(1);
  const [pr2ReadPage, setPR2ReadPage] = useState(1);
  const [poReadPage,  setPOReadPage]  = useState(1);

  useEffect(() => {
    Promise.all([
      fetchApprovalQueue(),
      fetchPR2ApprovalQueue(),
      fetchPOApprovalQueue(),
    ])
      .then(([pr1, pr2, po]) => {
        setPR1Queue(pr1);
        setPR2Queue(pr2);
        setPOQueue(po);
      })
      .catch(() => setError('Failed to load approval queue.'))
      .finally(() => setLoading(false));
  }, []);

  const PAGE_SIZE = 20;

  const canActPR1 = (row: PR1ApprovalQueueRow) =>
    profile ? canActOnStep(profile, row.step_position_required, row.department_id) : false;

  const canActPR2 = (row: PR2ApprovalQueueRow) => {
    if (!profile) return false;
    if (row.workflow_code === 'RFQ_APPROVAL') {
      return canActOnRfqStep(profile, row.step_role_required, row.step_position_required, row.department_id);
    }
    return canActOnPR2Step(profile, row.step_role_required, row.step_position_required, row.department_id);
  };

  const canActPO = (row: POApprovalQueueRow) =>
    profile ? canActOnPOStep(profile, row.step_role_required, row.step_position_required, row.department_id) : false;

  const totalQueue      = pr1Queue.length + pr2Queue.length + poQueue.length;
  const actionablePR1   = pr1Queue.filter(canActPR1);
  const actionablePR2   = pr2Queue.filter(canActPR2);
  const actionablePO    = poQueue.filter(canActPO);
  const totalActionable = actionablePR1.length + actionablePR2.length + actionablePO.length;
  const totalReadonly   = totalQueue - totalActionable;

  const readonlyPR1Rows  = pr1Queue.filter(r => !canActPR1(r));
  const readonlyPR2Rows  = pr2Queue.filter(r => !canActPR2(r));
  const readonlyPORows   = poQueue.filter(r => !canActPO(r));

  const pr1ActSlice = actionablePR1.slice((pr1ActPage - 1) * PAGE_SIZE, pr1ActPage * PAGE_SIZE);
  const pr2ActSlice = actionablePR2.slice((pr2ActPage - 1) * PAGE_SIZE, pr2ActPage * PAGE_SIZE);
  const poActSlice  = actionablePO.slice((poActPage - 1) * PAGE_SIZE, poActPage * PAGE_SIZE);
  const pr1ReadSlice = readonlyPR1Rows.slice((pr1ReadPage - 1) * PAGE_SIZE, pr1ReadPage * PAGE_SIZE);
  const pr2ReadSlice = readonlyPR2Rows.slice((pr2ReadPage - 1) * PAGE_SIZE, pr2ReadPage * PAGE_SIZE);
  const poReadSlice  = readonlyPORows.slice((poReadPage - 1) * PAGE_SIZE, poReadPage * PAGE_SIZE);

  return (
    <AppShell title="Approval Queue">
      <PageHeader
        title="Approval Queue"
        description="Purchase requests pending sequential review and approval."
      />

      {loading ? (
        <TableSkeleton rows={5} cols={8} />
      ) : error ? (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">{error}</div>
      ) : totalQueue === 0 ? (
        <div className="bg-white rounded-md border border-pq-neutral-200">
          <EmptyState
            title="No pending approvals"
            description="PR1 and PR2 documents routed for approval will appear here."
            icon={CheckSquare}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Stats */}
          <div className={`${KPI_GRID_CLASS} mb-6`}>
            <StatCard
              label="Total Pending"
              value={totalQueue}
              accent="blue"
              icon={<ClipboardList className="w-5 h-5" />}
            />
            <StatCard
              label="Awaiting My Action"
              value={totalActionable}
              accent="amber"
              icon={<Clock className="w-5 h-5" />}
            />
            <StatCard
              label="Pending Other Steps"
              value={totalReadonly}
              accent="blue"
              icon={<Lock className="w-5 h-5" />}
            />
          </div>

          {/* Actionable */}
          {totalActionable > 0 && (
            <Section title="Awaiting My Action" accent="amber">
              {actionablePR1.length > 0 && (
                <>
                  <PR1QueueTable rows={pr1ActSlice} canAct={() => true} />
                  <div className="w-full pt-2 pb-4">
                    <PaginationControls
                      className="border-pq-neutral-200 rounded-md"
                      currentPage={pr1ActPage}
                      totalPages={Math.max(1, Math.ceil(actionablePR1.length / PAGE_SIZE))}
                      pageSize={PAGE_SIZE}
                      totalCount={actionablePR1.length}
                      entityLabel="PR1 items"
                      onPageChange={(page) => {
                        const maxP = Math.ceil(actionablePR1.length / PAGE_SIZE);
                        if (page < pr1ActPage) setPR1ActPage(p => Math.max(1, p - 1));
                        else setPR1ActPage(p => Math.min(maxP, p + 1));
                      }}
                    />
                  </div>
                </>
              )}
              {actionablePR2.length > 0 && (
                <>
                  <PR2QueueTable rows={pr2ActSlice} canAct={() => true} />
                  <div className="w-full pt-2 pb-4">
                    <PaginationControls
                      className="border-pq-neutral-200 rounded-md"
                      currentPage={pr2ActPage}
                      totalPages={Math.max(1, Math.ceil(actionablePR2.length / PAGE_SIZE))}
                      pageSize={PAGE_SIZE}
                      totalCount={actionablePR2.length}
                      entityLabel="PR2 items"
                      onPageChange={(page) => {
                        const maxP = Math.ceil(actionablePR2.length / PAGE_SIZE);
                        if (page < pr2ActPage) setPR2ActPage(p => Math.max(1, p - 1));
                        else setPR2ActPage(p => Math.min(maxP, p + 1));
                      }}
                    />
                  </div>
                </>
              )}
              {actionablePO.length > 0 && (
                <>
                  <POQueueTable rows={poActSlice} canAct={() => true} />
                  <div className="w-full pt-2 pb-4">
                    <PaginationControls
                      className="border-pq-neutral-200 rounded-md"
                      currentPage={poActPage}
                      totalPages={Math.max(1, Math.ceil(actionablePO.length / PAGE_SIZE))}
                      pageSize={PAGE_SIZE}
                      totalCount={actionablePO.length}
                      entityLabel="PO items"
                      onPageChange={(page) => {
                        const maxP = Math.ceil(actionablePO.length / PAGE_SIZE);
                        if (page < poActPage) setPOActPage(p => Math.max(1, p - 1));
                        else setPOActPage(p => Math.min(maxP, p + 1));
                      }}
                    />
                  </div>
                </>
              )}
            </Section>
          )}

          {/* Read-only */}
          {totalReadonly > 0 && (
            <Section
              title="Pending Other Steps"
              accent="slate"
              subtitle="These are awaiting a different signatory before you can act."
            >
              {readonlyPR1Rows.length > 0 && (
                <>
                  <PR1QueueTable rows={pr1ReadSlice} canAct={() => false} />
                  <div className="w-full pt-2 pb-4">
                    <PaginationControls
                      className="border-pq-neutral-200 rounded-md"
                      currentPage={pr1ReadPage}
                      totalPages={Math.max(1, Math.ceil(readonlyPR1Rows.length / PAGE_SIZE))}
                      pageSize={PAGE_SIZE}
                      totalCount={readonlyPR1Rows.length}
                      entityLabel="PR1 items"
                      onPageChange={(page) => {
                        const maxP = Math.ceil(readonlyPR1Rows.length / PAGE_SIZE);
                        if (page < pr1ReadPage) setPR1ReadPage(p => Math.max(1, p - 1));
                        else setPR1ReadPage(p => Math.min(maxP, p + 1));
                      }}
                    />
                  </div>
                </>
              )}
              {readonlyPR2Rows.length > 0 && (
                <>
                  <PR2QueueTable rows={pr2ReadSlice} canAct={() => false} />
                  <div className="w-full pt-2 pb-4">
                    <PaginationControls
                      className="border-pq-neutral-200 rounded-md"
                      currentPage={pr2ReadPage}
                      totalPages={Math.max(1, Math.ceil(readonlyPR2Rows.length / PAGE_SIZE))}
                      pageSize={PAGE_SIZE}
                      totalCount={readonlyPR2Rows.length}
                      entityLabel="PR2 items"
                      onPageChange={(page) => {
                        const maxP = Math.ceil(readonlyPR2Rows.length / PAGE_SIZE);
                        if (page < pr2ReadPage) setPR2ReadPage(p => Math.max(1, p - 1));
                        else setPR2ReadPage(p => Math.min(maxP, p + 1));
                      }}
                    />
                  </div>
                </>
              )}
              {readonlyPORows.length > 0 && (
                <>
                  <POQueueTable rows={poReadSlice} canAct={() => false} />
                  <div className="w-full pt-2 pb-4">
                    <PaginationControls
                      className="border-pq-neutral-200 rounded-md"
                      currentPage={poReadPage}
                      totalPages={Math.max(1, Math.ceil(readonlyPORows.length / PAGE_SIZE))}
                      pageSize={PAGE_SIZE}
                      totalCount={readonlyPORows.length}
                      entityLabel="PO items"
                      onPageChange={(page) => {
                        const maxP = Math.ceil(readonlyPORows.length / PAGE_SIZE);
                        if (page < poReadPage) setPOReadPage(p => Math.max(1, p - 1));
                        else setPOReadPage(p => Math.min(maxP, p + 1));
                      }}
                    />
                  </div>
                </>
              )}
            </Section>
          )}
        </div>
      )}
    </AppShell>
  );
}

// ─── PR1 queue table ──────────────────────────────────────────────────────────

function PR1QueueTable({
  rows,
  canAct,
}: {
  rows: PR1ApprovalQueueRow[];
  canAct: (row: PR1ApprovalQueueRow) => boolean;
}) {
  return (
    <ApprovalQueueTableShell
      title="PR1 — Purchase Requests"
      icon={<FileText className="w-3.5 h-3.5 text-pq-neutral-400" />}
    >
      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <ApprovalQueueHeaderRow>
            <ApprovalQueueHeadCell>PR1 No.</ApprovalQueueHeadCell>
            <ApprovalQueueHeadCell>Requestor</ApprovalQueueHeadCell>
            <ApprovalQueueHeadCell>Department</ApprovalQueueHeadCell>
            <ApprovalQueueHeadCell>Purpose</ApprovalQueueHeadCell>
            <ApprovalQueueHeadCell>Date Required</ApprovalQueueHeadCell>
            <ApprovalQueueHeadCell align="center" className="w-24">Priority</ApprovalQueueHeadCell>
            <ApprovalQueueHeadCell align="center">Type</ApprovalQueueHeadCell>
            <ApprovalQueueHeadCell>Current Step</ApprovalQueueHeadCell>
            <ApprovalQueueHeadCell className="px-5 py-3" />
          </ApprovalQueueHeaderRow>
        </thead>
        <tbody className="divide-y divide-pq-neutral-200">
          {rows.map((row) => {
            const active = canAct(row);
            return (
              <tr key={row.instance_id} className={`transition-colors ${active ? 'hover:bg-pq-neutral-50' : 'opacity-60'}`}>
                <td className="px-5 py-3.5 font-mono font-semibold text-pq-neutral-900">{row.pr1_number}</td>
                <td className="px-5 py-3.5 text-pq-neutral-900">{row.requisitioner_name_snapshot}</td>
                <td className="px-5 py-3.5 text-pq-neutral-500">{row.department_name_snapshot}</td>
                <td className="px-5 py-3.5 text-pq-neutral-500 max-w-[180px] truncate">{row.purpose}</td>
                <td className="px-5 py-3.5 text-pq-neutral-500 text-xs">{format(new Date(row.date_required), 'MMM d, yyyy')}</td>
                <td className="px-5 py-3.5 text-center">
                  <PriorityChip priority={row.priority} />
                </td>
                <td className="px-5 py-3.5 text-center">
                  <RequestTypeBadge type={row.request_type ?? 'goods'} />
                </td>
                <td className="px-5 py-3.5">
                  <StepChip stepName={`Step ${row.current_step}: ${row.step_position_required}`} canAct={active} />
                </td>
                <td className="px-5 py-3.5 text-right">
                  {active ? (
                    <Link href={`/approvals/${row.instance_id}`} className="inline-flex items-center gap-1.5 text-pq-primary-600 hover:text-pq-neutral-900 text-xs font-semibold transition">
                      <ArrowRight className="w-3.5 h-3.5" /> Review
                    </Link>
                  ) : (
                    <Link href={`/approvals/${row.instance_id}`} className="inline-flex items-center gap-1.5 text-pq-neutral-400 hover:text-pq-neutral-500 text-xs font-medium transition">
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

// ─── PR2 queue table ──────────────────────────────────────────────────────────

function PR2QueueTable({
  rows,
  canAct,
}: {
  rows: PR2ApprovalQueueRow[];
  canAct: (row: PR2ApprovalQueueRow) => boolean;
}) {
  const PHASE_LABELS: Record<string, string> = {
    PR2_PHASE1: 'Approval',
    PR2_FINAL: 'PR2 Sign-off',
    RFQ_APPROVAL: 'Canvassing',
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
            <ApprovalQueueHeadCell align="center">Type</ApprovalQueueHeadCell>
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
                <td className="px-5 py-3.5 text-center">
                  <RequestTypeBadge type={row.request_type ?? 'goods'} />
                </td>
                <td className="px-5 py-3.5">
                  <StepChip stepName={`Step ${row.current_step}: ${row.step_position_required}`} canAct={active} />
                </td>
                <td className="px-5 py-3.5 text-right">
                  {active ? (
                    <Link href={getPr2QueueReviewUrl(row)} className="inline-flex items-center gap-1.5 text-pq-primary-600 hover:text-pq-neutral-900 text-xs font-semibold transition">
                      <ArrowRight className="w-3.5 h-3.5" /> Review
                    </Link>
                  ) : (
                    <Link href={getPr2QueueReviewUrl(row)} className="inline-flex items-center gap-1.5 text-pq-neutral-400 hover:text-pq-neutral-500 text-xs font-medium transition">
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

// ─── PO queue table ───────────────────────────────────────────────────────────

function POQueueTable({
  rows,
  canAct,
}: {
  rows: POApprovalQueueRow[];
  canAct: (row: POApprovalQueueRow) => boolean;
}) {
  return (
    <ApprovalQueueTableShell
      title="PO — Purchase Orders"
      icon={<ShoppingCart className="w-3.5 h-3.5 text-pq-neutral-400" />}
    >
      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <ApprovalQueueHeaderRow>
            <ApprovalQueueHeadCell>PO No.</ApprovalQueueHeadCell>
            <ApprovalQueueHeadCell>Supplier</ApprovalQueueHeadCell>
            <ApprovalQueueHeadCell>Department</ApprovalQueueHeadCell>
            <ApprovalQueueHeadCell>Purpose</ApprovalQueueHeadCell>
            <ApprovalQueueHeadCell>Date Required</ApprovalQueueHeadCell>
            <ApprovalQueueHeadCell align="center" className="w-24">Priority</ApprovalQueueHeadCell>
            <ApprovalQueueHeadCell align="center">Type</ApprovalQueueHeadCell>
            <ApprovalQueueHeadCell>Current Step</ApprovalQueueHeadCell>
            <ApprovalQueueHeadCell className="px-5 py-3" />
          </ApprovalQueueHeaderRow>
        </thead>
        <tbody className="divide-y divide-pq-neutral-200">
          {rows.map((row) => {
            const active = canAct(row);
            return (
              <tr key={row.instance_id} className={`transition-colors ${active ? 'hover:bg-pq-neutral-50' : 'opacity-60'}`}>
                <td className="px-5 py-3.5 font-mono font-semibold text-pq-neutral-900">{row.po_number}</td>
                <td className="px-5 py-3.5 text-pq-neutral-900">{row.supplier_name_snapshot}</td>
                <td className="px-5 py-3.5 text-pq-neutral-500">{row.department_name_snapshot}</td>
                <td className="px-5 py-3.5 text-pq-neutral-500 max-w-[180px] truncate">{row.purpose}</td>
                <td className="px-5 py-3.5 text-pq-neutral-500 text-xs">{format(new Date(row.date_required), 'MMM d, yyyy')}</td>
                <td className="px-5 py-3.5 text-center">
                  <PriorityChip priority={row.pr1_priority} />
                </td>
                <td className="px-5 py-3.5 text-center">
                  <RequestTypeBadge type={row.request_type ?? 'goods'} />
                </td>
                <td className="px-5 py-3.5">
                  <StepChip stepName={`Step ${row.current_step}: ${row.step_position_required}`} canAct={active} />
                </td>
                <td className="px-5 py-3.5 text-right">
                  {active ? (
                    <Link href={`/approvals/po/${row.instance_id}`} className="inline-flex items-center gap-1.5 text-pq-primary-600 hover:text-pq-neutral-900 text-xs font-semibold transition">
                      <ArrowRight className="w-3.5 h-3.5" /> Review
                    </Link>
                  ) : (
                    <Link href={`/approvals/po/${row.instance_id}`} className="inline-flex items-center gap-1.5 text-pq-neutral-400 hover:text-pq-neutral-500 text-xs font-medium transition">
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

