import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

/** Permanent ban sentinel — unban by passing ban_duration: 'none' */
const PERMANENT_BAN = '876000h'; // ~100 years

const ADMIN_USER_SELECT = `id, full_name, email, role_id, position_id, department_id, created_at, active,
 roles(name), positions(title), departments(name)`;

type StatusBody = { active?: boolean };

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const targetUserId = params.id;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
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
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: actorProfile } = await supabaseUser
      .from('profiles')
      .select('role_id, roles(name)')
      .eq('id', user.id)
      .maybeSingle();

    const actorRole = (actorProfile as { roles?: { name?: string } } | null)?.roles?.name;
    if (actorRole !== 'admin' && actorRole !== 'procurement') {
      return NextResponse.json(
        { success: false, error: 'Access denied. Admin or procurement role required.' },
        { status: 403 }
      );
    }

    if (!targetUserId) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    let body: StatusBody;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    if (typeof body.active !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'active (boolean) is required' },
        { status: 400 }
      );
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error('[admin/users/status] SUPABASE_SERVICE_ROLE_KEY is not set');
      return NextResponse.json({ success: false, error: 'Server configuration error' }, { status: 500 });
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    if (targetUserId === user.id && body.active === false) {
      return NextResponse.json(
        { success: false, error: 'You cannot deactivate your own account' },
        { status: 400 }
      );
    }

    const { data: target, error: targetErr } = await admin
      .from('profiles')
      .select('id, full_name, email, role_id, position_id, department_id, active, roles(name)')
      .eq('id', targetUserId)
      .maybeSingle();

    if (targetErr || !target) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const row = target as {
      id: string;
      full_name: string;
      email: string;
      role_id: string | null;
      position_id: string | null;
      department_id: string | null;
      active: boolean;
      roles?: { name?: string };
    };

    if (actorRole === 'procurement' && row.roles?.name !== 'supplier') {
      return NextResponse.json(
        { success: false, error: 'Procurement can only deactivate or reactivate supplier accounts.' },
        { status: 403 }
      );
    }

    if (row.active === body.active) {
      const { data: existing, error: existErr } = await admin
        .from('profiles')
        .select(ADMIN_USER_SELECT)
        .eq('id', targetUserId)
        .single();

      if (existErr || !existing) {
        return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, user: mapAdminUser(existing) });
    }

    if (body.active === false && row.roles?.name === 'admin') {
      const { data: adminRole } = await admin.from('roles').select('id').eq('name', 'admin').maybeSingle();
      if (adminRole?.id) {
        const { count } = await admin
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role_id', adminRole.id)
          .eq('active', true)
          .neq('id', targetUserId);

        if ((count ?? 0) === 0) {
          return NextResponse.json(
            { success: false, error: 'Cannot deactivate the last active administrator' },
            { status: 400 }
          );
        }
      }
    }

    const { data: updated, error: updateErr } = await admin
      .from('profiles')
      .update({ active: body.active })
      .eq('id', targetUserId)
      .select(ADMIN_USER_SELECT)
      .single();

    if (updateErr || !updated) {
      console.error('[admin/users/status] Update failed:', updateErr);
      return NextResponse.json(
        { success: false, error: updateErr?.message ?? 'Failed to update user status' },
        { status: 400 }
      );
    }

    const { error: banErr } = await admin.auth.admin.updateUserById(targetUserId, {
      ban_duration: body.active ? 'none' : PERMANENT_BAN,
    });

    if (banErr) {
      await admin.from('profiles').update({ active: row.active }).eq('id', targetUserId);
      console.error('[admin/users/status] Auth ban failed:', banErr);
      return NextResponse.json(
        { success: false, error: `Auth update failed: ${banErr.message}` },
        { status: 500 }
      );
    }

    const action = body.active ? 'USER_REACTIVATED' : 'USER_DEACTIVATED';
    const { error: auditErr } = await admin.from('audit_logs').insert({
      actor_id: user.id,
      action,
      document_type: 'PROFILE',
      document_id: targetUserId,
      payload: {
        target_user_id: targetUserId,
        target_user_email: row.email,
        target_user_name: row.full_name,
        old_active: row.active,
        new_active: body.active,
      },
    });
    if (auditErr) {
      console.error('[admin/users/status] Audit log failed:', auditErr);
    }

    return NextResponse.json({ success: true, user: mapAdminUser(updated) });
  } catch (err) {
    console.error('[admin/users/status] Unexpected error:', err);
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

function mapAdminUser(data: unknown) {
  const u = data as Record<string, unknown>;
  const roles = u.roles as { name?: string } | undefined;
  const positions = u.positions as { title?: string } | undefined;
  const departments = u.departments as { name?: string } | undefined;
  return {
    id: u.id as string,
    full_name: u.full_name as string,
    email: u.email as string,
    role_id: u.role_id as string | null,
    role_name: roles?.name ?? null,
    position_id: u.position_id as string | null,
    position_title: positions?.title ?? null,
    department_id: u.department_id as string | null,
    department_name: departments?.name ?? null,
    created_at: u.created_at as string,
    active: (u.active as boolean) ?? true,
  };
}
