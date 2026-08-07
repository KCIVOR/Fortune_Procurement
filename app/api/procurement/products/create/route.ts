import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth, isAuthError } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limit';

type Body = {
  supplier_id?: string;
  product_name?: string;
  product_code?: string | null;
  category?: string | null;
  description?: string | null;
  specifications?: string | null;
  item_type?: 'goods' | 'services';
};

function resolveRoleName(profile: unknown): string | null {
  const roles = (profile as { roles?: { name: string } | { name: string }[] | null })?.roles;
  if (!roles) return null;
  return Array.isArray(roles) ? roles[0]?.name ?? null : roles.name ?? null;
}

function optionalTrimmed(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export async function POST(req: NextRequest) {
  try {
    const limited = rateLimit(req, { key: 'procurement:products:create', limit: 30, windowMs: 5 * 60_000 });
    if (limited) return limited;

    const auth = await requireApiAuth(req, ['procurement', 'admin']);
    if (isAuthError(auth)) return auth;

    let body: Body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const supplierId = typeof body.supplier_id === 'string' ? body.supplier_id.trim() : '';
    if (!supplierId) {
      return NextResponse.json({ success: false, error: 'supplier_id is required' }, { status: 400 });
    }

    const productName =
      typeof body.product_name === 'string' ? body.product_name.trim() : '';
    if (!productName) {
      return NextResponse.json(
        { success: false, error: 'product_name is required and must be non-empty' },
        { status: 400 },
      );
    }

    const itemType = body.item_type ?? 'goods';
    if (itemType !== 'goods') {
      return NextResponse.json(
        {
          success: false,
          error:
            "Catalog products must be goods. Services RFQs use manual quote entry — item_type 'services' is not accepted.",
        },
        { status: 400 },
      );
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error('[procurement/products/create] SUPABASE_SERVICE_ROLE_KEY is not set');
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

    const { data: targetUser, error: targetErr } = await admin
      .from('profiles')
      .select('id, full_name, email, supplier_supply_type, roles(name)')
      .eq('id', supplierId)
      .maybeSingle();

    if (targetErr || !targetUser) {
      return NextResponse.json({ success: false, error: 'Supplier not found' }, { status: 404 });
    }

    const targetRole = resolveRoleName(targetUser);
    const supplyType = (targetUser as { supplier_supply_type?: string | null }).supplier_supply_type ?? null;

    if (targetRole !== 'supplier') {
      return NextResponse.json(
        { success: false, error: 'Target user must have the supplier role.' },
        { status: 400 },
      );
    }

    if (supplyType !== 'raw_material') {
      return NextResponse.json(
        {
          success: false,
          error:
            'Catalog products can only be created for raw-material suppliers (supplier_supply_type must be raw_material).',
        },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();

    const { data: product, error: insertErr } = await admin
      .from('supplier_products')
      .insert({
        supplier_id:    supplierId,
        product_name:   productName,
        product_code:   optionalTrimmed(body.product_code),
        category:       optionalTrimmed(body.category),
        description:    optionalTrimmed(body.description),
        specifications: optionalTrimmed(body.specifications),
        item_type:      'goods',
        status:         'verified',
        verified_at:    now,
        reviewed_at:    now,
        submitted_at:   now,
        reviewed_by:    auth.userId,
        valid_until:    null,
        created_at:     now,
        updated_at:     now,
      })
      .select('*')
      .single();

    if (insertErr || !product) {
      console.error('[procurement/products/create] Insert failed:', insertErr?.message);
      return NextResponse.json(
        { success: false, error: insertErr?.message ?? 'Failed to create product' },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true, product });
  } catch (err) {
    console.error('[procurement/products/create] Unexpected error:', err);
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
