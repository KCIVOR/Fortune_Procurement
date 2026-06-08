import { NextResponse, type NextRequest } from 'next/server';
import {
  evaluateRouteAccess,
  isProductionBlockedPath,
  isRoleAllowedForPath,
} from '@/config/route-access';
import { createMiddlewareSupabaseClient } from '@/lib/supabase/middleware';
import type { AppRole } from '@/types/auth';

function loginRedirect(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('redirect', request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

function deniedRedirect(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = '/dashboard';
  url.searchParams.set('access', 'denied');
  return NextResponse.redirect(url);
}

async function fetchUserActive(
  supabase: ReturnType<typeof createMiddlewareSupabaseClient>['supabase'],
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('active')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return false;
  return (data as { active?: boolean }).active ?? true;
}

async function fetchUserRoleAndPosition(
  supabase: ReturnType<typeof createMiddlewareSupabaseClient>['supabase'],
  userId: string,
): Promise<{ role: AppRole; position: string | null; active: boolean } | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('active, roles:role_id ( name ), positions:position_id ( title )')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as {
    active?: boolean;
    roles?: { name: string } | { name: string }[];
    positions?: { title: string } | { title: string }[];
  };
  const roles = row.roles;
  const roleName = Array.isArray(roles) ? roles[0]?.name : roles?.name;
  const positions = row.positions;
  const positionTitle = Array.isArray(positions) ? positions[0]?.title : positions?.title;

  if (!roleName) return null;
  return {
    role: roleName as AppRole,
    position: positionTitle ?? null,
    active: row.active ?? true,
  };
}

function redirectInactiveUser(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  const redirect = loginRedirect(request);
  response.cookies.getAll().forEach(({ name, value }) => {
    redirect.cookies.set(name, value);
  });
  return redirect;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isProductionBlockedPath(pathname)) {
    return deniedRedirect(request);
  }

  const decision = evaluateRouteAccess(pathname);

  if (decision.kind === 'public') {
    return NextResponse.next();
  }

  if (decision.kind === 'blocked') {
    return deniedRedirect(request);
  }

  const { supabase, response } = createMiddlewareSupabaseClient(request);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return loginRedirect(request);
  }

  const isActive = await fetchUserActive(supabase, user.id);
  if (!isActive) {
    await supabase.auth.signOut();
    return redirectInactiveUser(request, response);
  }

  if (decision.kind === 'authenticated') {
    return response;
  }

  const identity = await fetchUserRoleAndPosition(supabase, user.id);
  if (!identity) {
    return loginRedirect(request);
  }

  if (!identity.active) {
    await supabase.auth.signOut();
    return redirectInactiveUser(request, response);
  }

  if (!isRoleAllowedForPath(pathname, identity.role, identity.position)) {
    return deniedRedirect(request);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$|api/).*)',
  ],
};
