'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';
import { getExpirySettings, updateExpirySettings } from '@/lib/system-settings';
import {
  fetchDropdownOptions,
  createDropdownOption,
  updateDropdownOption,
  deleteDropdownOption,
  reorderDropdownOptions,
} from '@/lib/dropdown-options';
import { invalidateDropdownCache } from '@/hooks/useDropdownOptions';
import type { SystemExpirySettings } from '@/types/database';
import type { DropdownCategory, DropdownOption } from '@/types/dropdown-options';
import { DROPDOWN_CATEGORIES, DROPDOWN_CATEGORY_LABELS } from '@/types/dropdown-options';
import { format } from 'date-fns';
import {
  CalendarClock,
  CheckCircle2,
  AlertCircle,
  List,
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  X,
  Save,
} from 'lucide-react';

// ─── Expiry Settings Card (unchanged logic, extracted for readability) ────────

function ExpirySettingsCard({
  settings,
  onSettingsUpdate,
  profile,
}: {
  settings: SystemExpirySettings;
  onSettingsUpdate: (s: SystemExpirySettings) => void;
  profile: { id: string };
}) {
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const [successMsg, setSuccessMsg]   = useState('');
  const [accDays, setAccDays]         = useState(String(settings.accreditation_validity_days));
  const [productDays, setProductDays] = useState(String(settings.product_validity_days));

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const acc     = parseInt(accDays, 10);
    const product = parseInt(productDays, 10);

    if (isNaN(acc) || acc < 1 || acc > 3650) {
      setError('Accreditation validity must be between 1 and 3650 days.');
      return;
    }
    if (isNaN(product) || product < 1 || product > 3650) {
      setError('Product verification validity must be between 1 and 3650 days.');
      return;
    }

    setSaving(true);
    try {
      await updateExpirySettings(profile as any, {
        accreditation_validity_days: acc,
        product_validity_days:       product,
      });
      const updated = { ...settings, accreditation_validity_days: acc, product_validity_days: product, updated_at: new Date().toISOString() };
      onSettingsUpdate(updated);
      setSuccessMsg('Settings saved. Changes apply to new approvals only — existing records are unaffected.');
    } catch (err) {
      setError((err as Error)?.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-pq-neutral-200 bg-pq-neutral-50 flex items-center gap-2">
        <CalendarClock className="w-3.5 h-3.5 text-pq-neutral-400" />
        <span className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
          Expiry Settings
        </span>
      </div>

      <form onSubmit={handleSave} className="p-4 space-y-4">
        <p className="text-xs text-pq-neutral-400 leading-relaxed">
          Days after approval before a record is marked expired. Applies to <span className="font-medium text-pq-neutral-500">new approvals only</span>.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
          {/* Accreditation */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-pq-neutral-600">
              Supplier Accreditation
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={3650}
                value={accDays}
                onChange={e => setAccDays(e.target.value)}
                className="w-20 rounded-md border border-pq-neutral-300 px-2.5 py-1.5 text-sm text-pq-neutral-900 focus:outline-none focus:ring-2 focus:ring-pq-primary-500"
              />
              <span className="text-xs text-pq-neutral-500">days</span>
              <span className="text-xs text-pq-neutral-400">
                {!isNaN(parseInt(accDays)) && parseInt(accDays) > 0
                  ? `(${(parseInt(accDays) / 365).toFixed(1)} yrs)`
                  : ''}
              </span>
            </div>
          </div>

          {/* Product / Service */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-pq-neutral-600">
              Product / Service Verification
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={3650}
                value={productDays}
                onChange={e => setProductDays(e.target.value)}
                className="w-20 rounded-md border border-pq-neutral-300 px-2.5 py-1.5 text-sm text-pq-neutral-900 focus:outline-none focus:ring-2 focus:ring-pq-primary-500"
              />
              <span className="text-xs text-pq-neutral-500">days</span>
              <span className="text-xs text-pq-neutral-400">
                {!isNaN(parseInt(productDays)) && parseInt(productDays) > 0
                  ? `(${(parseInt(productDays) / 365).toFixed(1)} yrs)`
                  : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Feedback */}
        {error && (
          <div className="flex items-start gap-2 text-xs text-pq-danger-600 bg-pq-danger-50 border border-pq-danger-100 rounded-md px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            {error}
          </div>
        )}
        {successMsg && (
          <div className="flex items-start gap-2 text-xs text-pq-success-700 bg-pq-success-50 border border-pq-success-100 rounded-md px-3 py-2">
            <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            {successMsg}
          </div>
        )}

        <div className="pt-1 space-y-2">
          <Button type="submit" disabled={saving} className="w-full text-xs">
            {saving ? 'Saving…' : 'Save Settings'}
          </Button>
          {settings?.updated_at && (
            <p className="text-center text-xs text-pq-neutral-400">
              Updated {format(new Date(settings.updated_at), 'MMM d, yyyy')}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}

// ─── Dropdown Options Manager Card ───────────────────────────────────────────

function DropdownOptionsManager() {
  const [activeCategory, setActiveCategory] = useState<DropdownCategory>('WAREHOUSE_OPTIONS');
  const [options, setOptions]               = useState<DropdownOption[]>([]);
  const [loadingOpts, setLoadingOpts]       = useState(true);
  const [error, setError]                   = useState('');
  const [successMsg, setSuccessMsg]         = useState('');

  // Add form state
  const [showAdd, setShowAdd]         = useState(false);
  const [newValue, setNewValue]       = useState('');
  const [newLabel, setNewLabel]       = useState('');
  const [addSaving, setAddSaving]     = useState(false);

  // Inline edit state
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editLabel, setEditLabel]     = useState('');
  const [editSaving, setEditSaving]   = useState(false);

  // Track which options are being acted upon (for disable state)
  const [busyIds, setBusyIds]         = useState<Set<string>>(new Set());

  // Whether this category uses value/label pairs (doc types) vs plain strings
  const isDocTypeCategory = activeCategory === 'ACCREDITATION_DOC_TYPE_OPTIONS' || activeCategory === 'PRODUCT_DOC_TYPE_OPTIONS';

  const loadOptions = useCallback(async (cat: DropdownCategory) => {
    setLoadingOpts(true);
    setError('');
    try {
      const data = await fetchDropdownOptions(cat);
      setOptions(data);
    } catch (err) {
      setError((err as Error)?.message || 'Failed to load options.');
    } finally {
      setLoadingOpts(false);
    }
  }, []);

  useEffect(() => {
    setShowAdd(false);
    setEditingId(null);
    setSuccessMsg('');
    loadOptions(activeCategory);
  }, [activeCategory, loadOptions]);

  function clearFeedback() {
    setError('');
    setSuccessMsg('');
  }

  // ── Add ──────────────────────────────────────────────────────────────────────

  async function handleAdd() {
    clearFeedback();
    const val = newValue.trim();
    const lbl = newLabel.trim() || val;
    if (!val) {
      setError('Value is required.');
      return;
    }
    if (options.some(o => o.option_value === val)) {
      setError('This value already exists in this category.');
      return;
    }
    setAddSaving(true);
    try {
      const maxOrder = options.reduce((max, o) => Math.max(max, o.sort_order), 0);
      await createDropdownOption(activeCategory, val, lbl, maxOrder + 1);
      invalidateDropdownCache(activeCategory);
      await loadOptions(activeCategory);
      setNewValue('');
      setNewLabel('');
      setShowAdd(false);
      setSuccessMsg('Option added.');
    } catch (err) {
      setError((err as Error)?.message || 'Failed to add option.');
    } finally {
      setAddSaving(false);
    }
  }

  // ── Edit ─────────────────────────────────────────────────────────────────────

  function startEdit(opt: DropdownOption) {
    setEditingId(opt.id);
    setEditLabel(opt.option_label);
    clearFeedback();
  }

  async function saveEdit(id: string) {
    clearFeedback();
    const lbl = editLabel.trim();
    if (!lbl) { setError('Label is required.'); return; }
    setEditSaving(true);
    try {
      await updateDropdownOption(id, { option_label: lbl });
      invalidateDropdownCache(activeCategory);
      setOptions(prev => prev.map(o => o.id === id ? { ...o, option_label: lbl } : o));
      setEditingId(null);
      setSuccessMsg('Option updated.');
    } catch (err) {
      setError((err as Error)?.message || 'Failed to update option.');
    } finally {
      setEditSaving(false);
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────────

  async function handleDelete(opt: DropdownOption) {
    clearFeedback();
    setBusyIds(prev => new Set(prev).add(opt.id));
    try {
      await deleteDropdownOption(opt.id);
      invalidateDropdownCache(activeCategory);
      setOptions(prev => prev.filter(o => o.id !== opt.id));
      setSuccessMsg(`"${opt.option_label}" removed.`);
    } catch (err) {
      setError((err as Error)?.message || 'Failed to delete option.');
    } finally {
      setBusyIds(prev => { const s = new Set(prev); s.delete(opt.id); return s; });
    }
  }

  // ── Reorder ──────────────────────────────────────────────────────────────────

  async function moveOption(index: number, direction: 'up' | 'down') {
    clearFeedback();
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= options.length) return;

    const reordered = [...options];
    [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];
    setOptions(reordered);

    try {
      await reorderDropdownOptions(reordered.map(o => o.id));
      invalidateDropdownCache(activeCategory);
    } catch (err) {
      setError((err as Error)?.message || 'Failed to reorder.');
      await loadOptions(activeCategory); // rollback
    }
  }

  const activeOptions = options;

  return (
    <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-pq-neutral-200 bg-pq-neutral-50 flex items-center gap-2">
        <List className="w-3.5 h-3.5 text-pq-neutral-400" />
        <span className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
          Dropdown Options
        </span>
      </div>

      <div className="p-5 space-y-4">
        <p className="text-xs text-pq-neutral-500">
          Manage the dropdown values used across all forms. Select a category to view and edit its options.
        </p>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-1.5">
          {DROPDOWN_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-pq-primary-600 text-white'
                  : 'bg-pq-neutral-100 text-pq-neutral-600 hover:bg-pq-neutral-200'
              }`}
            >
              {DROPDOWN_CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* Options list */}
        {loadingOpts ? (
          <div className="py-6 text-center text-xs text-pq-neutral-400">Loading options…</div>
        ) : (
          <div className="space-y-3">
            {/* Active options table */}
            {activeOptions.length === 0 ? (
              <div className="py-6 text-center text-xs text-pq-neutral-400">No options configured for this category.</div>
            ) : (
              <>
                <div className="border border-pq-neutral-200 rounded-md overflow-hidden overflow-x-auto">
                  <table className="w-full min-w-[400px] text-xs">
                    <thead>
                      <tr className="bg-pq-neutral-50 border-b border-pq-neutral-200">
                        <th className="text-left px-3 py-2 font-medium text-pq-neutral-500 w-8">#</th>
                        {isDocTypeCategory && (
                          <th className="text-left px-3 py-2 font-medium text-pq-neutral-500">Value</th>
                        )}
                        <th className="text-left px-3 py-2 font-medium text-pq-neutral-500">
                          {isDocTypeCategory ? 'Label' : 'Option'}
                        </th>
                        <th className="text-right px-3 py-2 font-medium text-pq-neutral-500 w-28">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeOptions.map((opt, idx) => (
                        <tr key={opt.id} className="border-b border-pq-neutral-100 last:border-b-0 hover:bg-pq-neutral-50/50">
                          <td className="px-3 py-2 text-pq-neutral-400">{idx + 1}</td>
                          {isDocTypeCategory && (
                            <td className="px-3 py-2 text-pq-neutral-600 font-mono">{opt.option_value}</td>
                          )}
                          <td className="px-3 py-2 text-pq-neutral-800">
                            {editingId === opt.id ? (
                              <div className="flex items-center gap-1.5">
                                <Input
                                  value={editLabel}
                                  onChange={e => setEditLabel(e.target.value)}
                                  className="h-7 text-xs"
                                  autoFocus
                                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(opt.id); if (e.key === 'Escape') setEditingId(null); }}
                                />
                                <button
                                  onClick={() => saveEdit(opt.id)}
                                  disabled={editSaving}
                                  className="shrink-0 p-1 rounded hover:bg-pq-success-100 text-pq-success-600"
                                  title="Save"
                                >
                                  <Save className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="shrink-0 p-1 rounded hover:bg-pq-neutral-200 text-pq-neutral-400"
                                  title="Cancel"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              opt.option_label
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {editingId !== opt.id && opt.option_label !== 'Other' && (
                              <div className="flex items-center justify-end gap-0.5">
                                <button
                                  onClick={() => moveOption(idx, 'up')}
                                  disabled={idx === 0}
                                  className="p-1 rounded hover:bg-pq-neutral-200 text-pq-neutral-400 disabled:opacity-30"
                                  title="Move up"
                                >
                                  <ChevronUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => moveOption(idx, 'down')}
                                  disabled={idx === activeOptions.length - 1}
                                  className="p-1 rounded hover:bg-pq-neutral-200 text-pq-neutral-400 disabled:opacity-30"
                                  title="Move down"
                                >
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => startEdit(opt)}
                                  className="p-1 rounded hover:bg-pq-primary-100 text-pq-neutral-400 hover:text-pq-primary-600"
                                  title="Edit label"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDelete(opt)}
                                  disabled={busyIds.has(opt.id)}
                                  className="p-1 rounded hover:bg-pq-danger-100 text-pq-neutral-400 hover:text-pq-danger-600"
                                  title="Remove"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </>
            )}

            {/* Add new option form */}
            {showAdd ? (
              <div className="border border-pq-primary-200 rounded-md p-3 bg-pq-primary-50/30 space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-pq-neutral-700">Add New Option</span>
                  <button
                    onClick={() => { setShowAdd(false); setNewValue(''); setNewLabel(''); }}
                    className="ml-auto p-1 rounded hover:bg-pq-neutral-200 text-pq-neutral-400"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className={`grid gap-2 ${isDocTypeCategory ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <div className="space-y-1">
                    <label className="text-xs text-pq-neutral-500">{isDocTypeCategory ? 'Value (key)' : 'Option value'}</label>
                    <Input
                      value={newValue}
                      onChange={e => {
                        setNewValue(e.target.value);
                        // Auto-fill label for non-doc-type categories
                        if (!isDocTypeCategory) setNewLabel(e.target.value);
                      }}
                      className="h-8 text-xs"
                      placeholder={isDocTypeCategory ? 'e.g. quality_cert' : 'e.g. Main Warehouse'}
                      autoFocus
                    />
                  </div>
                  {isDocTypeCategory && (
                    <div className="space-y-1">
                      <label className="text-xs text-pq-neutral-500">Display label</label>
                      <Input
                        value={newLabel}
                        onChange={e => setNewLabel(e.target.value)}
                        className="h-8 text-xs"
                        placeholder="e.g. Quality Certificate"
                      />
                    </div>
                  )}
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={handleAdd}
                    disabled={addSaving || !newValue.trim()}
                    className="text-xs h-7"
                  >
                    {addSaving ? 'Adding…' : 'Add'}
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => { setShowAdd(true); clearFeedback(); }}
                className="flex items-center gap-1.5 text-xs text-pq-primary-600 hover:text-pq-primary-700 font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Option
              </button>
            )}
          </div>
        )}

        {/* Feedback */}
        {error && (
          <div className="flex items-start gap-2 text-xs text-pq-danger-600 bg-pq-danger-100 border border-pq-danger-100 rounded-md px-3 py-2.5">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            {error}
          </div>
        )}
        {successMsg && (
          <div className="flex items-start gap-2 text-xs text-pq-success-700 bg-pq-success-100 border border-pq-success-100 rounded-md px-3 py-2.5">
            <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            {successMsg}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AdminSettingsPage() {
  const router = useRouter();
  const { profile, loading: authLoading } = useAuth();

  const [settings, setSettings] = useState<SystemExpirySettings | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (authLoading) return;
    if (!profile || !isAdmin) {
      router.push('/dashboard');
      return;
    }
    getExpirySettings()
      .then(s => setSettings(s))
      .catch(err => setError((err as Error)?.message || 'Failed to load settings.'))
      .finally(() => setLoading(false));
  }, [authLoading, profile, isAdmin, router]);

  if (authLoading || loading) {
    return (
      <AppShell title="System Settings">
        <LoadingState message="Loading settings..." />
      </AppShell>
    );
  }

  if (!isAdmin) return null;

  return (
    <AppShell title="System Settings">
      <PageHeader
        title="System Settings"
        description="Configure system-wide rules, dropdown options, and accreditation settings."
      />

      <div className="mt-6 flex flex-col lg:flex-row gap-5 lg:items-start">

        {/* Expiry Settings — full width on mobile/tablet, sidebar on desktop */}
        <div className="w-full lg:w-64 lg:shrink-0 lg:sticky lg:top-6">
          {settings && (
            <ExpirySettingsCard
              settings={settings}
              onSettingsUpdate={setSettings}
              profile={profile!}
            />
          )}
          {error && !settings && (
            <div className="flex items-start gap-2 text-xs text-pq-danger-600 bg-pq-danger-100 border border-pq-danger-100 rounded-md px-3 py-2.5">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Dropdown Options Manager — full width always, flex-1 on desktop */}
        <div className="w-full lg:flex-1 lg:min-w-0">
          <DropdownOptionsManager />
        </div>

      </div>
    </AppShell>
  );
}
