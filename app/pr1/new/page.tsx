'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import PR1Form from '@/components/pr1/PR1Form';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function PR1NewPage() {
  const { profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (profile && profile.role !== 'employee') {
      router.push('/dashboard');
    }
  }, [profile, router]);

  return (
    <AppShell title="New PR1">
      <div className="mb-2">
        <Link
          href="/pr1"
          className="inline-flex items-center gap-1 text-xs text-pq-neutral-500 hover:text-pq-neutral-500 transition"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Back to My Requests
        </Link>
      </div>
      <PageHeader
        title="New Purchase Request"
        description="Complete the form below and submit to start the procurement process."
      />
      <PR1Form />
    </AppShell>
  );
}
