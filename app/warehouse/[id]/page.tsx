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
} from '@/lib/warehouse';
import type { PR1WithItems } from '@/types/pr1';
import type {
  WarehouseValidationWithItems,
  ValidationFormValues,
  ValidationItemDraft,
  WarehouseDecision,
  ItemAvailability,
} from '@/types/warehouse';
import { ChevronLeft, Save, CircleCheck as CheckCircle2, Circle as XCircle, TriangleAlert as AlertTriangle, User, Building2, FileText, CalendarDays, Clock } from 'lucide-react';
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
    decision: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [globalError, setGlobalError] = useState('');
  const [confirmDecision, setConfirmDecision] = useState<WarehouseDecision | null>(null);

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
    notes:    val.notes,
    decision: val.decision,
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
      availability:       i.availability,
      item_notes:         i.item_notes,
    })),
  });

  const setItem = useCallback((idx: number, field: keyof ValidationItemDraft, val: unknown) => {
    setFormValues(v => ({
      ...v,
      items: v.items.map((item, i) => i === idx ? { ...item, [field]: val } : item),
    }));
  }, []);

  // Auto-derive availability when validated_soh is entered
  const handleValidatedSohChange = (idx: number, rawVal: string) => {
    const num = rawVal === '' ? '' : Number(rawVal);
    setItem(idx, 'validated_soh', num);
    if (rawVal !== '') {
      const qty = formValues.items[idx].quantity_requested;
      const soh = Number(rawVal);
      const auto: ItemAvailability = soh >= qty ? 'available' : 'unavailable';
      setItem(idx, 'availability', auto);
    }
  };

  const handleSaveProgress = async () => {
    if (!validation || !profile) return;
    setSaving(true);
    setGlobalError('');
    try {
      await saveValidationProgress(validation.id, formValues);
    } catch (err: any) {
      setGlobalError(err.message ?? 'Failed to save progress.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitDecision = async (decision: WarehouseDecision) => {
    if (!validation || !pr1 || !profile) return;
    setSubmitting(true);
    setGlobalError('');
    setConfirmDecision(null);
    try {
      await submitValidationDecision(
        validation.id,
        pr1.id,
        formValues,
        decision,
        profile
      );
      router.push('/warehouse');
    } catch (err: any) {
      setGlobalError(err.message ?? 'Failed to submit decision.');
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

  const allItemsReviewed = formValues.items.every(i => i.availability !== null);
  const anyUnavailable = formValues.items.some(i => i.availability === 'unavailable');
  const derivedDecision: WarehouseDecision = anyUnavailable ? 'insufficient' : 'sufficient';

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
              Enter verified SOH from stock cards. Availability is auto-set but can be overridden.
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
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-[#40527A] uppercase tracking-wide w-32">Availability</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#40527A] uppercase tracking-wide">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8E2FF]">
                {formValues.items.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={`${
                      item.availability === 'unavailable' ? 'bg-red-50/40' :
                      item.availability === 'available' ? 'bg-emerald-50/30' : ''
                    } transition-colors`}
                  >
                    <td className="px-4 py-3 text-center text-xs text-[#BFC7D5] font-mono">{item.item_order}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[#40527A]">{item.item_code || '—'}</td>
                    <td className="px-4 py-3 text-[#0F1F3A] font-medium">{item.description}</td>
                    <td className="px-4 py-3 text-center text-[#40527A] text-xs">{item.unit_of_measure}</td>
                    {/* Requestor SOH — read-only */}
                    <td className="px-4 py-3 text-right text-[#40527A] font-mono text-xs">
                      {item.requestor_soh.toLocaleString()}
                    </td>
                    {/* Verified SOH — editable */}
                    <td className="px-3 py-2">
                      {isReadOnly ? (
                        <span className={`block text-right font-mono text-sm font-semibold ${
                          item.availability === 'unavailable' ? 'text-red-600' : 'text-emerald-700'
                        }`}>
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
                    {/* Req qty — read-only */}
                    <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-[#0F1F3A]">
                      {item.quantity_requested.toLocaleString()}
                    </td>
                    {/* Availability toggle */}
                    <td className="px-3 py-2">
                      {isReadOnly ? (
                        <div className="flex justify-center">
                          <AvailabilityBadge availability={item.availability} />
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 justify-center">
                          <button
                            type="button"
                            onClick={() => setItem(idx, 'availability', 'available')}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition border ${
                              item.availability === 'available'
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-white text-[#40527A] border-[#D8E2FF] hover:border-emerald-400 hover:text-emerald-600'
                            }`}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            OK
                          </button>
                          <button
                            type="button"
                            onClick={() => setItem(idx, 'availability', 'unavailable')}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition border ${
                              item.availability === 'unavailable'
                                ? 'bg-red-600 text-white border-red-600'
                                : 'bg-white text-[#40527A] border-[#D8E2FF] hover:border-red-400 hover:text-red-600'
                            }`}
                          >
                            <XCircle className="w-3 h-3" />
                            No
                          </button>
                        </div>
                      )}
                    </td>
                    {/* Item notes */}
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
                ))}
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
                    Validation Complete —{' '}
                    {validation.decision === 'sufficient'
                      ? 'Stock Sufficient. Request closed.'
                      : 'Stock Insufficient. Routed to Approval Workflow.'}
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
            {!allItemsReviewed ? (
              <div className="flex items-center gap-3 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <p className="text-sm">All items must have an availability decision before submitting.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <DecisionPreview
                  decision={derivedDecision}
                  itemCount={formValues.items.length}
                  unavailableCount={formValues.items.filter(i => i.availability === 'unavailable').length}
                />

                {globalError && (
                  <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{globalError}</span>
                  </div>
                )}

                {confirmDecision ? (
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-[#40527A]">
                      Confirm submitting as{' '}
                      <strong className={confirmDecision === 'sufficient' ? 'text-emerald-700' : 'text-blue-700'}>
                        {confirmDecision === 'sufficient' ? 'Sufficient' : 'Insufficient'}
                      </strong>?
                      {' '}This action cannot be undone.
                    </p>
                    <button
                      onClick={() => handleSubmitDecision(confirmDecision)}
                      disabled={submitting}
                      className={`px-4 py-2 text-sm font-semibold text-white rounded-[4px] transition disabled:opacity-50 ${
                        confirmDecision === 'sufficient'
                          ? 'bg-[#0F1F3A] hover:bg-[#40527A]'
                          : 'bg-[#1E4BFF] hover:bg-[#0F1F3A]'
                      }`}
                    >
                      {submitting ? 'Submitting...' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => setConfirmDecision(null)}
                      disabled={submitting}
                      className="px-4 py-2 text-sm text-[#40527A] hover:text-[#0F1F3A] transition"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={() => setConfirmDecision('sufficient')}
                      disabled={submitting}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0F1F3A] hover:bg-[#40527A] text-white text-sm font-semibold rounded-[4px] transition disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Mark Sufficient
                    </button>
                    <button
                      onClick={() => setConfirmDecision('insufficient')}
                      disabled={submitting}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1E4BFF] hover:bg-[#0F1F3A] text-white text-sm font-semibold rounded-[4px] transition disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      Mark Insufficient — Route to Approval
                    </button>
                  </div>
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

function AvailabilityBadge({ availability }: { availability: string | null }) {
  if (!availability) {
    return <span className="text-xs text-[#BFC7D5] italic">—</span>;
  }
  if (availability === 'available') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">
        <CheckCircle2 className="w-3 h-3" />
        Available
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-100 rounded-full px-2 py-0.5">
      <XCircle className="w-3 h-3" />
      Unavailable
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
      Validated — Insufficient
    </span>
  );
}

function DecisionPreview({
  decision,
  itemCount,
  unavailableCount,
}: {
  decision: WarehouseDecision;
  itemCount: number;
  unavailableCount: number;
}) {
  if (decision === 'sufficient') {
    return (
      <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-emerald-800">
            All {itemCount} item{itemCount !== 1 ? 's' : ''} available in stock
          </p>
          <p className="text-xs text-emerald-700 mt-0.5">
            Marking sufficient will close this request internally. No approval routing needed.
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
          {unavailableCount} item{unavailableCount !== 1 ? 's' : ''} unavailable
        </p>
        <p className="text-xs text-blue-700 mt-0.5">
          Marking insufficient will route this PR1 to the approval workflow for procurement action.
        </p>
      </div>
    </div>
  );
}
