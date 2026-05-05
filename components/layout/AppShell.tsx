'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import Sidebar from './Sidebar';
import TopHeader from './TopHeader';
import LoadingState from '@/components/shared/LoadingState';

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
}

export default function AppShell({ children, title }: AppShellProps) {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (!loading && !session) {
      router.replace('/login');
    }
  }, [loading, session, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F9FC] flex items-center justify-center">
        <LoadingState message="Loading your workspace..." />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="flex min-h-screen bg-[#F7F9FC]">
      {/* Desktop sidebar — fixed/sticky on lg+, scrolls independently */}
      <div className="hidden lg:flex shrink-0 h-screen sticky top-0">
        <Sidebar isCollapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />
      </div>

      {/* Mobile sidebar overlay */}
      <div
        className={cn(
          'fixed inset-0 z-40 lg:hidden transition-opacity duration-200',
          sidebarOpen ? 'pointer-events-auto' : 'pointer-events-none'
        )}
      >
        {/* Backdrop */}
        <div
          className={cn(
            'absolute inset-0 bg-black/50 transition-opacity duration-200',
            sidebarOpen ? 'opacity-100' : 'opacity-0'
          )}
          onClick={() => setSidebarOpen(false)}
        />
        {/* Drawer */}
        <div
          className={cn(
            'absolute inset-y-0 left-0 flex transition-transform duration-200',
            sidebarOpen ? 'translate-x-0 pointer-events-auto' : '-translate-x-full pointer-events-none'
          )}
          onClick={e => e.stopPropagation()}
        >
          <Sidebar onNavigate={() => setSidebarOpen(false)} />
        </div>
      </div>

      <div className="flex flex-col flex-1 min-w-0 h-screen">
        <TopHeader title={title} onMenuToggle={() => setSidebarOpen(v => !v)} />
        <main className="flex-1 p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
