'use client';

import { useCallback, useEffect, useState } from 'react';
import type { UserProfile } from '@/types/auth';
import type { ModuleKey } from '@/config/navigation';
import { isEssentialModuleKey } from '@/config/module-route-map';
import {
  loadModuleVisibilityRules,
  isModuleVisible as resolveIsModuleVisible,
  type ModuleVisibilityRule,
} from '@/lib/module-visibility';

export type ModuleVisibilityLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Loads the same visibility rules as the sidebar (shared cached fetch).
 * Fail-closed: while loading or on fetch error, only essential modules (dashboard) are visible.
 */
export function useModuleVisibility(profile: UserProfile | null) {
  const [rules, setRules] = useState<ModuleVisibilityRule[] | null>(null);
  const [status, setStatus] = useState<ModuleVisibilityLoadStatus>('idle');

  useEffect(() => {
    if (!profile) {
      setRules(null);
      setStatus('idle');
      return;
    }
    if (profile.role === 'admin' || !profile.role_id) {
      setRules([]);
      setStatus('ready');
      return;
    }

    let cancelled = false;
    setRules(null);
    setStatus('loading');

    loadModuleVisibilityRules(profile.id, profile.role_id, profile.position_id)
      .then((r) => {
        if (!cancelled) {
          setRules(r);
          setStatus('ready');
        }
      })
      .catch((err) => {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('useModuleVisibility: fetch failed, failing closed', err);
        }
        if (!cancelled) {
          setRules([]);
          setStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [profile]);

  const isModuleVisible = useCallback(
    (moduleKey: ModuleKey | string) => {
      if (!profile || profile.role === 'admin') return true;
      if (status === 'loading' || status === 'error') {
        return isEssentialModuleKey(moduleKey);
      }
      if (rules === null) {
        return isEssentialModuleKey(moduleKey);
      }
      return resolveIsModuleVisible(moduleKey, rules, profile.position_id);
    },
    [profile, rules, status],
  );

  const rulesLoading =
    !!profile && profile.role !== 'admin' && !!profile.role_id && status === 'loading';

  const rulesFetchFailed =
    !!profile && profile.role !== 'admin' && !!profile.role_id && status === 'error';

  return {
    isModuleVisible,
    rules,
    rulesLoading,
    rulesFetchFailed,
    status,
  };
}
