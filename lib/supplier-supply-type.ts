import type { SupplierSupplyType } from '@/lib/procurement-suppliers';

export type SupplyTypeFilter = 'all' | SupplierSupplyType;

export const SUPPLY_TYPE_LABELS: Record<SupplierSupplyType, string> = {
  raw_material: 'Raw mat',
  normal: 'Non raw mat',
  service: 'Service',
};

export const SUPPLY_TYPE_FILTER_OPTIONS: { value: SupplyTypeFilter; label: string }[] = [
  { value: 'all', label: 'All supply types' },
  { value: 'raw_material', label: 'Raw mat' },
  { value: 'normal', label: 'Non raw mat' },
  { value: 'service', label: 'Service' },
];

export function parseSupplierSupplyType(
  value: string | null | undefined,
): SupplierSupplyType | null {
  if (value === 'raw_material' || value === 'normal' || value === 'service') return value;
  return null;
}

export function supplyTypeLabel(value: SupplierSupplyType | null | undefined): string {
  if (!value) return '—';
  return SUPPLY_TYPE_LABELS[value];
}

export function matchesSupplyTypeFilter(
  value: SupplierSupplyType | null | undefined,
  filter: SupplyTypeFilter | string,
): boolean {
  if (!filter || filter === 'all') return true;
  return value === filter;
}
