'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import PageHeader from '@/components/shared/PageHeader';
import RoleTable from '@/components/admin/RoleTable';
import PaginationControls from '@/components/shared/PaginationControls';
import { getRolesWithUserCounts } from '@/lib/admin-masterdata';
import type { AdminRole } from '@/lib/admin-masterdata';

export default function RolesPage() {
  const { profile, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

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
          <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-lg p-6">
            <h3 className="font-semibold text-red-900 mb-2">Access Denied</h3>
            <p className="text-sm text-pq-danger-600">
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
          <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-lg p-6">
            <h3 className="font-semibold text-red-900 mb-2">Error</h3>
            <p className="text-sm text-pq-danger-600">{error}</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Roles">
      <div className="space-y-6">
        <PageHeader title="Roles" description="System roles and their information" />
        <RoleTable roles={roles.slice((currentPage - 1) * pageSize, currentPage * pageSize)} isLoading={isLoading} />
        {roles.length > 0 && (
          <PaginationControls
            currentPage={currentPage}
            totalPages={Math.ceil(roles.length / pageSize)}
            pageSize={pageSize}
            totalCount={roles.length}
            entityLabel="roles"
            loading={isLoading}
            onPageChange={(page) => {
              if (page < currentPage) setCurrentPage(p => Math.max(1, p - 1));
              else setCurrentPage(p => Math.min(Math.ceil(roles.length / pageSize), p + 1));
            }}
          />
        )}
      </div>
    </AppShell>
  );
}
