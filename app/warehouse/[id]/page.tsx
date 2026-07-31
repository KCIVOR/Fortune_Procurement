'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import { DetailPageSkeleton } from '@/components/shared/structural-skeletons';
import { useAuth } from '@/context/AuthContext';
import { fetchPR1ById } from '@/lib/pr1';
import {
  openValidation,
  saveValidationProgress,
  submitValidationDecision,
  submitWarehouseTerminalAction,
  computeWarehouseItemRouting,
  fetchPR1RevisionRemarks,
} from '@/lib/warehouse';
import { fetchSuggestedPR2Sequence } from '@/lib/pr2';
import type { WarehouseTerminalAction } from '@/types/warehouse';
import type { PR1WithItems } from '@/types/pr1';
import type {
  WarehouseValidationWithItems,
  ValidationFormValues,
  ValidationItemDraft,
  WarehouseDecision,
} from '@/types/warehouse';
import {
  ChevronLeft,
  Save,
  CircleCheck as CheckCircle2,
  Circle as XCircle,
  TriangleAlert as AlertTriangle,
  User,
  Building2,
  FileText,
  CalendarDays,
  Clock,
  RotateCcw,
} from 'lucide-react';
import { format } from 'date-fns';
import RawMaterialBadge from '@/components/shared/RawMaterialBadge';
import RequestorRemarks from '@/components/shared/RequestorRemarks';
import { RequestTypeBadge } from '@/components/shared/RequestTypeBadge';
import { PR1AttachmentsGallery } from '@/components/pr1/PR1AttachmentsSection';
import RelatedRecords from '@/components/shared/RelatedRecords';

export default function WarehouseValidationPage() {
  const { id: pr1Id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const router = useRouter();

  const [pr1, setPR1] = useState<PR1WithItems | null>(null);
  const [validation, setValidation] = useState<WarehouseValidationWithItems | null>(null);
  const [formValues, setFormValues] = useState<ValidationFormValues>({
    items: [],
    notes: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [globalError, setGlobalError] = useState('');
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [pr2Number, setPr2Number] = useState('');
  const [suggestedPR2Sequence, setSuggestedPR2Sequence] = useState<string | null>(null);
  const [pendingTerminalAction, setPendingTerminalAction] = useState<WarehouseTerminalAction | null>(null);
  const [terminalRemarks, setTerminalRemarks] = useState('');
  const [revisionRemarks, setRevisionRemarks] = useState<{ remarks: string; actor: string } | null>(null);

  const isReadOnly = Boolean(validation?.decision);

  useEffect(() => {
    if (!pr1Id || !profile) return;

    Promise.all([
      fetchPR1ById(pr1Id),
      openValidation(pr1Id, profile),
      fetchPR1RevisionRemarks(pr1Id),
    ])
      .then(([pr1Data, valData, remarksData]) => {
        setPR1(pr1Data);
        setValidation(valData);
        setFormValues(buildFormValues(valData));
        setRevisionRemarks(remarksData);
      })
      .catch((err: { message?: string }) =>
        setError(err?.message ?? 'Failed to load validation data.'),
      )
      .finally(() => setLoading(false));
  }, [pr1Id, profile]);

  useEffect(() => {
    if (!confirmSubmit || !pr1 || (pr1.request_type !== 'goods' && pr1.request_type !== 'services')) return;
    const year = new Date().getFullYear();
    const prefix = `PR2-${year}-`;
    let cancelled = false;
    fetchSuggestedPR2Sequence(year)
      .then((suffix) => {
        if (cancelled) return;
        setSuggestedPR2Sequence(suffix);
        setPr2Number((current) => {
          const hasSuffix = current.startsWith(prefix) && current.slice(prefix.length).trim();
          return hasSuffix ? current : `${prefix}${suffix}`;
        });
      })
      .catch(() => {
        if (!cancelled) setSuggestedPR2Sequence(null);
      });
    return () => { cancelled = true; };
  }, [confirmSubmit, pr1]);

  const buildFormValues = (val: WarehouseValidationWithItems): ValidationFormValues => ({
    notes: val.notes,
    items: val.items.map(i => ({
      id:                 i.id,
      pr1_item_id:        i.pr1_item_id,
      item_order:         i.item_order,
      item_code:          i.item_code,
      description:        i.description,
      unit_of_measure:    i.unit_of_measure,
      requestor_soh:      i.requestor_soh,
      quantity_requested: i.quantity_requested,
      validated_soh:      i.validated_soh ?? '',
      item_notes:         i.item_notes,
      quantity_override_reason: i.quantity_override_reason ?? '',
    })),
  });

  const setItem = useCallback((idx: number, field: keyof ValidationItemDraft, val: unknown) => {
    setFormValues(v => ({
      ...v,
      items: v.items.map((item, i) => i === idx ? { ...item, [field]: val } : item),
    }));
  }, []);

  const handleValidatedSohChange = (idx: number, rawVal: string) => {
    const num = rawVal === '' ? '' : Number(rawVal);
    setItem(idx, 'validated_soh', num);
  };

  const handleQuantityRequestedChange = (idx: number, rawVal: string) => {
    const num = rawVal === '' ? 0 : Number(rawVal);
    setItem(idx, 'quantity_requested', num);
  };

  const handleSaveProgress = async () => {
    if (!validation || !profile) return;
    setSaving(true);
    setGlobalError('');
    try {
      await saveValidationProgress(validation.id, formValues, profile);
    } catch (err: unknown) {
      setGlobalError(err instanceof Error ? err.message : 'Failed to save progress.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!validation || !pr1 || !profile) return;
    if (willCreatePR2 && !getPR2Suffix(pr2Number).trim()) {
      setGlobalError('Enter a PR2 number before submitting.');
      return;
    }
    setSubmitting(true);
    setGlobalError('');
    setConfirmSubmit(false);
    try {
      const result = await submitValidationDecision(
        validation.id,
        pr1.id,
        formValues,
        profile,
        willCreatePR2 ? { pr2Number } : undefined,
      );
      if (result.pr2Id) {
        router.push(`/pr2/${result.pr2Id}`);
      } else {
        router.push('/warehouse');
      }
    } catch (err: unknown) {
      setGlobalError(
        err instanceof Error ? err.message : 'Failed to submit validation.'
      );
      setSubmitting(false);
    }
  };

  const handleTerminalAction = async () => {
    if (!validation || !pr1 || !profile || !pendingTerminalAction) return;
    if (!terminalRemarks.trim()) {
      setGlobalError('Remarks are required when rejecting or requesting revision.');
      return;
    }
    setSubmitting(true);
    setGlobalError('');
    try {
      await submitWarehouseTerminalAction(
        validation.id,
        pr1.id,
        pendingTerminalAction,
        terminalRemarks,
        profile,
      );
      router.push('/warehouse');
    } catch (err: unknown) {
      setGlobalError(
        err instanceof Error ? err.message : 'Failed to submit action.'
      );
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AppShell title="Warehouse Validation">
        <DetailPageSkeleton />
      </AppShell>
    );
  }

  if (error || !pr1 || !validation) {
    return (
      <AppShell title="Warehouse Validation">
        <div className="bg-pq-danger-50 border border-pq-danger-200 rounded-md p-4 text-sm text-pq-danger-900">
          {error || 'Validation record not found.'}
        </div>
      </AppShell>
    );
  }

  const isServices = pr1.request_type === 'services';
  const currentYear = new Date().getFullYear();
  const pr2Prefix = `PR2-${currentYear}-`;

  const getPR2Suffix = (full: string) => {
    if (full.startsWith(pr2Prefix)) return full.slice(pr2Prefix.length);
    const match = full.match(/^PR2-\d{4}-(.*)$/i);
    return match ? match[1] : full;
  };

  const setPR2Suffix = (suffix: string) => {
    const clean = suffix.replace(/^PR2-\d{4}-/i, '').replace(/\D/g, '');
    setPr2Number(pr2Prefix + clean);
  };

  const routingRows = formValues.items.map(item => {
    const sohRaw = item.validated_soh;
    if (sohRaw === '' || sohRaw === null || sohRaw === undefined) return null;
    const soh = Number(sohRaw);
    if (!Number.isFinite(soh) || soh < 0) return null;
    try {
      return computeWarehouseItemRouting(soh, item.quantity_requested);
    } catch {
      return null;
    }
  });

  // Phase 4 (Raw Mats): map pr1_item_id → is_raw_material so each validation
  // row can render the badge. The flag lives on `pr1.items`, not on the
  // warehouse_validation_items row, so we look it up at render time.
  const pr1RawMatMap: Record<string, boolean> = {};
  for (const it of pr1.items ?? []) {
    pr1RawMatMap[it.id] = it.is_raw_material === true;
  }

  // Original per-line quantity as the requestor submitted it — used to detect
  // and flag warehouse overrides. `pr1.items` is immutable, unlike the
  // working `quantity_requested` copy on the validation row.
  const pr1QtyMap: Record<string, number> = {};
  for (const it of pr1.items ?? []) {
    pr1QtyMap[it.id] = it.quantity_requested;
  }

  const isQtyOverridden = (item: ValidationItemDraft) => {
    const original = pr1QtyMap[item.pr1_item_id];
    return typeof original === 'number' && Number(item.quantity_requested) !== original;
  };

  const overriddenItemsMissingReason = formValues.items.filter(
    item => isQtyOverridden(item) && !item.quantity_override_reason.trim()
  );

  const allItemsHaveSoh =
    formValues.items.length > 0 && routingRows.every(r => r !== null);
  const derivedDecision: WarehouseDecision | null = allItemsHaveSoh
    ? routingRows.every(r => r!.item_route === 'internal')
      ? 'sufficient'
      : 'insufficient'
    : null;

  const willCreatePR2 = derivedDecision === 'insufficient';

  return (
    <AppShell title="Warehouse Validation">
      {/* Outer wrapper: pad bottom when sticky panel is shown so content doesn't hide behind it */}
      {/* Back nav */}
      <div className="mb-2">
        <Link
          href="/warehouse"
          className="inline-flex items-center gap-1 text-xs text-pq-neutral-700 hover:text-pq-neutral-900 transition"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Back to Queue
        </Link>
      </div>

      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-pq-neutral-900">Validate {pr1.pr1_number}</h1>
            <RequestTypeBadge type={pr1.request_type ?? 'goods'} />
            {isReadOnly && (
              <DecisionBadge decision={validation.decision!} />
            )}
          </div>
          <p className="text-sm text-pq-neutral-700 mt-1">
            Submitted {pr1.submitted_at ? format(new Date(pr1.submitted_at), 'MMMM d, yyyy') : '—'}
          </p>
        </div>
        {!isReadOnly && (
          <button
            type="button"
            onClick={handleSaveProgress}
            disabled={saving || submitting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-pq-white border border-pq-neutral-200 hover:border-pq-neutral-300 text-pq-neutral-900 text-sm font-medium rounded-md transition disabled:opacity-50"
          >
            {saving ? (
              <span className="w-4 h-4 border-2 border-pq-neutral-400 border-t-pq-neutral-900 rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Progress
          </button>
        )}
      </div>

      <div className="space-y-5">
        {/* Banner for PR2 revision request */}
        {revisionRemarks && !isReadOnly && (
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 shadow-sm flex gap-3 items-start mb-6">
            <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-orange-900 m-0">Revision Requested by {revisionRemarks.actor}</h3>
              <div className="text-sm text-orange-800 mt-1 whitespace-pre-wrap">
                {revisionRemarks.remarks}
              </div>
            </div>
          </div>
        )}

        {/* Related Records Panel */}
        {profile && (
          <RelatedRecords baseType="PR1" baseId={pr1Id} role={profile.role} currentDocType="PR1" />
        )}

        {/* PR1 header summary */}
        <div className="bg-pq-white rounded-md border border-pq-neutral-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-pq-neutral-200 bg-pq-neutral-50 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-pq-neutral-700 uppercase tracking-wide">Request Details</h2>
            <span className="text-xs text-pq-neutral-400 font-mono">{pr1.pr1_number}</span>
          </div>
          <div className="p-6 grid grid-cols-2 md:grid-cols-3 gap-5">
            <InfoField icon={User} label="Requisitioner" value={pr1.requisitioner_name_snapshot} />
            <InfoField icon={Building2} label="Department" value={pr1.department_name_snapshot} />
            <InfoField icon={FileText} label="PR1 Number" value={pr1.pr1_number} mono />
            <InfoField icon={Clock} label="Submitted" value={pr1.submitted_at ? format(new Date(pr1.submitted_at), 'MMMM d, yyyy') : '—'} />
            <InfoField icon={CalendarDays} label="Date Required" value={format(new Date(pr1.date_required), 'MMMM d, yyyy')} />
            <div />
            <div className="col-span-2 md:col-span-3">
              <p className="text-xs font-semibold text-pq-neutral-700 uppercase tracking-wide mb-1">Purpose</p>
              <p className="text-sm text-pq-neutral-900">{pr1.purpose}</p>
            </div>
          </div>
        </div>

        {/* Item validation grid */}
        <div className="bg-pq-white rounded-md border border-pq-neutral-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-pq-neutral-200">
            <h2 className="text-xs font-semibold text-pq-neutral-700 uppercase tracking-wide">Item Validation</h2>
            <p className="text-xs text-pq-neutral-400 mt-0.5">
              Enter available quantity per line. Lines fully covered internally skip procurement; the rest are routed out.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pq-neutral-200 bg-pq-neutral-50">
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-pq-neutral-700 uppercase tracking-wide w-8">#</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-pq-neutral-700 uppercase tracking-wide w-24">Code</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-pq-neutral-700 uppercase tracking-wide">Description</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-pq-neutral-700 uppercase tracking-wide w-20">Type</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-pq-neutral-700 uppercase tracking-wide w-16">Unit</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-pq-neutral-700 uppercase tracking-wide w-24">Req. SOH</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-pq-neutral-700 uppercase tracking-wide w-28">Available Qty</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-pq-neutral-700 uppercase tracking-wide w-40">Req. Qty</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-pq-neutral-700 uppercase tracking-wide min-w-[200px]">Outcome</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-pq-neutral-700 uppercase tracking-wide">Notes</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-pq-neutral-700 uppercase tracking-wide w-32">Attachments</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pq-neutral-200">
                {formValues.items.map((item, idx) => {
                  const rowRoute = routingRows[idx];
                  const rowClass =
                    rowRoute?.item_route === 'procurement' ? 'bg-pq-danger-50/40' :
                    rowRoute?.item_route === 'partial' ? 'bg-pq-warning-50' :
                    rowRoute?.item_route === 'internal' ? 'bg-pq-success-50' : '';

                  return (
                    <tr key={item.id} className={`${rowClass} transition-colors`}>
                      <td className="px-4 py-3 text-center text-xs text-pq-neutral-400 font-mono">{item.item_order}</td>
                      <td className="px-4 py-3 font-mono text-xs text-pq-neutral-700">{item.item_code || '—'}</td>
                      <td className="px-4 py-3 text-pq-neutral-900 font-medium">
                        {item.description}
                        {(() => {
                          const remarks = pr1.items?.find(i => i.id === item.pr1_item_id)?.remarks;
                          return remarks ? <RequestorRemarks text={remarks} /> : null;
                        })()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isServices ? (
                          <span className="text-xs text-pq-neutral-300">—</span>
                        ) : pr1RawMatMap[item.pr1_item_id] ? (
                          <RawMaterialBadge isRawMaterial size="sm" />
                        ) : (
                          <span className="text-xs text-pq-neutral-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-pq-neutral-700 text-xs">{item.unit_of_measure}</td>
                      <td className="px-4 py-3 text-right text-pq-neutral-700 font-mono text-xs">
                        {isServices
                          ? <span className="italic text-pq-neutral-400">N/A</span>
                          : item.requestor_soh.toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        {isReadOnly ? (
                          <span
                            className={`block text-right font-mono text-sm font-semibold ${
                              rowRoute?.item_route === 'internal'
                                ? 'text-pq-success-900'
                                : rowRoute
                                  ? 'text-pq-neutral-900'
                                  : 'text-pq-neutral-400'
                            }`}
                          >
                            {item.validated_soh !== '' && item.validated_soh !== null
                              ? Number(item.validated_soh).toLocaleString()
                              : '—'}
                          </span>
                        ) : (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.validated_soh}
                            onChange={e => handleValidatedSohChange(idx, e.target.value)}
                            placeholder="0"
                            className="w-full px-2.5 py-1.5 border border-pq-neutral-200 bg-pq-neutral-50 rounded-md text-xs text-right focus:outline-none focus:ring-1 focus:ring-pq-primary-600 focus:border-pq-neutral-200 transition font-mono"
                          />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {isReadOnly ? (
                          <div className="text-right">
                            <span className="block font-mono text-sm font-semibold text-pq-neutral-900">
                              {item.quantity_requested.toLocaleString()}
                            </span>
                            {isQtyOverridden(item) && (() => {
                              const raw = validation.items.find(vi => vi.id === item.id);
                              return (
                                <p className="text-xs text-orange-700 italic mt-0.5 text-left">
                                  Adjusted from {pr1QtyMap[item.pr1_item_id]?.toLocaleString()}
                                  {raw?.quantity_overridden_by_name_snapshot ? ` by ${raw.quantity_overridden_by_name_snapshot}` : ''}
                                  {raw?.quantity_override_reason ? ` — ${raw.quantity_override_reason}` : ''}
                                </p>
                              );
                            })()}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.quantity_requested}
                              onChange={e => handleQuantityRequestedChange(idx, e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-pq-neutral-200 bg-pq-neutral-50 rounded-md text-xs text-right focus:outline-none focus:ring-1 focus:ring-pq-primary-600 focus:border-pq-neutral-200 transition font-mono"
                            />
                            {isQtyOverridden(item) && (
                              <input
                                type="text"
                                value={item.quantity_override_reason}
                                onChange={e => setItem(idx, 'quantity_override_reason', e.target.value)}
                                placeholder={`Reason for changing from ${pr1QtyMap[item.pr1_item_id]?.toLocaleString()} (required)`}
                                className="w-full px-2 py-1 border border-orange-300 bg-orange-50 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-pq-primary-600 transition"
                              />
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <ItemOutcomeText route={rowRoute} />
                      </td>
                      <td className="px-3 py-2">
                        {isReadOnly ? (
                          <span className="text-xs text-pq-neutral-700 italic">{item.item_notes || '—'}</span>
                        ) : (
                          <input
                            type="text"
                            value={item.item_notes}
                            onChange={e => setItem(idx, 'item_notes', e.target.value)}
                            placeholder="Optional note..."
                            className="w-full min-w-[140px] px-2.5 py-1.5 border border-pq-neutral-200 bg-pq-neutral-50 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-pq-primary-600 focus:border-pq-neutral-200 transition"
                          />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {(() => {
                          const item_obj = pr1.items?.find(i => i.id === item.pr1_item_id);
                          const atts = item_obj?.attachments ?? [];
                          return atts.length > 0 ? (
                            <PR1AttachmentsGallery attachments={atts} />
                          ) : (
                            <span className="text-xs text-pq-neutral-300">—</span>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Overall notes */}
        <div className="bg-pq-white rounded-md border border-pq-neutral-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-pq-neutral-200">
            <h2 className="text-xs font-semibold text-pq-neutral-700 uppercase tracking-wide">Warehouse Notes</h2>
          </div>
          <div className="p-6">
            {isReadOnly ? (
              <p className="text-sm text-pq-neutral-900">{validation.notes || <span className="text-pq-neutral-400 italic">No notes added.</span>}</p>
            ) : (
              <textarea
                rows={3}
                value={formValues.notes}
                onChange={e => setFormValues(v => ({ ...v, notes: e.target.value }))}
                placeholder="Overall remarks, special instructions, or observations..."
                className="w-full px-3 py-2.5 border border-pq-neutral-200 bg-pq-neutral-50 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-pq-primary-600 focus:border-transparent transition resize-none"
              />
            )}
          </div>
        </div>

        {/* Read-only: completed validation summary */}
        {isReadOnly && (
          <ValidationCompleteBanner validation={validation} />
        )}

        {/* Return to requestor — reject / revision without SOH */}
        {!isReadOnly && (
          <div className="bg-pq-white rounded-md border border-pq-neutral-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-pq-neutral-200">
              <h2 className="text-xs font-semibold text-pq-neutral-700 uppercase tracking-wide">
                Return to Requestor
              </h2>
              <p className="text-xs text-pq-neutral-400 mt-0.5">
                Reject the request or send it back for revision. Remarks are required.
              </p>
            </div>
            <div className="px-6 py-4 space-y-3">
              <textarea
                rows={2}
                value={terminalRemarks}
                onChange={e => setTerminalRemarks(e.target.value)}
                placeholder="Reason for rejection or required changes..."
                className="w-full px-3 py-2.5 border border-pq-neutral-200 bg-pq-neutral-50 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-pq-primary-600 focus:border-transparent transition resize-none"
              />

              {pendingTerminalAction ? (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm text-pq-neutral-700">
                    Confirm{' '}
                    <strong
                      className={
                        pendingTerminalAction === 'rejected'
                          ? 'text-pq-danger-600'
                          : 'text-orange-700'
                      }
                    >
                      {pendingTerminalAction === 'rejected' ? 'Reject PR1' : 'Request Revision'}
                    </strong>
                    ? This cannot be undone.
                  </p>
                  <button
                    type="button"
                    onClick={handleTerminalAction}
                    disabled={submitting}
                    className={`px-4 py-2 text-sm font-semibold text-white rounded-md transition disabled:opacity-50 ${
                      pendingTerminalAction === 'rejected'
                        ? 'bg-pq-danger-600 hover:bg-pq-danger-600'
                        : 'bg-orange-500 hover:bg-orange-600'
                    }`}
                  >
                    {submitting ? 'Submitting...' : 'Confirm'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingTerminalAction(null)}
                    disabled={submitting}
                    className="px-4 py-2 text-sm text-pq-neutral-700 hover:text-pq-neutral-900 transition"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <TerminalActionButton
                    icon={RotateCcw}
                    label="Request Revision"
                    variant="revise"
                    onClick={() => {
                      setGlobalError('');
                      setConfirmSubmit(false);
                      setPendingTerminalAction('revision_requested');
                    }}
                    disabled={submitting}
                  />
                  <TerminalActionButton
                    icon={XCircle}
                    label="Reject"
                    variant="reject"
                    onClick={() => {
                      setGlobalError('');
                      setConfirmSubmit(false);
                      setPendingTerminalAction('rejected');
                    }}
                    disabled={submitting}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Decision panel — visible only in edit mode */}
        {!isReadOnly && (
          <div className="bg-pq-white rounded-md border border-pq-neutral-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-pq-neutral-200">
              <h2 className="text-xs font-semibold text-pq-neutral-700 uppercase tracking-wide">
                Stock Validation
              </h2>
              <p className="text-xs text-pq-neutral-400 mt-0.5">
              Enter available quantity for every line, then submit the validation outcome.
              </p>
            </div>
            <div className="px-6 py-4">
              {!allItemsHaveSoh ? (
                <div className="flex items-center gap-3 text-pq-warning-900 bg-pq-warning-50 border border-pq-warning-200 rounded-lg px-4 py-3">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <p className="text-sm">
                    Enter verified SOH for every line before submitting warehouse validation.
                  </p>
                </div>
              ) : overriddenItemsMissingReason.length > 0 ? (
                <div className="flex items-center gap-3 text-orange-800 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <p className="text-sm">
                    Enter a reason for every line where the requested quantity was changed.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {derivedDecision && (
                    <SubmitOutcomePreview
                      decision={derivedDecision}
                      itemCount={formValues.items.length}
                      procurementOrPartialCount={
                        routingRows.filter(
                          r => r && (r.item_route === 'procurement' || r.item_route === 'partial')
                        ).length
                      }
                    />
                  )}

                  {globalError && (
                    <div className="flex items-start gap-3 bg-pq-danger-50 border border-pq-danger-200 text-pq-danger-900 text-sm rounded-lg px-4 py-3">
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>{globalError}</span>
                    </div>
                  )}

                  {confirmSubmit ? (
                    <div className="space-y-3">
                      <p className="text-sm text-pq-neutral-700">
                        Submit warehouse validation? PR outcome:{' '}
                        <strong
                          className={
                            derivedDecision === 'sufficient' ? 'text-pq-success-900' : 'text-pq-primary-600'
                          }
                        >
                          {derivedDecision === 'sufficient'
                            ? 'Resolve internally (all lines internal)'
                            : willCreatePR2
                              ? 'Create PR2 and start approval'
                              : 'Route to approval / procurement'}
                        </strong>
                        . This cannot be undone.
                      </p>
                      {willCreatePR2 && (
                        <div>
                          <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
                            PR2 Number <span className="text-pq-danger-600">*</span>
                          </label>
                          <div className="flex items-center border border-pq-neutral-200 rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-[#1E4BFF]">
                            <div className="px-3 py-2 bg-pq-neutral-50 border-r border-pq-neutral-200 text-sm font-mono text-pq-neutral-400 whitespace-nowrap select-none">
                              {pr2Prefix}
                            </div>
                            <input
                              type="text"
                              value={getPR2Suffix(pr2Number)}
                              onChange={(e) => setPR2Suffix(e.target.value)}
                              placeholder={suggestedPR2Sequence ?? '0001'}
                              className="flex-1 px-3 py-2 border-0 text-sm font-mono focus:outline-none"
                            />
                          </div>
                          <p className="mt-1 text-xs text-pq-neutral-400">
                            {suggestedPR2Sequence
                              ? `Suggested: ${pr2Prefix}${suggestedPR2Sequence} — you may edit this number.`
                              : 'Enter a 4-digit sequence (e.g. 0001).'}
                          </p>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={handleSubmit}
                          disabled={submitting || (willCreatePR2 && !getPR2Suffix(pr2Number).trim())}
                          className="px-4 py-2 text-sm font-semibold text-white rounded-md transition disabled:opacity-50 bg-pq-neutral-900 hover:bg-pq-neutral-700"
                        >
                          {submitting ? 'Submitting...' : 'Confirm submit'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmSubmit(false)}
                          disabled={submitting}
                          className="px-4 py-2 text-sm text-pq-neutral-700 hover:text-pq-neutral-900 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmSubmit(true)}
                      disabled={submitting || !derivedDecision}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-pq-neutral-900 hover:bg-pq-neutral-700 text-white text-sm font-semibold rounded-md transition disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Submit Warehouse Validation
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

// Small presentational components

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
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5 text-pq-neutral-400" />
        <p className="text-xs font-semibold text-pq-neutral-700 uppercase tracking-wide">{label}</p>
      </div>
      <p className={`text-sm text-pq-neutral-900 ${mono ? 'font-mono font-semibold' : 'font-medium'}`}>{value}</p>
    </div>
  );
}

function ItemOutcomeText({
  route,
}: {
  route: ReturnType<typeof computeWarehouseItemRouting> | null;
}) {
  if (!route) {
    return <span className="text-xs text-pq-neutral-400 italic">Enter verified SOH</span>;
  }
  if (route.item_route === 'internal') {
    return (
      <span className="text-xs text-pq-success-900 leading-relaxed">
        <span className="font-semibold">Internal</span>
        {' · '}
        {route.internal_fulfilled_qty.toLocaleString()} fulfilled internally
      </span>
    );
  }
  if (route.item_route === 'procurement') {
    return (
      <span className="text-xs text-pq-danger-900 leading-relaxed">
        <span className="font-semibold">Procurement</span>
        {' · '}
        {route.procurement_qty.toLocaleString()} for procurement
      </span>
    );
  }
  return (
    <span className="text-xs text-pq-warning-900 leading-relaxed">
      <span className="font-semibold">Partial</span>
      {' · '}
      {route.internal_fulfilled_qty.toLocaleString()} internal /{' '}
      {route.procurement_qty.toLocaleString()} procurement
    </span>
  );
}

function DecisionBadge({ decision }: { decision: WarehouseDecision }) {
  if (decision === 'sufficient') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-pq-success-900 bg-pq-success-50 border border-pq-success-200 rounded-full px-3 py-1">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Validated — Sufficient
      </span>
    );
  }
  if (decision === 'insufficient') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-pq-primary-600 bg-pq-primary-50 border border-pq-primary-200 rounded-full px-3 py-1">
        <XCircle className="w-3.5 h-3.5" />
        Validated — Insufficient (approval)
      </span>
    );
  }
  if (decision === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-pq-danger-600 bg-pq-danger-50 border border-pq-danger-200 rounded-full px-3 py-1">
        <XCircle className="w-3.5 h-3.5" />
        Rejected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-3 py-1">
      <RotateCcw className="w-3.5 h-3.5" />
      Revision Requested
    </span>
  );
}

function ValidationCompleteBanner({
  validation,
}: {
  validation: WarehouseValidationWithItems;
}) {
  const decision = validation.decision!;
  const meta = (
    <p className="text-xs text-pq-neutral-700 mt-1">
      {decision === 'rejected' || decision === 'revision_requested' ? 'Action' : 'Validated'} by{' '}
      <strong>{validation.validator_name_snapshot}</strong>
      {validation.validator_position_snapshot ? ` (${validation.validator_position_snapshot})` : ''}
      {validation.validated_at ? ` · ${format(new Date(validation.validated_at), 'MMMM d, yyyy h:mm a')}` : ''}
      {validation.notes ? (
        <>
          <br />
          <span className="italic">Remarks: {validation.notes}</span>
        </>
      ) : null}
    </p>
  );

  if (decision === 'sufficient') {
    return (
      <div className="rounded-md border overflow-hidden bg-pq-success-50 border-pq-success-200">
        <div className="px-6 py-4 flex items-start gap-4">
          <CheckCircle2 className="w-6 h-6 text-pq-success-900 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-pq-success-900">
              Validation complete — all lines fulfilled from stock. Request closed internally.
            </p>
            {meta}
          </div>
        </div>
      </div>
    );
  }
  if (decision === 'insufficient') {
    return (
      <div className="rounded-md border overflow-hidden bg-pq-primary-50 border-pq-primary-200">
        <div className="px-6 py-4 flex items-start gap-4">
          <XCircle className="w-6 h-6 text-pq-primary-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-pq-primary-600">
              Validation complete — one or more lines need procurement. PR1 routed to approval workflow.
            </p>
            {meta}
          </div>
        </div>
      </div>
    );
  }
  if (decision === 'rejected') {
    return (
      <div className="rounded-md border overflow-hidden bg-pq-danger-50 border-pq-danger-200">
        <div className="px-6 py-4 flex items-start gap-4">
          <XCircle className="w-6 h-6 text-pq-danger-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-pq-danger-600">
              PR1 rejected by warehouse. The request is closed.
            </p>
            {meta}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-md border overflow-hidden bg-orange-50 border-orange-200">
      <div className="px-6 py-4 flex items-start gap-4">
        <RotateCcw className="w-6 h-6 text-orange-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-orange-800">
            Revision requested. The requisitioner must edit and resubmit.
          </p>
          {meta}
        </div>
      </div>
    </div>
  );
}

function TerminalActionButton({
  icon: Icon,
  label,
  variant,
  onClick,
  disabled,
}: {
  icon: React.ElementType;
  label: string;
  variant: 'revise' | 'reject';
  onClick: () => void;
  disabled: boolean;
}) {
  const styles = {
    revise: 'bg-white hover:bg-orange-50 text-orange-600 border-orange-300 hover:border-orange-400',
    reject: 'bg-white hover:bg-pq-danger-50 text-pq-danger-600 border-red-300 hover:border-red-400',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-md border transition disabled:opacity-50 ${styles[variant]}`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function SubmitOutcomePreview({
  decision,
  itemCount,
  procurementOrPartialCount,
}: {
  decision: WarehouseDecision;
  itemCount: number;
  procurementOrPartialCount: number;
}) {
  if (decision === 'sufficient') {
    return (
      <div className="flex items-start gap-3 bg-pq-success-50 border border-pq-success-200 rounded-lg px-4 py-3">
        <CheckCircle2 className="w-4 h-4 text-pq-success-900 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-pq-success-900">
            All {itemCount} line{itemCount !== 1 ? 's' : ''} can be fulfilled internally
          </p>
          <p className="text-xs text-pq-success-900 mt-0.5">
            Submitting will close this PR1 internally. No approval workflow.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 bg-pq-primary-50 border border-pq-primary-200 rounded-lg px-4 py-3">
      <XCircle className="w-4 h-4 text-pq-primary-600 mt-0.5 shrink-0" />
      <div>
        <p className="text-sm font-semibold text-pq-primary-600">
          {procurementOrPartialCount} line{procurementOrPartialCount !== 1 ? 's' : ''} need procurement
          or partial fulfillment
        </p>
        <p className="text-xs text-pq-primary-600 mt-0.5">
          Submitting will route this PR1 to the approval workflow (entire PR1, as today). Internal-only
          lines stay marked internal in this validation record.
        </p>
      </div>
    </div>
  );
}

