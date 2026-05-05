'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, Shield, Activity, ChartBar as BarChart3, Clock, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import type { UserProfile } from '@/types/auth';
import { getAdminUserStats } from '@/lib/admin-users';
import { getRolesWithUserCounts, getDepartmentsWithUserCounts, listPositions } from '@/lib/admin-masterdata';
import { getAuditLogStats, listAuditLogsWithCount } from '@/lib/audit';
import type { AuditLog } from '@/types/audit';

interface AdminDashboardProps {
  profile: UserProfile;
}

interface DashboardStats {
  totalUsers: number;
  totalRoles: number;
  totalPositions: number;
  totalDepartments: number;
  totalAuditLogs: number;
}

export default function AdminDashboard({ profile }: AdminDashboardProps) {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalRoles: 0,
    totalPositions: 0,
    totalDepartments: 0,
    totalAuditLogs: 0,
  });
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      setIsLoading(true);
      setError(null);

      const [userStats, roles, positions, depts, auditStats, auditLogs] = await Promise.all([
        getAdminUserStats(),
        getRolesWithUserCounts(),
        listPositions(),
        getDepartmentsWithUserCounts(),
        getAuditLogStats(),
        listAuditLogsWithCount({ limit: 5, offset: 0 }),
      ]);

      setStats({
        totalUsers: userStats.total_count,
        totalRoles: roles.length,
        totalPositions: positions.length,
        totalDepartments: depts.length,
        totalAuditLogs: auditStats.total_count,
      });

      setRecentLogs(auditLogs.logs);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h2 className="text-2xl font-bold text-[#0F1F3A]">Welcome, {profile.full_name}</h2>
        <p className="text-sm text-[#40527A] mt-1">
          Monitor users, master data, and system activity from one place.
        </p>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-[4px] p-4">
          <p className="text-xs text-red-800">{error}</p>
        </div>
      )}

      {/* Stats Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-[4px] border border-[#D8E2FF] p-5">
              <div className="h-4 bg-[#E5EAFF] rounded w-24 mb-4 animate-pulse" />
              <div className="h-6 bg-[#E5EAFF] rounded w-16 animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Total Users */}
          <Link
            href="/admin/users"
            className="bg-white rounded-[4px] border border-[#D8E2FF] p-5 hover:border-[#1E4BFF] hover:shadow-md transition"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-[4px] bg-blue-50 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <p className="text-xs text-[#40527A] font-medium">Total Users</p>
            <p className="text-2xl font-bold text-[#0F1F3A] mt-2">{stats.totalUsers}</p>
          </Link>

          {/* Total Roles */}
          <Link
            href="/admin/roles"
            className="bg-white rounded-[4px] border border-[#D8E2FF] p-5 hover:border-[#1E4BFF] hover:shadow-md transition"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-[4px] bg-orange-50 flex items-center justify-center">
                <Shield className="w-5 h-5 text-orange-600" />
              </div>
            </div>
            <p className="text-xs text-[#40527A] font-medium">Roles</p>
            <p className="text-2xl font-bold text-[#0F1F3A] mt-2">{stats.totalRoles}</p>
          </Link>

          {/* Total Positions */}
          <Link
            href="/admin/positions"
            className="bg-white rounded-[4px] border border-[#D8E2FF] p-5 hover:border-[#1E4BFF] hover:shadow-md transition"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-[4px] bg-amber-50 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-amber-600" />
              </div>
            </div>
            <p className="text-xs text-[#40527A] font-medium">Positions</p>
            <p className="text-2xl font-bold text-[#0F1F3A] mt-2">{stats.totalPositions}</p>
          </Link>

          {/* Total Departments */}
          <Link
            href="/admin/departments"
            className="bg-white rounded-[4px] border border-[#D8E2FF] p-5 hover:border-[#1E4BFF] hover:shadow-md transition"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-[4px] bg-emerald-50 flex items-center justify-center">
                <Activity className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
            <p className="text-xs text-[#40527A] font-medium">Departments</p>
            <p className="text-2xl font-bold text-[#0F1F3A] mt-2">{stats.totalDepartments}</p>
          </Link>

          {/* Total Audit Logs */}
          <Link
            href="/admin/audit"
            className="bg-white rounded-[4px] border border-[#D8E2FF] p-5 hover:border-[#1E4BFF] hover:shadow-md transition"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-[4px] bg-violet-50 flex items-center justify-center">
                <Clock className="w-5 h-5 text-violet-600" />
              </div>
            </div>
            <p className="text-xs text-[#40527A] font-medium">Audit Logs</p>
            <p className="text-2xl font-bold text-[#0F1F3A] mt-2">{stats.totalAuditLogs}</p>
          </Link>
        </div>
      )}

      {/* Recent Activity */}
      <div className="bg-white rounded-[4px] border border-[#D8E2FF] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[#0F1F3A]">Recent Activity</h3>
          <Link href="/admin/audit" className="text-xs text-[#1E4BFF] font-medium hover:underline flex items-center gap-1">
            View All
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {recentLogs.length === 0 ? (
          <p className="text-xs text-[#40527A]">No recent activity</p>
        ) : (
          <div className="space-y-3">
            {recentLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 pb-3 border-b border-[#E5EAFF] last:border-b-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-[#40527A]">
                      {log.created_at ? format(new Date(log.created_at), 'HH:mm:ss') : 'N/A'}
                    </span>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                      {log.action}
                    </span>
                  </div>
                  <p className="text-xs text-[#40527A]">
                    <span className="font-medium">{log.document_type || '—'}</span>
                    {log.document_id && (
                      <>
                        {' '} · <span className="font-mono">{log.document_id.substring(0, 8)}...</span>
                      </>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
