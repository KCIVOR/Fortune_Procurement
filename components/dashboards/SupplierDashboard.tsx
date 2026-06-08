'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { StatCard } from '@/components/shared/StatCard';
import type { UserProfile } from '@/types/auth';
import PageHeader from '@/components/shared/PageHeader';
import { SupplierDashboardVisibilitySkeleton } from '@/components/shared/module-visibility-skeletons';
import { useModuleVisibility } from '@/hooks/use-module-visibility';
import { fetchSupplierStats } from '@/lib/canvassing';
import { fetchSupplierComplianceDashboardStats } from '@/lib/compliance-dashboard';
import {
  Tag,
  Clock,
  ArrowRight,
  BadgeCheck,
  Package,
  CheckCircle2,
  CircleAlert,
} from 'lucide-react';

import { KPI_GRID_CLASS } from '@/components/shared/kpi-grid';

interface Props { profile: UserProfile; }

export default function SupplierDashboard({ profile }: Props) {
  const { isModuleVisible, rulesLoading } = useModuleVisibility(profile);
  const [stats, setStats] = useState({ openRfqs: 0, submitted: 0, pending: 0 });
  const [cStats, setCStats] = useState({
    accreditationStatus: null as string | null,
    totalProducts: 0,
    verifiedProducts: 0,
    inReviewProducts: 0,
    pendingTsqaProducts: 0,
    rejectedProducts: 0,
    rfqsPendingProductValidation: 0,
  });

  useEffect(() => {
    fetchSupplierStats(profile.id).then(setStats).catch(() => { });
  }, [profile.id]);

  useEffect(() => {
    fetchSupplierComplianceDashboardStats(profile.id).then(setCStats).catch(() => { });
  }, [profile.id]);

  const cards = [
    { label: 'Open RFQs', value: stats.openRfqs, icon: Tag, href: '/supplier/quotations' },
    { label: 'Pending Response', value: stats.pending, icon: Clock, href: '/supplier/quotations' },
  ];

  const accLabel = cStats.accreditationStatus
    ? cStats.accreditationStatus.replace(/_/g, ' ')
    : 'No application';

  const showPortalAccred = isModuleVisible('supplier_portal_accreditation');
  const showSupplierProducts = isModuleVisible('supplier_products');
  const showQuotations = isModuleVisible('supplier_quotations');
  const showAccredCatalogBand = showPortalAccred || showSupplierProducts;

  return (
    <div>
      <PageHeader
        title="Supplier Portal"
        description={`Welcome, ${profile.full_name}. Respond to active RFQs and keep your accreditation and catalog up to date.`}
      />

      {rulesLoading ? (
        <SupplierDashboardVisibilitySkeleton />
      ) : (
        <>
          {/* Accreditation + catalog — KPI band */}
          {showAccredCatalogBand && (
            <div className="mb-4 mt-1">
              <h2 className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-2">Accreditation &amp; catalog</h2>
              <div className={KPI_GRID_CLASS}>
                {showPortalAccred && (
                  <Link href="/supplier/accreditation" className="block w-full min-w-0 transition hover:-translate-y-0.5">
                    <StatCard
                      label="Accreditation status"
                      value={accLabel}
                      icon={<BadgeCheck className="w-5 h-5 text-pq-neutral-500" />}
                      accent={cStats.accreditationStatus === 'verified' || cStats.accreditationStatus === 'accredited' ? 'green' : cStats.accreditationStatus?.includes('pending') ? 'amber' : 'blue'}
                    />
                  </Link>
                )}
                {showSupplierProducts && (
                  <>
                    <Link href="/supplier/products" className="block w-full min-w-0 transition hover:-translate-y-0.5">
                      <StatCard
                        label="Total products"
                        value={cStats.totalProducts}
                        icon={<Package className="w-5 h-5 text-pq-neutral-500" />}
                        accent="blue"
                      />
                    </Link>
                    <Link href="/supplier/products" className="block w-full min-w-0 transition hover:-translate-y-0.5">
                      <StatCard
                        label="Verified"
                        value={cStats.verifiedProducts}
                        icon={<CheckCircle2 className="w-5 h-5 text-pq-success-600" />}
                        accent="green"
                      />
                    </Link>
                    <Link href="/supplier/products" className="block w-full min-w-0 transition hover:-translate-y-0.5">
                      <StatCard
                        label="Pending review"
                        value={cStats.inReviewProducts + cStats.pendingTsqaProducts}
                        icon={<Clock className="w-5 h-5 text-pq-warning-600" />}
                        accent="amber"
                      />
                    </Link>
                  </>
                )}
              </div>
            </div>
          )}

          {/* RFQ KPI cards */}
          {showQuotations && (
            <>
              <div className={`${KPI_GRID_CLASS} mb-4`}>
                {cards.map(card => {
                  const Icon = card.icon;
                  const lowerLabel = card.label.toLowerCase();
                  const accent = lowerLabel.includes('pending')
                    ? 'amber'
                    : lowerLabel.includes('submitted')
                      ? 'green'
                      : 'blue';

                  return (
                    <Link key={card.label} href={card.href} className="block w-full min-w-0 transition hover:-translate-y-0.5">
                      <StatCard
                        label={card.label}
                        value={card.value}
                        icon={<Icon className="w-5 h-5" />}
                        accent={accent}
                      />
                    </Link>
                  );
                })}
              </div>

              <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden mb-4">
                <div className="flex items-center justify-between px-5 py-4 border-b border-pq-neutral-200">
                  <div>
                    <h2 className="text-sm font-semibold text-pq-neutral-900">RFQ Inbox</h2>
                    <p className="text-xs text-pq-neutral-500 mt-0.5">Requests for quotation awaiting your response</p>
                  </div>
                  <Link href="/supplier/quotations" className="inline-flex items-center gap-1 text-xs text-pq-primary-600 hover:text-pq-neutral-900 font-medium transition">
                    View all <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <div className="px-5 py-6 text-center">
                  {stats.pending === 0 ? (
                    <p className="text-sm text-pq-neutral-400">
                      {stats.openRfqs === 0
                        ? 'No RFQs assigned yet. Check back later.'
                        : 'All assigned RFQs have been responded to.'}
                    </p>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-3xl font-bold text-pq-neutral-900">{stats.pending}</p>
                      <p className="text-sm text-pq-neutral-500">RFQ{stats.pending !== 1 ? 's' : ''} awaiting your quotation</p>
                      <Link href="/supplier/quotations" className="inline-flex items-center gap-1 mt-2 text-xs text-pq-primary-600 hover:text-pq-neutral-900 font-semibold transition">
                        Go to inbox <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  )}
                </div>
              </div>

              {cStats.rfqsPendingProductValidation > 0 && (
                <div className="flex items-center gap-2 text-xs text-pq-warning-600 bg-pq-warning-100 border border-pq-warning-100 rounded-md px-3 py-2">
                  <CircleAlert className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {cStats.rfqsPendingProductValidation} open RFQ
                    {cStats.rfqsPendingProductValidation !== 1 ? 's have' : ' has'} a raw-material line offered with an unverified product. Procurement may need a written justification before awarding—getting your product verified avoids the extra step.
                  </span>
                  <Link href="/supplier/quotations" className="ml-auto font-semibold underline shrink-0">
                    RFQs
                  </Link>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
