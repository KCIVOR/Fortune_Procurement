'use client';

import { useCallback, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  CheckCheck,
  TriangleAlert as AlertTriangle,
  Lock,
} from 'lucide-react';
import type { UserProfile } from '@/types/auth';
import type { ApprovalAction } from '@/types/approvals';
import {
  canActOnRfqStep,
  submitRfqApprovalAction,
  type RfqApprovalDetail,
} from '@/lib/rfq-approvals';
import ApprovalPhaseTimeline from '@/components/approvals/ApprovalPhaseTimeline';
import {
  APPROVAL_ACTION_ROW_CLASS,
  ApprovalActionButton,
} from '@/components/approvals/ApprovalActionButtons';

interface RfqApprovalPanelProps {
  detail: RfqApprovalDetail;
  profile: UserProfile;
  instanceId: string;
  onCompleted?: () => void;
  /** Anchor id for scroll-into-view from action banners. */
  sectionId?: string;
}

export default function RfqApprovalPanel({
  detail,
  profile,
  instanceId,
  onCompleted,
  sectionId = 'rfq-approval-panel',
}: RfqApprovalPanelProps) {
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [pendingAction, setPendingAction] = useState<ApprovalAction | null>(null);

  const currentStepDef = detail.steps.find(s => s.step_order === detail.current_step) ?? null;
  const isClosed = detail.instance_status !== 'active';

  const canAct = !!(
    !isClosed &&
    currentStepDef &&
    canActOnRfqStep(
      profile,
      currentStepDef.role_required,
      currentStepDef.position_required,
      detail.department_id,
    )
  );

  const handleConfirmAction = useCallback(async () => {
    if (!pendingAction || !currentStepDef) return;
    if ((pendingAction === 'rejected' || pendingAction === 'revision_requested') && !remarks.trim()) {
      setSubmitError('Remarks are required when rejecting or requesting revision.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      await submitRfqApprovalAction(
        instanceId,
        detail.rfq_id,
        currentStepDef.step_order,
        currentStepDef.is_final,
        pendingAction,
        remarks,
        profile,
      );
      setPendingAction(null);
      onCompleted?.();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit action.');
    } finally {
      setSubmitting(false);
    }
  }, [pendingAction, currentStepDef, remarks, instanceId, detail.rfq_id, profile, onCompleted]);

  return (
    <div id={sectionId} className="space-y-4">
      <ApprovalPhaseTimeline
        phaseLabel="Approval"
        phaseSubLabel={`Canvassing sign-off for ${detail.rfq_number}`}
        steps={detail.steps}
        actions={detail.actions}
        currentStep={detail.current_step}
        instanceStatus={detail.instance_status}
        preparer={detail.preparer}
      />

      {!isClosed && canAct && (
        <div className="bg-white rounded-md border border-pq-warning-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-amber-100 bg-pq-warning-100">
            <h2 className="text-xs font-semibold text-pq-warning-600 uppercase tracking-wide">
              Your Action — {currentStepDef?.action_label}
            </h2>
            <p className="text-xs text-pq-warning-600 mt-0.5">
              Acting as: <strong>{profile.full_name}</strong> · {profile.position}
              {' '}·{' '}Approval
            </p>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
                Remarks{' '}
                <span className="text-pq-neutral-400 font-normal normal-case">
                  (required for reject / revision)
                </span>
              </label>
              <textarea
                rows={3}
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                disabled={submitting}
                placeholder="Enter your remarks, conditions, or reason for rejection..."
                className="w-full px-3 py-2.5 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition resize-none disabled:opacity-50"
              />
            </div>

            {submitError && (
              <div className="flex items-start gap-2 bg-pq-danger-100 border border-pq-danger-100 text-pq-danger-600 text-sm rounded-md px-4 py-3">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {pendingAction ? (
              <div className="flex items-center gap-3 p-4 bg-pq-neutral-50 rounded-md border border-pq-neutral-200">
                <p className="text-sm text-pq-neutral-900 flex-1">
                  Confirm submitting as{' '}
                  <strong
                    className={
                      pendingAction === 'approved'
                        ? 'text-pq-success-600'
                        : pendingAction === 'rejected'
                          ? 'text-pq-danger-600'
                          : 'text-orange-700'
                    }
                  >
                    {pendingAction === 'approved'
                      ? currentStepDef?.is_final
                        ? 'Final Approval — RFQ Fully Approved'
                        : 'Approved — Advance to Next Step'
                      : pendingAction === 'rejected'
                        ? 'Rejected — RFQ returned for revision'
                        : 'Request Revision — RFQ reopened for canvassing'}
                  </strong>
                  ? This cannot be undone.
                </p>
                <button
                  onClick={handleConfirmAction}
                  disabled={submitting}
                  className={`px-4 py-2 text-sm font-semibold text-white rounded-md transition disabled:opacity-50 shrink-0 ${
                    pendingAction === 'approved'
                      ? 'bg-pq-success-600 hover:bg-pq-success-600'
                      : pendingAction === 'rejected'
                        ? 'bg-pq-danger-600 hover:bg-pq-danger-600'
                        : 'bg-orange-500 hover:bg-orange-600'
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
              <div className={APPROVAL_ACTION_ROW_CLASS}>
                <ApprovalActionButton
                  icon={CheckCheck}
                  label={currentStepDef?.is_final ? 'Approve — Final' : 'Approve & Advance'}
                  variant="approve"
                  onClick={() => {
                    setSubmitError('');
                    setPendingAction('approved');
                  }}
                  disabled={submitting}
                />
                <ApprovalActionButton
                  icon={RotateCcw}
                  label="Request Revision"
                  variant="revise"
                  onClick={() => {
                    setSubmitError('');
                    setPendingAction('revision_requested');
                  }}
                  disabled={submitting}
                />
                <ApprovalActionButton
                  icon={XCircle}
                  label="Reject"
                  variant="reject"
                  onClick={() => {
                    setSubmitError('');
                    setPendingAction('rejected');
                  }}
                  disabled={submitting}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {!isClosed && !canAct && (profile.role === 'approver' || profile.role === 'procurement') && (
        <div className="flex items-start gap-3 bg-pq-neutral-50 border border-pq-neutral-200 rounded-md px-5 py-4">
          <Lock className="w-4 h-4 text-pq-neutral-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-pq-neutral-900">Read-only view</p>
            <p className="text-xs text-pq-neutral-500 mt-0.5">
              Step {detail.current_step} ({currentStepDef?.position_required}) must be completed before you can act.
            </p>
          </div>
        </div>
      )}

      {detail.instance_status === 'approved' && (
        <div className="bg-pq-success-100 border border-pq-success-100 rounded-md px-6 py-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-pq-success-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-pq-success-600">RFQ canvassing approval is complete</p>
            <p className="text-xs text-pq-success-600 mt-0.5">Procurement may create the Purchase Order.</p>
          </div>
        </div>
      )}

      {detail.instance_status === 'rejected' && (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md px-6 py-4 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-pq-danger-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-pq-danger-600">RFQ approval rejected</p>
            <p className="text-xs text-pq-danger-600 mt-0.5">Canvassing must be revised before resubmitting.</p>
          </div>
        </div>
      )}
    </div>
  );
}
