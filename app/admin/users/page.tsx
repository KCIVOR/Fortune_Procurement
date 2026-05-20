'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import PageHeader from '@/components/shared/PageHeader';
import PaginationControls from '@/components/shared/PaginationControls';
import FilterBar from '@/components/shared/FilterBar';
import type { FilterConfig } from '@/components/shared/FilterBar.types';
import UserTable from '@/components/admin/UserTable';
import CreateUserModal from '@/components/admin/CreateUserModal';
import { Button } from '@/components/ui/button';
import { listAdminUsersWithCount, getAdminUserStats, getAssignmentOptions } from '@/lib/admin-users';
import type { AdminUser, AdminUserFilters } from '@/lib/admin-users';
import { Plus } from 'lucide-react';

export default function UsersPage() {
  const { profile, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('all_roles');
  const [selectedDept, setSelectedDept] = useState('all_departments');
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [positions, setPositions] = useState<Array<{ id: string; title: string; role_id: string | null }>>([]);

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
  }, [authLoading, profile, currentPage, rowsPerPage, appliedSearch, selectedRole, selectedDept]);

  async function loadData() {
    try {
      setIsLoading(true);
      setError(null);

      const offset = (currentPage - 1) * rowsPerPage;
      const [userData, stats, options] = await Promise.all([
        listAdminUsersWithCount({ search: appliedSearch || undefined, role_id: selectedRole, department_id: selectedDept, limit: rowsPerPage, offset }),
        getAdminUserStats(),
        getAssignmentOptions(),
      ]);

      setUsers(userData.users);
      setTotalCount(userData.total_count);
      setRoles(stats.roles);
      setDepartments(stats.departments);
      setPositions(options.positions);
    } catch (err) {
      console.error('Error loading user data:', err);
      setError('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  }

  function handleApplyFilters() {
    setAppliedSearch(search);
    setCurrentPage(1);
  }

  function handleClearFilters() {
    setSearch('');
    setAppliedSearch('');
    setSelectedRole('all_roles');
    setSelectedDept('all_departments');
    setCurrentPage(1);
  }

  function handleNextPage() {
    const totalPages = Math.ceil(totalCount / rowsPerPage);
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  }

  function handlePreviousPage() {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  }

  if (authLoading) {
    return (
      <AppShell title="Users">
        <LoadingState message="Loading..." />
      </AppShell>
    );
  }

  if (error === 'Access denied. Admin role required.') {
    return (
      <AppShell title="Users">
        <div className="space-y-6">
          <PageHeader title="Users" description="View all system users and their details" />
          <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-lg p-6">
            <h3 className="font-semibold text-red-900 mb-2">Access Denied</h3>
            <p className="text-sm text-pq-danger-600">
              You do not have permission to view users. Only administrators can access this feature.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error && error !== 'Access denied. Admin role required.') {
    return (
      <AppShell title="Users">
        <div className="space-y-6">
          <PageHeader title="Users" description="View all system users and their details" />
          <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-lg p-6">
            <h3 className="font-semibold text-red-900 mb-2">Error</h3>
            <p className="text-sm text-pq-danger-600">{error}</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Users">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <PageHeader title="Users" description="View all system users and their details" />
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-xs font-medium"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create User
          </Button>
        </div>

        {/* Filter Panel */}
        <FilterBar
          filters={[
            {
              type: 'search',
              id: 'user-search',
              label: 'Search',
              placeholder: 'Search by name, email, or employee ID...',
              value: search,
              onChange: (value) => setSearch(value as string),
            },
            {
              type: 'select',
              id: 'role-filter',
              label: 'Role',
              placeholder: 'All roles',
              value: selectedRole,
              onChange: (value) => setSelectedRole(value as string),
              options: [
                { value: 'all_roles', label: 'All roles' },
                ...roles.map((role) => ({ value: role.id, label: role.name })),
              ],
            },
            {
              type: 'select',
              id: 'dept-filter',
              label: 'Department',
              placeholder: 'All departments',
              value: selectedDept,
              onChange: (value) => setSelectedDept(value as string),
              options: [
                { value: 'all_departments', label: 'All departments' },
                ...departments.map((dept) => ({ value: dept.id, label: dept.name })),
              ],
            },
          ] as FilterConfig[]}
          onApply={handleApplyFilters}
          onClear={handleClearFilters}
          loading={isLoading}
          resultCount={totalCount}
          resultLabel="user"
        />

        {/* User Table */}
        <UserTable users={users} isLoading={isLoading} />

        {/* Pagination Controls */}
        {users.length > 0 && (
          <PaginationControls
            currentPage={currentPage}
            totalPages={Math.ceil(totalCount / rowsPerPage)}
            pageSize={rowsPerPage}
            totalCount={totalCount}
            entityLabel="users"
            loading={isLoading}
            onPageChange={(page) => {
              if (page < currentPage) handlePreviousPage();
              else handleNextPage();
            }}
            className="space-y-4"
          />
        )}

        <CreateUserModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          roles={roles}
          departments={departments}
          positions={positions}
          onUserCreated={() => {
            setCurrentPage(1);
            loadData();
          }}
        />
      </div>
    </AppShell>
  );
}
