import { supabase } from './supabase';
import type { Database } from '@/types/database';

export interface AdminRole {
  id: string;
  name: string;
  created_at: string;
  user_count?: number;
}

export interface AdminPosition {
  id: string;
  title: string;
  role_id: string | null;
  role_name: string | null;
  active: boolean;
  created_at: string;
  user_count?: number;
  workflow_usage_count?: number;
}

export interface AdminDepartment {
  id: string;
  name: string;
  code: string;
  active: boolean;
  created_at: string;
  user_count?: number;
}

export async function listRoles(): Promise<AdminRole[]> {
  const { data, error } = await supabase
    .from('roles')
    .select('id, name, created_at')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching roles:', error);
    return [];
  }

  return data || [];
}

export async function listPositions(): Promise<AdminPosition[]> {
  const { data, error } = await supabase
    .from('positions')
    .select('id, title, role_id, active, created_at, roles(name)')
    .order('title', { ascending: true });

  if (error) {
    console.error('Error fetching positions:', error);
    return [];
  }

  return (data || []).map((pos: any) => ({
    id: pos.id,
    title: pos.title,
    role_id: pos.role_id,
    role_name: pos.roles?.name || null,
    active: pos.active,
    created_at: pos.created_at,
  }));
}

export async function listDepartments(): Promise<AdminDepartment[]> {
  const { data, error } = await supabase
    .from('departments')
    .select('id, name, code, created_at')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching departments:', error);
    return [];
  }

  return data || [];
}

export async function getRolesWithUserCounts(): Promise<AdminRole[]> {
  const { data, error } = await supabase
    .from('roles')
    .select('id, name, created_at, profiles(id)')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching roles with user counts:', error);
    return [];
  }

  return (data || []).map((role: any) => ({
    id: role.id,
    name: role.name,
    created_at: role.created_at,
    user_count: (role.profiles || []).length,
  }));
}

export async function getDepartmentsWithUserCounts(): Promise<AdminDepartment[]> {
  const { data, error } = await supabase
    .from('departments')
    .select('id, name, code, active, created_at, profiles(id)')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching departments with user counts:', error);
    return [];
  }

  return (data || []).map((dept: any) => ({
    id: dept.id,
    name: dept.name,
    code: dept.code,
    active: dept.active,
    created_at: dept.created_at,
    user_count: (dept.profiles || []).length,
  }));
}

export async function getDepartmentsWithUserCountsAndTotal(filters: { limit?: number; offset?: number } = {}): Promise<{ departments: AdminDepartment[]; total_count: number }> {
  const { limit = 20, offset = 0 } = filters;

  const dataQuery = supabase
    .from('departments')
    .select('id, name, code, active, created_at, profiles(id)')
    .order('name', { ascending: true })
    .range(offset, offset + limit - 1);

  const countQuery = supabase
    .from('departments')
    .select('id');

  const [dataResult, countResult] = await Promise.all([dataQuery, countQuery]);

  if (dataResult.error) {
    console.error('Error fetching departments with user counts:', dataResult.error);
    return { departments: [], total_count: 0 };
  }

  const departments = (dataResult.data || []).map((dept: any) => ({
    id: dept.id,
    name: dept.name,
    code: dept.code,
    active: dept.active,
    created_at: dept.created_at,
    user_count: (dept.profiles || []).length,
  }));

  const totalCount = (countResult.data || []).length;

  return { departments, total_count: totalCount };
}

export async function createDepartment(name: string, code: string): Promise<{ id: string; error: string | null }> {
  const { data, error } = await (supabase as any)
    .from('departments')
    .insert([{ name, code, active: true }])
    .select('id');

  if (error) {
    console.error('Error creating department:', error);
    return { id: '', error: error.message };
  }

  if (!data || data.length === 0) {
    return { id: '', error: 'No department ID returned' };
  }

  return { id: data[0].id, error: null };
}

export async function updateDepartment(id: string, updates: { name?: string; code?: string }): Promise<{ success: boolean; error: string | null; oldData?: AdminDepartment }> {
  const { data: oldData, error: fetchError } = await (supabase as any)
    .from('departments')
    .select('id, name, code, created_at')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) {
    console.error('Error fetching department:', fetchError);
    return { success: false, error: fetchError.message };
  }

  if (!oldData) {
    return { success: false, error: 'Department not found' };
  }

  const { error: updateError } = await (supabase as any)
    .from('departments')
    .update(updates)
    .eq('id', id);

  if (updateError) {
    console.error('Error updating department:', updateError);
    return { success: false, error: updateError.message };
  }

  return { success: true, error: null, oldData: oldData as AdminDepartment };
}

export async function logDepartmentAudit(
  action: 'DEPARTMENT_CREATED' | 'DEPARTMENT_UPDATED' | 'DEPARTMENT_DEACTIVATED' | 'DEPARTMENT_REACTIVATED',
  departmentId: string,
  actorId: string | null,
  payload: any
): Promise<void> {
  const { error } = await (supabase as any)
    .from('audit_logs')
    .insert([
      {
        action,
        document_type: 'DEPARTMENT',
        document_id: departmentId,
        actor_id: actorId,
        payload,
      },
    ]);

  if (error) {
    console.error('Error logging department audit:', error);
  }
}

export async function deactivateDepartment(
  departmentId: string,
  adminId: string | null,
  userCount?: number
): Promise<{ success: boolean; error: string | null }> {
  const { data: currentData, error: fetchError } = await (supabase as any)
    .from('departments')
    .select('id, name, code, active')
    .eq('id', departmentId)
    .maybeSingle();

  if (fetchError) {
    console.error('Error fetching department:', fetchError);
    return { success: false, error: fetchError.message };
  }

  if (!currentData) {
    return { success: false, error: 'Department not found' };
  }

  if (!currentData.active) {
    return { success: true, error: null };
  }

  const { error: updateError } = await (supabase as any)
    .from('departments')
    .update({ active: false })
    .eq('id', departmentId);

  if (updateError) {
    console.error('Error deactivating department:', updateError);
    return { success: false, error: updateError.message };
  }

  if (adminId) {
    await logDepartmentAudit('DEPARTMENT_DEACTIVATED', departmentId, adminId, {
      name: currentData.name,
      code: currentData.code,
      old_active: true,
      new_active: false,
      user_count: userCount,
    });
  }

  return { success: true, error: null };
}

export async function reactivateDepartment(
  departmentId: string,
  adminId: string | null,
  userCount?: number
): Promise<{ success: boolean; error: string | null }> {
  const { data: currentData, error: fetchError } = await (supabase as any)
    .from('departments')
    .select('id, name, code, active')
    .eq('id', departmentId)
    .maybeSingle();

  if (fetchError) {
    console.error('Error fetching department:', fetchError);
    return { success: false, error: fetchError.message };
  }

  if (!currentData) {
    return { success: false, error: 'Department not found' };
  }

  if (currentData.active) {
    return { success: true, error: null };
  }

  const { error: updateError } = await (supabase as any)
    .from('departments')
    .update({ active: true })
    .eq('id', departmentId);

  if (updateError) {
    console.error('Error reactivating department:', updateError);
    return { success: false, error: updateError.message };
  }

  if (adminId) {
    await logDepartmentAudit('DEPARTMENT_REACTIVATED', departmentId, adminId, {
      name: currentData.name,
      code: currentData.code,
      old_active: false,
      new_active: true,
      user_count: userCount,
    });
  }

  return { success: true, error: null };
}

export async function createPosition(
  title: string,
  role_id: string
): Promise<{ id: string; error: string | null }> {
  const { data, error } = await (supabase as any)
    .from('positions')
    .insert([{ title, role_id, active: true }])
    .select('id');

  if (error) {
    console.error('Error creating position:', error);
    return { id: '', error: error.message };
  }

  if (!data || data.length === 0) {
    return { id: '', error: 'No position ID returned' };
  }

  return { id: data[0].id, error: null };
}

export async function updatePosition(
  id: string,
  updates: { title?: string; role_id?: string }
): Promise<{ success: boolean; error: string | null; oldData?: AdminPosition }> {
  const { data: oldData, error: fetchError } = await (supabase as any)
    .from('positions')
    .select('id, title, role_id, active, created_at, roles(name)')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) {
    console.error('Error fetching position:', fetchError);
    return { success: false, error: fetchError.message };
  }

  if (!oldData) {
    return { success: false, error: 'Position not found' };
  }

  const { error: updateError } = await (supabase as any)
    .from('positions')
    .update(updates)
    .eq('id', id);

  if (updateError) {
    console.error('Error updating position:', updateError);
    return { success: false, error: updateError.message };
  }

  const mapped: AdminPosition = {
    id: oldData.id,
    title: oldData.title,
    role_id: oldData.role_id,
    role_name: oldData.roles?.name || null,
    active: oldData.active,
    created_at: oldData.created_at,
  };

  return { success: true, error: null, oldData: mapped };
}

export async function checkPositionUsedInWorkflows(
  positionTitle: string
): Promise<boolean> {
  const { data, error } = await (supabase as any)
    .from('approval_steps')
    .select('id')
    .eq('position_required', positionTitle)
    .maybeSingle();

  if (error) {
    console.error('Error checking position usage:', error);
    return false;
  }

  return !!data;
}

export async function getWorkflowUsageCount(
  positionTitle: string
): Promise<number> {
  const { data, error } = await (supabase as any)
    .from('approval_steps')
    .select('id', { count: 'exact', head: false })
    .eq('position_required', positionTitle);

  if (error) {
    console.error('Error counting workflow usage:', error);
    return 0;
  }

  return (data || []).length;
}

export async function getPositionUserCount(
  positionId: string
): Promise<number> {
  const { data, error } = await (supabase as any)
    .from('profiles')
    .select('id', { count: 'exact', head: false })
    .eq('position_id', positionId);

  if (error) {
    console.error('Error counting position users:', error);
    return 0;
  }

  return (data || []).length;
}

export async function logPositionAudit(
  action: 'POSITION_CREATED' | 'POSITION_UPDATED' | 'POSITION_DEACTIVATED' | 'POSITION_REACTIVATED',
  positionId: string,
  actorId: string | null,
  payload: any
): Promise<void> {
  const { error } = await (supabase as any)
    .from('audit_logs')
    .insert([
      {
        action,
        document_type: 'POSITION',
        document_id: positionId,
        actor_id: actorId,
        payload,
      },
    ]);

  if (error) {
    console.error('Error logging position audit:', error);
  }
}

export async function deactivatePosition(
  positionId: string,
  adminId: string | null,
  userCount?: number,
  workflowUsageCount?: number
): Promise<{ success: boolean; error: string | null }> {
  const { data: currentData, error: fetchError } = await (supabase as any)
    .from('positions')
    .select('id, title, role_id, active, roles(name)')
    .eq('id', positionId)
    .maybeSingle();

  if (fetchError) {
    console.error('Error fetching position:', fetchError);
    return { success: false, error: fetchError.message };
  }

  if (!currentData) {
    return { success: false, error: 'Position not found' };
  }

  if (!currentData.active) {
    return { success: true, error: null };
  }

  const { error: updateError } = await (supabase as any)
    .from('positions')
    .update({ active: false })
    .eq('id', positionId);

  if (updateError) {
    console.error('Error deactivating position:', updateError);
    return { success: false, error: updateError.message };
  }

  if (adminId) {
    await logPositionAudit('POSITION_DEACTIVATED', positionId, adminId, {
      title: currentData.title,
      role_id: currentData.role_id,
      old_active: true,
      new_active: false,
      user_count: userCount,
      workflow_usage_count: workflowUsageCount,
    });
  }

  return { success: true, error: null };
}

export async function reactivatePosition(
  positionId: string,
  adminId: string | null,
  userCount?: number,
  workflowUsageCount?: number
): Promise<{ success: boolean; error: string | null }> {
  const { data: currentData, error: fetchError } = await (supabase as any)
    .from('positions')
    .select('id, title, role_id, active, roles(name)')
    .eq('id', positionId)
    .maybeSingle();

  if (fetchError) {
    console.error('Error fetching position:', fetchError);
    return { success: false, error: fetchError.message };
  }

  if (!currentData) {
    return { success: false, error: 'Position not found' };
  }

  if (currentData.active) {
    return { success: true, error: null };
  }

  const { error: updateError } = await (supabase as any)
    .from('positions')
    .update({ active: true })
    .eq('id', positionId);

  if (updateError) {
    console.error('Error reactivating position:', updateError);
    return { success: false, error: updateError.message };
  }

  if (adminId) {
    await logPositionAudit('POSITION_REACTIVATED', positionId, adminId, {
      title: currentData.title,
      role_id: currentData.role_id,
      old_active: false,
      new_active: true,
      user_count: userCount,
      workflow_usage_count: workflowUsageCount,
    });
  }

  return { success: true, error: null };
}
