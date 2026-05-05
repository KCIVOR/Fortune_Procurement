'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FileText, PackageSearch, SquareCheck as CheckSquare, ClipboardList, SendHorizontal as SendHorizonal, ShoppingCart, PackageCheck, Tag, Replace, LogOut, ChevronRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ROLE_NAV } from '@/config/navigation';
import type { AppRole } from '@/types/auth';
import { cn } from '@/lib/utils';
import FortuneLogo from '@/logo/fortune_logo.svg';

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard,
  FileText,
  PackageSearch,
  CheckSquare,
  ClipboardList,
  SendHorizonal,
  ShoppingCart,
  PackageCheck,
  Tag,
  Replace,
};

const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Administrator',
  employee: 'Employee',
  warehouse: 'Warehouse',
  procurement: 'Procurement',
  approver: 'Approver',
  supplier: 'Supplier',
};

interface SidebarProps {
  onNavigate?: () => void;
  isCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export default function Sidebar({ onNavigate, isCollapsed = false, onCollapsedChange }: SidebarProps) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();

  if (!profile) return null;

  const navItems = ROLE_NAV[profile.role] ?? [];
  const toggleCollapse = () => onCollapsedChange?.(!isCollapsed);

  return (
    <aside className={cn(
      'flex flex-col h-screen bg-[#0F1F3A] text-white shrink-0 overflow-y-auto overflow-x-hidden transition-all duration-200',
      isCollapsed ? 'w-16' : 'w-64'
    )}>
      {/* Brand */}
      <button
        onClick={toggleCollapse}
        className={cn(
          'flex items-center h-14 border-b border-white/10 shrink-0 transition-all duration-200 hover:bg-white/5 rounded-none',
          isCollapsed ? 'px-1.5 gap-1 justify-center' : 'gap-3 px-5'
        )}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <div className="flex items-center justify-center w-9 h-9 shrink-0">
          <Image
            src={FortuneLogo}
            alt="Fortune"
            className="w-full h-full object-contain"
            priority
          />
        </div>
        {!isCollapsed && (
          <div className="min-w-0">
            <p className="text-sm font-bold text-white leading-tight truncate">Fortune</p>
            <p className="text-xs text-[#BFC7D5] leading-tight">Procurement System</p>
          </div>
        )}
      </button>

      {/* Navigation */}
      <nav className={cn(
        'flex-1 py-4 space-y-0.5 overflow-y-auto transition-all duration-200',
        isCollapsed ? 'px-1.5' : 'px-3'
      )}>
        {navItems.map((item) => {
          const Icon = ICON_MAP[item.icon] ?? LayoutDashboard;
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-[4px] text-sm font-medium transition-all group',
                isCollapsed && 'justify-center px-2',
                isActive
                  ? 'bg-[#1E4BFF] text-white'
                  : 'text-[#BFC7D5] hover:text-white hover:bg-white/10'
              )}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-white' : 'text-[#BFC7D5] group-hover:text-white')} />
              {!isCollapsed && (
                <>
                  <span className="truncate">{item.label}</span>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto text-white/60" />}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className={cn(
        'border-t border-white/10 transition-all duration-200',
        isCollapsed ? 'px-1.5 py-2' : 'p-4'
      )}>
        <div className={cn(
          'flex items-center gap-3 transition-all duration-200',
          isCollapsed ? 'justify-center mb-2' : 'mb-3'
        )}>
          <div className="w-8 h-8 rounded-[4px] bg-white/10 flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-[#BFC7D5]">
              {profile.full_name.charAt(0).toUpperCase()}
            </span>
          </div>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate">{profile.full_name}</p>
              <p className="text-xs text-[#BFC7D5] truncate">{ROLE_LABELS[profile.role]}</p>
            </div>
          )}
        </div>
        <button
          onClick={signOut}
          className={cn(
            'flex items-center gap-2 rounded-[4px] text-sm text-[#BFC7D5] hover:text-white hover:bg-white/10 transition',
            isCollapsed ? 'justify-center px-2 py-2 w-full' : 'w-full px-3 py-2'
          )}
          title={isCollapsed ? 'Sign out' : undefined}
        >
          <LogOut className="w-4 h-4" />
          {!isCollapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  );
}
