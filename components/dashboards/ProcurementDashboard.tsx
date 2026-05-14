'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import type { UserProfile } from '@/types/auth';
import PageHeader from '@/components/shared/PageHeader';
import { ProcurementDashboardVisibilitySkeleton } from '@/components/shared/module-visibility-skeletons';
import { useModuleVisibility } from '@/hooks/use-module-visibility';
import { fetchProcurementStats } from '@/lib/canvassing';
import { fetchProcurementComplianceDashboardStats } from '@/lib/compliance-dashboard';
import {
  SendHorizontal as SendHorizonal,
  ShoppingCart,
  ArrowRight,
  PackageSearch,
  CheckCheck,
  CircleAlert as AlertCircle,
  TriangleAlert as AlertTriangle,
  BadgeCheck,
  Package,
  FlaskConical,
  CheckCircle2,
  XCircle,
  ClipboardList,
} from 'lucide-react';

interface Props { profile: UserProfile; }

/** Fills row width without fixed column counts (avoids 1 card in a 6-col grid). */
const KPI_GRID_CLASS =
  'grid grid-cols-1 gap-3 md:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]';

export default function ProcurementDashboard({ profile }: Props) {
  const { isModuleVisible, rulesLoading } = useModuleVisibility(profile);
  const [stats, setStats] = useState({
    forCanvassing: 0,
    openRfqs: 0,
    canvassingComplete: 0,
    high_priority_count: 0,
    medium_priority_count: 0,
  });
  const [cStats, setCStats] = useState({
    accreditationPendingReview: 0,
    productsPendingReview: 0,
    productsPendingTsqa: 0,
    verifiedProducts: 0,
    rejectedProducts: 0,
    rsePendingTsqa: 0,
  });

  useEffect(() => {
    fetchProcurementStats().then(setStats).catch(() => { });
  }, []);

  useEffect(() => {
    fetchProcurementComplianceDashboardStats().then(setCStats).catch(() => { });
  }, []);

  const cards = [
    { label: 'Awaiting RFQ', value: stats.forCanvassing, icon: PackageSearch, href: '/rfq' },
    { label: 'Open RFQs', value: stats.openRfqs, icon: SendHorizonal, href: '/rfq' },
    { label: 'Canvassing Done', value: stats.canvassingComplete, icon: CheckCheck, href: '/rfq' },
    { label: 'High Priority', value: stats.high_priority_count, icon: AlertCircle, href: '/rfq' },
    { label: 'Medium Priority', value: stats.medium_priority_count, icon: AlertTriangle, href: '/rfq' },
    { label: 'Purchase Orders', value: 0, icon: ShoppingCart, href: '/po' },
  ];

  const complianceCards = [
    { label: 'Accreditation queue', value: cStats.accreditationPendingReview, href: '/accreditation', icon: BadgeCheck },
    { label: 'Product review', value: cStats.productsPendingReview, href: '/accreditation/products', icon: ClipboardList },
    { label: 'Pending TSQA', value: cStats.productsPendingTsqa, href: '/accreditation/products', icon: Package },
    { label: 'RSE pending TSQA', value: cStats.rsePendingTsqa, href: '/accreditation/products', icon: FlaskConical },
    { label: 'Verified products', value: cStats.verifiedProducts, href: '/accreditation/products', icon: CheckCircle2 },
    { label: 'Rejected products', value: cStats.rejectedProducts, href: '/accreditation/products', icon: XCircle },
  ];

  const kpiCardClass =
    'bg-white rounded-[4px] border border-[#D8E2FF] p-2.5 flex items-center gap-2.5 min-h-[88px] transition hover:border-[#0F1F3A]';

  const showSupplierAccreditation = isModuleVisible('supplier_accreditation');
  const showProductReview = isModuleVisible('product_review');
  const showCanvassingRfq = isModuleVisible('canvassing_rfq');
  const showPurchaseOrders = isModuleVisible('purchase_orders');

  const accreditationQueueCard = complianceCards[0];
  const productComplianceCards = complianceCards.slice(1);
  const rfqStatCards = cards.slice(0, 5);
  const purchaseOrderStatCard = cards[5];

  const complianceHeadingVisible = showSupplierAccreditation || showProductReview;
  const rfqBandHeadingOnly = !complianceHeadingVisible && (showCanvassingRfq || showPurchaseOrders);

  const kpiNodes: ReactNode[] = [];
  if (showSupplierAccreditation) {
    const Icon = accreditationQueueCard.icon;
    kpiNodes.push(
      <Link
        key="accreditation-queue"
        href={accreditationQueueCard.href}
        className={kpiCardClass}
      >
        <div className="inline-flex items-center justify-center w-7 h-7 rounded-[4px] shrink-0 bg-[#F7F9FC] text-[#40527A]">
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold text-[#0F1F3A] leading-tight">{accreditationQueueCard.value}</p>
          <p className="text-[10px] text-[#40527A] leading-tight">{accreditationQueueCard.label}</p>
        </div>
      </Link>,
    );
  }
  if (showProductReview) {
    for (const card of productComplianceCards) {
      const Icon = card.icon;
      kpiNodes.push(
        <Link key={card.label} href={card.href} className={kpiCardClass}>
          <div className="inline-flex items-center justify-center w-7 h-7 rounded-[4px] shrink-0 bg-[#F7F9FC] text-[#40527A]">
            <Icon className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-[#0F1F3A] leading-tight">{card.value}</p>
            <p className="text-[10px] text-[#40527A] leading-tight">{card.label}</p>
          </div>
        </Link>,
      );
    }
  }
  if (showCanvassingRfq) {
    for (const card of rfqStatCards) {
      const Icon = card.icon;
      kpiNodes.push(
        <Link key={card.label} href={card.href} className={kpiCardClass}>
          <div className="inline-flex items-center justify-center w-7 h-7 rounded-[4px] shrink-0 bg-[#F7F9FC] text-[#40527A]">
            <Icon className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-[#0F1F3A] leading-tight">{card.value}</p>
            <p className="text-[10px] text-[#40527A] leading-tight">{card.label}</p>
          </div>
        </Link>,
      );
    }
  }
  if (showPurchaseOrders) {
    const Icon = purchaseOrderStatCard.icon;
    kpiNodes.push(
      <Link key={purchaseOrderStatCard.label} href={purchaseOrderStatCard.href} className={kpiCardClass}>
        <div className="inline-flex items-center justify-center w-7 h-7 rounded-[4px] shrink-0 bg-[#F7F9FC] text-[#40527A]">
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold text-[#0F1F3A] leading-tight">{purchaseOrderStatCard.value}</p>
          <p className="text-[10px] text-[#40527A] leading-tight">{purchaseOrderStatCard.label}</p>
        </div>
      </Link>,
    );
  }

  const hasKpis = kpiNodes.length > 0;

  return (
    <div>
      <PageHeader
        title={`Procurement — ${profile.full_name.split(' ')[0]}`}
        description={`${profile.position} · ${profile.department}`}
      />

      {rulesLoading ? (
        <ProcurementDashboardVisibilitySkeleton />
      ) : (
        <>
      {hasKpis && (
        <div className="mb-4 mt-1">
          {complianceHeadingVisible && (
            <>
              <h2 className="text-xs font-semibold text-[#40527A] uppercase tracking-wide mb-2">Supplier accreditation &amp; products</h2>
              <p className="text-[10px] text-[#BFC7D5] mb-3">
                Counts from live data. TSQA evaluates products only; accreditation approval stays with Procurement.
              </p>
            </>
          )}
          {rfqBandHeadingOnly && (
            <h2 className="text-xs font-semibold text-[#40527A] uppercase tracking-wide mb-2">RFQ &amp; purchase orders</h2>
          )}
          <div className={KPI_GRID_CLASS}>{kpiNodes}</div>
        </div>
      )}

      {/* Canvassing Queue + Open RFQs */}
      {showCanvassingRfq && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#D8E2FF]">
              <h2 className="text-sm font-semibold text-[#0F1F3A]">Canvassing Queue</h2>
              <Link href="/rfq" className="inline-flex items-center gap-1 text-xs text-[#1E4BFF] hover:text-[#0F1F3A] font-medium transition">
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="px-5 py-6 text-center">
              {stats.forCanvassing === 0 ? (
                <p className="text-sm text-[#BFC7D5]">No PR1s awaiting RFQ.</p>
              ) : (
                <div className="space-y-1">
                  <p className="text-3xl font-bold text-[#0F1F3A]">{stats.forCanvassing}</p>
                  <p className="text-sm text-[#40527A]">PR1{stats.forCanvassing !== 1 ? 's' : ''} ready for RFQ</p>
                  <Link href="/rfq" className="inline-flex items-center gap-1 mt-2 text-xs text-[#1E4BFF] hover:text-[#0F1F3A] font-semibold transition">
                    Go to canvassing queue <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#D8E2FF]">
              <h2 className="text-sm font-semibold text-[#0F1F3A]">Open RFQs</h2>
              <Link href="/rfq" className="inline-flex items-center gap-1 text-xs text-[#1E4BFF] hover:text-[#0F1F3A] font-medium transition">
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="px-5 py-6 text-center">
              {stats.openRfqs === 0 ? (
                <p className="text-sm text-[#BFC7D5]">No open RFQs at this time.</p>
              ) : (
                <div className="space-y-1">
                  <p className="text-3xl font-bold text-[#0F1F3A]">{stats.openRfqs}</p>
                  <p className="text-sm text-[#40527A]">RFQ{stats.openRfqs !== 1 ? 's' : ''} awaiting supplier response</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
