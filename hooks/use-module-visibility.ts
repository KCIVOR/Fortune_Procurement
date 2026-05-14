'use client';

import { useCallback, useEffect, useState } from 'react';
import type { UserProfile } from '@/types/auth';
import type { ModuleKey } from '@/config/navigation';
import {
  loadModuleVisibilityRules,
  isModuleVisible as resolveIsModuleVisible,
  type ModuleVisibilityRule,
} from '@/lib/module-visibility';

/**
 * Loads the same visibility rules as the sidebar (shared cached fetch).
 * While rules are loading for scoped users, use `rulesLoading` and show skeletons —
 * do not render visibility-gated nav/KPI from isModuleVisible alone.
 * After load or on fetch error: rules is an array (empty = fail-open, all modules visible).
 */
export function useModuleVisibility(profile: UserProfile | null) {
  const [rules, setRules] = useState<ModuleVisibilityRule[] | null>(null);

  useEffect(() => {
    if (!profile) {
      setRules([]);
      return;
    }
    if (profile.role === 'admin' || !profile.role_id) {
      setRules([]);
      return;
    }

    let cancelled = false;
    setRules(null);
    loadModuleVisibilityRules(profile.id, profile.role_id, profile.position_id)
      .then((r) => {
        if (!cancelled) setRules(r);
      })
      .catch((err) => {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('useModuleVisibility: fetch failed, failing open', err);
        }
        if (!cancelled) setRules([]);
      });

    return () => {
      cancelled = true;
    };
  }, [profile]);

  const isModuleVisible = useCallback(
    (moduleKey: ModuleKey | string) => {
      if (!profile || profile.role === 'admin') return true;
      if (rules === null) return true;
      return resolveIsModuleVisible(moduleKey, rules, profile.position_id);
    },
    [profile, rules],
  );

  return {
    isModuleVisible,
    rules,
    /** True while waiting for the first rules result (non-admin with role_id). */
    rulesLoading: !!profile && rules === null && profile.role !== 'admin' && !!profile.role_id,
  };
}
