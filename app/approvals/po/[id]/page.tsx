'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useBackNavigation } from '@/hooks/use-back-navigation';
import AppShell from '@/components/layout/AppShell';
import { DetailPageSkeleton } from '@/components/shared/structural-skeletons';
import RelatedRecords from '@/components/shared/RelatedRecords';
import RawMaterialBadge from '@/components/shared/RawMaterialBadge';
import { useAuth } from '@/context/AuthContext';
import {
  fetchPOApprovalDetail,
  canActOnPOStep,
  submitPOApprovalAction,
} from '@/lib/po-approvals';
import type { POApprovalDetail, POApprovalStep, POApprovalAction } from '@/types/po';
import type { ApprovalAction } from '@/types/approvals';
import { format } from 'date-fns';
import PriorityChip from '@/components/shared/PriorityChip';
import DocumentStatusChip from '@/components/shared/DocumentStatusChip';
import { RequestTypeBadge } from '@/components/shared/RequestTypeBadge';
import ActionPill from '@/components/shared/ActionPill';
import DetailBackButton from '@/components/shared/DetailBackButton';
import DetailHeaderLayout from '@/components/shared/DetailHeaderLayout';
import DetailTitleRow from '@/components/shared/DetailTitleRow';
import DetailCard from '@/components/shared/DetailCard';
import DetailCardHeader from '@/components/shared/DetailCardHeader';
import DetailInfoGrid from '@/components/shared/DetailInfoGrid';
import DetailInfoField from '@/components/shared/DetailInfoField';
import DetailWideInfoRow from '@/components/shared/DetailWideInfoRow';
import DetailTableCard from '@/components/shared/DetailTableCard';
import { canViewCommercialPricing, formatCommercialAmount, PRICE_HIDDEN_LABEL } from '@/lib/price-visibility';
import QuoteAttachmentPills from '@/components/rfq/QuoteAttachmentPills';
import {
  User, Building2, FileText, CalendarDays, Clock,
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
    canActOnPOStep(profile, currentStepDef.role_required, currentStepDef.position_required, detail.department_id)
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
      // Redirect based on role - procurement goes to /po, approvers go to /approvals/po
      if (profile.role === 'procurement') {
        router.push('/po');
      } else {
        router.push('/approvals/po');
      }
    } catch (err: any) {
      setSubmitError(err.message ?? 'Failed to submit action.');
      setSubmitting(false);
    }
  }, [detail, profile, pendingAction, currentStepDef, remarks, router, instanceId]);

  if (loading) return (
    <AppShell title="PO Approval">
      <DetailPageSkeleton />
    </AppShell>
  );

  if (error || !detail) return (
    <AppShell title="PO Approval">
      <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">
        {error || 'Record not found.'}
      </div>
    </AppShell>
  );

  const isClosed = detail.instance_status !== 'active';
  const canViewPrices = canViewCommercialPricing(profile);
  const grandTotal = canViewPrices
    ? detail.items.reduce((sum, i) => sum + i.unit_price * i.quantity_to_purchase, 0)
    : null;

  // Internal steps only (steps 1-3); step 4 is supplier
  const internalSteps = detail.steps.filter(s => s.step_order <= 3);
  const internalActions = detail.actions.filter(a => a.step_order <= 3);
  const supplierAction = detail.actions.find(a => a.step_order === 4);

  return (
    <AppShell title="PO Approval">
      <DetailBackButton className="mb-2" onClick={() => handleBack({ role: profile?.role })} />

      {/* Page header */}
      <DetailHeaderLayout
        wrap={true}
        left={
          <div>
            <DetailTitleRow wrap>
              <h1 className="text-xl font-bold text-pq-neutral-900 font-mono">{detail.po_number}</h1>
              <DocumentStatusChip docType="PO" status={detail.po_status} />
              <PriorityChip priority={detail.pr1_priority} />
              <RequestTypeBadge type={detail.request_type ?? 'goods'} />
            </DetailTitleRow>
            <p className="text-sm text-pq-neutral-500 mt-1">
              {detail.department_name_snapshot} · {detail.purpose}
            </p>
            <p className="text-xs text-pq-neutral-400 mt-0.5">
              PR2 Ref: <span className="font-mono">{detail.pr2_number_snapshot}</span>
              {' '}· PR1 Ref: <span className="font-mono">{detail.pr1_number_snapshot}</span>
              {' '}· RFQ Ref: <span className="font-mono">{detail.rfq_number_snapshot}</span>
            </p>
          </div>
        }
        right={
          <>
            {canAct ? (
              <div className="inline-flex items-center gap-2 bg-pq-warning-100 border border-pq-warning-100 text-pq-warning-600 text-xs font-semibold px-3 py-2 rounded-md">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Your action required — Step {detail.current_step}: {currentStepDef?.position_required}
              </div>
            ) : !isClosed ? (
              <div className="inline-flex items-center gap-2 bg-pq-neutral-50 border border-pq-neutral-200 text-pq-neutral-500 text-xs font-medium px-3 py-2 rounded-md">
                <Lock className="w-3.5 h-3.5" />
                Awaiting Step {detail.current_step}: {currentStepDef?.position_required}
              </div>
            ) : null}
          </>
        }
      />

      <div className="space-y-5">

        {/* PO header details */}
        <DetailCard overflow>
          <DetailCardHeader
            left={<h2 className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Purchase Order Details</h2>}
            right={(
              <Link href={`/po/${detail.po_id}`} className="text-xs text-pq-primary-600 hover:text-pq-primary-600 font-medium transition">
                View Full PO
              </Link>
            )}
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
              icon={<Package className="w-3.5 h-3.5 text-pq-neutral-400" />}
              label="Supplier"
              value={detail.supplier_name_snapshot}
            />
            <DetailInfoField
              icon={<CalendarDays className="w-3.5 h-3.5 text-pq-neutral-400" />}
              label="PO Date"
              value={format(new Date(detail.po_date), 'MMMM d, yyyy')}
            />
            <DetailInfoField
              icon={<CalendarDays className="w-3.5 h-3.5 text-pq-neutral-400" />}
              label="Date Required"
              value={format(new Date(detail.date_required), 'MMMM d, yyyy')}
            />
            <DetailInfoField
              icon={<Truck className="w-3.5 h-3.5 text-pq-neutral-400" />}
              label="Warehouse"
              value={detail.warehouse}
            />
            <DetailInfoField
              icon={<MapPin className="w-3.5 h-3.5 text-pq-neutral-400" />}
              label="Delivery Address"
              value={detail.delivery_address}
            />
            <DetailInfoField
              icon={<CreditCard className="w-3.5 h-3.5 text-pq-neutral-400" />}
              label="Payment Terms"
              value={detail.payment_terms}
            />
            <DetailInfoField
              icon={<FileText className="w-3.5 h-3.5 text-pq-neutral-400" />}
              label="Packing"
              value={detail.packing}
            />
            <DetailWideInfoRow label="Purpose">{detail.purpose}</DetailWideInfoRow>
            {detail.remarks && (
              <DetailWideInfoRow label="Remarks" valueClassName="italic">
                {`"${detail.remarks}"`}
              </DetailWideInfoRow>
            )}
          </DetailInfoGrid>
        </DetailCard>

        {/* Related Records */}
        {profile && (
          <RelatedRecords baseType="PO" baseId={detail.po_id} role={profile.role} currentDocType="PO" compact />
        )}

        {/* Items */}
        <DetailTableCard
          title={
            <div className="flex items-center gap-2">
              <Package className="w-3.5 h-3.5 text-pq-neutral-400" />
              <h2 className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Items ({detail.items.length})</h2>
            </div>
          }
          right={
            canViewPrices ? (
              <div className="text-xs font-semibold text-pq-neutral-900">
                Grand Total: {formatCommercialAmount(grandTotal ?? 0, true)}
              </div>
            ) : undefined
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pq-neutral-200 bg-pq-neutral-50">
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-8">#</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-20">Code</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase">Description</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-24">Attachments</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-16">Unit</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-20">Qty</th>
                  {canViewPrices ? (
                    <>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-28">Unit Price</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-28">Total</th>
                    </>
                  ) : (
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-28">Pricing</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-pq-neutral-200">
                {detail.items.map(item => (
                  <tr key={item.id} className="hover:bg-pq-neutral-50">
                    <td className="px-4 py-3 text-center text-xs text-pq-neutral-400 font-mono">{item.item_order}</td>
                    <td className="px-4 py-3 font-mono text-xs text-pq-neutral-500">{item.item_code || '—'}</td>
                    <td className="px-4 py-3 text-pq-neutral-900 font-medium">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>{item.description}</span>
                        <RawMaterialBadge isRawMaterial={item.is_raw_material} size="sm" />
                      </div>
                      {item.quote_justification && (
                        <p className="text-xs text-pq-warning-700 mt-1 flex items-start gap-1 font-normal">
                          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                          <span>
                            <strong>Award justification:</strong> {item.quote_justification}
                          </span>
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {(item.quote_attachments?.length ?? 0) > 0
                        ? <QuoteAttachmentPills attachments={item.quote_attachments!} />
                        : <span className="text-xs text-pq-neutral-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center text-pq-neutral-500 text-xs">{item.unit_of_measure}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-pq-neutral-900">{item.quantity_to_purchase}</td>
                    {canViewPrices ? (
                      <>
                        <td className="px-4 py-3 text-right text-xs text-pq-neutral-500">{formatCommercialAmount(item.unit_price, true)}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-pq-neutral-900">{formatCommercialAmount(item.unit_price * item.quantity_to_purchase, true)}</td>
                      </>
                    ) : (
                      <td className="px-4 py-3 text-center text-xs text-pq-neutral-400">{PRICE_HIDDEN_LABEL}</td>
                    )}
                  </tr>
                ))}
              </tbody>
              {canViewPrices && (
                <tfoot>
                  <tr className="bg-pq-neutral-50 border-t-2 border-pq-neutral-200">
                    <td colSpan={7} className="px-4 py-3 text-right text-xs font-semibold text-pq-neutral-900">Grand Total</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-pq-neutral-900">
                      {formatCommercialAmount(grandTotal ?? 0, true)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </DetailTableCard>

        {/* Approval timeline */}
        <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-pq-neutral-200">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-3.5 h-3.5 text-pq-neutral-400" />
              <div>
                <h2 className="text-xs font-semibold text-pq-neutral-900 uppercase tracking-wide">Internal Approval Chain</h2>
                <p className="text-xs text-pq-neutral-400 mt-0.5">Buyer · Procurement Manager · Finance Director</p>
              </div>
              {detail.instance_status === 'approved' && (
                <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-pq-success-600 bg-pq-success-100 border border-pq-success-100 rounded-full px-2.5 py-1">
                  <CheckCircle2 className="w-3 h-3" /> Complete
                </span>
              )}
              {detail.instance_status === 'active' && (
                <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-pq-neutral-900 bg-pq-neutral-50 border border-pq-neutral-200 rounded-md px-2.5 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-pq-primary-600 animate-pulse" />
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
          <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-pq-neutral-200">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-3.5 h-3.5 text-pq-neutral-400" />
                <h2 className="text-xs font-semibold text-pq-neutral-900 uppercase tracking-wide">Supplier Acknowledgment</h2>
                {detail.receipt ? (
                  <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-pq-success-600 bg-pq-success-100 border border-pq-success-100 rounded-full px-2.5 py-1">
                    <CheckCircle2 className="w-3 h-3" /> Acknowledged
                  </span>
                ) : (
                  <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-pq-neutral-400 bg-pq-neutral-50 border border-pq-neutral-200 rounded-full px-2.5 py-1">
                    <Clock className="w-3 h-3" /> Awaiting Supplier
                  </span>
                )}
              </div>
            </div>
            <div className="p-6">
              {detail.receipt ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                  <DetailInfoField
                    icon={<User className="w-3.5 h-3.5 text-pq-neutral-400" />}
                    label="Acknowledged By"
                    value={detail.receipt.acknowledged_by_name}
                  />
                  <DetailInfoField
                    icon={<Clock className="w-3.5 h-3.5 text-pq-neutral-400" />}
                    label="Acknowledged At"
                    value={format(new Date(detail.receipt.acknowledged_at), 'MMM d, yyyy h:mm a')}
                  />
                  {detail.receipt.commitment_date && (
                    <DetailInfoField
                      icon={<CalendarDays className="w-3.5 h-3.5 text-pq-neutral-400" />}
                      label="Commitment Date"
                      value={format(new Date(detail.receipt.commitment_date), 'MMMM d, yyyy')}
                    />
                  )}
                  {detail.receipt.delivery_remarks && (
                    <div className="col-span-2 md:col-span-3">
                      <p className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1">Delivery Remarks</p>
                      <p className="text-sm text-pq-neutral-900 italic">"{detail.receipt.delivery_remarks}"</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-pq-neutral-400 italic">
                  The PO has been approved internally. Awaiting supplier acknowledgment.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Action panel */}
        {!isClosed && canAct && (
          <div className="bg-white rounded-md border border-pq-warning-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-amber-100 bg-pq-warning-100">
              <h2 className="text-xs font-semibold text-pq-warning-600 uppercase tracking-wide">
                Your Action — {currentStepDef?.action_label}
              </h2>
              <p className="text-xs text-pq-warning-600 mt-0.5">
                Acting as: <strong>{profile?.full_name}</strong> · {profile?.position}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
                  Remarks <span className="text-pq-neutral-400 font-normal normal-case">(required for reject / revision)</span>
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
                    <strong className={
                      pendingAction === 'approved'            ? 'text-pq-success-600' :
                      pendingAction === 'rejected'            ? 'text-pq-danger-600'     : 'text-orange-700'
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

        {/* Final state banners */}
        {isClosed && detail.po_status === 'approved' && (
          <div className="bg-pq-success-100 border border-pq-success-100 rounded-md px-6 py-4 flex items-start gap-3">
            <CheckCheck className="w-5 h-5 text-pq-success-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-pq-success-600">PO Approved — Awaiting Supplier Acknowledgment</p>
              <p className="text-xs text-pq-success-600 mt-0.5">Internal approval chain is complete. The supplier will receive and acknowledge this PO.</p>
            </div>
          </div>
        )}
        {isClosed && detail.po_status === 'sent' && (
          <div className="bg-pq-primary-50 border border-pq-primary-200 rounded-md px-6 py-4 flex items-start gap-3">
            <CheckCheck className="w-5 h-5 text-pq-primary-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-pq-primary-600">PO Sent — Supplier Has Acknowledged</p>
              <p className="text-xs text-pq-primary-700 mt-0.5">The supplier has acknowledged receipt and confirmed a delivery commitment date.</p>
            </div>
          </div>
        )}
        {isClosed && (detail.po_status === 'draft') && (
          <div className="bg-orange-50 border border-orange-200 rounded-md px-6 py-4 flex items-start gap-3">
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
                  ? action!.action === 'approved' ? 'bg-pq-success-600 border-pq-success-600'
                  : action!.action === 'rejected' ? 'bg-pq-danger-600 border-pq-danger-600'
                  : 'bg-orange-500 border-orange-500'
                  : isCurrent ? 'bg-pq-neutral-50 border-pq-primary-600'
                  : 'bg-pq-neutral-50 border-pq-neutral-200'
              }`}>
                {isComplete ? (
                  action!.action === 'approved' ? <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                  : action!.action === 'rejected' ? <XCircle className="w-3.5 h-3.5 text-white" />
                  : <RotateCcw className="w-3.5 h-3.5 text-white" />
                ) : isCurrent ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-pq-primary-600 animate-pulse" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-pq-neutral-400" />
                )}
              </div>
              {idx < steps.length - 1 && (
                <div className={`w-0.5 flex-1 my-1 min-h-[24px] ${isComplete ? 'bg-pq-neutral-200' : 'bg-pq-neutral-200'}`} />
              )}
            </div>

            <div className="pb-5 flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-sm font-semibold text-pq-neutral-900">
                  Step {step.step_order}: {step.position_required}
                </span>
                <span className="text-xs text-pq-neutral-400">{step.action_label}</span>
                {step.is_final && <span className="text-xs text-pq-neutral-400 italic">· Final internal step</span>}
              </div>

              {isComplete && (
                <div className="mt-1.5 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <ActionPill action={action!.action} />
                    <span className="text-xs text-pq-neutral-500 font-medium">{action!.actor_name_snapshot}</span>
                    <span className="text-xs text-pq-neutral-400">· {format(new Date(action!.acted_at), 'MMM d, yyyy h:mm a')}</span>
                  </div>
                  {action!.remarks && (
                    <p className="text-xs text-pq-neutral-500 italic ml-0.5">"{action!.remarks}"</p>
                  )}
                </div>
              )}
              {isCurrent && <p className="mt-1 text-xs text-pq-primary-600 font-medium">Awaiting action</p>}
              {isPending && <p className="mt-1 text-xs text-pq-neutral-400">Not yet reached</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ActionButton({ icon: Icon, label, variant, onClick, disabled }: {
  icon: React.ElementType; label: string; variant: 'approve' | 'revise' | 'reject'; onClick: () => void; disabled: boolean;
}) {
  const styles = {
    approve: 'bg-pq-success-600 hover:bg-pq-success-600 text-white border-pq-success-600',
    revise:  'bg-white hover:bg-orange-50 text-orange-600 border-orange-300 hover:border-orange-400',
    reject:  'bg-white hover:bg-pq-danger-100 text-pq-danger-600 border-red-300 hover:border-red-400',
  };
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-md border transition disabled:opacity-50 ${styles[variant]}`}>
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}
