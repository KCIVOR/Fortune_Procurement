import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth, isAuthError } from '@/lib/api-auth';
import {
  DEFAULT_SUPPLIER_SUPPLY_TYPE,
  resolveSupplierDefaults,
} from '@/lib/procurement-supplier-defaults';
import { getServerAppUrl } from '@/lib/site-url';

const ASSIGNMENT_KEYS = ['role_id', 'position_id', 'department_id'] as const;

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
    const { email, full_name, payment_terms: paymentTermsRaw } = body ?? {};

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

    const payment_terms = normalizePaymentTerms(paymentTermsRaw);
    if (paymentTermsRaw !== undefined && payment_terms === undefined) {
      return NextResponse.json({ success: false, error: 'Invalid payment_terms' }, { status: 400 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error('[procurement/suppliers/invite] SUPABASE_SERVICE_ROLE_KEY is not set');
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

    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id, active')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingProfile && existingProfile.active === false) {
      return NextResponse.json(
        {
          success: false,
          error: 'User exists but is deactivated. Reactivate them from Supplier Accounts instead.',
        },
        { status: 400 },
      );
    }

    const redirectTo = `${getServerAppUrl()}/invite/complete`;

    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      normalizedEmail,
      {
        data: { full_name: String(full_name).trim() },
        redirectTo,
      },
    );

    if (inviteError || !inviteData?.user) {
      const raw = inviteError?.message || 'Invite failed';
      const lower = raw.toLowerCase();
      const duplicate =
        lower.includes('already') ||
        lower.includes('registered') ||
        lower.includes('exists') ||
        lower.includes('duplicate');
      console.error('[procurement/suppliers/invite] inviteUserByEmail:', raw);
      return NextResponse.json(
        {
          success: false,
          error: duplicate
            ? 'A user with this email already exists. Use manual create or choose another email.'
            : raw,
        },
        { status: duplicate ? 409 : 400 },
      );
    }

    const invitedId = inviteData.user.id;

    const profileRow: Record<string, unknown> = {
      id: invitedId,
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

    const { error: profileError } = await admin.from('profiles').upsert(profileRow, { onConflict: 'id' });

    if (profileError) {
      await admin.auth.admin.deleteUser(invitedId);
      console.error('[procurement/suppliers/invite] profile upsert failed:', profileError.message);
      return NextResponse.json(
        { success: false, error: `Profile save failed: ${profileError.message}` },
        { status: 400 },
      );
    }

    const trimmedName = String(full_name).trim();
    const { error: auditErr } = await admin.from('audit_logs').insert({
      actor_id: auth.userId,
      action: 'SUPPLIER_ACCOUNT_INVITED',
      document_type: 'PROFILE',
      document_id: invitedId,
      payload: {
        target_user_id: invitedId,
        target_user_email: normalizedEmail,
        target_user_name: trimmedName,
        payment_terms: payment_terms ?? null,
      },
    });
    if (auditErr) {
      console.error('[procurement/suppliers/invite] Audit log failed:', auditErr);
    }

    return NextResponse.json({
      success: true,
      user_id: invitedId,
      user_email: normalizedEmail,
    });
  } catch (err) {
    console.error('[procurement/suppliers/invite] Unexpected error:', err);
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
