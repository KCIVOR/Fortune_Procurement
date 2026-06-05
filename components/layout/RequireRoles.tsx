'use client';

import type { ReactNode } from 'react';
import LoadingState from '@/components/shared/LoadingState';
import AccessDenied from '@/components/layout/AccessDenied';
import { useRequireRoles, type UseRequireRolesOptions } from '@/hooks/use-require-roles';

interface RequireRolesProps extends UseRequireRolesOptions {
  children: ReactNode;
}

/**
 * Page/layout guard — shows Access Denied instead of redirect (Phase 4).
 * Prefer route segment layouts for print pages; AppShell uses the hook directly.
 */
export default function RequireRoles({ children, ...options }: RequireRolesProps) {
  const { pending, allowed } = useRequireRoles(options);

  if (pending) {
    return (
      <div className="min-h-screen bg-pq-neutral-50 flex items-center justify-center">
        <LoadingState message="Checking access..." />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen bg-pq-neutral-50 flex items-center justify-center">
        <AccessDenied />
      </div>
    );
  }

  return <>{children}</>;
}
