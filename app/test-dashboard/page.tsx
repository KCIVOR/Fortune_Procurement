'use client';

import { useState } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/shared/PageHeader';
import {
  PackageSearch, SendHorizontal, CheckCheck, CircleAlert, TriangleAlert,
  ShoppingCart, BadgeCheck, ClipboardList, Package, FlaskConical,
  CheckCircle2, XCircle, Bell, TrendingUp, Sparkles, ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Sample Data ──────────────────────────────────────────────────────────────
const SAMPLE_STATS = {
  accreditationQueue: 0,
  productReview: 0,
  highPriority: 0,
  mediumPriority: 0,
  awaitingRfq: 1,
  openRfqs: 1,
  canvassingDone: 3,
  purchaseOrders: 0,
  pendingTsqa: 2,
  rsePendingTsqa: 2,
  verifiedProducts: 1,
  rejectedProducts: 0,
};

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ title, description, icon }: { 
  title: string; description?: string; icon?: React.ReactNode 
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        {icon && <span className="text-pq-neutral-400">{icon}</span>}
        <h2 className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">{title}</h2>
      </div>
      {description && <p className="text-[11px] text-pq-neutral-400 mt-0.5 ml-6">{description}</p>}
    </div>
  );
}

// ─── Enhanced Stat Card ───────────────────────────────────────────────────────
function EnhancedStatCard({ label, value, icon, href, accent = 'blue', subtext, showClearState = false }: {
  label: string; value: number; icon: React.ReactNode; href: string;
  accent?: 'blue' | 'green' | 'amber' | 'red'; subtext?: string; showClearState?: boolean;
}) {
  const shouldShowClear = showClearState && value === 0;
  const accentClasses = {
    blue: 'bg-gradient-to-r from-pq-primary-500 to-pq-accent-500',
    green: 'bg-gradient-to-r from-pq-success-600 to-pq-success-500',
    amber: 'bg-gradient-to-r from-pq-warning-600 to-pq-warning-500',
    red: 'bg-gradient-to-r from-pq-danger-600 to-pq-danger-500',
  };

  return (
    <Link href={href} className="block transition hover:-translate-y-0.5">
      <div className={cn(
        'relative bg-pq-white border rounded-xl p-5 shadow-sm overflow-hidden transition hover:shadow-md min-h-[120px] h-full flex flex-col',
        shouldShowClear ? 'border-pq-neutral-200 opacity-60 hover:opacity-100' : 'border-pq-neutral-200 hover:border-pq-neutral-300'
      )}>
        <div className={cn('absolute top-0 left-0 right-0 h-[3px]', shouldShowClear ? 'bg-pq-neutral-200' : accentClasses[accent])} />
        <div className="flex justify-between items-start">
          <div className="text-xs font-bold uppercase tracking-wider text-pq-neutral-500 mb-2">{label}</div>
          <div className={cn('shrink-0', shouldShowClear ? 'text-pq-neutral-300' : 'text-pq-neutral-400')}>{icon}</div>
        </div>
        <div className="flex-grow flex items-center">
          {shouldShowClear ? (
            <div className="flex items-center gap-1.5 text-pq-success-600">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm font-semibold">All clear</span>
            </div>
          ) : (
            <span className="text-3xl font-extrabold text-pq-neutral-900 tracking-tight">{value}</span>
          )}
        </div>
        {subtext && !shouldShowClear && <div className="text-[11px] text-pq-neutral-500 mt-auto">{subtext}</div>}
      </div>
    </Link>
  );
}

// ─── Attention Banner ─────────────────────────────────────────────────────────
function AttentionBanner({ items }: { items: { label: string; count: number; href: string }[] }) {
  const activeItems = items.filter(i => i.count > 0);
  if (activeItems.length === 0) {
    return (
      <div className="flex items-center gap-3 bg-pq-success-50 border border-pq-success-200 rounded-lg px-4 py-3 mb-4">
        <div className="w-8 h-8 rounded-full bg-pq-success-100 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-pq-success-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-pq-success-700">All caught up!</p>
          <p className="text-xs text-pq-success-600">No items require your immediate attention.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 bg-pq-warning-50 border border-pq-warning-200 rounded-lg px-4 py-3 mb-4">
      <div className="w-8 h-8 rounded-full bg-pq-warning-100 flex items-center justify-center shrink-0">
        <Bell className="w-4 h-4 text-pq-warning-600" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-pq-warning-700">{activeItems.reduce((s, i) => s + i.count, 0)} items need attention</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
          {activeItems.map(i => (
            <Link key={i.label} href={i.href} className="text-xs text-pq-warning-600 hover:underline">{i.count} {i.label}</Link>
          ))}
        </div>
      </div>
    </div>
  );
}


// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TestDashboardPage() {
  const [stats] = useState(SAMPLE_STATS);
  const KPI_GRID = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3';

  const attentionItems = [
    { label: 'accreditation reviews', count: stats.accreditationQueue, href: '/accreditation' },
    { label: 'product reviews', count: stats.productReview, href: '/accreditation/products' },
    { label: 'high priority RFQs', count: stats.highPriority, href: '/rfq' },
    { label: 'medium priority RFQs', count: stats.mediumPriority, href: '/rfq' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Procurement — Ana" description="Procurement Staff · Procurement" />

      {/* ═══════════════════════════════════════════════════════════════════════
          RECOMMENDED DESIGN: Banner + Sectioned KPIs (no redundant panels)
          ═══════════════════════════════════════════════════════════════════════ */}
      
      {/* Attention Banner */}
      <AttentionBanner items={attentionItems} />

      {/* RFQ Pipeline Section */}
      <div>
        <SectionHeader title="RFQ Pipeline" description="Canvassing and quotation status" icon={<TrendingUp className="w-3.5 h-3.5" />} />
        <div className={KPI_GRID}>
          <EnhancedStatCard label="Awaiting RFQ" value={stats.awaitingRfq} icon={<PackageSearch className="w-5 h-5" />} href="/rfq" accent="blue" subtext="ready to send" />
          <EnhancedStatCard label="Open RFQs" value={stats.openRfqs} icon={<SendHorizontal className="w-5 h-5" />} href="/rfq" accent="blue" subtext="awaiting response" />
          <EnhancedStatCard label="Canvassing Done" value={stats.canvassingDone} icon={<CheckCheck className="w-5 h-5" />} href="/rfq" accent="green" subtext="ready for award" />
          <EnhancedStatCard label="Purchase Orders" value={stats.purchaseOrders} icon={<ShoppingCart className="w-5 h-5" />} href="/po" accent="blue" />
        </div>
      </div>

      {/* Compliance Section */}
      <div>
        <SectionHeader title="Compliance Status" description="Product verification and TSQA evaluation" icon={<Package className="w-3.5 h-3.5" />} />
        <div className={KPI_GRID}>
          <EnhancedStatCard label="Pending TSQA" value={stats.pendingTsqa} icon={<Package className="w-5 h-5" />} href="/accreditation/products" accent="amber" subtext="products awaiting eval" />
          <EnhancedStatCard label="RSE Pending" value={stats.rsePendingTsqa} icon={<FlaskConical className="w-5 h-5" />} href="/tsqa/rse" accent="amber" subtext="evaluations pending" />
          <EnhancedStatCard label="Verified" value={stats.verifiedProducts} icon={<CheckCircle2 className="w-5 h-5" />} href="/accreditation/products" accent="green" subtext="products approved" />
          <EnhancedStatCard label="Rejected" value={stats.rejectedProducts} icon={<XCircle className="w-5 h-5" />} href="/accreditation/products" accent="red" showClearState />
        </div>
      </div>


      {/* ═══════════════════════════════════════════════════════════════════════
          ALTERNATIVE: Compact Summary Cards (3 panels instead of 12 cards)
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="mt-8 pt-8 border-t-2 border-dashed border-pq-neutral-300">
        <div className="bg-pq-primary-50 border border-pq-primary-200 rounded-lg px-4 py-2 mb-4">
          <p className="text-xs font-semibold text-pq-primary-700">Alternative Design: Compact Summary Cards</p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Attention Summary */}
          <div className="bg-white rounded-xl border border-pq-neutral-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-pq-neutral-100 bg-pq-neutral-50 flex items-center gap-2">
              <Bell className="w-4 h-4 text-pq-warning-500" />
              <h4 className="text-sm font-semibold text-pq-neutral-900">Needs Attention</h4>
            </div>
            <div className="p-4 space-y-2.5">
              {[
                { label: 'Accreditation queue', value: stats.accreditationQueue },
                { label: 'Product reviews', value: stats.productReview },
                { label: 'High priority', value: stats.highPriority, danger: true },
                { label: 'Medium priority', value: stats.mediumPriority },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <span className="text-pq-neutral-600">{item.label}</span>
                  <span className={cn('font-semibold', item.value > 0 ? (item.danger ? 'text-pq-danger-600' : 'text-pq-warning-600') : 'text-pq-success-600')}>
                    {item.value > 0 ? item.value : '✓'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* RFQ Pipeline Summary */}
          <div className="bg-white rounded-xl border border-pq-neutral-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-pq-neutral-100 bg-pq-neutral-50 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-pq-primary-500" />
              <h4 className="text-sm font-semibold text-pq-neutral-900">RFQ Pipeline</h4>
            </div>
            <div className="p-4 space-y-2.5">
              {[
                { label: 'Awaiting RFQ', value: stats.awaitingRfq },
                { label: 'Open RFQs', value: stats.openRfqs },
                { label: 'Canvassing done', value: stats.canvassingDone, success: true },
                { label: 'Purchase orders', value: stats.purchaseOrders },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <span className="text-pq-neutral-600">{item.label}</span>
                  <span className={cn('font-semibold', item.success ? 'text-pq-success-600' : 'text-pq-neutral-900')}>{item.value}</span>
                </div>
              ))}
            </div>
            <div className="px-4 py-2 border-t border-pq-neutral-100 bg-pq-neutral-50">
              <Link href="/rfq" className="text-xs font-medium text-pq-primary-600 hover:text-pq-primary-700 flex items-center gap-1">
                View RFQ queue <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Compliance Summary */}
          <div className="bg-white rounded-xl border border-pq-neutral-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-pq-neutral-100 bg-pq-neutral-50 flex items-center gap-2">
              <Package className="w-4 h-4 text-pq-accent-500" />
              <h4 className="text-sm font-semibold text-pq-neutral-900">Compliance</h4>
            </div>
            <div className="p-4 space-y-2.5">
              {[
                { label: 'Pending TSQA', value: stats.pendingTsqa, warning: true },
                { label: 'RSE pending', value: stats.rsePendingTsqa, warning: true },
                { label: 'Verified products', value: stats.verifiedProducts, success: true },
                { label: 'Rejected', value: stats.rejectedProducts, danger: true },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <span className="text-pq-neutral-600">{item.label}</span>
                  <span className={cn('font-semibold', 
                    item.success ? 'text-pq-success-600' : 
                    item.danger && item.value > 0 ? 'text-pq-danger-600' : 
                    item.warning && item.value > 0 ? 'text-pq-warning-600' : 'text-pq-neutral-900'
                  )}>{item.value}</span>
                </div>
              ))}
            </div>
            <div className="px-4 py-2 border-t border-pq-neutral-100 bg-pq-neutral-50">
              <Link href="/accreditation/products" className="text-xs font-medium text-pq-primary-600 hover:text-pq-primary-700 flex items-center gap-1">
                View products <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
