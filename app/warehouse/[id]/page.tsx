'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import { useAuth } from '@/context/AuthContext';
import { fetchPR1ById } from '@/lib/pr1';
import {
  openValidation,
  saveValidationProgress,
  submitValidationDecision,
  computeWarehouseItemRouting,
} from '@/lib/warehouse';
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
} from 'lucide-react';
import { format } from 'date-fns';

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

  const isReadOnly = Boolean(validation?.decision);

  useEffect(() => {
    if (!pr1Id || !profile) return;

    Promise.all([
      fetchPR1ById(pr1Id),
      openValidation(pr1Id, profile),
    ])
      .then(([pr1Data, valData]) => {
        setPR1(pr1Data);
        setValidation(valData);
        setFormValues(buildFormValues(valData));
      })
      .catch(() => setError('Failed to load validation data.'))
      .finally(() => setLoading(false));
  }, [pr1Id, profile]);

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

  const handleSaveProgress = async () => {
    if (!validation || !profile) return;
    setSaving(true);
    setGlobalError('');
    try {
      await saveValidationProgress(validation.id, formValues);
    } catch (err: unknown) {
      setGlobalError(err instanceof Error ? err.message : 'Failed to save progress.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!validation || !pr1 || !profile) return;
    setSubmitting(true);
    setGlobalError('');
    setConfirmSubmit(false);
    try {
      await submitValidationDecision(validation.id, pr1.id, formValues, profile);
      router.push('/warehouse');
    } catch (err: unknown) {
      setGlobalError(
        err instanceof Error ? err.message : 'Failed to submit validation.'
      );
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AppShell title="Warehouse Validation">
        <div className="flex items-center justify-center h-64">
          <LoadingState message="Loading..." />
        </div>
      </AppShell>
    );
  }

  if (error || !pr1 || !validation) {
    return (
      <AppShell title="Warehouse Validation">
        <div className="bg-red-50 border border-red-200 rounded-[4px] p-4 text-sm text-red-700">
          {error || 'Validation record not found.'}
        </div>
      </AppShell>
    );
  }

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

  const allItemsHaveSoh =
    formValues.items.length > 0 && routingRows.every(r => r !== null);
  const derivedDecision: WarehouseDecision | null = allItemsHaveSoh
    ? routingRows.every(r => r!.item_route === 'internal')
      ? 'sufficient'
      : 'insufficient'
    : null;

  return (
    <AppShell title="Warehouse Validation">
      {/* Outer wrapper: pad bottom when sticky panel is shown so content doesn't hide behind it */}
      {/* Back nav */}
      <div className="mb-2">
        <Link
          href="/warehouse"
          className="inline-flex items-center gap-1 text-xs text-[#40527A] hover:text-[#0F1F3A] transition"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Back to Queue
        </Link>
      </div>

      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#0F1F3A]">Validate PR1 {pr1.pr1_number}</h1>
            {isReadOnly && (
              <DecisionBadge decision={validation.decision!} />
            )}
          </div>
          <p className="text-sm text-[#40527A] mt-1">
            Submitted {pr1.submitted_at ? format(new Date(pr1.submitted_at), 'MMMM d, yyyy') : '—'}
          </p>
        </div>
        {!isReadOnly && (
          <button
            type="button"
            onClick={handleSaveProgress}
            disabled={saving || submitting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#D8E2FF] hover:border-[#0F1F3A] text-[#0F1F3A] text-sm font-medium rounded-[4px] transition disabled:opacity-50"
          >
            {saving ? (
              <span className="w-4 h-4 border-2 border-[#BFC7D5] border-t-[#0F1F3A] rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Progress
          </button>
        )}
      </div>

      <div className={`space-y-5 ${!isReadOnly ? 'pb-44' : ''}`}>
        {/* PR1 header summary */}
        <div className="bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#D8E2FF] bg-[#F7F9FC] flex items-center justify-between">
            <h2 className="text-xs font-semibold text-[#40527A] uppercase tracking-wide">Request Details</h2>
            <span className="text-xs text-[#BFC7D5] font-mono">{pr1.pr1_number}</span>
          </div>
          <div className="p-6 grid grid-cols-2 md:grid-cols-3 gap-5">
            <InfoField icon={User} label="Requisitioner" value={pr1.requisitioner_name_snapshot} />
            <InfoField icon={Building2} label="Department" value={pr1.department_name_snapshot} />
            <InfoField icon={FileText} label="PR1 Number" value={pr1.pr1_number} mono />
            <InfoField icon={Clock} label="Submitted" value={pr1.submitted_at ? format(new Date(pr1.submitted_at), 'MMMM d, yyyy') : '—'} />
            <InfoField icon={CalendarDays} label="Date Required" value={format(new Date(pr1.date_required), 'MMMM d, yyyy')} />
            <div />
            <div className="col-span-2 md:col-span-3">
              <p className="text-xs font-semibold text-[#40527A] uppercase tracking-wide mb-1">Purpose</p>
              <p className="text-sm text-[#0F1F3A]">{pr1.purpose}</p>
            </div>
          </div>
        </div>

        {/* Item validation grid */}
        <div className="bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#D8E2FF]">
            <h2 className="text-xs font-semibold text-[#40527A] uppercase tracking-wide">Item Validation</h2>
            <p className="text-xs text-[#BFC7D5] mt-0.5">
              Enter verified SOH from stock cards. Outcome per line is derived from verified SOH versus requested quantity.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#D8E2FF] bg-[#F7F9FC]">
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-[#40527A] uppercase tracking-wide w-8">#</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#40527A] uppercase tracking-wide w-24">Code</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#40527A] uppercase tracking-wide">Description</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-[#40527A] uppercase tracking-wide w-16">Unit</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-[#40527A] uppercase tracking-wide w-24">Req. SOH</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-[#40527A] uppercase tracking-wide w-28">Verified SOH</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-[#40527A] uppercase tracking-wide w-24">Req. Qty</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#40527A] uppercase tracking-wide min-w-[200px]">Outcome</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#40527A] uppercase tracking-wide">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8E2FF]">
                {formValues.items.map((item, idx) => {
                  const rowRoute = routingRows[idx];
                  const rowClass =
                    rowRoute?.item_route === 'procurement' ? 'bg-red-50/40' :
                    rowRoute?.item_route === 'partial' ? 'bg-amber-50/35' :
                    rowRoute?.item_route === 'internal' ? 'bg-emerald-50/30' : '';

                  return (
                    <tr key={item.id} className={`${rowClass} transition-colors`}>
                      <td className="px-4 py-3 text-center text-xs text-[#BFC7D5] font-mono">{item.item_order}</td>
                      <td className="px-4 py-3 font-mono text-xs text-[#40527A]">{item.item_code || '—'}</td>
                      <td className="px-4 py-3 text-[#0F1F3A] font-medium">{item.description}</td>
                      <td className="px-4 py-3 text-center text-[#40527A] text-xs">{item.unit_of_measure}</td>
                      <td className="px-4 py-3 text-right text-[#40527A] font-mono text-xs">
                        {item.requestor_soh.toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        {isReadOnly ? (
                          <span
                            className={`block text-right font-mono text-sm font-semibold ${
                              rowRoute?.item_route === 'internal'
                                ? 'text-emerald-700'
                                : rowRoute
                                  ? 'text-[#0F1F3A]'
                                  : 'text-[#BFC7D5]'
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
                            className="w-full px-2.5 py-1.5 border border-[#D8E2FF] bg-[#F7F9FC] rounded-md text-xs text-right focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] focus:border-[#D8E2FF] transition font-mono"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-[#0F1F3A]">
                        {item.quantity_requested.toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        <ItemOutcomeText route={rowRoute} />
                      </td>
                      <td className="px-3 py-2">
                        {isReadOnly ? (
                          <span className="text-xs text-[#40527A] italic">{item.item_notes || '—'}</span>
                        ) : (
                          <input
                            type="text"
                            value={item.item_notes}
                            onChange={e => setItem(idx, 'item_notes', e.target.value)}
                            placeholder="Optional note..."
                            className="w-full min-w-[140px] px-2.5 py-1.5 border border-[#D8E2FF] bg-[#F7F9FC] rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] focus:border-[#D8E2FF] transition"
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Overall notes */}
        <div className="bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#D8E2FF]">
            <h2 className="text-xs font-semibold text-[#40527A] uppercase tracking-wide">Warehouse Notes</h2>
          </div>
          <div className="p-6">
            {isReadOnly ? (
              <p className="text-sm text-[#0F1F3A]">{validation.notes || <span className="text-[#BFC7D5] italic">No notes added.</span>}</p>
            ) : (
              <textarea
                rows={3}
                value={formValues.notes}
                onChange={e => setFormValues(v => ({ ...v, notes: e.target.value }))}
                placeholder="Overall remarks, special instructions, or observations..."
                className="w-full px-3 py-2.5 border border-[#D8E2FF] bg-[#F7F9FC] rounded-[4px] text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] focus:border-transparent transition resize-none"
              />
            )}
          </div>
        </div>

        {/* Decision panel placeholder removed — moved to sticky footer below */}

        {/* Read-only: completed validation summary */}
        {isReadOnly && (
          <div className={`rounded-[4px] border overflow-hidden ${
            validation.decision === 'sufficient'
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-blue-50 border-blue-200'
          }`}>
            <div className="px-6 py-4">
              <div className="flex items-start gap-4">
                {validation.decision === 'sufficient' ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="w-6 h-6 text-blue-600 mt-0.5 shrink-0" />
                )}
                <div>
                  <p className={`text-sm font-semibold ${
                    validation.decision === 'sufficient' ? 'text-emerald-800' : 'text-blue-800'
                  }`}>
                    Validation complete —{' '}
                    {validation.decision === 'sufficient'
                      ? 'All lines fulfilled from stock. Request closed internally.'
                      : 'One or more lines need procurement or partial fulfillment. PR1 routed to approval workflow.'}
                  </p>
                  <p className="text-xs text-[#40527A] mt-1">
                    Validated by <strong>{validation.validator_name_snapshot}</strong>
                    {validation.validator_position_snapshot ? ` (${validation.validator_position_snapshot})` : ''}
                    {validation.validated_at ? ` · ${format(new Date(validation.validated_at), 'MMMM d, yyyy h:mm a')}` : ''}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sticky decision panel — visible only in edit mode */}
      {!isReadOnly && (
        <div className="sticky bottom-0 z-20 bg-white border-t border-[#D8E2FF]">
          <div className="px-6 py-4">
            {!allItemsHaveSoh ? (
              <div className="flex items-center gap-3 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <p className="text-sm">
                  Enter verified SOH for every line before submitting warehouse validation.
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
                  <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{globalError}</span>
                  </div>
                )}

                {confirmSubmit ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm text-[#40527A]">
                      Submit warehouse validation? PR outcome:{' '}
                      <strong
                        className={
                          derivedDecision === 'sufficient' ? 'text-emerald-700' : 'text-blue-700'
                        }
                      >
                        {derivedDecision === 'sufficient'
                          ? 'Resolve internally (all lines internal)'
                          : 'Route to approval / procurement'}
                      </strong>
                      . This cannot be undone.
                    </p>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="px-4 py-2 text-sm font-semibold text-white rounded-[4px] transition disabled:opacity-50 bg-[#0F1F3A] hover:bg-[#40527A]"
                    >
                      {submitting ? 'Submitting...' : 'Confirm submit'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmSubmit(false)}
                      disabled={submitting}
                      className="px-4 py-2 text-sm text-[#40527A] hover:text-[#0F1F3A] transition"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmSubmit(true)}
                    disabled={submitting || !derivedDecision}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0F1F3A] hover:bg-[#40527A] text-white text-sm font-semibold rounded-[4px] transition disabled:opacity-50"
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
    </AppShell>
  );
}

// ─── Small presentational components ─────────────────────────────────────────

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
        <Icon className="w-3.5 h-3.5 text-[#BFC7D5]" />
        <p className="text-xs font-semibold text-[#40527A] uppercase tracking-wide">{label}</p>
      </div>
      <p className={`text-sm text-[#0F1F3A] ${mono ? 'font-mono font-semibold' : 'font-medium'}`}>{value}</p>
    </div>
  );
}

function ItemOutcomeText({
  route,
}: {
  route: ReturnType<typeof computeWarehouseItemRouting> | null;
}) {
  if (!route) {
    return <span className="text-xs text-[#BFC7D5] italic">Enter verified SOH</span>;
  }
  if (route.item_route === 'internal') {
    return (
      <span className="text-xs text-emerald-800 leading-relaxed">
        <span className="font-semibold">Internal</span>
        {' · '}
        {route.internal_fulfilled_qty.toLocaleString()} fulfilled internally
      </span>
    );
  }
  if (route.item_route === 'procurement') {
    return (
      <span className="text-xs text-red-800 leading-relaxed">
        <span className="font-semibold">Procurement</span>
        {' · '}
        {route.procurement_qty.toLocaleString()} for procurement
      </span>
    );
  }
  return (
    <span className="text-xs text-amber-900 leading-relaxed">
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
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-100 border border-emerald-200 rounded-full px-3 py-1">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Validated — Sufficient
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-100 border border-blue-200 rounded-full px-3 py-1">
      <XCircle className="w-3.5 h-3.5" />
      Validated — Insufficient (approval)
    </span>
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
      <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-emerald-800">
            All {itemCount} line{itemCount !== 1 ? 's' : ''} can be fulfilled internally
          </p>
          <p className="text-xs text-emerald-700 mt-0.5">
            Submitting will close this PR1 internally. No approval workflow.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
      <XCircle className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
      <div>
        <p className="text-sm font-semibold text-blue-800">
          {procurementOrPartialCount} line{procurementOrPartialCount !== 1 ? 's' : ''} need procurement
          or partial fulfillment
        </p>
        <p className="text-xs text-blue-700 mt-0.5">
          Submitting will route this PR1 to the approval workflow (entire PR1, as today). Internal-only
          lines stay marked internal in this validation record.
        </p>
      </div>
    </div>
  );
}
