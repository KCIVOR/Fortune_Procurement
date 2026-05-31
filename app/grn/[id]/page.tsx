'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useBackNavigation } from '@/hooks/use-back-navigation';
import AppShell from '@/components/layout/AppShell';
import { DetailPageSkeleton } from '@/components/shared/structural-skeletons';
import { useAuth } from '@/context/AuthContext';
import { fetchGRNById, saveGRNProgress, closeGRN } from '@/lib/grn';
import type { GRNWithItems, GRNFormValues, GRNItemDraft } from '@/types/grn';
import { format } from 'date-fns';
import RawMaterialBadge from '@/components/shared/RawMaterialBadge';
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

  // DR No. prefix pattern (matches PR1/PO pattern)
  const currentYear = new Date().getFullYear();
  const drPrefix = `DR-${currentYear}-`;

  // Helper to extract suffix from full DR number
  const getDRSuffix = (fullValue: string): string => {
    if (!fullValue) return '';
    // Remove prefix if present
    if (fullValue.startsWith(drPrefix)) {
      return fullValue.slice(drPrefix.length);
    }
    // Handle different year prefix
    const match = fullValue.match(/^DR-\d{4}-(.*)$/i);
    if (match) return match[1];
    return fullValue;
  };

  // Helper to set DR number with prefix
  const setDRNumber = (suffix: string) => {
    const cleanSuffix = suffix.replace(/^DR-\d{4}-/i, '');
    setForm(f => ({ ...f, dr_no: drPrefix + cleanSuffix }));
  };

  const load = useCallback(() => {
    if (!id) return;
    fetchGRNById(id)
      .then(g => {
        if (!g) { setError('GRN not found.'); return; }
        setGRN(g);
        setForm({
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
            // Phase 9 (Raw Mats): forward the snapshot through the form draft.
            is_raw_material:   i.is_raw_material === true,
            quote_justification: i.quote_justification ?? null,
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
      <DetailPageSkeleton />
    </AppShell>
  );

  if (error || !grn) return (
    <AppShell title="GRN">
      <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">
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
              <h1 className="text-xl font-bold text-pq-neutral-900 font-mono">{grn.grn_number}</h1>
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold border rounded-full px-3 py-1 ${
                isClosed
                  ? 'bg-pq-success-100 text-pq-success-600 border-pq-success-100'
                  : 'bg-pq-warning-100 text-pq-warning-600 border-pq-warning-100'
              }`}>
                {isClosed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Receipt className="w-3.5 h-3.5" />}
                {isClosed ? 'Closed' : 'Open'}
              </span>
            </DetailTitleRow>
            <p className="text-sm text-pq-neutral-500">{grn.department_name_snapshot} · {grn.purpose}</p>
            <div className="flex items-center gap-3 mt-1 text-xs text-pq-neutral-400 flex-wrap">
              <span className="font-mono">PO Ref: {grn.po_number_snapshot}</span>
              <span className="font-mono">PR1 Ref: {grn.pr1_number_snapshot}</span>
            </div>
          </div>
        }
        right={
          <div className="flex items-center gap-2">
            <DetailPrintButton
              href={`/grn/${grn.id}/print`}
              label="Print GRN"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-pq-neutral-200 text-pq-neutral-900 text-sm font-semibold rounded-md hover:border-pq-primary-600 transition"
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
        <div className="flex items-start gap-3 bg-pq-success-100 border border-pq-success-100 rounded-md px-5 py-4 mb-6">
          <CheckCircle2 className="w-4 h-4 text-pq-success-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-pq-success-600">Transaction Closed</p>
            <p className="text-xs text-pq-success-600 mt-0.5">
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
          <div className="bg-white rounded-md border border-pq-neutral-200 p-5 space-y-4">
            <h2 className="text-xs font-bold text-pq-neutral-500 uppercase tracking-wide">Supplier</h2>
            <DetailInfoField
              layout="inline"
              icon={<Building2 className="w-3.5 h-3.5 text-pq-neutral-400 mt-0.5 shrink-0" />}
              label="Supplier"
              value={grn.supplier_name_snapshot}
            />
            <DetailInfoField
              layout="inline"
              icon={<Package className="w-3.5 h-3.5 text-pq-neutral-400 mt-0.5 shrink-0" />}
              label="Deliver To"
              value={grn.warehouse}
            />
            <DetailInfoField
              layout="inline"
              icon={<MapPin className="w-3.5 h-3.5 text-pq-neutral-400 mt-0.5 shrink-0" />}
              label="Address"
              value={grn.delivery_address}
            />
            <DetailInfoField
              layout="inline"
              icon={<User className="w-3.5 h-3.5 text-pq-neutral-400 mt-0.5 shrink-0" />}
              label="Received By"
              value={grn.received_by_name_snapshot || '—'}
            />
          </div>

          {/* Header fields */}
          <div className="bg-white rounded-md border border-pq-neutral-200 p-5 space-y-4">
            <h2 className="text-xs font-bold text-pq-neutral-500 uppercase tracking-wide">Document Details</h2>

            <Field label="DR No.">
              <div className={`flex items-center border rounded-md overflow-hidden transition ${
                isReadOnly ? 'bg-pq-neutral-50' : 'bg-white'
              } border-pq-neutral-200 focus-within:ring-2 focus-within:ring-[#1E4BFF] focus-within:border-transparent`}>
                <div className="px-3 py-2 bg-pq-neutral-50 border-r border-pq-neutral-200 text-sm font-mono text-pq-neutral-400 whitespace-nowrap pointer-events-none select-none">
                  {drPrefix}
                </div>
                <input
                  type="text"
                  value={getDRSuffix(form.dr_no)}
                  onChange={e => setDRNumber(e.target.value)}
                  disabled={isReadOnly}
                  placeholder="e.g. 001"
                  className="flex-1 px-3 py-2 border-0 text-sm font-mono focus:outline-none bg-transparent disabled:bg-pq-neutral-50 disabled:text-pq-neutral-500"
                />
              </div>
            </Field>

            <Field label="DR Date">
              <input
                type="date"
                value={form.dr_date}
                onChange={e => setForm(f => ({ ...f, dr_date: e.target.value }))}
                disabled={isReadOnly}
                className="w-full px-3 py-2 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] disabled:bg-pq-neutral-50 disabled:text-pq-neutral-500"
              />
            </Field>

            <Field label="Transaction Date" required={!isClosed}>
              <input
                type="date"
                value={form.transaction_date}
                onChange={e => setForm(f => ({ ...f, transaction_date: e.target.value }))}
                disabled={isReadOnly}
                className="w-full px-3 py-2 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] disabled:bg-pq-neutral-50 disabled:text-pq-neutral-500"
              />
            </Field>

            <Field label="Remarks">
              <textarea
                rows={3}
                value={form.remarks}
                onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                disabled={isReadOnly}
                placeholder="General notes..."
                className="w-full px-3 py-2 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] resize-none disabled:bg-pq-neutral-50 disabled:text-pq-neutral-500"
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
                <Package className="w-3.5 h-3.5 text-pq-neutral-400" />
                <h2 className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                  Items ({form.items.length})
                </h2>
              </div>
            }
            right={
              <div className="text-xs font-semibold text-pq-neutral-900">
                Total Received: ₱{receivedTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </div>
            }
            headerClassName="bg-pq-neutral-50 px-5"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-pq-neutral-200 bg-pq-neutral-50">
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-8">#</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase">Description</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-14">Unit</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-20">Ordered</th>
                    <th className={`text-right px-3 py-2.5 text-xs font-semibold uppercase w-24 ${isReadOnly ? 'text-pq-neutral-500' : 'text-pq-primary-600'}`}>
                      Received
                    </th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-20">Rejected</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-24">Unit Price</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-28">Amount</th>
                    {!isReadOnly && <th className="px-3 py-2.5 w-32 text-xs font-semibold text-pq-neutral-500 uppercase">Remarks</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-pq-neutral-200">
                  {form.items.map((item, idx) => {
                    const received = Number(item.quantity_received) || 0;
                    const rejected = Number(item.quantity_rejected) || 0;
                    const amount   = received * item.unit_price;
                    const isShort  = received < item.quantity_ordered;

                    return (
                      <tr key={item.id} className={`${isShort && received >= 0 ? 'bg-pq-warning-100/30' : ''} hover:bg-pq-neutral-50`}>
                        <td className="px-3 py-3 text-center text-xs text-pq-neutral-400 font-mono">{item.item_order}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-pq-neutral-900 font-medium">{item.description}</p>
                            <RawMaterialBadge isRawMaterial={item.is_raw_material} size="sm" />
                          </div>
                          {item.item_code && <p className="text-xs text-pq-neutral-400 font-mono">{item.item_code}</p>}
                          {item.quote_justification && (
                            <p className="text-xs text-pq-warning-700 mt-1 flex items-start gap-1">
                              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                              <span>
                                <strong>Award justification:</strong> {item.quote_justification}
                              </span>
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center text-xs text-pq-neutral-500">{item.unit_of_measure}</td>
                        <td className="px-3 py-3 text-right text-xs text-pq-neutral-500 font-mono">{item.quantity_ordered}</td>
                        <td className="px-3 py-3 text-right">
                          {isReadOnly ? (
                            <span className={`font-mono font-semibold text-sm ${isShort ? 'text-pq-warning-600' : 'text-pq-neutral-900'}`}>
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
                              className="w-20 px-2 py-1 border border-pq-neutral-200 rounded text-right text-sm font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] bg-pq-neutral-50"
                            />
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {isReadOnly ? (
                            <span className={`font-mono text-xs ${rejected > 0 ? 'text-pq-danger-600 font-semibold' : 'text-pq-neutral-400'}`}>
                              {rejected || '—'}
                            </span>
                          ) : (
                            <input
                              type="number"
                              min="0"
                              step="0.0001"
                              value={item.quantity_rejected}
                              onChange={e => setItemField(idx, 'quantity_rejected', e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-20 px-2 py-1 border border-pq-neutral-200 rounded text-right text-xs font-mono focus:outline-none focus:ring-2 focus:ring-red-300"
                            />
                          )}
                        </td>
                        <td className="px-3 py-3 text-right text-xs text-pq-neutral-500 font-mono">
                          ₱{item.unit_price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-sm font-semibold text-pq-neutral-900">
                          ₱{amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </td>
                        {!isReadOnly && (
                          <td className="px-3 py-3">
                            <input
                              type="text"
                              value={item.remarks}
                              onChange={e => setItemField(idx, 'remarks', e.target.value)}
                              placeholder="Note..."
                              className="w-full px-2 py-1 border border-pq-neutral-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-[#1E4BFF]"
                            />
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-pq-neutral-50 border-t-2 border-pq-neutral-200">
                    <td colSpan={isReadOnly ? 7 : 8} className="px-3 py-3 text-right text-xs font-semibold text-pq-neutral-900">
                      Total Received Value
                    </td>
                    <td className="px-3 py-3 text-right text-sm font-bold text-pq-neutral-900 font-mono">
                      ₱{receivedTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </DetailTableCard>

          {/* Actions */}
          {!isReadOnly && (
            <div className="bg-white rounded-md border border-pq-neutral-200 p-5">
              {formError && (
                <div className="flex items-start gap-2 bg-pq-danger-100 border border-pq-danger-100 text-pq-danger-600 text-sm rounded-md px-4 py-3 mb-4">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  {formError}
                </div>
              )}
              {saveMsg && (
                <div className="flex items-center gap-2 bg-pq-success-100 border border-pq-success-100 text-pq-success-600 text-sm rounded-md px-4 py-3 mb-4">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {saveMsg}
                </div>
              )}

              {!showConfirm ? (
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-xs text-pq-neutral-500">
                    Save progress to update item quantities, or close the GRN to finalize the transaction.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleSave}
                      disabled={saving || closing}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-pq-neutral-200 text-pq-neutral-900 text-sm font-semibold rounded-md hover:border-pq-primary-600 transition disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? 'Saving...' : 'Save Progress'}
                    </button>
                    <button
                      onClick={() => setShowConfirm(true)}
                      disabled={saving || closing || !form.transaction_date}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-pq-success-600 hover:bg-pq-success-600 text-white text-sm font-semibold rounded-md transition disabled:opacity-50"
                    >
                      <PackageCheck className="w-4 h-4" />
                      Close GRN
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-pq-warning-100 border border-pq-warning-100 rounded-md p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <AlertTriangle className="w-5 h-5 text-pq-warning-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-pq-warning-600">Close this GRN?</p>
                      <p className="text-xs text-pq-warning-600 mt-1">
                        This will finalize the goods receipt and close the transaction. You cannot edit the GRN after closing.
                        Total: <strong>₱{receivedTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setShowConfirm(false)}
                      disabled={closing}
                      className="px-4 py-2 bg-white border border-pq-neutral-200 text-pq-neutral-900 text-sm font-semibold rounded-md hover:border-pq-primary-600 transition disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleClose}
                      disabled={closing}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-pq-success-600 hover:bg-pq-success-600 text-white text-sm font-semibold rounded-md transition disabled:opacity-50"
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
