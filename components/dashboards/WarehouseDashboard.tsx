'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { StatCard } from '@/components/shared/StatCard';
import type { UserProfile } from '@/types/auth';
import PageHeader from '@/components/shared/PageHeader';
import { WarehouseDashboardVisibilitySkeleton } from '@/components/shared/module-visibility-skeletons';
import { useModuleVisibility } from '@/hooks/use-module-visibility';
import { KPI_GRID_CLASS } from '@/components/shared/kpi-grid';
import { supabase } from '@/lib/supabase';
import { fetchWarehouseQueue } from '@/lib/warehouse';
import { fetchGRNQueue } from '@/lib/grn';
import type { PR1QueueRow } from '@/types/warehouse';
import type { GRNQueueRow } from '@/types/grn';
import { PackageSearch, PackageCheck, Clock, CircleCheck as CheckCircle2, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { DashboardQueueSkeleton } from '@/components/shared/structural-skeletons';

interface Props { profile: UserProfile; }

const STAT_GRID_CLASS = KPI_GRID_CLASS + ' mb-4 mt-1';

interface Stats {
  pendingValidation: number;
  validatedToday: number;
  openGRN: number;
  grnCompleted: number;
}

const db = supabase as any;

async function fetchWarehouseStats(): Promise<Stats> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [pendingRes, validatedRes, openGRNRes, closedGRNRes] = await Promise.all([
    db.from('pr1_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending_warehouse'),
    db.from('warehouse_validations')
      .select('id', { count: 'exact', head: true })
      .gte('validated_at', todayStart.toISOString())
      .lte('validated_at', todayEnd.toISOString()),
    db.from('grn_receipts')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open'),
    db.from('grn_receipts')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'closed'),
  ]);

  return {
    pendingValidation: pendingRes.count ?? 0,
    validatedToday: validatedRes.count ?? 0,
    openGRN: openGRNRes.count ?? 0,
    grnCompleted: closedGRNRes.count ?? 0,
  };
}

export default function WarehouseDashboard({ profile }: Props) {
  const { isModuleVisible, rulesLoading } = useModuleVisibility(profile);
  const [stats, setStats] = useState<Stats>({ pendingValidation: 0, validatedToday: 0, openGRN: 0, grnCompleted: 0 });
  const [pendingPRs, setPendingPRs] = useState<PR1QueueRow[]>([]);
  const [openGRNs, setOpenGRNs] = useState<GRNQueueRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchWarehouseStats(),
      fetchWarehouseQueue(),
      fetchGRNQueue(),
    ])
      .then(([s, prs, grns]) => {
        setStats(s);
        setPendingPRs(prs.slice(0, 10));
        setOpenGRNs(grns.filter(g => g.status === 'open').slice(0, 10));
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  const statCards = [
    { label: 'Pending Validation', value: stats.pendingValidation, icon: Clock, moduleKey: 'warehouse_validation' as const },
    { label: 'Validated Today', value: stats.validatedToday, icon: CheckCircle2, moduleKey: 'warehouse_validation' as const },
    { label: 'Open GRN', value: stats.openGRN, icon: PackageSearch, moduleKey: 'goods_receipt' as const },
    { label: 'GRN Completed', value: stats.grnCompleted, icon: PackageCheck, moduleKey: 'goods_receipt' as const },
  ];

  const visibleStatCards = statCards.filter((s) => isModuleVisible(s.moduleKey));
  const showWarehousePanel = isModuleVisible('warehouse_validation');
  const showGrnPanel = isModuleVisible('goods_receipt');
  const showPanelsRow = showWarehousePanel || showGrnPanel;

  return (
    <div>
      <PageHeader
        title={`Warehouse — ${profile.full_name.split(' ')[0]}`}
        description="Validate purchase requests and process goods receipts."
      />

      {rulesLoading ? (
        <WarehouseDashboardVisibilitySkeleton />
      ) : (
        <>
      {visibleStatCards.length > 0 && (
      <div className={STAT_GRID_CLASS}>
        {visibleStatCards.map((stat) => {
          const Icon = stat.icon;
          const lowerLabel = stat.label.toLowerCase();
          const accent = lowerLabel.includes('completed')
            ? 'green'
            : lowerLabel.includes('pending')
            ? 'amber'
            : 'blue';

          return (
            <StatCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              icon={<Icon className="w-5 h-5" />}
              accent={accent}
              isLoading={loading}
            />
          );
        })}
      </div>
      )}

      {showPanelsRow && (
      <div className={showWarehousePanel && showGrnPanel ? 'grid grid-cols-1 lg:grid-cols-2 gap-4' : 'grid grid-cols-1 gap-4'}>

        {/* Pending Validation Queue */}
        {showWarehousePanel && (
        <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-pq-neutral-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-pq-neutral-900">Pending Validation Queue</h2>
            <Link href="/warehouse" className="text-xs text-pq-primary-600 hover:text-pq-primary-600 font-medium flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {loading ? (
            <DashboardQueueSkeleton rows={3} />
          ) : pendingPRs.length === 0 ? (
            <div className="px-5 py-8 text-xs text-pq-neutral-400 text-center">No items pending validation.</div>
          ) : (
            <div className="divide-y divide-pq-neutral-200">
              {pendingPRs.map(row => (
                <Link
                  key={row.id}
                  href={`/warehouse/${row.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-pq-neutral-50 transition-colors group"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-mono font-semibold text-pq-neutral-900">{row.pr1_number}</p>
                    <p className="text-xs text-pq-neutral-500 truncate">{row.requisitioner_name_snapshot} · {row.department_name_snapshot}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    {row.validation_decision ? (
                      <span className="text-xs font-medium text-pq-success-600 bg-pq-success-100 border border-pq-success-100 rounded-full px-2.5 py-0.5 capitalize">
                        {row.validation_decision}
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-pq-warning-600 bg-pq-warning-100 border border-pq-warning-100 rounded-full px-2.5 py-0.5">
                        Pending
                      </span>
                    )}
                    <ArrowRight className="w-3.5 h-3.5 text-pq-neutral-400 group-hover:text-pq-neutral-900 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
        )}

        {/* Open Goods Receipts */}
        {showGrnPanel && (
        <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-pq-neutral-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-pq-neutral-900">Open Goods Receipts</h2>
            <Link href="/grn" className="text-xs text-pq-primary-600 hover:text-pq-primary-600 font-medium flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {loading ? (
            <DashboardQueueSkeleton rows={3} />
          ) : openGRNs.length === 0 ? (
            <div className="px-5 py-8 text-xs text-pq-neutral-400 text-center">No open GRNs at this time.</div>
          ) : (
            <div className="divide-y divide-pq-neutral-200">
              {openGRNs.map(row => (
                <Link
                  key={row.id}
                  href={`/grn/${row.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-pq-neutral-50 transition-colors group"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-mono font-semibold text-pq-neutral-900">{row.grn_number}</p>
                    <p className="text-xs text-pq-neutral-500 truncate">{row.supplier_name_snapshot} · {row.po_number_snapshot}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <span className="text-xs text-pq-neutral-500">
                      {row.transaction_date ? format(new Date(row.transaction_date), 'MMM d') : '—'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-pq-neutral-400 group-hover:text-pq-neutral-900 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
        )}

      </div>
      )}
        </>
      )}
    </div>
  );
}
