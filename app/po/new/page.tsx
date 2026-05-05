'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import { useAuth } from '@/context/AuthContext';
import { fetchPOs, fetchPOByPR2Id, generatePOFromPR2 } from '@/lib/po';
import { supabase } from '@/lib/supabase';
import type { POFormValues } from '@/types/po';
import { WAREHOUSE_OPTIONS, PAYMENT_TERMS_OPTIONS } from '@/types/po';
import { format } from 'date-fns';
import {
  ChevronLeft, Building2, User, CalendarDays, Package,
  RefreshCw, ShoppingCart, TriangleAlert as AlertTriangle,
  CircleCheck as CheckCircle2, DollarSign,
} from 'lucide-react';

const db = supabase as any;

interface PR2Option {
  id: string;
  pr2_number: string;
  purpose: string;
  department_name_snapshot: string;
  requisitioner_name_snapshot: string;
  date_required: string;
  supplier_name_snapshot: string;
  grand_total: number;
  item_count: number;
  has_po: boolean;
  existing_po_id: string | null;
}

export default function PONewPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedPR2 = searchParams.get('pr2');

  const currentYear = new Date().getFullYear();
  const poPrefix = `PO-${currentYear}-`;

  const [pr2Options, setPR2Options]   = useState<PR2Option[]>([]);
  const [selectedPR2, setSelectedPR2] = useState<PR2Option | null>(null);
  const [loadingPR2s, setLoadingPR2s] = useState(true);
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
    // Enforce prefix: if user pastes full value, strip it and keep only suffix
    let suffix = val;
    if (val.startsWith(poPrefix)) {
      suffix = val.slice(poPrefix.length);
    } else if (val.includes('-') && /^[A-Z]+/.test(val)) {
      // User pasted some other prefix format, extract numeric part
      const parts = val.split('-');
      suffix = parts[parts.length - 1];
    }
    // Allow only numeric characters in suffix
    suffix = suffix.replace(/\D/g, '');
    const finalValue = poPrefix + suffix;
    setForm(f => ({ ...f, po_number: finalValue }));
    setPONumberError('');
  }, [poPrefix]);

  const loadPR2Options = useCallback(async () => {
    setLoadingPR2s(true);
    try {
      const [pr2Res, posRes] = await Promise.all([
        db.from('pr2_requests')
          .select('id, pr2_number, purpose, department_name_snapshot, requisitioner_name_snapshot, date_required')
          .eq('status', 'phase2_approved')
          .order('generated_at', { ascending: false }),
        fetchPOs(),
      ]);

      const pr2s: any[] = pr2Res.data ?? [];
      const poByPR2Id = Object.fromEntries(posRes.map((p: any) => [p.pr2_id, p.id]));

      const withDetails = await Promise.all(
        pr2s.map(async (pr2: any) => {
          const { data: items } = await db
            .from('pr2_items')
            .select('unit_price, quantity_to_purchase, supplier_name_snapshot')
            .eq('pr2_id', pr2.id);

          const itemArr = items ?? [];
          const grandTotal = itemArr.reduce(
            (s: number, i: any) => s + Number(i.unit_price) * Number(i.quantity_to_purchase), 0
          );
          const supplier = itemArr[0]?.supplier_name_snapshot ?? '—';
          const existingPoId = poByPR2Id[pr2.id] ?? null;

          return {
            id:                          pr2.id,
            pr2_number:                  pr2.pr2_number,
            purpose:                     pr2.purpose,
            department_name_snapshot:    pr2.department_name_snapshot,
            requisitioner_name_snapshot: pr2.requisitioner_name_snapshot,
            date_required:               pr2.date_required,
            supplier_name_snapshot:      supplier,
            grand_total:                 grandTotal,
            item_count:                  itemArr.length,
            has_po:                      !!existingPoId,
            existing_po_id:              existingPoId,
          };
        })
      );

      setPR2Options(withDetails);

      // Idempotency: if URL param PR2 already has a PO, redirect straight to it
      if (preselectedPR2) {
        const match = withDetails.find(p => p.id === preselectedPR2);
        if (match) {
          if (match.existing_po_id) {
            router.replace(`/po/${match.existing_po_id}`);
            return;
          }
          setSelectedPR2(match);
        }
      }
    } catch {
      setError('Failed to load approved PR2s.');
    } finally {
      setLoadingPR2s(false);
    }
  }, [preselectedPR2, router]);

  useEffect(() => { loadPR2Options(); }, [loadPR2Options]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selectedPR2) return;

    const poSuffix = form.po_number.slice(poPrefix.length).trim();
    if (!poSuffix) { setPONumberError('PO number suffix is required.'); return; }
    if (!form.po_date)                 { setError('PO date is required.'); return; }
    if (!form.warehouse.trim())        { setError('Warehouse is required.'); return; }
    if (!form.payment_terms.trim())    { setError('Payment terms are required.'); return; }
    if (!form.delivery_address.trim()) { setError('Delivery address is required.'); return; }

    setSubmitting(true);
    setError('');
    try {
      const poId = await generatePOFromPR2(selectedPR2.id, form, profile);
      router.push(`/po/${poId}`);
    } catch (e: any) {
      setError(e.message ?? 'Failed to generate PO.');
      setSubmitting(false);
    }
  };

  const availablePR2s = pr2Options.filter(p => !p.has_po);

  return (
    <AppShell title="Generate Purchase Order">
      <div className="mb-4">
        <Link href="/po" className="inline-flex items-center gap-1 text-xs text-[#40527A] hover:text-[#0F1F3A] transition">
          <ChevronLeft className="w-3.5 h-3.5" />
          Back to Purchase Orders
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0F1F3A]">Generate Purchase Order</h1>
        <p className="text-sm text-[#40527A] mt-0.5">
          Select an approved PR2, then fill in PO details.
        </p>
      </div>

      {loadingPR2s ? (
        <div className="flex items-center justify-center h-40">
          <LoadingState message="Loading approved PR2s..." />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Step 1 — Select PR2 */}
          <div className="bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#D8E2FF] bg-[#F7F9FC]">
              <h2 className="text-xs font-semibold text-[#40527A] uppercase tracking-wide">
                Step 1 — Select Approved PR2
              </h2>
            </div>
            <div className="p-6">
              {availablePR2s.length === 0 ? (
                <div className="flex items-start gap-3 bg-[#F7F9FC] border border-[#D8E2FF] rounded-[4px] px-4 py-3">
                  <AlertTriangle className="w-4 h-4 text-[#BFC7D5] mt-0.5 shrink-0" />
                  <p className="text-sm text-[#40527A]">
                    No approved PR2s are available for PO generation. All approved PR2s may already have a PO, or none have completed Phase 2 approval yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {availablePR2s.map(pr2 => (
                    <label
                      key={pr2.id}
                      className={`flex items-start gap-4 p-4 rounded-[4px] border-2 cursor-pointer transition ${
                        selectedPR2?.id === pr2.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-[#D8E2FF] hover:border-[#0F1F3A] bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name="pr2_id"
                        value={pr2.id}
                        checked={selectedPR2?.id === pr2.id}
                        onChange={() => setSelectedPR2(pr2)}
                        className="mt-1 accent-blue-600 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap mb-1">
                          <span className="font-mono font-bold text-[#0F1F3A] text-sm">{pr2.pr2_number}</span>
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                            <CheckCircle2 className="w-3 h-3" /> Phase 2 Approved
                          </span>
                        </div>
                        <p className="text-sm text-[#0F1F3A] font-medium truncate">{pr2.purpose}</p>
                        <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-xs text-[#40527A]">
                            <Package className="w-3 h-3" />{pr2.supplier_name_snapshot}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs text-[#40527A]">
                            <Building2 className="w-3 h-3" />{pr2.department_name_snapshot}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs text-[#40527A]">
                            <User className="w-3 h-3" />{pr2.requisitioner_name_snapshot}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs text-[#40527A]">
                            <CalendarDays className="w-3 h-3" />
                            {format(new Date(pr2.date_required), 'MMM d, yyyy')}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold text-[#0F1F3A]">
                          ₱{pr2.grand_total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-[#BFC7D5] mt-0.5">{pr2.item_count} item{pr2.item_count !== 1 ? 's' : ''}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Step 2 — PO Details (only when PR2 selected) */}
          {selectedPR2 && (
            <div className="bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden">
              <div className="px-6 py-4 border-b border-[#D8E2FF] bg-[#F7F9FC]">
                <h2 className="text-xs font-semibold text-[#40527A] uppercase tracking-wide">
                  Step 2 — PO Details, Warehouse & Terms
                </h2>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">

                {/* PO Number */}
                <div className="md:col-span-1">
                  <label className="block text-xs font-semibold text-[#40527A] uppercase tracking-wide mb-1.5">
                    PO Number <span className="text-red-500">*</span>
                  </label>
                  <div className={`flex items-center border rounded-[4px] overflow-hidden transition ${
                    poNumberError ? 'border-red-300 bg-red-50' : 'border-[#D8E2FF]'
                  } focus-within:ring-2 focus-within:ring-[#1E4BFF] focus-within:border-transparent`}>
                    <div className="px-3 py-2.5 bg-[#F7F9FC] border-r border-[#D8E2FF] text-sm font-mono text-[#BFC7D5] whitespace-nowrap pointer-events-none select-none">
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
                    <p className="mt-1 text-xs text-red-600">{poNumberError}</p>
                  )}
                  <p className="text-xs text-[#BFC7D5] mt-1">Must be unique across all purchase orders.</p>
                </div>

                {/* PO Date */}
                <div className="md:col-span-1">
                  <label className="block text-xs font-semibold text-[#40527A] uppercase tracking-wide mb-1.5">
                    PO Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.po_date}
                    onChange={e => setForm(f => ({ ...f, po_date: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-[#D8E2FF] rounded-[4px] text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] focus:border-transparent transition bg-white"
                  />
                </div>

                {/* Warehouse */}
                <div className="md:col-span-1">
                  <label className="block text-xs font-semibold text-[#40527A] uppercase tracking-wide mb-1.5">
                    Warehouse <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.warehouse}
                    onChange={e => setForm(f => ({ ...f, warehouse: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-[#D8E2FF] rounded-[4px] text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] focus:border-transparent transition bg-white"
                  >
                    <option value="">Select warehouse...</option>
                    {WAREHOUSE_OPTIONS.map(w => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </select>
                </div>

                {/* Payment Terms */}
                <div className="md:col-span-1">
                  <label className="block text-xs font-semibold text-[#40527A] uppercase tracking-wide mb-1.5">
                    Payment Terms <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.payment_terms}
                    onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-[#D8E2FF] rounded-[4px] text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] focus:border-transparent transition bg-white"
                  >
                    <option value="">Select terms...</option>
                    {PAYMENT_TERMS_OPTIONS.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* Delivery Address */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-[#40527A] uppercase tracking-wide mb-1.5">
                    Delivery Address <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={form.delivery_address}
                    onChange={e => setForm(f => ({ ...f, delivery_address: e.target.value }))}
                    placeholder="Full delivery address..."
                    required
                    className="w-full px-3 py-2 border border-[#D8E2FF] rounded-[4px] text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] focus:border-transparent transition resize-none"
                  />
                </div>

                {/* Packing */}
                <div className="md:col-span-1">
                  <label className="block text-xs font-semibold text-[#40527A] uppercase tracking-wide mb-1.5">
                    Packing Instructions
                  </label>
                  <input
                    type="text"
                    value={form.packing}
                    onChange={e => setForm(f => ({ ...f, packing: e.target.value }))}
                    placeholder="e.g. Standard carton, palletized..."
                    className="w-full px-3 py-2 border border-[#D8E2FF] rounded-[4px] text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] focus:border-transparent transition"
                  />
                </div>

                {/* Remarks */}
                <div className="md:col-span-1">
                  <label className="block text-xs font-semibold text-[#40527A] uppercase tracking-wide mb-1.5">
                    Remarks
                  </label>
                  <input
                    type="text"
                    value={form.remarks}
                    onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                    placeholder="Optional notes..."
                    className="w-full px-3 py-2 border border-[#D8E2FF] rounded-[4px] text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] focus:border-transparent transition"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Summary card */}
          {selectedPR2 && (
            <div className="bg-[#F7F9FC] rounded-[4px] border border-[#D8E2FF] p-5">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="w-4 h-4 text-[#40527A]" />
                <h3 className="text-xs font-semibold text-[#40527A] uppercase tracking-wide">PO Summary</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-xs text-[#40527A]">PR2 Reference</p>
                  <p className="font-mono font-bold text-[#0F1F3A] mt-0.5">{selectedPR2.pr2_number}</p>
                </div>
                <div>
                  <p className="text-xs text-[#40527A]">Supplier</p>
                  <p className="font-medium text-[#0F1F3A] mt-0.5">{selectedPR2.supplier_name_snapshot}</p>
                </div>
                <div>
                  <p className="text-xs text-[#40527A]">Items</p>
                  <p className="font-medium text-[#0F1F3A] mt-0.5">{selectedPR2.item_count}</p>
                </div>
                <div>
                  <p className="text-xs text-[#40527A]">Grand Total</p>
                  <p className="font-bold text-[#0F1F3A] mt-0.5">
                    ₱{selectedPR2.grand_total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-[4px] px-4 py-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center gap-3 justify-end">
            <Link
              href="/po"
              className="px-4 py-2 text-sm text-[#40527A] hover:text-[#0F1F3A] transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={!selectedPR2 || submitting || availablePR2s.length === 0}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#1E4BFF] hover:bg-[#0F1F3A] text-white text-sm font-semibold rounded-[4px] transition disabled:opacity-50 disabled:cursor-not-allowed"
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
