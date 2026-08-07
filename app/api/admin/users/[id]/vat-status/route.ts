import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

type VatStatusBody = {
  is_vat_registered?: boolean;
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const targetUserId = params.id;

    const limited = rateLimit(req, { key: 'admin:users:vat-status', limit: 30, windowMs: 5 * 60_000 });
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
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
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
        { status: 403 },
      );
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
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

    let body: VatStatusBody;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 },
      );
    }

    if (typeof body.is_vat_registered !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'is_vat_registered (boolean) is required' },
        { status: 400 },
      );
    }

    const nextValue = body.is_vat_registered;

    const { data: targetUser, error: targetErr } = await admin
      .from('profiles')
      .select('id, full_name, email, role_id, roles(name), is_vat_registered')
      .eq('id', targetUserId)
      .maybeSingle();

    if (targetErr || !targetUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 },
      );
    }

    const targetRole = (targetUser as { roles?: { name?: string } }).roles?.name;
    if (targetRole !== 'supplier') {
      return NextResponse.json(
        { success: false, error: 'VAT status can only be set for supplier users.' },
        { status: 400 },
      );
    }

    const currentValue = (targetUser as { is_vat_registered?: boolean }).is_vat_registered === true;

    if (currentValue === nextValue) {
      return NextResponse.json({
        success: true,
        is_vat_registered: nextValue,
      });
    }

    const { data: updated, error: updateErr } = await admin
      .from('profiles')
      .update({ is_vat_registered: nextValue })
      .eq('id', targetUserId)
      .select('is_vat_registered')
      .single();

    if (updateErr || !updated) {
      return NextResponse.json(
        { success: false, error: updateErr?.message ?? 'Failed to update VAT status' },
        { status: 400 },
      );
    }

    const row = targetUser as {
      id: string;
      full_name: string;
      email: string;
    };

    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'SUPPLIER_VAT_STATUS_UPDATED',
      document_type: 'PROFILE',
      document_id: targetUserId,
      payload: {
        target_user_id: targetUserId,
        target_user_email: row.email,
        target_user_name: row.full_name,
        old_is_vat_registered: currentValue,
        new_is_vat_registered: nextValue,
      },
    });

    return NextResponse.json({
      success: true,
      is_vat_registered: (updated as { is_vat_registered?: boolean }).is_vat_registered === true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
