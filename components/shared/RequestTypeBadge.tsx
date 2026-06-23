import type { PR1RequestType } from '@/types/pr1';

export function RequestTypeBadge({ type }: { type: PR1RequestType }) {
  if (type === 'services') {
    return (
      <span className="inline-flex items-center text-xs font-semibold border rounded-full px-2.5 py-0.5 bg-purple-50 text-purple-700 border-purple-200">
        Services
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-xs font-semibold border rounded-full px-2.5 py-0.5 bg-pq-primary-50 text-pq-primary-700 border-pq-primary-200">
      Goods
    </span>
  );
}
