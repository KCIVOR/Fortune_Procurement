'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import { useAuth } from '@/context/AuthContext';
import { fetchPOApprovalDetailByPOId, acknowledgeSupplierPO } from '@/lib/po-approvals';
import { calcPOVatBreakdown } from '@/lib/po';
import type { POApprovalDetail } from '@/types/po';
import { format } from 'date-fns';
import RawMaterialBadge from '@/components/shared/RawMaterialBadge';
import {
  ChevronLeft, User, Building2, FileText, CalendarDays,
  Package, Truck, CreditCard, MapPin, CircleCheck as CheckCircle2,
  Send, TriangleAlert as AlertTriangle,
} from 'lucide-react';

export default function SupplierPODetailPage() {
  const { id: poId } = useParams<{ id: string }>();
  const { profile } = useAuth();

  const [detail, setDetail]               = useState<POApprovalDetail | null>(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');
  const [commitmentDate, setCommitmentDate] = useState('');
  const [deliveryRemarks, setDeliveryRemarks] = useState('');
  const [submitting, setSubmitting]       = useState(false);
  const [submitError, setSubmitError]     = useState('');

  const load = () => {
    if (!poId) return;
    fetchPOApprovalDetailByPOId(poId)
      .then(d => {
        if (!d) { setError('Purchase order not found or not yet approved.'); return; }
        setDetail(d);
        if (d.receipt) {
          setCommitmentDate(d.receipt.commitment_date ?? '');
          setDeliveryRemarks(d.receipt.delivery_remarks ?? '');
        }
      })
      .catch(() => setError('Failed to load purchase order.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [poId]);

  const handleAcknowledge = async () => {
    if (!detail || !profile) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await acknowledgeSupplierPO(detail.po_id, commitmentDate, deliveryRemarks, profile);
      load();
    } catch (err: any) {
      setSubmitError(err.message ?? 'Failed to acknowledge PO.');
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

  if (error || !detail) return (
    <AppShell title="Purchase Order">
      <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">
        {error || 'Purchase order not found.'}
      </div>
    </AppShell>
  );

  const isAcknowledged = !!detail.receipt;
  const canAcknowledge = detail.po_status === 'approved';
  const vatBreakdown   = calcPOVatBreakdown(detail.items);

  return (
    <AppShell title={`PO ${detail.po_number}`}>
      <div className="mb-2">
        <Link href="/supplier/po" className="inline-flex items-center gap-1 text-xs text-pq-neutral-500 hover:text-pq-neutral-900 transition">
          <ChevronLeft className="w-3.5 h-3.5" />
          Back to Purchase Orders
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h1 className="text-xl font-bold text-pq-neutral-900 font-mono">{detail.po_number}</h1>
            <span className={`inline-flex items-center text-xs font-semibold border rounded-full px-2.5 py-1 ${
              detail.po_status === 'sent'     ? 'bg-pq-neutral-50 text-pq-neutral-900 border-pq-neutral-200' :
              detail.po_status === 'approved' ? 'bg-pq-success-100 text-pq-success-600 border-pq-success-100' :
              'bg-pq-neutral-50 text-pq-neutral-500 border-pq-neutral-200'
            }`}>
              {detail.po_status === 'approved' ? 'Awaiting Acknowledgment' :
               detail.po_status === 'sent'     ? 'Acknowledged' :
               detail.po_status}
            </span>
          </div>
          <p className="text-sm text-pq-neutral-500">{detail.department_name_snapshot} · {detail.purpose}</p>
          <p className="text-xs text-pq-neutral-400 mt-0.5">
            PR2 Ref: <span className="font-mono">{detail.pr2_number_snapshot}</span>
            {' '}· PR1 Ref: <span className="font-mono">{detail.pr1_number_snapshot}</span>
          </p>
        </div>
      </div>

      {/* Already acknowledged banner */}
      {isAcknowledged && (
        <div className="flex items-start gap-3 bg-pq-success-100 border border-pq-success-100 rounded-md px-5 py-4 mb-6">
          <CheckCircle2 className="w-4 h-4 text-pq-success-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-pq-success-600">PO Acknowledged</p>
            <p className="text-xs text-pq-success-600 mt-0.5">
              Acknowledged by {detail.receipt!.acknowledged_by_name} on {format(new Date(detail.receipt!.acknowledged_at), 'MMMM d, yyyy h:mm a')}.
              {detail.receipt!.commitment_date && ` Committed delivery: ${format(new Date(detail.receipt!.commitment_date), 'MMMM d, yyyy')}.`}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar: PO info */}
        <div className="space-y-4">
          <div className="bg-white rounded-md border border-pq-neutral-200 p-5 space-y-4">
            <h2 className="text-xs font-bold text-pq-neutral-500 uppercase tracking-wide">PO Details</h2>
            <InfoField icon={FileText}     label="PO Number"      value={detail.po_number} mono />
            <InfoField icon={User}         label="Requisitioner"  value={detail.requisitioner_name_snapshot} />
            <InfoField icon={Building2}    label="Department"     value={detail.department_name_snapshot} />
            <InfoField icon={CalendarDays} label="PO Date"        value={format(new Date(detail.po_date), 'MMMM d, yyyy')} />
            <InfoField icon={CalendarDays} label="Date Required"  value={format(new Date(detail.date_required), 'MMMM d, yyyy')} />
          </div>

          <div className="bg-white rounded-md border border-pq-neutral-200 p-5 space-y-4">
            <h2 className="text-xs font-bold text-pq-neutral-500 uppercase tracking-wide">Delivery & Terms</h2>
            <InfoField icon={Truck}      label="Deliver To"     value={detail.warehouse} />
            <InfoField icon={MapPin}     label="Address"        value={detail.delivery_address} />
            <InfoField icon={CreditCard} label="Payment Terms"  value={detail.payment_terms} />
            <InfoField icon={FileText}   label="Packing"        value={detail.packing} />
            {detail.remarks && (
              <div>
                <p className="text-xs font-semibold text-pq-neutral-400 uppercase tracking-wide mb-0.5">Remarks</p>
                <p className="text-sm text-pq-neutral-900">{detail.remarks}</p>
              </div>
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="lg:col-span-3 space-y-4">

          {/* Items table */}
          <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-pq-neutral-200 bg-pq-neutral-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-3.5 h-3.5 text-pq-neutral-400" />
                <h2 className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Items ({detail.items.length})</h2>
              </div>
              <div className="flex items-center gap-3 text-xs font-semibold text-pq-neutral-900">
                {vatBreakdown.vatAmount > 0 && (
                  <>
                    <span className="text-pq-neutral-500 font-normal">Subtotal: ₱{vatBreakdown.subtotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                    <span className="text-pq-neutral-500 font-normal">VAT: ₱{vatBreakdown.vatAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                  </>
                )}
                <span>Total: ₱{vatBreakdown.total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-pq-neutral-200 bg-pq-neutral-50">
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-8">#</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase">Description</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-16">Unit</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-16">Qty</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-28">Unit Price</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-28">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pq-neutral-200">
                  {detail.items.map(item => (
                    <tr key={item.id} className="hover:bg-pq-neutral-50/50">
                      <td className="px-4 py-3 text-center text-xs text-pq-neutral-400 font-mono">{item.item_order}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-pq-neutral-900 font-medium">{item.description}</p>
                          <RawMaterialBadge isRawMaterial={item.is_raw_material} size="sm" />
                        </div>
                        {item.item_code && <p className="text-xs text-pq-neutral-400 font-mono">{item.item_code}</p>}
                      </td>
                      <td className="px-4 py-3 text-center text-pq-neutral-500 text-xs">{item.unit_of_measure}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-pq-neutral-900">{item.quantity_to_purchase}</td>
                      <td className="px-4 py-3 text-right text-xs text-pq-neutral-500">₱{item.unit_price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-pq-neutral-900">₱{item.total_price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {vatBreakdown.vatAmount > 0 && (
                    <>
                      <tr className="bg-pq-neutral-50 border-t-2 border-pq-neutral-200">
                        <td colSpan={5} className="px-4 py-3 text-right text-xs text-pq-neutral-500">Subtotal</td>
                        <td className="px-4 py-3 text-right text-sm text-pq-neutral-500">₱{vatBreakdown.subtotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                      </tr>
                      <tr className="bg-pq-neutral-50">
                        <td colSpan={5} className="px-4 py-3 text-right text-xs text-pq-neutral-500">VAT</td>
                        <td className="px-4 py-3 text-right text-sm text-pq-neutral-500">₱{vatBreakdown.vatAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    </>
                  )}
                  <tr className="bg-pq-neutral-50 border-t-2 border-pq-neutral-200">
                    <td colSpan={5} className="px-4 py-3 text-right text-xs font-semibold text-pq-neutral-500">Grand Total</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-pq-neutral-900">
                      ₱{vatBreakdown.total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Acknowledgment form */}
          {canAcknowledge && (
            <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
              <div className={`px-6 py-4 border-b border-pq-neutral-200 ${isAcknowledged ? 'bg-pq-success-100' : 'bg-pq-warning-100'}`}>
                <h2 className={`text-xs font-semibold uppercase tracking-wide ${isAcknowledged ? 'text-pq-success-600' : 'text-pq-warning-600'}`}>
                  {isAcknowledged ? 'Update Acknowledgment' : 'Acknowledge This Purchase Order'}
                </h2>
                <p className={`text-xs mt-0.5 ${isAcknowledged ? 'text-pq-success-600' : 'text-pq-warning-600'}`}>
                  {isAcknowledged
                    ? 'You can update your commitment date or delivery notes below.'
                    : 'Confirm receipt of this PO and provide your expected delivery date.'}
                </p>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
                      Commitment Date <span className="text-pq-neutral-400 font-normal normal-case">(optional)</span>
                    </label>
                    <input
                      type="date"
                      value={commitmentDate}
                      onChange={e => setCommitmentDate(e.target.value)}
                      disabled={submitting}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] focus:border-transparent transition disabled:opacity-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
                    Delivery Remarks <span className="text-pq-neutral-400 font-normal normal-case">(optional)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={deliveryRemarks}
                    onChange={e => setDeliveryRemarks(e.target.value)}
                    disabled={submitting}
                    placeholder="Shipping method, partial delivery notes, special handling instructions..."
                    className="w-full px-3 py-2 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] resize-none disabled:opacity-50"
                  />
                </div>

                {submitError && (
                  <div className="flex items-start gap-2 bg-pq-danger-100 border border-pq-danger-100 text-pq-danger-600 text-sm rounded-md px-4 py-3">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-pq-neutral-200">
                  <p className="text-xs text-pq-neutral-500">
                    {isAcknowledged
                      ? 'Updating will overwrite your previous acknowledgment.'
                      : 'Acknowledging this PO confirms you have received it and will fulfill the order.'}
                  </p>
                  <button
                    onClick={handleAcknowledge}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-sm font-semibold rounded-md transition disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    {submitting ? 'Saving...' : isAcknowledged ? 'Update Acknowledgment' : 'Acknowledge PO'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Sent state: no more action needed */}
          {detail.po_status === 'sent' && !canAcknowledge && (
            <div className="flex items-start gap-3 bg-pq-neutral-50 border border-pq-neutral-200 rounded-md px-5 py-4">
              <CheckCircle2 className="w-4 h-4 text-pq-neutral-500 mt-0.5 shrink-0" />
              <p className="text-sm text-pq-neutral-500">This PO has been fully processed. No further action is required.</p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function InfoField({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-3.5 h-3.5 text-pq-neutral-400 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-pq-neutral-400 uppercase tracking-wide font-semibold">{label}</p>
        <p className={`text-sm text-pq-neutral-900 mt-0.5 ${mono ? 'font-mono font-semibold' : 'font-medium'}`}>
          {value}
        </p>
      </div>
    </div>
  );
}
