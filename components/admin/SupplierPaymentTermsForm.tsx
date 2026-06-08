'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import PaymentTermsSelect from '@/components/shared/PaymentTermsSelect';
import { useAuth } from '@/context/AuthContext';
import { CircleAlert as AlertCircle, CircleCheck as CheckCircle2 } from 'lucide-react';

interface SupplierPaymentTermsFormProps {
  userId: string;
  initialPaymentTerms?: string | null;
  onSuccess?: (paymentTerms: string | null) => void;
}

export default function SupplierPaymentTermsForm({
  userId,
  initialPaymentTerms = null,
  onSuccess,
}: SupplierPaymentTermsFormProps) {
  const { session } = useAuth();
  const [paymentTerms, setPaymentTerms] = useState(initialPaymentTerms ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setPaymentTerms(initialPaymentTerms ?? '');
  }, [initialPaymentTerms]);

  const hasChanges = paymentTerms.trim() !== (initialPaymentTerms ?? '').trim();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const trimmed = paymentTerms.trim();
      const response = await fetch(`/api/admin/users/${userId}/payment-terms`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ payment_terms: trimmed || null }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error ?? 'Failed to update payment terms');
        return;
      }

      setSuccess(true);
      onSuccess?.(data.payment_terms ?? null);
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
        <Label
          htmlFor="admin_supplier_payment_terms"
          className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide"
        >
          Default Payment Terms
        </Label>
        <p className="text-xs text-pq-neutral-500">
          Used to prefill PO generation for this supplier. Leave empty to clear the default.
        </p>
        <PaymentTermsSelect
          id="admin_supplier_payment_terms"
          value={paymentTerms}
          onChange={setPaymentTerms}
          disabled={saving}
          placeholder="No default set..."
        />
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
          <span>Payment terms updated.</span>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={!hasChanges || saving}
          className="bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-sm"
        >
          {saving ? 'Saving...' : 'Save Payment Terms'}
        </Button>
      </div>
    </form>
  );
}
