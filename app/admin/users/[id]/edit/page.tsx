'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import EditUserAssignmentForm from '@/components/admin/EditUserAssignmentForm';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { getAdminUserById, getAssignmentOptions, getInactiveAssignments } from '@/lib/admin-users';
import type { AdminUser } from '@/lib/admin-users';

export default function EditUserPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params?.id as string;
  const { profile, loading: authLoading } = useAuth();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);
  const [positions, setPositions] = useState<Array<{ id: string; title: string; role_id: string | null }>>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [inactivePosition, setInactivePosition] = useState<{ id: string; title: string } | null>(null);
  const [inactiveDepartment, setInactiveDepartment] = useState<{ id: string; name: string } | null>(null);
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

    loadData();
  }, [authLoading, profile, userId]);

  async function loadData() {
    try {
      setIsLoading(true);
      setError(null);
      const [userData, options] = await Promise.all([
        getAdminUserById(userId),
        getAssignmentOptions(),
      ]);

      if (!userData) {
        setError('User not found');
      } else {
        setUser(userData);
        const inactiveAssignments = await getInactiveAssignments(userId);
        setInactivePosition(inactiveAssignments.inactivePosition);
        setInactiveDepartment(inactiveAssignments.inactiveDepartment);
      }
      setRoles(options.roles);
      setPositions(options.positions);
      setDepartments(options.departments);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load user or assignment options');
    } finally {
      setIsLoading(false);
    }
  }

  function handleSuccess(updatedUser: AdminUser) {
    router.push(`/admin/users/${updatedUser.id}`);
  }

  function handleCancel() {
    router.back();
  }

  if (authLoading) {
    return (
      <AppShell title="Edit User">
        <LoadingState message="Loading..." />
      </AppShell>
    );
  }

  if (error === 'Access denied. Admin role required.') {
    return (
      <AppShell title="Edit User">
        <div className="space-y-6">
          <Link href="/admin/users">
            <Button variant="outline" className="text-sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Users
            </Button>
          </Link>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="font-semibold text-red-900 mb-2">Access Denied</h3>
            <p className="text-sm text-red-800">
              You do not have permission to edit user assignments. Only administrators can access this feature.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (isLoading) {
    return (
      <AppShell title="Edit User">
        <LoadingState message="Loading user..." />
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell title="Edit User">
        <div className="space-y-6">
          <Link href="/admin/users">
            <Button variant="outline" className="text-sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Users
            </Button>
          </Link>
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
      <AppShell title="Edit User">
        <div className="space-y-6">
          <Link href="/admin/users">
            <Button variant="outline" className="text-sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Users
            </Button>
          </Link>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="font-semibold text-red-900 mb-2">Not Found</h3>
            <p className="text-sm text-red-800">This user could not be found.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Edit User">
      <div className="space-y-6">
        <Link href={`/admin/users/${user.id}`}>
          <Button variant="outline" className="text-sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to User
          </Button>
        </Link>

        <div className="bg-white rounded-lg border border-[#E5EAFF] p-6">
          <EditUserAssignmentForm
            user={user}
            roles={roles}
            positions={positions}
            departments={departments}
            inactivePosition={inactivePosition}
            inactiveDepartment={inactiveDepartment}
            adminId={profile?.id}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </div>
      </div>
    </AppShell>
  );
}
