'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import PageHeader from '@/components/shared/PageHeader';
import PaginationControls from '@/components/shared/PaginationControls';
import UserSearch from '@/components/admin/UserSearch';
import UserTable from '@/components/admin/UserTable';
import CreateUserModal from '@/components/admin/CreateUserModal';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
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
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="font-semibold text-red-900 mb-2">Access Denied</h3>
            <p className="text-sm text-red-800">
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
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="font-semibold text-red-900 mb-2">Error</h3>
            <p className="text-sm text-red-800">{error}</p>
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
            className="bg-[#1E4BFF] hover:bg-[#0F1F3A] text-white text-xs font-medium"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create User
          </Button>
        </div>

        {/* Filter Panel */}
        <div className="bg-white rounded-lg border border-[#E5EAFF] p-6 space-y-4">
          <h3 className="font-semibold text-[#0F1F3A] mb-4">Filters</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <UserSearch
                value={search}
                onChange={setSearch}
                onClear={() => setSearch('')}
                isLoading={isLoading}
              />
            </div>

            {/* Role Filter */}
            <div className="space-y-2">
              <Label htmlFor="role-filter" className="text-xs font-medium text-[#40527A]">
                Role
              </Label>
              <Select value={selectedRole} onValueChange={setSelectedRole} disabled={isLoading}>
                <SelectTrigger id="role-filter" className="text-sm">
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_roles">All roles</SelectItem>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Department Filter */}
            <div className="space-y-2">
              <Label htmlFor="dept-filter" className="text-xs font-medium text-[#40527A]">
                Department
              </Label>
              <Select value={selectedDept} onValueChange={setSelectedDept} disabled={isLoading}>
                <SelectTrigger id="dept-filter" className="text-sm">
                  <SelectValue placeholder="All departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_departments">All departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleApplyFilters}
              disabled={isLoading}
              className="bg-[#1E4BFF] hover:bg-[#0F1F3A] text-white text-xs font-medium"
            >
              Apply Filters
            </Button>
            <Button
              onClick={handleClearFilters}
              disabled={isLoading}
              variant="outline"
              className="text-xs font-medium"
            >
              Clear
            </Button>
          </div>
        </div>

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
