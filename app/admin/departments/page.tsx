'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import PageHeader from '@/components/shared/PageHeader';
import DepartmentTable from '@/components/admin/DepartmentTable';
import DepartmentForm from '@/components/admin/DepartmentForm';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import { getDepartmentsWithUserCountsAndTotal, createDepartment, updateDepartment, logDepartmentAudit, deactivateDepartment, reactivateDepartment } from '@/lib/admin-masterdata';
import DepartmentDeactivateDialog from '@/components/admin/DepartmentDeactivateDialog';
import DepartmentReactivateDialog from '@/components/admin/DepartmentReactivateDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import type { AdminDepartment } from '@/lib/admin-masterdata';
import PaginationControls from '@/components/shared/PaginationControls';

export default function DepartmentsPage() {
  const { profile, loading: authLoading } = useAuth();
  const [departments, setDepartments] = useState<AdminDepartment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<AdminDepartment | null>(null);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [reactivateDialogOpen, setReactivateDialogOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<AdminDepartment | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(20);
  const [totalCount, setTotalCount] = useState(0);

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

    loadDepartments();
  }, [authLoading, profile, currentPage, rowsPerPage]);

  async function loadDepartments() {
    try {
      setIsLoading(true);
      setError(null);
      const offset = (currentPage - 1) * rowsPerPage;
      const data = await getDepartmentsWithUserCountsAndTotal({ limit: rowsPerPage, offset });
      setDepartments(data.departments);
      setTotalCount(data.total_count);
    } catch (err) {
      console.error('Error loading departments:', err);
      setError('Failed to load departments');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateDepartment(data: { name: string; code: string }) {
    if (!profile?.id) return;

    try {
      setError(null);
      const result = await createDepartment(data.name, data.code);

      if (result.error) {
        setError(result.error);
        return;
      }

      await logDepartmentAudit('DEPARTMENT_CREATED', result.id, profile.id, {
        name: data.name,
        code: data.code,
        active: true,
      });

      setIsCreateDialogOpen(false);
      setEditingDepartment(null);
      setCurrentPage(1);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create department';
      setError(message);
    }
  }

  async function handleUpdateDepartment(data: { name: string; code: string }) {
    if (!editingDepartment || !profile?.id) return;

    try {
      setError(null);

      const changes: { name?: string; code?: string } = {};
      if (data.name !== editingDepartment.name) {
        changes.name = data.name;
      }
      if (data.code !== editingDepartment.code) {
        changes.code = data.code;
      }

      if (Object.keys(changes).length === 0) {
        setIsEditDialogOpen(false);
        setEditingDepartment(null);
        return;
      }

      const result = await updateDepartment(editingDepartment.id, changes);

      if (result.error) {
        setError(result.error);
        return;
      }

      await logDepartmentAudit('DEPARTMENT_UPDATED', editingDepartment.id, profile.id, {
        changed_fields: Object.keys(changes),
        old_name: editingDepartment.name,
        new_name: data.name,
        old_code: editingDepartment.code,
        new_code: data.code,
      });

      setIsEditDialogOpen(false);
      setEditingDepartment(null);
      setCurrentPage(1);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update department';
      setError(message);
    }
  }

  function handleEdit(dept: AdminDepartment) {
    setEditingDepartment(dept);
    setIsEditDialogOpen(true);
  }

  function handleCancelCreate() {
    setIsCreateDialogOpen(false);
    setError(null);
  }

  function handleCancelEdit() {
    setIsEditDialogOpen(false);
    setEditingDepartment(null);
    setError(null);
  }

  async function handleDeactivate(dept: AdminDepartment) {
    if (!profile?.id) return;

    try {
      setIsActionLoading(true);
      setError(null);
      const result = await deactivateDepartment(dept.id, profile.id, dept.user_count);

      if (!result.success) {
        setError(result.error || 'Failed to deactivate department');
        return;
      }

      setDeactivateDialogOpen(false);
      setSelectedDepartment(null);
      setCurrentPage(1);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to deactivate department';
      setError(message);
    } finally {
      setIsActionLoading(false);
    }
  }

  async function handleReactivate(dept: AdminDepartment) {
    if (!profile?.id) return;

    try {
      setIsActionLoading(true);
      setError(null);
      const result = await reactivateDepartment(dept.id, profile.id, dept.user_count);

      if (!result.success) {
        setError(result.error || 'Failed to reactivate department');
        return;
      }

      setReactivateDialogOpen(false);
      setSelectedDepartment(null);
      setCurrentPage(1);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reactivate department';
      setError(message);
    } finally {
      setIsActionLoading(false);
    }
  }

  function handleOpenDeactivateDialog(dept: AdminDepartment) {
    setSelectedDepartment(dept);
    setDeactivateDialogOpen(true);
  }

  function handleOpenReactivateDialog(dept: AdminDepartment) {
    setSelectedDepartment(dept);
    setReactivateDialogOpen(true);
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
      <AppShell title="Departments">
        <LoadingState message="Loading..." />
      </AppShell>
    );
  }

  if (error === 'Access denied. Admin role required.') {
    return (
      <AppShell title="Departments">
        <div className="space-y-6">
          <PageHeader title="Departments" description="Organization departments" />
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="font-semibold text-red-900 mb-2">Access Denied</h3>
            <p className="text-sm text-red-800">
              You do not have permission to view departments. Only administrators can access this feature.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error && error !== 'Access denied. Admin role required.') {
    return (
      <AppShell title="Departments">
        <div className="space-y-6">
          <PageHeader title="Departments" description="Organization departments" />
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="font-semibold text-red-900 mb-2">Error</h3>
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Departments">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <PageHeader title="Departments" description="Organization departments" />
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            size="sm"
            className="text-xs"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Department
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-xs text-red-800">{error}</p>
          </div>
        )}

        <Dialog open={isCreateDialogOpen} onOpenChange={(open) => !open && handleCancelCreate()}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Department</DialogTitle>
              <DialogClose />
            </DialogHeader>
            <DepartmentForm
              mode="create"
              onSubmit={handleCreateDepartment}
              onCancel={handleCancelCreate}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={isEditDialogOpen} onOpenChange={(open) => !open && handleCancelEdit()}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Department</DialogTitle>
              <DialogClose />
            </DialogHeader>
            {editingDepartment && (
              <DepartmentForm
                mode="edit"
                initialData={{
                  id: editingDepartment.id,
                  name: editingDepartment.name,
                  code: editingDepartment.code,
                }}
                onSubmit={handleUpdateDepartment}
                onCancel={handleCancelEdit}
              />
            )}
          </DialogContent>
        </Dialog>

        <DepartmentTable
          departments={departments}
          isLoading={isLoading}
          onEdit={handleEdit}
          onDeactivate={handleOpenDeactivateDialog}
          onReactivate={handleOpenReactivateDialog}
        />

        {/* Pagination Controls */}
        {departments.length > 0 && (
          <PaginationControls
            currentPage={currentPage}
            totalPages={Math.ceil(totalCount / rowsPerPage)}
            pageSize={rowsPerPage}
            totalCount={totalCount}
            entityLabel="departments"
            loading={isLoading}
            onPageChange={(page) => {
              if (page < currentPage) handlePreviousPage();
              else handleNextPage();
            }}
          />
        )}

        <DepartmentDeactivateDialog
          department={selectedDepartment}
          isOpen={deactivateDialogOpen}
          isLoading={isActionLoading}
          onConfirm={handleDeactivate}
          onCancel={() => {
            setDeactivateDialogOpen(false);
            setSelectedDepartment(null);
          }}
        />

        <DepartmentReactivateDialog
          department={selectedDepartment}
          isOpen={reactivateDialogOpen}
          isLoading={isActionLoading}
          onConfirm={handleReactivate}
          onCancel={() => {
            setReactivateDialogOpen(false);
            setSelectedDepartment(null);
          }}
        />
      </div>
    </AppShell>
  );
}
