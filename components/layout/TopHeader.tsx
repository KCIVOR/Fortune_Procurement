'use client';

import Link from 'next/link';
import { Building2, Briefcase, Menu, Bug } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import NotificationBell from '@/components/layout/NotificationBell';

interface TopHeaderProps {
  title?: string;
  onMenuToggle?: () => void;
}

export default function TopHeader({ title, onMenuToggle }: TopHeaderProps) {
  const { profile } = useAuth();

  return (
    <header className="sticky top-0 z-30 h-14 bg-white border-b border-pq-neutral-200 px-4 lg:px-6 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        {/* Mobile hamburger — only visible below lg */}
        <button
          type="button"
          onClick={onMenuToggle}
          className="lg:hidden flex items-center justify-center w-8 h-8 rounded-md text-pq-neutral-500 hover:text-pq-neutral-900 hover:bg-pq-neutral-50 transition"
          aria-label="Open navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
        {title && (
          <h1 className="text-sm font-semibold text-pq-neutral-900">{title}</h1>
        )}
      </div>

      {profile && (
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-pq-neutral-500">
            <Building2 className="w-3.5 h-3.5 text-pq-neutral-400" />
            <span>{profile.department}</span>
          </div>
          <div className="hidden sm:block w-px h-4 bg-pq-neutral-200" />
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-pq-neutral-500">
            <Briefcase className="w-3.5 h-3.5 text-pq-neutral-400" />
            <span>{profile.position}</span>
          </div>
          <div className="hidden sm:block w-px h-4 bg-pq-neutral-200" />
          <NotificationBell />
          <div className="hidden sm:block w-px h-4 bg-pq-neutral-200" />
          <Link 
            href="/bugtrack" 
            className="flex items-center justify-center w-8 h-8 rounded-md text-pq-neutral-500 hover:text-pq-primary-600 hover:bg-pq-neutral-50 transition relative group"
            title="Bug Track"
          >
            <Bug className="w-5 h-5" />
            <span className="absolute -bottom-8 scale-0 transition-all rounded bg-gray-800 p-2 text-xs text-white group-hover:scale-100 whitespace-nowrap">Bug Track</span>
          </Link>
          <div className="hidden sm:block w-px h-4 bg-pq-neutral-200" />
          <Link href="/profile" className="flex items-center gap-2 group" aria-label="My Profile">
            <div className="w-7 h-7 rounded-md bg-pq-primary-600 group-hover:bg-pq-neutral-900 transition flex items-center justify-center shrink-0">
              <span className="text-xs font-semibold text-white">
                {profile.full_name.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="hidden sm:block text-sm font-medium text-pq-neutral-900 group-hover:text-pq-primary-600 transition">{profile.full_name}</span>
          </Link>
        </div>
      )}
    </header>
  );
}
