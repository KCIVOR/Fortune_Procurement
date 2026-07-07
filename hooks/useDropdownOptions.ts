'use client';

import { useEffect, useState } from 'react';
import { fetchDropdownOptions } from '@/lib/dropdown-options';
import type { DropdownCategory, DropdownOption } from '@/types/dropdown-options';

/**
 * Module-level cache so options are fetched once per category per page session.
 * Keyed by category → { promise, fetchedAt } to avoid duplicate in-flight requests.
 *
 * This cache is per browser tab (module-scoped, not persisted anywhere shared), so an
 * admin edit in one tab can't reach into another tab's copy. TTL + refetch-on-focus
 * below bound how long any other open tab can show a stale label before self-healing,
 * without needing a realtime subscription for something that changes rarely.
 */
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

type CacheEntry = { promise: Promise<DropdownOption[]>; fetchedAt: number };
const cache = new Map<DropdownCategory, CacheEntry>();

function isStale(entry: CacheEntry | undefined): boolean {
  return !entry || Date.now() - entry.fetchedAt > CACHE_TTL_MS;
}

/** Invalidate the cache for a specific category (call after admin mutations). */
export function invalidateDropdownCache(category?: DropdownCategory) {
  if (category) {
    cache.delete(category);
  } else {
    cache.clear();
  }
}

/**
 * Hook that returns dynamic dropdown options for a given category.
 *
 * Usage:
 * ```tsx
 * const { options, loading } = useDropdownOptions('WAREHOUSE_OPTIONS');
 * ```
 */
export function useDropdownOptions(category: DropdownCategory) {
  const [options, setOptions] = useState<DropdownOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    function load(force: boolean) {
      if (force || isStale(cache.get(category))) {
        cache.set(category, { promise: fetchDropdownOptions(category), fetchedAt: Date.now() });
      }

      cache.get(category)!.promise
        .then((data) => {
          if (!cancelled) {
            setOptions(data);
            setLoading(false);
          }
        })
        .catch(() => {
          // On failure, remove from cache so next attempt retries
          cache.delete(category);
          if (!cancelled) setLoading(false);
        });
    }

    load(false);

    // Refetch when the tab regains focus/visibility, so an edit made in another
    // tab (e.g. admin settings) shows up as soon as the user comes back here,
    // instead of waiting out the full TTL.
    function onFocusOrVisible() {
      if (document.visibilityState === 'hidden') return;
      if (isStale(cache.get(category))) load(true);
    }
    window.addEventListener('focus', onFocusOrVisible);
    document.addEventListener('visibilitychange', onFocusOrVisible);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocusOrVisible);
      document.removeEventListener('visibilitychange', onFocusOrVisible);
    };
  }, [category]);

  return { options, loading };
}
