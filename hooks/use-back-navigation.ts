import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { getFallbackRoute } from '@/lib/utils';

interface BackNavigationOptions {
  role?: string | null;
  fallbackPath?: string;
}

export function useBackNavigation() {
  const router = useRouter();

  const handleBack = useCallback((options?: BackNavigationOptions) => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      const fallback = options?.fallbackPath || getFallbackRoute(options?.role);
      router.push(fallback);
    }
  }, [router]);

  return { handleBack };
}
