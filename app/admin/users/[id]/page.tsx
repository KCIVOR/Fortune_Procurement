'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import UserDetail from '@/components/admin/UserDetail';
import { getAdminUserById } from '@/lib/admin-users';
import type { AdminUser } from '@/lib/admin-users';

export default function UserDetailPage() {
  const params = useParams();
  const userId = params?.id as string;
  const { profile, loading: authLoading } = useAuth();
  const [user, setUser] = useState<AdminUser | null>(null);
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

    loadUser();
  }, [authLoading, profile, userId]);

  async function loadUser() {
    try {
      setIsLoading(true);
      setError(null);
      const userData = await getAdminUserById(userId);

      if (!userData) {
        setError('User not found');
      } else {
        setUser(userData);
      }
    } catch (err) {
      console.error('Error loading user:', err);
      setError('Failed to load user');
    } finally {
      setIsLoading(false);
    }
  }

  if (authLoading) {
    return (
      <AppShell title="User Detail">
        <LoadingState message="Loading..." />
      </AppShell>
    );
  }

  if (error === 'Access denied. Admin role required.') {
    return (
      <AppShell title="User Detail">
        <div className="space-y-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="font-semibold text-red-900 mb-2">Access Denied</h3>
            <p className="text-sm text-red-800">
              You do not have permission to view this user. Only administrators can access this feature.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (isLoading) {
    return (
      <AppShell title="User Detail">
        <LoadingState message="Loading user..." />
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell title="User Detail">
        <div className="space-y-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="font-semibold text-red-900 mb-2">Error</h3>
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell title="User Detail">
        <div className="space-y-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="font-semibold text-red-900 mb-2">Not Found</h3>
            <p className="text-sm text-red-800">This user could not be found.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="User Detail">
      <UserDetail user={user} isAdmin={profile?.role === 'admin'} />
    </AppShell>
  );
}
