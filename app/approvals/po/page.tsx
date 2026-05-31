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
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { canActOnPOStep } from '@/lib/po-approvals';
import type { ApprovalInstanceStatus } from '@/types/approvals';
import {
  SquareCheck as CheckSquare,
  ClipboardList,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ShoppingCart,
} from 'lucide-react';
import { format } from 'date-fns';
import PriorityChip from '@/components/shared/PriorityChip';
import ApprovalQueueTableShell from '@/components/shared/ApprovalQueueTableShell';
import { ApprovalQueueHeaderRow, ApprovalQueueHeadCell } from '@/components/shared/ApprovalQueueTableHeader';

const db = supabase as any;

interface POApprovalRow {
  po_id: string;
  po_number: string;
  supplier_name_snapshot: string;
  department_name_snapshot: string;
  purpose: string;
  date_required: string;
  po_status: string;
  instance_id: string;
  current_step: number;
  instance_status: ApprovalInstanceStatus;
  started_at: string;
  step_role_required: string;
  step_position_required: string;
  step_action_label: string;
  step_is_final: boolean;
  pr1_priority?: 'normal' | 'medium' | 'high';
}

type StatusFilter = 'pending' | 'approved' | 'rejected' | 'all';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All Statuses' },
];

const STATUS_FILTER_MAP: Record<StatusFilter, ApprovalInstanceStatus[] | null> = {
  pending: ['active'],
  approved: ['approved'],
  rejected: ['rejected', 'cancelled'],
  all: null,
};

export default function POApprovalsPage() {
  const { profile } = useAuth();
  const [allRows, setAllRows] = useState<POApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
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
        const { data: instances, error: instErr } = await db
          .from('approval_instances')
          .select('id, workflow_id, document_id, current_step, status, started_at')
          .eq('document_type', 'PO')
          .order('started_at', { ascending: false });

        if (instErr) throw instErr;
        if (!instances || instances.length === 0) {
          setAllRows([]);
          setLoading(false);
          return;
        }

        const poIds = Array.from(new Set(instances.map((r: any) => r.document_id as string)));
        const workflowIds = Array.from(new Set(instances.map((r: any) => r.workflow_id as string)));
        const instanceIds = instances.map((r: any) => r.id as string);

        const [poRes, stepsRes, actionsRes] = await Promise.all([
          db.from('po_requests')
            .select('id, po_number, pr2_id, supplier_name_snapshot, department_name_snapshot, purpose, date_required, status')
            .in('id', poIds),
          db.from('approval_steps')
            .select('workflow_id, step_order, role_required, position_required, action_label, is_final')
            .in('workflow_id', workflowIds),
          db.from('approval_actions')
            .select('instance_id, step_order, action, acted_at')
            .eq('actor_id', profile.id)
            .in('instance_id', instanceIds),
        ]);

        if (poRes.error) throw poRes.error;
        if (actionsRes.error) throw actionsRes.error;

        const poMap: Record<string, any> = Object.fromEntries((poRes.data ?? []).map((r: any) => [r.id, r]));
        const steps: any[] = stepsRes.data ?? [];

        // Map of instance_id → most recent action this user took on it
        const userActionMap: Record<string, any> = {};
        for (const a of (actionsRes.data ?? []) as any[]) {
          const existing = userActionMap[a.instance_id];
          if (!existing || a.acted_at > existing.acted_at) {
            userActionMap[a.instance_id] = a;
          }
        }

        // Fetch PR2 IDs and PR1 priorities through PR2
        const pr2Ids = Array.from(new Set(
          (poRes.data ?? []).map((po: any) => po.pr2_id).filter(Boolean)
        ));
        const { data: pr2s } = pr2Ids.length > 0
          ? await db.from('pr2_requests').select('id, pr1_id').in('id', pr2Ids)
          : { data: [] };
        const pr2Map: Record<string, any> = Object.fromEntries(
          ((pr2s ?? []) as any[]).map((pr2: any) => [pr2.id, pr2])
        );

        const pr1Ids = Array.from(new Set(
          Object.values(pr2Map).map((pr2: any) => pr2.pr1_id).filter(Boolean)
        ));
        const { data: pr1s } = pr1Ids.length > 0
          ? await db.from('pr1_requests').select('id, priority').in('id', pr1Ids)
          : { data: [] };
        const pr1PriorityMap: Record<string, string> = Object.fromEntries(
          ((pr1s ?? []) as any[]).map((pr1: any) => [pr1.id, pr1.priority])
        );

        const rows: POApprovalRow[] = [];

        for (const inst of instances) {
          const po = poMap[inst.document_id];
          if (!po) continue;

          // Find the step that matches the user's position
          const userStep = steps.find(
            (s: any) => s.workflow_id === inst.workflow_id && s.position_required === profile.position
          );

          if (!userStep) continue;

          const userAction = userActionMap[inst.id];
          const isMyTurn = inst.status === 'active' && inst.current_step === userStep.step_order;

          // Include if it's my turn OR I've already acted on it
          if (!isMyTurn && !userAction) continue;

          // Display status from the user's perspective:
          // - if they acted, reflect their action (even if the overall instance is still active)
          // - otherwise it's their turn → show as pending (active)
          let displayStatus: ApprovalInstanceStatus;
          if (userAction) {
            if (userAction.action === 'approved') displayStatus = 'approved';
            else if (userAction.action === 'rejected') displayStatus = 'rejected';
            else displayStatus = 'cancelled'; // revision_requested
          } else {
            displayStatus = 'active';
          }

          const pr1Priority = po.pr2_id && pr2Map[po.pr2_id]?.pr1_id
            ? pr1PriorityMap[pr2Map[po.pr2_id].pr1_id]
            : undefined;

          rows.push({
            po_id: po.id,
            po_number: po.po_number,
            supplier_name_snapshot: po.supplier_name_snapshot,
            department_name_snapshot: po.department_name_snapshot,
            purpose: po.purpose,
            date_required: po.date_required,
            po_status: po.status,
            instance_id: inst.id,
            current_step: inst.current_step,
            instance_status: displayStatus,
            started_at: inst.started_at,
            step_role_required: userStep.role_required,
            step_position_required: userStep.position_required,
            step_action_label: userStep.action_label,
            step_is_final: userStep.is_final,
            pr1_priority: pr1Priority as 'normal' | 'medium' | 'high' | undefined,
          });
        }

        setAllRows(rows);
      } catch (e) {
        console.error(e);
        setError('Failed to load PO approval queue.');
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
      rows = rows.filter(r => statusValues.includes(r.instance_status));
    }

    if (appliedSearch) {
      const term = appliedSearch.toLowerCase();
      rows = rows.filter(r =>
        r.po_number.toLowerCase().includes(term) ||
        r.supplier_name_snapshot.toLowerCase().includes(term) ||
        r.purpose.toLowerCase().includes(term)
      );
    }

    return rows;
  }, [allRows, statusFilter, appliedSearch]);

  const stats = useMemo(() => {
    const pending = allRows.filter(r => r.instance_status === 'active').length;
    const approved = allRows.filter(r => r.instance_status === 'approved').length;
    const rejected = allRows.filter(r => r.instance_status === 'rejected' || r.instance_status === 'cancelled').length;
    return { pending, approved, rejected, total: allRows.length };
  }, [allRows]);

  const totalPages = Math.ceil(filteredRows.length / pageSize);
  const paginatedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const canAct = (row: POApprovalRow): boolean =>
    !!(profile && row.instance_status === 'active' && canActOnPOStep(profile, row.step_role_required, row.step_position_required));

  const filters: FilterConfig[] = [
    {
      type: 'search',
      id: 'po-search',
      label: 'Search',
      placeholder: 'PO number, supplier, purpose...',
      value: search,
      onChange: (value) => setSearch(value as string),
    },
    {
      type: 'select',
      id: 'po-status',
      label: 'Status',
      placeholder: 'Select status',
      value: statusFilter,
      onChange: (value) => {
        setStatusFilter(value as StatusFilter);
        setCurrentPage(1);
      },
      options: STATUS_OPTIONS,
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
    setCurrentPage(1);
  };

  return (
    <AppShell title="Purchase Orders">
      <PageHeader
        title="Purchase Orders"
        description="Purchase orders assigned to your approval step."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
        resultLabel="order"
        className="mb-6"
      />

      {loading ? (
        <TableSkeleton rows={5} cols={8} />
      ) : error ? (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">{error}</div>
      ) : filteredRows.length === 0 ? (
        <div className="bg-white rounded-md border border-pq-neutral-200">
          <EmptyState
            title={statusFilter === 'pending' ? 'No pending PO approvals' : 'No purchase orders found'}
            description={statusFilter === 'pending'
              ? 'Purchase orders routed for your approval will appear here.'
              : 'Try adjusting your filters.'}
            icon={CheckSquare}
          />
        </div>
      ) : (
        <div className="space-y-4">
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
                    <ApprovalQueueHeadCell>Status</ApprovalQueueHeadCell>
                    <ApprovalQueueHeadCell className="px-5 py-3" />
                  </ApprovalQueueHeaderRow>
                </thead>
                <tbody className="divide-y divide-pq-neutral-200">
                  {paginatedRows.map((row) => {
                    const active = canAct(row);
                    return (
                      <tr key={row.instance_id} className={`transition-colors ${active ? 'hover:bg-pq-neutral-50' : ''}`}>
                        <td className="px-5 py-3.5 font-mono font-semibold text-pq-neutral-900">{row.po_number}</td>
                        <td className="px-5 py-3.5 text-pq-neutral-900">{row.supplier_name_snapshot}</td>
                        <td className="px-5 py-3.5 text-pq-neutral-500">{row.department_name_snapshot}</td>
                        <td className="px-5 py-3.5 text-pq-neutral-500 max-w-[180px] truncate">{row.purpose}</td>
                        <td className="px-5 py-3.5 text-pq-neutral-500 text-xs">{format(new Date(row.date_required), 'MMM d, yyyy')}</td>
                        <td className="px-5 py-3.5 text-center">
                          <PriorityChip priority={row.pr1_priority} />
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={row.instance_status} />
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

          <PaginationControls
            currentPage={currentPage}
            totalPages={Math.max(1, totalPages)}
            pageSize={pageSize}
            totalCount={filteredRows.length}
            entityLabel="orders"
            loading={loading}
            onPageChange={setCurrentPage}
            className="rounded-md border border-pq-neutral-200"
          />
        </div>
      )}
    </AppShell>
  );
}

function StatusBadge({ status }: { status: ApprovalInstanceStatus }) {
  const styles: Record<ApprovalInstanceStatus, string> = {
    active: 'bg-pq-warning-100 text-pq-warning-600 border-pq-warning-100',
    approved: 'bg-pq-success-100 text-pq-success-600 border-pq-success-100',
    rejected: 'bg-pq-danger-100 text-pq-danger-600 border-pq-danger-100',
    cancelled: 'bg-pq-neutral-100 text-pq-neutral-600 border-pq-neutral-200',
  };

  const labels: Record<ApprovalInstanceStatus, string> = {
    active: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
  };

  return (
    <span className={`inline-flex items-center text-xs font-semibold border rounded-full px-2.5 py-0.5 ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
