import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const ALLOWED = new Set(['raw_material', 'normal', 'service'] as const);
type SupplyType = 'raw_material' | 'normal' | 'service';

type Body = {
  supplier_supply_type?: SupplyType | null;
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const targetUserId = params.id;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
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

    let body: Body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const nextValue = body.supplier_supply_type;
    if (nextValue !== null && nextValue !== undefined && !ALLOWED.has(nextValue as SupplyType)) {
      return NextResponse.json(
        {
          success: false,
          error: 'supplier_supply_type must be raw_material, normal, service, or null',
        },
        { status: 400 },
      );
    }
    if (nextValue === undefined) {
      return NextResponse.json(
        { success: false, error: 'supplier_supply_type is required (use null to clear)' },
        { status: 400 },
      );
    }

    const { data: targetUser, error: targetErr } = await admin
      .from('profiles')
      .select('id, full_name, email, role_id, roles(name), supplier_supply_type')
      .eq('id', targetUserId)
      .maybeSingle();

    if (targetErr || !targetUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const targetRole = (targetUser as { roles?: { name?: string } }).roles?.name;
    if (targetRole !== 'supplier') {
      return NextResponse.json(
        { success: false, error: 'Supply type can only be set for supplier users.' },
        { status: 400 },
      );
    }

    const currentValue =
      (targetUser as { supplier_supply_type?: string | null }).supplier_supply_type ?? null;

    if (currentValue === nextValue) {
      return NextResponse.json({ success: true, supplier_supply_type: nextValue });
    }

    const { data: updated, error: updateErr } = await admin
      .from('profiles')
      .update({ supplier_supply_type: nextValue })
      .eq('id', targetUserId)
      .select('supplier_supply_type')
      .single();

    if (updateErr || !updated) {
      return NextResponse.json(
        { success: false, error: updateErr?.message ?? 'Failed to update supply type' },
        { status: 400 },
      );
    }

    const row = targetUser as { id: string; full_name: string; email: string };

    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'SUPPLIER_SUPPLY_TYPE_UPDATED',
      document_type: 'PROFILE',
      document_id: targetUserId,
      payload: {
        target_user_id: targetUserId,
        target_user_email: row.email,
        target_user_name: row.full_name,
        old_supplier_supply_type: currentValue,
        new_supplier_supply_type: nextValue,
      },
    });

    return NextResponse.json({
      success: true,
      supplier_supply_type:
        (updated as { supplier_supply_type?: string | null }).supplier_supply_type ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
