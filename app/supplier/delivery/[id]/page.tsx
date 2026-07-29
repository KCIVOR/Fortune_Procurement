'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import { DetailPageSkeleton } from '@/components/shared/structural-skeletons';
import { FileUpload } from '@/components/shared/FileUpload';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
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
  pending:    { bg: 'bg-pq-neutral-100',   text: 'text-pq-neutral-600',   border: 'border-pq-neutral-200',   icon: Clock },
  scheduled:  { bg: 'bg-pq-primary-50',    text: 'text-pq-primary-700',    border: 'border-pq-primary-200',    icon: Calendar },
  in_transit: { bg: 'bg-pq-warning-100',   text: 'text-pq-warning-600',   border: 'border-pq-warning-100',   icon: Navigation },
  delayed:    { bg: 'bg-pq-danger-100',     text: 'text-pq-danger-600',     border: 'border-pq-danger-100',     icon: AlertTriangle },
  delivered:  { bg: 'bg-pq-success-100', text: 'text-pq-success-600', border: 'border-pq-success-100', icon: CheckCircle2 },
  cancelled:  { bg: 'bg-pq-neutral-100',  text: 'text-pq-neutral-500',   border: 'border-pq-neutral-200',   icon: Ban },
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
  supplier:    'bg-pq-primary-50 text-pq-primary-700 border-pq-primary-200',
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
      let payload: DeliverySupplierUpdateValues = { ...form };
      if (form.new_status === 'in_transit' && drFile) {
        const bad = validateDrFileLocal(drFile);
        if (bad) {
          setFormError(bad);
          return;
        }
        const { path, filename } = await uploadDeliveryReceipt(delivery.id, drFile);
        payload = {
          ...payload,
          dr_document_path: path,
          dr_document_filename: filename,
        };
      }
      await supplierUpdateDelivery(delivery.id, payload, profile);
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
      <DetailPageSkeleton />
    </AppShell>
  );

  if (error || !delivery) return (
    <AppShell title="Delivery Update">
      <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">
        {error || 'Delivery not found.'}
      </div>
    </AppShell>
  );

  const cfg         = STATUS_CONFIG[delivery.status];
  const Icon        = cfg.icon;
  const allowedNext = ALLOWED_NEXT[delivery.status];
  const canUpdate   = allowedNext.length > 0 && delivery.supplier_id === profile?.id;
  const drFileInvalid = drFile ? !!validateDrFileLocal(drFile) : false;

  return (
    <AppShell title={`Delivery — PO ${delivery.po_number_snapshot}`}>
      <div className="mb-2">
        <Link href="/supplier/delivery" className="inline-flex items-center gap-1 text-xs text-pq-neutral-500 hover:text-pq-neutral-900 transition">
          <ChevronLeft className="w-3.5 h-3.5" />
          Back to Deliveries
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h1 className="text-xl font-bold text-pq-neutral-900 font-mono">{delivery.po_number_snapshot}</h1>
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold border rounded-full px-3 py-1 ${cfg.bg} ${cfg.text} ${cfg.border}`}>
              <Icon className="w-3.5 h-3.5" />
              {DELIVERY_STATUS_LABELS[delivery.status]}
            </span>
          </div>
          <p className="text-sm text-pq-neutral-500">{delivery.department_name_snapshot} · {delivery.purpose}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-pq-neutral-900 font-mono">
            ₱{delivery.grand_total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-pq-neutral-400">Grand Total</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">

          {/* Order Info */}
          <div className="bg-white rounded-md border border-pq-neutral-200 p-5 space-y-4 order-2 lg:order-none">
            <h2 className="text-xs font-bold text-pq-neutral-500 uppercase tracking-wide">Order Info</h2>
            <InfoField icon={User}         label="Buyer"         value={delivery.requisitioner_name_snapshot} />
            <InfoField icon={Building2}    label="Department"    value={delivery.department_name_snapshot} />
            <InfoField icon={Package}      label="Deliver To"    value={delivery.warehouse} />
            <InfoField icon={MapPin}       label="Address"       value={delivery.delivery_address} />
            {delivery.dr_document_filename && (
              <div className="flex items-start gap-2.5 pt-1">
                <FileText className="w-3.5 h-3.5 text-pq-neutral-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-pq-neutral-400 uppercase tracking-wide font-semibold">Delivery receipt</p>
                  <p className="text-sm text-pq-neutral-800 mt-0.5 font-medium">
                    Attached DR: {delivery.dr_document_filename}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Key Dates */}
          <div className="bg-white rounded-md border border-pq-neutral-200 p-5 space-y-4 order-3 lg:order-none">
            <h2 className="text-xs font-bold text-pq-neutral-500 uppercase tracking-wide">Key Dates</h2>
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
              <p className="text-xs text-pq-neutral-400">No dates yet.</p>
            )}
          </div>

          {/* References */}
          <div className="bg-white rounded-md border border-pq-neutral-200 p-5 space-y-2 order-4 lg:order-none">
            <h2 className="text-xs font-bold text-pq-neutral-500 uppercase tracking-wide mb-2">References</h2>
            <p className="text-xs text-pq-neutral-500 font-mono">PO Ref: {delivery.po_number_snapshot}</p>
            <p className="text-xs text-pq-neutral-500 font-mono">PR2 Ref: {delivery.pr2_number_snapshot}</p>
            <p className="text-xs text-pq-neutral-500 font-mono">PR1 Ref: {delivery.pr1_number_snapshot}</p>
          </div>

          {/* Delivered banner */}
          {delivery.status === 'delivered' && (
            <div className="flex items-start gap-3 bg-pq-success-100 border border-pq-success-100 rounded-md px-5 py-4">
              <CheckCircle2 className="w-4 h-4 text-pq-success-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-pq-success-600">Delivery Completed</p>
                {delivery.actual_delivery_date && (
                  <p className="text-xs text-pq-success-600 mt-0.5">
                    Delivered on {format(new Date(delivery.actual_delivery_date), 'MMMM d, yyyy')}.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Supplier update form */}
          {canUpdate && (
            <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-pq-neutral-200 bg-pq-neutral-50">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-pq-neutral-500" />
                  <h2 className="text-xs font-semibold text-pq-neutral-900 uppercase tracking-wide">Update Delivery Status</h2>
                </div>
                <p className="text-xs text-pq-neutral-500 mt-0.5">Keep procurement informed about your delivery progress.</p>
              </div>
              <div className="p-5 space-y-4">
                {/* Status select */}
                <div>
                  <label className="block text-xs font-semibold text-pq-neutral-600 uppercase tracking-wide mb-1.5">
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
                              : 'bg-white text-pq-neutral-500 border-pq-neutral-200 hover:border-pq-primary-600'
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
                    <label className="block text-xs font-semibold text-pq-neutral-600 uppercase tracking-wide mb-1.5">
                      Delivery receipt (DR)
                      <span className="font-normal text-pq-neutral-400 normal-case ml-1">(optional)</span>
                    </label>
                    <FileUpload
                      accept="application/pdf,image/jpeg,image/png"
                      selectedFileName={drFile?.name}
                      onFileSelect={(file) => {
                        setFormError('');
                        const msg = validateDrFileLocal(file);
                        if (msg) {
                          setFormError(msg);
                          setDrFile(null);
                        } else {
                          setDrFile(file);
                        }
                      }}
                      onFileRemove={() => {
                        setDrFile(null);
                        setFormError('');
                      }}
                      error={formError}
                      isLoading={busy}
                    />
                  </div>
                )}

                {/* Scheduled date — show when scheduling or moving to in_transit */}
                {(form.new_status === 'scheduled' || form.new_status === 'in_transit') && (
                  <div>
                    <label className="block text-xs font-semibold text-pq-neutral-600 uppercase tracking-wide mb-1.5">
                      {form.new_status === 'scheduled' ? 'Expected Delivery Date' : 'Updated Delivery Date'}
                      <span className="font-normal text-pq-neutral-400 normal-case ml-1">(optional)</span>
                    </label>
                    <Input
                      type="date"
                      value={form.scheduled_date}
                      onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))}
                      min={new Date().toISOString().split('T')[0]}
                      disabled={busy}
                      className="w-full max-w-xs text-sm border-pq-neutral-200"
                    />
                  </div>
                )}

                {/* Note */}
                <div>
                  <label className="block text-xs font-semibold text-pq-neutral-600 uppercase tracking-wide mb-1.5">
                    Update Note
                    {form.new_status === 'delayed'
                      ? ' (required — explain delay reason)'
                      : ' (optional)'}
                  </label>
                  <Textarea
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
                    className="w-full border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] resize-none disabled:opacity-50"
                  />
                </div>

                {formError && form.new_status !== 'in_transit' && (
                  <div className="flex items-start gap-2 bg-pq-danger-100 border border-pq-danger-100 text-pq-danger-600 text-sm rounded-lg px-4 py-3">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    {formError}
                  </div>
                )}

                <div className="flex justify-end pt-2 border-t border-pq-neutral-200">
                  <Button
                    onClick={handleUpdate}
                    disabled={
                      busy ||
                      (form.new_status === 'delayed' && !form.note.trim()) ||
                      drFileInvalid
                    }
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-sm font-semibold rounded-md transition disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    {busy ? 'Saving...' : 'Submit Update'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right column: Update History */}
        <div className="lg:col-span-1 order-1 lg:order-none">
          <div className="lg:sticky lg:top-20">
            <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-pq-neutral-200 bg-pq-neutral-50 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-pq-neutral-400" />
                <h2 className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                  Update History ({delivery.history.length})
                </h2>
              </div>
              {delivery.history.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm text-pq-neutral-400">No updates yet. Submit your first status update below.</p>
                </div>
              ) : (
                <div className="divide-y divide-pq-neutral-200 max-h-96 overflow-y-auto">
                  {[...delivery.history].reverse().map((entry, idx) => {
                    const roleCfg = ROLE_ACTOR_STYLE[entry.actor_role] ?? 'bg-pq-neutral-100 text-pq-neutral-600 border-pq-neutral-200';
                    return (
                      <div key={entry.id} className={`px-5 py-4 ${idx === 0 ? 'bg-pq-neutral-50/60' : ''}`}>
                        <div className="flex items-start gap-3">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${
                            entry.status_to === 'delivered' ? 'bg-pq-success-1000' :
                            entry.status_to === 'delayed'   ? 'bg-pq-danger-1000' :
                            entry.status_to === 'in_transit'? 'bg-pq-warning-1000' :
                            entry.status_to === 'scheduled' ? 'bg-pq-primary-500' :
                            'bg-pq-neutral-300'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-sm font-semibold text-pq-neutral-900">{entry.actor_name}</span>
                              <span className={`text-xs border rounded px-1.5 py-0.5 font-medium ${roleCfg}`}>
                                {entry.actor_role}
                              </span>
                              {entry.status_to && (
                                <span className="text-xs text-pq-neutral-500">
                                  → <strong className="text-pq-neutral-900">{DELIVERY_STATUS_LABELS[entry.status_to]}</strong>
                                </span>
                              )}
                            </div>
                            {entry.note && (
                              <p className="text-sm text-pq-neutral-600 leading-relaxed">{entry.note}</p>
                            )}
                            {entry.scheduled_date && (
                              <p className="text-xs text-pq-primary-600 mt-1 flex items-center gap-1">
                                <CalendarDays className="w-3 h-3" />
                                {format(new Date(entry.scheduled_date), 'MMMM d, yyyy')}
                              </p>
                            )}
                            <p className="text-xs text-pq-neutral-400 mt-1">
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
      <Icon className="w-3.5 h-3.5 text-pq-neutral-400 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-pq-neutral-400 uppercase tracking-wide font-semibold">{label}</p>
        <p className="text-sm text-pq-neutral-800 mt-0.5 font-medium">{value}</p>
      </div>
    </div>
  );
}
