'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X, CircleAlert as AlertCircle } from 'lucide-react';

interface PositionFormProps {
  mode: 'create' | 'edit';
  roles: Array<{ id: string; name: string }>;
  initialData?: {
    id: string;
    title: string;
    role_id: string;
  };
  workflowWarning?: boolean;
  onSubmit: (data: { title: string; role_id: string }) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function PositionForm({
  mode,
  roles,
  initialData,
  workflowWarning = false,
  onSubmit,
  onCancel,
  isLoading = false,
}: PositionFormProps) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [roleId, setRoleId] = useState(initialData?.role_id || '');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isValid = title.trim().length > 0 && roleId.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!isValid) {
      setError('Title and role are required');
      return;
    }

    try {
      setError(null);
      setIsSaving(true);
      await onSubmit({ title: title.trim(), role_id: roleId });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-xs text-red-800">{error}</p>
        </div>
      )}

      {workflowWarning && mode === 'edit' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
          <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-amber-900">Workflow Impact</p>
            <p className="text-xs text-amber-800 mt-1">
              This position may be used by approval workflows. Changing the title may affect future approval matching.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="title" className="text-xs font-medium text-[#40527A]">
          Position Title *
        </Label>
        <Input
          id="title"
          placeholder="e.g., Sales Manager, Department Head"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isLoading || isSaving}
          className="text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="role" className="text-xs font-medium text-[#40527A]">
          Role *
        </Label>
        <Select value={roleId} onValueChange={setRoleId} disabled={isLoading || isSaving}>
          <SelectTrigger className="text-sm">
            <SelectValue placeholder="Select a role" />
          </SelectTrigger>
          <SelectContent>
            {roles.map((role) => (
              <SelectItem key={role.id} value={role.id}>
                {role.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
          {isSaving ? 'Saving...' : mode === 'create' ? 'Create Position' : 'Update Position'}
        </Button>
      </div>
    </form>
  );
}
