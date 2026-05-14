'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { UserProfile } from '@/types/auth';
import PageHeader from '@/components/shared/PageHeader';
import { WarehouseDashboardVisibilitySkeleton } from '@/components/shared/module-visibility-skeletons';
import { useModuleVisibility } from '@/hooks/use-module-visibility';
import { supabase } from '@/lib/supabase';
import { fetchWarehouseQueue } from '@/lib/warehouse';
import { fetchGRNQueue } from '@/lib/grn';
import type { PR1QueueRow } from '@/types/warehouse';
import type { GRNQueueRow } from '@/types/grn';
import { PackageSearch, PackageCheck, Clock, CircleCheck as CheckCircle2, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

interface Props { profile: UserProfile; }

const STAT_GRID_CLASS =
  'grid grid-cols-1 gap-3 md:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] mb-4 mt-1';

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
          return (
            <div key={stat.label} className="bg-white rounded-[4px] border border-[#D8E2FF] p-3 flex items-center gap-3">
              <div className="inline-flex items-center justify-center w-8 h-8 rounded-[4px] shrink-0 bg-[#F7F9FC] text-[#40527A]">
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold text-[#0F1F3A] leading-tight">{stat.value}</p>
                <p className="text-xs text-[#40527A] leading-tight">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {showPanelsRow && (
      <div className={showWarehousePanel && showGrnPanel ? 'grid grid-cols-1 lg:grid-cols-2 gap-4' : 'grid grid-cols-1 gap-4'}>

        {/* Pending Validation Queue */}
        {showWarehousePanel && (
        <div className="bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#D8E2FF] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#0F1F3A]">Pending Validation Queue</h2>
            <Link href="/warehouse" className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {loading ? (
            <div className="px-5 py-8 text-xs text-[#BFC7D5] text-center">Loading...</div>
          ) : pendingPRs.length === 0 ? (
            <div className="px-5 py-8 text-xs text-[#BFC7D5] text-center">No items pending validation.</div>
          ) : (
            <div className="divide-y divide-[#D8E2FF]">
              {pendingPRs.map(row => (
                <Link
                  key={row.id}
                  href={`/warehouse/${row.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-[#F7F9FC] transition-colors group"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-mono font-semibold text-[#0F1F3A]">{row.pr1_number}</p>
                    <p className="text-xs text-[#40527A] truncate">{row.requisitioner_name_snapshot} · {row.department_name_snapshot}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    {row.validation_decision ? (
                      <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5 capitalize">
                        {row.validation_decision}
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5">
                        Pending
                      </span>
                    )}
                    <ArrowRight className="w-3.5 h-3.5 text-[#BFC7D5] group-hover:text-[#0F1F3A] transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
        )}

        {/* Open Goods Receipts */}
        {showGrnPanel && (
        <div className="bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#D8E2FF] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#0F1F3A]">Open Goods Receipts</h2>
            <Link href="/grn" className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {loading ? (
            <div className="px-5 py-8 text-xs text-[#BFC7D5] text-center">Loading...</div>
          ) : openGRNs.length === 0 ? (
            <div className="px-5 py-8 text-xs text-[#BFC7D5] text-center">No open GRNs at this time.</div>
          ) : (
            <div className="divide-y divide-[#D8E2FF]">
              {openGRNs.map(row => (
                <Link
                  key={row.id}
                  href={`/grn/${row.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-[#F7F9FC] transition-colors group"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-mono font-semibold text-[#0F1F3A]">{row.grn_number}</p>
                    <p className="text-xs text-[#40527A] truncate">{row.supplier_name_snapshot} · {row.po_number_snapshot}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <span className="text-xs text-[#40527A]">
                      {row.transaction_date ? format(new Date(row.transaction_date), 'MMM d') : '—'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#BFC7D5] group-hover:text-[#0F1F3A] transition-colors" />
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
