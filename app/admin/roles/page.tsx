'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import PageHeader from '@/components/shared/PageHeader';
import RoleTable from '@/components/admin/RoleTable';
import { getRolesWithUserCounts } from '@/lib/admin-masterdata';
import type { AdminRole } from '@/lib/admin-masterdata';

export default function RolesPage() {
  const { profile, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!profile) {
      setError('Not authenticated');
      setIsLoading(false);
      return;
    }

    if (profile.role !== 'admin') {
      setError('Access denied. Admin role required.');
      setIsLoading(false);
      return;
    }

    loadRoles();
  }, [authLoading, profile]);

  async function loadRoles() {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getRolesWithUserCounts();
      setRoles(data);
    } catch (err) {
      console.error('Error loading roles:', err);
      setError('Failed to load roles');
    } finally {
      setIsLoading(false);
    }
  }

  if (authLoading) {
    return (
      <AppShell title="Roles">
        <LoadingState message="Loading..." />
      </AppShell>
    );
  }

  if (error === 'Access denied. Admin role required.') {
    return (
      <AppShell title="Roles">
        <div className="space-y-6">
          <PageHeader title="Roles" description="System roles and their information" />
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="font-semibold text-red-900 mb-2">Access Denied</h3>
            <p className="text-sm text-red-800">
              You do not have permission to view roles. Only administrators can access this feature.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error && error !== 'Access denied. Admin role required.') {
    return (
      <AppShell title="Roles">
        <div className="space-y-6">
          <PageHeader title="Roles" description="System roles and their information" />
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="font-semibold text-red-900 mb-2">Error</h3>
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Roles">
      <div className="space-y-6">
        <PageHeader title="Roles" description="System roles and their information" />
        <RoleTable roles={roles} isLoading={isLoading} />
        {roles.length > 0 && <div className="text-xs text-[#40527A]">Total: {roles.length} roles</div>}
      </div>
    </AppShell>
  );
}
