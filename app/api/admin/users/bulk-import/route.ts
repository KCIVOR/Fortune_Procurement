import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth, isAuthError } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limit';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isDuplicateAuthError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('already') ||
    lower.includes('exists') ||
    lower.includes('registered') ||
    lower.includes('duplicate')
  );
}

function generateTempPassword(): string {
  const length = 16;
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

interface ImportRow {
  email: string;
  full_name: string;
  department_id: string;
  position_id: string;
}

interface RowDetail {
  email: string;
  full_name: string;
  status: 'success' | 'failed';
  error?: string;
  temp_password?: string;
}

export async function POST(req: NextRequest) {
  try {
    const limited = rateLimit(req, { key: 'admin:users:bulk-import', limit: 10, windowMs: 10 * 60_000 });
    if (limited) return limited;

    const auth = await requireApiAuth(req, ['admin']);
    if (isAuthError(auth)) return auth;

    const body = await req.json();
    const { rows } = body ?? {};

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ success: false, error: 'No rows provided.' }, { status: 400 });
    }

    const MAX_ROWS = 500;
    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { success: false, error: `Import limit is ${MAX_ROWS} users per batch. Your file has ${rows.length} rows — split it into smaller files and import separately.` },
        { status: 400 },
      );
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error('[admin/users/bulk-import] SUPABASE_SERVICE_ROLE_KEY is not set');
      return NextResponse.json(
        { success: false, error: 'Server configuration error: service role key is missing.' },
        { status: 500 },
      );
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Load valid departments/positions once, server-side — never trust
    // role/department/position assignment from the client beyond the id
    // references themselves. role_id is derived from the position row,
    // not accepted from the client.
    const [deptsRes, positionsRes] = await Promise.all([
      admin.from('departments').select('id').eq('active', true),
      admin.from('positions').select('id, role_id').eq('active', true),
    ]);

    if (deptsRes.error) {
      return NextResponse.json({ success: false, error: `Department lookup failed: ${deptsRes.error.message}` }, { status: 500 });
    }
    if (positionsRes.error) {
      return NextResponse.json({ success: false, error: `Position lookup failed: ${positionsRes.error.message}` }, { status: 500 });
    }

    const validDeptIds = new Set((deptsRes.data ?? []).map(d => d.id as string));
    const positionRoleMap = new Map<string, string | null>(
      (positionsRes.data ?? []).map(p => [p.id as string, p.role_id as string | null]),
    );

    let succeeded = 0;
    let failed = 0;
    const details: RowDetail[] = [];

    for (const raw of rows as ImportRow[]) {
      const email = String(raw.email ?? '').trim().toLowerCase();
      const full_name = String(raw.full_name ?? '').trim();
      const department_id = String(raw.department_id ?? '').trim();
      const position_id = String(raw.position_id ?? '').trim();

      if (!EMAIL_REGEX.test(email)) {
        details.push({ email, full_name, status: 'failed', error: 'Invalid email format.' });
        failed++;
        continue;
      }
      if (!full_name) {
        details.push({ email, full_name, status: 'failed', error: 'Full name is required.' });
        failed++;
        continue;
      }
      if (!department_id || !validDeptIds.has(department_id)) {
        details.push({ email, full_name, status: 'failed', error: 'Unrecognized or inactive department.' });
        failed++;
        continue;
      }
      if (!position_id || !positionRoleMap.has(position_id)) {
        details.push({ email, full_name, status: 'failed', error: 'Unrecognized or inactive position.' });
        failed++;
        continue;
      }

      const role_id = positionRoleMap.get(position_id);
      if (!role_id) {
        details.push({ email, full_name, status: 'failed', error: 'Position has no role assigned.' });
        failed++;
        continue;
      }

      const rowPassword = generateTempPassword();

      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email,
        password: rowPassword,
        email_confirm: true,
      });

      if (authError || !authData.user) {
        const msg = authError?.message ?? 'Unknown auth error';
        const friendlyError = isDuplicateAuthError(msg)
          ? 'A user with this email already exists.'
          : `Auth creation failed: ${msg}`;
        details.push({ email, full_name, status: 'failed', error: friendlyError });
        failed++;
        continue;
      }

      const userId = authData.user.id;

      const profileRow: Record<string, unknown> = {
        id: userId,
        full_name,
        email,
        role_id,
        department_id,
        position_id,
      };

      const { error: profileError } = await admin.from('profiles').insert(profileRow);

      if (profileError) {
        await admin.auth.admin.deleteUser(userId);
        console.error(`[admin/users/bulk-import] Profile creation failed for ${email}:`, profileError.message);
        details.push({ email, full_name, status: 'failed', error: 'Profile creation failed.' });
        failed++;
        continue;
      }

      details.push({ email, full_name, status: 'success', temp_password: rowPassword });
      succeeded++;
    }

    const { error: auditErr } = await admin.from('audit_logs').insert({
      actor_id: auth.userId,
      action: 'USER_BULK_IMPORTED',
      document_type: 'PROFILE',
      document_id: auth.userId,
      payload: {
        total: rows.length,
        succeeded,
        failed,
        details: details.map(({ temp_password, ...rest }) => rest),
      },
    });
    if (auditErr) {
      console.error('[admin/users/bulk-import] Audit log failed:', auditErr.message);
    }

    return NextResponse.json({
      success: true,
      summary: { total: rows.length, succeeded, failed },
      details,
    });
  } catch (err) {
    console.error('[admin/users/bulk-import] Unexpected error:', err);
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
