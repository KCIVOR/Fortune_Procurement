import { cn } from '@/lib/utils';

const KPI_AUTO_FIT = 'grid grid-cols-1 gap-3 md:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]';

function PulseCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-[4px] border border-[#D8E2FF] animate-pulse bg-[#F7F9FC]',
        className,
      )}
    />
  );
}

/** Sidebar: placeholder rows matching nav link height (no real module labels). */
export function SidebarNavSkeleton({ isCollapsed }: { isCollapsed: boolean }) {
  const rows = 7;
  return (
    <div
      className={cn(
        'flex-1 py-4 space-y-0.5 overflow-y-auto transition-all duration-200',
        isCollapsed ? 'px-1.5' : 'px-3',
      )}
      aria-busy="true"
      aria-label="Loading navigation"
    >
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className={cn(
            'rounded-[4px] bg-white/5 animate-pulse',
            isCollapsed ? 'h-10 w-10 mx-auto' : 'h-10 w-full',
          )}
        />
      ))}
    </div>
  );
}

export function ProcurementDashboardVisibilitySkeleton() {
  return (
    <div className="mb-4 mt-1 space-y-4" aria-busy="true" aria-label="Loading dashboard modules">
      <div className="space-y-2">
        <div className="h-3 w-56 rounded bg-[#E8EDF7] animate-pulse" />
        <div className="h-2.5 w-full max-w-md rounded bg-[#F7F9FC] animate-pulse" />
      </div>
      <div className={KPI_AUTO_FIT}>
        {Array.from({ length: 8 }, (_, i) => (
          <PulseCard key={i} className="min-h-[88px]" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PulseCard className="min-h-[200px]" />
        <PulseCard className="min-h-[200px]" />
      </div>
    </div>
  );
}

export function SupplierDashboardVisibilitySkeleton() {
  return (
    <div className="space-y-6 mb-4 mt-1" aria-busy="true" aria-label="Loading dashboard modules">
      <div>
        <div className="h-3 w-44 rounded bg-[#E8EDF7] animate-pulse mb-2" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[repeat(auto-fit,minmax(10.5rem,1fr))]">
          {Array.from({ length: 6 }, (_, i) => (
            <PulseCard key={i} className="min-h-[88px]" />
          ))}
        </div>
      </div>
      <div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] mb-4">
          {Array.from({ length: 3 }, (_, i) => (
            <PulseCard key={i} className="min-h-[72px]" />
          ))}
        </div>
        <PulseCard className="min-h-[180px]" />
      </div>
    </div>
  );
}

export function WarehouseDashboardVisibilitySkeleton() {
  return (
    <div className="space-y-4 mb-4 mt-1" aria-busy="true" aria-label="Loading dashboard modules">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]">
        {Array.from({ length: 4 }, (_, i) => (
          <PulseCard key={i} className="min-h-[72px]" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PulseCard className="min-h-[220px]" />
        <PulseCard className="min-h-[220px]" />
      </div>
    </div>
  );
}

export function ApproverDashboardVisibilitySkeleton() {
  return (
    <div className="space-y-4 mb-4 mt-1" aria-busy="true" aria-label="Loading dashboard modules">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <PulseCard key={i} className="min-h-[72px]" />
        ))}
      </div>
      <PulseCard className="min-h-[240px]" />
    </div>
  );
}
