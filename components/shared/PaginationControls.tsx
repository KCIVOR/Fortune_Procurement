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
    <div className={cn('w-full bg-white rounded-lg border border-[#E5EAFF] p-4', className)}>
      <div className="flex items-center justify-between">
        <div className="text-xs text-[#40527A]">
          Showing {start}–{end} of {totalCount} {entityLabel}
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1 || loading}
            className="px-3 py-1 text-xs font-medium text-[#40527A] bg-[#F7F9FC] border border-[#D8E2FF] rounded hover:bg-[#E5EAFF] disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Previous
          </button>
          <div className="text-xs text-[#40527A] font-medium">
            Page {currentPage} of {totalPages}
          </div>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || loading}
            className="px-3 py-1 text-xs font-medium text-[#40527A] bg-[#F7F9FC] border border-[#D8E2FF] rounded hover:bg-[#E5EAFF] disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
