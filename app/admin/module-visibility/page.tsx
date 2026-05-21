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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ROLE_NAV, ALL_NAV } from '@/config/navigation';
import type { AppRole } from '@/types/auth';
import { listPositions, listRoles } from '@/lib/admin-masterdata';
import {
  fetchAllModuleVisibilityRulesForRole,
  fetchAddedModulesForPosition,
  getEffectiveModuleVisibility,
  getRoleDefaultVisibility,
  saveModuleVisibilityRules,
  saveAddedModulesForPosition,
  type AddedModuleRule,
} from '@/lib/module-visibility';
import { cn } from '@/lib/utils';
import { Plus, X } from 'lucide-react';

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
  const [addedModules, setAddedModules] = useState<AddedModuleRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Add module dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedSourceRole, setSelectedSourceRole] = useState<string>('');
  const [selectedModulesToAdd, setSelectedModulesToAdd] = useState<string[]>([]);

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
  const isPositionScope = scope !== 'role';

  // Get available modules from other roles (for add mode)
  const availableModulesFromOtherRoles = useMemo(() => {
    if (!selectedSourceRole) return [];
    const sourceRoleName = roles.find(r => r.id === selectedSourceRole)?.name;
    if (!sourceRoleName || !isAppRole(sourceRoleName)) return [];
    
    const sourceNav = ROLE_NAV[sourceRoleName] ?? [];
    const currentModuleKeys = new Set(navItems.map(n => n.module_key));
    const alreadyAddedKeys = new Set(addedModules.map(m => m.module_key));
    
    // Filter out modules that are already in current role or already added
    return sourceNav.filter(
      item => !currentModuleKeys.has(item.module_key) && !alreadyAddedKeys.has(item.module_key)
    );
  }, [selectedSourceRole, roles, navItems, addedModules]);

  // Other roles (excluding current role and admin)
  const otherRoles = useMemo(() => {
    return roles.filter(r => r.id !== roleId && r.name !== 'admin');
  }, [roles, roleId]);

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
      setAddedModules([]);
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

        // Load added modules if position scope
        if (scope !== 'role') {
          const added = await fetchAddedModulesForPosition(roleId, scope);
          if (!cancelled) setAddedModules(added);
        } else {
          setAddedModules([]);
        }
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
      
      // Save added modules if position scope
      if (scopePositionId) {
        await saveAddedModulesForPosition(
          roleId,
          scopePositionId,
          addedModules.map(m => ({ module_key: m.module_key, source_role_id: m.source_role_id }))
        );
      }
      
      // Reload rules
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

  function handleOpenAddDialog() {
    setSelectedSourceRole('');
    setSelectedModulesToAdd([]);
    setAddDialogOpen(true);
  }

  function handleAddModules() {
    if (!selectedSourceRole || selectedModulesToAdd.length === 0) return;
    
    const newAddedModules: AddedModuleRule[] = selectedModulesToAdd.map(moduleKey => ({
      position_id: scope,
      module_key: moduleKey,
      source_role_id: selectedSourceRole,
      is_visible: true,
    }));
    
    setAddedModules(prev => [...prev, ...newAddedModules]);
    setAddDialogOpen(false);
    setSelectedSourceRole('');
    setSelectedModulesToAdd([]);
  }

  function handleRemoveAddedModule(moduleKey: string) {
    setAddedModules(prev => prev.filter(m => m.module_key !== moduleKey));
  }

  function getSourceRoleName(sourceRoleId: string): string {
    return roles.find(r => r.id === sourceRoleId)?.name ?? 'Unknown';
  }

  function getModuleLabel(moduleKey: string): string {
    const navItem = Object.values(ALL_NAV).find(n => n.module_key === moduleKey);
    return navItem?.label ?? moduleKey;
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
          <p className="text-sm text-pq-danger-600">{error}</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <PageHeader
          title="Module Visibility"
          description="Configure which sidebar links appear for each role and optional position. Positions can also have modules added from other roles."
        />

        {error && (
          <p className="text-sm text-pq-danger-600 bg-pq-danger-100 border border-pq-danger-100 rounded-md px-3 py-2">{error}</p>
        )}
        {success && (
          <p className="text-sm text-pq-success-600 bg-pq-success-100 border border-pq-success-100 rounded-md px-3 py-2">{success}</p>
        )}

        <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
          <div className="space-y-2 flex-1 min-w-[200px]">
            <label className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Role</label>
            <Select value={roleId || undefined} onValueChange={(v) => { setRoleId(v); setScope('role'); setSuccess(null); }}>
              <SelectTrigger className="bg-white border-pq-neutral-200">
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
            <label className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Position scope</label>
            <Select
              value={scope}
              onValueChange={(v) => { setScope(v); setSuccess(null); }}
              disabled={!roleId || !appRole}
            >
              <SelectTrigger className="bg-white border-pq-neutral-200">
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
            className="bg-pq-primary-600 hover:bg-pq-neutral-900 shrink-0"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>

        {!appRole && roleId && (
          <p className="text-sm text-pq-warning-600 bg-pq-warning-100 border border-amber-100 rounded-md px-3 py-2">
            Selected role name is not in app navigation mapping. Choose another role.
          </p>
        )}

        {appRole && navItems.length > 0 && (
          <div className="space-y-4">
            {/* Role's own modules */}
            <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
              <div className="px-4 py-3 bg-pq-neutral-50 border-b border-pq-neutral-200">
                <h3 className="text-sm font-semibold text-pq-neutral-700">
                  {appRole.charAt(0).toUpperCase() + appRole.slice(1)} Role Modules
                </h3>
                <p className="text-xs text-pq-neutral-500 mt-0.5">
                  Toggle visibility of modules that belong to this role
                </p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-pq-neutral-50 hover:bg-pq-neutral-50">
                    <TableHead className="text-xs font-semibold text-pq-neutral-500 w-20">Visible</TableHead>
                    <TableHead className="text-xs font-semibold text-pq-neutral-500">Label</TableHead>
                    <TableHead className="text-xs font-semibold text-pq-neutral-500">href</TableHead>
                    <TableHead className="text-xs font-semibold text-pq-neutral-500">module_key</TableHead>
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
                      <TableCell className="font-medium text-sm text-pq-neutral-900">{item.label}</TableCell>
                      <TableCell className="text-xs font-mono text-pq-neutral-500">{item.href}</TableCell>
                      <TableCell className={cn('text-xs font-mono text-pq-neutral-500')}>{item.module_key}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Added modules from other roles (only for position scope) */}
            {isPositionScope && (
              <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
                <div className="px-4 py-3 bg-blue-50 border-b border-pq-neutral-200 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-pq-neutral-700">
                      Added Modules from Other Roles
                    </h3>
                    <p className="text-xs text-pq-neutral-500 mt-0.5">
                      Modules borrowed from other roles for this specific position
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleOpenAddDialog}
                    className="gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Add Module
                  </Button>
                </div>
                
                {addedModules.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-pq-neutral-500">
                    No modules added from other roles. Click "Add Module" to borrow modules from another role.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-pq-neutral-50 hover:bg-pq-neutral-50">
                        <TableHead className="text-xs font-semibold text-pq-neutral-500">Label</TableHead>
                        <TableHead className="text-xs font-semibold text-pq-neutral-500">Source Role</TableHead>
                        <TableHead className="text-xs font-semibold text-pq-neutral-500">module_key</TableHead>
                        <TableHead className="text-xs font-semibold text-pq-neutral-500 w-20">Remove</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {addedModules.map((added) => (
                        <TableRow key={added.module_key}>
                          <TableCell className="font-medium text-sm text-pq-neutral-900">
                            {getModuleLabel(added.module_key)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {getSourceRoleName(added.source_role_id)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-mono text-pq-neutral-500">
                            {added.module_key}
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveAddedModule(added.module_key)}
                              className="h-8 w-8 p-0 text-pq-danger-600 hover:text-pq-danger-700 hover:bg-pq-danger-50"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            )}
          </div>
        )}

        <p className="text-[10px] text-pq-neutral-400 max-w-2xl">
          Role default rows use an empty position (applies when no position-specific rule exists). Position-specific rules override the role default for users assigned to that position. 
          {isPositionScope && ' You can also add modules from other roles to give this position additional capabilities.'}
        </p>
      </div>

      {/* Add Module Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Modules from Another Role</DialogTitle>
            <DialogDescription>
              Select a role and choose which modules to add to this position.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-pq-neutral-700">Source Role</label>
              <Select value={selectedSourceRole} onValueChange={(v) => { setSelectedSourceRole(v); setSelectedModulesToAdd([]); }}>
                <SelectTrigger className="bg-white border-pq-neutral-200">
                  <SelectValue placeholder="Select a role to borrow modules from" />
                </SelectTrigger>
                <SelectContent>
                  {otherRoles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedSourceRole && availableModulesFromOtherRoles.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-pq-neutral-700">Select Modules</label>
                <div className="border border-pq-neutral-200 rounded-md max-h-60 overflow-y-auto">
                  {availableModulesFromOtherRoles.map((item) => (
                    <label
                      key={item.module_key}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-pq-neutral-50 cursor-pointer border-b border-pq-neutral-100 last:border-b-0"
                    >
                      <Checkbox
                        checked={selectedModulesToAdd.includes(item.module_key)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedModulesToAdd(prev => [...prev, item.module_key]);
                          } else {
                            setSelectedModulesToAdd(prev => prev.filter(k => k !== item.module_key));
                          }
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-pq-neutral-900">{item.label}</p>
                        <p className="text-xs text-pq-neutral-500">{item.href}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {selectedSourceRole && availableModulesFromOtherRoles.length === 0 && (
              <p className="text-sm text-pq-neutral-500 text-center py-4">
                No additional modules available from this role. All modules are either already in the current role or already added.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAddModules}
              disabled={!selectedSourceRole || selectedModulesToAdd.length === 0}
              className="bg-pq-primary-600 hover:bg-pq-neutral-900"
            >
              Add {selectedModulesToAdd.length > 0 ? `(${selectedModulesToAdd.length})` : ''} Modules
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
