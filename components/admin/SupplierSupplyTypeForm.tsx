'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import type { SupplierSupplyType } from '@/lib/procurement-suppliers';
import { CircleAlert as AlertCircle, CircleCheck as CheckCircle2 } from 'lucide-react';

const OPTIONS: { value: SupplierSupplyType; label: string; hint: string }[] = [
  {
    value: 'raw_material',
    label: 'Raw material',
    hint: 'Inputs such as glue, cardboard, etc.',
  },
  {
    value: 'normal',
    label: 'Normal',
    hint: 'Regular goods such as ballpen, paper — not raw materials.',
  },
  {
    value: 'service',
    label: 'Service',
    hint: 'Services such as calibration.',
  },
];

interface SupplierSupplyTypeFormProps {
  userId: string;
  initialSupplyType: SupplierSupplyType | null;
  onSuccess?: (supplyType: SupplierSupplyType | null) => void;
}

export default function SupplierSupplyTypeForm({
  userId,
  initialSupplyType,
  onSuccess,
}: SupplierSupplyTypeFormProps) {
  const { session } = useAuth();
  const [supplyType, setSupplyType] = useState<SupplierSupplyType | null>(initialSupplyType);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setSupplyType(initialSupplyType);
  }, [initialSupplyType]);

  const hasChanges = supplyType !== initialSupplyType;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (supplyType === null) {
      setError('Select a supply type before saving.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(`/api/admin/users/${userId}/supply-type`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ supplier_supply_type: supplyType }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error ?? 'Failed to update supply type');
        return;
      }

      setSuccess(true);
      onSuccess?.(data.supplier_supply_type ?? null);
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
          Supply type
        </span>
        <p className="text-xs text-pq-neutral-500">
          Exclusive classification for this supplier account. Does not automatically change
          product catalog or RFQ rules.
        </p>
        <div className="grid gap-2 pt-1 sm:grid-cols-3">
          {OPTIONS.map((opt) => {
            const selected = supplyType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={saving}
                onClick={() => setSupplyType(opt.value)}
                className={`rounded border px-3 py-2 text-left transition-colors ${
                  selected
                    ? 'border-pq-primary-600 bg-pq-primary-50 text-pq-primary-700'
                    : 'border-pq-neutral-200 text-pq-neutral-700 hover:bg-pq-neutral-50'
                }`}
              >
                <span className="block text-sm font-medium">{opt.label}</span>
                <span className="mt-0.5 block text-xs text-pq-neutral-500">{opt.hint}</span>
              </button>
            );
          })}
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
          <span>Supply type updated.</span>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={!hasChanges || saving || supplyType === null}
          className="bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-sm"
        >
          {saving ? 'Saving...' : 'Save Supply Type'}
        </Button>
      </div>
    </form>
  );
}
