'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Save, Send, TriangleAlert as AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import AppShell from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { canRequestRawMaterials } from '@/lib/raw-material-access';
import { useDropdownOptions } from '@/hooks/useDropdownOptions';
import {
  createRawMaterialPR2,
  submitRawMaterialPR2,
  fetchSuggestedRawMaterialPR2Sequence,
  uploadPR2ItemAttachment,
  checkPR2NumberExists,
  PR2_NUMBER_DUPLICATE_ERROR,
  type RawMaterialPR2ItemInput,
} from '@/lib/pr2-planning';
import RawMaterialPR2ItemsEditor from '@/components/planning/RawMaterialPR2ItemsEditor';

export default function NewRawMaterialPR2Page() {
  const { profile } = useAuth();
  const router = useRouter();

  const currentYear = new Date().getFullYear();
  const pr2Prefix = `PR2-${currentYear}-`;

  const [requestType, setRequestType] = useState<'raw_material' | 'services'>('raw_material');
  const [suffix, setSuffix] = useState('');
  const [suggestedSequence, setSuggestedSequence] = useState<string | null>(null);
  const [requisitionerName, setRequisitionerName] = useState('');
  const [dateRequired, setDateRequired] = useState('');
  const [priority, setPriority] = useState<'normal' | 'medium' | 'high'>('normal');
  const [remarks, setRemarks] = useState('');
  const [items, setItems] = useState<RawMaterialPR2ItemInput[]>([
    { id: `temp-${Math.random().toString(36).substring(2, 9)}`, item_order: 1, item_code: '', description: '', unit_of_measure: '', quantity_requested: 0, remarks: '' },
  ]);
  const [pendingFiles, setPendingFiles] = useState<Record<string, File[]>>({});
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Partial<Record<'pr2_number' | 'purpose', string>>>({});

  // Purpose dropdown state — mirrors PR1Form's PURPOSE_OPTIONS + "Other" pattern.
  const { options: purposeOpts } = useDropdownOptions('PURPOSE_OPTIONS');
  const purposeValues = useMemo(() => purposeOpts.map((o) => o.option_value), [purposeOpts]);
  const [purposeSel, setPurposeSel] = useState('');
  const [purposeCustom, setPurposeCustom] = useState('');
  const finalPurpose = purposeSel === 'Other' ? purposeCustom.trim() : purposeSel;

  useEffect(() => {
    if (!profile) return;
    if (!canRequestRawMaterials(profile)) {
      router.push('/dashboard');
      return;
    }
    fetchSuggestedRawMaterialPR2Sequence(currentYear)
      .then((seq) => {
        setSuggestedSequence(seq);
        setSuffix((s) => s || seq);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, router]);

  const normalizeSuffix = (value: string) => value.trim().replace(/^PR2-RM-\d{4}-/i, '').replace(/^PR2-\d{4}-/i, '').replace(/^PR2-/i, '').replace(/\D/g, '');

  const handlePR2NumberBlur = useCallback(async () => {
    const num = `${pr2Prefix}${suffix}`.trim();
    if (!suffix.trim()) return;
    const exists = await checkPR2NumberExists(num);
    setErrors((e) => ({ ...e, pr2_number: exists ? PR2_NUMBER_DUPLICATE_ERROR : undefined }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suffix, pr2Prefix]);

  const validate = (): string | null => {
    if (!suffix.trim()) return 'PR2 number is required.';
    if (errors.pr2_number) return errors.pr2_number;
    if (!purposeSel) {
      setErrors((e) => ({ ...e, purpose: 'Purpose is required.' }));
      return 'Purpose is required.';
    }
    if (purposeSel === 'Other' && !purposeCustom.trim()) {
      setErrors((e) => ({ ...e, purpose: 'Please specify the purpose.' }));
      return 'Please specify the purpose.';
    }
    if (!dateRequired) return 'Date required is required.';
    if (items.length === 0) return 'At least one line item is required.';
    for (const item of items) {
      if (!item.description.trim() || !item.unit_of_measure.trim()) {
        return 'Every line item needs a description and unit of measure.';
      }
      if (!item.quantity_requested || item.quantity_requested <= 0) {
        return 'Every line item needs a quantity greater than zero.';
      }
    }
    return null;
  };

  const handleSave = async (submitAfter: boolean) => {
    if (!profile) return;
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');

    const pr2Number = `${pr2Prefix}${suffix}`;
    if (await checkPR2NumberExists(pr2Number)) {
      setErrors((e) => ({ ...e, pr2_number: PR2_NUMBER_DUPLICATE_ERROR }));
      setError(PR2_NUMBER_DUPLICATE_ERROR);
      return;
    }

    submitAfter ? setSubmitting(true) : setSaving(true);
    try {
      const { id: pr2Id, items: savedItems } = await createRawMaterialPR2(profile, pr2Number, {
        requisitioner_name: requisitionerName || null,
        purpose: finalPurpose,
        date_required: dateRequired,
        priority,
        remarks: remarks || null,
        items,
      }, requestType);

      // Upload any pending attachments now that items have real ids —
      // matched by item_order since temp ids aren't persisted server-side.
      const uploadPromises: Promise<any>[] = [];
      items.forEach((item, idx) => {
        const files = pendingFiles[item.id ?? ''];
        if (!files || files.length === 0) return;
        const matched = savedItems.find((si) => si.item_order === idx + 1);
        if (!matched) return;
        files.forEach((file) => {
          uploadPromises.push(uploadPR2ItemAttachment(pr2Id, matched.id, file));
        });
      });
      await Promise.all(uploadPromises);

      if (submitAfter) {
        await submitRawMaterialPR2(pr2Id, profile);
      }
      router.push(`/planning/pr2/${pr2Id}`);
    } catch (err: any) {
      setError(err?.message || 'Failed to save request.');
      setSaving(false);
      setSubmitting(false);
    }
  };

  const typeLabel = requestType === 'services' ? 'Services' : 'Raw Material';

  return (
    <AppShell title={`New ${typeLabel} Request`}>
      <div className="mb-2">
        <Link
          href="/planning/pr2"
          className="inline-flex items-center gap-1 text-xs text-pq-neutral-500 hover:text-pq-neutral-900 transition"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Back to PR2 Requests
        </Link>
      </div>

      <div className="space-y-6">
        {/* Header card */}
        <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-pq-neutral-200 bg-pq-neutral-50">
            <div>
              <h2 className="text-sm font-semibold text-pq-neutral-900 uppercase tracking-wide">
                {typeLabel} Request — PR2
              </h2>
              <p className="text-xs text-pq-neutral-400 mt-0.5">Fortune Procurement Automation System</p>
            </div>
            <div className="text-xs text-pq-neutral-400">Form No. PR2-v1</div>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
            {/* Request Type */}
            <div className="col-span-full">
              <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
                Request Type <span className="text-pq-danger-600">*</span>
              </label>
              <div className="inline-flex rounded-md border border-pq-neutral-300 overflow-hidden">
                {(['raw_material', 'services'] as const).map((rt, i) => (
                  <button
                    key={rt}
                    type="button"
                    onClick={() => setRequestType(rt)}
                    className={cn(
                      'px-5 py-2 text-sm font-medium transition',
                      i > 0 && 'border-l border-pq-neutral-300',
                      requestType === rt
                        ? 'bg-pq-primary-600 text-white border-pq-primary-600'
                        : 'bg-white text-pq-neutral-600 hover:bg-pq-neutral-50',
                    )}
                  >
                    {rt === 'raw_material' ? 'Raw Material' : 'Services'}
                  </button>
                ))}
              </div>
            </div>

            {/* Requisitioner */}
            <div>
              <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
                Requisitioner / User
              </label>
              <Input
                value={requisitionerName}
                onChange={(e) => setRequisitionerName(e.target.value)}
                placeholder={profile?.full_name || 'Enter requestor name'}
              />
            </div>

            {/* Department (read-only) */}
            <div>
              <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
                Department
              </label>
              <div className="px-3 py-2.5 bg-pq-neutral-50 border border-pq-neutral-200 rounded-md text-sm text-pq-neutral-900 font-medium">
                {profile?.department}
              </div>
            </div>

            {/* PR2 Number */}
            <div>
              <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
                PR2 Number <span className="text-pq-danger-600">*</span>
              </label>
              <div className={cn(
                'flex items-center border rounded-md overflow-hidden transition bg-pq-white focus-within:ring-2 focus-within:ring-pq-primary-500/25 focus-within:border-pq-primary-500',
                errors.pr2_number ? 'border-pq-danger-300 bg-pq-danger-50' : 'border-pq-neutral-300'
              )}>
                <div className="px-3 py-2.5 bg-pq-neutral-50 border-r border-pq-neutral-200 text-sm font-mono text-pq-neutral-400 whitespace-nowrap pointer-events-none select-none">
                  {pr2Prefix}
                </div>
                <Input
                  type="text"
                  value={suffix}
                  onChange={(e) => {
                    setSuffix(normalizeSuffix(e.target.value));
                    setErrors((err) => ({ ...err, pr2_number: undefined }));
                  }}
                  onBlur={handlePR2NumberBlur}
                  placeholder={suggestedSequence ?? '0001'}
                  className="flex-1 border-0 rounded-none rounded-r-md font-mono focus-visible:ring-0 focus-visible:border-0 bg-transparent h-10"
                />
              </div>
              <p className="mt-1 text-xs text-pq-neutral-400">
                {suggestedSequence
                  ? `Suggested: ${pr2Prefix}${suggestedSequence} — you may edit this number.`
                  : 'Enter a 4-digit sequence (e.g. 0001) or use the suggested value when it loads.'}
              </p>
              {errors.pr2_number && (
                <p className="mt-1 text-xs text-pq-danger-600">{errors.pr2_number}</p>
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
                onChange={(e) => {
                  setPurposeSel(e.target.value);
                  setErrors((err) => ({ ...err, purpose: undefined }));
                }}
                className={cn(
                  'w-full h-10 px-3 py-2.5 border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] focus:border-transparent transition appearance-none',
                  errors.purpose && !purposeSel ? 'border-red-300 bg-pq-danger-100' : 'border-pq-neutral-200'
                )}
              >
                <option value="">— Select purpose —</option>
                {purposeValues.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              {purposeSel === 'Other' && (
                <Input
                  type="text"
                  value={purposeCustom}
                  onChange={(e) => {
                    setPurposeCustom(e.target.value);
                    setErrors((err) => ({ ...err, purpose: undefined }));
                  }}
                  placeholder={requestType === 'services' ? 'Why this service is needed' : 'Why this raw material is needed'}
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
              <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
                Date Required <span className="text-pq-danger-600">*</span>
              </label>
              <Input
                type="date"
                value={dateRequired}
                onChange={(e) => setDateRequired(e.target.value)}
                className="h-10"
              />
            </div>

            {/* Priority — PR2-only field, no PR1 equivalent */}
            <div>
              <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
                Priority <span className="text-pq-danger-600">*</span>
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as 'normal' | 'medium' | 'high')}
                className="w-full h-10 px-3 py-2 border border-pq-neutral-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pq-primary-500"
              >
                <option value="normal">Normal</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            {/* Remarks — PR2-only field, no PR1 equivalent */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
                Remarks
              </label>
              <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
            </div>
          </div>
        </div>

        {/* Items */}
        <RawMaterialPR2ItemsEditor
          items={items}
          onChange={setItems}
          existingAttachments={{}}
          pendingFiles={pendingFiles}
          onAddFiles={(itemKey, files) =>
            setPendingFiles((prev) => ({
              ...prev,
              [itemKey]: [...(prev[itemKey] ?? []), ...files],
            }))
          }
          onRemovePendingFile={(itemKey, idx) =>
            setPendingFiles((prev) => ({
              ...prev,
              [itemKey]: (prev[itemKey] ?? []).filter((_, i) => i !== idx),
            }))
          }
          onRemoveExistingAttachment={() => {}}
        />

        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-3 bg-pq-danger-100 border border-pq-danger-100 text-pq-danger-600 text-sm rounded-md px-4 py-3">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.back()}
            disabled={saving || submitting}
            className="text-pq-neutral-500 hover:text-pq-neutral-900 transition text-sm"
          >
            Cancel
          </Button>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSave(false)}
              disabled={saving || submitting}
              className="inline-flex items-center gap-2 hover:border-pq-primary-600 transition"
            >
              {saving ? (
                <span className="w-4 h-4 border-2 border-pq-neutral-200 border-t-pq-primary-600 rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save as Draft
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={() => handleSave(true)}
              disabled={saving || submitting}
              className="inline-flex items-center gap-2 bg-pq-primary-600 hover:bg-pq-neutral-900 text-pq-white transition"
            >
              {submitting ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Submit for Approval
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
