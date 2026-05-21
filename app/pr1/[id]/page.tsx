'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useBackNavigation } from '@/hooks/use-back-navigation';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import { DetailPageSkeleton } from '@/components/shared/structural-skeletons';
import StatusChip from '@/components/shared/StatusChip';
import type { StatusVariant } from '@/components/shared/StatusChip';
import { fetchPR1ById, canUpdatePR1Priority, updatePR1Priority, fetchPR1LifecycleSummaries, deleteDraftPR1 } from '@/lib/pr1';
import { fetchPR1ApprovalSignatories } from '@/lib/approvals';
import type { PR1WithItems, PR1LifecycleSummary, PR1Item } from '@/types/pr1';
import type { PR1ApprovalSignatories } from '@/types/approvals';
import RelatedRecords from '@/components/shared/RelatedRecords';
import PriorityChip from '@/components/shared/PriorityChip';
import { PR1_STATUS_LABELS } from '@/types/pr1';
import { useAuth } from '@/context/AuthContext';
import { Pencil, Clock, CircleCheck as CheckCircle2, User, Building2, FileText, CalendarDays, CircleAlert as AlertCircle, Circle as XCircle, RotateCcw, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import ActionPill from '@/components/shared/ActionPill';
import DetailBackButton from '@/components/shared/DetailBackButton';
import DetailHeaderLayout from '@/components/shared/DetailHeaderLayout';
import DetailTitleRow from '@/components/shared/DetailTitleRow';
import DetailPrintButton from '@/components/shared/DetailPrintButton';
import DetailCard from '@/components/shared/DetailCard';
import DetailCardHeader from '@/components/shared/DetailCardHeader';
import DetailInfoGrid from '@/components/shared/DetailInfoGrid';
import DetailInfoField from '@/components/shared/DetailInfoField';
import DetailWideInfoRow from '@/components/shared/DetailWideInfoRow';
import DetailTableCard from '@/components/shared/DetailTableCard';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const STATUS_MAP: Record<string, StatusVariant> = {
  draft:                'draft',
  pending_warehouse:    'pending',
  pending_approval:     'in_review',
  resolved_internal:    'validated',
  revision_requested:   'in_review',
  for_canvassing:       'approved',
  canvassing_complete:  'approved',
  approved:             'approved',
  rejected:             'rejected',
  cancelled:            'cancelled',
};

export default function PR1DetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const { handleBack } = useBackNavigation();
  const [pr1, setPR1] = useState<PR1WithItems | null>(null);
  const [lifecycle, setLifecycle] = useState<PR1LifecycleSummary | null>(null);
  const [approvalSignatories, setApprovalSignatories] = useState<
    PR1ApprovalSignatories | null | undefined
  >(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [priorityUpdating, setPriorityUpdating] = useState(false);
  const [priorityError, setPriorityError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchPR1ById(id)
      .then(async (data) => {
        setPR1(data);
        if (data) {
          try {
            const map = await fetchPR1LifecycleSummaries([{ id: data.id, status: data.status }]);
            setLifecycle(map[data.id] ?? null);
          } catch {
            setLifecycle(null);
          }
        }
      })
      .catch(() => setError('Failed to load PR1.'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    setApprovalSignatories(undefined);

    if (!id || !pr1?.id || pr1.id !== id || !profile) {
      setApprovalSignatories(null);
      return;
    }

    const mayLoadApprovalSignatories =
      profile.role !== 'employee' || profile.id === pr1.requisitioner_id;

    if (!mayLoadApprovalSignatories) {
      setApprovalSignatories(null);
      return;
    }

    let cancelled = false;
    fetchPR1ApprovalSignatories(pr1.id)
      .then((data) => {
        if (!cancelled) setApprovalSignatories(data);
      })
      .catch(() => {
        if (!cancelled) setApprovalSignatories(null);
      });
    return () => {
      cancelled = true;
    };
  }, [id, pr1?.id, pr1?.requisitioner_id, profile]);

  const canEdit = pr1 && profile && pr1.requisitioner_id === profile.id && pr1.status === 'draft';
  const canUpdatePriority = pr1 && profile && canUpdatePR1Priority(profile);

  const handlePriorityChange = async (newPriority: 'normal' | 'medium' | 'high') => {
    if (!pr1 || !profile || newPriority === pr1.priority) return;

    setPriorityUpdating(true);
    setPriorityError('');

    try {
      await updatePR1Priority(pr1.id, newPriority, profile);
      setPR1({ ...pr1, priority: newPriority });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update priority.';
      setPriorityError(message);
    } finally {
      setPriorityUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!pr1 || !profile) return;
    if (!confirm('Are you sure you want to delete this draft? This cannot be undone.')) return;
    
    setDeleting(true);
    try {
      await deleteDraftPR1(pr1.id, profile);
      handleBack({ role: profile.role }); // go back to list
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete draft.';
      setError(message);
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <AppShell title="PR1 Detail">
        <DetailPageSkeleton />
      </AppShell>
    );
  }

  if (error || !pr1) {
    return (
      <AppShell title="PR1 Detail">
        <div className="bg-pq-danger-50 border border-pq-danger-200 rounded-md p-4 text-sm text-pq-danger-900">
          {error || 'PR1 not found.'}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="PR1 Detail">
      {/* Back nav */}
      <DetailBackButton
        className="mb-2"
        onClick={() => handleBack({ role: profile?.role })}
      />

      {/* Page header */}
      <DetailHeaderLayout
        left={
          <div>
            <DetailTitleRow wrap>
              <h1 className="text-xl font-bold text-pq-neutral-900">{pr1.pr1_number}</h1>
              {(() => {
                const chip =
                  (lifecycle?.lifecycle_display_chip ?? STATUS_MAP[pr1.status]) || 'pending';
                const label = lifecycle?.lifecycle_display_label ?? PR1_STATUS_LABELS[pr1.status];
                return <StatusChip status={chip} label={label} />;
              })()}
              {canUpdatePriority ? (
                <PrioritySelector
                  value={pr1.priority}
                  onChange={handlePriorityChange}
                  isUpdating={priorityUpdating}
                />
              ) : (
                <PriorityChip priority={pr1.priority || 'normal'} />
              )}
            </DetailTitleRow>
            <p className="text-sm text-pq-neutral-700 mt-1">
              Created {format(new Date(pr1.created_at), 'MMMM d, yyyy')}
            </p>
            {priorityError && (
              <div className="flex items-start gap-2 mt-2 text-xs text-pq-danger-900 bg-pq-danger-50 border border-pq-danger-200 rounded px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{priorityError}</span>
              </div>
            )}
          </div>
        }
        right={
          <div className="flex items-center gap-2">
            <DetailPrintButton
              href={`/pr1/${pr1.id}/print`}
              label="Print"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-pq-white border border-pq-neutral-200 hover:border-pq-neutral-300 text-pq-neutral-700 text-sm font-medium rounded-md transition"
            />
            {canEdit && (
              <>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-pq-white border border-pq-danger-200 hover:bg-pq-danger-50 text-pq-danger-600 text-sm font-semibold rounded-md transition disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  {deleting ? 'Deleting...' : 'Delete Draft'}
                </button>
                <Link
                  href={`/pr1/${pr1.id}/edit`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-sm font-semibold rounded-md transition"
                >
                  <Pencil className="w-4 h-4" />
                  Edit Draft
                </Link>
              </>
            )}
          </div>
        }
      />

      <div className="space-y-5">
        {/* Header card */}
        <DetailCard overflow>
          <DetailCardHeader
            left={<h2 className="text-xs font-semibold text-pq-neutral-700 uppercase tracking-wide">Request Header</h2>}
            right={<span className="text-xs text-pq-neutral-400">Form No. PR1-v1</span>}
          />
          <DetailInfoGrid>
            <DetailInfoField
              icon={<User className="w-3.5 h-3.5 text-pq-neutral-400" />}
              label="Requisitioner"
              value={pr1.requisitioner_name_snapshot}
            />
            <DetailInfoField
              icon={<Building2 className="w-3.5 h-3.5 text-pq-neutral-400" />}
              label="Department"
              value={pr1.department_name_snapshot}
            />
            <DetailInfoField
              icon={<FileText className="w-3.5 h-3.5 text-pq-neutral-400" />}
              label="PR1 Number"
              value={pr1.pr1_number}
              valueClassName="font-mono font-semibold"
            />
            <DetailInfoField
              icon={<Clock className="w-3.5 h-3.5 text-pq-neutral-400" />}
              label="Date"
              value={format(new Date(pr1.created_at), 'MMMM d, yyyy')}
            />
            <DetailInfoField
              icon={<CalendarDays className="w-3.5 h-3.5 text-pq-neutral-400" />}
              label="Date Required"
              value={format(new Date(pr1.date_required), 'MMMM d, yyyy')}
            />
            <div className="col-span-2 md:col-span-1" />
            <DetailWideInfoRow label="Purpose">{pr1.purpose}</DetailWideInfoRow>
          </DetailInfoGrid>
        </DetailCard>

        {/* Related Records */}
        {profile && (
          <RelatedRecords baseType="PR1" baseId={pr1.id} role={profile.role} currentDocType="PR1" />
        )}

        {/* Items */}
        <DetailTableCard
          title={<h2 className="text-xs font-semibold text-pq-neutral-700 uppercase tracking-wide">Items Requested</h2>}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pq-neutral-200 bg-pq-neutral-50">
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-pq-neutral-700 uppercase tracking-wide w-10">#</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-pq-neutral-700 uppercase tracking-wide w-28">Item Code</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-pq-neutral-700 uppercase tracking-wide">Description</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-pq-neutral-700 uppercase tracking-wide w-24">Unit</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-pq-neutral-700 uppercase tracking-wide w-24">SOH</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-pq-neutral-700 uppercase tracking-wide w-28">Req. Qty</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-pq-neutral-700 uppercase tracking-wide min-w-[160px]">Warehouse route</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pq-neutral-200">
                {pr1.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-center text-xs text-pq-neutral-400 font-mono">{item.item_order}</td>
                    <td className="px-4 py-3 font-mono text-xs text-pq-neutral-700">{item.item_code || '—'}</td>
                    <td className="px-4 py-3 text-pq-neutral-900">{item.description}</td>
                    <td className="px-4 py-3 text-center text-pq-neutral-700">{item.unit_of_measure}</td>
                    <td className="px-4 py-3 text-right text-pq-neutral-700 font-mono">
                      {item.validated_soh !== undefined && item.validated_soh !== null
                        ? `${item.validated_soh.toLocaleString()}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-pq-neutral-900 font-mono">{item.quantity_requested.toLocaleString()}</td>
                    <td className="px-4 py-3 text-left text-xs text-pq-neutral-700">{warehouseRouteCell(item)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DetailTableCard>

        {/* Signature block */}
        <div className="bg-pq-white rounded-md border border-pq-neutral-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-pq-neutral-200">
            <h2 className="text-xs font-semibold text-pq-neutral-700 uppercase tracking-wide">Signatories</h2>
          </div>
          <div className="p-6">
            <PR1SignatoriesUnifiedTimeline pr1={pr1} approvalSignatories={approvalSignatories} />

            {approvalSignatories === null &&
              profile &&
              (profile.role !== 'employee' || profile.id === pr1.requisitioner_id) &&
              (pr1.status === 'pending_warehouse' || pr1.status === 'pending_approval') && (
                <p className="text-xs text-pq-neutral-400 mt-4">
                  Approval workflow not started yet.
                </p>
              )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function warehouseRouteCell(item: PR1Item): string {
  if (item.warehouse_item_route == null) return '—';
  if (item.warehouse_item_route === 'internal') {
    const n = item.warehouse_internal_fulfilled_qty ?? 0;
    return `Internal · ${n.toLocaleString()} from stock`;
  }
  if (item.warehouse_item_route === 'procurement') {
    const n = item.warehouse_procurement_qty ?? 0;
    return `Procurement · ${n.toLocaleString()} to buy`;
  }
  const a = item.warehouse_internal_fulfilled_qty ?? 0;
  const b = item.warehouse_procurement_qty ?? 0;
  return `Partial · ${a.toLocaleString()} internal / ${b.toLocaleString()} procurement`;
}

/**
 * Single continuous timeline for Signatories: Prepared By / Requestor + approval steps
 * (visual parity with components/approvals/WorkflowTimeline).
 */
function PR1SignatoriesUnifiedTimeline({
  pr1,
  approvalSignatories,
}: {
  pr1: PR1WithItems;
  approvalSignatories: PR1ApprovalSignatories | null | undefined;
}) {
  const steps = approvalSignatories?.workflow_steps ?? [];
  const actions = approvalSignatories?.actions ?? [];
  const currentStep = approvalSignatories?.current_step ?? 1;
  const instanceStatus = approvalSignatories?.instance_status ?? 'active';

  const samePerson =
    pr1.prepared_by_id !== null && pr1.prepared_by_id === pr1.requisitioner_id;

  type PrefixRow = {
    key: string;
    title: string;
    name: string | null;
    subtitleLines: string[];
    done: boolean;
    detailLines: { label: string; at: string }[];
  };

  const prefixRows: PrefixRow[] = [];

  if (samePerson) {
    const done = Boolean(pr1.prepared_at && pr1.submitted_at);
    const detailLines: { label: string; at: string }[] = [];
    if (pr1.prepared_at) {
      detailLines.push({
        label: 'Prepared',
        at: format(new Date(pr1.prepared_at), 'MMM d, yyyy h:mm a'),
      });
    }
    if (pr1.submitted_at) {
      detailLines.push({
        label: 'Submitted',
        at: format(new Date(pr1.submitted_at), 'MMM d, yyyy h:mm a'),
      });
    }
    prefixRows.push({
      key: 'prepared-requestor',
      title: 'Prepared By / Requestor',
      name: pr1.requisitioner_name_snapshot ?? pr1.prepared_by_name_snapshot,
      subtitleLines: [pr1.prepared_by_position_snapshot, pr1.department_name_snapshot].filter(
        (s): s is string => Boolean(s?.trim()),
      ),
      done,
      detailLines,
    });
  } else {
    prefixRows.push({
      key: 'prepared',
      title: 'Prepared By',
      name: pr1.prepared_by_name_snapshot,
      subtitleLines: [pr1.prepared_by_position_snapshot].filter(
        (s): s is string => Boolean(s?.trim()),
      ),
      done: Boolean(pr1.prepared_at),
      detailLines: pr1.prepared_at
        ? [{ label: 'Prepared', at: format(new Date(pr1.prepared_at), 'MMM d, yyyy h:mm a') }]
        : [],
    });
    prefixRows.push({
      key: 'requestor',
      title: 'Requestor',
      name: pr1.requisitioner_name_snapshot,
      subtitleLines: [pr1.department_name_snapshot].filter(
        (s): s is string => Boolean(s?.trim()),
      ),
      done: Boolean(pr1.submitted_at),
      detailLines: pr1.submitted_at
        ? [{ label: 'Submitted', at: format(new Date(pr1.submitted_at), 'MMM d, yyyy h:mm a') }]
        : [],
    });
  }

  const totalItems = prefixRows.length + steps.length;

  return (
    <ol className="relative space-y-0">
      {prefixRows.map((row, idx) => {
        const showConnector = idx < totalItems - 1;
        return (
          <li key={row.key} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2 ${
                  row.done
                    ? 'bg-pq-success-50 border-pq-success-200'
                    : 'bg-pq-neutral-50 border-pq-neutral-200'
                }`}
              >
                {row.done ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-pq-neutral-400" />
                )}
              </div>
              {showConnector && (
                <div className="w-0.5 flex-1 my-1 min-h-[24px] bg-pq-neutral-200" />
              )}
            </div>
            <div className="pb-5 flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-sm font-semibold text-pq-neutral-900">{row.title}</span>
              </div>
              {row.done ? (
                <div className="mt-1.5 space-y-0.5">
                  {row.name && (
                    <span className="text-xs text-pq-neutral-700 font-medium">{row.name}</span>
                  )}
                  {row.subtitleLines.map((line, i) => (
                    <p key={`${row.key}-sub-${i}`} className="text-xs text-pq-neutral-700">
                      {line}
                    </p>
                  ))}
                  {row.detailLines.map(d => (
                    <p key={`${d.label}-${d.at}`} className="text-xs text-pq-neutral-400">
                      {d.label} · {d.at}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-xs text-pq-neutral-400">Pending submission</p>
              )}
            </div>
          </li>
        );
      })}

      {steps.map((step, sIdx) => {
        const globalIdx = prefixRows.length + sIdx;
        const showConnector = globalIdx < totalItems - 1;
        const action = actions.find(a => a.step_order === step.step_order);
        const isComplete = !!action;
        const isCurrent =
          !isComplete && step.step_order === currentStep && instanceStatus === 'active';
        const isPending = !isComplete && !isCurrent;

        return (
          <li key={step.step_order} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2 ${
                  isComplete
                    ? action!.action === 'approved'
                      ? 'bg-pq-success-50 border-pq-success-200'
                      : action!.action === 'rejected'
                        ? 'bg-pq-danger-50 border-pq-danger-200'
                        : 'bg-pq-warning-50 border-pq-warning-200'
                    : isCurrent
                      ? 'bg-pq-neutral-50 border-pq-primary-200'
                      : 'bg-pq-neutral-50 border-pq-neutral-200'
                }`}
              >
                {isComplete ? (
                  action!.action === 'approved' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                  ) : action!.action === 'rejected' ? (
                    <XCircle className="w-3.5 h-3.5 text-white" />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5 text-white" />
                  )
                ) : isCurrent ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-pq-primary-600 animate-pulse" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-pq-neutral-400" />
                )}
              </div>
              {showConnector && (
                <div className="w-0.5 flex-1 my-1 min-h-[24px] bg-pq-neutral-200" />
              )}
            </div>

            <div className="pb-5 flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-sm font-semibold text-pq-neutral-900">
                  Step {step.step_order}: {step.position_required}
                </span>
                <span className="text-xs text-pq-neutral-400">{step.action_label}</span>
                {step.is_final && (
                  <span className="text-xs text-pq-neutral-400 italic">· Final</span>
                )}
              </div>

              {isComplete && (
                <div className="mt-1.5 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <ActionPill action={action!.action} />
                    <span className="text-xs text-pq-neutral-700 font-medium">
                      {action!.actor_name_snapshot}
                    </span>
                    <span className="text-xs text-pq-neutral-400">
                      · {format(new Date(action!.acted_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>
                  {action!.remarks && (
                    <p className="text-xs text-pq-neutral-700 italic ml-0.5">
                      <span aria-hidden="true">&quot;</span>
                      {action!.remarks}
                      <span aria-hidden="true">&quot;</span>
                    </p>
                  )}
                </div>
              )}

              {isCurrent && (
                <p className="mt-1 text-xs text-pq-primary-600 font-medium">Awaiting action</p>
              )}

              {isPending && (
                <p className="mt-1 text-xs text-pq-neutral-400">Not yet reached</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function PrioritySelector({
  value,
  onChange,
  isUpdating,
}: {
  value: string;
  onChange: (priority: 'normal' | 'medium' | 'high') => void;
  isUpdating: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange as (val: string) => void} disabled={isUpdating}>
      <SelectTrigger className="w-32 h-8 text-xs font-medium bg-pq-white border-pq-neutral-200 hover:border-pq-neutral-300">
        <SelectValue placeholder="Priority" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="normal">
          <div className="inline-flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-pq-neutral-400" />
            Normal
          </div>
        </SelectItem>
        <SelectItem value="medium">
          <div className="inline-flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-pq-warning-50" />
            Medium
          </div>
        </SelectItem>
        <SelectItem value="high">
          <div className="inline-flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-pq-danger-50" />
            High
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}


