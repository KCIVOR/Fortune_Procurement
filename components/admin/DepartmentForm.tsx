'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';

interface DepartmentFormProps {
  mode: 'create' | 'edit';
  initialData?: {
    id: string;
    name: string;
    code: string;
  };
  onSubmit: (data: { name: string; code: string }) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function DepartmentForm({
  mode,
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}: DepartmentFormProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [code, setCode] = useState(initialData?.code || '');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isValid = name.trim().length > 0 && code.trim().length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!isValid) {
      setError('Name and code are required');
      return;
    }

    try {
      setError(null);
      setIsSaving(true);
      await onSubmit({ name: name.trim(), code: code.trim() });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-lg p-3">
          <p className="text-xs text-pq-danger-600">{error}</p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="name" className="text-xs font-medium text-pq-neutral-500">
          Department Name *
        </Label>
        <Input
          id="name"
          placeholder="e.g., Sales, Marketing, Finance"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isLoading || isSaving}
          className="text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="code" className="text-xs font-medium text-pq-neutral-500">
          Department Code *
        </Label>
        <Input
          id="code"
          placeholder="e.g., SAL, MKT, FIN"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          disabled={isLoading || isSaving}
          className="text-sm font-mono"
        />
        <p className="text-xs text-pq-neutral-500">Must be unique</p>
      </div>

      <div className="flex items-center justify-end gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={isSaving}
          className="text-xs"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!isValid || isLoading || isSaving}
          size="sm"
          className="text-xs"
        >
          {isSaving ? 'Saving...' : mode === 'create' ? 'Create Department' : 'Update Department'}
        </Button>
      </div>
    </form>
  );
}
