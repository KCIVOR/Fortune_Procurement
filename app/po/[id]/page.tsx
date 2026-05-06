'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useBackNavigation } from '@/hooks/use-back-navigation';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import { useAuth } from '@/context/AuthContext';
import { fetchPOById, calcPOGrandTotal } from '@/lib/po';
import {
  submitPOForApproval,
  fetchPOApprovalDetailByPOId,
  canActOnPOStep,
} from '@/lib/po-approvals';
import type { POWithItems, POApprovalDetail, POApprovalStep, POApprovalAction } from '@/types/po';
import { PO_STATUS_LABELS } from '@/types/po';
import { format } from 'date-fns';
import {
  FileText, Building2, User, CalendarDays,
  Package, Truck, CreditCard, MapPin,
  DollarSign, ClipboardList, Send, CircleCheck as CheckCircle2,
  Circle as XCircle, RotateCcw, Lock, TriangleAlert as AlertTriangle,
} from 'lucide-react';
import RelatedRecords from '@/components/shared/RelatedRecords';
import DetailBackButton from '@/components/shared/DetailBackButton';
import DetailHeaderLayout from '@/components/shared/DetailHeaderLayout';
import DetailTitleRow from '@/components/shared/DetailTitleRow';
import DetailPrintButton from '@/components/shared/DetailPrintButton';
import DetailTableCard from '@/components/shared/DetailTableCard';
import DetailInfoField from '@/components/shared/DetailInfoField';

const STATUS_STYLES: Record<string, string> = {
  draft:        'bg-[#F7F9FC] text-[#40527A] border-[#D8E2FF]',
  for_approval: 'bg-amber-50 text-amber-700 border-amber-200',
  approved:     'bg-emerald-50 text-emerald-700 border-emerald-200',
  sent:         'bg-sky-50 text-sky-700 border-sky-200',
  cancelled:    'bg-red-50 text-red-500 border-red-200',
};

export default function PODetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const router = useRouter();
  const { handleBack } = useBackNavigation();

  const [po, setPO]                           = useState<POWithItems | null>(null);
  const [approvalDetail, setApprovalDetail]   = useState<POApprovalDetail | null>(null);
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState('');
  const [submitting, setSubmitting]           = useState(false);
  const [submitError, setSubmitError]         = useState('');

  const load = () => {
    if (!id) return;
    Promise.all([
      fetchPOById(id),
      fetchPOApprovalDetailByPOId(id).catch(() => null),
    ])
      .then(([data, approval]) => {
        if (!data) { setError('Purchase order not found.'); return; }
        setPO(data);
        setApprovalDetail(approval);
      })
      .catch(() => setError('Failed to load purchase order.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const handleSubmitForApproval = async () => {
    if (!po || !profile) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await submitPOForApproval(po.id, profile);
      load();
    } catch (err: any) {
      setSubmitError(err.message ?? 'Failed to submit for approval.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <AppShell title="Purchase Order">
      <div className="flex items-center justify-center h-64">
        <LoadingState message="Loading PO..." />
      </div>
    </AppShell>
  );

  if (error || !po) return (
    <AppShell title="Purchase Order">
      <div className="bg-red-50 border border-red-200 rounded-[4px] p-4 text-sm text-red-700">
        {error || 'Purchase order not found.'}
      </div>
    </AppShell>
  );

  const grandTotal = calcPOGrandTotal(po.items);

  return (
    <AppShell title={`PO ${po.po_number}`}>
      <DetailBackButton className="mb-3" onClick={() => handleBack({ role: profile?.role })} />

      {/* Header */}
      <DetailHeaderLayout
        wrap={true}
        left={
          <div>
            <DetailTitleRow wrap mb>
              <h1 className="text-2xl font-bold text-[#0F1F3A] font-mono">{po.po_number}</h1>
              <span className={`inline-flex items-center text-xs font-semibold border rounded-full px-2.5 py-1 ${STATUS_STYLES[po.status] ?? STATUS_STYLES.draft}`}>
                {PO_STATUS_LABELS[po.status] ?? po.status}
              </span>
            </DetailTitleRow>
            <p className="text-sm text-[#40527A]">{po.department_name_snapshot} · {po.purpose}</p>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-xs text-[#BFC7D5] font-mono">PR2: {po.pr2_number_snapshot}</span>
              <span className="text-xs text-[#BFC7D5] font-mono">PR1: {po.pr1_number_snapshot}</span>
              <span className="text-xs text-[#BFC7D5] font-mono">RFQ: {po.rfq_number_snapshot}</span>
            </div>
          </div>
        }
        right={
          <div className="flex items-center gap-2 shrink-0">
            {po.status === 'draft' && profile?.position === 'Buyer' && (
              <button
                onClick={handleSubmitForApproval}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-[4px] transition disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {submitting ? 'Submitting...' : 'Submit for Approval'}
              </button>
            )}
            {approvalDetail && approvalDetail.instance_status === 'active' && (
              <Link
                href={`/approvals/po/${approvalDetail.instance_id}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-700 text-sm font-semibold rounded-[4px] transition"
              >
                <ClipboardList className="w-4 h-4" />
                View Approval
              </Link>
            )}
            <DetailPrintButton
              href={`/po/${po.id}/print`}
              label="Print PO"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-[4px] transition"
            />
          </div>
        }
      />

      {/* Related Records */}
      {profile && (
        <div className="mb-6">
          <RelatedRecords baseType="PO" baseId={po.id} role={profile.role} currentDocType="PO" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 auto-rows-max lg:auto-rows-auto">

        {/* Left column: details and items */}
        <div className="lg:col-span-2 space-y-4 order-3 lg:order-none">

          {/* PO Details */}
          <div className="bg-white rounded-[4px] border border-[#D8E2FF] p-5 space-y-4">
            <h2 className="text-xs font-bold text-[#40527A] uppercase tracking-wide">PO Details</h2>
            <DetailInfoField
              layout="inline"
              icon={<FileText className="w-3.5 h-3.5 text-[#BFC7D5] mt-0.5 shrink-0" />}
              label="PO Number"
              value={po.po_number}
              valueClassName="font-mono font-semibold"
            />
            <DetailInfoField
              layout="inline"
              icon={<FileText className="w-3.5 h-3.5 text-[#BFC7D5] mt-0.5 shrink-0" />}
              label="PR2 Reference"
              value={po.pr2_number_snapshot}
              valueClassName="font-mono font-semibold"
            />
            <DetailInfoField
              layout="inline"
              icon={<FileText className="w-3.5 h-3.5 text-[#BFC7D5] mt-0.5 shrink-0" />}
              label="PR1 Reference"
              value={po.pr1_number_snapshot}
              valueClassName="font-mono font-semibold"
            />
            <DetailInfoField
              layout="inline"
              icon={<FileText className="w-3.5 h-3.5 text-[#BFC7D5] mt-0.5 shrink-0" />}
              label="RFQ Reference"
              value={po.rfq_number_snapshot}
              valueClassName="font-mono font-semibold"
            />
            <DetailInfoField
              layout="inline"
              icon={<CalendarDays className="w-3.5 h-3.5 text-[#BFC7D5] mt-0.5 shrink-0" />}
              label="PO Date"
              value={format(new Date(po.po_date), 'MMMM d, yyyy')}
            />
            <DetailInfoField
              layout="inline"
              icon={<CalendarDays className="w-3.5 h-3.5 text-[#BFC7D5] mt-0.5 shrink-0" />}
              label="Date Required"
              value={format(new Date(po.date_required), 'MMMM d, yyyy')}
            />
            <DetailInfoField
              layout="inline"
              icon={<CalendarDays className="w-3.5 h-3.5 text-[#BFC7D5] mt-0.5 shrink-0" />}
              label="Generated"
              value={format(new Date(po.generated_at), 'MMMM d, yyyy')}
            />
            <DetailInfoField
              layout="inline"
              icon={<User className="w-3.5 h-3.5 text-[#BFC7D5] mt-0.5 shrink-0" />}
              label="Requisitioner"
              value={po.requisitioner_name_snapshot}
            />
            <DetailInfoField
              layout="inline"
              icon={<Building2 className="w-3.5 h-3.5 text-[#BFC7D5] mt-0.5 shrink-0" />}
              label="Department"
              value={po.department_name_snapshot}
            />
            <DetailInfoField
              layout="inline"
              icon={<Package className="w-3.5 h-3.5 text-[#BFC7D5] mt-0.5 shrink-0" />}
              label="Supplier"
              value={po.supplier_name_snapshot}
            />
          </div>

          {/* Delivery & Terms */}
          <div className="bg-white rounded-[4px] border border-[#D8E2FF] p-5 space-y-4">
            <h2 className="text-xs font-bold text-[#40527A] uppercase tracking-wide">Delivery & Terms</h2>
            <DetailInfoField
              layout="inline"
              icon={<Truck className="w-3.5 h-3.5 text-[#BFC7D5] mt-0.5 shrink-0" />}
              label="Warehouse"
              value={po.warehouse || '—'}
            />
            <DetailInfoField
              layout="inline"
              icon={<MapPin className="w-3.5 h-3.5 text-[#BFC7D5] mt-0.5 shrink-0" />}
              label="Delivery Address"
              value={po.delivery_address || '—'}
            />
            <DetailInfoField
              layout="inline"
              icon={<CreditCard className="w-3.5 h-3.5 text-[#BFC7D5] mt-0.5 shrink-0" />}
              label="Payment Terms"
              value={po.payment_terms || '—'}
            />
            <DetailInfoField
              layout="inline"
              icon={<ClipboardList className="w-3.5 h-3.5 text-[#BFC7D5] mt-0.5 shrink-0" />}
              label="Packing"
              value={po.packing || '—'}
            />
            {po.remarks && (
              <DetailInfoField
                layout="inline"
                icon={<FileText className="w-3.5 h-3.5 text-[#BFC7D5] mt-0.5 shrink-0" />}
                label="Remarks"
                value={po.remarks}
              />
            )}
          </div>

          {/* Grand total card */}
          <div className="bg-[#1E4BFF] rounded-[4px] p-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-200">Grand Total</p>
                <p className="text-3xl font-bold mt-1">
                  ₱{grandTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-blue-200 mt-1">
                  {po.items.length} line item{po.items.length !== 1 ? 's' : ''} · {po.supplier_name_snapshot}
                </p>
              </div>
              <DollarSign className="w-10 h-10 text-blue-400" />
            </div>
          </div>

          {/* Items table */}
          <DetailTableCard
            title={
              <div className="flex items-center gap-2">
                <Package className="w-3.5 h-3.5 text-[#BFC7D5]" />
                <h2 className="text-xs font-semibold text-[#40527A] uppercase tracking-wide">
                  Items ({po.items.length})
                </h2>
              </div>
            }
            headerClassName="bg-[#F7F9FC]"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#D8E2FF] bg-[#F7F9FC]">
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-[#40527A] uppercase w-8">#</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#40527A] uppercase w-20">Code</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#40527A] uppercase">Description</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-[#40527A] uppercase w-14">Unit</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-[#40527A] uppercase w-16">Qty</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-[#40527A] uppercase w-24">Unit Price</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-[#40527A] uppercase w-24">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D8E2FF]">
                  {po.items.map(item => (
                    <tr key={item.id} className="hover:bg-[#F7F9FC]">
                      <td className="px-4 py-3 text-center text-xs text-[#BFC7D5] font-mono">{item.item_order}</td>
                      <td className="px-4 py-3 font-mono text-xs text-[#40527A]">{item.item_code || '—'}</td>
                      <td className="px-4 py-3 text-[#0F1F3A] font-medium">{item.description}</td>
                      <td className="px-4 py-3 text-center text-[#40527A] text-xs">{item.unit_of_measure}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-[#0F1F3A]">{item.quantity_to_purchase}</td>
                      <td className="px-4 py-3 text-right text-xs text-[#40527A]">
                        ₱{item.unit_price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-[#0F1F3A]">
                        ₱{(item.unit_price * item.quantity_to_purchase).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </td>
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
          </DetailTableCard>

          {/* Submit error */}
          {submitError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-[4px] px-4 py-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Status note for draft without active approval */}
          {po.status === 'draft' && !approvalDetail && profile?.position === 'Buyer' && (
            <div className="bg-amber-50 border border-amber-200 rounded-[4px] px-5 py-4 text-sm text-amber-800">
              <p className="font-semibold">Ready for Approval</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Click "Submit for Approval" above to start the Buyer → Procurement Manager → Finance Director chain.
              </p>
            </div>
          )}
        </div>

        {/* Right column: Approval Timeline */}
        <div className="lg:col-span-1 order-2 lg:order-none">
          <div className="lg:sticky lg:top-20">
            {approvalDetail ? (
              <ApprovalTimeline approvalDetail={approvalDetail} />
            ) : (
              <div className="bg-white rounded-[4px] border border-[#D8E2FF] p-5">
                <p className="text-sm text-[#BFC7D5]">Approval chain will appear once submitted for approval.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function ApprovalTimeline({ approvalDetail }: { approvalDetail: POApprovalDetail }) {
  const internalSteps = approvalDetail.steps.filter(s => s.step_order <= 3);
  const internalActions = approvalDetail.actions.filter(a => a.step_order <= 3);

  return (
    <div className="bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#D8E2FF] bg-[#F7F9FC] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-3.5 h-3.5 text-[#BFC7D5]" />
          <h3 className="text-xs font-semibold text-[#40527A] uppercase tracking-wide">Approval Chain</h3>
        </div>
        {approvalDetail.instance_status === 'active' && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            In Progress
          </span>
        )}
        {approvalDetail.instance_status === 'approved' && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
            <CheckCircle2 className="w-3 h-3" /> Approved
          </span>
        )}
      </div>
      <div className="p-5">
        <ol className="space-y-0">
          {internalSteps.map((step, idx) => {
            const action = internalActions.find(a => a.step_order === step.step_order);
            const isComplete = !!action;
            const isCurrent = !isComplete && step.step_order === approvalDetail.current_step && approvalDetail.instance_status === 'active';

            return (
              <li key={step.step_order} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 ${
                    isComplete
                      ? action!.action === 'approved' ? 'bg-emerald-600 border-emerald-600'
                      : action!.action === 'rejected' ? 'bg-red-600 border-red-600'
                      : 'bg-orange-500 border-orange-500'
                      : isCurrent ? 'bg-amber-50 border-amber-400'
                      : 'bg-[#F7F9FC] border-[#D8E2FF]'
                  }`}>
                    {isComplete ? (
                      action!.action === 'approved' ? <CheckCircle2 className="w-3 h-3 text-white" />
                      : action!.action === 'rejected' ? <XCircle className="w-3 h-3 text-white" />
                      : <RotateCcw className="w-3 h-3 text-white" />
                    ) : isCurrent ? (
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#BFC7D5]" />
                    )}
                  </div>
                  {idx < internalSteps.length - 1 && (
                    <div className={`w-0.5 flex-1 my-1 min-h-[20px] ${isComplete ? 'bg-emerald-200' : 'bg-[#D8E2FF]'}`} />
                  )}
                </div>
                <div className="pb-4 flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#0F1F3A]">Step {step.step_order}: {step.position_required}</p>
                  {isComplete ? (
                    <div className="mt-0.5">
                      <span className="text-xs text-[#40527A]">{action!.actor_name_snapshot} · {format(new Date(action!.acted_at), 'MMM d, h:mm a')}</span>
                    </div>
                  ) : isCurrent ? (
                    <p className="text-xs text-amber-600 mt-0.5">Awaiting action</p>
                  ) : (
                    <p className="text-xs text-[#BFC7D5] mt-0.5">Pending</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        {approvalDetail.instance_id && (
          <Link
            href={`/approvals/po/${approvalDetail.instance_id}`}
            className="inline-flex items-center gap-1.5 text-xs text-[#1E4BFF] hover:text-[#0F1F3A] font-medium mt-2 transition"
          >
            View full approval detail
          </Link>
        )}
      </div>
    </div>
  );
}
