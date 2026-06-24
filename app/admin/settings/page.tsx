'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { getExpirySettings, updateExpirySettings } from '@/lib/system-settings';
import type { SystemExpirySettings } from '@/types/database';
import { format } from 'date-fns';
import { Settings, CalendarClock, CheckCircle2, AlertCircle } from 'lucide-react';

export default function AdminSettingsPage() {
  const router = useRouter();
  const { profile, loading: authLoading } = useAuth();

  const [settings, setSettings]           = useState<SystemExpirySettings | null>(null);
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState('');
  const [successMsg, setSuccessMsg]       = useState('');
  const [accDays, setAccDays]             = useState('');
  const [productDays, setProductDays]     = useState('');

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (authLoading) return;
    if (!profile || !isAdmin) {
      router.push('/dashboard');
      return;
    }
    getExpirySettings()
      .then(s => {
        setSettings(s);
        setAccDays(String(s.accreditation_validity_days));
        setProductDays(String(s.product_validity_days));
      })
      .catch(err => setError((err as Error)?.message || 'Failed to load settings.'))
      .finally(() => setLoading(false));
  }, [authLoading, profile, isAdmin, router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
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
      await updateExpirySettings(profile, {
        accreditation_validity_days: acc,
        product_validity_days:       product,
      });
      setSettings(prev => prev ? { ...prev, accreditation_validity_days: acc, product_validity_days: product, updated_at: new Date().toISOString() } : prev);
      setSuccessMsg('Settings saved. Changes apply to new approvals only — existing records are unaffected.');
    } catch (err) {
      setError((err as Error)?.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }

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
        description="Configure system-wide rules for accreditation and product/service verification."
      />

      <div className="max-w-xl space-y-6 mt-6">

        {/* Expiry settings card */}
        <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-pq-neutral-200 bg-pq-neutral-50 flex items-center gap-2">
            <CalendarClock className="w-3.5 h-3.5 text-pq-neutral-400" />
            <span className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
              Accreditation &amp; Verification Expiry
            </span>
          </div>

          <form onSubmit={handleSave} className="p-5 space-y-5">
            <p className="text-xs text-pq-neutral-500">
              Set how many days after approval/verification a record stays valid before the nightly job marks it as expired.
              Changes apply to <span className="font-semibold">new approvals only</span> — existing records are not retroactively changed.
            </p>

            {/* Accreditation */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-pq-neutral-700">
                Supplier Accreditation valid for
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={accDays}
                  onChange={e => setAccDays(e.target.value)}
                  className="w-28 rounded-md border border-pq-neutral-300 px-3 py-2 text-sm text-pq-neutral-900 focus:outline-none focus:ring-2 focus:ring-pq-primary-500"
                />
                <span className="text-sm text-pq-neutral-500">days</span>
                <span className="text-xs text-pq-neutral-400 ml-1">
                  {!isNaN(parseInt(accDays)) && parseInt(accDays) > 0
                    ? `(${(parseInt(accDays) / 365).toFixed(1)} yr${parseInt(accDays) === 365 ? '' : 's'})`
                    : ''}
                </span>
              </div>
            </div>

            {/* Product / Service */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-pq-neutral-700">
                Product / Service Verification valid for
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={productDays}
                  onChange={e => setProductDays(e.target.value)}
                  className="w-28 rounded-md border border-pq-neutral-300 px-3 py-2 text-sm text-pq-neutral-900 focus:outline-none focus:ring-2 focus:ring-pq-primary-500"
                />
                <span className="text-sm text-pq-neutral-500">days</span>
                <span className="text-xs text-pq-neutral-400 ml-1">
                  {!isNaN(parseInt(productDays)) && parseInt(productDays) > 0
                    ? `(${(parseInt(productDays) / 365).toFixed(1)} yr${parseInt(productDays) === 365 ? '' : 's'})`
                    : ''}
                </span>
              </div>
            </div>

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

            <div className="flex items-center justify-between pt-1">
              {settings?.updated_at && (
                <span className="text-xs text-pq-neutral-400">
                  Last updated {format(new Date(settings.updated_at), 'MMM d, yyyy · h:mm a')}
                </span>
              )}
              <Button type="submit" disabled={saving} className="ml-auto text-xs">
                {saving ? 'Saving…' : 'Save Settings'}
              </Button>
            </div>
          </form>
        </div>

      </div>
    </AppShell>
  );
}
