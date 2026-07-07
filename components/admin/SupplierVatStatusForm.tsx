'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { CircleAlert as AlertCircle, CircleCheck as CheckCircle2 } from 'lucide-react';

interface SupplierVatStatusFormProps {
  userId: string;
  initialIsVatRegistered: boolean;
  onSuccess?: (isVatRegistered: boolean) => void;
}

export default function SupplierVatStatusForm({
  userId,
  initialIsVatRegistered,
  onSuccess,
}: SupplierVatStatusFormProps) {
  const { session } = useAuth();
  const [isVatRegistered, setIsVatRegistered] = useState(initialIsVatRegistered);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setIsVatRegistered(initialIsVatRegistered);
  }, [initialIsVatRegistered]);

  const hasChanges = isVatRegistered !== initialIsVatRegistered;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(`/api/admin/users/${userId}/vat-status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ is_vat_registered: isVatRegistered }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error ?? 'Failed to update VAT status');
        return;
      }

      setSuccess(true);
      onSuccess?.(data.is_vat_registered ?? false);
      setTimeout(() => setSuccess(false), 2500);
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="space-y-1.5">
        <span className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
          VAT Registration
        </span>
        <p className="text-xs text-pq-neutral-500">
          Determines whether this supplier's quotations show a VAT-Inclusive / VAT-Exclusive
          option and are included in VAT computations downstream.
        </p>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            disabled={saving}
            onClick={() => setIsVatRegistered(true)}
            className={`flex-1 rounded border px-3 py-2 text-sm font-medium transition-colors ${
              isVatRegistered
                ? 'border-pq-primary-600 bg-pq-primary-50 text-pq-primary-700'
                : 'border-pq-neutral-200 text-pq-neutral-500 hover:bg-pq-neutral-50'
            }`}
          >
            VAT-able
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => setIsVatRegistered(false)}
            className={`flex-1 rounded border px-3 py-2 text-sm font-medium transition-colors ${
              !isVatRegistered
                ? 'border-pq-primary-600 bg-pq-primary-50 text-pq-primary-700'
                : 'border-pq-neutral-200 text-pq-neutral-500 hover:bg-pq-neutral-50'
            }`}
          >
            Non-VAT
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-xs text-pq-danger-600 bg-pq-danger-100 border border-pq-danger-100 rounded px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 text-xs text-pq-success-600 bg-pq-success-100 border border-pq-success-100 rounded px-3 py-2">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>VAT status updated.</span>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={!hasChanges || saving}
          className="bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-sm"
        >
          {saving ? 'Saving...' : 'Save VAT Status'}
        </Button>
      </div>
    </form>
  );
}
