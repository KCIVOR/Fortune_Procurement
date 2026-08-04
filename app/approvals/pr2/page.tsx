'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/structural-skeletons';
import PaginationControls from '@/components/shared/PaginationControls';
import FilterBar from '@/components/shared/FilterBar';
import type { FilterConfig } from '@/components/shared/FilterBar.types';
import { StatCard } from '@/components/shared/StatCard';
import { KPI_GRID_CLASS } from '@/components/shared/kpi-grid';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { canActOnPR2Step } from '@/lib/pr2-approvals';
import { canActOnRfqStep, getPr2QueueReviewUrl } from '@/lib/rfq-approvals';
import type { ApprovalInstanceStatus } from '@/types/approvals';
import {
  SquareCheck as CheckSquare,
  ClipboardList,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { format } from 'date-fns';
import PriorityChip from '@/components/shared/PriorityChip';
import { RequestTypeBadge } from '@/components/shared/RequestTypeBadge';
import ApprovalQueueTableShell from '@/components/shared/ApprovalQueueTableShell';
import { ApprovalQueueHeaderRow, ApprovalQueueHeadCell } from '@/components/shared/ApprovalQueueTableHeader';

const db = supabase as any;

interface PR2ApprovalRow {
  pr2_id: string;
  pr2_number: string;
  requisitioner_name_snapshot: string;
  department_name_snapshot: string;
  department_id: string | null;
  purpose: string;
  date_required: string;
  pr2_status: string;
  instance_id: string;
  workflow_code: string;
  current_step: number;
  instance_status: RowStatus;
  started_at: string;
  step_position_required: string;
  step_role_required: string;
  step_action_label: string;
  step_is_final: boolean;
  pr1_priority?: 'normal' | 'medium' | 'high';
  request_type?: 'goods' | 'services' | 'raw_material';
}

type RowStatus = ApprovalInstanceStatus | 'revision';

type StatusFilter = 'pending' | 'approved' | 'rejected' | 'revision' | 'all';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'revision', label: 'Needs Revision' },
  { value: 'all', label: 'All Statuses' },
];

const STATUS_FILTER_MAP: Record<StatusFilter, RowStatus[] | null> = {
  pending: ['active'],
  approved: ['approved'],
  rejected: ['rejected'],
  revision: ['revision', 'cancelled'],
  all: null,
};

export default function PR2ApprovalsPage() {
  const { profile } = useAuth();
  const [allRows, setAllRows] = useState<PR2ApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    if (!profile) return;

    const fetchData = async () => {
      setLoading(true);
      setError('');

      try {
        const [{ data: pr2Instances, error: pr2InstErr }, { data: rfqInstances, error: rfqInstErr }] =
          await Promise.all([
            db
              .from('approval_instances')
              .select('id, workflow_id, document_id, current_step, status, started_at')
              .eq('document_type', 'PR2')
              .order('started_at', { ascending: false }),
            db
              .from('approval_instances')
              .select('id, workflow_id, document_id, current_step, status, started_at')
              .eq('document_type', 'RFQ')
              .order('started_at', { ascending: false }),
          ]);

        const instErr = pr2InstErr ?? rfqInstErr;
        const instances = pr2Instances ?? [];

        if (instErr) throw instErr;
        if ((!instances || instances.length === 0) && (!rfqInstances || rfqInstances.length === 0)) {
          setAllRows([]);
          setLoading(false);
          return;
        }

        const pr2Ids = Array.from(new Set(instances.map((r: any) => r.document_id as string)));
        const rfqIds = Array.from(new Set((rfqInstances ?? []).map((r: any) => r.document_id as string)));
        const allMetaInstances = [...instances, ...(rfqInstances ?? [])];
        const workflowIds = Array.from(new Set(allMetaInstances.map((r: any) => r.workflow_id as string)));
        const instanceIds = allMetaInstances.map((r: any) => r.id as string);

        const [pr2Res, rfqRes, workflowRes, stepsRes, actionsRes] = await Promise.all([
          pr2Ids.length
            ? db.from('pr2_requests')
                .select('id, pr2_number, pr1_id, request_type, priority, requisitioner_name_snapshot, department_name_snapshot, department_id, purpose, date_required, status')
                .in('id', pr2Ids)
            : Promise.resolve({ data: [], error: null }),
          rfqIds.length
            ? db.from('rfq_batches').select('id, rfq_number, pr1_id, pr2_id').in('id', rfqIds)
            : Promise.resolve({ data: [], error: null }),
          db.from('approval_workflows')
            .select('id, code')
            .in('id', workflowIds),
          db.from('approval_steps')
            .select('workflow_id, step_order, role_required, position_required, action_label, is_final')
            .in('workflow_id', workflowIds),
          db.from('approval_actions')
            .select('instance_id, step_order, action, acted_at')
            .eq('actor_id', profile.id)
            .in('instance_id', instanceIds),
        ]);

        if (pr2Res.error) throw pr2Res.error;
        if (rfqRes.error) throw rfqRes.error;
        if (stepsRes.error) throw stepsRes.error;
        if (actionsRes.error) throw actionsRes.error;

        let pr2Map: Record<string, any> = Object.fromEntries((pr2Res.data ?? []).map((r: any) => [r.id, r]));
        const rfqMap: Record<string, any> = Object.fromEntries((rfqRes.data ?? []).map((r: any) => [r.id, r]));
        // PR2 records linked only via RFQ (canvassing phase)
        const linkedPr2Ids = Array.from(
          new Set((rfqRes.data ?? []).map((r: any) => r.pr2_id as string).filter((id: string) => id && !pr2Map[id])),
        );
        if (linkedPr2Ids.length > 0) {
          const { data: linkedPr2s, error: linkedErr } = await db
            .from('pr2_requests')
            .select('id, pr2_number, pr1_id, request_type, priority, requisitioner_name_snapshot, department_name_snapshot, department_id, purpose, date_required, status')
            .in('id', linkedPr2Ids);
          if (linkedErr) throw linkedErr;
          pr2Map = {
            ...pr2Map,
            ...Object.fromEntries((linkedPr2s ?? []).map((r: any) => [r.id, r])),
          };
        }

        const workflowMap: Record<string, any> = Object.fromEntries((workflowRes.data ?? []).map((r: any) => [r.id, r]));
        const steps: any[] = stepsRes.data ?? [];

        // Map of instance_id → most recent action this user took on it
        const userActionMap: Record<string, any> = {};
        for (const a of (actionsRes.data ?? []) as any[]) {
          const existing = userActionMap[a.instance_id];
          if (!existing || a.acted_at > existing.acted_at) {
            userActionMap[a.instance_id] = a;
          }
        }

        // Fetch PR1 priorities
        const pr1Ids = Array.from(new Set(
          Object.values(pr2Map).map((pr2: any) => pr2.pr1_id).filter(Boolean)
        ));
        const { data: pr1s } = pr1Ids.length > 0
          ? await db.from('pr1_requests').select('id, priority').in('id', pr1Ids)
          : { data: [] };
        const pr1PriorityMap: Record<string, string> = Object.fromEntries(
          ((pr1s ?? []) as any[]).map((pr1: any) => [pr1.id, pr1.priority])
        );

        const rows: PR2ApprovalRow[] = [];

        for (const inst of instances) {
          const pr2 = pr2Map[inst.document_id];
          const wf = workflowMap[inst.workflow_id];
          if (!pr2) continue;

          // Find the step the instance is currently on, then check if this
          // user can act on it. Using canActOnPR2Step handles the
          // Procurement Manager → Procurement Staff alias correctly without
          // relying on find() order (which caused PM to match step 1 via alias
          // even when the instance was at step 2).
          const currentStepDef = steps.find(
            (s: any) => s.workflow_id === inst.workflow_id && s.step_order === inst.current_step
          );

          const isMyTurn = inst.status === 'active' && !!currentStepDef &&
            canActOnPR2Step(profile, currentStepDef.role_required, currentStepDef.position_required, pr2.department_id ?? null);

          const userAction = userActionMap[inst.id];

          // Revision draft: cancelled instance where the PR2 was sent back and is still in draft
          const isRevisionDraft = profile.role === 'procurement'
            && inst.status === 'cancelled'
            && pr2.status === 'draft';

          // Include if it's my turn, I've already acted, or it's a revision draft for me to fix
          if (!isMyTurn && !userAction && !isRevisionDraft) continue;

          // For display: use current step when it's user's turn; find acted step for history
          const displayStep = isRevisionDraft
            ? { position_required: '', role_required: '', action_label: '', is_final: false }
            : isMyTurn
              ? currentStepDef!
              : (steps.find((s: any) => s.workflow_id === inst.workflow_id && s.step_order === userAction?.step_order) ?? currentStepDef!);

          // Display status from the user's perspective.
          // Priority order:
          // 1. isMyTurn — always active, even if the user acted on an earlier step
          //    (Procurement Manager approved step 1 then needs to act on step 2)
          // 2. isRevisionDraft — PR2 returned for revision
          // 3. userAction — historical record of what the user did
          let displayStatus: RowStatus;
          if (isMyTurn) {
            displayStatus = 'active';
          } else if (isRevisionDraft) {
            displayStatus = 'revision';
          } else if (userAction) {
            if (userAction.action === 'approved') displayStatus = 'approved';
            else if (userAction.action === 'rejected') displayStatus = 'rejected';
            else displayStatus = 'cancelled'; // revision_requested
          } else {
            displayStatus = 'active';
          }

          // Prefer the PR2's own priority (Planning-direct raw-material/services);
          // fall back to the linked PR1's priority for goods/services-via-warehouse
          // PR2s, mirroring resolvePR2RequestType()'s same prefer-pr2-then-pr1 pattern.
          const priority = pr2.priority ?? (pr2.pr1_id ? pr1PriorityMap[pr2.pr1_id] : undefined) ?? 'normal';

          rows.push({
            pr2_id: pr2.id,
            pr2_number: pr2.pr2_number,
            requisitioner_name_snapshot: pr2.requisitioner_name_snapshot,
            department_name_snapshot: pr2.department_name_snapshot,
            department_id: pr2.department_id ?? null,
            purpose: pr2.purpose,
            date_required: pr2.date_required,
            pr2_status: pr2.status,
            instance_id: inst.id,
            workflow_code: wf?.code ?? '',
            current_step: inst.current_step,
            instance_status: displayStatus,
            started_at: inst.started_at,
            step_position_required: displayStep.position_required,
            step_role_required: displayStep.role_required,
            step_action_label: displayStep.action_label,
            step_is_final: displayStep.is_final,
            pr1_priority: priority as 'normal' | 'medium' | 'high',
            request_type: pr2.request_type,
          });
        }

        for (const inst of (rfqInstances ?? [])) {
          const rfq = rfqMap[inst.document_id];
          const pr2 = rfq?.pr2_id ? pr2Map[rfq.pr2_id] : null;
          const wf = workflowMap[inst.workflow_id];
          if (!rfq || !pr2) continue;

          const currentStepDef = steps.find(
            (s: any) => s.workflow_id === inst.workflow_id && s.step_order === inst.current_step,
          );

          const isMyTurn = inst.status === 'active' && !!currentStepDef &&
            canActOnRfqStep(profile, currentStepDef.role_required, currentStepDef.position_required, pr2.department_id ?? null);

          const userAction = userActionMap[inst.id];
          if (!isMyTurn && !userAction) continue;

          const displayStep = isMyTurn
            ? currentStepDef!
            : (steps.find((s: any) => s.workflow_id === inst.workflow_id && s.step_order === userAction?.step_order) ?? currentStepDef!);

          let displayStatus: RowStatus;
          if (isMyTurn) {
            displayStatus = 'active';
          } else if (userAction) {
            if (userAction.action === 'approved') displayStatus = 'approved';
            else if (userAction.action === 'rejected') displayStatus = 'rejected';
            else displayStatus = 'cancelled';
          } else {
            displayStatus = 'active';
          }

          // Prefer the PR2's own priority (Planning-direct raw-material/services);
          // fall back to the linked PR1's priority for goods/services-via-warehouse
          // PR2s, mirroring resolvePR2RequestType()'s same prefer-pr2-then-pr1 pattern.
          const priority = pr2.priority ?? (pr2.pr1_id ? pr1PriorityMap[pr2.pr1_id] : undefined) ?? 'normal';

          rows.push({
            pr2_id: pr2.id,
            pr2_number: pr2.pr2_number,
            requisitioner_name_snapshot: pr2.requisitioner_name_snapshot,
            department_name_snapshot: pr2.department_name_snapshot,
            department_id: pr2.department_id ?? null,
            purpose: pr2.purpose,
            date_required: pr2.date_required,
            pr2_status: pr2.status,
            instance_id: inst.id,
            workflow_code: wf?.code ?? 'RFQ_APPROVAL',
            current_step: inst.current_step,
            instance_status: displayStatus,
            started_at: inst.started_at,
            step_position_required: displayStep.position_required,
            step_role_required: displayStep.role_required,
            step_action_label: displayStep.action_label,
            step_is_final: displayStep.is_final,
            pr1_priority: priority as 'normal' | 'medium' | 'high',
            request_type: pr2.request_type,
          });
        }

        // Deduplicate revision rows: a PR2 with multiple cancelled instances should
        // only appear once — keep the most recent instance (instances are ordered
        // descending by started_at so the first revision row per PR2 is the latest).
        const seenRevisionPr2s = new Set<string>();
        const deduped = rows.filter(r => {
          if (r.instance_status !== 'revision') return true;
          if (seenRevisionPr2s.has(r.pr2_id)) return false;
          seenRevisionPr2s.add(r.pr2_id);
          return true;
        });

        setAllRows(deduped);
      } catch (e) {
        console.error(e);
        setError('Failed to load PR2 approval queue.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [profile]);

  const filteredRows = useMemo(() => {
    let rows = allRows;

    const statusValues = STATUS_FILTER_MAP[statusFilter];
    if (statusValues) {
      rows = rows.filter(r => (statusValues as RowStatus[]).includes(r.instance_status));
    }

    if (priorityFilter !== 'all') {
      rows = rows.filter(r => (r.pr1_priority ?? 'normal') === priorityFilter);
    }

    if (appliedSearch) {
      const term = appliedSearch.toLowerCase();
      rows = rows.filter(r =>
        r.pr2_number.toLowerCase().includes(term) ||
        r.requisitioner_name_snapshot.toLowerCase().includes(term) ||
        r.purpose.toLowerCase().includes(term)
      );
    }

    return rows;
  }, [allRows, statusFilter, priorityFilter, appliedSearch]);

  const stats = useMemo(() => {
    const pending = allRows.filter(r => r.instance_status === 'active').length;
    const approved = allRows.filter(r => r.instance_status === 'approved').length;
    const rejected = allRows.filter(r => r.instance_status === 'rejected').length;
    const revision = allRows.filter(r => r.instance_status === 'revision').length;
    return { pending, approved, rejected, revision, total: allRows.length };
  }, [allRows]);

  const totalPages = Math.ceil(filteredRows.length / pageSize);
  const paginatedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const canAct = (row: PR2ApprovalRow): boolean => {
    if (row.instance_status === 'revision' || row.instance_status !== 'active' || !profile) return false;
    if (row.workflow_code === 'RFQ_APPROVAL') {
      return canActOnRfqStep(profile, row.step_role_required, row.step_position_required, row.department_id);
    }
    return canActOnPR2Step(profile, row.step_role_required, row.step_position_required, row.department_id);
  };

  const filters: FilterConfig[] = [
    {
      type: 'search',
      id: 'pr2-search',
      label: 'Search',
      placeholder: 'PR2 number, requestor, purpose...',
      value: search,
      onChange: (value) => setSearch(value as string),
    },
    {
      type: 'select',
      id: 'pr2-status',
      label: 'Status',
      placeholder: 'Select status',
      value: statusFilter,
      onChange: (value) => {
        setStatusFilter(value as StatusFilter);
        setCurrentPage(1);
      },
      options: STATUS_OPTIONS,
    },
    {
      type: 'select',
      id: 'pr2-priority',
      label: 'Priority',
      placeholder: 'All priorities',
      value: priorityFilter,
      onChange: (value) => {
        setPriorityFilter(value as string);
        setCurrentPage(1);
      },
      options: [
        { value: 'all',    label: 'All Priorities' },
        { value: 'normal', label: 'Normal' },
        { value: 'medium', label: 'Medium' },
        { value: 'high',   label: 'High' },
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
    setStatusFilter('pending');
    setPriorityFilter('all');
    setCurrentPage(1);
  };

  const PHASE_LABELS: Record<string, string> = {
    PR2_PHASE1: 'Approval',
    PR2_FINAL: 'PR2 Sign-off',
    RFQ_APPROVAL: 'Canvassing',
  };

  return (
    <AppShell title="PR2 Requests">
      <PageHeader
        title="PR2 Requests"
        description="PR2 sign-off and supplier canvassing approvals assigned to your step."
      />

      {stats.revision > 0 && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-md bg-pq-warning-50 border border-pq-warning-200">
          <RotateCcw className="w-4 h-4 text-pq-warning-600 shrink-0" />
          <span className="text-sm text-pq-warning-700 font-medium">
            {stats.revision} PR2{stats.revision !== 1 ? 's' : ''} need revision
          </span>
          <button
            onClick={() => { setStatusFilter('revision'); setCurrentPage(1); }}
            className="ml-auto text-xs font-semibold text-pq-warning-700 underline hover:text-pq-neutral-900 transition"
          >
            Filter to view
          </button>
        </div>
      )}

      <div className={`${KPI_GRID_CLASS} mb-6`}>
        <StatCard
          label="Pending"
          value={stats.pending}
          accent="amber"
          icon={<Clock className="w-5 h-5" />}
        />
        <StatCard
          label="Approved"
          value={stats.approved}
          accent="green"
          icon={<CheckCircle2 className="w-5 h-5" />}
        />
        <StatCard
          label="Rejected"
          value={stats.rejected}
          accent="red"
          icon={<XCircle className="w-5 h-5" />}
        />
        <StatCard
          label="Total"
          value={stats.total}
          accent="blue"
          icon={<ClipboardList className="w-5 h-5" />}
        />
      </div>

      <FilterBar
        filters={filters}
        onApply={handleApply}
        onClear={handleClear}
        loading={loading}
        resultCount={filteredRows.length}
        resultLabel="request"
        className="mb-6"
      />

      {loading ? (
        <TableSkeleton rows={5} cols={9} />
      ) : error ? (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">{error}</div>
      ) : filteredRows.length === 0 ? (
        <div className="bg-white rounded-md border border-pq-neutral-200">
          <EmptyState
            title={statusFilter === 'pending' ? 'No pending PR2 approvals' : 'No PR2 requests found'}
            description={statusFilter === 'pending'
              ? 'Procurement purchase requests routed for your approval will appear here.'
              : 'Try adjusting your filters.'}
            icon={CheckSquare}
          />
        </div>
      ) : (
        <div className="space-y-4">
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
                    <ApprovalQueueHeadCell>Status</ApprovalQueueHeadCell>
                    <ApprovalQueueHeadCell className="px-5 py-3" />
                  </ApprovalQueueHeaderRow>
                </thead>
                <tbody className="divide-y divide-pq-neutral-200">
                  {paginatedRows.map((row) => {
                    const active = canAct(row);
                    const phaseLabel = PHASE_LABELS[row.workflow_code] ?? row.workflow_code;
                    return (
                      <tr key={row.instance_id} className={`transition-colors ${active ? 'hover:bg-pq-neutral-50' : ''}`}>
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
                          <StatusBadge status={row.instance_status} />
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {row.instance_status === 'revision' ? (
                            <Link href={`/pr2/${row.pr2_id}`} className="inline-flex items-center gap-1.5 text-pq-warning-600 hover:text-pq-neutral-900 text-xs font-semibold transition">
                              <ArrowRight className="w-3.5 h-3.5" /> Revise
                            </Link>
                          ) : active ? (
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

          <PaginationControls
            currentPage={currentPage}
            totalPages={Math.max(1, totalPages)}
            pageSize={pageSize}
            totalCount={filteredRows.length}
            entityLabel="requests"
            loading={loading}
            onPageChange={setCurrentPage}
            className="rounded-md border border-pq-neutral-200"
          />
        </div>
      )}
    </AppShell>
  );
}

function StatusBadge({ status }: { status: RowStatus }) {
  const styles: Record<RowStatus, string> = {
    active: 'bg-pq-warning-100 text-pq-warning-600 border-pq-warning-100',
    approved: 'bg-pq-success-100 text-pq-success-600 border-pq-success-100',
    rejected: 'bg-pq-danger-100 text-pq-danger-600 border-pq-danger-100',
    cancelled: 'bg-pq-warning-50 text-pq-warning-700 border-pq-warning-200',
    revision: 'bg-pq-warning-100 text-pq-warning-700 border-pq-warning-200',
  };

  const labels: Record<RowStatus, string> = {
    active: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    cancelled: 'Revision Requested',
    revision: 'Needs Revision',
  };

  return (
    <span className={`inline-flex items-center text-xs font-semibold border rounded-full px-2.5 py-0.5 ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
