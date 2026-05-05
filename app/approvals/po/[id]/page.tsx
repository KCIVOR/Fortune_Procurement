'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useBackNavigation } from '@/hooks/use-back-navigation';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import RelatedRecords from '@/components/shared/RelatedRecords';
import { useAuth } from '@/context/AuthContext';
import {
  fetchPOApprovalDetail,
  canActOnPOStep,
  submitPOApprovalAction,
} from '@/lib/po-approvals';
import type { POApprovalDetail, POApprovalStep, POApprovalAction } from '@/types/po';
import type { ApprovalAction } from '@/types/approvals';
import { format } from 'date-fns';
import { getPriorityColors } from '@/lib/utils';
import {
  ChevronLeft, User, Building2, FileText, CalendarDays, Clock,
  CircleCheck as CheckCircle2, Circle as XCircle, RotateCcw,
  Package, TriangleAlert as AlertTriangle, CheckCheck, Lock,
  ClipboardList, ShoppingCart, Truck, CreditCard, MapPin,
} from 'lucide-react';

export default function POApprovalDetailPage() {
  const { id: instanceId } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const router = useRouter();
  const { handleBack } = useBackNavigation();

  const [detail, setDetail]               = useState<POApprovalDetail | null>(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');
  const [remarks, setRemarks]             = useState('');
  const [submitting, setSubmitting]       = useState(false);
  const [submitError, setSubmitError]     = useState('');
  const [pendingAction, setPendingAction] = useState<ApprovalAction | null>(null);

  useEffect(() => {
    if (!instanceId) return;
    fetchPOApprovalDetail(instanceId)
      .then(d => {
        setDetail(d);
        if (!d) setError('Approval record not found.');
      })
      .catch(() => setError('Failed to load approval details.'))
      .finally(() => setLoading(false));
  }, [instanceId]);

  const currentStepDef = detail
    ? detail.steps.find(s => s.step_order === detail.current_step) ?? null
    : null;

  const isInternalStep = currentStepDef
    ? currentStepDef.step_order <= 3
    : false;

  const canAct = !!(
    profile &&
    detail &&
    detail.instance_status === 'active' &&
    isInternalStep &&
    currentStepDef &&
    canActOnPOStep(profile, currentStepDef.role_required, currentStepDef.position_required)
  );

  const handleConfirmAction = useCallback(async () => {
    if (!detail || !profile || !pendingAction || !currentStepDef) return;

    if ((pendingAction === 'rejected' || pendingAction === 'revision_requested') && !remarks.trim()) {
      setSubmitError('Remarks are required when rejecting or requesting revision.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    try {
      await submitPOApprovalAction(
        instanceId,
        detail.po_id,
        currentStepDef.step_order,
        currentStepDef.is_final,
        pendingAction,
        remarks,
        profile
      );
      router.push('/approvals/po');
    } catch (err: any) {
      setSubmitError(err.message ?? 'Failed to submit action.');
      setSubmitting(false);
    }
  }, [detail, profile, pendingAction, currentStepDef, remarks, router, instanceId]);

  if (loading) return (
    <AppShell title="PO Approval">
      <div className="flex items-center justify-center h-64">
        <LoadingState message="Loading..." />
      </div>
    </AppShell>
  );

  if (error || !detail) return (
    <AppShell title="PO Approval">
      <div className="bg-red-50 border border-red-200 rounded-[4px] p-4 text-sm text-red-700">
        {error || 'Record not found.'}
      </div>
    </AppShell>
  );

  const isClosed = detail.instance_status !== 'active';
  const grandTotal = detail.items.reduce((sum, i) => sum + i.unit_price * i.quantity_to_purchase, 0);

  // Internal steps only (steps 1-3); step 4 is supplier
  const internalSteps = detail.steps.filter(s => s.step_order <= 3);
  const internalActions = detail.actions.filter(a => a.step_order <= 3);
  const supplierAction = detail.actions.find(a => a.step_order === 4);

  return (
    <AppShell title="PO Approval">
      <div className="mb-2">
        <button onClick={() => handleBack({ role: profile?.role })} className="inline-flex items-center gap-1 text-xs text-[#40527A] hover:text-[#0F1F3A] transition">
          <ChevronLeft className="w-3.5 h-3.5" />
          Back
        </button>
      </div>

      {/* Page header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-[#0F1F3A] font-mono">{detail.po_number}</h1>
            <POStatusBadge status={detail.po_status} />
            <PriorityBadge priority={detail.pr1_priority} />
          </div>
          <p className="text-sm text-[#40527A] mt-1">
            {detail.department_name_snapshot} · {detail.purpose}
          </p>
          <p className="text-xs text-[#BFC7D5] mt-0.5">
            PR2: <span className="font-mono">{detail.pr2_number_snapshot}</span>
            {' '}· PR1: <span className="font-mono">{detail.pr1_number_snapshot}</span>
            {' '}· RFQ: <span className="font-mono">{detail.rfq_number_snapshot}</span>
          </p>
        </div>

        {canAct ? (
          <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold px-3 py-2 rounded-[4px]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Your action required — Step {detail.current_step}: {currentStepDef?.position_required}
          </div>
        ) : !isClosed ? (
          <div className="inline-flex items-center gap-2 bg-[#F7F9FC] border border-[#D8E2FF] text-[#40527A] text-xs font-medium px-3 py-2 rounded-[4px]">
            <Lock className="w-3.5 h-3.5" />
            Awaiting Step {detail.current_step}: {currentStepDef?.position_required}
          </div>
        ) : null}
      </div>

      <div className="space-y-5">

        {/* PO header details */}
        <div className="bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#D8E2FF] bg-[#F7F9FC] flex items-center justify-between">
            <h2 className="text-xs font-semibold text-[#40527A] uppercase tracking-wide">Purchase Order Details</h2>
            <Link href={`/po/${detail.po_id}`} className="text-xs text-blue-600 hover:text-blue-800 font-medium transition">
              View Full PO
            </Link>
          </div>
          <div className="p-6 grid grid-cols-2 md:grid-cols-3 gap-5">
            <InfoField icon={User}         label="Requisitioner" value={detail.requisitioner_name_snapshot} />
            <InfoField icon={Building2}    label="Department"    value={detail.department_name_snapshot} />
            <InfoField icon={Package}      label="Supplier"      value={detail.supplier_name_snapshot} />
            <InfoField icon={CalendarDays} label="PO Date"       value={format(new Date(detail.po_date), 'MMMM d, yyyy')} />
            <InfoField icon={CalendarDays} label="Date Required" value={format(new Date(detail.date_required), 'MMMM d, yyyy')} />
            <InfoField icon={Truck}        label="Warehouse"     value={detail.warehouse} />
            <InfoField icon={MapPin}       label="Delivery Address" value={detail.delivery_address} />
            <InfoField icon={CreditCard}   label="Payment Terms" value={detail.payment_terms} />
            <InfoField icon={FileText}     label="Packing"       value={detail.packing} />
            <div className="col-span-2 md:col-span-3">
              <p className="text-xs font-semibold text-[#40527A] uppercase tracking-wide mb-1">Purpose</p>
              <p className="text-sm text-[#0F1F3A]">{detail.purpose}</p>
            </div>
            {detail.remarks && (
              <div className="col-span-2 md:col-span-3">
                <p className="text-xs font-semibold text-[#40527A] uppercase tracking-wide mb-1">Remarks</p>
                <p className="text-sm text-[#0F1F3A] italic">"{detail.remarks}"</p>
              </div>
            )}
          </div>
        </div>

        {/* Related Records */}
        {profile && (
          <RelatedRecords baseType="PO" baseId={detail.po_id} role={profile.role} currentDocType="PO" compact />
        )}

        {/* Items */}
        <div className="bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#D8E2FF] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-3.5 h-3.5 text-[#BFC7D5]" />
              <h2 className="text-xs font-semibold text-[#40527A] uppercase tracking-wide">Items ({detail.items.length})</h2>
            </div>
            <div className="text-xs font-semibold text-[#0F1F3A]">
              Grand Total: ₱{grandTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#D8E2FF] bg-[#F7F9FC]">
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-[#40527A] uppercase w-8">#</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#40527A] uppercase w-20">Code</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#40527A] uppercase">Description</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-[#40527A] uppercase w-16">Unit</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-[#40527A] uppercase w-20">Qty</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-[#40527A] uppercase w-28">Unit Price</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-[#40527A] uppercase w-28">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8E2FF]">
                {detail.items.map(item => (
                  <tr key={item.id} className="hover:bg-[#F7F9FC]">
                    <td className="px-4 py-3 text-center text-xs text-[#BFC7D5] font-mono">{item.item_order}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[#40527A]">{item.item_code || '—'}</td>
                    <td className="px-4 py-3 text-[#0F1F3A] font-medium">{item.description}</td>
                    <td className="px-4 py-3 text-center text-[#40527A] text-xs">{item.unit_of_measure}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-[#0F1F3A]">{item.quantity_to_purchase}</td>
                    <td className="px-4 py-3 text-right text-xs text-[#40527A]">₱{item.unit_price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-[#0F1F3A]">₱{(item.unit_price * item.quantity_to_purchase).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#F7F9FC] border-t-2 border-[#D8E2FF]">
                  <td colSpan={6} className="px-4 py-3 text-right text-xs font-semibold text-[#0F1F3A]">Grand Total</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-[#0F1F3A]">
                    ₱{grandTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Approval timeline */}
        <div className="bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#D8E2FF]">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-3.5 h-3.5 text-[#BFC7D5]" />
              <div>
                <h2 className="text-xs font-semibold text-[#0F1F3A] uppercase tracking-wide">Internal Approval Chain</h2>
                <p className="text-xs text-[#BFC7D5] mt-0.5">Buyer · Procurement Manager · Finance Director</p>
              </div>
              {detail.instance_status === 'approved' && (
                <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
                  <CheckCircle2 className="w-3 h-3" /> Complete
                </span>
              )}
              {detail.instance_status === 'active' && (
                <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-[#0F1F3A] bg-[#F7F9FC] border border-[#D8E2FF] rounded-[4px] px-2.5 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1E4BFF] animate-pulse" />
                  In Progress
                </span>
              )}
            </div>
          </div>
          <div className="p-6">
            <ApprovalTimeline
              steps={internalSteps}
              actions={internalActions}
              currentStep={detail.current_step}
              instanceStatus={detail.instance_status}
            />
          </div>
        </div>

        {/* Supplier acknowledgment status */}
        {(detail.instance_status === 'approved' || detail.receipt) && (
          <div className="bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#D8E2FF]">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-3.5 h-3.5 text-[#BFC7D5]" />
                <h2 className="text-xs font-semibold text-[#0F1F3A] uppercase tracking-wide">Supplier Acknowledgment</h2>
                {detail.receipt ? (
                  <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
                    <CheckCircle2 className="w-3 h-3" /> Acknowledged
                  </span>
                ) : (
                  <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-[#BFC7D5] bg-[#F7F9FC] border border-[#D8E2FF] rounded-full px-2.5 py-1">
                    <Clock className="w-3 h-3" /> Awaiting Supplier
                  </span>
                )}
              </div>
            </div>
            <div className="p-6">
              {detail.receipt ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                  <InfoField icon={User}         label="Acknowledged By"    value={detail.receipt.acknowledged_by_name} />
                  <InfoField icon={Clock}        label="Acknowledged At"    value={format(new Date(detail.receipt.acknowledged_at), 'MMM d, yyyy h:mm a')} />
                  {detail.receipt.commitment_date && (
                    <InfoField icon={CalendarDays} label="Commitment Date"  value={format(new Date(detail.receipt.commitment_date), 'MMMM d, yyyy')} />
                  )}
                  {detail.receipt.delivery_remarks && (
                    <div className="col-span-2 md:col-span-3">
                      <p className="text-xs font-semibold text-[#40527A] uppercase tracking-wide mb-1">Delivery Remarks</p>
                      <p className="text-sm text-[#0F1F3A] italic">"{detail.receipt.delivery_remarks}"</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-[#BFC7D5] italic">
                  The PO has been approved internally. Awaiting supplier acknowledgment.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Action panel */}
        {!isClosed && canAct && (
          <div className="bg-white rounded-[4px] border border-amber-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-amber-100 bg-amber-50">
              <h2 className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                Your Action — {currentStepDef?.action_label}
              </h2>
              <p className="text-xs text-amber-600 mt-0.5">
                Acting as: <strong>{profile?.full_name}</strong> · {profile?.position}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#40527A] uppercase tracking-wide mb-1.5">
                  Remarks <span className="text-[#BFC7D5] font-normal normal-case">(required for reject / revision)</span>
                </label>
                <textarea
                  rows={3}
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  disabled={submitting}
                  placeholder="Enter your remarks, conditions, or reason for rejection..."
                  className="w-full px-3 py-2.5 border border-[#D8E2FF] rounded-[4px] text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition resize-none disabled:opacity-50"
                />
              </div>

              {submitError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-[4px] px-4 py-3">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {pendingAction ? (
                <div className="flex items-center gap-3 p-4 bg-[#F7F9FC] rounded-[4px] border border-[#D8E2FF]">
                  <p className="text-sm text-[#0F1F3A] flex-1">
                    Confirm submitting as{' '}
                    <strong className={
                      pendingAction === 'approved'            ? 'text-emerald-700' :
                      pendingAction === 'rejected'            ? 'text-red-700'     : 'text-orange-700'
                    }>
                      {pendingAction === 'approved'
                        ? currentStepDef?.is_final
                          ? 'Approved — PO fully approved internally'
                          : 'Approved — Advance to next step'
                        : pendingAction === 'rejected'
                        ? 'Rejected — PO returned to draft'
                        : 'Request Revision — PO returned to draft'}
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
                  <ActionButton icon={CheckCheck} label={currentStepDef?.is_final ? 'Approve — Final' : 'Approve & Advance'} variant="approve"
                    onClick={() => { setSubmitError(''); setPendingAction('approved'); }} disabled={submitting} />
                  <ActionButton icon={RotateCcw} label="Request Revision" variant="revise"
                    onClick={() => { setSubmitError(''); setPendingAction('revision_requested'); }} disabled={submitting} />
                  <ActionButton icon={XCircle} label="Reject" variant="reject"
                    onClick={() => { setSubmitError(''); setPendingAction('rejected'); }} disabled={submitting} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Read-only notice */}
        {!isClosed && !canAct && (
          <div className="flex items-start gap-3 bg-[#F7F9FC] border border-[#D8E2FF] rounded-[4px] px-5 py-4">
            <Lock className="w-4 h-4 text-[#BFC7D5] mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-[#0F1F3A]">Read-only view</p>
              <p className="text-xs text-[#40527A] mt-0.5">
                Step {detail.current_step} ({currentStepDef?.position_required}) must be completed before you can act.
              </p>
            </div>
          </div>
        )}

        {/* Final state banners */}
        {isClosed && detail.po_status === 'approved' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-[4px] px-6 py-4 flex items-start gap-3">
            <CheckCheck className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">PO Approved — Awaiting Supplier Acknowledgment</p>
              <p className="text-xs text-emerald-700 mt-0.5">Internal approval chain is complete. The supplier will receive and acknowledge this PO.</p>
            </div>
          </div>
        )}
        {isClosed && detail.po_status === 'sent' && (
          <div className="bg-blue-50 border border-blue-200 rounded-[4px] px-6 py-4 flex items-start gap-3">
            <CheckCheck className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-blue-800">PO Sent — Supplier Has Acknowledged</p>
              <p className="text-xs text-blue-700 mt-0.5">The supplier has acknowledged receipt and confirmed a delivery commitment date.</p>
            </div>
          </div>
        )}
        {isClosed && (detail.po_status === 'draft') && (
          <div className="bg-orange-50 border border-orange-200 rounded-[4px] px-6 py-4 flex items-start gap-3">
            <RotateCcw className="w-5 h-5 text-orange-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-orange-800">PO Returned to Draft</p>
              <p className="text-xs text-orange-700 mt-0.5">An approver rejected or requested revision. The Buyer must review and resubmit.</p>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

// ─── Approval timeline ────────────────────────────────────────────────────────

function ApprovalTimeline({
  steps, actions, currentStep, instanceStatus,
}: {
  steps: POApprovalStep[];
  actions: POApprovalAction[];
  currentStep: number;
  instanceStatus: string;
}) {
  return (
    <ol className="relative space-y-0">
      {steps.map((step, idx) => {
        const action = actions.find(a => a.step_order === step.step_order);
        const isComplete = !!action;
        const isCurrent = !isComplete && step.step_order === currentStep && instanceStatus === 'active';
        const isPending = !isComplete && !isCurrent;

        return (
          <li key={step.step_order} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2 ${
                isComplete
                  ? action!.action === 'approved' ? 'bg-emerald-600 border-emerald-600'
                  : action!.action === 'rejected' ? 'bg-red-600 border-red-600'
                  : 'bg-orange-500 border-orange-500'
                  : isCurrent ? 'bg-[#F7F9FC] border-[#1E4BFF]'
                  : 'bg-[#F7F9FC] border-[#D8E2FF]'
              }`}>
                {isComplete ? (
                  action!.action === 'approved' ? <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                  : action!.action === 'rejected' ? <XCircle className="w-3.5 h-3.5 text-white" />
                  : <RotateCcw className="w-3.5 h-3.5 text-white" />
                ) : isCurrent ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-[#1E4BFF] animate-pulse" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-[#BFC7D5]" />
                )}
              </div>
              {idx < steps.length - 1 && (
                <div className={`w-0.5 flex-1 my-1 min-h-[24px] ${isComplete ? 'bg-[#D8E2FF]' : 'bg-[#D8E2FF]'}`} />
              )}
            </div>

            <div className="pb-5 flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-sm font-semibold text-[#0F1F3A]">
                  Step {step.step_order}: {step.position_required}
                </span>
                <span className="text-xs text-[#BFC7D5]">{step.action_label}</span>
                {step.is_final && <span className="text-xs text-[#BFC7D5] italic">· Final internal step</span>}
              </div>

              {isComplete && (
                <div className="mt-1.5 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <ActionPill action={action!.action} />
                    <span className="text-xs text-[#40527A] font-medium">{action!.actor_name_snapshot}</span>
                    <span className="text-xs text-[#BFC7D5]">· {format(new Date(action!.acted_at), 'MMM d, yyyy h:mm a')}</span>
                  </div>
                  {action!.remarks && (
                    <p className="text-xs text-[#40527A] italic ml-0.5">"{action!.remarks}"</p>
                  )}
                </div>
              )}
              {isCurrent && <p className="mt-1 text-xs text-[#1E4BFF] font-medium">Awaiting action</p>}
              {isPending && <p className="mt-1 text-xs text-[#BFC7D5]">Not yet reached</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function InfoField({ icon: Icon, label, value, mono }: { icon: React.ElementType; label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5 text-[#BFC7D5]" />
        <p className="text-xs font-semibold text-[#40527A] uppercase tracking-wide">{label}</p>
      </div>
      <p className={`text-sm text-[#0F1F3A] ${mono ? 'font-mono font-semibold' : 'font-medium'}`}>{value}</p>
    </div>
  );
}

function ActionPill({ action }: { action: string }) {
  if (action === 'approved') return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
      <CheckCircle2 className="w-3 h-3" /> Approved
    </span>
  );
  if (action === 'rejected') return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
      <XCircle className="w-3 h-3" /> Rejected
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5">
      <RotateCcw className="w-3 h-3" /> Revision Requested
    </span>
  );
}

function PriorityBadge({ priority }: { priority?: string }) {
  const colors = getPriorityColors(priority);
  return (
    <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
      {colors.label}
    </div>
  );
}

function POStatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    draft:        { cls: 'bg-[#F7F9FC] border-[#D8E2FF] text-[#40527A]',       label: 'Draft' },
    for_approval: { cls: 'bg-amber-50 border-amber-200 text-amber-700',       label: 'For Approval' },
    approved:     { cls: 'bg-emerald-50 border-emerald-200 text-emerald-700', label: 'Approved' },
    sent:         { cls: 'bg-blue-50 border-blue-200 text-blue-700',          label: 'Sent to Supplier' },
    cancelled:    { cls: 'bg-red-50 border-red-200 text-red-600',             label: 'Cancelled' },
  };
  const { cls, label } = map[status] ?? map.draft;
  return (
    <span className={`inline-flex items-center text-xs font-semibold border rounded-full px-2.5 py-1 ${cls}`}>
      {label}
    </span>
  );
}

function ActionButton({ icon: Icon, label, variant, onClick, disabled }: {
  icon: React.ElementType; label: string; variant: 'approve' | 'revise' | 'reject'; onClick: () => void; disabled: boolean;
}) {
  const styles = {
    approve: 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600',
    revise:  'bg-white hover:bg-orange-50 text-orange-600 border-orange-300 hover:border-orange-400',
    reject:  'bg-white hover:bg-red-50 text-red-600 border-red-300 hover:border-red-400',
  };
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-[4px] border transition disabled:opacity-50 ${styles[variant]}`}>
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}
