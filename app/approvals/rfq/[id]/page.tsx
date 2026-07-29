'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import { DetailPageSkeleton } from '@/components/shared/structural-skeletons';
import { fetchRfqApprovalDetail, getRfqApprovalPr2Url } from '@/lib/rfq-approvals';

/** Legacy route — redirects to unified PR2 page with canvassing + RFQ approval. */
export default function RfqApprovalRedirectPage() {
  const { id: instanceId } = useParams<{ id: string }>();
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!instanceId) return;
    fetchRfqApprovalDetail(instanceId)
      .then((detail) => {
        if (!detail?.pr2_id) {
          setError('Linked PR2 not found for this RFQ approval.');
          return;
        }
        router.replace(getRfqApprovalPr2Url(detail.pr2_id, instanceId));
      })
      .catch(() => setError('Failed to load approval record.'));
  }, [instanceId, router]);

  if (error) {
    return (
      <AppShell title="RFQ Approval">
        <p className="text-sm text-pq-danger-600">{error}</p>
      </AppShell>
    );
  }

  return (
    <AppShell title="RFQ Approval">
      <DetailPageSkeleton />
    </AppShell>
  );
}
