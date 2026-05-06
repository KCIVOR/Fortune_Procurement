'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import PageHeader from '@/components/shared/PageHeader';
import PositionTable from '@/components/admin/PositionTable';
import PositionForm from '@/components/admin/PositionForm';
import PaginationControls from '@/components/shared/PaginationControls';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import {
  listPositions,
  listRoles,
  createPosition,
  updatePosition,
  logPositionAudit,
  checkPositionUsedInWorkflows,
  deactivatePosition,
  reactivatePosition,
  getPositionUserCount,
  getWorkflowUsageCount,
} from '@/lib/admin-masterdata';
import PositionDeactivateDialog from '@/components/admin/PositionDeactivateDialog';
import PositionReactivateDialog from '@/components/admin/PositionReactivateDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import type { AdminPosition } from '@/lib/admin-masterdata';

export default function PositionsPage() {
  const { profile, loading: authLoading } = useAuth();
  const [positions, setPositions] = useState<AdminPosition[]>([]);
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<AdminPosition | null>(null);
  const [workflowWarning, setWorkflowWarning] = useState(false);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [reactivateDialogOpen, setReactivateDialogOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<AdminPosition | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
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

    loadData();
  }, [authLoading, profile]);

  async function loadData() {
    try {
      setIsLoading(true);
      setError(null);
      const [posData, roleData] = await Promise.all([listPositions(), listRoles()]);
      setPositions(posData);
      setRoles(roleData);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load positions');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreatePosition(data: { title: string; role_id: string }) {
    if (!profile?.id) return;

    try {
      setError(null);
      const result = await createPosition(data.title, data.role_id);

      if (result.error) {
        setError(result.error);
        return;
      }

      await logPositionAudit('POSITION_CREATED', result.id, profile.id, {
        title: data.title,
        role_id: data.role_id,
        active: true,
      });

      setIsCreateDialogOpen(false);
      setEditingPosition(null);
      setWorkflowWarning(false);
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create position';
      setError(message);
    }
  }

  async function handleUpdatePosition(data: { title: string; role_id: string }) {
    if (!editingPosition || !profile?.id) return;

    try {
      setError(null);

      const changes: { title?: string; role_id?: string } = {};
      if (data.title !== editingPosition.title) {
        changes.title = data.title;
      }
      if (data.role_id !== editingPosition.role_id) {
        changes.role_id = data.role_id;
      }

      if (Object.keys(changes).length === 0) {
        setIsEditDialogOpen(false);
        setEditingPosition(null);
        setWorkflowWarning(false);
        return;
      }

      const result = await updatePosition(editingPosition.id, changes);

      if (result.error) {
        setError(result.error);
        return;
      }

      await logPositionAudit('POSITION_UPDATED', editingPosition.id, profile.id, {
        changed_fields: Object.keys(changes),
        old_title: editingPosition.title,
        new_title: data.title,
        old_role_id: editingPosition.role_id,
        new_role_id: data.role_id,
      });

      setIsEditDialogOpen(false);
      setEditingPosition(null);
      setWorkflowWarning(false);
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update position';
      setError(message);
    }
  }

  async function handleEdit(pos: AdminPosition) {
    const usedInWorkflows = await checkPositionUsedInWorkflows(pos.title);
    setWorkflowWarning(usedInWorkflows);
    setEditingPosition(pos);
    setIsEditDialogOpen(true);
  }

  function handleCancelCreate() {
    setIsCreateDialogOpen(false);
    setError(null);
  }

  function handleCancelEdit() {
    setIsEditDialogOpen(false);
    setEditingPosition(null);
    setWorkflowWarning(false);
    setError(null);
  }

  async function handleDeactivate(pos: AdminPosition) {
    if (!profile?.id) return;

    try {
      setIsActionLoading(true);
      setError(null);

      const [userCount, workflowUsageCount] = await Promise.all([
        getPositionUserCount(pos.id),
        getWorkflowUsageCount(pos.title),
      ]);

      const result = await deactivatePosition(pos.id, profile.id, userCount, workflowUsageCount);

      if (!result.success) {
        setError(result.error || 'Failed to deactivate position');
        return;
      }

      setDeactivateDialogOpen(false);
      setSelectedPosition(null);
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to deactivate position';
      setError(message);
    } finally {
      setIsActionLoading(false);
    }
  }

  async function handleReactivate(pos: AdminPosition) {
    if (!profile?.id) return;

    try {
      setIsActionLoading(true);
      setError(null);

      const userCount = await getPositionUserCount(pos.id);
      const result = await reactivatePosition(pos.id, profile.id, userCount);

      if (!result.success) {
        setError(result.error || 'Failed to reactivate position');
        return;
      }

      setReactivateDialogOpen(false);
      setSelectedPosition(null);
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reactivate position';
      setError(message);
    } finally {
      setIsActionLoading(false);
    }
  }

  async function handleOpenDeactivateDialog(pos: AdminPosition) {
    try {
      const [userCount, workflowUsageCount] = await Promise.all([
        getPositionUserCount(pos.id),
        getWorkflowUsageCount(pos.title),
      ]);
      const posWithCounts = { ...pos, user_count: userCount, workflow_usage_count: workflowUsageCount };
      setSelectedPosition(posWithCounts);
      setDeactivateDialogOpen(true);
    } catch (err) {
      console.error('Error loading position details:', err);
      setError('Failed to load position details');
    }
  }

  function handleOpenReactivateDialog(pos: AdminPosition) {
    setSelectedPosition(pos);
    setReactivateDialogOpen(true);
  }

  if (authLoading) {
    return (
      <AppShell title="Positions">
        <LoadingState message="Loading..." />
      </AppShell>
    );
  }

  if (error === 'Access denied. Admin role required.') {
    return (
      <AppShell title="Positions">
        <div className="space-y-6">
          <PageHeader title="Positions" description="Job positions and their roles" />
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="font-semibold text-red-900 mb-2">Access Denied</h3>
            <p className="text-sm text-red-800">
              You do not have permission to view positions. Only administrators can access this feature.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error && error !== 'Access denied. Admin role required.') {
    return (
      <AppShell title="Positions">
        <div className="space-y-6">
          <PageHeader title="Positions" description="Job positions and their roles" />
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="font-semibold text-red-900 mb-2">Error</h3>
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Positions">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <PageHeader title="Positions" description="Job positions and their roles" />
          <Button onClick={() => setIsCreateDialogOpen(true)} size="sm" className="text-xs">
            <Plus className="w-4 h-4 mr-2" />
            Add Position
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
              <DialogTitle>Create New Position</DialogTitle>
              <DialogClose />
            </DialogHeader>
            <PositionForm
              mode="create"
              roles={roles}
              workflowWarning={workflowWarning}
              onSubmit={handleCreatePosition}
              onCancel={handleCancelCreate}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={isEditDialogOpen} onOpenChange={(open) => !open && handleCancelEdit()}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Position</DialogTitle>
              <DialogClose />
            </DialogHeader>
            {editingPosition && (
              <PositionForm
                mode="edit"
                roles={roles}
                initialData={
                  editingPosition.role_id
                    ? {
                        id: editingPosition.id,
                        title: editingPosition.title,
                        role_id: editingPosition.role_id,
                      }
                    : undefined
                }
                workflowWarning={workflowWarning}
                onSubmit={handleUpdatePosition}
                onCancel={handleCancelEdit}
              />
            )}
          </DialogContent>
        </Dialog>

        <PositionTable
          positions={positions.slice((currentPage - 1) * pageSize, currentPage * pageSize)}
          isLoading={isLoading}
          onEdit={handleEdit}
          onDeactivate={handleOpenDeactivateDialog}
          onReactivate={handleOpenReactivateDialog}
        />
        {positions.length > 0 && (
          <PaginationControls
            currentPage={currentPage}
            totalPages={Math.ceil(positions.length / pageSize)}
            pageSize={pageSize}
            totalCount={positions.length}
            entityLabel="positions"
            loading={isLoading}
            onPageChange={(page) => {
              if (page < currentPage) setCurrentPage(p => Math.max(1, p - 1));
              else setCurrentPage(p => Math.min(Math.ceil(positions.length / pageSize), p + 1));
            }}
          />
        )}

        <PositionDeactivateDialog
          position={selectedPosition}
          isOpen={deactivateDialogOpen}
          isLoading={isActionLoading}
          onConfirm={handleDeactivate}
          onCancel={() => {
            setDeactivateDialogOpen(false);
            setSelectedPosition(null);
          }}
        />

        <PositionReactivateDialog
          position={selectedPosition}
          isOpen={reactivateDialogOpen}
          isLoading={isActionLoading}
          onConfirm={handleReactivate}
          onCancel={() => {
            setReactivateDialogOpen(false);
            setSelectedPosition(null);
          }}
        />
      </div>
    </AppShell>
  );
}
