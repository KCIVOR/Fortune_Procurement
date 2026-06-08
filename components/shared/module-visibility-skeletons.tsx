import { cn } from '@/lib/utils';
import { KPI_GRID_CLASS } from '@/components/shared/kpi-grid';

function PulseCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'w-full rounded-md border border-pq-neutral-200 animate-pulse bg-pq-neutral-50',
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
            'rounded-md bg-white/5 animate-pulse',
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
        <div className="h-2.5 w-full max-w-md rounded bg-pq-neutral-50 animate-pulse" />
      </div>
      <div className={KPI_GRID_CLASS}>
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
        <div className={KPI_GRID_CLASS}>
          {Array.from({ length: 6 }, (_, i) => (
            <PulseCard key={i} className="min-h-[88px]" />
          ))}
        </div>
      </div>
      <div>
        <div className={`${KPI_GRID_CLASS} mb-4`}>
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
      <div className={KPI_GRID_CLASS}>
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
      <div className={KPI_GRID_CLASS}>
        {Array.from({ length: 4 }, (_, i) => (
          <PulseCard key={i} className="min-h-[72px]" />
        ))}
      </div>
      <PulseCard className="min-h-[240px]" />
    </div>
  );
}
