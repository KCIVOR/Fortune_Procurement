'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { isAppShellRoute, isRoleAllowedForPath } from '@/config/route-access';
import type { AppRole } from '@/types/auth';

export interface UseRequireRolesOptions {
  /** Override pathname (e.g. print layouts) */
  pathname?: string;
  /** Explicit allow-list; when set, ignores pathname map */
  roles?: readonly AppRole[];
  /** When false, admin is not auto-allowed (e.g. supplier portal) */
  adminBypass?: boolean;
}

export interface UseRequireRolesResult {
  pending: boolean;
  allowed: boolean;
}

/**
 * Client-side route guard aligned with `config/route-access.ts` / middleware.
 */
export function useRequireRoles(options: UseRequireRolesOptions = {}): UseRequireRolesResult {
  const pathnameFromRouter = usePathname();
  const pathname = options.pathname ?? pathnameFromRouter ?? '/';
  const { profile, loading, session } = useAuth();

  const pending = loading || (!!session && !profile);

  const allowed = useMemo(() => {
    if (pending || !session) return false;
    if (!profile) return false;

    if (options.roles) {
      const bypass = options.adminBypass !== false;
      if (profile.role === 'admin' && bypass) return true;
      return options.roles.includes(profile.role);
    }

    if (!isAppShellRoute(pathname)) return true;
    return isRoleAllowedForPath(pathname, profile.role, profile.position);
  }, [pending, session, profile, pathname, options.roles, options.adminBypass]);

  return { pending, allowed: pending ? false : allowed };
}
