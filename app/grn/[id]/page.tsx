'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useBackNavigation } from '@/hooks/use-back-navigation';
import AppShell from '@/components/layout/AppShell';
import { DetailPageSkeleton } from '@/components/shared/structural-skeletons';
import { useAuth } from '@/context/AuthContext';
import { fetchGRNById, fetchSuggestedDRSequence, saveGRNProgress, closeGRN, reopenGRN, forwardItemToQA } from '@/lib/grn';
import type { GRNWithItems, GRNFormValues, GRNItemDraft } from '@/types/grn';
import { format } from 'date-fns';
import RawMaterialBadge from '@/components/shared/RawMaterialBadge';
import RequestorRemarks from '@/components/shared/RequestorRemarks';
import WarehouseQtyOverrideNote from '@/components/shared/WarehouseQtyOverrideNote';
import { PackageCheck, Building2, Package, CalendarDays, FileText, Save, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, User, MapPin, Hash, Receipt, RotateCcw, Send, Clock } from 'lucide-react';
import RelatedRecords from '@/components/shared/RelatedRecords';
import DetailBackButton from '@/components/shared/DetailBackButton';
import DetailHeaderLayout from '@/components/shared/DetailHeaderLayout';
import DetailTitleRow from '@/components/shared/DetailTitleRow';
import DetailPrintButton from '@/components/shared/DetailPrintButton';
import DetailTableCard from '@/components/shared/DetailTableCard';
import DetailInfoField from '@/components/shared/DetailInfoField';
import { FormFieldLabel } from '@/components/shared/FormFieldLabel';
import { canViewCommercialPricing, formatCommercialAmount } from '@/lib/price-visibility';
import { RequestTypeBadge } from '@/components/shared/RequestTypeBadge';
import QuoteAttachmentPills from '@/components/rfq/QuoteAttachmentPills';

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
    inv_no:           '',
    transaction_date: '',
    remarks:          '',
    items:            [],
  });

  const [saving, setSaving]   = useState(false);
  const [closing, setClosing] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [formError, setFormError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [suggestedDRSequence, setSuggestedDRSequence] = useState<string | null>(null);
  const [forwardingItemId, setForwardingItemId] = useState<string | null>(null);

  const handleForwardItemToQA = async (itemId: string) => {
    if (!grn) return;
    setForwardingItemId(itemId);
    setFormError('');
    try {
      await forwardItemToQA(grn.id, itemId);
      await load();
    } catch (e: any) {
      setFormError(e.message ?? 'Failed to forward item to QA.');
    } finally {
      setForwardingItemId(null);
    }
  };

  const isWarehouse = profile?.role === 'warehouse';
  const isProcurement = profile?.role === 'procurement';
  const canHandle   = grn?.request_type === 'services' ? (isWarehouse || isProcurement) : isWarehouse;
  const isClosed    = grn?.status === 'closed';
  const isPendingQA = grn?.status === 'pending_qa';
  const canReopen   = isClosed && (
    (grn?.request_type === 'services' && isProcurement) ||
    (grn?.request_type === 'goods' && (isWarehouse || isProcurement))
  );
  const isReadOnly  = isClosed || !canHandle;
  const hasPendingQAItems = form.items.some(
    (i) => (i.is_raw_material || i.requires_qa) && i.qa_status !== 'approved'
  );

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
    const cleanSuffix = suffix.replace(/^DR-\d{4}-/i, '').replace(/\D/g, '');
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
          inv_no:           g.inv_no ?? '',
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
            is_raw_material:     i.is_raw_material === true,
            quote_justification: i.quote_justification ?? null,
            pr1_remarks_snapshot: i.pr1_remarks_snapshot ?? null,
            pr1_quantity_requested_snapshot:      i.pr1_quantity_requested_snapshot ?? null,
            quantity_override_reason_snapshot:    i.quantity_override_reason_snapshot ?? null,
            quantity_overridden_by_name_snapshot: i.quantity_overridden_by_name_snapshot ?? null,
            quote_attachments:   i.quote_attachments,
            requires_qa:         i.is_raw_material === true || i.requires_qa === true,
            qa_status:           i.qa_status ?? null,
          } as GRNItemDraft)),
        });
      })
      .catch(() => setError('Failed to load GRN.'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!grn || grn.status === 'closed' || !canHandle) return;

    const yearMatch = drPrefix.match(/^DR-(\d{4})-/i);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : currentYear;
    let cancelled = false;

    fetchSuggestedDRSequence(year)
      .then((suffix) => {
        if (cancelled) return;
        setSuggestedDRSequence(suffix);
        setForm((f) => {
          if (getDRSuffix(f.dr_no).trim()) return f;
          return { ...f, dr_no: `${drPrefix}${suffix}` };
        });
      })
      .catch(() => {
        if (!cancelled) setSuggestedDRSequence(null);
      });

    return () => {
      cancelled = true;
    };
  }, [grn?.id, grn?.status, canHandle, drPrefix, currentYear]);

  const setItemField = useCallback((idx: number, field: keyof GRNItemDraft, value: any) => {
    setForm(f => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...f, items };
    });
  }, []);

  const handleSave = async () => {
    if (!grn || !profile) return;
    setSaving(true);
    setSaveMsg('');
    setFormError('');
    try {
      await saveGRNProgress(grn.id, form, profile);
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

  const handleReopen = async () => {
    if (!grn || !profile) return;
    setReopening(true);
    setFormError('');
    try {
      await reopenGRN(grn.id, profile);
      setLoading(true);
      load();
    } catch (e: any) {
      setFormError(e.message ?? 'Failed to reopen GRN.');
    } finally {
      setReopening(false);
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

  const isClosedView = grn.status === 'closed';
  const statusLabel =
    grn.status === 'closed' ? 'Closed' :
    grn.status === 'pending_qa' ? 'Pending QA' :
    'Open';
  const statusStyle =
    grn.status === 'closed'
      ? 'bg-pq-success-100 text-pq-success-600 border-pq-success-100'
      : grn.status === 'pending_qa'
        ? 'bg-sky-50 text-sky-700 border-sky-200'
        : 'bg-pq-warning-100 text-pq-warning-600 border-pq-warning-100';
  const canViewPrices = canViewCommercialPricing(profile);
  const receivedTotal = canViewPrices
    ? form.items.reduce((s, i) => s + (Number(i.quantity_received) || 0) * i.unit_price, 0)
    : null;

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
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold border rounded-full px-3 py-1 ${statusStyle}`}>
                {isClosedView ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Receipt className="w-3.5 h-3.5" />}
                {statusLabel}
              </span>
              <RequestTypeBadge type={grn.request_type ?? 'goods'} />
            </DetailTitleRow>
            <p className="text-sm text-pq-neutral-500">{grn.department_name_snapshot} · {grn.purpose}</p>
            <div className="flex items-center gap-3 mt-1 text-xs text-pq-neutral-400 flex-wrap">
              <span className="font-mono">PO Ref: {grn.po_number_snapshot}</span>
              <span className="font-mono">PR1 Ref: {grn.pr1_number_snapshot}</span>
            </div>
            {!isClosedView && grn.closed_at && (
              <p className="text-xs text-pq-warning-600 italic mt-1">
                Previously closed on {format(new Date(grn.closed_at), 'MMM d, yyyy h:mm a')} by {grn.received_by_name_snapshot} — reopened for correction.
              </p>
            )}
          </div>
        }
        right={
          <div className="flex items-center gap-2">
            {canReopen && (
              <button
                onClick={handleReopen}
                disabled={reopening}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-md transition disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
                {reopening ? 'Reopening...' : 'Reopen GRN'}
              </button>
            )}
            <DetailPrintButton
              href={`/grn/${grn.id}/print`}
              label="Print GRN"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-pq-neutral-200 text-pq-neutral-900 text-sm font-semibold rounded-md hover:border-pq-primary-600 transition"
            />
          </div>
        }
      />

      {/* Reopen error (form error banner below only renders while editable) */}
      {isClosedView && formError && (
        <div className="flex items-start gap-2 bg-pq-danger-100 border border-pq-danger-100 text-pq-danger-600 text-sm rounded-md px-4 py-3 mb-4">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {formError}
        </div>
      )}

      {/* Related Records */}
      {profile && (
        <div className="mb-6">
          <RelatedRecords baseType="GRN" baseId={grn.id} role={profile.role} currentDocType="GRN" />
        </div>
      )}

      {/* Closed banner */}
      {isClosedView && (
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

      {/* TSQA Notice for Raw Materials */}
      {!isClosedView && (isPendingQA || hasPendingQAItems) && (
        <div className="flex items-start gap-3 bg-sky-50 border border-sky-200 rounded-md px-5 py-4 mb-6">
          <AlertTriangle className="w-4 h-4 text-sky-700 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-sky-900">Pending QA Approval</p>
            <p className="text-xs text-sky-700 mt-0.5">
              This GRN cannot be closed until TSQA approves all flagged items.
            </p>
          </div>
        </div>
      )}

      {isClosedView && grn.items.some(i => i.is_raw_material) && (
        <div className="flex items-start gap-3 bg-pq-warning-100 border border-pq-warning-100 rounded-md px-5 py-4 mb-6">
          <AlertTriangle className="w-4 h-4 text-pq-warning-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-pq-warning-900">TSQA Notice</p>
            <p className="text-xs text-pq-warning-700 mt-0.5">
              This receipt contains Raw Material items subject to separate Technical and Quality Assurance (TSQA) procedures.
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
                  placeholder={suggestedDRSequence ?? '0001'}
                  className="flex-1 px-3 py-2 border-0 text-sm font-mono focus:outline-none bg-transparent disabled:bg-pq-neutral-50 disabled:text-pq-neutral-500"
                />
              </div>
              {!isReadOnly && (
                <p className="mt-1 text-xs text-pq-neutral-400">
                  {suggestedDRSequence
                    ? `Suggested: ${drPrefix}${suggestedDRSequence} — you may edit this number.`
                    : 'Enter a 4-digit sequence (e.g. 0001) or use the suggested value when it loads.'}
                </p>
              )}
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

            <Field label="INV No.">
              <input
                type="text"
                value={form.inv_no}
                onChange={e => setForm(f => ({ ...f, inv_no: e.target.value }))}
                disabled={isReadOnly}
                placeholder="Supplier invoice number"
                className="w-full px-3 py-2 border border-pq-neutral-200 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] disabled:bg-pq-neutral-50 disabled:text-pq-neutral-500"
              />
            </Field>

            <Field label="Transaction Date" required={!isClosedView}>
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
              canViewPrices ? (
                <div className="text-xs font-semibold text-pq-neutral-900">
                  Total Received: {formatCommercialAmount(receivedTotal ?? 0, true)}
                </div>
              ) : null
            }
            headerClassName="bg-pq-neutral-50 px-5"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-pq-neutral-200 bg-pq-neutral-50">
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-8">#</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase">Description</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-24">Attachments</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-14">Unit</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-20">Ordered</th>
                    <th className={`text-right px-3 py-2.5 text-xs font-semibold uppercase w-24 ${isReadOnly ? 'text-pq-neutral-500' : 'text-pq-primary-600'}`}>
                      Received
                    </th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-20">Rejected</th>
                    {canViewPrices ? (
                      <>
                        <th className="text-right px-3 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-24">Unit Price</th>
                        <th className="text-right px-3 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-28">Amount</th>
                      </>
                    ) : (
                      <th className="text-center px-3 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-28">Pricing</th>
                    )}
                    {!isReadOnly && (grn.request_type === 'goods' || grn.request_type === 'services') && (
                      <th className="text-center px-3 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-36">For QA</th>
                    )}
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
                          {item.pr1_remarks_snapshot && (
                            <RequestorRemarks text={item.pr1_remarks_snapshot} />
                          )}
                          {item.pr1_quantity_requested_snapshot != null &&
                            item.pr1_quantity_requested_snapshot !== item.quantity_ordered && (
                              <WarehouseQtyOverrideNote
                                originalQty={item.pr1_quantity_requested_snapshot}
                                currentQty={item.quantity_ordered}
                                reason={item.quantity_override_reason_snapshot}
                                overriddenBy={item.quantity_overridden_by_name_snapshot}
                              />
                            )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {(item.quote_attachments?.length ?? 0) > 0
                            ? <QuoteAttachmentPills attachments={item.quote_attachments!} />
                            : <span className="text-xs text-pq-neutral-300">—</span>}
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
                        {canViewPrices ? (
                          <>
                            <td className="px-3 py-3 text-right text-xs text-pq-neutral-500 font-mono">
                              {formatCommercialAmount(item.unit_price, true)}
                            </td>
                            <td className="px-3 py-3 text-right font-mono text-sm font-semibold text-pq-neutral-900">
                              {formatCommercialAmount(amount, true)}
                            </td>
                          </>
                        ) : (
                          <td className="px-3 py-3 text-center text-xs text-pq-neutral-400">
                            {formatCommercialAmount(0, false)}
                          </td>
                        )}
                        {!isReadOnly && (grn.request_type === 'goods' || grn.request_type === 'services') && (
                          <td className="px-3 py-3 text-center whitespace-nowrap">
                            {item.is_raw_material ? (
                              <span className="inline-flex items-center text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded px-2.5 py-1">
                                Mandatory QA
                              </span>
                            ) : item.requires_qa ? (
                              <div className="inline-flex flex-col items-center gap-1">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-purple-900 bg-purple-100 border border-purple-300 rounded shadow-sm">
                                  <Clock className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                  Sent to QA
                                </span>
                                {item.qa_status === 'approved' && (
                                  <span className="text-[10px] text-pq-success-600 font-semibold">QA Approved</span>
                                )}
                                {item.qa_status === 'rejected' && (
                                  <span
                                    className="text-[10px] text-pq-danger-600 font-semibold"
                                    title={item.qa_rejection_reason ?? undefined}
                                  >
                                    QA Rejected{item.qa_rejection_reason ? `: ${item.qa_rejection_reason}` : ''}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={forwardingItemId === item.id}
                                onClick={() => handleForwardItemToQA(item.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 active:bg-purple-800 rounded transition shadow-sm disabled:opacity-50"
                              >
                                <Send className="w-3.5 h-3.5 shrink-0" />
                                {forwardingItemId === item.id ? 'Sending...' : 'Forward to QA'}
                              </button>
                            )}
                          </td>
                        )}
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
                {canViewPrices && (
                  <tfoot>
                    <tr className="bg-pq-neutral-50 border-t-2 border-pq-neutral-200">
                      <td colSpan={isReadOnly ? 8 : 9} className="px-3 py-3 text-right text-xs font-semibold text-pq-neutral-900">
                        Total Received Value
                      </td>
                      <td className="px-3 py-3 text-right text-sm font-bold text-pq-neutral-900 font-mono">
                        {formatCommercialAmount(receivedTotal ?? 0, true)}
                      </td>
                    </tr>
                  </tfoot>
                )}
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
                      disabled={saving || closing || !form.transaction_date || isPendingQA || hasPendingQAItems}
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
                        Total: <strong>{formatCommercialAmount(receivedTotal ?? 0, canViewPrices)}</strong>
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
