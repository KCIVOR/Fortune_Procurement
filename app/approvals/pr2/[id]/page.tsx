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
import { supabase } from '@/lib/supabase';
import {
  fetchPR2ApprovalDetail,
  canActOnPR2Step,
  submitPR2ApprovalAction,
} from '@/lib/pr2-approvals';
import type { PR2ApprovalDetail, ApprovalAction, WorkflowStep, ApprovalActionRecord } from '@/types/approvals';
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
import DetailWideInfoRow from '@/components/shared/DetailWideInfoRow';
import DetailInfoField from '@/components/shared/DetailInfoField';
import {
  canViewCommercialPricing,
  canViewCanvassPricing,
  formatCommercialAmount,
  PRICE_HIDDEN_LABEL,
} from '@/lib/price-visibility';
import {
  User, Building2, FileText, CalendarDays, Clock,
  CircleCheck as CheckCircle2, Circle as XCircle, RotateCcw,
  Package, TriangleAlert as AlertTriangle, CheckCheck, Lock,
  ClipboardList, DollarSign, Store,
} from 'lucide-react';
import QuoteAttachmentPills from '@/components/rfq/QuoteAttachmentPills';
import { PR1AttachmentsGallery } from '@/components/pr1/PR1AttachmentsSection';

export default function PR2ApprovalDetailPage() {
  const { id: instanceId } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const router = useRouter();
  const { handleBack } = useBackNavigation();

  const [detail, setDetail]         = useState<PR2ApprovalDetail | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [remarks, setRemarks]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [pendingAction, setPendingAction] = useState<ApprovalAction | null>(null);
  const [quotesMap, setQuotesMap]   = useState<Record<string, Array<{ supplier: string; unit_price: number; lead_time: number; is_external: boolean }>>>({});

  useEffect(() => {
    if (!instanceId) return;
    (async () => {
      try {
        const d = await fetchPR2ApprovalDetail(instanceId);
        setDetail(d);
        if (!d) {
          setError('Approval record not found.');
          return;
        }

        // DEBUG: Log PR2 items
        console.log('PR2 items:', d.items);
        console.log('PR2 items count:', d.items.length);
        console.log('Sample item pr1_item_id:', d.items[0]?.pr1_item_id);

        // Fetch canvass quotes for all items
        const pr1ItemIds = d.items.map(i => i.pr1_item_id).filter(Boolean);
        console.log('PR1 item IDs:', pr1ItemIds);
        console.log('PR1 item IDs count:', pr1ItemIds.length);

        if (pr1ItemIds.length > 0) {
          const { data: quotes, error: quotesErr } = await (supabase as any)
            .from('rfq_item_quotes')
            .select('pr1_item_id, unit_price, lead_time_days, rfq_supplier_id, rfq_suppliers!rfq_item_quotes_rfq_supplier_id_fkey(supplier_name_snapshot, is_external)')
            .in('pr1_item_id', pr1ItemIds);

          // DEBUG: Log query results
          console.log('Quotes query error:', quotesErr);
          console.log('Quotes query result:', quotes);
          console.log('Quotes count:', quotes?.length);

          if (!quotesErr && quotes) {
            const qMap: Record<string, Array<{ supplier: string; unit_price: number; lead_time: number; is_external: boolean }>> = {};
            quotes.forEach((q: any) => {
              if (!qMap[q.pr1_item_id]) qMap[q.pr1_item_id] = [];
              qMap[q.pr1_item_id].push({
                supplier: q.rfq_suppliers?.supplier_name_snapshot || 'Unknown',
                unit_price: q.unit_price,
                lead_time: q.lead_time_days || 0,
                is_external: q.rfq_suppliers?.is_external ?? false,
              });
            });
            console.log('quotesMap:', qMap);
            console.log('quotesMap size:', Object.keys(qMap).length);
            setQuotesMap(qMap);
          } else {
            console.log('Query failed or no data - quotesErr:', quotesErr);
          }
        } else {
          console.log('No PR1 item IDs found - skipping quotes fetch');
        }
      } catch (err) {
        setError('Failed to load approval details.');
      } finally {
        setLoading(false);
      }
    })();
  }, [instanceId]);

  // Active phase step definition
  const activeStepDef = detail && detail.active_current_step
    ? detail.active_steps.find(s => s.step_order === detail.active_current_step) ?? null
    : null;

  const canAct = !!(
    profile &&
    detail &&
    detail.active_instance_id === instanceId &&
    detail.active_instance_status === 'active' &&
    activeStepDef &&
    canActOnPR2Step(profile, activeStepDef.role_required, activeStepDef.position_required, detail.department_id)
  );

  const handleConfirmAction = useCallback(async () => {
    if (!detail || !profile || !pendingAction || !activeStepDef) return;

    if ((pendingAction === 'rejected' || pendingAction === 'revision_requested') && !remarks.trim()) {
      setSubmitError('Remarks are required when rejecting or requesting revision.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    try {
      await submitPR2ApprovalAction(
        instanceId,
        detail.pr2_id,
        activeStepDef.step_order,
        activeStepDef.is_final,
        detail.active_workflow_code ?? '',
        pendingAction,
        remarks,
        profile
      );
      router.push('/approvals/pr2');
    } catch (err: any) {
      setSubmitError(err.message ?? 'Failed to submit action.');
      setSubmitting(false);
    }
  }, [detail, profile, pendingAction, activeStepDef, remarks, router, instanceId]);

  if (loading) return (
    <AppShell title="PR2 Approval">
      <DetailPageSkeleton />
    </AppShell>
  );

  if (error || !detail) return (
    <AppShell title="PR2 Approval">
      <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">
        {error || 'Record not found.'}
      </div>
    </AppShell>
  );

  const isFullyClosed = detail.active_instance_status !== 'active' || !detail.active_instance_id;
  const isClosed = isFullyClosed || detail.active_instance_id !== instanceId;

  const canViewPrice = canViewCommercialPricing(profile);
  const canViewCanvass = canViewCanvassPricing(profile);
  const grandTotal = canViewPrice
    ? detail.items.reduce((sum, i) => sum + i.unit_price * i.quantity_to_purchase, 0)
    : null;

  return (
    <AppShell title="PR2 Approval">
      <DetailBackButton className="mb-2" onClick={() => handleBack({ role: profile?.role })} />

      {/* Page header */}
      <DetailHeaderLayout
        wrap={true}
        left={
          <div>
            <DetailTitleRow wrap>
              <h1 className="text-xl font-bold text-pq-neutral-900 font-mono">{detail.pr2_number}</h1>
              <DocumentStatusChip docType="PR2" status={detail.pr2_status} />
              <PriorityChip priority={detail.pr1_priority} />
              <RequestTypeBadge type={detail.request_type ?? 'goods'} />
            </DetailTitleRow>
            <p className="text-sm text-pq-neutral-500 mt-1">
              {detail.department_name_snapshot} · {detail.purpose}
            </p>
            <p className="text-xs text-pq-neutral-400 mt-0.5">
              PR1 Ref: <span className="font-mono">{detail.pr1_number_snapshot}</span>
              {' '}· RFQ Ref: <span className="font-mono">{detail.rfq_number_snapshot}</span>
            </p>
          </div>
        }
        right={
          <>
            {canAct ? (
              <div className="inline-flex items-center gap-2 bg-pq-warning-100 border border-pq-warning-100 text-pq-warning-600 text-xs font-semibold px-3 py-2 rounded-md">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Your action required — Step {detail.active_current_step}: {activeStepDef?.position_required}
              </div>
            ) : !isFullyClosed && (profile?.role === 'approver' || profile?.role === 'procurement') ? (
              <div className="inline-flex items-center gap-2 bg-pq-neutral-50 border border-pq-neutral-200 text-pq-neutral-500 text-xs font-medium px-3 py-2 rounded-md">
                <Lock className="w-3.5 h-3.5" />
                Awaiting Step {detail.active_current_step}: {activeStepDef?.position_required}
              </div>
            ) : null}
          </>
        }
      />

      <div className="space-y-5">

        {/* PR2 details */}
        <DetailCard overflow>
          <DetailCardHeader
            left={<h2 className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">PR2 Details</h2>}
            right={<span className="text-xs text-pq-neutral-400 font-mono">{detail.pr2_number}</span>}
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
              icon={<CalendarDays className="w-3.5 h-3.5 text-pq-neutral-400" />}
              label="Date Required"
              value={format(new Date(detail.date_required), 'MMMM d, yyyy')}
            />
            <DetailInfoField
              icon={<FileText className="w-3.5 h-3.5 text-pq-neutral-400" />}
              label="PR1 Ref."
              value={detail.pr1_number_snapshot}
              valueClassName="font-mono font-semibold"
            />
            <DetailInfoField
              icon={<FileText className="w-3.5 h-3.5 text-pq-neutral-400" />}
              label="RFQ Ref."
              value={detail.rfq_number_snapshot}
              valueClassName="font-mono font-semibold"
            />
            <DetailInfoField
              icon={<Clock className="w-3.5 h-3.5 text-pq-neutral-400" />}
              label="Generated"
              value={format(new Date(detail.generated_at), 'MMMM d, yyyy')}
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
          <RelatedRecords baseType="PR2" baseId={detail.pr2_id} role={profile.role} currentDocType="PR2" compact />
        )}

        {/* Items */}
        <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-pq-neutral-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-3.5 h-3.5 text-pq-neutral-400" />
              <h2 className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Items ({detail.items.length})</h2>
            </div>
            {canViewPrice && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-pq-neutral-900">
                <DollarSign className="w-3.5 h-3.5 text-pq-neutral-400" />
                Grand Total: {formatCommercialAmount(grandTotal ?? 0, true)}
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pq-neutral-200 bg-pq-neutral-50">
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-8">#</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-20">Code</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase">Description</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-24">Attachments</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-14">Unit</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-16">Req.</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-14">SOH</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-16">In-Trans.</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-16">To Buy</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase">Supplier</th>
                  {canViewPrice ? (
                    <>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-24">Unit Price</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-24">Total</th>
                    </>
                  ) : (
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-24">Hidden</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-pq-neutral-200">
                {detail.items.map(item => {
                  const quotes = item.pr1_item_id ? quotesMap[item.pr1_item_id] || [] : [];
                  // DEBUG: Log per-item lookup
                  if (item.item_order === 1) {
                    console.log(`Item ${item.item_order}:`, {
                      pr1_item_id: item.pr1_item_id,
                      description: item.description,
                      quotesFromMap: quotes,
                      quotesCount: quotes.length,
                      quotesMapKeys: Object.keys(quotesMap)
                    });
                  }
                  return (
                    <>
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
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1.5 items-start">
                            {(item.attachments?.length ?? 0) > 0 && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-semibold text-pq-neutral-400 uppercase tracking-wide w-9 shrink-0">Req.</span>
                                <PR1AttachmentsGallery attachments={item.attachments!} />
                              </div>
                            )}
                            {(item.quote_attachments?.length ?? 0) > 0 && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-semibold text-pq-neutral-400 uppercase tracking-wide w-9 shrink-0">Quote</span>
                                <QuoteAttachmentPills attachments={item.quote_attachments!} />
                              </div>
                            )}
                            {(item.attachments?.length ?? 0) === 0 && (item.quote_attachments?.length ?? 0) === 0 && (
                              <span className="text-xs text-pq-neutral-300">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-pq-neutral-500 text-xs">{item.unit_of_measure}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-pq-neutral-500">{item.quantity_requested}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-pq-neutral-500">{item.qty_on_hand}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-pq-neutral-500">{item.qty_incoming}</td>
                        <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-pq-neutral-900">{item.quantity_to_purchase}</td>
                        <td className="px-4 py-3 text-xs text-pq-neutral-900">
                          <p>{item.supplier_name_snapshot}</p>
                          {(() => {
                            const winningQuote = item.pr1_item_id
                              ? (quotesMap[item.pr1_item_id] ?? []).find(
                                  q => q.supplier === item.supplier_name_snapshot && q.is_external
                                )
                              : undefined;
                            return winningQuote ? (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold
                                text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 mt-0.5">
                                <Store className="w-2.5 h-2.5 shrink-0" />
                                External vendor
                              </span>
                            ) : null;
                          })()}
                        </td>
                        {canViewPrice ? (
                          <>
                            <td className="px-4 py-3 text-right text-xs text-pq-neutral-500">{formatCommercialAmount(item.unit_price, true)}</td>
                            <td className="px-4 py-3 text-right text-sm font-semibold text-pq-neutral-900">{formatCommercialAmount(item.unit_price * item.quantity_to_purchase, true)}</td>
                          </>
                        ) : (
                          <td className="px-4 py-3 text-center text-xs text-pq-neutral-400">{PRICE_HIDDEN_LABEL}</td>
                        )}
                      </tr>
                      {canViewCanvass && quotes.length > 0 && (
                        <tr className="bg-pq-neutral-50 border-t border-pq-neutral-200">
                          <td colSpan={canViewPrice ? 12 : 11} className="px-4 py-3">
                            <details className="cursor-pointer">
                              <summary className="text-xs font-semibold text-pq-neutral-500 hover:text-pq-neutral-900">
                                Other Supplier Quotes ({quotes.length})
                              </summary>
                              <div className="mt-2 ml-2 text-xs">
                                <div className="inline-grid grid-cols-3 gap-4">
                                  {quotes.map((q, idx) => (
                                    <div key={idx} className="text-pq-neutral-500">
                                      <div className="font-mono flex items-center gap-1 flex-wrap">
                                        {q.supplier}
                                        {q.is_external && (
                                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold
                                            text-amber-700 bg-amber-50 border border-amber-200 rounded px-1 py-0.5">
                                            <Store className="w-2 h-2 shrink-0" />
                                            External
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-pq-neutral-900 font-semibold">{formatCommercialAmount(q.unit_price, true)}</div>
                                      <div className="text-pq-neutral-400 text-xs">{q.lead_time}d</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </details>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
              <tfoot>
                {canViewPrice ? (
                  <tr className="bg-pq-neutral-50 border-t-2 border-pq-neutral-200">
                    <td colSpan={11} className="px-4 py-3 text-right text-xs font-semibold text-pq-neutral-900">Grand Total</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-pq-neutral-900">
                      {formatCommercialAmount(grandTotal ?? 0, true)}
                    </td>
                  </tr>
                ) : (
                  <tr className="bg-pq-neutral-50 border-t-2 border-pq-neutral-200">
                    <td colSpan={11} className="px-4 py-3 text-center text-xs text-pq-neutral-400">Pricing hidden</td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
        </div>

        {/* Approval timeline */}
        <PhaseTimeline
          phaseLabel="Approval"
          phaseSubLabel="PR2 Approval Chain"
          steps={detail.phase1_steps}
          actions={detail.phase1_actions}
          currentStep={detail.phase1_current_step}
          instanceStatus={detail.phase1_instance_status}
        />

        {/* Action panel */}
        {!isClosed && canAct && (
          <div className="bg-white rounded-md border border-pq-warning-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-amber-100 bg-pq-warning-100">
              <h2 className="text-xs font-semibold text-pq-warning-600 uppercase tracking-wide">
                Your Action — {activeStepDef?.action_label}
              </h2>
              <p className="text-xs text-pq-warning-600 mt-0.5">
                Acting as: <strong>{profile?.full_name}</strong> · {profile?.position}
                {' '}·{' '}Approval
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
                      pendingAction === 'approved' ? 'text-pq-success-600' :
                      pendingAction === 'rejected' ? 'text-pq-danger-600' : 'text-orange-700'
                    }>
                      {pendingAction === 'approved'
                        ? activeStepDef?.is_final
                          ? 'Final Approval — PR2 Fully Approved'
                          : 'Approved — Advance to Next Step'
                        : pendingAction === 'rejected'
                        ? 'Rejected — PR2 returned to Procurement'
                        : 'Request Revision — PR2 returned to Procurement'}
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
                  <ActionButton icon={CheckCheck} label={activeStepDef?.is_final ? 'Approve — Final' : 'Approve & Advance'} variant="approve"
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
        {!isClosed && !canAct && (profile?.role === 'approver' || profile?.role === 'procurement') && (
          <div className="flex items-start gap-3 bg-pq-neutral-50 border border-pq-neutral-200 rounded-md px-5 py-4">
            <Lock className="w-4 h-4 text-pq-neutral-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-pq-neutral-900">Read-only view</p>
              <p className="text-xs text-pq-neutral-500 mt-0.5">
                Step {detail.active_current_step} ({activeStepDef?.position_required}) must be completed before you can act.
              </p>
            </div>
          </div>
        )}

        {/* Closed state */}
        {isFullyClosed && detail.pr2_status === 'approved' && (
          <div className="bg-pq-success-100 border border-pq-success-100 rounded-md px-6 py-4 flex items-start gap-3">
            <CheckCheck className="w-5 h-5 text-pq-success-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-pq-success-600">Approved — Ready for Purchase Order</p>
              <p className="text-xs text-pq-success-600 mt-0.5">All approvals are complete.</p>
            </div>
          </div>
        )}
        {isFullyClosed && (detail.pr2_status === 'draft') && (
          <div className="bg-orange-50 border border-orange-200 rounded-md px-6 py-4 flex items-start gap-3">
            <RotateCcw className="w-5 h-5 text-orange-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-orange-800">Returned to Procurement</p>
              <p className="text-xs text-orange-700 mt-0.5">An approver rejected or requested revision. Procurement must review and resubmit.</p>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

// ─── Phase timeline ───────────────────────────────────────────────────────────

function PhaseTimeline({
  phaseLabel,
  phaseSubLabel,
  steps,
  actions,
  currentStep,
  instanceStatus,
  notStarted,
}: {
  phaseLabel: string;
  phaseSubLabel: string;
  steps: WorkflowStep[];
  actions: ApprovalActionRecord[];
  currentStep: number;
  instanceStatus: string;
  notStarted?: boolean;
}) {
  return (
    <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-pq-neutral-200">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-3.5 h-3.5 text-pq-neutral-400" />
          <div>
            <h2 className="text-xs font-semibold text-pq-neutral-900 uppercase tracking-wide">{phaseLabel}</h2>
            <p className="text-xs text-pq-neutral-400 mt-0.5">{phaseSubLabel}</p>
          </div>
          {notStarted && (
            <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-pq-neutral-400 bg-pq-neutral-50 border border-pq-neutral-200 rounded-md px-2.5 py-1">
              <Lock className="w-3 h-3" />
              Not started
            </span>
          )}
          {!notStarted && instanceStatus === 'approved' && (
            <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-pq-success-600 bg-pq-success-100 border border-pq-success-100 rounded-full px-2.5 py-1">
              <CheckCircle2 className="w-3 h-3" /> Complete
            </span>
          )}
          {!notStarted && instanceStatus === 'active' && (
            <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-pq-neutral-900 bg-pq-neutral-50 border border-pq-neutral-200 rounded-md px-2.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-pq-primary-600 animate-pulse" />
              In Progress
            </span>
          )}
        </div>
      </div>
      <div className="p-6">
        {notStarted ? (
          <p className="text-sm text-pq-neutral-400 italic">Approval timeline will appear once submitted.</p>
        ) : (
          <WorkflowTimeline
            steps={steps}
            actions={actions}
            currentStep={currentStep}
            instanceStatus={instanceStatus}
          />
        )}
      </div>
    </div>
  );
}

// ─── Workflow timeline (reused from PR1 pattern) ──────────────────────────────

function WorkflowTimeline({
  steps, actions, currentStep, instanceStatus,
}: {
  steps: WorkflowStep[];
  actions: ApprovalActionRecord[];
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
                {step.is_final && <span className="text-xs text-pq-neutral-400 italic">· Final</span>}
              </div>

              {isComplete && (
                <div className="mt-1.5 space-y-0.5">
                  <div className="flex items-center gap-2">
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

// ─── Small presentational helpers ─────────────────────────────────────────────

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
