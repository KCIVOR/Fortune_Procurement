'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useBackNavigation } from '@/hooks/use-back-navigation';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import { useAuth } from '@/context/AuthContext';
import { fetchGRNById, saveGRNProgress, closeGRN } from '@/lib/grn';
import type { GRNWithItems, GRNFormValues, GRNItemDraft } from '@/types/grn';
import { format } from 'date-fns';
import { PackageCheck, Building2, Package, CalendarDays, FileText, Save, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, User, MapPin, Hash, Receipt } from 'lucide-react';
import RelatedRecords from '@/components/shared/RelatedRecords';
import DetailBackButton from '@/components/shared/DetailBackButton';
import DetailHeaderLayout from '@/components/shared/DetailHeaderLayout';
import DetailTitleRow from '@/components/shared/DetailTitleRow';
import DetailPrintButton from '@/components/shared/DetailPrintButton';
import DetailTableCard from '@/components/shared/DetailTableCard';
import DetailInfoField from '@/components/shared/DetailInfoField';
import { FormFieldLabel } from '@/components/shared/FormFieldLabel';

export default function GRNDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const router = useRouter();
  const { handleBack } = useBackNavigation();

  const [grn, setGRN]         = useState<GRNWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const [form, setForm] = useState<GRNFormValues>({
    invoice_no:       '',
    dr_no:            '',
    dr_date:          '',
    transaction_date: '',
    remarks:          '',
    items:            [],
  });

  const [saving, setSaving]   = useState(false);
  const [closing, setClosing] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [formError, setFormError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const isWarehouse = profile?.role === 'warehouse';
  const isReadOnly  = grn?.status === 'closed' || !isWarehouse;

  const load = useCallback(() => {
    if (!id) return;
    fetchGRNById(id)
      .then(g => {
        if (!g) { setError('GRN not found.'); return; }
        setGRN(g);
        setForm({
          invoice_no:       g.invoice_no,
          dr_no:            g.dr_no,
          dr_date:          g.dr_date ?? '',
          transaction_date: g.transaction_date,
          remarks:          g.remarks,
          items: g.items.map(i => ({
            id:                i.id,
            po_item_id:        i.po_item_id,
            item_order:        i.item_order,
            item_code:         i.item_code,
            description:       i.description,
            unit_of_measure:   i.unit_of_measure,
            quantity_ordered:  i.quantity_ordered,
            quantity_received: i.quantity_received,
            quantity_rejected: i.quantity_rejected,
            unit_price:        i.unit_price,
            remarks:           i.remarks,
          } as GRNItemDraft)),
        });
      })
      .catch(() => setError('Failed to load GRN.'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const setItemField = useCallback((idx: number, field: keyof GRNItemDraft, value: any) => {
    setForm(f => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...f, items };
    });
  }, []);

  const handleSave = async () => {
    if (!grn) return;
    setSaving(true);
    setSaveMsg('');
    setFormError('');
    try {
      await saveGRNProgress(grn.id, form);
      setSaveMsg('Progress saved.');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (e: any) {
      setFormError(e.message ?? 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = async () => {
    if (!grn || !profile) return;
    setClosing(true);
    setFormError('');
    try {
      await closeGRN(grn.id, grn.delivery_id, form, profile);
      setShowConfirm(false);
      load();
    } catch (e: any) {
      setFormError(e.message ?? 'Failed to close GRN.');
    } finally {
      setClosing(false);
    }
  };

  if (loading) return (
    <AppShell title="GRN">
      <div className="flex items-center justify-center h-64">
        <LoadingState message="Loading GRN..." />
      </div>
    </AppShell>
  );

  if (error || !grn) return (
    <AppShell title="GRN">
      <div className="bg-red-50 border border-red-200 rounded-[4px] p-4 text-sm text-red-700">
        {error || 'GRN not found.'}
      </div>
    </AppShell>
  );

  const isClosed = grn.status === 'closed';
  const receivedTotal = form.items.reduce(
    (s, i) => s + (Number(i.quantity_received) || 0) * i.unit_price, 0
  );

  return (
    <AppShell title={`GRN ${grn.grn_number}`}>
      <DetailBackButton className="mb-2" onClick={() => handleBack({ role: profile?.role })} />

      {/* Header */}
      <DetailHeaderLayout
        wrap={true}
        left={
          <div>
            <DetailTitleRow wrap mb>
              <h1 className="text-xl font-bold text-[#0F1F3A] font-mono">{grn.grn_number}</h1>
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold border rounded-full px-3 py-1 ${
                isClosed
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {isClosed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Receipt className="w-3.5 h-3.5" />}
                {isClosed ? 'Closed' : 'Open'}
              </span>
            </DetailTitleRow>
            <p className="text-sm text-[#40527A]">{grn.department_name_snapshot} · {grn.purpose}</p>
            <div className="flex items-center gap-3 mt-1 text-xs text-[#BFC7D5] flex-wrap">
              <span className="font-mono">PO: {grn.po_number_snapshot}</span>
              <span className="font-mono">PR1: {grn.pr1_number_snapshot}</span>
            </div>
          </div>
        }
        right={
          <div className="flex items-center gap-2">
            <DetailPrintButton
              href={`/grn/${grn.id}/print`}
              label="Print GRN"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#D8E2FF] text-[#0F1F3A] text-sm font-semibold rounded-[4px] hover:border-[#0F1F3A] transition"
            />
          </div>
        }
      />

      {/* Related Records */}
      {profile && (
        <div className="mb-6">
          <RelatedRecords baseType="GRN" baseId={grn.id} role={profile.role} currentDocType="GRN" />
        </div>
      )}

      {/* Closed banner */}
      {isClosed && (
        <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-[4px] px-5 py-4 mb-6">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">Transaction Closed</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              Received by {grn.received_by_name_snapshot}
              {grn.closed_at ? ` on ${format(new Date(grn.closed_at), 'MMMM d, yyyy h:mm a')}` : ''}.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left sidebar */}
        <div className="space-y-4">
          {/* Supplier info */}
          <div className="bg-white rounded-[4px] border border-[#D8E2FF] p-5 space-y-4">
            <h2 className="text-xs font-bold text-[#40527A] uppercase tracking-wide">Supplier</h2>
            <DetailInfoField
              layout="inline"
              icon={<Building2 className="w-3.5 h-3.5 text-[#BFC7D5] mt-0.5 shrink-0" />}
              label="Supplier"
              value={grn.supplier_name_snapshot}
            />
            <DetailInfoField
              layout="inline"
              icon={<Package className="w-3.5 h-3.5 text-[#BFC7D5] mt-0.5 shrink-0" />}
              label="Deliver To"
              value={grn.warehouse}
            />
            <DetailInfoField
              layout="inline"
              icon={<MapPin className="w-3.5 h-3.5 text-[#BFC7D5] mt-0.5 shrink-0" />}
              label="Address"
              value={grn.delivery_address}
            />
            <DetailInfoField
              layout="inline"
              icon={<User className="w-3.5 h-3.5 text-[#BFC7D5] mt-0.5 shrink-0" />}
              label="Received By"
              value={grn.received_by_name_snapshot || '—'}
            />
          </div>

          {/* Header fields */}
          <div className="bg-white rounded-[4px] border border-[#D8E2FF] p-5 space-y-4">
            <h2 className="text-xs font-bold text-[#40527A] uppercase tracking-wide">Document Details</h2>

            <Field label="Invoice No." required={!isClosed}>
              <input
                type="text"
                value={form.invoice_no}
                onChange={e => setForm(f => ({ ...f, invoice_no: e.target.value }))}
                disabled={isReadOnly}
                placeholder={`INV-${new Date().getFullYear()}-0001`}
                className="w-full px-3 py-2 border border-[#D8E2FF] rounded-[4px] text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] disabled:bg-[#F7F9FC] disabled:text-[#40527A]"
              />
            </Field>

            <Field label="DR No.">
              <input
                type="text"
                value={form.dr_no}
                onChange={e => setForm(f => ({ ...f, dr_no: e.target.value }))}
                disabled={isReadOnly}
                placeholder={`DR-${new Date().getFullYear()}-0001`}
                className="w-full px-3 py-2 border border-[#D8E2FF] rounded-[4px] text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] disabled:bg-[#F7F9FC] disabled:text-[#40527A]"
              />
            </Field>

            <Field label="DR Date">
              <input
                type="date"
                value={form.dr_date}
                onChange={e => setForm(f => ({ ...f, dr_date: e.target.value }))}
                disabled={isReadOnly}
                className="w-full px-3 py-2 border border-[#D8E2FF] rounded-[4px] text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] disabled:bg-[#F7F9FC] disabled:text-[#40527A]"
              />
            </Field>

            <Field label="Transaction Date" required={!isClosed}>
              <input
                type="date"
                value={form.transaction_date}
                onChange={e => setForm(f => ({ ...f, transaction_date: e.target.value }))}
                disabled={isReadOnly}
                className="w-full px-3 py-2 border border-[#D8E2FF] rounded-[4px] text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] disabled:bg-[#F7F9FC] disabled:text-[#40527A]"
              />
            </Field>

            <Field label="Remarks">
              <textarea
                rows={3}
                value={form.remarks}
                onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                disabled={isReadOnly}
                placeholder="General notes..."
                className="w-full px-3 py-2 border border-[#D8E2FF] rounded-[4px] text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] resize-none disabled:bg-[#F7F9FC] disabled:text-[#40527A]"
              />
            </Field>
          </div>
        </div>

        {/* Main content — items */}
        <div className="lg:col-span-3 space-y-4">
          {/* Items table */}
          <DetailTableCard
            title={
              <div className="flex items-center gap-2">
                <Package className="w-3.5 h-3.5 text-[#BFC7D5]" />
                <h2 className="text-xs font-semibold text-[#40527A] uppercase tracking-wide">
                  Items ({form.items.length})
                </h2>
              </div>
            }
            right={
              <div className="text-xs font-semibold text-[#0F1F3A]">
                Total Received: ₱{receivedTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </div>
            }
            headerClassName="bg-[#F7F9FC] px-5"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#D8E2FF] bg-[#F7F9FC]">
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-[#40527A] uppercase w-8">#</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#40527A] uppercase">Description</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-[#40527A] uppercase w-14">Unit</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-[#40527A] uppercase w-20">Ordered</th>
                    <th className={`text-right px-3 py-2.5 text-xs font-semibold uppercase w-24 ${isReadOnly ? 'text-[#40527A]' : 'text-blue-600'}`}>
                      Received
                    </th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-[#40527A] uppercase w-20">Rejected</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-[#40527A] uppercase w-24">Unit Price</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-[#40527A] uppercase w-28">Amount</th>
                    {!isReadOnly && <th className="px-3 py-2.5 w-32 text-xs font-semibold text-[#40527A] uppercase">Remarks</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D8E2FF]">
                  {form.items.map((item, idx) => {
                    const received = Number(item.quantity_received) || 0;
                    const rejected = Number(item.quantity_rejected) || 0;
                    const amount   = received * item.unit_price;
                    const isShort  = received < item.quantity_ordered;

                    return (
                      <tr key={item.id} className={`${isShort && received >= 0 ? 'bg-amber-50/30' : ''} hover:bg-[#F7F9FC]`}>
                        <td className="px-3 py-3 text-center text-xs text-[#BFC7D5] font-mono">{item.item_order}</td>
                        <td className="px-3 py-3">
                          <p className="text-[#0F1F3A] font-medium">{item.description}</p>
                          {item.item_code && <p className="text-xs text-[#BFC7D5] font-mono">{item.item_code}</p>}
                        </td>
                        <td className="px-3 py-3 text-center text-xs text-[#40527A]">{item.unit_of_measure}</td>
                        <td className="px-3 py-3 text-right text-xs text-[#40527A] font-mono">{item.quantity_ordered}</td>
                        <td className="px-3 py-3 text-right">
                          {isReadOnly ? (
                            <span className={`font-mono font-semibold text-sm ${isShort ? 'text-amber-700' : 'text-[#0F1F3A]'}`}>
                              {received}
                            </span>
                          ) : (
                            <input
                              type="number"
                              min="0"
                              max={item.quantity_ordered}
                              step="0.0001"
                              value={item.quantity_received}
                              onChange={e => setItemField(idx, 'quantity_received', e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-20 px-2 py-1 border border-[#D8E2FF] rounded text-right text-sm font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] bg-[#F7F9FC]"
                            />
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {isReadOnly ? (
                            <span className={`font-mono text-xs ${rejected > 0 ? 'text-red-600 font-semibold' : 'text-[#BFC7D5]'}`}>
                              {rejected || '—'}
                            </span>
                          ) : (
                            <input
                              type="number"
                              min="0"
                              step="0.0001"
                              value={item.quantity_rejected}
                              onChange={e => setItemField(idx, 'quantity_rejected', e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-20 px-2 py-1 border border-[#D8E2FF] rounded text-right text-xs font-mono focus:outline-none focus:ring-2 focus:ring-red-300"
                            />
                          )}
                        </td>
                        <td className="px-3 py-3 text-right text-xs text-[#40527A] font-mono">
                          ₱{item.unit_price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-sm font-semibold text-[#0F1F3A]">
                          ₱{amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </td>
                        {!isReadOnly && (
                          <td className="px-3 py-3">
                            <input
                              type="text"
                              value={item.remarks}
                              onChange={e => setItemField(idx, 'remarks', e.target.value)}
                              placeholder="Note..."
                              className="w-full px-2 py-1 border border-[#D8E2FF] rounded text-xs focus:outline-none focus:ring-2 focus:ring-[#1E4BFF]"
                            />
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-[#F7F9FC] border-t-2 border-[#D8E2FF]">
                    <td colSpan={isReadOnly ? 7 : 8} className="px-3 py-3 text-right text-xs font-semibold text-[#0F1F3A]">
                      Total Received Value
                    </td>
                    <td className="px-3 py-3 text-right text-sm font-bold text-[#0F1F3A] font-mono">
                      ₱{receivedTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </DetailTableCard>

          {/* Actions */}
          {!isReadOnly && (
            <div className="bg-white rounded-[4px] border border-[#D8E2FF] p-5">
              {formError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-[4px] px-4 py-3 mb-4">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  {formError}
                </div>
              )}
              {saveMsg && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-[4px] px-4 py-3 mb-4">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {saveMsg}
                </div>
              )}

              {!showConfirm ? (
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-xs text-[#40527A]">
                    Save progress to update item quantities, or close the GRN to finalize the transaction.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleSave}
                      disabled={saving || closing}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#D8E2FF] text-[#0F1F3A] text-sm font-semibold rounded-[4px] hover:border-[#0F1F3A] transition disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? 'Saving...' : 'Save Progress'}
                    </button>
                    <button
                      onClick={() => setShowConfirm(true)}
                      disabled={saving || closing || !form.invoice_no.trim() || !form.transaction_date}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-[4px] transition disabled:opacity-50"
                    >
                      <PackageCheck className="w-4 h-4" />
                      Close GRN
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-[4px] p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-amber-900">Close this GRN?</p>
                      <p className="text-xs text-amber-700 mt-1">
                        This will finalize the goods receipt and close the transaction. You cannot edit the GRN after closing.
                        Invoice No: <strong>{form.invoice_no}</strong> · Total: <strong>₱{receivedTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setShowConfirm(false)}
                      disabled={closing}
                      className="px-4 py-2 bg-white border border-[#D8E2FF] text-[#0F1F3A] text-sm font-semibold rounded-[4px] hover:border-[#0F1F3A] transition disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleClose}
                      disabled={closing}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-[4px] transition disabled:opacity-50"
                    >
                      <PackageCheck className="w-4 h-4" />
                      {closing ? 'Closing...' : 'Confirm Close'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <FormFieldLabel label={label} required={required} className="block" />
      {children}
    </div>
  );
}
