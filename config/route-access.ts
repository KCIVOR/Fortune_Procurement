import type { AppPosition, AppRole } from '@/types/auth';

/** Logistics routes opened to approver + Director position (not other approvers). */
export const DIRECTOR_LOGISTICS_PREFIXES = [
  '/grn',
  '/rfq',
  '/pr2',
  '/po',
  '/delivery',
] as const;

export function isDirectorApprover(
  role: AppRole | undefined | null,
  position?: AppPosition | string | null,
): boolean {
  return role === 'approver' && position === 'Director';
}

function isDirectorLogisticsPath(pathname: string): boolean {
  const path = normalizePathname(pathname);
  return DIRECTOR_LOGISTICS_PREFIXES.some(
    (p) => path === p || path.startsWith(`${p}/`),
  );
}

/** All application roles — any authenticated user on open routes. */
export const ALL_APP_ROLES: readonly AppRole[] = [
  'employee',
  'warehouse',
  'procurement',
  'approver',
  'supplier',
  'admin',
  'tsqa',
] as const;

export type RouteAccessKind =
  | 'public'
  | 'blocked'
  | 'authenticated'
  | 'roles';

export interface RouteAccessDecision {
  kind: RouteAccessKind;
  /** Required when kind === 'roles' */
  roles?: readonly AppRole[];
  /** When true, `admin` may access even if not listed in `roles` */
  adminBypass?: boolean;
}

export interface RouteAccessRule {
  prefix: string;
  decision: RouteAccessDecision;
  /** If true, pathname must equal prefix (not a deeper path) */
  exact?: boolean;
}

/** Longest-prefix wins; keep more specific paths before shorter ones. */
export const ROUTE_ACCESS_RULES: readonly RouteAccessRule[] = [
  { prefix: '/invite/complete', decision: { kind: 'public' } },
  { prefix: '/forgot-password', decision: { kind: 'public' } },
  { prefix: '/reset-password', decision: { kind: 'public' } },
  { prefix: '/login', decision: { kind: 'public' } },

  { prefix: '/supplier', decision: { kind: 'roles', roles: ['supplier'], adminBypass: false } },
  { prefix: '/admin', decision: { kind: 'roles', roles: ['admin'] } },

  { prefix: '/warehouse', decision: { kind: 'roles', roles: ['warehouse'] } },
  { prefix: '/grn', decision: { kind: 'roles', roles: ['warehouse', 'procurement'] } },
  { prefix: '/rfq', decision: { kind: 'roles', roles: ['procurement'] } },
  { prefix: '/pr2', decision: { kind: 'roles', roles: ['procurement'] } },
  { prefix: '/po', decision: { kind: 'roles', roles: ['procurement'] } },

  { prefix: '/pr1/new', decision: { kind: 'roles', roles: ['employee'] } },
  {
    prefix: '/pr1/',
    decision: {
      kind: 'roles',
      roles: ['employee', 'warehouse', 'procurement', 'approver', 'admin'],
    },
  },
  { prefix: '/pr1', decision: { kind: 'roles', roles: ['employee'] }, exact: true },

  { prefix: '/approvals', decision: { kind: 'roles', roles: ['approver', 'procurement'] } },
  {
    prefix: '/accreditation',
    decision: { kind: 'roles', roles: ['procurement', 'admin'] },
  },
  { prefix: '/suppliers', decision: { kind: 'roles', roles: ['procurement', 'admin'] } },
  { prefix: '/tsqa', decision: { kind: 'roles', roles: ['tsqa', 'admin'] } },
  { prefix: '/substitutes', decision: { kind: 'roles', roles: ['employee'] } },
  {
    prefix: '/delivery',
    decision: { kind: 'roles', roles: ['employee', 'warehouse', 'procurement'] },
  },

  { prefix: '/bugtrack', decision: { kind: 'authenticated' } },
  { prefix: '/messages', decision: { kind: 'authenticated' } },
  { prefix: '/profile', decision: { kind: 'authenticated' } },
  { prefix: '/dashboard', decision: { kind: 'authenticated' } },
] as const;

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  const withoutQuery = pathname.split('?')[0] ?? pathname;
  if (withoutQuery.length > 1 && withoutQuery.endsWith('/')) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery;
}

function matchesRule(pathname: string, rule: RouteAccessRule): boolean {
  if (rule.exact) {
    return pathname === rule.prefix;
  }
  return pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`);
}

/**
 * Resolve middleware access for a pathname.
 * Unlisted paths: any authenticated user (session required).
 */
export function evaluateRouteAccess(pathname: string): RouteAccessDecision {
  const path = normalizePathname(pathname);

  const sorted = [...ROUTE_ACCESS_RULES].sort(
    (a, b) => b.prefix.length - a.prefix.length,
  );

  for (const rule of sorted) {
    if (matchesRule(path, rule)) {
      return rule.decision;
    }
  }

  return { kind: 'authenticated' };
}

export function isProductionBlockedPath(pathname: string): boolean {
  if (process.env.NODE_ENV !== 'production') return false;
  const path = normalizePathname(pathname);
  return path === '/test-dashboard' || path.startsWith('/test-dashboard/')
    || path === '/test-filter' || path.startsWith('/test-filter/');
}

/**
 * Mirrors middleware role checks — single source for App Router guards (Phase 4).
 * Assumes caller already has a session when checking protected app routes.
 */
export function isRoleAllowedForPath(
  pathname: string,
  role: AppRole,
  position?: AppPosition | string | null,
): boolean {
  if (isProductionBlockedPath(pathname)) return false;

  const decision = evaluateRouteAccess(pathname);

  switch (decision.kind) {
    case 'public':
      return true;
    case 'blocked':
      return false;
    case 'authenticated':
      return true;
    case 'roles': {
      if (role === 'admin' && decision.adminBypass !== false) return true;
      if (decision.roles?.includes(role)) return true;
      if (isDirectorApprover(role, position) && isDirectorLogisticsPath(pathname)) {
        return true;
      }
      return false;
    }
    default:
      return false;
  }
}

/** Path segments that use AppShell and pathname-based guards. */
export function isAppShellRoute(pathname: string): boolean {
  const path = normalizePathname(pathname);
  const publicPrefixes = ['/login', '/forgot-password', '/reset-password', '/invite/complete'];
  if (publicPrefixes.some((p) => path === p || path.startsWith(`${p}/`))) return false;
  if (isProductionBlockedPath(path)) return false;
  return true;
}
