'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { UserProfile } from '@/types/auth';
import PageHeader from '@/components/shared/PageHeader';
import { fetchSupplierStats } from '@/lib/canvassing';
import { Tag, Clock, CircleCheck as CheckCircle2, FileText, ArrowRight } from 'lucide-react';

interface Props { profile: UserProfile; }

export default function SupplierDashboard({ profile }: Props) {
  const [stats, setStats] = useState({ openRfqs: 0, submitted: 0, pending: 0 });

  useEffect(() => {
    fetchSupplierStats(profile.id).then(setStats).catch(() => {});
  }, [profile.id]);

  const cards = [
    { label: 'Open RFQs',           value: stats.openRfqs,  icon: Tag,      href: '/supplier/quotations' },
    { label: 'Quotations Submitted', value: stats.submitted, icon: FileText, href: '/supplier/quotations' },
    { label: 'Pending Response',     value: stats.pending,   icon: Clock,    href: '/supplier/quotations' },
  ];

  return (
    <div>
      <PageHeader
        title="Supplier Portal"
        description={`Welcome, ${profile.full_name}. Respond to active RFQs here.`}
      />

      {/* RFQ Inbox — primary section */}
      <div className="bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden mb-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#D8E2FF]">
          <div>
            <h2 className="text-sm font-semibold text-[#0F1F3A]">RFQ Inbox</h2>
            <p className="text-xs text-[#40527A] mt-0.5">Requests for quotation awaiting your response</p>
          </div>
          <Link href="/supplier/quotations" className="inline-flex items-center gap-1 text-xs text-[#1E4BFF] hover:text-[#0F1F3A] font-medium transition">
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="px-5 py-6 text-center">
          {stats.pending === 0 ? (
            <p className="text-sm text-[#BFC7D5]">
              {stats.openRfqs === 0
                ? 'No RFQs assigned yet. Check back later.'
                : 'All assigned RFQs have been responded to.'}
            </p>
          ) : (
            <div className="space-y-1">
              <p className="text-3xl font-bold text-[#0F1F3A]">{stats.pending}</p>
              <p className="text-sm text-[#40527A]">RFQ{stats.pending !== 1 ? 's' : ''} awaiting your quotation</p>
              <Link href="/supplier/quotations" className="inline-flex items-center gap-1 mt-2 text-xs text-[#1E4BFF] hover:text-[#0F1F3A] font-semibold transition">
                Go to inbox <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Stats — secondary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {cards.map(card => {
          const Icon = card.icon;
          return (
            <Link key={card.label} href={card.href} className="bg-white rounded-[4px] border border-[#D8E2FF] p-3 flex items-center gap-3 transition hover:border-[#0F1F3A]">
              <div className="inline-flex items-center justify-center w-8 h-8 rounded-[4px] shrink-0 bg-[#F7F9FC] text-[#40527A]">
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold text-[#0F1F3A] leading-tight">{card.value}</p>
                <p className="text-xs text-[#40527A] leading-tight">{card.label}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
