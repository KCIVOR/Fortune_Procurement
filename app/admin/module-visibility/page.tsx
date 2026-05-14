'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ROLE_NAV } from '@/config/navigation';
import type { AppRole } from '@/types/auth';
import { listPositions, listRoles } from '@/lib/admin-masterdata';
import {
  fetchAllModuleVisibilityRulesForRole,
  getEffectiveModuleVisibility,
  getRoleDefaultVisibility,
  saveModuleVisibilityRules,
} from '@/lib/module-visibility';
import { cn } from '@/lib/utils';

const APP_ROLES: AppRole[] = [
  'admin',
  'employee',
  'warehouse',
  'procurement',
  'approver',
  'supplier',
  'tsqa',
];

function isAppRole(name: string): name is AppRole {
  return APP_ROLES.includes(name as AppRole);
}

export default function ModuleVisibilityPage() {
  const { profile, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);
  const [positions, setPositions] = useState<Array<{ id: string; title: string; role_id: string | null; active: boolean }>>([]);
  const [roleId, setRoleId] = useState<string>('');
  const [scope, setScope] = useState<string>('role'); // 'role' | position uuid
  const [toggleMap, setToggleMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedRoleName = roles.find((r) => r.id === roleId)?.name;
  const appRole = selectedRoleName && isAppRole(selectedRoleName) ? selectedRoleName : null;
  const navItems = useMemo(() => {
    if (!appRole) return [];
    return ROLE_NAV[appRole] ?? [];
  }, [appRole]);

  const positionsForRole = useMemo(
    () =>
      positions.filter((p) => p.role_id === roleId && p.active !== false),
    [positions, roleId],
  );

  const scopePositionId = scope === 'role' ? null : scope;

  useEffect(() => {
    if (authLoading) return;
    if (!profile) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }
    if (profile.role !== 'admin') {
      setError('Access denied. Admin role required.');
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [r, p] = await Promise.all([listRoles(), listPositions()]);
        setRoles(r.map((x) => ({ id: x.id, name: x.name })));
        setPositions(
          p.map((x) => ({
            id: x.id,
            title: x.title,
            role_id: x.role_id,
            active: x.active,
          })),
        );
        const firstNonAdmin = r.find((x) => x.name !== 'admin');
        if (firstNonAdmin) setRoleId(firstNonAdmin.id);
      } catch (e) {
        console.error(e);
        setError('Failed to load roles or positions');
      } finally {
        setLoading(false);
      }
    })();
  }, [authLoading, profile]);

  useEffect(() => {
    if (!roleId || !appRole) {
      setToggleMap({});
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const allRules = await fetchAllModuleVisibilityRulesForRole(roleId);
        if (cancelled) return;
        const next: Record<string, boolean> = {};
        for (const item of navItems) {
          if (scope === 'role') {
            next[item.module_key] = getRoleDefaultVisibility(item.module_key, allRules);
          } else {
            next[item.module_key] = getEffectiveModuleVisibility(item.module_key, allRules, scope);
          }
        }
        setToggleMap(next);
      } catch (e) {
        console.error(e);
        if (!cancelled) setError('Failed to load visibility rules');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roleId, appRole, scope, navItems]);

  async function handleSave() {
    if (!roleId || !appRole) return;
    setSaving(true);
    setSuccess(null);
    setError(null);
    try {
      const keys = navItems.map((i) => i.module_key);
      await saveModuleVisibilityRules(roleId, scopePositionId, toggleMap, keys);
      const allRules = await fetchAllModuleVisibilityRulesForRole(roleId);
      const next: Record<string, boolean> = {};
      for (const item of navItems) {
        if (scope === 'role') {
          next[item.module_key] = getRoleDefaultVisibility(item.module_key, allRules);
        } else {
          next[item.module_key] = getEffectiveModuleVisibility(item.module_key, allRules, scope);
        }
      }
      setToggleMap(next);
      setSuccess('Saved module visibility.');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || (loading && !error)) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[50vh]">
          <LoadingState message="Loading…" />
        </div>
      </AppShell>
    );
  }

  if (error && !roleId && profile?.role !== 'admin') {
    return (
      <AppShell>
        <div className="p-6">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <PageHeader
          title="Module Visibility"
          description="Configure which sidebar links appear for each role and optional position. This controls sidebar visibility only — it does not change route or data permissions."
        />

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-[4px] px-3 py-2">{error}</p>
        )}
        {success && (
          <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-[4px] px-3 py-2">{success}</p>
        )}

        <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
          <div className="space-y-2 flex-1 min-w-[200px]">
            <label className="text-xs font-semibold text-[#40527A] uppercase tracking-wide">Role</label>
            <Select value={roleId || undefined} onValueChange={(v) => { setRoleId(v); setScope('role'); setSuccess(null); }}>
              <SelectTrigger className="bg-white border-[#D8E2FF]">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 flex-1 min-w-[200px]">
            <label className="text-xs font-semibold text-[#40527A] uppercase tracking-wide">Position scope</label>
            <Select
              value={scope}
              onValueChange={(v) => { setScope(v); setSuccess(null); }}
              disabled={!roleId || !appRole}
            >
              <SelectTrigger className="bg-white border-[#D8E2FF]">
                <SelectValue placeholder="Role default or position" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="role">Role default (all positions)</SelectItem>
                {positionsForRole.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || !roleId || !appRole}
            className="bg-[#1E4BFF] hover:bg-[#0F1F3A] shrink-0"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>

        {!appRole && roleId && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-[4px] px-3 py-2">
            Selected role name is not in app navigation mapping. Choose another role.
          </p>
        )}

        {appRole && navItems.length > 0 && (
          <div className="bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#F7F9FC] hover:bg-[#F7F9FC]">
                  <TableHead className="text-xs font-semibold text-[#40527A]">Visible</TableHead>
                  <TableHead className="text-xs font-semibold text-[#40527A]">Label</TableHead>
                  <TableHead className="text-xs font-semibold text-[#40527A]">href</TableHead>
                  <TableHead className="text-xs font-semibold text-[#40527A]">module_key</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {navItems.map((item) => (
                  <TableRow key={`${item.module_key}-${item.href}`}>
                    <TableCell>
                      <Switch
                        checked={toggleMap[item.module_key] !== false}
                        onCheckedChange={(checked) => {
                          setToggleMap((prev) => ({
                            ...prev,
                            [item.module_key]: checked,
                          }));
                        }}
                        disabled={saving}
                        aria-label={`Toggle ${item.label}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-sm text-[#0F1F3A]">{item.label}</TableCell>
                    <TableCell className="text-xs font-mono text-[#40527A]">{item.href}</TableCell>
                    <TableCell className={cn('text-xs font-mono text-[#40527A]')}>{item.module_key}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <p className="text-[10px] text-[#BFC7D5] max-w-2xl">
          Role default rows use an empty position (applies when no position-specific rule exists). Position-specific rules override the role default for users assigned to that position. If no rule exists for a module, it stays visible. Removing a rule (by setting visible again at role default) restores the default.
        </p>
      </div>
    </AppShell>
  );
}
