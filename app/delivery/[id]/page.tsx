'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useBackNavigation } from '@/hooks/use-back-navigation';
import AppShell from '@/components/layout/AppShell';
import { DetailPageSkeleton } from '@/components/shared/structural-skeletons';
import { useAuth } from '@/context/AuthContext';
import { fetchDeliveryById, procurementFollowUp, markDelivered } from '@/lib/delivery';
import { getDeliveryReceiptSignedUrl } from '@/lib/delivery-receipt-storage';
import { openGRNForDelivery, fetchGRNByDeliveryId } from '@/lib/grn';
import type { DeliveryWithHistory, DeliveryStatus } from '@/types/delivery';
import { DELIVERY_STATUS_LABELS } from '@/types/delivery';
import { format } from 'date-fns';
import { Truck, Building2, Package, CalendarDays, MapPin, Clock, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, Navigation, Ban, Calendar, MessageSquare, User, Send, ShieldCheck, PackageCheck } from 'lucide-react';
import RelatedRecords from '@/components/shared/RelatedRecords';
import DetailBackButton from '@/components/shared/DetailBackButton';
import DetailHeaderLayout from '@/components/shared/DetailHeaderLayout';
import DetailTitleRow from '@/components/shared/DetailTitleRow';
import DetailInfoField from '@/components/shared/DetailInfoField';
import { canViewCommercialPricing, formatCommercialAmount } from '@/lib/price-visibility';

const STATUS_CONFIG: Record<DeliveryStatus, {
  bg: string; text: string; border: string; icon: React.ElementType;
}> = {
  pending:    { bg: 'bg-pq-neutral-50',   text: 'text-pq-neutral-500',   border: 'border-pq-neutral-200',   icon: Clock },
  scheduled:  { bg: 'bg-pq-primary-50',    text: 'text-pq-primary-700',    border: 'border-pq-primary-200',    icon: Calendar },
  in_transit: { bg: 'bg-pq-warning-100',   text: 'text-pq-warning-600',   border: 'border-pq-warning-100',   icon: Navigation },
  delayed:    { bg: 'bg-pq-danger-100',     text: 'text-pq-danger-600',     border: 'border-pq-danger-100',     icon: AlertTriangle },
  delivered:  { bg: 'bg-pq-success-100', text: 'text-pq-success-600', border: 'border-pq-success-100', icon: CheckCircle2 },
  cancelled:  { bg: 'bg-pq-neutral-50',  text: 'text-pq-neutral-500',   border: 'border-pq-neutral-200',   icon: Ban },
};

const ROLE_ACTOR_STYLE: Record<string, string> = {
  supplier:    'bg-pq-primary-50 text-pq-primary-700 border-pq-primary-200',
  procurement: 'bg-teal-50 text-teal-700 border-teal-200',
  warehouse:   'bg-violet-50 text-violet-600 border-violet-200',
};

export default function DeliveryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const router = useRouter();
  const { handleBack } = useBackNavigation();

  const [delivery, setDelivery] = useState<DeliveryWithHistory | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [existingGrnId, setExistingGrnId] = useState<string | null>(null);

  // Procurement follow-up
  const [followNote, setFollowNote]     = useState('');
  const [followBusy, setFollowBusy]     = useState(false);
  const [followError, setFollowError]   = useState('');

  // Mark delivered
  const [deliveredNote, setDeliveredNote] = useState('');
  const [deliveredBusy, setDeliveredBusy] = useState(false);
  const [deliveredError, setDeliveredError] = useState('');

  // GRN open
  const [grnBusy, setGrnBusy] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    fetchDeliveryById(id)
      .then(async d => {
        if (!d) { setError('Delivery not found.'); return; }
        setDelivery(d);
        const existing = await fetchGRNByDeliveryId(d.id).catch(() => null);
        if (existing) setExistingGrnId(existing.id);
      })
      .catch(() => setError('Failed to load delivery.'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleFollowUp = async () => {
    if (!delivery || !profile) return;
    setFollowBusy(true);
    setFollowError('');
    try {
      await procurementFollowUp(delivery.id, { note: followNote }, profile);
      setFollowNote('');
      load();
    } catch (e: any) {
      setFollowError(e.message ?? 'Failed to save note.');
    } finally {
      setFollowBusy(false);
    }
  };

  const handleMarkDelivered = async () => {
    if (!delivery || !profile) return;
    setDeliveredBusy(true);
    setDeliveredError('');
    try {
      await markDelivered(delivery.id, deliveredNote, profile);
      setDeliveredNote('');
      load();
    } catch (e: any) {
      setDeliveredError(e.message ?? 'Failed to mark delivered.');
    } finally {
      setDeliveredBusy(false);
    }
  };

  if (loading) return (
    <AppShell title="Delivery Detail">
      <DetailPageSkeleton />
    </AppShell>
  );

  if (error || !delivery) return (
    <AppShell title="Delivery Detail">
      <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">
        {error || 'Delivery not found.'}
      </div>
    </AppShell>
  );

  const cfg    = STATUS_CONFIG[delivery.status];
  const Icon   = cfg.icon;
  const isProcurement = profile?.role === 'procurement';
  const isWarehouse   = profile?.role === 'warehouse';
  const canViewPrices = canViewCommercialPricing(profile);
  const canMarkDelivered = (isProcurement || isWarehouse) && delivery.status !== 'delivered' && delivery.status !== 'cancelled';
  const canFollowUp      = isProcurement && delivery.status !== 'delivered' && delivery.status !== 'cancelled';
  const canOpenGRN       = isWarehouse && delivery.status === 'delivered';

  const handleOpenGRN = async () => {
    if (!profile || !delivery) return;
    setGrnBusy(true);
    try {
      const grnId = await openGRNForDelivery(delivery.id, profile);
      router.push(`/grn/${grnId}`);
    } catch {
      setGrnBusy(false);
    }
  };

  return (
    <AppShell title={`Delivery — PO ${delivery.po_number_snapshot}`}>
      <DetailBackButton className="mb-2" onClick={() => handleBack({ role: profile?.role })} />

      {/* Header */}
      <DetailHeaderLayout
        wrap={true}
        left={
          <div>
            <DetailTitleRow wrap mb>
              <h1 className="text-xl font-bold text-pq-neutral-900 font-mono">{delivery.po_number_snapshot}</h1>
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold border rounded-full px-3 py-1 ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                <Icon className="w-3.5 h-3.5" />
                {DELIVERY_STATUS_LABELS[delivery.status]}
              </span>
            </DetailTitleRow>
            <p className="text-sm text-pq-neutral-500">{delivery.department_name_snapshot} · {delivery.purpose}</p>
            <div className="flex items-center gap-3 mt-1 text-xs text-pq-neutral-400 flex-wrap">
              <span className="font-mono">PR2 Ref: {delivery.pr2_number_snapshot}</span>
              <span className="font-mono">PR1 Ref: {delivery.pr1_number_snapshot}</span>
              <span className="font-mono">RFQ Ref: {delivery.rfq_number_snapshot}</span>
            </div>
          </div>
        }
        right={
          <>
            {/* GRN action button for warehouse */}
            {canOpenGRN && (
              <div>
                {existingGrnId ? (
                  <Link
                    href={`/grn/${existingGrnId}`}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-pq-success-600 hover:bg-pq-success-600 text-white text-sm font-semibold rounded-md transition"
                  >
                    <PackageCheck className="w-4 h-4" />
                    View GRN
                  </Link>
                ) : (
                  <button
                    onClick={handleOpenGRN}
                    disabled={grnBusy}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-pq-success-600 hover:bg-pq-success-600 text-white text-sm font-semibold rounded-md transition disabled:opacity-50"
                  >
                    <PackageCheck className="w-4 h-4" />
                    {grnBusy ? 'Opening...' : 'Receive Goods (GRN)'}
                  </button>
                )}
              </div>
            )}
            <div className="text-right">
              <p className="text-lg font-bold text-pq-neutral-900 font-mono">
                {formatCommercialAmount(delivery.grand_total, canViewPrices)}
              </p>
              <p className="text-xs text-pq-neutral-400">Grand Total</p>
            </div>
          </>
        }
      />

      {/* Related Records */}
      {profile && (
        <div className="mb-6">
          <RelatedRecords baseType="Delivery" baseId={delivery.id} role={profile.role} currentDocType="Delivery" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Delivery Info */}
          <div className="bg-white rounded-md border border-pq-neutral-200 p-5 space-y-4 order-2 lg:order-none">
            <h2 className="text-xs font-bold text-pq-neutral-500 uppercase tracking-wide">Delivery Info</h2>
            <DetailInfoField
              layout="inline"
              icon={<Building2 className="w-3.5 h-3.5 text-pq-neutral-400 mt-0.5 shrink-0" />}
              label="Supplier"
              value={delivery.supplier_name_snapshot}
            />
            <DetailInfoField
              layout="inline"
              icon={<User className="w-3.5 h-3.5 text-pq-neutral-400 mt-0.5 shrink-0" />}
              label="Requisitioner"
              value={delivery.requisitioner_name_snapshot}
            />
            <DetailInfoField
              layout="inline"
              icon={<Package className="w-3.5 h-3.5 text-pq-neutral-400 mt-0.5 shrink-0" />}
              label="Deliver To"
              value={delivery.warehouse}
            />
            <DetailInfoField
              layout="inline"
              icon={<MapPin className="w-3.5 h-3.5 text-pq-neutral-400 mt-0.5 shrink-0" />}
              label="Address"
              value={delivery.delivery_address}
            />

            {delivery.dr_document_filename && (
              <div className="mt-3">
                <div className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1">
                  Delivery Receipt
                </div>
                <div className="text-sm text-pq-neutral-900 flex flex-wrap items-center gap-3">
                  <span>{delivery.dr_document_filename}</span>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const path = delivery.dr_document_path;
                        if (!path) {
                          alert('Failed to open Delivery Receipt');
                          return;
                        }
                        const url = await getDeliveryReceiptSignedUrl(path);
                        window.open(url, '_blank', 'noopener,noreferrer');
                      } catch (e) {
                        console.error(e);
                        alert('Failed to open Delivery Receipt');
                      }
                    }}
                    className="text-pq-primary-600 hover:underline text-xs font-medium"
                  >
                    View
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Key Dates */}
          <div className="bg-white rounded-md border border-pq-neutral-200 p-5 space-y-4 order-3 lg:order-none">
            <h2 className="text-xs font-bold text-pq-neutral-500 uppercase tracking-wide">Key Dates</h2>
            {delivery.commitment_date && (
              <DetailInfoField
                layout="inline"
                icon={<CalendarDays className="w-3.5 h-3.5 text-pq-neutral-400 mt-0.5 shrink-0" />}
                label="Supplier Commitment"
                value={format(new Date(delivery.commitment_date), 'MMMM d, yyyy')}
              />
            )}
            {delivery.scheduled_date && (
              <DetailInfoField
                layout="inline"
                icon={<CalendarDays className="w-3.5 h-3.5 text-pq-neutral-400 mt-0.5 shrink-0" />}
                label="Scheduled Delivery"
                value={format(new Date(delivery.scheduled_date), 'MMMM d, yyyy')}
              />
            )}
            {delivery.actual_delivery_date && (
              <DetailInfoField
                layout="inline"
                icon={<CheckCircle2 className="w-3.5 h-3.5 text-pq-neutral-400 mt-0.5 shrink-0" />}
                label="Actual Delivery"
                value={format(new Date(delivery.actual_delivery_date), 'MMMM d, yyyy')}
              />
            )}
            {!delivery.commitment_date && !delivery.scheduled_date && (
              <p className="text-xs text-pq-neutral-400">No dates confirmed yet.</p>
            )}
          </div>

          {/* Procurement: Mark Delivered */}
          {canMarkDelivered && (
            <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-pq-neutral-200 bg-pq-success-100">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-pq-success-600" />
                  <h2 className="text-xs font-semibold text-pq-success-600 uppercase tracking-wide">Mark as Delivered</h2>
                </div>
                <p className="text-xs text-pq-success-600 mt-0.5">Confirm goods have been received at {delivery.warehouse}.</p>
              </div>
              <div className="p-5 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
                    Receipt Note <span className="font-normal text-pq-neutral-400 normal-case">(optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={deliveredNote}
                    onChange={e => setDeliveredNote(e.target.value)}
                    disabled={deliveredBusy}
                    placeholder="Condition of goods, any discrepancies..."
                    className="w-full px-3 py-2 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none disabled:opacity-50"
                  />
                </div>
                {deliveredError && (
                  <p className="text-xs text-pq-danger-600">{deliveredError}</p>
                )}
                <div className="flex justify-end">
                  <button
                    onClick={handleMarkDelivered}
                    disabled={deliveredBusy}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-pq-success-600 hover:bg-pq-success-600 text-white text-sm font-semibold rounded-md transition disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {deliveredBusy ? 'Saving...' : 'Confirm Delivery'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Procurement: Follow-up Note */}
          {canFollowUp && (
            <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-pq-neutral-200 bg-pq-neutral-50">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-pq-neutral-400" />
                  <h2 className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Follow-up Note</h2>
                </div>
                <p className="text-xs text-pq-neutral-400 mt-0.5">Add an internal procurement note or supplier follow-up.</p>
              </div>
              <div className="p-5 space-y-3">
                <textarea
                  rows={3}
                  value={followNote}
                  onChange={e => setFollowNote(e.target.value)}
                  disabled={followBusy}
                  placeholder="Called supplier — confirmed delivery for Thursday..."
                  className="w-full px-3 py-2 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] resize-none disabled:opacity-50"
                />
                {followError && <p className="text-xs text-pq-danger-600">{followError}</p>}
                <div className="flex justify-end">
                  <button
                    onClick={handleFollowUp}
                    disabled={followBusy || !followNote.trim()}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-pq-neutral-900 hover:bg-[#40527A] text-white text-sm font-semibold rounded-md transition disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {followBusy ? 'Saving...' : 'Add Note'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right column: Status History */}
        <div className="lg:col-span-1 order-1 lg:order-none">
          <div className="lg:sticky lg:top-20">
            <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-pq-neutral-200 bg-pq-neutral-50 flex items-center gap-2">
                <Truck className="w-3.5 h-3.5 text-pq-neutral-400" />
                <h2 className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                  Status History ({delivery.history.length})
                </h2>
              </div>
              {delivery.history.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm text-pq-neutral-400">No updates yet. Awaiting supplier.</p>
                </div>
              ) : (
                <div className="divide-y divide-pq-neutral-200 max-h-96 overflow-y-auto">
                  {[...delivery.history].reverse().map((entry, idx) => {
                    const roleCfg = ROLE_ACTOR_STYLE[entry.actor_role] ?? 'bg-pq-neutral-50 text-pq-neutral-500 border-pq-neutral-200';
                    return (
                      <div key={entry.id} className={`px-5 py-4 ${idx === 0 ? 'bg-pq-neutral-50' : ''}`}>
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                            entry.status_to === 'delivered' ? 'bg-pq-success-1000' :
                            entry.status_to === 'delayed'   ? 'bg-pq-danger-1000' :
                            entry.status_to === 'in_transit'? 'bg-pq-warning-1000' :
                            entry.status_to === 'scheduled' ? 'bg-pq-primary-500' :
                            'bg-pq-neutral-400'
                          } mt-1.5`} />
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
                              <p className="text-sm text-pq-neutral-500 leading-relaxed">{entry.note}</p>
                            )}
                            {entry.scheduled_date && (
                              <p className="text-xs text-pq-primary-600 mt-1 flex items-center gap-1">
                                <CalendarDays className="w-3 h-3" />
                                Scheduled: {format(new Date(entry.scheduled_date), 'MMMM d, yyyy')}
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
