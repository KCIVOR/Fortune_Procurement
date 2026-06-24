'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, Shield, Activity, ChartBar as BarChart3, Clock, ArrowRight, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { StatCard } from '@/components/shared/StatCard';
import { KPI_GRID_CLASS } from '@/components/shared/kpi-grid';
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
        <h2 className="text-2xl font-bold text-pq-neutral-900">Welcome, {profile.full_name}</h2>
        <p className="text-sm text-pq-neutral-500 mt-1">
          Monitor users, master data, and system activity from one place.
        </p>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4">
          <p className="text-xs text-pq-danger-600">{error}</p>
        </div>
      )}

      {/* Stats Grid */}
      <div className={KPI_GRID_CLASS}>
        {/* Total Users */}
        <Link href="/admin/users" className="block w-full min-w-0 transition hover:-translate-y-0.5">
          <StatCard
            label="Total Users"
            value={stats.totalUsers}
            icon={<Users className="w-5 h-5 text-pq-primary-600" />}
            isLoading={isLoading}
            accent="blue"
          />
        </Link>

        {/* Total Roles */}
        <Link href="/admin/roles" className="block w-full min-w-0 transition hover:-translate-y-0.5">
          <StatCard
            label="Roles"
            value={stats.totalRoles}
            icon={<Shield className="w-5 h-5 text-orange-600" />}
            isLoading={isLoading}
            accent="amber"
          />
        </Link>

        {/* Total Positions */}
        <Link href="/admin/positions" className="block w-full min-w-0 transition hover:-translate-y-0.5">
          <StatCard
            label="Positions"
            value={stats.totalPositions}
            icon={<BarChart3 className="w-5 h-5 text-pq-warning-600" />}
            isLoading={isLoading}
            accent="amber"
          />
        </Link>

        {/* Total Departments */}
        <Link href="/admin/departments" className="block w-full min-w-0 transition hover:-translate-y-0.5">
          <StatCard
            label="Departments"
            value={stats.totalDepartments}
            icon={<Activity className="w-5 h-5 text-pq-success-600" />}
            isLoading={isLoading}
            accent="green"
          />
        </Link>

        {/* Total Audit Logs */}
        <Link href="/admin/audit" className="block w-full min-w-0 transition hover:-translate-y-0.5">
          <StatCard
            label="Audit Logs"
            value={stats.totalAuditLogs}
            icon={<Clock className="w-5 h-5 text-violet-600" />}
            isLoading={isLoading}
            accent="blue"
          />
        </Link>

        {/* System Settings */}
        <Link href="/admin/settings" className="block w-full min-w-0 transition hover:-translate-y-0.5">
          <StatCard
            label="System Settings"
            value="Config"
            icon={<Settings className="w-5 h-5 text-pq-neutral-500" />}
            isLoading={false}
            accent="blue"
          />
        </Link>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-md border border-pq-neutral-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-pq-neutral-900">Recent Activity</h3>
          <Link href="/admin/audit" className="text-xs text-pq-primary-600 font-medium hover:underline flex items-center gap-1">
            View All
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {recentLogs.length === 0 ? (
          <p className="text-xs text-pq-neutral-500">No recent activity</p>
        ) : (
          <div className="space-y-3">
            {recentLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 pb-3 border-b border-pq-neutral-200 last:border-b-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-pq-neutral-500">
                      {log.created_at ? format(new Date(log.created_at), 'HH:mm:ss') : 'N/A'}
                    </span>
                    <span className="px-2 py-0.5 bg-pq-primary-50 text-pq-primary-700 rounded text-xs font-medium">
                      {log.action}
                    </span>
                  </div>
                  <p className="text-xs text-pq-neutral-500">
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
