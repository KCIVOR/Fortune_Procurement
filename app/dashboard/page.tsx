'use client';

import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/context/AuthContext';
import EmployeeDashboard from '@/components/dashboards/EmployeeDashboard';
import WarehouseDashboard from '@/components/dashboards/WarehouseDashboard';
import ProcurementDashboard from '@/components/dashboards/ProcurementDashboard';
import ApproverDashboard from '@/components/dashboards/ApproverDashboard';
import SupplierDashboard from '@/components/dashboards/SupplierDashboard';
import AdminDashboard from '@/components/dashboards/AdminDashboard';
import LoadingState from '@/components/shared/LoadingState';

export default function DashboardPage() {
  const { profile, loading } = useAuth();

  const renderDashboard = () => {
    if (loading || !profile) {
      return (
        <div className="flex items-center justify-center h-64">
          <LoadingState message="Loading dashboard..." />
        </div>
      );
    }

    switch (profile.role) {
      case 'admin':       return <AdminDashboard profile={profile} />;
      case 'employee':    return <EmployeeDashboard profile={profile} />;
      case 'warehouse':   return <WarehouseDashboard profile={profile} />;
      case 'procurement': return <ProcurementDashboard profile={profile} />;
      case 'approver':    return <ApproverDashboard profile={profile} />;
      case 'supplier':    return <SupplierDashboard profile={profile} />;
      default:            return null;
    }
  };

  return (
    <AppShell title="Dashboard">
      {renderDashboard()}
    </AppShell>
  );
}
