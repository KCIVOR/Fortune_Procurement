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
    <header className="sticky top-0 z-30 h-14 bg-white border-b border-[#D8E2FF] px-4 lg:px-6 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        {/* Mobile hamburger — only visible below lg */}
        <button
          type="button"
          onClick={onMenuToggle}
          className="lg:hidden flex items-center justify-center w-8 h-8 rounded-[4px] text-[#40527A] hover:text-[#0F1F3A] hover:bg-[#F7F9FC] transition"
          aria-label="Open navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
        {title && (
          <h1 className="text-sm font-semibold text-[#0F1F3A]">{title}</h1>
        )}
      </div>

      {profile && (
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#40527A]">
            <Building2 className="w-3.5 h-3.5 text-[#BFC7D5]" />
            <span>{profile.department}</span>
          </div>
          <div className="hidden sm:block w-px h-4 bg-[#D8E2FF]" />
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#40527A]">
            <Briefcase className="w-3.5 h-3.5 text-[#BFC7D5]" />
            <span>{profile.position}</span>
          </div>
          <div className="hidden sm:block w-px h-4 bg-[#D8E2FF]" />
          <NotificationBell />
          <div className="hidden sm:block w-px h-4 bg-[#D8E2FF]" />
          <Link 
            href="/bugtrack" 
            className="flex items-center justify-center w-8 h-8 rounded-[4px] text-[#40527A] hover:text-[#1E4BFF] hover:bg-[#F7F9FC] transition relative group"
            title="Bug Track"
          >
            <Bug className="w-5 h-5" />
            <span className="absolute -bottom-8 scale-0 transition-all rounded bg-gray-800 p-2 text-xs text-white group-hover:scale-100 whitespace-nowrap">Bug Track</span>
          </Link>
          <div className="hidden sm:block w-px h-4 bg-[#D8E2FF]" />
          <Link href="/profile" className="flex items-center gap-2 group" aria-label="My Profile">
            <div className="w-7 h-7 rounded-[4px] bg-[#1E4BFF] group-hover:bg-[#0F1F3A] transition flex items-center justify-center shrink-0">
              <span className="text-xs font-semibold text-white">
                {profile.full_name.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="hidden sm:block text-sm font-medium text-[#0F1F3A] group-hover:text-[#1E4BFF] transition">{profile.full_name}</span>
          </Link>
        </div>
      )}
    </header>
  );
}
