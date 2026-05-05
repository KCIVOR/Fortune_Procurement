import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface PriorityMeta {
  label: string;
  bg: string;
  text: string;
}

function getPriorityMeta(value: string | null | undefined): PriorityMeta {
  const normalized = value ?? 'normal';
  const metaMap: Record<string, PriorityMeta> = {
    normal: { label: 'Normal', bg: 'bg-gray-100', text: 'text-gray-700' },
    medium: { label: 'Medium', bg: 'bg-yellow-100', text: 'text-yellow-800' },
    high: { label: 'High', bg: 'bg-red-100', text: 'text-red-700' },
  };
  return metaMap[normalized] || metaMap.normal;
}

export function getPriorityLabel(value: string | null | undefined): string {
  return getPriorityMeta(value).label;
}

export function getPriorityToneClass(value: string | null | undefined): 'normal' | 'medium' | 'high' {
  if (!value) return 'normal';
  if (value === 'normal') return 'normal';
  if (value === 'medium') return 'medium';
  if (value === 'high') return 'high';
  return 'normal';
}

export function getPriorityColors(value: string | null | undefined): { bg: string; text: string; label: string } {
  const meta = getPriorityMeta(value);
  return { bg: meta.bg, text: meta.text, label: meta.label };
}

export function getFallbackRoute(role: string | null | undefined): string {
  if (!role) return '/dashboard';

  switch (role) {
    case 'employee':
      return '/pr1';
    case 'procurement':
      return '/pr2';
    case 'warehouse':
      return '/warehouse';
    case 'supplier':
      return '/supplier/quotations';
    case 'approver':
    case 'director':
    case 'supervisor':
    case 'dept_head':
    case 'finance_director':
      return '/dashboard';
    default:
      return '/dashboard';
  }
}
