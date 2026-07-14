import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth, isAuthError } from '@/lib/api-auth';
import { createNotification } from '@/lib/notifications';

type Body = {
  supplier_id?: string;
  product_name?: string;
  product_code?: string | null;
  category?: string | null;
  description?: string | null;
  specifications?: string | null;
  item_type?: 'goods' | 'services';
  valid_until?: string | null;
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
    if (itemType !== 'goods' && itemType !== 'services') {
      return NextResponse.json(
        { success: false, error: "item_type must be 'goods' or 'services'" },
        { status: 400 },
      );
    }

    let validUntil: string | null = null;
    if (body.valid_until !== undefined && body.valid_until !== null && body.valid_until !== '') {
      if (typeof body.valid_until !== 'string') {
        return NextResponse.json({ success: false, error: 'Invalid valid_until' }, { status: 400 });
      }
      const chosen = new Date(`${body.valid_until}T00:00:00`);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (Number.isNaN(chosen.getTime()) || chosen <= today) {
        return NextResponse.json(
          { success: false, error: 'Expiry date must be a valid date in the future.' },
          { status: 400 },
        );
      }
      validUntil = body.valid_until;
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
        item_type:      itemType,
        status:         'verified',
        verified_at:    now,
        reviewed_at:    now,
        submitted_at:   now,
        reviewed_by:    auth.userId,
        valid_until:    validUntil,
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

    const productId = (product as { id: string }).id;
    const target = targetUser as { full_name?: string; email?: string };

    const { error: auditErr } = await admin.from('audit_logs').insert({
      actor_id:      auth.userId,
      action:        'SUPPLIER_PRODUCT_CREATED_BY_PROCUREMENT',
      document_type: 'SUPPLIER_PRODUCT',
      document_id:   productId,
      payload: {
        supplier_id:    supplierId,
        supplier_email: target.email ?? null,
        supplier_name:  target.full_name ?? null,
        product_name:   productName,
        item_type:      itemType,
        valid_until:    validUntil,
      },
    });
    if (auditErr) {
      console.error('[procurement/products/create] Audit log failed:', auditErr);
    }

    try {
      await createNotification({
        user_id:       supplierId,
        title:         'Product added to your catalog',
        body:          `Procurement added "${productName}" to your product catalog.`,
        type:          'info',
        document_type: 'SUPPLIER_PRODUCT',
        document_id:   productId,
        action_url:    null,
      });
    } catch {
      /* best-effort notify */
    }

    return NextResponse.json({ success: true, product });
  } catch (err) {
    console.error('[procurement/products/create] Unexpected error:', err);
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
