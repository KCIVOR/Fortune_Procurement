'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import { useAuth } from '@/context/AuthContext';
import {
  fetchSupplierQuoteDetail,
  submitSupplierQuotation,
} from '@/lib/canvassing';
import type { SupplierQuoteDetail, QuoteDraft } from '@/lib/canvassing';
import { ChevronLeft, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, PackageSearch, CalendarDays, FileText, Send, Info } from 'lucide-react';
import { format } from 'date-fns';

export default function SupplierQuotationPage() {
  const { rfqSupplierId } = useParams<{ rfqSupplierId: string }>();
  const { profile } = useAuth();
  const router = useRouter();

  const [detail, setDetail]     = useState<SupplierQuoteDetail | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [drafts, setDrafts]     = useState<QuoteDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted]   = useState(false);

  useEffect(() => {
    if (!rfqSupplierId || !profile) return;

    fetchSupplierQuoteDetail(rfqSupplierId, profile.id)
      .then(d => {
        if (!d) { setError('RFQ not found or access denied.'); return; }
        setDetail(d);

        // Pre-populate drafts from existing quotes
        const initialDrafts: QuoteDraft[] = d.items.map(item => {
          const existing = d.quotes.find(q => q.pr1_item_id === item.id);
          return {
            pr1_item_id:        item.id,
            quoted_description: existing?.quoted_description ?? item.description,
            is_alternative:     existing?.is_alternative ?? false,
            unit_price:         existing ? Number(existing.unit_price) : 0,
            lead_time_days:     existing?.lead_time_days ?? 0,
            remarks:            existing?.remarks ?? '',
          };
        });
        setDrafts(initialDrafts);
        if (d.rfqSupplier.status === 'submitted') setSubmitted(true);
      })
      .catch(() => setError('Failed to load RFQ details.'))
      .finally(() => setLoading(false));
  }, [rfqSupplierId, profile]);

  const updateDraft = (index: number, field: keyof QuoteDraft, value: any) => {
    setDrafts(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!detail) return;
    const invalid = drafts.filter(d => d.unit_price <= 0);
    if (invalid.length > 0) {
      setSubmitError('Please enter a unit price greater than 0 for all items.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    try {
      await submitSupplierQuotation(rfqSupplierId, drafts);
      setSubmitted(true);
    } catch (e: any) {
      setSubmitError(e.message ?? 'Failed to submit quotation.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <AppShell title="Submit Quotation">
      <div className="flex items-center justify-center h-64">
        <LoadingState message="Loading RFQ..." />
      </div>
    </AppShell>
  );

  if (error || !detail) return (
    <AppShell title="Submit Quotation">
      <div className="bg-red-50 border border-red-200 rounded-[4px] p-4 text-sm text-red-700">
        {error || 'RFQ not found.'}
      </div>
    </AppShell>
  );

  const { rfq, pr1, items } = detail;
  const isClosed   = rfq.status === 'closed';
  const canSubmit  = rfq.status === 'open' && !isClosed;
  const isReadOnly = submitted || isClosed;

  return (
    <AppShell title="Submit Quotation">
      <div className="mb-2">
        <Link href="/supplier/quotations" className="inline-flex items-center gap-1 text-xs text-[#40527A] hover:text-[#0F1F3A] transition">
          <ChevronLeft className="w-3.5 h-3.5" />
          Back to RFQ Inbox
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-[#0F1F3A] font-mono">{rfq.rfq_number}</h1>
            <span className={`inline-flex items-center text-xs font-semibold border rounded-full px-2.5 py-1 ${
              rfq.status === 'open'   ? 'bg-amber-50 text-amber-700 border-amber-200' :
              rfq.status === 'closed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
              'bg-[#F7F9FC] text-[#40527A] border-[#D8E2FF]'
            }`}>
              {rfq.status.charAt(0).toUpperCase() + rfq.status.slice(1)}
            </span>
            {submitted && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold border rounded-full px-2.5 py-1 bg-emerald-50 text-emerald-700 border-emerald-200">
                <CheckCircle2 className="w-3 h-3" />
                Quotation Submitted
              </span>
            )}
          </div>
          <p className="text-sm text-[#40527A]">
            {pr1.department_name_snapshot} · {pr1.purpose}
          </p>
        </div>
      </div>

      {/* Status banners */}
      {submitted && canSubmit && (
        <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-[4px] px-5 py-4 mb-6">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">Quotation submitted successfully</p>
            <p className="text-xs text-emerald-700 mt-0.5">You can update your prices below and resubmit before the deadline.</p>
          </div>
        </div>
      )}
      {isClosed && (
        <div className="flex items-start gap-3 bg-[#F7F9FC] border border-[#D8E2FF] rounded-[4px] px-5 py-4 mb-6">
          <Info className="w-4 h-4 text-[#40527A] mt-0.5 shrink-0" />
          <p className="text-sm text-[#40527A]">This RFQ is closed. Procurement has finalised their selection.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar: RFQ info */}
        <div className="space-y-4">
          <div className="bg-white rounded-[4px] border border-[#D8E2FF] p-5 space-y-3">
            <h2 className="text-xs font-bold text-[#40527A] uppercase tracking-wide">RFQ Details</h2>
            <InfoField icon={FileText} label="PR1 Number"  value={pr1.pr1_number} mono />
            <InfoField icon={FileText} label="Purpose"     value={pr1.purpose} />
            {rfq.deadline && (
              <InfoField icon={CalendarDays} label="Deadline" value={format(new Date(rfq.deadline), 'MMM d, yyyy')} />
            )}
            {rfq.notes && (
              <div>
                <p className="text-xs font-semibold text-[#BFC7D5] uppercase tracking-wide mb-0.5">Procurement Notes</p>
                <p className="text-sm text-[#0F1F3A] leading-snug">{rfq.notes}</p>
              </div>
            )}
          </div>

          {!isReadOnly && (
            <div className="bg-amber-50 border border-amber-200 rounded-[4px] p-4">
              <p className="text-xs font-semibold text-amber-700 mb-1">Instructions</p>
              <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
                <li>Fill in price for each item</li>
                <li>Mark "Alternative item" if you are quoting a substitute</li>
                <li>Provide lead time in calendar days</li>
                <li>All fields are required</li>
              </ul>
            </div>
          )}
        </div>

        {/* Main: quotation form */}
        <div className="lg:col-span-3 space-y-4">
          {items.map((item, index) => {
            const draft = drafts[index];
            if (!draft) return null;

            return (
              <div key={item.id} className="bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden">
                {/* Item header */}
                <div className="flex items-center gap-3 px-5 py-3.5 bg-[#F7F9FC] border-b border-[#D8E2FF]">
                  <span className="w-6 h-6 rounded-full bg-[#D8E2FF] text-[#40527A] text-xs font-bold flex items-center justify-center shrink-0">
                    {item.item_order}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#0F1F3A]">{item.description}</p>
                    <p className="text-xs text-[#BFC7D5]">
                      {item.item_code && <span className="font-mono">{item.item_code} · </span>}
                      Qty: <strong>{item.quantity_requested}</strong> {item.unit_of_measure}
                    </p>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  {/* Alternative item toggle */}
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={draft.is_alternative}
                        onChange={e => updateDraft(index, 'is_alternative', e.target.checked)}
                        disabled={isReadOnly}
                        className="sr-only"
                      />
                      <div className={`w-10 h-5 rounded-full transition ${draft.is_alternative ? 'bg-orange-500' : 'bg-[#D8E2FF]'}`} />
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${draft.is_alternative ? 'translate-x-5' : ''}`} />
                    </div>
                    <span className="text-sm font-medium text-[#0F1F3A]">
                      Alternative / substitute item
                      {draft.is_alternative && <span className="ml-1 text-orange-600 font-semibold">(will flag for requestor review)</span>}
                    </span>
                  </label>

                  {/* Quoted description */}
                  <div>
                    <label className="block text-xs font-semibold text-[#40527A] uppercase tracking-wide mb-1.5">
                      Quoted Item / Specification <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={draft.quoted_description}
                      onChange={e => updateDraft(index, 'quoted_description', e.target.value)}
                      disabled={isReadOnly}
                      placeholder="Brand, model, exact specification..."
                      className="w-full px-3 py-2 border border-[#D8E2FF] rounded-[4px] text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] disabled:bg-[#F7F9FC] disabled:text-[#40527A]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Unit price */}
                    <div>
                      <label className="block text-xs font-semibold text-[#40527A] uppercase tracking-wide mb-1.5">
                        Unit Price (₱) <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-sm text-[#BFC7D5] pointer-events-none">₱</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft.unit_price || ''}
                          onChange={e => updateDraft(index, 'unit_price', parseFloat(e.target.value) || 0)}
                          disabled={isReadOnly}
                          placeholder="0.00"
                          className="w-full pl-7 pr-3 py-2 border border-[#D8E2FF] rounded-[4px] text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] disabled:bg-[#F7F9FC]"
                        />
                      </div>
                      {draft.unit_price > 0 && (
                        <p className="text-xs text-[#BFC7D5] mt-1">
                          Total: ₱{(draft.unit_price * item.quantity_requested).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>

                    {/* Lead time */}
                    <div>
                      <label className="block text-xs font-semibold text-[#40527A] uppercase tracking-wide mb-1.5">
                        Lead Time (days) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={draft.lead_time_days || ''}
                        onChange={e => updateDraft(index, 'lead_time_days', parseInt(e.target.value, 10) || 0)}
                        disabled={isReadOnly}
                        placeholder="0"
                        className="w-full px-3 py-2 border border-[#D8E2FF] rounded-[4px] text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] disabled:bg-[#F7F9FC]"
                      />
                    </div>
                  </div>

                  {/* Remarks */}
                  <div>
                    <label className="block text-xs font-semibold text-[#40527A] uppercase tracking-wide mb-1.5">
                      Remarks <span className="text-[#BFC7D5] font-normal normal-case">(optional)</span>
                    </label>
                    <textarea
                      rows={2}
                      value={draft.remarks}
                      onChange={e => updateDraft(index, 'remarks', e.target.value)}
                      disabled={isReadOnly}
                      placeholder="Warranty, MOQ, delivery conditions..."
                      className="w-full px-3 py-2 border border-[#D8E2FF] rounded-[4px] text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] resize-none disabled:bg-[#F7F9FC] disabled:text-[#40527A]"
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {/* Submit */}
          {canSubmit && (
            <div className="bg-white rounded-[4px] border border-[#D8E2FF] px-5 py-4">
              {submitError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-[4px] px-4 py-3 mb-4">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {submitError}
                </div>
              )}
              <div className="flex items-center justify-between">
                <p className="text-sm text-[#40527A]">
                  {submitted
                    ? 'Your quotation is on record. You may update and resubmit.'
                    : 'Review all items above before submitting.'}
                </p>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1E4BFF] hover:bg-[#0F1F3A] text-white text-sm font-semibold rounded-[4px] transition disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {submitting ? 'Submitting...' : submitted ? 'Update Quotation' : 'Submit Quotation'}
                </button>
              </div>
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
    <div>
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className="w-3.5 h-3.5 text-[#BFC7D5]" />
        <p className="text-xs font-semibold text-[#BFC7D5] uppercase tracking-wide">{label}</p>
      </div>
      <p className={`text-sm text-[#0F1F3A] ${mono ? 'font-mono font-semibold' : 'font-medium'}`}>{value}</p>
    </div>
  );
}
