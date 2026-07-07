'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useBackNavigation } from '@/hooks/use-back-navigation';
import AppShell from '@/components/layout/AppShell';
import { DetailPageSkeleton } from '@/components/shared/structural-skeletons';
import RelatedRecords from '@/components/shared/RelatedRecords';
import ApprovalInstanceStatusChip from '@/components/shared/ApprovalInstanceStatusChip';
import RawMaterialBadge from '@/components/shared/RawMaterialBadge';
import { RequestTypeBadge } from '@/components/shared/RequestTypeBadge';
import { useAuth } from '@/context/AuthContext';
import {
  fetchApprovalDetail,
  canActOnStep,
  submitApprovalAction,
} from '@/lib/approvals';
import {
  canUpdatePR1Priority,
  updatePR1Priority,
} from '@/lib/pr1';
import type { PR1ApprovalDetail, ApprovalAction } from '@/types/approvals';
import {
  User,
  Building2,
  FileText,
  CalendarDays,
  Clock,
  CircleCheck as CheckCircle2,
  Circle as XCircle,
  RotateCcw,
  Package,
  TriangleAlert as AlertTriangle,
  CheckCheck,
  Lock,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import PriorityChip from '@/components/shared/PriorityChip';
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
import WorkflowTimeline from '@/components/approvals/WorkflowTimeline';
import { PR1AttachmentsGallery } from '@/components/pr1/PR1AttachmentsSection';

export default function ApprovalDetailPage() {
  const { id: instanceId } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const router = useRouter();
  const { handleBack } = useBackNavigation();

  const [detail, setDetail]       = useState<PR1ApprovalDetail | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [remarks, setRemarks]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [pendingAction, setPendingAction] = useState<ApprovalAction | null>(null);
  const [priorityUpdating, setPriorityUpdating] = useState(false);
  const [priorityError, setPriorityError] = useState('');

  useEffect(() => {
    if (!instanceId) return;
    fetchApprovalDetail(instanceId)
      .then(d => {
        setDetail(d);
        if (!d) setError('Approval record not found.');
      })
      .catch(() => setError('Failed to load approval details.'))
      .finally(() => setLoading(false));
  }, [instanceId]);

  const currentStepDef = detail
    ? detail.workflow_steps.find(s => s.step_order === detail.current_step) ?? null
    : null;

  const canAct = !!(
    profile &&
    detail &&
    detail.instance_status === 'active' &&
    currentStepDef &&
    canActOnStep(profile, currentStepDef.position_required, detail.department_id)
  );

  const canUpdatePriority = detail && profile && canUpdatePR1Priority(profile);

  const handlePriorityChange = useCallback(async (newPriority: 'normal' | 'medium' | 'high') => {
    if (!detail || !profile || newPriority === detail.priority) return;

    setPriorityUpdating(true);
    setPriorityError('');

    try {
      await updatePR1Priority(detail.pr1_id, newPriority, profile);
      setDetail({ ...detail, priority: newPriority });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update priority.';
      setPriorityError(message);
    } finally {
      setPriorityUpdating(false);
    }
  }, [detail, profile]);

  const handleConfirmAction = useCallback(async () => {
    if (!detail || !profile || !pendingAction || !currentStepDef) return;

    if ((pendingAction === 'rejected' || pendingAction === 'revision_requested') && !remarks.trim()) {
      setSubmitError('Remarks are required when rejecting or requesting revision.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    try {
      await submitApprovalAction(
        detail.instance_id,
        detail.pr1_id,
        currentStepDef.step_order,
        currentStepDef.is_final,
        pendingAction,
        remarks,
        profile
      );
      router.push('/approvals/pr1');
    } catch (err: any) {
      setSubmitError(err.message ?? 'Failed to submit action.');
      setSubmitting(false);
    }
  }, [detail, profile, pendingAction, currentStepDef, remarks, router]);

  if (loading) {
    return (
      <AppShell title="PR1 Approval">
        <DetailPageSkeleton />
      </AppShell>
    );
  }

  if (error || !detail) {
    return (
      <AppShell title="PR1 Approval">
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">
          {error || 'Record not found.'}
        </div>
      </AppShell>
    );
  }

  const isClosed = detail.instance_status !== 'active';

  return (
    <AppShell title="PR1 Approval">
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
              <h1 className="text-xl font-bold text-pq-neutral-900">
                {detail.pr1_number}
              </h1>
              <ApprovalInstanceStatusChip status={detail.instance_status} />
              {canUpdatePriority ? (
                <PrioritySelector
                  value={detail.priority}
                  onChange={handlePriorityChange}
                  isUpdating={priorityUpdating}
                />
              ) : (
                <PriorityChip priority={detail.priority} />
              )}
              <RequestTypeBadge type={detail.request_type ?? 'goods'} />
            </DetailTitleRow>
            <p className="text-sm text-pq-neutral-500 mt-1">
              Submitted {detail.submitted_at
                ? format(new Date(detail.submitted_at), 'MMMM d, yyyy')
                : '—'}
            </p>
            {priorityError && (
              <div className="flex items-start gap-2 mt-2 text-xs text-pq-danger-600 bg-pq-danger-100 border border-pq-danger-100 rounded px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{priorityError}</span>
              </div>
            )}
          </div>
        }
        right={
          <div className="flex items-center gap-2">
            <DetailPrintButton
              href={`/pr1/${detail.pr1_id}/print`}
              label="Print"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-pq-white border border-pq-neutral-200 hover:border-pq-neutral-300 text-pq-neutral-700 text-sm font-medium rounded-md transition"
            />
            {/* Authority indicator */}
            {canAct ? (
              <div className="inline-flex items-center gap-2 bg-pq-warning-100 border border-pq-warning-100 text-pq-warning-600 text-xs font-semibold px-3 py-2 rounded-md">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Your action required — Step {detail.current_step}: {currentStepDef?.position_required}
              </div>
            ) : !isClosed && profile?.role === 'approver' ? (
              <div className="inline-flex items-center gap-2 bg-pq-neutral-50 border border-pq-neutral-200 text-pq-neutral-500 text-xs font-medium px-3 py-2 rounded-md">
                <Lock className="w-3.5 h-3.5" />
                Awaiting Step {detail.current_step}: {currentStepDef?.position_required}
              </div>
            ) : null}
          </div>
        }
      />

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-5">
          {/* PR1 request details */}
          <DetailCard overflow className="order-2 lg:order-none">
            <DetailCardHeader
              left={<h2 className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Request Details</h2>}
              right={<span className="text-xs text-pq-neutral-400 font-mono">{detail.pr1_number}</span>}
            />
            <DetailInfoGrid>
            <DetailInfoField
              icon={<User className="w-3.5 h-3.5 text-pq-neutral-400" />}
              label="Requisitioner"
              value={detail.requisitioner_name_snapshot}
            />
            <DetailInfoField
              icon={<Building2 className="w-3.5 h-3.5 text-pq-neutral-400" />}
              label="Department"
              value={detail.department_name_snapshot}
            />
            <DetailInfoField
              icon={<FileText className="w-3.5 h-3.5 text-pq-neutral-400" />}
              label="PR1 Number"
              value={detail.pr1_number}
              valueClassName="font-mono font-semibold"
            />
            <DetailInfoField
              icon={<Clock className="w-3.5 h-3.5 text-pq-neutral-400" />}
              label="Submitted"
              value={detail.submitted_at ? format(new Date(detail.submitted_at), 'MMMM d, yyyy') : '—'}
            />
            <DetailInfoField
              icon={<CalendarDays className="w-3.5 h-3.5 text-pq-neutral-400" />}
              label="Date Required"
              value={format(new Date(detail.date_required), 'MMMM d, yyyy')}
            />
            <div />
            <DetailWideInfoRow label="Purpose">{detail.purpose}</DetailWideInfoRow>
            </DetailInfoGrid>
          </DetailCard>

          {/* Items */}
          <DetailTableCard
            className="order-3 lg:order-none"
            title={<h2 className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Requested Items</h2>}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-pq-neutral-200 bg-pq-neutral-50">
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-8">#</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-24">Code</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase">Description</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-20">Type</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-16">Unit</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-24">SOH</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-24">Qty Req.</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-32">Attachments</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pq-neutral-200">
                  {detail.items.map(item => (
                    <tr key={item.id} className="hover:bg-pq-neutral-50">
                      <td className="px-4 py-3 text-center text-xs text-pq-neutral-400 font-mono">{item.item_order}</td>
                      <td className="px-4 py-3 font-mono text-xs text-pq-neutral-500">{item.item_code || '—'}</td>
                      <td className="px-4 py-3 text-pq-neutral-900 font-medium">{item.description}</td>
                      <td className="px-4 py-3 text-center">
                        {detail.request_type === 'services' ? (
                          <span className="text-xs text-pq-neutral-300">—</span>
                        ) : item.is_raw_material ? (
                          <RawMaterialBadge isRawMaterial size="sm" />
                        ) : (
                          <span className="text-xs text-pq-neutral-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-pq-neutral-500 text-xs">{item.unit_of_measure}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-pq-neutral-500">
                        {detail.request_type === 'services' ? (
                          <span className="italic text-pq-neutral-400">N/A</span>
                        ) : item.validated_soh !== undefined && item.validated_soh !== null ? (
                          item.validated_soh.toLocaleString()
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-pq-neutral-900">{item.quantity_requested.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        {(item.attachments?.length ?? 0) > 0 ? (
                          <PR1AttachmentsGallery attachments={item.attachments!} />
                        ) : (
                          <span className="text-xs text-pq-neutral-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DetailTableCard>

          {/* Related Records */}
          {profile && (
            <div className="order-4 lg:order-none">
              <RelatedRecords baseType="PR1" baseId={detail.pr1_id} role={profile.role} currentDocType="PR1" compact />
            </div>
          )}

          {/* Warehouse validation context */}
          <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden order-4 lg:order-none">
          <div className="px-6 py-4 border-b border-pq-neutral-200">
            <div className="flex items-center gap-2">
              <Package className="w-3.5 h-3.5 text-pq-neutral-400" />
              <h2 className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Warehouse Validation</h2>
            </div>
          </div>
          <div className="p-6">
            {detail.warehouse_decision ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-pq-primary-700 bg-pq-primary-50 border border-pq-primary-200 rounded-full px-2.5 py-1">
                    <XCircle className="w-3 h-3" />
                    Stock Insufficient
                  </span>
                  <span className="text-xs text-pq-neutral-500">
                    Validated by <strong>{detail.warehouse_validator_name}</strong>
                    {detail.warehouse_validated_at
                      ? ` · ${format(new Date(detail.warehouse_validated_at), 'MMM d, yyyy')}`
                      : ''}
                  </span>
                </div>
                {detail.warehouse_notes && (
                  <p className="text-sm text-pq-neutral-500 italic">
                    <span aria-hidden="true">&quot;</span>
                    {detail.warehouse_notes}
                    <span aria-hidden="true">&quot;</span>
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-pq-neutral-400 italic">No warehouse validation data.</p>
            )}
          </div>
        </div>

          {/* Read-only notice for non-acting approvers */}
          {!isClosed && !canAct && profile?.role === 'approver' && (
            <div className="flex items-start gap-3 bg-pq-neutral-50 border border-pq-neutral-200 rounded-md px-5 py-4 order-5 lg:order-none">
              <Lock className="w-4 h-4 text-pq-neutral-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-pq-neutral-900">Read-only view</p>
                <p className="text-xs text-pq-neutral-500 mt-0.5">
                  Step {detail.current_step} ({currentStepDef?.position_required}) must be completed before you can act.
                </p>
              </div>
            </div>
          )}

          {/* Closed notice */}
          {isClosed && (
            <ClosedBanner status={detail.instance_status} pr1Status={detail.pr1_status} />
          )}
        </div>

        {/* Right column: Approval Timeline */}
        <div className="lg:col-span-1 order-1 lg:order-none">
          <div className="lg:sticky lg:top-20">
            <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-pq-neutral-200">
                <h2 className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Approval Timeline</h2>
              </div>
              <div className="p-6 max-h-96 overflow-y-auto">
                <WorkflowTimeline
                  steps={detail.workflow_steps}
                  actions={detail.actions}
                  currentStep={detail.current_step}
                  instanceStatus={detail.instance_status}
                  warehouseDecision={detail.warehouse_decision}
                  warehouseValidatorName={detail.warehouse_validator_name}
                  warehouseValidatorPosition={detail.warehouse_validator_position}
                  warehouseValidatedAt={detail.warehouse_validated_at}
                  warehouseNotes={detail.warehouse_notes}
                  pr1Status={detail.pr1_status}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action panel — only for the authorized user on the current active step */}
      {!isClosed && canAct && (
        <div className="mt-6 bg-white border-t border-pq-neutral-200">
          <div className="px-6 py-3 bg-pq-warning-100 border-b border-amber-100 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-semibold text-pq-warning-600 uppercase tracking-wide">
                Your Action — {currentStepDef?.action_label}
              </h2>
              <p className="text-xs text-pq-primary-600 mt-0.5">
                Acting as: <strong>{profile?.full_name}</strong> · {profile?.position}
              </p>
            </div>
          </div>
          <div className="px-6 py-4 space-y-3">
            {/* Remarks field */}
            <div>
              <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
                Remarks <span className="text-pq-neutral-400 font-normal normal-case">(required for reject / revision)</span>
              </label>
              <textarea
                rows={2}
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                disabled={submitting}
                placeholder="Enter your remarks, conditions, or reason for rejection..."
                className="w-full px-3 py-2 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition resize-none disabled:opacity-50"
              />
            </div>

            {submitError && (
              <div className="flex items-start gap-2 bg-pq-danger-100 border border-pq-danger-100 text-pq-danger-600 text-sm rounded-md px-4 py-3">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Confirmation state */}
            {pendingAction ? (
              <div className="flex items-center gap-3 p-3 bg-pq-neutral-50 rounded-md border border-pq-neutral-200">
                <p className="text-sm text-pq-neutral-900 flex-1">
                  Confirm submitting as{' '}
                  <strong className={
                    pendingAction === 'approved' ? 'text-pq-success-600' :
                    pendingAction === 'rejected' ? 'text-pq-danger-600' : 'text-orange-700'
                  }>
                    {pendingAction === 'approved'
                      ? currentStepDef?.is_final ? 'Final Approval' : 'Approved — Advance to Next Step'
                      : pendingAction === 'rejected' ? 'Rejected'
                      : 'Request Revision'}
                  </strong>?
                  {' '}This cannot be undone.
                </p>
                <button
                  onClick={handleConfirmAction}
                  disabled={submitting}
                  className={`px-4 py-2 text-sm font-semibold text-white rounded-md transition disabled:opacity-50 shrink-0 ${
                    pendingAction === 'approved' ? 'bg-pq-success-600 hover:bg-pq-success-600' :
                    pendingAction === 'rejected' ? 'bg-pq-danger-600 hover:bg-pq-danger-600' :
                    'bg-orange-500 hover:bg-orange-600'
                  }`}
                >
                  {submitting ? 'Submitting...' : 'Confirm'}
                </button>
                <button
                  onClick={() => setPendingAction(null)}
                  disabled={submitting}
                  className="px-3 py-2 text-sm text-pq-neutral-500 hover:text-pq-neutral-900 transition"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 flex-wrap">
                <ActionButton
                  icon={CheckCheck}
                  label={currentStepDef?.is_final ? 'Approve — Final' : 'Approve & Advance'}
                  variant="approve"
                  onClick={() => { setSubmitError(''); setPendingAction('approved'); }}
                  disabled={submitting}
                />
                <ActionButton
                  icon={RotateCcw}
                  label="Request Revision"
                  variant="revise"
                  onClick={() => { setSubmitError(''); setPendingAction('revision_requested'); }}
                  disabled={submitting}
                />
                <ActionButton
                  icon={XCircle}
                  label="Reject"
                  variant="reject"
                  onClick={() => { setSubmitError(''); setPendingAction('rejected'); }}
                  disabled={submitting}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}

// ─── Small presentational components ─────────────────────────────────────────

function ClosedBanner({ status, pr1Status }: { status: string; pr1Status: string }) {
  if (status === 'approved') {
    return (
      <div className="bg-pq-success-100 border border-pq-success-100 rounded-md px-6 py-4 flex items-start gap-3">
        <CheckCheck className="w-5 h-5 text-pq-success-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-pq-success-600">Fully Approved — For Canvassing</p>
          <p className="text-xs text-pq-success-600 mt-0.5">
            All signatories have approved. This PR1 has been forwarded to the procurement team for canvassing.
          </p>
        </div>
      </div>
    );
  }
  if (status === 'rejected') {
    return (
      <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md px-6 py-4 flex items-start gap-3">
        <XCircle className="w-5 h-5 text-pq-danger-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-pq-danger-600">Rejected</p>
          <p className="text-xs text-pq-danger-600 mt-0.5">
            This PR1 was rejected during the approval process. See the timeline for details.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="bg-orange-50 border border-orange-200 rounded-md px-6 py-4 flex items-start gap-3">
      <RotateCcw className="w-5 h-5 text-orange-600 mt-0.5 shrink-0" />
      <div>
        <p className="text-sm font-semibold text-orange-800">Revision Requested</p>
        <p className="text-xs text-orange-700 mt-0.5">
          An approver has requested changes. The requisitioner must revise and resubmit.
        </p>
      </div>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  variant,
  onClick,
  disabled,
}: {
  icon: React.ElementType;
  label: string;
  variant: 'approve' | 'revise' | 'reject';
  onClick: () => void;
  disabled: boolean;
}) {
  const styles = {
    approve: 'bg-pq-success-600 hover:bg-pq-success-600 text-white border-pq-success-600',
    revise:  'bg-white hover:bg-orange-50 text-orange-600 border-orange-300 hover:border-orange-400',
    reject:  'bg-white hover:bg-pq-danger-100 text-pq-danger-600 border-red-300 hover:border-red-400',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-md border transition disabled:opacity-50 ${styles[variant]}`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
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
      <SelectTrigger className="w-32 h-8 text-xs font-medium bg-white border-pq-neutral-200 hover:border-pq-primary-600">
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
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            Medium
          </div>
        </SelectItem>
        <SelectItem value="high">
          <div className="inline-flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            High
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
