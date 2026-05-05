'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import LoadingState from '@/components/shared/LoadingState';

export default function RootPage() {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      router.replace(session ? '/dashboard' : '/login');
    }
  }, [loading, session, router]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <LoadingState message="Loading..." />
    </div>
  );
}
