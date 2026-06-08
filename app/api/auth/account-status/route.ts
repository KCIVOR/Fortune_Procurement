import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Public login helper: returns whether an email belongs to a deactivated profile.
 * Does not reveal whether the email exists when active or unknown.
 */
export async function POST(req: NextRequest) {
  try {
    let body: { email?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ deactivated: false });
    }

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email) {
      return NextResponse.json({ deactivated: false });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ deactivated: false });
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data } = await admin
      .from('profiles')
      .select('active')
      .eq('email', email)
      .maybeSingle();

    return NextResponse.json({ deactivated: data?.active === false });
  } catch (err) {
    console.error('[auth/account-status] Unexpected error:', err);
    return NextResponse.json({ deactivated: false });
  }
}
