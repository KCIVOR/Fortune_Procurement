import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

function generateTempPassword(): string {
  const length = 16;
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

export async function POST(req: NextRequest) {
  try {
    const limited = rateLimit(req, { key: 'admin:users:create', limit: 20, windowMs: 10 * 60_000 });
    if (limited) return limited;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = authHeader.replace('Bearer ', '');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role_id, roles(name)')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
    }

    const userRole = (profile as any).roles?.name;
    if (userRole !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Access denied. Admin role required.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { email, full_name, role_id, department_id, position_id, password } = body;

    if (!email || !full_name || !role_id || !department_id || !position_id) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ success: false, error: 'Invalid email format' }, { status: 400 });
    }

    if (password && password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error('[admin/users/create] SUPABASE_SERVICE_ROLE_KEY is not set');
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

    const tempPassword = password || generateTempPassword();

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      const msg = authError?.message || 'Unknown auth error';
      console.error('[admin/users/create] Auth creation failed:', msg);
      return NextResponse.json(
        { success: false, error: msg },
        { status: 400 }
      );
    }

    const userId = authData.user.id;

    const { data: createdRole } = await admin
      .from('roles')
      .select('name')
      .eq('id', role_id)
      .maybeSingle();

    const profilePayload: Record<string, unknown> = {
      id: userId,
      full_name,
      email,
      role_id,
      department_id,
      position_id,
    };
    if ((createdRole as { name?: string } | null)?.name === 'supplier') {
      profilePayload.supplier_supply_type = 'normal';
    }

    const { error: profileError } = await admin.from('profiles').insert(profilePayload);

    if (profileError) {
      await admin.auth.admin.deleteUser(userId);
      const msg = profileError.message;
      console.error('[admin/users/create] Profile creation failed:', msg);
      return NextResponse.json(
        { success: false, error: `Profile creation failed: ${msg}` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      user_id: userId,
      user_email: email,
      temp_password: tempPassword,
    });
  } catch (err) {
    console.error('[admin/users/create] Unexpected error:', err);
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
