import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth, isAuthError } from '@/lib/api-auth';
import {
  DEFAULT_SUPPLIER_SUPPLY_TYPE,
  resolveSupplierDefaults,
} from '@/lib/procurement-supplier-defaults';

const ASSIGNMENT_KEYS = ['role_id', 'position_id', 'department_id'] as const;

function generateTempPassword(): string {
  const length = 16;
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

function normalizePaymentTerms(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || null;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiAuth(req, ['procurement', 'admin']);
    if (isAuthError(auth)) return auth;

    const body = await req.json();
    const { email, full_name, password, payment_terms: paymentTermsRaw } = body ?? {};

    for (const key of ASSIGNMENT_KEYS) {
      if (body?.[key] !== undefined && body?.[key] !== null && body?.[key] !== '') {
        return NextResponse.json(
          { success: false, error: 'role, position, and department are set automatically for supplier accounts.' },
          { status: 400 },
        );
      }
    }

    if (!email || !full_name) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json({ success: false, error: 'Invalid email format' }, { status: 400 });
    }

    if (password && String(password).length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters' },
        { status: 400 },
      );
    }

    const payment_terms = normalizePaymentTerms(paymentTermsRaw);
    if (paymentTermsRaw !== undefined && payment_terms === undefined) {
      return NextResponse.json({ success: false, error: 'Invalid payment_terms' }, { status: 400 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error('[procurement/suppliers/create] SUPABASE_SERVICE_ROLE_KEY is not set');
      return NextResponse.json(
        { success: false, error: 'Server configuration error: service role key is missing' },
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

    const tempPassword = password ? String(password) : generateTempPassword();

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password: tempPassword,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      const msg = authError?.message || 'Unknown auth error';
      console.error('[procurement/suppliers/create] Auth creation failed:', msg);
      return NextResponse.json({ success: false, error: msg }, { status: 400 });
    }

    const userId = authData.user.id;

    const profileRow: Record<string, unknown> = {
      id: userId,
      full_name: String(full_name).trim(),
      email: normalizedEmail,
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
      await admin.auth.admin.deleteUser(userId);
      console.error('[procurement/suppliers/create] Profile creation failed:', profileError.message);
      return NextResponse.json(
        { success: false, error: `Profile creation failed: ${profileError.message}` },
        { status: 400 },
      );
    }

    const trimmedName = String(full_name).trim();
    const { error: auditErr } = await admin.from('audit_logs').insert({
      actor_id: auth.userId,
      action: 'SUPPLIER_ACCOUNT_CREATED',
      document_type: 'PROFILE',
      document_id: userId,
      payload: {
        target_user_id: userId,
        target_user_email: normalizedEmail,
        target_user_name: trimmedName,
        payment_terms: payment_terms ?? null,
        manual_password: Boolean(password),
      },
    });
    if (auditErr) {
      console.error('[procurement/suppliers/create] Audit log failed:', auditErr);
    }

    return NextResponse.json({
      success: true,
      user_id: userId,
      user_email: normalizedEmail,
      temp_password: tempPassword,
    });
  } catch (err) {
    console.error('[procurement/suppliers/create] Unexpected error:', err);
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
