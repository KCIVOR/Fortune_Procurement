import { cn } from '@/lib/utils';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalCount: number;
  entityLabel: string;
  loading?: boolean;
  onPageChange: (page: number) => void;
  className?: string;
}

export default function PaginationControls({
  currentPage,
  totalPages,
  pageSize,
  totalCount,
  entityLabel,
  loading = false,
  onPageChange,
  className,
}: PaginationControlsProps) {
  const start = totalCount === 0 ? 0 : Math.min((currentPage - 1) * pageSize + 1, totalCount);
  const end   = totalCount === 0 ? 0 : Math.min(currentPage * pageSize, totalCount);

  return (
    <div className={cn('w-full bg-white rounded-lg border border-pq-neutral-200 p-4', className)}>
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-xs text-pq-neutral-500 text-center sm:text-left order-2 sm:order-1">
          <span className="hidden sm:inline">Showing </span>
          {start}–{end}
          <span className="hidden sm:inline"> of</span>
          <span className="sm:hidden">/</span>
          {' '}{totalCount}
          <span className="hidden sm:inline"> {entityLabel}</span>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 order-1 sm:order-2">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1 || loading}
            className="px-4 py-2 sm:px-3 sm:py-1 text-xs font-medium text-pq-neutral-500 bg-pq-neutral-50 border border-pq-neutral-200 rounded hover:bg-pq-neutral-200 active:bg-pq-neutral-300 disabled:opacity-50 disabled:cursor-not-allowed transition min-w-[80px] sm:min-w-0"
          >
            Previous
          </button>
          <div className="text-xs text-pq-neutral-500 font-medium whitespace-nowrap">
            Page {currentPage} of {totalPages}
          </div>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || loading}
            className="px-4 py-2 sm:px-3 sm:py-1 text-xs font-medium text-pq-neutral-500 bg-pq-neutral-50 border border-pq-neutral-200 rounded hover:bg-pq-neutral-200 active:bg-pq-neutral-300 disabled:opacity-50 disabled:cursor-not-allowed transition min-w-[80px] sm:min-w-0"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
