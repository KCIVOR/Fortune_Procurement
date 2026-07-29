'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import { DetailPageSkeleton } from '@/components/shared/structural-skeletons';

/** Legacy route — RFQ canvassing approvals live on PR2 Requests. */
export default function RfqApprovalsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/approvals/pr2');
  }, [router]);

  return (
    <AppShell title="PR2 Requests">
      <DetailPageSkeleton />
    </AppShell>
  );
}
