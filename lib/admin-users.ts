import { supabase } from './supabase';
import type { UserAssignmentUpdate } from '@/types/admin';

export interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  role_id: string | null;
  role_name: string | null;
  position_id: string | null;
  position_title: string | null;
  department_id: string | null;
  department_name: string | null;
  created_at: string;
}

export interface AdminUserFilters {
  search?: string;
  role_id?: string;
  department_id?: string;
  limit?: number;
  offset?: number;
}

export async function listAdminUsers(filters: AdminUserFilters = {}): Promise<AdminUser[]> {
  const { limit = 50, offset = 0, search, role_id, department_id } = filters;

  let query = supabase
    .from('profiles')
    .select(
      `id, full_name, email, role_id, position_id, department_id, created_at,
       roles(name), positions(title), departments(name)`
    )
    .order('full_name', { ascending: true })
    .range(offset, offset + limit - 1);

  if (search && search.trim()) {
    const searchTerm = `%${search}%`;
    query = query.or(`full_name.ilike.${searchTerm},email.ilike.${searchTerm}`);
  }

  if (role_id && role_id !== 'all_roles') {
    query = query.eq('role_id', role_id);
  }

  if (department_id && department_id !== 'all_departments') {
    query = query.eq('department_id', department_id);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching admin users:', error);
    return [];
  }

  return (data || []).map((user: any) => ({
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    role_id: user.role_id,
    role_name: user.roles?.name || null,
    position_id: user.position_id,
    position_title: user.positions?.title || null,
    department_id: user.department_id,
    department_name: user.departments?.name || null,
    created_at: user.created_at,
  }));
}

export async function listAdminUsersWithCount(filters: AdminUserFilters = {}): Promise<{ users: AdminUser[]; total_count: number }> {
  const { limit = 20, offset = 0, search, role_id, department_id } = filters;

  const buildBaseQuery = () => {
    let query = supabase
      .from('profiles')
      .select(
        `id, full_name, email, role_id, position_id, department_id, created_at,
         roles(name), positions(title), departments(name)`
      )
      .order('full_name', { ascending: true });

    if (search && search.trim()) {
      const searchTerm = `%${search}%`;
      query = query.or(`full_name.ilike.${searchTerm},email.ilike.${searchTerm}`);
    }

    if (role_id && role_id !== 'all_roles') {
      query = query.eq('role_id', role_id);
    }

    if (department_id && department_id !== 'all_departments') {
      query = query.eq('department_id', department_id);
    }

    return query;
  };

  const usersQuery = buildBaseQuery().range(offset, offset + limit - 1);
  const countQuery = buildBaseQuery().select('id');

  const [usersResult, countResult] = await Promise.all([usersQuery, countQuery]);

  if (usersResult.error) {
    console.error('Error fetching admin users:', usersResult.error);
    return { users: [], total_count: 0 };
  }

  const users = (usersResult.data || []).map((user: any) => ({
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    role_id: user.role_id,
    role_name: user.roles?.name || null,
    position_id: user.position_id,
    position_title: user.positions?.title || null,
    department_id: user.department_id,
    department_name: user.departments?.name || null,
    created_at: user.created_at,
  }));

  const totalCount = (countResult.data || []).length;

  return { users, total_count: totalCount };
}

export async function getAdminUserById(id: string): Promise<AdminUser | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      `id, full_name, email, role_id, position_id, department_id, created_at,
       roles(name), positions(title), departments(name)`
    )
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching admin user:', error);
    return null;
  }

  if (!data) return null;

  const user = data as any;
  return {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    role_id: user.role_id,
    role_name: user.roles?.name || null,
    position_id: user.position_id,
    position_title: user.positions?.title || null,
    department_id: user.department_id,
    department_name: user.departments?.name || null,
    created_at: user.created_at,
  };
}

export async function getAdminUserStats(): Promise<{
  total_count: number;
  roles: Array<{ id: string; name: string }>;
  departments: Array<{ id: string; name: string }>;
}> {
  const { data: rolesData } = await supabase.from('roles').select('id, name').order('name');
  const { data: depsData } = await supabase.from('departments').select('id, name').order('name');
  const { data: profilesData } = await supabase.from('profiles').select('id');

  return {
    total_count: (profilesData || []).length,
    roles: (rolesData || []) as Array<{ id: string; name: string }>,
    departments: (depsData || []) as Array<{ id: string; name: string }>,
  };
}

export async function getAssignmentOptions(): Promise<{
  roles: Array<{ id: string; name: string }>;
  positions: Array<{ id: string; title: string; role_id: string | null }>;
  departments: Array<{ id: string; name: string }>;
}> {
  const [rolesData, positionsData, depsData] = await Promise.all([
    supabase.from('roles').select('id, name').order('name'),
    supabase.from('positions').select('id, title, role_id, active').order('title').eq('active', true),
    supabase.from('departments').select('id, name, active').order('name').eq('active', true),
  ]);

  return {
    roles: (rolesData.data || []) as Array<{ id: string; name: string }>,
    positions: (positionsData.data || []).map((pos: any) => ({
      id: pos.id,
      title: pos.title,
      role_id: pos.role_id,
    })) as Array<{ id: string; title: string; role_id: string | null }>,
    departments: (depsData.data || []).map((dept: any) => ({
      id: dept.id,
      name: dept.name,
    })) as Array<{ id: string; name: string }>,
  };
}

export async function getInactiveAssignments(userId: string): Promise<{
  inactivePosition: { id: string; title: string } | null;
  inactiveDepartment: { id: string; name: string } | null;
}> {
  try {
    const { data: userData } = await supabase
      .from('profiles')
      .select('position_id, department_id')
      .eq('id', userId)
      .maybeSingle();

    const user = userData as any;
    if (!user) {
      return { inactivePosition: null, inactiveDepartment: null };
    }

    let inactivePosition = null;
    let inactiveDepartment = null;

    if (user.position_id) {
      const { data: posData } = await supabase
        .from('positions')
        .select('id, title, active')
        .eq('id', user.position_id)
        .maybeSingle();

      const pos = posData as any;
      if (pos && !pos.active) {
        inactivePosition = { id: pos.id, title: pos.title };
      }
    }

    if (user.department_id) {
      const { data: deptData } = await supabase
        .from('departments')
        .select('id, name, active')
        .eq('id', user.department_id)
        .maybeSingle();

      const dept = deptData as any;
      if (dept && !dept.active) {
        inactiveDepartment = { id: dept.id, name: dept.name };
      }
    }

    return { inactivePosition, inactiveDepartment };
  } catch (err) {
    console.error('Error checking inactive assignments:', err);
    return { inactivePosition: null, inactiveDepartment: null };
  }
}

export async function updateUserAssignment(
  userId: string,
  updates: UserAssignmentUpdate,
  adminId?: string
): Promise<{ success: boolean; error?: string; user?: AdminUser }> {
  try {
    // Fetch current user assignment for audit log
    const { data: currentUserData } = await supabase
      .from('profiles')
      .select('id, full_name, email, role_id, position_id, department_id')
      .eq('id', userId)
      .maybeSingle();

    const currentUser = currentUserData as any;
    if (!currentUser) {
      return { success: false, error: 'User not found' };
    }

    // Check if any fields actually changed
    const hasChanges =
      (updates.role_id !== undefined && updates.role_id !== currentUser.role_id) ||
      (updates.position_id !== undefined && updates.position_id !== currentUser.position_id) ||
      (updates.department_id !== undefined && updates.department_id !== currentUser.department_id);

    const updateData: Record<string, unknown> = {};
    if (updates.role_id !== undefined) updateData.role_id = updates.role_id;
    if (updates.position_id !== undefined) updateData.position_id = updates.position_id;
    if (updates.department_id !== undefined) updateData.department_id = updates.department_id;

    const query = (supabase.from('profiles') as any)
      .update(updateData)
      .eq('id', userId)
      .select(
        `id, full_name, email, role_id, position_id, department_id, created_at,
         roles(name), positions(title), departments(name)`
      )
      .maybeSingle();

    const { data, error } = await query;

    if (error) {
      console.error('Error updating user assignment:', error);
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: 'User not found' };
    }

    const user: AdminUser = {
      id: data.id,
      full_name: data.full_name,
      email: data.email,
      role_id: data.role_id,
      role_name: (data as any).roles?.name || null,
      position_id: data.position_id,
      position_title: (data as any).positions?.title || null,
      department_id: data.department_id,
      department_name: (data as any).departments?.name || null,
      created_at: data.created_at,
    };

    // Create audit log entry if changes were made and adminId is provided
    if (hasChanges && adminId) {
      const changedFields: string[] = [];
      if (updates.role_id !== undefined && updates.role_id !== currentUser.role_id) {
        changedFields.push('role_id');
      }
      if (updates.position_id !== undefined && updates.position_id !== currentUser.position_id) {
        changedFields.push('position_id');
      }
      if (updates.department_id !== undefined && updates.department_id !== currentUser.department_id) {
        changedFields.push('department_id');
      }

      const auditPayload = {
        target_user_id: userId,
        target_user_email: currentUser.email,
        target_user_name: currentUser.full_name,
        old_role_id: currentUser.role_id,
        new_role_id: updates.role_id !== undefined ? updates.role_id : currentUser.role_id,
        old_position_id: currentUser.position_id,
        new_position_id: updates.position_id !== undefined ? updates.position_id : currentUser.position_id,
        old_department_id: currentUser.department_id,
        new_department_id: updates.department_id !== undefined ? updates.department_id : currentUser.department_id,
        changed_fields: changedFields,
      };

      try {
        await (supabase.from('audit_logs') as any).insert({
          actor_id: adminId,
          action: 'USER_ASSIGNMENT_UPDATED',
          document_type: 'PROFILE',
          document_id: userId,
          payload: auditPayload,
        });
      } catch (auditErr) {
        console.error('Audit log creation failed for user assignment update:', auditErr);
        // Non-blocking: log error but don't fail the update
      }
    }

    return { success: true, user };
  } catch (err) {
    console.error('Error updating user assignment:', err);
    return { success: false, error: 'Failed to update user assignment' };
  }
}
