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
import { canActOnStep } from '@/lib/approvals';
import type { ApprovalInstanceStatus } from '@/types/approvals';
import {
  SquareCheck as CheckSquare,
  ClipboardList,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  FileText,
} from 'lucide-react';
import { format } from 'date-fns';
import PriorityChip from '@/components/shared/PriorityChip';
import { RequestTypeBadge } from '@/components/shared/RequestTypeBadge';
import type { PR1RequestType } from '@/types/pr1';
import StepChip from '@/components/shared/StepChip';
import ApprovalQueueTableShell from '@/components/shared/ApprovalQueueTableShell';
import { ApprovalQueueHeaderRow, ApprovalQueueHeadCell } from '@/components/shared/ApprovalQueueTableHeader';

const db = supabase as any;

interface PR1ApprovalRow {
  pr1_id: string;
  pr1_number: string;
  requisitioner_name_snapshot: string;
  department_name_snapshot: string;
  purpose: string;
  priority: string;
  request_type: PR1RequestType;
  date_required: string;
  submitted_at: string | null;
  instance_id: string;
  workflow_code: string;
  current_step: number;
  instance_status: ApprovalInstanceStatus;
  started_at: string;
  step_position_required: string;
  step_role_required: string;
  step_action_label: string;
  step_is_final: boolean;
}

type StatusFilter = 'pending' | 'approved' | 'rejected' | 'all';
type RequestTypeFilter = 'all' | 'goods' | 'services';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All Statuses' },
];

// Map filter values to instance_status values
const STATUS_FILTER_MAP: Record<StatusFilter, ApprovalInstanceStatus[] | null> = {
  pending: ['active'],
  approved: ['approved'],
  rejected: ['rejected', 'cancelled'],
  all: null, // No filter
};

export default function PR1ApprovalsPage() {
  const { profile } = useAuth();
  const [allRows, setAllRows] = useState<PR1ApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [requestTypeFilter, setRequestTypeFilter] = useState<RequestTypeFilter>('all');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Fetch all PR1 approval instances for the user's step
  useEffect(() => {
    if (!profile) return;

    const fetchData = async () => {
      setLoading(true);
      setError('');

      try {
        // Fetch all instances (not just active)
        const { data: instances, error: instErr } = await db
          .from('approval_instances')
          .select('id, workflow_id, document_id, current_step, status, started_at')
          .eq('document_type', 'PR1')
          .order('started_at', { ascending: false });

        if (instErr) throw instErr;
        if (!instances || instances.length === 0) {
          setAllRows([]);
          setLoading(false);
          return;
        }

        const pr1Ids = Array.from(new Set(instances.map((r: any) => r.document_id as string)));
        const workflowIds = Array.from(new Set(instances.map((r: any) => r.workflow_id as string)));
        const instanceIds = instances.map((r: any) => r.id as string);

        const [pr1Res, workflowRes, stepsRes, actionsRes] = await Promise.all([
          db.from('pr1_requests')
            .select('id, pr1_number, requisitioner_name_snapshot, department_name_snapshot, purpose, priority, request_type, date_required, submitted_at')
            .in('id', pr1Ids),
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

        if (pr1Res.error) throw pr1Res.error;
        if (stepsRes.error) throw stepsRes.error;
        if (actionsRes.error) throw actionsRes.error;

        const pr1Map: Record<string, any> = Object.fromEntries((pr1Res.data ?? []).map((r: any) => [r.id, r]));
        const workflowMap: Record<string, any> = Object.fromEntries((workflowRes.data ?? []).map((r: any) => [r.id, r]));
        const steps: any[] = stepsRes.data ?? [];
        // Map of instance_id → most recent action this user took on it.
        // An instance can in theory have multiple actions by the same user across steps;
        // the latest one is what should drive the display.
        const userActionMap: Record<string, any> = {};
        for (const a of (actionsRes.data ?? []) as any[]) {
          const existing = userActionMap[a.instance_id];
          if (!existing || a.acted_at > existing.acted_at) {
            userActionMap[a.instance_id] = a;
          }
        }

        // An instance belongs in the user's queue if either:
        //   (a) it is currently their turn (active + current_step === userStep.step_order), or
        //   (b) they have already recorded an action on it (regardless of where the instance sits now).
        // Without (b), non-final approvers disappear from their own queue between the moment they
        // approve and the moment the instance reaches a terminal status, breaking the KPI counts.
        const rows: PR1ApprovalRow[] = [];

        for (const inst of instances) {
          const pr1 = pr1Map[inst.document_id];
          const wf = workflowMap[inst.workflow_id];
          if (!pr1) continue;

          // Find the step that matches the user's position in this workflow
          const userStep = steps.find(
            (s: any) => s.workflow_id === inst.workflow_id && s.position_required === profile.position
          );
          if (!userStep) continue; // User's position is not part of this workflow

          const userAction = userActionMap[inst.id];
          const isMyTurn = inst.status === 'active' && inst.current_step === userStep.step_order;

          if (!isMyTurn && !userAction) continue;

          // Display status from the user's perspective:
          //   - if they acted, reflect their action (even if the overall instance is still active)
          //   - otherwise it's their turn → show as pending (active)
          let displayStatus: ApprovalInstanceStatus;
          if (userAction) {
            if (userAction.action === 'approved') displayStatus = 'approved';
            else if (userAction.action === 'rejected') displayStatus = 'rejected';
            else displayStatus = 'cancelled'; // revision_requested
          } else {
            displayStatus = 'active';
          }

          rows.push({
            pr1_id: pr1.id,
            pr1_number: pr1.pr1_number,
            requisitioner_name_snapshot: pr1.requisitioner_name_snapshot,
            department_name_snapshot: pr1.department_name_snapshot,
            purpose: pr1.purpose,
            priority: pr1.priority,
            request_type: (pr1.request_type ?? 'goods') as PR1RequestType,
            date_required: pr1.date_required,
            submitted_at: pr1.submitted_at,
            instance_id: inst.id,
            workflow_code: wf?.code ?? '',
            current_step: inst.current_step,
            instance_status: displayStatus,
            started_at: inst.started_at,
            step_position_required: userStep.position_required,
            step_role_required: userStep.role_required,
            step_action_label: userStep.action_label,
            step_is_final: userStep.is_final,
          });
        }

        setAllRows(rows);
      } catch (e) {
        console.error(e);
        setError('Failed to load PR1 approval queue.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [profile]);

  // Filter rows based on status and search
  const filteredRows = useMemo(() => {
    let rows = allRows;

    // Apply status filter
    const statusValues = STATUS_FILTER_MAP[statusFilter];
    if (statusValues) {
      rows = rows.filter(r => statusValues.includes(r.instance_status));
    }

    // Apply request type filter
    if (requestTypeFilter !== 'all') {
      rows = rows.filter(r => r.request_type === requestTypeFilter);
    }

    // Apply search filter
    if (appliedSearch) {
      const term = appliedSearch.toLowerCase();
      rows = rows.filter(r =>
        r.pr1_number.toLowerCase().includes(term) ||
        r.requisitioner_name_snapshot.toLowerCase().includes(term) ||
        r.purpose.toLowerCase().includes(term)
      );
    }

    return rows;
  }, [allRows, statusFilter, requestTypeFilter, appliedSearch]);

  // Calculate stats
  const stats = useMemo(() => {
    const pending = allRows.filter(r => r.instance_status === 'active').length;
    const approved = allRows.filter(r => r.instance_status === 'approved').length;
    const rejected = allRows.filter(r => r.instance_status === 'rejected' || r.instance_status === 'cancelled').length;
    return { pending, approved, rejected, total: allRows.length };
  }, [allRows]);

  // Pagination
  const totalPages = Math.ceil(filteredRows.length / pageSize);
  const paginatedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const canAct = (row: PR1ApprovalRow): boolean =>
    !!(profile && row.instance_status === 'active' && canActOnStep(profile, row.step_position_required));

  // Filter configuration
  const filters: FilterConfig[] = [
    {
      type: 'search',
      id: 'pr1-search',
      label: 'Search',
      placeholder: 'PR1 number, requestor, purpose...',
      value: search,
      onChange: (value) => setSearch(value as string),
    },
    {
      type: 'select',
      id: 'pr1-status',
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
      id: 'pr1-request-type',
      label: 'Type',
      placeholder: 'All types',
      value: requestTypeFilter,
      onChange: (value) => {
        setRequestTypeFilter(value as RequestTypeFilter);
        setCurrentPage(1);
      },
      options: [
        { value: 'all',      label: 'All Types' },
        { value: 'goods',    label: 'Goods' },
        { value: 'services', label: 'Services' },
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
    setRequestTypeFilter('all');
    setCurrentPage(1);
  };

  return (
    <AppShell title="PR1 Requests">
      <PageHeader
        title="PR1 Requests"
        description="Purchase requests assigned to your approval step."
      />

      {/* Stats */}
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

      {/* Filter Bar */}
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
        <TableSkeleton rows={5} cols={8} />
      ) : error ? (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">{error}</div>
      ) : filteredRows.length === 0 ? (
        <div className="bg-white rounded-md border border-pq-neutral-200">
          <EmptyState
            title={statusFilter === 'pending' ? 'No pending PR1 approvals' : 'No PR1 requests found'}
            description={statusFilter === 'pending'
              ? 'Purchase requests routed for your approval will appear here.'
              : 'Try adjusting your filters.'}
            icon={CheckSquare}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <PR1QueueTable rows={paginatedRows} canAct={canAct} />

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

// ─── PR1 queue table ──────────────────────────────────────────────────────────

const STATUS_STYLES: Record<ApprovalInstanceStatus, string> = {
  active: 'bg-pq-warning-100 text-pq-warning-600 border-pq-warning-100',
  approved: 'bg-pq-success-100 text-pq-success-600 border-pq-success-100',
  rejected: 'bg-pq-danger-100 text-pq-danger-600 border-pq-danger-100',
  cancelled: 'bg-pq-neutral-100 text-pq-neutral-600 border-pq-neutral-200',
};

const STATUS_LABELS: Record<ApprovalInstanceStatus, string> = {
  active: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

function PR1QueueTable({
  rows,
  canAct,
}: {
  rows: PR1ApprovalRow[];
  canAct: (row: PR1ApprovalRow) => boolean;
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
              <ApprovalQueueHeadCell className="w-24">Type</ApprovalQueueHeadCell>
              <ApprovalQueueHeadCell>Status</ApprovalQueueHeadCell>
              <ApprovalQueueHeadCell className="px-5 py-3" />
            </ApprovalQueueHeaderRow>
          </thead>
          <tbody className="divide-y divide-pq-neutral-200">
            {rows.map((row) => {
              const active = canAct(row);
              return (
                <tr key={row.instance_id} className={`transition-colors ${active ? 'hover:bg-pq-neutral-50' : ''}`}>
                  <td className="px-5 py-3.5 font-mono font-semibold text-pq-neutral-900">{row.pr1_number}</td>
                  <td className="px-5 py-3.5 text-pq-neutral-900">{row.requisitioner_name_snapshot}</td>
                  <td className="px-5 py-3.5 text-pq-neutral-500">{row.department_name_snapshot}</td>
                  <td className="px-5 py-3.5 text-pq-neutral-500 max-w-[180px] truncate">{row.purpose}</td>
                  <td className="px-5 py-3.5 text-pq-neutral-500 text-xs">{format(new Date(row.date_required), 'MMM d, yyyy')}</td>
                  <td className="px-5 py-3.5 text-center">
                    <PriorityChip priority={row.priority} />
                  </td>
                  <td className="px-5 py-3.5">
                    <RequestTypeBadge type={row.request_type} />
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center text-xs font-semibold border rounded-full px-2.5 py-0.5 ${STATUS_STYLES[row.instance_status]}`}>
                      {STATUS_LABELS[row.instance_status]}
                    </span>
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
