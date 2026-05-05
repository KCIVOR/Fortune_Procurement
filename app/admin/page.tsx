'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import AdminDashboard from '@/components/dashboards/AdminDashboard';

export default function AdminPage() {
  const router = useRouter();
  const { profile, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;

    if (!profile || profile.role !== 'admin') {
      router.push('/dashboard');
    }
  }, [authLoading, profile, router]);

  if (authLoading) {
    return (
      <AppShell title="Admin">
        <LoadingState message="Loading..." />
      </AppShell>
    );
  }

  if (!profile || profile.role !== 'admin') {
    return (
      <AppShell title="Admin">
        <div className="space-y-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="font-semibold text-red-900 mb-2">Access Denied</h3>
            <p className="text-sm text-red-800">You do not have permission to access the admin panel.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Admin">
      <AdminDashboard profile={profile} />
    </AppShell>
  );
}
