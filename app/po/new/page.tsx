'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import { useAuth } from '@/context/AuthContext';
import {
  fetchPOGenerationCandidates,
  fetchSupplierPaymentTermsBySupplierName,
  generatePOFromPR2,
} from '@/lib/po';
import type { POFormValues, POGenerationCandidate } from '@/types/po';
import { WAREHOUSE_OPTIONS, PAYMENT_TERMS_OPTIONS } from '@/types/po';
import { format } from 'date-fns';
import {
  ChevronLeft, Building2, User, CalendarDays, Package,
  RefreshCw, ShoppingCart, TriangleAlert as AlertTriangle,
  CircleCheck as CheckCircle2, DollarSign,
} from 'lucide-react';

export default function PONewPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedPR2 = searchParams.get('pr2');
  const preselectedSupplier = searchParams.get('supplier');

  const currentYear = new Date().getFullYear();
  const poPrefix = `PO-${currentYear}-`;

  const [candidates, setCandidates]   = useState<POGenerationCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<POGenerationCandidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [poNumberError, setPONumberError] = useState('');

  const [form, setForm] = useState<POFormValues>({
    po_number:        poPrefix,
    po_date:          new Date().toISOString().slice(0, 10),
    delivery_address: '',
    warehouse:        '',
    payment_terms:    '',
    packing:          '',
    remarks:          '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');

  const setPONumber = useCallback((val: string) => {
    let suffix = val;
    if (val.startsWith(poPrefix)) {
      suffix = val.slice(poPrefix.length);
    } else if (val.includes('-') && /^[A-Z]+/.test(val)) {
      const parts = val.split('-');
      suffix = parts[parts.length - 1];
    }
    suffix = suffix.replace(/\D/g, '');
    const finalValue = poPrefix + suffix;
    setForm(f => ({ ...f, po_number: finalValue }));
    setPONumberError('');
  }, [poPrefix]);

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchPOGenerationCandidates();

      setCandidates(rows);

      if (preselectedPR2 && preselectedSupplier) {
        const m = rows.find(
          c => c.pr2_id === preselectedPR2 && c.supplier_id === preselectedSupplier
        );
        if (m?.has_po && m.existing_po_id) {
          router.replace(`/po/${m.existing_po_id}`);
          return;
        }
        if (m && !m.has_po) setSelectedCandidate(m);
      } else if (preselectedPR2) {
        const pending = rows.find(c => c.pr2_id === preselectedPR2 && !c.has_po);
        if (pending) setSelectedCandidate(pending);
      }
    } catch {
      setError('Failed to load approved PR2s.');
    } finally {
      setLoading(false);
    }
  }, [preselectedPR2, preselectedSupplier, router]);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  useEffect(() => {
    const name = selectedCandidate?.supplier_name_snapshot?.trim();
    if (!name) return;
    let cancelled = false;

    (async () => {
      try {
        const terms = await fetchSupplierPaymentTermsBySupplierName(name);
        if (cancelled || !terms) return;
        setForm(prev => {
          if (prev.payment_terms.trim() !== '') return prev;
          return { ...prev, payment_terms: terms };
        });
      } catch {
        /* leave payment_terms unchanged */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedCandidate?.supplier_name_snapshot]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selectedCandidate || selectedCandidate.has_po) return;

    const poSuffix = form.po_number.slice(poPrefix.length).trim();
    if (!poSuffix) { setPONumberError('PO number suffix is required.'); return; }
    if (!form.po_date)                 { setError('PO date is required.'); return; }
    if (!form.warehouse.trim())        { setError('Warehouse is required.'); return; }
    if (!form.payment_terms.trim())    { setError('Payment terms are required.'); return; }
    if (!form.delivery_address.trim()) { setError('Delivery address is required.'); return; }

    setSubmitting(true);
    setError('');
    try {
      const poId = await generatePOFromPR2(
        selectedCandidate.pr2_id,
        selectedCandidate.supplier_id,
        form,
        profile
      );
      router.push(`/po/${poId}`);
    } catch (e: unknown) {
      setError((e as Error)?.message ?? 'Failed to generate PO.');
      setSubmitting(false);
    }
  };

  const pendingCandidates = candidates.filter(c => !c.has_po);

  return (
    <AppShell title="Generate Purchase Order">
      <div className="mb-4">
        <Link href="/po" className="inline-flex items-center gap-1 text-xs text-pq-neutral-500 hover:text-pq-neutral-900 transition">
          <ChevronLeft className="w-3.5 h-3.5" />
          Back to Purchase Orders
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-pq-neutral-900">Generate Purchase Order</h1>
        <p className="text-sm text-pq-neutral-500 mt-0.5">
          Select an approved PR2 and supplier group (awarded lines), then fill in PO details.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <LoadingState message="Loading PO candidates..." />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Step 1 — Select PR2 + supplier slice */}
          <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-pq-neutral-200 bg-pq-neutral-50">
              <h2 className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                Step 1 — Select Approved PR2 &amp; Supplier
              </h2>
            </div>
            <div className="p-6">
              {candidates.length === 0 ? (
                <div className="flex items-start gap-3 bg-pq-neutral-50 border border-pq-neutral-200 rounded-md px-4 py-3">
                  <AlertTriangle className="w-4 h-4 text-pq-neutral-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-pq-neutral-500">
                    No PO candidates found. You need phase 2–approved PR2s with line-level supplier awards
                    linked to RFQ suppliers. If everything already has a PO, there is nothing left to generate.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {candidates.map(c => (
                    <label
                      key={c.candidateKey}
                      className={`flex items-start gap-4 p-4 rounded-md border-2 transition ${
                        c.has_po
                          ? 'border-pq-neutral-200 bg-pq-neutral-50 cursor-default opacity-90'
                          : selectedCandidate?.candidateKey === c.candidateKey
                            ? 'border-blue-500 bg-pq-primary-50 cursor-pointer'
                            : 'border-pq-neutral-200 hover:border-pq-primary-600 bg-white cursor-pointer'
                      }`}
                    >
                      <input
                        type="radio"
                        name="po_candidate"
                        value={c.candidateKey}
                        checked={selectedCandidate?.candidateKey === c.candidateKey}
                        disabled={c.has_po}
                        onChange={() => !c.has_po && setSelectedCandidate(c)}
                        className="mt-1 accent-blue-600 shrink-0 disabled:opacity-40"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap mb-1">
                          <span className="font-mono font-bold text-pq-neutral-900 text-sm">{c.pr2_number}</span>
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-pq-success-600 bg-pq-success-100 border border-pq-success-100 rounded-full px-2 py-0.5">
                            <CheckCircle2 className="w-3 h-3" /> Phase 2 Approved
                          </span>
                          {c.has_po && (
                            <span className="inline-flex text-xs font-semibold text-pq-neutral-500 bg-[#EEF1F7] border border-pq-neutral-200 rounded-full px-2 py-0.5">
                              PO already created
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-pq-neutral-900 font-medium truncate">{c.purpose}</p>
                        <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-pq-neutral-900">
                            <Package className="w-3 h-3" />{c.supplier_name_snapshot}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs text-pq-neutral-500">
                            <Building2 className="w-3 h-3" />{c.department_name_snapshot}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs text-pq-neutral-500">
                            <User className="w-3 h-3" />{c.requisitioner_name_snapshot}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs text-pq-neutral-500">
                            <CalendarDays className="w-3 h-3" />
                            {format(new Date(c.date_required), 'MMM d, yyyy')}
                          </span>
                        </div>
                        {c.has_po && c.existing_po_id && (
                          <Link
                            href={`/po/${c.existing_po_id}`}
                            className="inline-block mt-2 text-xs font-semibold text-pq-primary-600 hover:text-pq-neutral-900 underline"
                          >
                            View PO →
                          </Link>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold text-pq-neutral-900">
                          ₱{c.grand_total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-pq-neutral-400 mt-0.5">
                          {c.item_count} item{c.item_count !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Step 2 — PO Details */}
          {selectedCandidate && !selectedCandidate.has_po && (
            <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-pq-neutral-200 bg-pq-neutral-50">
                <h2 className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                  Step 2 — PO Details, Warehouse &amp; Terms
                </h2>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">

                <div className="md:col-span-1">
                  <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
                    PO Number <span className="text-pq-danger-600">*</span>
                  </label>
                  <div className={`flex items-center border rounded-md overflow-hidden transition ${
                    poNumberError ? 'border-red-300 bg-pq-danger-100' : 'border-pq-neutral-200'
                  } focus-within:ring-2 focus-within:ring-[#1E4BFF] focus-within:border-transparent`}>
                    <div className="px-3 py-2.5 bg-pq-neutral-50 border-r border-pq-neutral-200 text-sm font-mono text-pq-neutral-400 whitespace-nowrap pointer-events-none select-none">
                      {poPrefix}
                    </div>
                    <input
                      type="text"
                      value={form.po_number.startsWith(poPrefix) ? form.po_number.slice(poPrefix.length) : form.po_number}
                      onChange={e => setPONumber(poPrefix + e.target.value)}
                      placeholder="e.g. 0001"
                      className="flex-1 px-3 py-2.5 border-0 text-sm font-mono focus:outline-none bg-inherit"
                    />
                  </div>
                  {poNumberError && (
                    <p className="mt-1 text-xs text-pq-danger-600">{poNumberError}</p>
                  )}
                  <p className="text-xs text-pq-neutral-400 mt-1">Must be unique across all purchase orders.</p>
                </div>

                <div className="md:col-span-1">
                  <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
                    PO Date <span className="text-pq-danger-600">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.po_date}
                    onChange={e => setForm(f => ({ ...f, po_date: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] focus:border-transparent transition bg-white"
                  />
                </div>

                <div className="md:col-span-1">
                  <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
                    Warehouse <span className="text-pq-danger-600">*</span>
                  </label>
                  <select
                    value={form.warehouse}
                    onChange={e => setForm(f => ({ ...f, warehouse: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] focus:border-transparent transition bg-white"
                  >
                    <option value="">Select warehouse...</option>
                    {WAREHOUSE_OPTIONS.map(w => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-1">
                  <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
                    Payment Terms <span className="text-pq-danger-600">*</span>
                  </label>
                  <select
                    value={form.payment_terms}
                    onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] focus:border-transparent transition bg-white"
                  >
                    <option value="">Select terms...</option>
                    {PAYMENT_TERMS_OPTIONS.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
                    Delivery Address <span className="text-pq-danger-600">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={form.delivery_address}
                    onChange={e => setForm(f => ({ ...f, delivery_address: e.target.value }))}
                    placeholder="Full delivery address..."
                    required
                    className="w-full px-3 py-2 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] focus:border-transparent transition resize-none"
                  />
                </div>

                <div className="md:col-span-1">
                  <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
                    Packing Instructions
                  </label>
                  <input
                    type="text"
                    value={form.packing}
                    onChange={e => setForm(f => ({ ...f, packing: e.target.value }))}
                    placeholder="e.g. Standard carton, palletized..."
                    className="w-full px-3 py-2 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] focus:border-transparent transition"
                  />
                </div>

                <div className="md:col-span-1">
                  <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
                    Remarks
                  </label>
                  <input
                    type="text"
                    value={form.remarks}
                    onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                    placeholder="Optional notes..."
                    className="w-full px-3 py-2 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] focus:border-transparent transition"
                  />
                </div>
              </div>
            </div>
          )}

          {selectedCandidate && !selectedCandidate.has_po && (
            <div className="bg-pq-neutral-50 rounded-md border border-pq-neutral-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="w-4 h-4 text-pq-neutral-500" />
                <h3 className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">PO Summary</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-xs text-pq-neutral-500">PR2 Reference</p>
                  <p className="font-mono font-bold text-pq-neutral-900 mt-0.5">{selectedCandidate.pr2_number}</p>
                </div>
                <div>
                  <p className="text-xs text-pq-neutral-500">Supplier</p>
                  <p className="font-medium text-pq-neutral-900 mt-0.5">{selectedCandidate.supplier_name_snapshot}</p>
                </div>
                <div>
                  <p className="text-xs text-pq-neutral-500">Items</p>
                  <p className="font-medium text-pq-neutral-900 mt-0.5">{selectedCandidate.item_count}</p>
                </div>
                <div>
                  <p className="text-xs text-pq-neutral-500">Grand Total</p>
                  <p className="font-bold text-pq-neutral-900 mt-0.5">
                    ₱{selectedCandidate.grand_total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 bg-pq-danger-100 border border-pq-danger-100 text-pq-danger-600 text-sm rounded-md px-4 py-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 justify-end">
            <Link
              href="/po"
              className="px-4 py-2 text-sm text-pq-neutral-500 hover:text-pq-neutral-900 transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={
                !selectedCandidate ||
                selectedCandidate.has_po ||
                submitting ||
                pendingCandidates.length === 0
              }
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-sm font-semibold rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Generating...</>
              ) : (
                <><ShoppingCart className="w-4 h-4" /> Generate Purchase Order</>
              )}
            </button>
          </div>
        </form>
      )}
    </AppShell>
  );
}
