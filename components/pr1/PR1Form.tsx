'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  saveDraftPR1,
  submitPR1,
  checkPR1NumberExists,
} from '@/lib/pr1';
import type { PR1WithItems, PR1FormValues, PR1ItemDraft } from '@/types/pr1';
import { EMPTY_ITEM, PURPOSE_OPTIONS, UNIT_OPTIONS } from '@/types/pr1';
import { Plus, Trash2, TriangleAlert as AlertTriangle, Save, Send, ChevronUp, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';

interface PR1FormProps {
  existing?: PR1WithItems;
}

// ── Dropdown option helpers ────────────────────────────────────────────────────

function resolvePurposeSelection(stored: string): { sel: string; custom: string } {
  if (!stored) return { sel: '', custom: '' };
  if ((PURPOSE_OPTIONS as readonly string[]).includes(stored) && stored !== 'Other') {
    return { sel: stored, custom: '' };
  }
  return { sel: 'Other', custom: stored };
}

function resolveUnitSelection(stored: string): { sel: string; custom: string } {
  if (!stored) return { sel: '', custom: '' };
  if ((UNIT_OPTIONS as readonly string[]).includes(stored) && stored !== 'Other') {
    return { sel: stored, custom: '' };
  }
  return { sel: 'Other', custom: stored };
}

// ── Initial state builders ────────────────────────────────────────────────────

function buildInitialValues(existing?: PR1WithItems): PR1FormValues {
  if (existing) {
    return {
      pr1_number:   existing.pr1_number,
      purpose:      existing.purpose,
      date_required: existing.date_required,
      items: existing.items.length > 0
        ? existing.items.map(i => ({
            id:                 i.id,
            item_order:         i.item_order,
            item_code:          i.item_code,
            description:        i.description,
            unit_of_measure:    i.unit_of_measure,
            stock_on_hand:      i.stock_on_hand,
            quantity_requested: i.quantity_requested,
          }))
        : [EMPTY_ITEM()],
    };
  }
  const currentYear = new Date().getFullYear();
  const pr1Prefix = `PR1-${currentYear}-`;
  return {
    pr1_number:    pr1Prefix,
    purpose:       '',
    date_required: format(new Date(), 'yyyy-MM-dd'),
    items:         [EMPTY_ITEM()],
  };
}

// Per-item unit dropdown state (transient, not stored in DB)
interface ItemUnitState {
  sel: string;
  custom: string;
}

function buildInitialItemUnitStates(existing?: PR1WithItems): ItemUnitState[] {
  const items = existing && existing.items.length > 0 ? existing.items : [EMPTY_ITEM()];
  return items.map(i => resolveUnitSelection(i.unit_of_measure));
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PR1Form({ existing }: PR1FormProps) {
  const { profile } = useAuth();
  const router = useRouter();

  const [values, setValues] = useState<PR1FormValues>(() => buildInitialValues(existing));
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [globalError, setGlobalError] = useState('');

  // Purpose dropdown state
  const initialPurpose = resolvePurposeSelection(existing?.purpose ?? '');
  const [purposeSel, setPurposeSel] = useState(initialPurpose.sel);
  const [purposeCustom, setPurposeCustom] = useState(initialPurpose.custom);

  // Per-item unit dropdown state
  const [itemUnitStates, setItemUnitStates] = useState<ItemUnitState[]>(
    () => buildInitialItemUnitStates(existing)
  );

  const isEdit = Boolean(existing);

  const currentYear = new Date().getFullYear();
  const pr1Prefix = `PR1-${currentYear}-`;

  // ── Resolved final values for submission ──────────────────────────────────

  const finalPurpose = purposeSel === 'Other' ? purposeCustom.trim() : purposeSel;

  function finalUnit(idx: number): string {
    const s = itemUnitStates[idx];
    if (!s) return '';
    return s.sel === 'Other' ? s.custom.trim() : s.sel;
  }

  // ── Field helpers ──────────────────────────────────────────────────────────

  const setHeader = (field: keyof Omit<PR1FormValues, 'items'>, val: string) => {
    if (field === 'pr1_number') {
      if (!val.startsWith(pr1Prefix)) {
        val = pr1Prefix;
      }
    }
    setValues(v => ({ ...v, [field]: val }));
    setErrors(e => ({ ...e, [field]: undefined }));
  };

  const setItem = (idx: number, field: keyof PR1ItemDraft, val: string | number) => {
    setValues(v => ({
      ...v,
      items: v.items.map((item, i) => i === idx ? { ...item, [field]: val } : item),
    }));
  };

  const setUnitSel = (idx: number, sel: string) => {
    setItemUnitStates(prev => prev.map((s, i) => i === idx ? { ...s, sel } : s));
    setErrors(e => ({ ...e, [`item_uom_${idx}`]: undefined }));
  };

  const setUnitCustom = (idx: number, custom: string) => {
    setItemUnitStates(prev => prev.map((s, i) => i === idx ? { ...s, custom } : s));
    setErrors(e => ({ ...e, [`item_uom_${idx}`]: undefined }));
  };

  const addItem = () => {
    setValues(v => ({
      ...v,
      items: [
        ...v.items,
        { ...EMPTY_ITEM(), item_order: v.items.length + 1 },
      ],
    }));
    setItemUnitStates(prev => [...prev, { sel: '', custom: '' }]);
  };

  const removeItem = (idx: number) => {
    setValues(v => ({
      ...v,
      items: v.items
        .filter((_, i) => i !== idx)
        .map((item, i) => ({ ...item, item_order: i + 1 })),
    }));
    setItemUnitStates(prev => prev.filter((_, i) => i !== idx));
  };

  const moveItem = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= values.items.length) return;
    setValues(v => {
      const items = [...v.items];
      [items[idx], items[next]] = [items[next], items[idx]];
      return { ...v, items: items.map((item, i) => ({ ...item, item_order: i + 1 })) };
    });
    setItemUnitStates(prev => {
      const states = [...prev];
      [states[idx], states[next]] = [states[next], states[idx]];
      return states;
    });
  };

  // ── PR1 number duplicate check ─────────────────────────────────────────────

  const handlePR1NumberBlur = useCallback(async () => {
    const num = values.pr1_number.trim();
    if (!num) return;
    const exists = await checkPR1NumberExists(num, existing?.id);
    setDuplicateWarning(exists);
  }, [values.pr1_number, existing?.id]);

  // ── Build values with resolved units before save/submit ───────────────────

  function buildResolvedValues(): PR1FormValues {
    return {
      ...values,
      purpose: finalPurpose,
      items: values.items.map((item, idx) => ({
        ...item,
        unit_of_measure: finalUnit(idx),
      })),
    };
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  function validate(): boolean {
    const errs: Partial<Record<string, string>> = {};

    if (!values.pr1_number.trim()) errs.pr1_number = 'PR1 number is required.';

    if (!purposeSel) {
      errs.purpose = 'Purpose is required.';
    } else if (purposeSel === 'Other' && !purposeCustom.trim()) {
      errs.purpose = 'Please specify the purpose.';
    }

    if (!values.date_required) errs.date_required = 'Date required is required.';

    const hasItems = values.items.some(i => i.description.trim() !== '');
    if (!hasItems) errs.items = 'At least one item is required.';

    values.items.forEach((item, idx) => {
      if (item.description.trim()) {
        const uState = itemUnitStates[idx];
        if (!uState || !uState.sel) {
          errs[`item_uom_${idx}`] = 'Unit of measure required.';
        } else if (uState.sel === 'Other' && !uState.custom.trim()) {
          errs[`item_uom_${idx}`] = 'Please specify the unit.';
        }
      }
      if (item.description.trim() && (Number(item.quantity_requested) || 0) <= 0) {
        errs[`item_qty_${idx}`] = 'Quantity must be > 0.';
      }
    });

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Save draft ─────────────────────────────────────────────────────────────

  const handleSaveDraft = async () => {
    if (!profile) return;
    if (!values.pr1_number.trim() || !values.date_required) {
      setErrors({ pr1_number: !values.pr1_number.trim() ? 'Required.' : undefined });
      return;
    }
    setSaving(true);
    setGlobalError('');
    try {
      const id = await saveDraftPR1(buildResolvedValues(), profile, existing?.id);
      router.push(`/pr1/${id}`);
    } catch (err: any) {
      setGlobalError(err.message ?? 'Failed to save draft.');
    } finally {
      setSaving(false);
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!profile) return;
    if (!validate()) return;
    setSubmitting(true);
    setGlobalError('');
    try {
      const id = await submitPR1(buildResolvedValues(), profile, existing?.id);
      router.push(`/pr1/${id}`);
    } catch (err: any) {
      setGlobalError(err.message ?? 'Failed to submit PR1.');
      setSubmitting(false);
    }
  };

  if (!profile) return null;

  const selectBase = 'w-full px-2.5 py-1.5 border rounded-[4px] text-xs focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] focus:border-[#1E4BFF] transition bg-white appearance-none';
  const selectBaseHeader = 'w-full px-3 py-2.5 border rounded-[4px] text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] focus:border-transparent transition bg-white appearance-none';

  return (
    <div className="space-y-6">
      {/* ── Header card ── */}
      <div className="bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D8E2FF] bg-[#F7F9FC]">
          <div>
            <h2 className="text-sm font-semibold text-[#0F1F3A] uppercase tracking-wide">
              Purchase Request — PR1
            </h2>
            <p className="text-xs text-[#BFC7D5] mt-0.5">Fortune Procurement Automation System</p>
          </div>
          <div className="text-xs text-[#BFC7D5]">Form No. PR1-v1</div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Requisitioner (read-only) */}
          <div>
            <label className="block text-xs font-semibold text-[#40527A] uppercase tracking-wide mb-1.5">
              Requisitioner / User
            </label>
            <div className="px-3 py-2.5 bg-[#F7F9FC] border border-[#D8E2FF] rounded-[4px] text-sm text-[#0F1F3A] font-medium">
              {profile.full_name}
            </div>
          </div>

          {/* Department (read-only) */}
          <div>
            <label className="block text-xs font-semibold text-[#40527A] uppercase tracking-wide mb-1.5">
              Department
            </label>
            <div className="px-3 py-2.5 bg-[#F7F9FC] border border-[#D8E2FF] rounded-[4px] text-sm text-[#0F1F3A] font-medium">
              {profile.department}
            </div>
          </div>

          {/* PR1 Number */}
          <div>
            <label className="block text-xs font-semibold text-[#40527A] uppercase tracking-wide mb-1.5">
              PR1 Number <span className="text-red-500">*</span>
            </label>
            <div className={`flex items-center border rounded-[4px] overflow-hidden transition ${
              errors.pr1_number ? 'border-red-300 bg-red-50' : 'border-[#D8E2FF]'
            } focus-within:ring-2 focus-within:ring-[#1E4BFF] focus-within:border-transparent`}>
              <div className="px-3 py-2.5 bg-[#F7F9FC] border-r border-[#D8E2FF] text-sm font-mono text-[#BFC7D5] whitespace-nowrap pointer-events-none select-none">
                {pr1Prefix}
              </div>
              <input
                type="text"
                value={values.pr1_number.startsWith(pr1Prefix) ? values.pr1_number.slice(pr1Prefix.length) : values.pr1_number}
                onChange={e => setHeader('pr1_number', pr1Prefix + e.target.value)}
                onBlur={handlePR1NumberBlur}
                placeholder="e.g. 001"
                className="flex-1 px-3 py-2.5 border-0 text-sm font-mono focus:outline-none bg-inherit"
              />
            </div>
            {errors.pr1_number && (
              <p className="mt-1 text-xs text-red-600">{errors.pr1_number}</p>
            )}
            {duplicateWarning && !errors.pr1_number && (
              <div className="mt-1.5 flex items-start gap-1.5 text-[#40527A] text-xs bg-[#F7F9FC] border border-[#D8E2FF] rounded-[4px] px-2.5 py-1.5">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>This PR1 number already exists. You may still submit, but please verify.</span>
              </div>
            )}
          </div>

          {/* Date (read-only today's date) */}
          <div>
            <label className="block text-xs font-semibold text-[#40527A] uppercase tracking-wide mb-1.5">
              Date
            </label>
            <div className="px-3 py-2.5 bg-[#F7F9FC] border border-[#D8E2FF] rounded-[4px] text-sm text-[#0F1F3A]">
              {format(new Date(), 'MMMM d, yyyy')}
            </div>
          </div>

          {/* Purpose */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-[#40527A] uppercase tracking-wide mb-1.5">
              Purpose <span className="text-red-500">*</span>
            </label>
            <select
              value={purposeSel}
              onChange={e => {
                setPurposeSel(e.target.value);
                setErrors(err => ({ ...err, purpose: undefined }));
              }}
              className={`${selectBaseHeader} ${errors.purpose && !purposeSel ? 'border-red-300 bg-red-50' : 'border-[#D8E2FF]'}`}
            >
              <option value="">— Select purpose —</option>
              {PURPOSE_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            {purposeSel === 'Other' && (
              <input
                type="text"
                value={purposeCustom}
                onChange={e => {
                  setPurposeCustom(e.target.value);
                  setErrors(err => ({ ...err, purpose: undefined }));
                }}
                placeholder="Describe the reason for this purchase request..."
                className={`mt-2 w-full px-3 py-2.5 border rounded-[4px] text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] focus:border-transparent transition ${
                  errors.purpose ? 'border-red-300 bg-red-50' : 'border-[#D8E2FF]'
                }`}
              />
            )}
            {errors.purpose && <p className="mt-1 text-xs text-red-600">{errors.purpose}</p>}
          </div>

          {/* Date Required */}
          <div>
            <label className="block text-xs font-semibold text-[#40527A] uppercase tracking-wide mb-1.5">
              Date Required <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={values.date_required}
              onChange={e => setHeader('date_required', e.target.value)}
              className={`w-full px-3 py-2.5 border rounded-[4px] text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] focus:border-transparent transition ${
                errors.date_required ? 'border-red-300 bg-red-50' : 'border-[#D8E2FF]'
              }`}
            />
            {errors.date_required && <p className="mt-1 text-xs text-red-600">{errors.date_required}</p>}
          </div>
        </div>
      </div>

      {/* ── Items grid ── */}
      <div className="bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D8E2FF]">
          <h3 className="text-sm font-semibold text-[#0F1F3A]">Items Requested</h3>
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1E4BFF] hover:text-[#0F1F3A] transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Item
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#D8E2FF] bg-[#F7F9FC]">
                <th className="text-center px-3 py-2.5 text-xs font-semibold text-[#40527A] uppercase tracking-wide w-8">#</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#40527A] uppercase tracking-wide w-28">Item Code</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#40527A] uppercase tracking-wide">Description</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#40527A] uppercase tracking-wide w-36">Unit</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-[#40527A] uppercase tracking-wide w-24">SOH</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-[#40527A] uppercase tracking-wide w-28">Req. Qty</th>
                <th className="w-16 px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D8E2FF]">
              {values.items.map((item, idx) => {
                const uState = itemUnitStates[idx] ?? { sel: '', custom: '' };
                const uomError = errors[`item_uom_${idx}`];
                return (
                  <tr key={idx} className="group">
                    <td className="px-3 py-2 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => moveItem(idx, -1)}
                          disabled={idx === 0}
                          className="text-[#BFC7D5] hover:text-[#40527A] disabled:opacity-0 transition"
                        >
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <span className="text-xs text-[#BFC7D5] font-mono">{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => moveItem(idx, 1)}
                          disabled={idx === values.items.length - 1}
                          className="text-[#BFC7D5] hover:text-[#40527A] disabled:opacity-0 transition"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={item.item_code}
                        onChange={e => setItem(idx, 'item_code', e.target.value)}
                        placeholder="Optional"
                        className="w-full px-2.5 py-1.5 border border-[#D8E2FF] rounded-[4px] text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] focus:border-[#1E4BFF] transition"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={item.description}
                        onChange={e => setItem(idx, 'description', e.target.value)}
                        placeholder="Item description"
                        className="w-full px-2.5 py-1.5 border border-[#D8E2FF] rounded-[4px] text-xs focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] focus:border-[#1E4BFF] transition"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={uState.sel}
                        onChange={e => setUnitSel(idx, e.target.value)}
                        className={`${selectBase} ${uomError && !uState.sel ? 'border-red-300 bg-red-50' : 'border-[#D8E2FF]'}`}
                      >
                        <option value="">— Unit —</option>
                        {UNIT_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      {uState.sel === 'Other' && (
                        <input
                          type="text"
                          value={uState.custom}
                          onChange={e => setUnitCustom(idx, e.target.value)}
                          placeholder="e.g. sack"
                          className={`mt-1 w-full px-2.5 py-1.5 border rounded-[4px] text-xs focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] focus:border-[#1E4BFF] transition ${
                            uomError ? 'border-red-300 bg-red-50' : 'border-[#D8E2FF]'
                          }`}
                        />
                      )}
                      {uomError && (
                        <p className="mt-0.5 text-[10px] text-red-600 leading-tight">{uomError}</p>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right text-xs text-[#BFC7D5] font-mono">
                      —
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={item.quantity_requested}
                        onChange={e => setItem(idx, 'quantity_requested', e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="1"
                        className={`w-full px-2.5 py-1.5 border rounded-[4px] text-xs text-right focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] focus:border-[#1E4BFF] transition ${
                          errors[`item_qty_${idx}`] ? 'border-red-300' : 'border-[#D8E2FF]'
                        }`}
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      {values.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="text-[#BFC7D5] hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {errors.items && (
          <div className="px-6 py-3 border-t border-[#D8E2FF] text-xs text-red-600">{errors.items}</div>
        )}
      </div>

      {/* ── Error banner ── */}
      {globalError && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-[4px] px-4 py-3">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{globalError}</span>
        </div>
      )}

      {/* ── Actions ── */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-[#40527A] hover:text-[#0F1F3A] transition"
        >
          Cancel
        </button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={saving || submitting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#D8E2FF] hover:border-[#0F1F3A] text-[#0F1F3A] text-sm font-medium rounded-[4px] transition disabled:opacity-50"
          >
            {saving ? (
              <span className="w-4 h-4 border-2 border-[#D8E2FF] border-t-[#40527A] rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Draft
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || submitting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#1E4BFF] hover:bg-[#0F1F3A] disabled:opacity-50 text-white text-sm font-semibold rounded-[4px] transition"
          >
            {submitting ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Submit PR1
          </button>
        </div>
      </div>
    </div>
  );
}
