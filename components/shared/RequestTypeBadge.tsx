import type { PR1RequestType } from '@/types/pr1';

export function RequestTypeBadge({ type }: { type: PR1RequestType | 'raw_material' }) {
  if (type === 'services') {
    return (
      <span className="inline-flex items-center text-xs font-semibold border rounded-full px-2.5 py-0.5 bg-purple-50 text-purple-700 border-purple-200">
        Services
      </span>
    );
  }
  if (type === 'raw_material') {
    return (
      <span className="inline-flex items-center text-xs font-semibold border rounded-full px-2.5 py-0.5 bg-amber-50 text-amber-700 border-amber-200">
        Raw Material
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-xs font-semibold border rounded-full px-2.5 py-0.5 bg-pq-primary-50 text-pq-primary-700 border-pq-primary-200">
      Goods
    </span>
  );
}
