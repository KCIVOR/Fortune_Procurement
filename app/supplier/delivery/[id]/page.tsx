'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import { useAuth } from '@/context/AuthContext';
import { fetchDeliveryById, supplierUpdateDelivery } from '@/lib/delivery';
import { uploadDeliveryReceipt } from '@/lib/delivery-receipt-storage';
import type { DeliveryWithHistory, DeliveryStatus, DeliverySupplierUpdateValues } from '@/types/delivery';
import { DELIVERY_STATUS_LABELS } from '@/types/delivery';
import { format } from 'date-fns';
import { ChevronLeft, Truck, Building2, Package, CalendarDays, MapPin, Clock, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, Navigation, Ban, Calendar, User, Send, FileText } from 'lucide-react';

const STATUS_CONFIG: Record<DeliveryStatus, {
  bg: string; text: string; border: string; icon: React.ElementType;
}> = {
  pending:    { bg: 'bg-slate-100',   text: 'text-slate-600',   border: 'border-slate-200',   icon: Clock },
  scheduled:  { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    icon: Calendar },
  in_transit: { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   icon: Navigation },
  delayed:    { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     icon: AlertTriangle },
  delivered:  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle2 },
  cancelled:  { bg: 'bg-slate-100',  text: 'text-slate-500',   border: 'border-slate-200',   icon: Ban },
};

// Statuses a supplier can transition to from each current status
const ALLOWED_NEXT: Record<DeliveryStatus, DeliveryStatus[]> = {
  pending:    ['scheduled', 'in_transit', 'delayed'],
  scheduled:  ['in_transit', 'delayed', 'delivered'],
  in_transit: ['delivered', 'delayed'],
  delayed:    ['scheduled', 'in_transit', 'delivered'],
  delivered:  [],
  cancelled:  [],
};

const ROLE_ACTOR_STYLE: Record<string, string> = {
  supplier:    'bg-blue-50 text-blue-700 border-blue-200',
  procurement: 'bg-teal-50 text-teal-700 border-teal-200',
  warehouse:   'bg-violet-50 text-violet-600 border-violet-200',
};

const DR_ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const DR_MAX_BYTES = 10 * 1024 * 1024;

function validateDrFileLocal(file: File): string | null {
  const t = file.type || '';
  if (!DR_ALLOWED_TYPES.has(t)) {
    return 'Please choose a PDF, JPG, or PNG file.';
  }
  if (file.size > DR_MAX_BYTES) {
    return 'File must be 10 MB or smaller.';
  }
  return null;
}

export default function SupplierDeliveryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();

  const [delivery, setDelivery] = useState<DeliveryWithHistory | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  const [form, setForm] = useState<DeliverySupplierUpdateValues>({
    new_status:     'scheduled',
    scheduled_date: '',
    note:           '',
  });
  const [busy, setBusy]       = useState(false);
  const [formError, setFormError] = useState('');
  const [drFile, setDrFile]   = useState<File | null>(null);
  const drInputRef            = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    if (!id) return;
    fetchDeliveryById(id)
      .then(d => {
        if (!d) { setError('Delivery not found.'); return; }
        setDelivery(d);
        const nexts = ALLOWED_NEXT[d.status];
        if (nexts.length > 0) setForm(f => ({ ...f, new_status: nexts[0] }));
      })
      .catch(() => setError('Failed to load delivery.'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (form.new_status !== 'in_transit') {
      setDrFile(null);
      if (drInputRef.current) drInputRef.current.value = '';
    }
  }, [form.new_status]);

  const handleUpdate = async () => {
    if (!delivery || !profile) return;
    setBusy(true);
    setFormError('');
    try {
      if (form.new_status === 'in_transit') {
        if (!drFile) {
          setFormError('A delivery receipt file is required for In Transit.');
          return;
        }
        const bad = validateDrFileLocal(drFile);
        if (bad) {
          setFormError(bad);
          return;
        }
        const { path, filename } = await uploadDeliveryReceipt(delivery.id, drFile);
        await supplierUpdateDelivery(
          delivery.id,
          {
            ...form,
            dr_document_path: path,
            dr_document_filename: filename,
          },
          profile
        );
      } else {
        await supplierUpdateDelivery(delivery.id, form, profile);
      }
      setForm(f => ({ ...f, note: '', scheduled_date: '' }));
      setDrFile(null);
      if (drInputRef.current) drInputRef.current.value = '';
      load();
    } catch (e: any) {
      setFormError(e.message ?? 'Failed to update delivery.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return (
    <AppShell title="Delivery Update">
      <div className="flex items-center justify-center h-64">
        <LoadingState message="Loading delivery..." />
      </div>
    </AppShell>
  );

  if (error || !delivery) return (
    <AppShell title="Delivery Update">
      <div className="bg-red-50 border border-red-200 rounded-[4px] p-4 text-sm text-red-700">
        {error || 'Delivery not found.'}
      </div>
    </AppShell>
  );

  const cfg         = STATUS_CONFIG[delivery.status];
  const Icon        = cfg.icon;
  const allowedNext = ALLOWED_NEXT[delivery.status];
  const canUpdate   = allowedNext.length > 0 && delivery.supplier_id === profile?.id;

  return (
    <AppShell title={`Delivery — PO ${delivery.po_number_snapshot}`}>
      <div className="mb-2">
        <Link href="/supplier/delivery" className="inline-flex items-center gap-1 text-xs text-[#40527A] hover:text-[#0F1F3A] transition">
          <ChevronLeft className="w-3.5 h-3.5" />
          Back to Deliveries
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h1 className="text-xl font-bold text-[#0F1F3A] font-mono">{delivery.po_number_snapshot}</h1>
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold border rounded-full px-3 py-1 ${cfg.bg} ${cfg.text} ${cfg.border}`}>
              <Icon className="w-3.5 h-3.5" />
              {DELIVERY_STATUS_LABELS[delivery.status]}
            </span>
          </div>
          <p className="text-sm text-[#40527A]">{delivery.department_name_snapshot} · {delivery.purpose}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-[#0F1F3A] font-mono">
            ₱{delivery.grand_total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-[#BFC7D5]">Grand Total</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">

          {/* Order Info */}
          <div className="bg-white rounded-[4px] border border-[#D8E2FF] p-5 space-y-4 order-2 lg:order-none">
            <h2 className="text-xs font-bold text-[#40527A] uppercase tracking-wide">Order Info</h2>
            <InfoField icon={User}         label="Buyer"         value={delivery.requisitioner_name_snapshot} />
            <InfoField icon={Building2}    label="Department"    value={delivery.department_name_snapshot} />
            <InfoField icon={Package}      label="Deliver To"    value={delivery.warehouse} />
            <InfoField icon={MapPin}       label="Address"       value={delivery.delivery_address} />
            {delivery.dr_document_filename && (
              <div className="flex items-start gap-2.5 pt-1">
                <FileText className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Delivery receipt</p>
                  <p className="text-sm text-slate-800 mt-0.5 font-medium">
                    Attached DR: {delivery.dr_document_filename}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Key Dates */}
          <div className="bg-white rounded-[4px] border border-[#D8E2FF] p-5 space-y-4 order-3 lg:order-none">
            <h2 className="text-xs font-bold text-[#40527A] uppercase tracking-wide">Key Dates</h2>
            {delivery.commitment_date && (
              <InfoField icon={CalendarDays} label="Commitment"
                value={format(new Date(delivery.commitment_date), 'MMMM d, yyyy')} />
            )}
            {delivery.scheduled_date && (
              <InfoField icon={CalendarDays} label="Scheduled"
                value={format(new Date(delivery.scheduled_date), 'MMMM d, yyyy')} />
            )}
            {delivery.actual_delivery_date && (
              <InfoField icon={CheckCircle2} label="Delivered"
                value={format(new Date(delivery.actual_delivery_date), 'MMMM d, yyyy')} />
            )}
            {!delivery.commitment_date && !delivery.scheduled_date && (
              <p className="text-xs text-[#BFC7D5]">No dates yet.</p>
            )}
          </div>

          {/* References */}
          <div className="bg-white rounded-[4px] border border-[#D8E2FF] p-5 space-y-2 order-4 lg:order-none">
            <h2 className="text-xs font-bold text-[#40527A] uppercase tracking-wide mb-2">References</h2>
            <p className="text-xs text-[#40527A] font-mono">PO: {delivery.po_number_snapshot}</p>
            <p className="text-xs text-[#40527A] font-mono">PR2: {delivery.pr2_number_snapshot}</p>
            <p className="text-xs text-[#40527A] font-mono">PR1: {delivery.pr1_number_snapshot}</p>
          </div>

          {/* Delivered banner */}
          {delivery.status === 'delivered' && (
            <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-[4px] px-5 py-4">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">Delivery Completed</p>
                {delivery.actual_delivery_date && (
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Delivered on {format(new Date(delivery.actual_delivery_date), 'MMMM d, yyyy')}.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Supplier update form */}
          {canUpdate && (
            <div className="bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#D8E2FF] bg-[#F7F9FC]">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-[#40527A]" />
                  <h2 className="text-xs font-semibold text-[#0F1F3A] uppercase tracking-wide">Update Delivery Status</h2>
                </div>
                <p className="text-xs text-[#40527A] mt-0.5">Keep procurement informed about your delivery progress.</p>
              </div>
              <div className="p-5 space-y-4">
                {/* Status select */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                    New Status
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {allowedNext.map(s => {
                      const scfg  = STATUS_CONFIG[s];
                      const SIcon = scfg.icon;
                      const sel   = form.new_status === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            setForm(f => ({ ...f, new_status: s }));
                            setFormError('');
                          }}
                          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition ${
                            sel
                              ? `${scfg.bg} ${scfg.text} ${scfg.border} ring-2 ring-offset-1 ring-current`
                              : 'bg-white text-[#40527A] border-[#D8E2FF] hover:border-[#0F1F3A]'
                          }`}
                        >
                          <SIcon className="w-3.5 h-3.5" />
                          {DELIVERY_STATUS_LABELS[s]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {form.new_status === 'in_transit' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                      Delivery receipt (DR) <span className="text-red-600">*</span>
                    </label>
                    <input
                      ref={drInputRef}
                      type="file"
                      accept="application/pdf,image/jpeg,image/png"
                      disabled={busy}
                      onChange={(e) => {
                        setFormError('');
                        const f = e.target.files?.[0] ?? null;
                        setDrFile(f);
                        if (f) {
                          const msg = validateDrFileLocal(f);
                          if (msg) setFormError(msg);
                        }
                      }}
                      className="block w-full max-w-md text-sm text-[#40527A] file:mr-3 file:rounded-[4px] file:border file:border-[#D8E2FF] file:bg-[#F7F9FC] file:px-3 file:py-2 file:text-xs file:font-semibold disabled:opacity-50"
                    />
                    <p className="text-xs text-[#BFC7D5] mt-1">PDF, JPG, or PNG — max 10 MB.</p>
                  </div>
                )}

                {/* Scheduled date — show when scheduling or moving to in_transit */}
                {(form.new_status === 'scheduled' || form.new_status === 'in_transit') && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                      {form.new_status === 'scheduled' ? 'Expected Delivery Date' : 'Updated Delivery Date'}
                      <span className="font-normal text-slate-400 normal-case ml-1">(optional)</span>
                    </label>
                    <input
                      type="date"
                      value={form.scheduled_date}
                      onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))}
                      min={new Date().toISOString().split('T')[0]}
                      disabled={busy}
                      className="w-full max-w-xs px-3 py-2 border border-[#D8E2FF] rounded-[4px] text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] focus:border-transparent transition disabled:opacity-50"
                    />
                  </div>
                )}

                {/* Note */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                    Update Note
                    {form.new_status === 'delayed'
                      ? ' (required — explain delay reason)'
                      : ' (optional)'}
                  </label>
                  <textarea
                    rows={3}
                    value={form.note}
                    onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                    disabled={busy}
                    placeholder={
                      form.new_status === 'in_transit' ? 'Shipment dispatched via LBC, tracking #...' :
                      form.new_status === 'delayed'    ? 'Delayed due to...' :
                      form.new_status === 'delivered'  ? 'Goods handed to warehouse staff.' :
                      'Add any relevant notes...'
                    }
                    className="w-full px-3 py-2 border border-[#D8E2FF] rounded-[4px] text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] resize-none disabled:opacity-50"
                  />
                </div>

                {formError && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    {formError}
                  </div>
                )}

                <div className="flex justify-end pt-2 border-t border-[#D8E2FF]">
                  <button
                    onClick={handleUpdate}
                    disabled={
                      busy ||
                      (form.new_status === 'delayed' && !form.note.trim()) ||
                      (form.new_status === 'in_transit' && (!drFile || !!validateDrFileLocal(drFile)))
                    }
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1E4BFF] hover:bg-[#0F1F3A] text-white text-sm font-semibold rounded-[4px] transition disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    {busy ? 'Saving...' : 'Submit Update'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right column: Update History */}
        <div className="lg:col-span-1 order-1 lg:order-none">
          <div className="lg:sticky lg:top-20">
            <div className="bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#D8E2FF] bg-[#F7F9FC] flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-[#BFC7D5]" />
                <h2 className="text-xs font-semibold text-[#40527A] uppercase tracking-wide">
                  Update History ({delivery.history.length})
                </h2>
              </div>
              {delivery.history.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm text-[#BFC7D5]">No updates yet. Submit your first status update below.</p>
                </div>
              ) : (
                <div className="divide-y divide-[#D8E2FF] max-h-96 overflow-y-auto">
                  {[...delivery.history].reverse().map((entry, idx) => {
                    const roleCfg = ROLE_ACTOR_STYLE[entry.actor_role] ?? 'bg-slate-100 text-slate-600 border-slate-200';
                    return (
                      <div key={entry.id} className={`px-5 py-4 ${idx === 0 ? 'bg-[#F7F9FC]/60' : ''}`}>
                        <div className="flex items-start gap-3">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${
                            entry.status_to === 'delivered' ? 'bg-emerald-500' :
                            entry.status_to === 'delayed'   ? 'bg-red-500' :
                            entry.status_to === 'in_transit'? 'bg-amber-500' :
                            entry.status_to === 'scheduled' ? 'bg-blue-500' :
                            'bg-slate-300'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-sm font-semibold text-[#0F1F3A]">{entry.actor_name}</span>
                              <span className={`text-xs border rounded px-1.5 py-0.5 font-medium ${roleCfg}`}>
                                {entry.actor_role}
                              </span>
                              {entry.status_to && (
                                <span className="text-xs text-[#40527A]">
                                  → <strong className="text-[#0F1F3A]">{DELIVERY_STATUS_LABELS[entry.status_to]}</strong>
                                </span>
                              )}
                            </div>
                            {entry.note && (
                              <p className="text-sm text-slate-600 leading-relaxed">{entry.note}</p>
                            )}
                            {entry.scheduled_date && (
                              <p className="text-xs text-[#1E4BFF] mt-1 flex items-center gap-1">
                                <CalendarDays className="w-3 h-3" />
                                {format(new Date(entry.scheduled_date), 'MMMM d, yyyy')}
                              </p>
                            )}
                            <p className="text-xs text-[#BFC7D5] mt-1">
                              {format(new Date(entry.created_at), 'MMM d, yyyy h:mm a')}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function InfoField({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">{label}</p>
        <p className="text-sm text-slate-800 mt-0.5 font-medium">{value}</p>
      </div>
    </div>
  );
}
