import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

type ResetPasswordBody = {
  new_password?: string;
};

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const targetUserId = params.id;

    const limited = rateLimit(req, { key: 'admin:users:reset-password', limit: 10, windowMs: 10 * 60_000 });
    if (limited) return limited;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const accessToken = authHeader.replace('Bearer ', '');

    const supabaseUser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } },
    );

    const {
      data: { user: actor },
      error: userError,
    } = await supabaseUser.auth.getUser(accessToken);

    if (userError || !actor) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const { data: actorProfile } = await supabaseUser
      .from('profiles')
      .select('role_id, roles(name)')
      .eq('id', actor.id)
      .maybeSingle();

    if (!actorProfile) {
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 },
      );
    }

    const actorRole = (actorProfile as { roles?: { name?: string } }).roles?.name;
    if (actorRole !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Access denied. Admin role required.' },
        { status: 403 },
      );
    }

    if (!targetUserId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 },
      );
    }

    let body: ResetPasswordBody;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 },
      );
    }

    const newPassword = typeof body.new_password === 'string' ? body.new_password : '';
    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters' },
        { status: 400 },
      );
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error('[admin/users/reset-password] SUPABASE_SERVICE_ROLE_KEY is not set');
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 },
      );
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: targetProfile, error: targetProfileErr } = await admin
      .from('profiles')
      .select('id, email, full_name')
      .eq('id', targetUserId)
      .maybeSingle();

    if (targetProfileErr) {
      console.error('[admin/users/reset-password] Target lookup failed:', targetProfileErr);
      return NextResponse.json(
        { success: false, error: 'Failed to look up user' },
        { status: 400 },
      );
    }

    if (!targetProfile) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 },
      );
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(targetUserId, {
      password: newPassword,
    });

    if (updateError) {
      console.error('[admin/users/reset-password] Password update failed:', updateError.message);
      return NextResponse.json(
        { success: false, error: updateError.message || 'Failed to reset password' },
        { status: 400 },
      );
    }

    const targetEmail =
      (targetProfile as { email?: string | null }).email ?? 'unknown';

    const { error: auditErr } = await admin.from('audit_logs').insert({
      actor_id: actor.id,
      action: 'USER_PASSWORD_RESET',
      document_type: 'USER',
      document_id: targetUserId,
      payload: {
        target_user_id: targetUserId,
        target_user_email: targetEmail,
        target_user_name: (targetProfile as { full_name?: string }).full_name ?? null,
      },
    });

    if (auditErr) {
      console.error('[admin/users/reset-password] Audit log failed:', auditErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (err) {
    console.error('[admin/users/reset-password] Unexpected error:', err);
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
