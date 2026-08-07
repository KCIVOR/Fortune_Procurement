import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

type AssignmentBody = {
  role_id?: string | null;
  position_id?: string | null;
  department_id?: string | null;
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const targetUserId = params.id;

    const limited = rateLimit(req, { key: 'admin:users:assignment', limit: 30, windowMs: 5 * 60_000 });
    if (limited) return limited;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const accessToken = authHeader.replace('Bearer ', '');

    const supabaseUser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: actorProfile } = await supabaseUser
      .from('profiles')
      .select('role_id, roles(name)')
      .eq('id', user.id)
      .maybeSingle();

    if (!actorProfile) {
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      );
    }

    const actorRole = (actorProfile as { roles?: { name?: string } }).roles?.name;
    if (actorRole !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Access denied. Admin role required.' },
        { status: 403 }
      );
    }

    if (!targetUserId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error('[admin/users/assignment] SUPABASE_SERVICE_ROLE_KEY is not set');
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    let body: AssignmentBody;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const updates: AssignmentBody = {
      role_id: body.role_id,
      position_id: body.position_id,
      department_id: body.department_id,
    };

    if (
      updates.role_id === undefined &&
      updates.position_id === undefined &&
      updates.department_id === undefined
    ) {
      return NextResponse.json(
        { success: false, error: 'No assignment fields provided' },
        { status: 400 }
      );
    }

    const { data: currentUser, error: currentErr } = await admin
      .from('profiles')
      .select('id, full_name, email, role_id, position_id, department_id')
      .eq('id', targetUserId)
      .maybeSingle();

    if (currentErr || !currentUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const row = currentUser as {
      id: string;
      full_name: string;
      email: string;
      role_id: string | null;
      position_id: string | null;
      department_id: string | null;
    };

    const updateData: Record<string, string | null> = {};
    if (updates.role_id !== undefined) updateData.role_id = updates.role_id;
    if (updates.position_id !== undefined)
      updateData.position_id = updates.position_id;
    if (updates.department_id !== undefined)
      updateData.department_id = updates.department_id;

    const hasChanges =
      (updates.role_id !== undefined && updates.role_id !== row.role_id) ||
      (updates.position_id !== undefined &&
        updates.position_id !== row.position_id) ||
      (updates.department_id !== undefined &&
        updates.department_id !== row.department_id);

    if (!hasChanges) {
      const { data: existing, error: existErr } = await admin
        .from('profiles')
        .select(
          `id, full_name, email, role_id, position_id, department_id, created_at,
           roles(name), positions(title), departments(name)`
        )
        .eq('id', targetUserId)
        .single();

      if (existErr || !existing) {
        return NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        );
      }

      const ex = existing as Record<string, unknown>;
      const exRoles = ex.roles as { name?: string } | undefined;
      const exPositions = ex.positions as { title?: string } | undefined;
      const exDepts = ex.departments as { name?: string } | undefined;

      return NextResponse.json({
        success: true,
        user: {
          id: ex.id as string,
          full_name: ex.full_name as string,
          email: ex.email as string,
          role_id: ex.role_id as string | null,
          role_name: exRoles?.name ?? null,
          position_id: ex.position_id as string | null,
          position_title: exPositions?.title ?? null,
          department_id: ex.department_id as string | null,
          department_name: exDepts?.name ?? null,
          created_at: ex.created_at as string,
        },
      });
    }

    const { data: updated, error: updateErr } = await admin
      .from('profiles')
      .update(updateData)
      .eq('id', targetUserId)
      .select(
        `id, full_name, email, role_id, position_id, department_id, created_at,
         roles(name), positions(title), departments(name)`
      )
      .single();

    if (updateErr || !updated) {
      console.error('[admin/users/assignment] Update failed:', updateErr);
      return NextResponse.json(
        {
          success: false,
          error: updateErr?.message ?? 'Failed to update user assignment',
        },
        { status: 400 }
      );
    }

    const u = updated as Record<string, unknown> & {
      id: string;
      full_name: string;
      email: string;
      role_id: string | null;
      position_id: string | null;
      department_id: string | null;
      created_at: string;
    };

    if (hasChanges) {
      const changedFields: string[] = [];
      if (updates.role_id !== undefined && updates.role_id !== row.role_id) {
        changedFields.push('role_id');
      }
      if (
        updates.position_id !== undefined &&
        updates.position_id !== row.position_id
      ) {
        changedFields.push('position_id');
      }
      if (
        updates.department_id !== undefined &&
        updates.department_id !== row.department_id
      ) {
        changedFields.push('department_id');
      }

      const auditPayload = {
        target_user_id: targetUserId,
        target_user_email: row.email,
        target_user_name: row.full_name,
        old_role_id: row.role_id,
        new_role_id:
          updates.role_id !== undefined ? updates.role_id : row.role_id,
        old_position_id: row.position_id,
        new_position_id:
          updates.position_id !== undefined
            ? updates.position_id
            : row.position_id,
        old_department_id: row.department_id,
        new_department_id:
          updates.department_id !== undefined
            ? updates.department_id
            : row.department_id,
        changed_fields: changedFields,
      };

      const { error: auditErr } = await admin.from('audit_logs').insert({
        actor_id: user.id,
        action: 'USER_ASSIGNMENT_UPDATED',
        document_type: 'PROFILE',
        document_id: targetUserId,
        payload: auditPayload,
      });
      if (auditErr) {
        console.error('[admin/users/assignment] Audit log failed:', auditErr);
      }
    }

    const roles = u.roles as { name?: string } | undefined;
    const positions = u.positions as { title?: string } | undefined;
    const departments = u.departments as { name?: string } | undefined;

    return NextResponse.json({
      success: true,
      user: {
        id: u.id,
        full_name: u.full_name,
        email: u.email,
        role_id: u.role_id,
        role_name: roles?.name ?? null,
        position_id: u.position_id,
        position_title: positions?.title ?? null,
        department_id: u.department_id,
        department_name: departments?.name ?? null,
        created_at: u.created_at,
      },
    });
  } catch (err) {
    console.error('[admin/users/assignment] Unexpected error:', err);
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
