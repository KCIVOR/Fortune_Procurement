'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';

interface UserSearchProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  isLoading?: boolean;
}

export default function UserSearch({ value, onChange, onClear, isLoading = false }: UserSearchProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="user-search" className="text-xs font-medium text-pq-neutral-500">
        Search by Name or Email
      </Label>
      <div className="relative">
        <Input
          id="user-search"
          placeholder="Search..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={isLoading}
          className="text-sm pr-8"
        />
        {value && (
          <button
            onClick={onClear}
            disabled={isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-pq-neutral-400 hover:text-pq-neutral-500 disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
