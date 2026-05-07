'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useBackNavigation } from '@/hooks/use-back-navigation';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import RelatedRecords from '@/components/shared/RelatedRecords';
import ApprovalInstanceStatusChip from '@/components/shared/ApprovalInstanceStatusChip';
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
import DetailCard from '@/components/shared/DetailCard';
import DetailCardHeader from '@/components/shared/DetailCardHeader';
import DetailInfoGrid from '@/components/shared/DetailInfoGrid';
import DetailInfoField from '@/components/shared/DetailInfoField';
import DetailWideInfoRow from '@/components/shared/DetailWideInfoRow';
import DetailTableCard from '@/components/shared/DetailTableCard';
import WorkflowTimeline from '@/components/approvals/WorkflowTimeline';

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
    canActOnStep(profile, currentStepDef.position_required)
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
        <div className="flex items-center justify-center h-64">
          <LoadingState message="Loading..." />
        </div>
      </AppShell>
    );
  }

  if (error || !detail) {
    return (
      <AppShell title="PR1 Approval">
        <div className="bg-red-50 border border-red-200 rounded-[4px] p-4 text-sm text-red-700">
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
              <h1 className="text-xl font-bold text-[#0F1F3A]">
                PR1 {detail.pr1_number}
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
            </DetailTitleRow>
            <p className="text-sm text-[#40527A] mt-1">
              Submitted {detail.submitted_at
                ? format(new Date(detail.submitted_at), 'MMMM d, yyyy')
                : '—'}
            </p>
            {priorityError && (
              <div className="flex items-start gap-2 mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{priorityError}</span>
              </div>
            )}
          </div>
        }
        right={
          <>
            {/* Authority indicator */}
            {canAct ? (
              <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold px-3 py-2 rounded-[4px]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Your action required — Step {detail.current_step}: {currentStepDef?.position_required}
              </div>
            ) : !isClosed && profile?.role === 'approver' ? (
              <div className="inline-flex items-center gap-2 bg-[#F7F9FC] border border-[#D8E2FF] text-[#40527A] text-xs font-medium px-3 py-2 rounded-[4px]">
                <Lock className="w-3.5 h-3.5" />
                Awaiting Step {detail.current_step}: {currentStepDef?.position_required}
              </div>
            ) : null}
          </>
        }
      />

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-5">
          {/* PR1 request details */}
          <DetailCard overflow className="order-2 lg:order-none">
            <DetailCardHeader
              left={<h2 className="text-xs font-semibold text-[#40527A] uppercase tracking-wide">Request Details</h2>}
              right={<span className="text-xs text-[#BFC7D5] font-mono">{detail.pr1_number}</span>}
            />
            <DetailInfoGrid>
            <DetailInfoField
              icon={<User className="w-3.5 h-3.5 text-[#BFC7D5]" />}
              label="Requisitioner"
              value={detail.requisitioner_name_snapshot}
            />
            <DetailInfoField
              icon={<Building2 className="w-3.5 h-3.5 text-[#BFC7D5]" />}
              label="Department"
              value={detail.department_name_snapshot}
            />
            <DetailInfoField
              icon={<FileText className="w-3.5 h-3.5 text-[#BFC7D5]" />}
              label="PR1 Number"
              value={detail.pr1_number}
              valueClassName="font-mono font-semibold"
            />
            <DetailInfoField
              icon={<Clock className="w-3.5 h-3.5 text-[#BFC7D5]" />}
              label="Submitted"
              value={detail.submitted_at ? format(new Date(detail.submitted_at), 'MMMM d, yyyy') : '—'}
            />
            <DetailInfoField
              icon={<CalendarDays className="w-3.5 h-3.5 text-[#BFC7D5]" />}
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
            title={<h2 className="text-xs font-semibold text-[#40527A] uppercase tracking-wide">Requested Items</h2>}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#D8E2FF] bg-[#F7F9FC]">
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-[#40527A] uppercase w-8">#</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#40527A] uppercase w-24">Code</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#40527A] uppercase">Description</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-[#40527A] uppercase w-16">Unit</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-[#40527A] uppercase w-24">SOH</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-[#40527A] uppercase w-24">Qty Req.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D8E2FF]">
                  {detail.items.map(item => (
                    <tr key={item.id} className="hover:bg-[#F7F9FC]">
                      <td className="px-4 py-3 text-center text-xs text-[#BFC7D5] font-mono">{item.item_order}</td>
                      <td className="px-4 py-3 font-mono text-xs text-[#40527A]">{item.item_code || '—'}</td>
                      <td className="px-4 py-3 text-[#0F1F3A] font-medium">{item.description}</td>
                      <td className="px-4 py-3 text-center text-[#40527A] text-xs">{item.unit_of_measure}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-[#40527A]">
                        {item.validated_soh !== undefined && item.validated_soh !== null
                          ? `${item.validated_soh.toLocaleString()}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-[#0F1F3A]">{item.quantity_requested.toLocaleString()}</td>
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
          <div className="bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden order-4 lg:order-none">
          <div className="px-6 py-4 border-b border-[#D8E2FF]">
            <div className="flex items-center gap-2">
              <Package className="w-3.5 h-3.5 text-[#BFC7D5]" />
              <h2 className="text-xs font-semibold text-[#40527A] uppercase tracking-wide">Warehouse Validation</h2>
            </div>
          </div>
          <div className="p-6">
            {detail.warehouse_decision ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2.5 py-1">
                    <XCircle className="w-3 h-3" />
                    Stock Insufficient
                  </span>
                  <span className="text-xs text-[#40527A]">
                    Validated by <strong>{detail.warehouse_validator_name}</strong>
                    {detail.warehouse_validated_at
                      ? ` · ${format(new Date(detail.warehouse_validated_at), 'MMM d, yyyy')}`
                      : ''}
                  </span>
                </div>
                {detail.warehouse_notes && (
                  <p className="text-sm text-[#40527A] italic">
                    <span aria-hidden="true">&quot;</span>
                    {detail.warehouse_notes}
                    <span aria-hidden="true">&quot;</span>
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-[#BFC7D5] italic">No warehouse validation data.</p>
            )}
          </div>
        </div>

          {/* Read-only notice for non-acting approvers */}
          {!isClosed && !canAct && profile?.role === 'approver' && (
            <div className="flex items-start gap-3 bg-[#F7F9FC] border border-[#D8E2FF] rounded-[4px] px-5 py-4 order-5 lg:order-none">
              <Lock className="w-4 h-4 text-[#BFC7D5] mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-[#0F1F3A]">Read-only view</p>
                <p className="text-xs text-[#40527A] mt-0.5">
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
            <div className="bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden">
              <div className="px-6 py-4 border-b border-[#D8E2FF]">
                <h2 className="text-xs font-semibold text-[#40527A] uppercase tracking-wide">Approval Timeline</h2>
              </div>
              <div className="p-6 max-h-96 overflow-y-auto">
                <WorkflowTimeline
                  steps={detail.workflow_steps}
                  actions={detail.actions}
                  currentStep={detail.current_step}
                  instanceStatus={detail.instance_status}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action panel — only for the authorized user on the current active step */}
      {!isClosed && canAct && (
        <div className="mt-6 bg-white border-t border-[#D8E2FF]">
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                Your Action — {currentStepDef?.action_label}
              </h2>
              <p className="text-xs text-[#1E4BFF] mt-0.5">
                Acting as: <strong>{profile?.full_name}</strong> · {profile?.position}
              </p>
            </div>
          </div>
          <div className="px-6 py-4 space-y-3">
            {/* Remarks field */}
            <div>
              <label className="block text-xs font-semibold text-[#40527A] uppercase tracking-wide mb-1.5">
                Remarks <span className="text-[#BFC7D5] font-normal normal-case">(required for reject / revision)</span>
              </label>
              <textarea
                rows={2}
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                disabled={submitting}
                placeholder="Enter your remarks, conditions, or reason for rejection..."
                className="w-full px-3 py-2 border border-[#D8E2FF] rounded-[4px] text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition resize-none disabled:opacity-50"
              />
            </div>

            {submitError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-[4px] px-4 py-3">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Confirmation state */}
            {pendingAction ? (
              <div className="flex items-center gap-3 p-3 bg-[#F7F9FC] rounded-[4px] border border-[#D8E2FF]">
                <p className="text-sm text-[#0F1F3A] flex-1">
                  Confirm submitting as{' '}
                  <strong className={
                    pendingAction === 'approved' ? 'text-emerald-700' :
                    pendingAction === 'rejected' ? 'text-red-700' : 'text-orange-700'
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
                  className={`px-4 py-2 text-sm font-semibold text-white rounded-[4px] transition disabled:opacity-50 shrink-0 ${
                    pendingAction === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700' :
                    pendingAction === 'rejected' ? 'bg-red-600 hover:bg-red-700' :
                    'bg-orange-500 hover:bg-orange-600'
                  }`}
                >
                  {submitting ? 'Submitting...' : 'Confirm'}
                </button>
                <button
                  onClick={() => setPendingAction(null)}
                  disabled={submitting}
                  className="px-3 py-2 text-sm text-[#40527A] hover:text-[#0F1F3A] transition"
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
      <div className="bg-emerald-50 border border-emerald-200 rounded-[4px] px-6 py-4 flex items-start gap-3">
        <CheckCheck className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-emerald-800">Fully Approved — For Canvassing</p>
          <p className="text-xs text-emerald-700 mt-0.5">
            All signatories have approved. This PR1 has been forwarded to the procurement team for canvassing.
          </p>
        </div>
      </div>
    );
  }
  if (status === 'rejected') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-[4px] px-6 py-4 flex items-start gap-3">
        <XCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-red-800">Rejected</p>
          <p className="text-xs text-red-700 mt-0.5">
            This PR1 was rejected during the approval process. See the timeline for details.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="bg-orange-50 border border-orange-200 rounded-[4px] px-6 py-4 flex items-start gap-3">
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
    approve: 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600',
    revise:  'bg-white hover:bg-orange-50 text-orange-600 border-orange-300 hover:border-orange-400',
    reject:  'bg-white hover:bg-red-50 text-red-600 border-red-300 hover:border-red-400',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-[4px] border transition disabled:opacity-50 ${styles[variant]}`}
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
      <SelectTrigger className="w-32 h-8 text-xs font-medium bg-white border-[#D8E2FF] hover:border-[#0F1F3A]">
        <SelectValue placeholder="Priority" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="normal">
          <div className="inline-flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gray-400" />
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
