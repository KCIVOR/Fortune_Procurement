'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import PR1Form from '@/components/pr1/PR1Form';
import { fetchPR1ById } from '@/lib/pr1';
import { useAuth } from '@/context/AuthContext';
import type { PR1WithItems } from '@/types/pr1';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export default function PR1EditPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const router = useRouter();
  const [pr1, setPR1] = useState<PR1WithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    fetchPR1ById(id)
      .then((data) => {
        if (!data) { setError('PR1 not found.'); return; }
        if (data.status !== 'draft') { setError('Only draft PR1s can be edited.'); return; }
        setPR1(data);
      })
      .catch(() => setError('Failed to load PR1.'))
      .finally(() => setLoading(false));
  }, [id]);

  // Guard: only owner can edit
  useEffect(() => {
    if (pr1 && profile && pr1.requisitioner_id !== profile.id) {
      router.replace(`/pr1/${id}`);
    }
  }, [pr1, profile, id, router]);

  if (loading) {
    return (
      <AppShell title="Edit PR1">
        <div className="flex items-center justify-center h-64">
          <LoadingState message="Loading..." />
        </div>
      </AppShell>
    );
  }

  if (error || !pr1) {
    return (
      <AppShell title="Edit PR1">
        <div className="bg-red-50 border border-red-200 rounded-[4px] p-4 text-sm text-red-700">
          {error || 'PR1 not found.'}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Edit PR1">
      <div className="mb-2">
        <Link
          href={`/pr1/${id}`}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Back to PR1 {pr1.pr1_number}
        </Link>
      </div>
      <PageHeader
        title={`Edit PR1 — ${pr1.pr1_number}`}
        description="Update your draft and save or submit when ready."
      />
      <PR1Form existing={pr1} />
    </AppShell>
  );
}
