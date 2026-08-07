import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth, isAuthError } from '@/lib/api-auth';
import {
  DEFAULT_SUPPLIER_SUPPLY_TYPE,
  resolveSupplierDefaults,
} from '@/lib/procurement-supplier-defaults';
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

interface ImportRow {
  email: string;
  full_name: string;
  payment_terms?: string;
}

interface RowDetail {
  email: string;
  full_name: string;
  status: 'success' | 'failed';
  error?: string;
}

export async function POST(req: NextRequest) {
  try {
    const limited = rateLimit(req, { key: 'procurement:suppliers:bulk-import', limit: 10, windowMs: 10 * 60_000 });
    if (limited) return limited;

    const auth = await requireApiAuth(req, ['procurement', 'admin']);
    if (isAuthError(auth)) return auth;

    const body = await req.json();
    const { rows, password } = body ?? {};

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No rows provided.' },
        { status: 400 },
      );
    }

    const MAX_ROWS = 500;
    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { success: false, error: `Import limit is ${MAX_ROWS} suppliers per batch. Your file has ${rows.length} rows — split it into smaller files and import separately.` },
        { status: 400 },
      );
    }

    if (!password || String(password).length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters.' },
        { status: 400 },
      );
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error('[suppliers/bulk-import] SUPABASE_SERVICE_ROLE_KEY is not set');
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

    const defaults = await resolveSupplierDefaults(admin);
    if ('error' in defaults) {
      return NextResponse.json({ success: false, error: defaults.error }, { status: 500 });
    }

    const { role_id, position_id, department_id } = defaults;
    const sharedPassword = String(password);

    let succeeded = 0;
    let failed = 0;
    const details: RowDetail[] = [];

    for (const raw of rows as ImportRow[]) {
      const email = String(raw.email ?? '').trim().toLowerCase();
      const full_name = String(raw.full_name ?? '').trim();
      const payment_terms = raw.payment_terms ? String(raw.payment_terms).trim() || undefined : undefined;

      // Validate email format
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

      // Create auth user
      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email,
        password: sharedPassword,
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

      // Insert profile
      const profileRow: Record<string, unknown> = {
        id: userId,
        full_name,
        email,
        role_id,
        department_id,
        position_id,
        supplier_supply_type: DEFAULT_SUPPLIER_SUPPLY_TYPE,
      };
      if (payment_terms !== undefined) {
        profileRow.payment_terms = payment_terms;
      }

      const { error: profileError } = await admin.from('profiles').insert(profileRow);

      if (profileError) {
        // Rollback: delete the auth user we just created
        await admin.auth.admin.deleteUser(userId);
        console.error(`[suppliers/bulk-import] Profile creation failed for ${email}:`, profileError.message);
        details.push({ email, full_name, status: 'failed', error: 'Profile creation failed.' });
        failed++;
        continue;
      }

      details.push({ email, full_name, status: 'success' });
      succeeded++;
    }

    // Audit log — single entry for the whole batch
    const { error: auditErr } = await admin.from('audit_logs').insert({
      actor_id: auth.userId,
      action: 'SUPPLIER_BULK_IMPORTED',
      document_type: 'PROFILE',
      document_id: auth.userId,
      payload: {
        total: rows.length,
        succeeded,
        failed,
        details,
      },
    });
    if (auditErr) {
      console.error('[suppliers/bulk-import] Audit log failed:', auditErr.message);
    }

    return NextResponse.json({
      success: true,
      summary: { total: rows.length, succeeded, failed },
      details,
    });
  } catch (err) {
    console.error('[suppliers/bulk-import] Unexpected error:', err);
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
