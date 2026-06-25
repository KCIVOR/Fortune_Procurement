'use client';

import { useEffect, useState } from 'react';
import { fetchDropdownOptions } from '@/lib/dropdown-options';
import type { DropdownCategory, DropdownOption } from '@/types/dropdown-options';

/**
 * Module-level cache so options are fetched once per category per page session.
 * Keyed by category → Promise<DropdownOption[]> to avoid duplicate in-flight requests.
 */
const cache = new Map<DropdownCategory, Promise<DropdownOption[]>>();

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

    // Reuse existing in-flight or cached promise
    if (!cache.has(category)) {
      cache.set(category, fetchDropdownOptions(category));
    }

    cache.get(category)!
      .then((data) => {
        if (!cancelled) {
          setOptions(data);
          setLoading(false);
        }
      })
      .catch(() => {
        // On failure, remove from cache so next mount retries
        cache.delete(category);
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [category]);

  return { options, loading };
}
