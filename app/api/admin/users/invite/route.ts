import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { getServerAppUrl } from '@/lib/site-url';

/**
 * Supabase Dashboard (Auth → URL): allow redirect URLs including:
 *   {SITE_URL}/invite/complete
 *   http://localhost:3000/invite/complete
 * Customize "Invite user" email template in Dashboard for Fortune Procurement branding.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = authHeader.replace('Bearer ', '');

    const supabaseUser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser(accessToken);
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabaseUser
      .from('profiles')
      .select('role_id, roles(name)')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
    }

    const userRole = (profile as { roles?: { name?: string } }).roles?.name;
    if (userRole !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Access denied. Admin role required.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { email, full_name, role_id, department_id, position_id } = body;

    if (!email || !full_name || !role_id || !department_id || !position_id) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ success: false, error: 'Invalid email format' }, { status: 400 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error('[admin/users/invite] SUPABASE_SERVICE_ROLE_KEY is not set');
      return NextResponse.json(
        { success: false, error: 'Server configuration error: service role key is missing' },
        { status: 500 }
      );
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const normalizedEmail = email.trim().toLowerCase();

    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id, active')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingProfile && existingProfile.active === false) {
      return NextResponse.json(
        {
          success: false,
          error: 'User exists but is deactivated. Reactivate them from User Management instead.',
        },
        { status: 400 }
      );
    }

    const baseUrl = getServerAppUrl();
    const redirectTo = `${baseUrl}/invite/complete`;

    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      normalizedEmail,
      {
        data: { full_name: full_name.trim() },
        redirectTo,
      }
    );

    if (inviteError || !inviteData?.user) {
      const raw = inviteError?.message || 'Invite failed';
      const lower = raw.toLowerCase();
      const duplicate =
        lower.includes('already') ||
        lower.includes('registered') ||
        lower.includes('exists') ||
        lower.includes('duplicate');
      console.error('[admin/users/invite] inviteUserByEmail:', raw);
      return NextResponse.json(
        {
          success: false,
          error: duplicate
            ? 'A user with this email already exists. Use manual create or choose another email.'
            : raw,
        },
        { status: duplicate ? 409 : 400 }
      );
    }

    const invitedId = inviteData.user.id;

    const { error: profileError } = await admin.from('profiles').upsert(
      {
        id: invitedId,
        full_name: full_name.trim(),
        email: normalizedEmail,
        role_id,
        department_id,
        position_id,
      },
      { onConflict: 'id' }
    );

    if (profileError) {
      await admin.auth.admin.deleteUser(invitedId);
      console.error('[admin/users/invite] profile upsert failed:', profileError.message);
      return NextResponse.json(
        { success: false, error: `Profile save failed: ${profileError.message}` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      user_id: invitedId,
      user_email: normalizedEmail,
    });
  } catch (err) {
    console.error('[admin/users/invite] Unexpected error:', err);
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
