'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { updateUserAssignment } from '@/lib/admin-users';
import type { AdminUser } from '@/lib/admin-users';

interface EditUserAssignmentFormProps {
  user: AdminUser;
  roles: Array<{ id: string; name: string }>;
  positions: Array<{ id: string; title: string; role_id: string | null }>;
  departments: Array<{ id: string; name: string }>;
  inactivePosition?: { id: string; title: string } | null;
  inactiveDepartment?: { id: string; name: string } | null;
  adminId?: string;
  onSuccess?: (updatedUser: AdminUser) => void;
  onCancel?: () => void;
}

export default function EditUserAssignmentForm({
  user,
  roles,
  positions,
  departments,
  inactivePosition,
  inactiveDepartment,
  adminId,
  onSuccess,
  onCancel,
}: EditUserAssignmentFormProps) {
  const [selectedRole, setSelectedRole] = useState<string>(user.role_id || 'none');
  const [selectedPosition, setSelectedPosition] = useState<string>(user.position_id || 'none');
  const [selectedDept, setSelectedDept] = useState<string>(user.department_id || 'none');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const hasChanges =
    (selectedRole === 'none' ? null : selectedRole) !== user.role_id ||
    (selectedPosition === 'none' ? null : selectedPosition) !== user.position_id ||
    (selectedDept === 'none' ? null : selectedDept) !== user.department_id;

  async function handleSave() {
    try {
      setIsSaving(true);
      setError(null);
      setSuccess(false);

      const updates = {
        role_id: selectedRole === 'none' ? null : selectedRole,
        position_id: selectedPosition === 'none' ? null : selectedPosition,
        department_id: selectedDept === 'none' ? null : selectedDept,
      };

      const result = await updateUserAssignment(user.id, updates, adminId);

      if (!result.success) {
        setError(result.error || 'Failed to update user assignment');
        return;
      }

      setSuccess(true);
      if (result.user && onSuccess) {
        setTimeout(() => onSuccess(result.user!), 1500);
      }
    } catch (err) {
      console.error('Error saving:', err);
      setError('An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  }

  if (success) {
    return (
      <div className="bg-pq-success-100 border border-pq-success-100 rounded-lg p-6">
        <h3 className="font-semibold text-pq-success-600 mb-2">Success</h3>
        <p className="text-sm text-pq-success-600">User assignment updated successfully. Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-pq-neutral-900">Edit Assignment</h3>
        <p className="text-sm text-pq-neutral-500 mt-1">{user.full_name}</p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-lg p-4">
          <p className="text-sm text-pq-danger-600">{error}</p>
        </div>
      )}

      {/* Inactive Assignment Warning */}
      {(inactivePosition || inactiveDepartment) && (
        <div className="bg-pq-warning-100 border border-pq-warning-100 rounded-lg p-4">
          <p className="text-xs font-semibold text-pq-warning-600 mb-2">Inactive Assignment</p>
          <p className="text-xs text-pq-warning-600">
            This user is assigned to an inactive {inactivePosition ? 'position' : ''}{inactivePosition && inactiveDepartment ? ' and ' : ''}{inactiveDepartment ? 'department' : ''}. Choose an active replacement if needed.
          </p>
        </div>
      )}

      {/* Form Fields */}
      <div className="space-y-4">
        {/* Role */}
        <div className="space-y-2">
          <Label htmlFor="role" className="text-xs font-medium text-pq-neutral-500">
            Role
          </Label>
          <Select value={selectedRole} onValueChange={setSelectedRole} disabled={isSaving}>
            <SelectTrigger id="role" className="text-sm">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Position */}
        <div className="space-y-2">
          <Label htmlFor="position" className="text-xs font-medium text-pq-neutral-500">
            Position
          </Label>
          <Select value={selectedPosition} onValueChange={setSelectedPosition} disabled={isSaving}>
            <SelectTrigger id="position" className="text-sm">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {inactivePosition && selectedPosition === inactivePosition.id && (
                <SelectItem value={inactivePosition.id} disabled>
                  {inactivePosition.title} (Inactive — current assignment)
                </SelectItem>
              )}
              {positions.map((pos) => (
                <SelectItem key={pos.id} value={pos.id}>
                  {pos.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-pq-neutral-400 mt-1">
            Note: Active positions shown. Verify role compatibility when assigning.
          </p>
        </div>

        {/* Department */}
        <div className="space-y-2">
          <Label htmlFor="dept" className="text-xs font-medium text-pq-neutral-500">
            Department
          </Label>
          <Select value={selectedDept} onValueChange={setSelectedDept} disabled={isSaving}>
            <SelectTrigger id="dept" className="text-sm">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {inactiveDepartment && selectedDept === inactiveDepartment.id && (
                <SelectItem value={inactiveDepartment.id} disabled>
                  {inactiveDepartment.name} (Inactive — current assignment)
                </SelectItem>
              )}
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Current Values */}
      <div className="bg-pq-primary-50 border border-pq-primary-200 rounded-lg p-4">
        <h4 className="text-xs font-semibold text-pq-primary-900 mb-2">Current Assignment</h4>
        <div className="space-y-1 text-xs text-pq-primary-600">
          <p>Role: {user.role_name || '—'}</p>
          <p>Position: {user.position_title || '—'}</p>
          <p>Department: {user.department_name || '—'}</p>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
          className="bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-xs font-medium"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
        <Button
          onClick={onCancel}
          disabled={isSaving}
          variant="outline"
          className="text-xs font-medium"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
