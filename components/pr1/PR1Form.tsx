'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import {
  saveDraftPR1,
  submitPR1,
  checkPR1NumberExists,
  PR1_NUMBER_DUPLICATE_ERROR,
  fetchSuggestedPR1Sequence,
  deleteDraftPR1,
  uploadPR1Attachment,
  deletePR1Attachment,
} from '@/lib/pr1';
import type { PR1WithItems, PR1FormValues, PR1ItemDraft, PR1Attachment, PR1RequestType } from '@/types/pr1';
import { EMPTY_ITEM } from '@/types/pr1';
import { useDropdownOptions } from '@/hooks/useDropdownOptions';
import { Plus, Trash2, TriangleAlert as AlertTriangle, Save, Send, ChevronUp, ChevronDown, FlaskConical, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PR1ItemAttachmentButton } from '@/components/pr1/PR1AttachmentsSection';

interface PR1FormProps {
  existing?: PR1WithItems;
}

// ── Dropdown option helpers ────────────────────────────────────────────────────

function resolveOptionSelection(stored: string, options: string[]): { sel: string; custom: string } {
  if (!stored) return { sel: '', custom: '' };
  if (options.includes(stored) && stored !== 'Other') {
    return { sel: stored, custom: '' };
  }
  return { sel: 'Other', custom: stored };
}

// ── Initial state builders ────────────────────────────────────────────────────

function buildInitialValues(existing?: PR1WithItems): PR1FormValues {
  if (existing) {
    return {
      pr1_number:    existing.pr1_number,
      purpose:       existing.purpose,
      date_required: existing.date_required,
      request_type:  existing.request_type ?? 'goods',
      items: existing.items.length > 0
        ? existing.items.map(i => ({
            id:                 i.id,
            item_order:         i.item_order,
            item_code:          i.item_code,
            description:        i.description,
            unit_of_measure:    i.unit_of_measure,
            stock_on_hand:      i.stock_on_hand,
            quantity_requested: i.quantity_requested,
            // Phase 3 (Raw Mats): preserve flag when re-loading a draft for edit.
            is_raw_material:    i.is_raw_material === true,
            remarks:            i.remarks ?? '',
          }))
        : [{ ...EMPTY_ITEM(), id: `temp-${Math.random().toString(36).substring(2, 9)}` }],
    };
  }
  const currentYear = new Date().getFullYear();
  const pr1Prefix = `PR1-${currentYear}-`;
  return {
    pr1_number:    pr1Prefix,
    purpose:       '',
    date_required: format(new Date(), 'yyyy-MM-dd'),
    request_type:  'goods',
    items:         [{ ...EMPTY_ITEM(), id: `temp-${Math.random().toString(36).substring(2, 9)}` }],
  };
}

// Per-item unit dropdown state (transient, not stored in DB)
interface ItemUnitState {
  sel: string;
  custom: string;
}

function buildInitialItemUnitStates(existing: PR1WithItems | undefined, unitValues: string[]): ItemUnitState[] {
  const items = existing && existing.items.length > 0 ? existing.items : [EMPTY_ITEM()];
  return items.map(i => resolveOptionSelection(i.unit_of_measure, unitValues));
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PR1Form({ existing }: PR1FormProps) {
  const { profile } = useAuth();
  const router = useRouter();

  const [values, setValues] = useState<PR1FormValues>(() => buildInitialValues(existing));
  const [suggestedSequence, setSuggestedSequence] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [globalError, setGlobalError] = useState('');

  // Attachment state variables
  const [pendingFiles, setPendingFiles] = useState<Record<string, File[]>>({});
  const [existingAttachments, setExistingAttachments] = useState<Record<string, PR1Attachment[]>>(() => {
    const initial: Record<string, PR1Attachment[]> = {};
    existing?.items.forEach((item) => {
      if (item.attachments) {
        initial[item.id] = item.attachments;
      }
    });
    return initial;
  });
  const [attachmentsToDelete, setAttachmentsToDelete] = useState<Record<string, boolean>>({});

  // Dynamic dropdown options
  const { options: purposeOpts } = useDropdownOptions('PURPOSE_OPTIONS');
  const { options: unitOpts }    = useDropdownOptions('UNIT_OPTIONS');
  const purposeValues = useMemo(() => purposeOpts.map(o => o.option_value), [purposeOpts]);
  const unitValues    = useMemo(() => unitOpts.map(o => o.option_value), [unitOpts]);

  // Purpose dropdown state
  const initialPurpose = useMemo(() => resolveOptionSelection(existing?.purpose ?? '', purposeValues), [existing?.purpose, purposeValues]);
  const [purposeSel, setPurposeSel] = useState(initialPurpose.sel);
  const [purposeCustom, setPurposeCustom] = useState(initialPurpose.custom);

  // Re-resolve purpose when dynamic options load
  useEffect(() => {
    if (purposeValues.length === 0) return;
    const resolved = resolveOptionSelection(existing?.purpose ?? '', purposeValues);
    setPurposeSel(resolved.sel);
    setPurposeCustom(resolved.custom);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purposeValues]);

  // Per-item unit dropdown state
  const [itemUnitStates, setItemUnitStates] = useState<ItemUnitState[]>(
    () => buildInitialItemUnitStates(existing, unitValues)
  );

  // Re-resolve unit states when dynamic options load
  useEffect(() => {
    if (unitValues.length === 0) return;
    const items = existing && existing.items.length > 0 ? existing.items : [EMPTY_ITEM()];
    setItemUnitStates(items.map(i => resolveOptionSelection(i.unit_of_measure, unitValues)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitValues]);

  const isEdit = Boolean(existing);
  const isRevisionRequested = existing?.status === 'revision_requested';
  const isServices = values.request_type === 'services';
  const isRequestTypeLocked = isEdit;

  const setRequestType = (type: PR1RequestType) => {
    if (isRequestTypeLocked) return;
    setValues(v => ({ ...v, request_type: type }));
  };

  const pr1Prefix = useMemo(() => {
    if (existing?.pr1_number) {
      const match = existing.pr1_number.match(/^PR1-(\d{4})-/i);
      if (match) {
        return `PR1-${match[1]}-`;
      }
    }
    return `PR1-${new Date().getFullYear()}-`;
  }, [existing]);

  const normalizePR1SequenceInput = useCallback((value: string) => {
    return value
      .trim()
      .replace(/^PR1-\d{4}-/i, "")
      .replace(/^PR1-/i, "")
      .replace(/^PR-/i, "");
  }, []);

  const getPR1SequenceDisplayValue = useCallback((value: string) => {
    if (!value) return "";
    return normalizePR1SequenceInput(value);
  }, [normalizePR1SequenceInput]);

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
      const cleaned = normalizePR1SequenceInput(val);
      val = `${pr1Prefix}${cleaned}`;
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

  // Phase 3 (Raw Mats): boolean toggle kept separate from `setItem` so the
  // existing string|number signature stays intact and surgical.
  const setItemRawMaterial = (idx: number, value: boolean) => {
    setValues(v => ({
      ...v,
      items: v.items.map((item, i) => i === idx ? { ...item, is_raw_material: value } : item),
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
        { ...EMPTY_ITEM(), id: `temp-${Math.random().toString(36).substring(2, 9)}`, item_order: v.items.length + 1 },
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
    setErrors(e => ({
      ...e,
      pr1_number: exists ? PR1_NUMBER_DUPLICATE_ERROR : undefined,
    }));
  }, [values.pr1_number, existing?.id]);

  useEffect(() => {
    if (isEdit) return;

    const yearMatch = pr1Prefix.match(/^PR1-(\d{4})-/i);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();
    let cancelled = false;

    fetchSuggestedPR1Sequence(year)
      .then((suffix) => {
        if (cancelled) return;
        setSuggestedSequence(suffix);
        setValues((v) => {
          const currentSuffix = v.pr1_number.slice(pr1Prefix.length).trim();
          if (currentSuffix) return v;
          return { ...v, pr1_number: `${pr1Prefix}${suffix}` };
        });
      })
      .catch(() => {
        if (!cancelled) setSuggestedSequence(null);
      });

    return () => {
      cancelled = true;
    };
  }, [isEdit, pr1Prefix]);

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
      const { id: pr1Id, items: savedItems } = await saveDraftPR1(buildResolvedValues(), profile, existing?.id);
      
      // 1. Process deletions
      const deletePromises = Object.keys(attachmentsToDelete).map(async (attId) => {
        let foundAtt: PR1Attachment | undefined;
        for (const itemId in existingAttachments) {
          foundAtt = existingAttachments[itemId].find(a => a.id === attId);
          if (foundAtt) break;
        }
        if (foundAtt) {
          await deletePR1Attachment(foundAtt, profile?.id);
        }
      });
      await Promise.all(deletePromises);

      // 2. Process uploads
      const uploadPromises: Promise<any>[] = [];
      values.items.forEach((item, idx) => {
        const matchingSavedItem = savedItems.find(si => si.item_order === idx + 1);
        if (!matchingSavedItem) return;

        const dbItemId = matchingSavedItem.id;
        const files = pendingFiles[item.id ?? ''];
        if (files && files.length > 0) {
          files.forEach((file) => {
            uploadPromises.push(uploadPR1Attachment(pr1Id, dbItemId, file));
          });
        }
      });
      await Promise.all(uploadPromises);

      router.push(`/pr1/${pr1Id}`);
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

    const num = values.pr1_number.trim();
    if (await checkPR1NumberExists(num, existing?.id)) {
      setErrors(e => ({ ...e, pr1_number: PR1_NUMBER_DUPLICATE_ERROR }));
      return;
    }

    setSubmitting(true);
    setGlobalError('');
    try {
      // 1. Save as draft first
      const { id: pr1Id, items: savedItems } = await saveDraftPR1(buildResolvedValues(), profile, existing?.id);

      // 2. Process deletions
      const deletePromises = Object.keys(attachmentsToDelete).map(async (attId) => {
        let foundAtt: PR1Attachment | undefined;
        for (const itemId in existingAttachments) {
          foundAtt = existingAttachments[itemId].find(a => a.id === attId);
          if (foundAtt) break;
        }
        if (foundAtt) {
          await deletePR1Attachment(foundAtt, profile?.id);
        }
      });
      await Promise.all(deletePromises);

      // 3. Process uploads
      const uploadPromises: Promise<any>[] = [];
      values.items.forEach((item, idx) => {
        const matchingSavedItem = savedItems.find(si => si.item_order === idx + 1);
        if (!matchingSavedItem) return;

        const dbItemId = matchingSavedItem.id;
        const files = pendingFiles[item.id ?? ''];
        if (files && files.length > 0) {
          files.forEach((file) => {
            uploadPromises.push(uploadPR1Attachment(pr1Id, dbItemId, file));
          });
        }
      });
      await Promise.all(uploadPromises);

      // 4. Transition status to pending approval and kick off workflow
      await submitPR1(pr1Id, profile);

      router.push(`/pr1/${pr1Id}`);
    } catch (err: any) {
      setGlobalError(err.message ?? 'Failed to submit PR1.');
      setSubmitting(false);
    }
  };

  // ── Delete draft ───────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!profile || !existing) return;
    if (!confirm('Are you sure you want to delete this draft? This cannot be undone.')) return;
    
    setDeleting(true);
    setGlobalError('');
    try {
      await deleteDraftPR1(existing.id, profile);
      router.push('/pr1');
    } catch (err: any) {
      setGlobalError(err.message ?? 'Failed to delete draft.');
      setDeleting(false);
    }
  };

  if (!profile) return null;

  const selectBase = 'w-full px-2.5 py-1.5 border rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] focus:border-pq-primary-600 transition bg-white appearance-none';
  const selectBaseHeader = 'w-full px-3 py-2.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] focus:border-transparent transition bg-white appearance-none';

  return (
    <div className="space-y-6">
      {/* ── Header card ── */}
      <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-pq-neutral-200 bg-pq-neutral-50">
          <div>
            <h2 className="text-sm font-semibold text-pq-neutral-900 uppercase tracking-wide">
              Purchase Request — PR1
            </h2>
            <p className="text-xs text-pq-neutral-400 mt-0.5">Fortune Procurement Automation System</p>
          </div>
          <div className="text-xs text-pq-neutral-400">Form No. PR1-v1</div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
          {/* Request Type */}
          <div className="col-span-full">
            <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
              Request Type <span className="text-pq-danger-600">*</span>
            </label>
            <div className="inline-flex rounded-md border border-pq-neutral-300 overflow-hidden">
              {(['goods', 'services'] as PR1RequestType[]).map((type, i) => (
                <button
                  key={type}
                  type="button"
                  disabled={isRequestTypeLocked}
                  onClick={() => setRequestType(type)}
                  className={cn(
                    'px-5 py-2 text-sm font-medium transition',
                    i > 0 && 'border-l border-pq-neutral-300',
                    values.request_type === type
                      ? 'bg-pq-primary-600 text-white border-pq-primary-600'
                      : 'bg-white text-pq-neutral-600 hover:bg-pq-neutral-50',
                    isRequestTypeLocked && 'opacity-60 cursor-not-allowed pointer-events-none',
                  )}
                >
                  {type === 'goods' ? 'Goods' : 'Services'}
                </button>
              ))}
            </div>
            {isRequestTypeLocked && (
              <p className="mt-1 text-xs text-pq-neutral-400">Request type is locked after the draft is created.</p>
            )}
          </div>

          {/* Requisitioner (read-only) */}
          <div>
            <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
              Requisitioner / User
            </label>
            <div className="px-3 py-2.5 bg-pq-neutral-50 border border-pq-neutral-200 rounded-md text-sm text-pq-neutral-900 font-medium">
              {profile.full_name}
            </div>
          </div>

          {/* Department (read-only) */}
          <div>
            <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
              Department
            </label>
            <div className="px-3 py-2.5 bg-pq-neutral-50 border border-pq-neutral-200 rounded-md text-sm text-pq-neutral-900 font-medium">
              {profile.department}
            </div>
          </div>

          {/* PR1 Number */}
          <div>
            <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
              PR1 Number <span className="text-pq-danger-600">*</span>
            </label>
            <div className={cn(
              'flex items-center border rounded-md overflow-hidden transition bg-pq-white focus-within:ring-2 focus-within:ring-pq-primary-500/25 focus-within:border-pq-primary-500',
              errors.pr1_number ? 'border-pq-danger-300 bg-pq-danger-50' : 'border-pq-neutral-300'
            )}>
              <div className="px-3 py-2.5 bg-pq-neutral-50 border-r border-pq-neutral-200 text-sm font-mono text-pq-neutral-400 whitespace-nowrap pointer-events-none select-none">
                {pr1Prefix}
              </div>
              <Input
                type="text"
                value={getPR1SequenceDisplayValue(values.pr1_number)}
                onChange={e => {
                  const cleaned = normalizePR1SequenceInput(e.target.value).replace(/\D/g, '');
                  setHeader('pr1_number', `${pr1Prefix}${cleaned}`);
                }}
                onBlur={handlePR1NumberBlur}
                placeholder={suggestedSequence ?? '0001'}
                className="flex-1 border-0 rounded-none rounded-r-md font-mono focus-visible:ring-0 focus-visible:border-0 bg-transparent h-10"
              />
            </div>
            {!isEdit && (
              <p className="mt-1 text-xs text-pq-neutral-400">
                {suggestedSequence
                  ? `Suggested: ${pr1Prefix}${suggestedSequence} — you may edit this number.`
                  : 'Enter a 4-digit sequence (e.g. 0001) or use the suggested value when it loads.'}
              </p>
            )}
            {errors.pr1_number && (
              <p className="mt-1 text-xs text-pq-danger-600">{errors.pr1_number}</p>
            )}
          </div>

          {/* Date (read-only today's date) */}
          <div>
            <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
              Date
            </label>
            <div className="px-3 py-2.5 bg-pq-neutral-50 border border-pq-neutral-200 rounded-md text-sm text-pq-neutral-900">
              {format(new Date(), 'MMMM d, yyyy')}
            </div>
          </div>

          {/* Purpose */}
          <div>
            <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
              Purpose <span className="text-pq-danger-600">*</span>
            </label>
            <select
              value={purposeSel}
              onChange={e => {
                setPurposeSel(e.target.value);
                setErrors(err => ({ ...err, purpose: undefined }));
              }}
              className={`${selectBaseHeader} ${errors.purpose && !purposeSel ? 'border-red-300 bg-pq-danger-100' : 'border-pq-neutral-200'}`}
            >
              <option value="">— Select purpose —</option>
              {purposeValues.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            {purposeSel === 'Other' && (
              <Input
                type="text"
                value={purposeCustom}
                onChange={e => {
                  setPurposeCustom(e.target.value);
                  setErrors(err => ({ ...err, purpose: undefined }));
                }}
                placeholder="Describe the reason for this purchase request..."
                className={cn(
                  'mt-2 text-sm',
                  errors.purpose ? 'border-pq-danger-300 bg-pq-danger-50' : 'border-pq-neutral-300'
                )}
              />
            )}
            {errors.purpose && <p className="mt-1 text-xs text-pq-danger-600">{errors.purpose}</p>}
          </div>

          {/* Date Required */}
          <div>
            <label
              htmlFor="date_required"
              className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5"
            >
              Date Required <span className="text-pq-danger-600">*</span>
            </label>
            <div
              className={cn(
                'relative rounded-md border bg-pq-white transition focus-within:ring-2 focus-within:ring-pq-primary-500/25 focus-within:border-pq-primary-500',
                errors.date_required ? 'border-pq-danger-300 bg-pq-danger-50' : 'border-pq-neutral-300',
              )}
            >
              <Input
                id="date_required"
                type="date"
                value={values.date_required}
                onChange={e => setHeader('date_required', e.target.value)}
                className={cn(
                  'h-10 border-0 bg-transparent pr-10 text-sm focus-visible:ring-0 focus-visible:border-0',
                  '[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0',
                  '[&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full',
                  '[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0',
                )}
              />
              <CalendarDays
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pq-neutral-400"
                aria-hidden
              />
            </div>
            {errors.date_required && (
              <p className="mt-1 text-xs text-pq-danger-600">{errors.date_required}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Items grid ── */}
      <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-pq-neutral-200">
          <h3 className="text-sm font-semibold text-pq-neutral-900">Items Requested</h3>
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-pq-primary-600 hover:text-pq-neutral-900 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Item
          </button>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-pq-neutral-200 bg-pq-neutral-50">
                <TableHead className="text-center px-3 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide w-8">#</TableHead>
                <TableHead className="text-left px-3 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide w-28">Item Code</TableHead>
                <TableHead className="text-left px-3 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Description</TableHead>
                <TableHead className="text-left px-3 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide w-36">Unit</TableHead>
                <TableHead className="text-right px-3 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide w-24">
                  {isServices ? <span className="text-pq-neutral-400 italic">SOH</span> : 'SOH'}
                </TableHead>
                <TableHead className="text-right px-3 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide w-28">Req. Qty</TableHead>
                {!isServices && (
                  <TableHead
                    className="text-center px-3 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide w-20"
                    title="Mark as Raw Material — used for production inputs (e.g. chemicals). Verified products are preferred during canvassing."
                  >
                    Raw Mat.
                  </TableHead>
                )}
                <TableHead className="text-center px-3 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide w-20" title="Attach images to this item">Attach</TableHead>
                <TableHead className="w-12 px-3 py-2.5" />
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-pq-neutral-200 bg-pq-white">
              {values.items.map((item, idx) => {
                const uState = itemUnitStates[idx] ?? { sel: '', custom: '' };
                const uomError = errors[`item_uom_${idx}`];
                return (
                  <TableRow key={idx} className="group hover:bg-pq-neutral-50 transition border-b border-pq-neutral-200">
                    <TableCell className="px-3 py-2 text-center align-middle">
                      <div className="flex flex-col items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => moveItem(idx, -1)}
                          disabled={idx === 0}
                          className="text-pq-neutral-400 hover:text-pq-neutral-500 disabled:opacity-0 transition"
                        >
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <span className="text-xs text-pq-neutral-400 font-mono">{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => moveItem(idx, 1)}
                          disabled={idx === values.items.length - 1}
                          className="text-pq-neutral-400 hover:text-pq-neutral-500 disabled:opacity-0 transition"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="px-2 py-2 align-middle">
                      <Input
                        type="text"
                        value={item.item_code}
                        onChange={e => setItem(idx, 'item_code', e.target.value)}
                        placeholder="Optional"
                        className="w-full h-8 px-2 py-1 text-xs font-mono"
                      />
                    </TableCell>
                    <TableCell className="px-2 py-2 align-middle">
                      <Input
                        type="text"
                        value={item.description}
                        onChange={e => setItem(idx, 'description', e.target.value)}
                        placeholder="Item description"
                        className="w-full h-8 px-2 py-1 text-xs"
                      />
                      <Input
                        type="text"
                        value={item.remarks ?? ''}
                        onChange={e => setItem(idx, 'remarks', e.target.value)}
                        placeholder="Remarks (optional) — e.g. preferred brand, urgency note"
                        className="w-full h-7 px-2 py-1 text-xs mt-1 text-pq-neutral-500 placeholder:text-pq-neutral-300"
                      />
                    </TableCell>
                    <TableCell className="px-2 py-2 align-middle">
                      <select
                        value={uState.sel}
                        onChange={e => setUnitSel(idx, e.target.value)}
                        className={`${selectBase} ${uomError && !uState.sel ? 'border-red-300 bg-pq-danger-100' : 'border-pq-neutral-200'}`}
                      >
                        <option value="">— Unit —</option>
                        {unitValues.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      {uState.sel === 'Other' && (
                        <Input
                          type="text"
                          value={uState.custom}
                          onChange={e => setUnitCustom(idx, e.target.value)}
                          placeholder="e.g. sack"
                          className={cn(
                            'mt-1 w-full h-8 px-2 py-1 text-xs',
                            uomError ? 'border-pq-danger-300 bg-pq-danger-50' : 'border-pq-neutral-200'
                          )}
                        />
                      )}
                      {uomError && (
                        <p className="mt-0.5 text-[10px] text-pq-danger-600 leading-tight">{uomError}</p>
                      )}
                    </TableCell>
                    <TableCell className="px-2 py-2 text-right text-xs text-pq-neutral-400 font-mono align-middle">
                      {isServices ? <span className="italic">N/A</span> : '—'}
                    </TableCell>
                    <TableCell className="px-2 py-2 align-middle">
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={item.quantity_requested}
                        onChange={e => setItem(idx, 'quantity_requested', e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="1"
                        className={cn(
                          'w-full h-8 px-2 py-1 text-xs text-right',
                          errors[`item_qty_${idx}`] ? 'border-pq-danger-300 bg-pq-danger-50' : 'border-pq-neutral-200'
                        )}
                      />
                    </TableCell>
                    {!isServices && (
                      <TableCell className="px-2 py-2 text-center align-middle">
                        <label
                          className="inline-flex items-center justify-center cursor-pointer group/raw"
                          title={
                            item.is_raw_material
                              ? 'Raw material — supplier may offer verified, unverified, or manual entry. Procurement will see verification status during canvassing.'
                              : 'Not a raw material — verification not required.'
                          }
                        >
                          <input
                            type="checkbox"
                            checked={item.is_raw_material === true}
                            onChange={e => setItemRawMaterial(idx, e.target.checked)}
                            className="sr-only"
                          />
                          <span
                            className={cn(
                              'inline-flex items-center justify-center w-6 h-6 rounded-md border transition',
                              item.is_raw_material
                                ? 'bg-pq-primary-50 border-pq-primary-600 text-pq-primary-600'
                                : 'bg-white border-pq-neutral-300 text-pq-neutral-300 group-hover/raw:border-pq-neutral-400 group-hover/raw:text-pq-neutral-400'
                            )}
                            aria-hidden="true"
                          >
                            <FlaskConical className="w-3.5 h-3.5" />
                          </span>
                        </label>
                      </TableCell>
                    )}
                    <TableCell className="px-2 py-2 text-center align-middle">
                      <PR1ItemAttachmentButton
                        existingAttachments={existingAttachments[item.id ?? ''] ?? []}
                        pendingFiles={pendingFiles[item.id ?? ''] ?? []}
                        onAddFiles={(files) =>
                          setPendingFiles(prev => ({
                            ...prev,
                            [item.id ?? '']: [...(prev[item.id ?? ''] ?? []), ...files],
                          }))
                        }
                        onRemovePendingFile={(pIdx) =>
                          setPendingFiles(prev => ({
                            ...prev,
                            [item.id ?? '']: (prev[item.id ?? ''] ?? []).filter((_, i) => i !== pIdx),
                          }))
                        }
                        onRemoveExistingAttachment={(att) => {
                          setAttachmentsToDelete(prev => ({ ...prev, [att.id]: true }));
                          setExistingAttachments(prev => ({
                            ...prev,
                            [item.id ?? '']: (prev[item.id ?? ''] ?? []).filter(a => a.id !== att.id),
                          }));
                        }}
                      />
                    </TableCell>
                    <TableCell className="px-2 py-2 text-center align-middle">
                      {values.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="text-pq-neutral-400 hover:text-pq-danger-600 transition opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {errors.items && (
          <div className="px-6 py-3 border-t border-pq-neutral-200 text-xs text-pq-danger-600">{errors.items}</div>
        )}
      </div>

      {/* ── Error banner ── */}
      {globalError && (
        <div className="flex items-start gap-3 bg-pq-danger-100 border border-pq-danger-100 text-pq-danger-600 text-sm rounded-md px-4 py-3">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{globalError}</span>
        </div>
      )}

      {/* ── Actions ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.back()}
            disabled={saving || submitting || deleting}
            className="text-pq-neutral-500 hover:text-pq-neutral-900 transition text-sm"
          >
            Cancel
          </Button>
          {isEdit && !isRevisionRequested && (
            <Button
              type="button"
              variant="outline"
              onClick={handleDelete}
              disabled={saving || submitting || deleting}
              className="text-pq-danger-600 border-pq-danger-200 hover:bg-pq-danger-50 hover:text-pq-danger-700 transition text-sm"
            >
              {deleting ? 'Deleting...' : 'Delete Draft'}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleSaveDraft}
            disabled={saving || submitting || deleting}
            className="inline-flex items-center gap-2 hover:border-pq-primary-600 transition"
          >
            {saving ? (
              <span className="w-4 h-4 border-2 border-pq-neutral-200 border-t-pq-primary-600 rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isRevisionRequested ? 'Save Changes' : 'Save Draft'}
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={handleSubmit}
            disabled={saving || submitting}
            className="inline-flex items-center gap-2 bg-pq-primary-600 hover:bg-pq-neutral-900 text-pq-white transition"
          >
            {submitting ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {isRevisionRequested ? 'Resubmit PR1' : 'Submit PR1'}
          </Button>
        </div>
      </div>
    </div>
  );
}
