import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import type { AppRole } from '@/types/auth';

export type ApiAuthContext = {
  userId: string;
  role: AppRole;
  supabase: SupabaseClient;
};

function resolveRoleName(profile: unknown): AppRole | null {
  const roles = (profile as { roles?: { name: string } | { name: string }[] | null })?.roles;
  if (!roles) return null;
  const name = Array.isArray(roles) ? roles[0]?.name : roles.name;
  return (name as AppRole) || null;
}

/**
 * Validates Bearer JWT and optional role allow-list for App Router API routes.
 * Returns NextResponse on failure; caller should `if (isAuthError(x)) return x`.
 */
export async function requireApiAuth(
  req: NextRequest,
  allowedRoles?: AppRole[],
): Promise<ApiAuthContext | NextResponse> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const accessToken = authHeader.slice(7);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } },
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

  const role = resolveRoleName(profile);
  if (!role) {
    return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return NextResponse.json(
      { success: false, error: 'Access denied.' },
      { status: 403 },
    );
  }

  return { userId: user.id, role, supabase };
}

export function isAuthError(
  result: ApiAuthContext | NextResponse,
): result is NextResponse {
  return result instanceof NextResponse;
}
