'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import LoadingState from '@/components/shared/LoadingState';

export default function RootPage() {
  const { session, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!session) {
        router.replace('/login');
        return;
      }
      if (profile?.role === 'tsqa') {
        router.replace('/tsqa');
        return;
      }
      router.replace('/dashboard');
    }
  }, [loading, session, profile, router]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <LoadingState message="Loading..." />
    </div>
  );
}
