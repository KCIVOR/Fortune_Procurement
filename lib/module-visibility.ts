import { supabase, db } from './supabase';
import type { ModuleKey, NavItem } from '@/config/navigation';
import { ALL_NAV } from '@/config/navigation';

export interface ModuleVisibilityRule {
  role_id: string;
  position_id: string | null;
  module_key: string;
  is_visible: boolean;
  source_role_id?: string | null; // When set, module is "borrowed" from another role
}

/** Added module rule - for modules borrowed from other roles */
export interface AddedModuleRule {
  position_id: string;
  module_key: string;
  source_role_id: string;
  is_visible: boolean;
}

const visibilityRulesCache = new Map<string, ModuleVisibilityRule[]>();
const visibilityRulesInflight = new Map<string, Promise<ModuleVisibilityRule[]>>();

function moduleVisibilityCacheKey(userId: string, roleId: string, positionId: string | null) {
  return `${userId}:${roleId}:${positionId ?? ''}`;
}

/**
 * Clear the visibility rules cache - useful after admin makes changes
 */
export function clearModuleVisibilityCache() {
  visibilityRulesCache.clear();
}

/**
 * Same rows as fetchModuleVisibilityRules, deduped per user+role+position so Sidebar and
 * dashboards do not each trigger a separate network round-trip.
 */
export function loadModuleVisibilityRules(
  userId: string,
  roleId: string,
  positionId: string | null,
): Promise<ModuleVisibilityRule[]> {
  const key = moduleVisibilityCacheKey(userId, roleId, positionId);
  const cached = visibilityRulesCache.get(key);
  if (cached !== undefined) return Promise.resolve(cached);

  let inflight = visibilityRulesInflight.get(key);
  if (!inflight) {
    inflight = fetchModuleVisibilityRules(roleId, positionId)
      .then((rows) => {
        visibilityRulesCache.set(key, rows);
        visibilityRulesInflight.delete(key);
        return rows;
      })
      .catch((err) => {
        visibilityRulesInflight.delete(key);
        throw err;
      });
    visibilityRulesInflight.set(key, inflight);
  }
  return inflight;
}

/** 
 * Sidebar: rules that apply to this user's role (and optional position override rows).
 * Now also fetches "added" modules from other roles for the position.
 */
export async function fetchModuleVisibilityRules(
  roleId: string,
  positionId: string | null,
): Promise<ModuleVisibilityRule[]> {
  // Fetch rules for the user's own role
  let q = supabase
    .from('role_position_module_visibility')
    .select('role_id, position_id, module_key, is_visible, source_role_id')
    .eq('role_id', roleId)
    .is('source_role_id', null); // Own role's modules only

  if (positionId) {
    q = q.or(`position_id.is.null,position_id.eq.${positionId}`);
  } else {
    q = q.is('position_id', null);
  }

  const { data: ownRules, error: ownError } = await q;
  if (ownError) {
    console.error('fetchModuleVisibilityRules (own)', ownError);
    throw ownError;
  }

  // If user has a position, also fetch "added" modules from other roles
  let addedRules: ModuleVisibilityRule[] = [];
  if (positionId) {
    const { data: added, error: addedError } = await supabase
      .from('role_position_module_visibility')
      .select('role_id, position_id, module_key, is_visible, source_role_id')
      .eq('role_id', roleId)
      .eq('position_id', positionId)
      .not('source_role_id', 'is', null); // Added modules from other roles

    if (addedError) {
      console.error('fetchModuleVisibilityRules (added)', addedError);
      // Don't throw - added modules are optional enhancement
    } else {
      addedRules = (added || []) as ModuleVisibilityRule[];
    }
  }

  return [...(ownRules || []), ...addedRules] as ModuleVisibilityRule[];
}

/** Admin: all visibility rows for a role (role-wide + every position override + added modules). */
export async function fetchAllModuleVisibilityRulesForRole(roleId: string): Promise<ModuleVisibilityRule[]> {
  const { data, error } = await supabase
    .from('role_position_module_visibility')
    .select('role_id, position_id, module_key, is_visible, source_role_id')
    .eq('role_id', roleId);

  if (error) {
    console.error('fetchAllModuleVisibilityRulesForRole', error);
    throw error;
  }
  return (data || []) as ModuleVisibilityRule[];
}

/** Fetch added modules for a specific position (modules borrowed from other roles) */
export async function fetchAddedModulesForPosition(
  roleId: string,
  positionId: string,
): Promise<AddedModuleRule[]> {
  const { data, error } = await supabase
    .from('role_position_module_visibility')
    .select('position_id, module_key, source_role_id, is_visible')
    .eq('role_id', roleId)
    .eq('position_id', positionId)
    .not('source_role_id', 'is', null);

  if (error) {
    console.error('fetchAddedModulesForPosition', error);
    throw error;
  }
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data || []) as any[]).map(row => ({
    position_id: row.position_id as string,
    module_key: row.module_key as string,
    source_role_id: row.source_role_id as string,
    is_visible: row.is_visible as boolean,
  }));
}

export function getRoleDefaultVisibility(moduleKey: string, rules: ModuleVisibilityRule[]): boolean {
  const rr = rules.find((r) => r.module_key === moduleKey && r.position_id === null && !r.source_role_id);
  if (rr) return rr.is_visible;
  return true;
}

export function getEffectiveModuleVisibility(
  moduleKey: string,
  rules: ModuleVisibilityRule[],
  userPositionId: string | null,
): boolean {
  if (userPositionId) {
    // Check position-specific rule (own role's modules)
    const pr = rules.find((r) => r.module_key === moduleKey && r.position_id === userPositionId && !r.source_role_id);
    if (pr) return pr.is_visible;
  }
  return getRoleDefaultVisibility(moduleKey, rules);
}

/** Check if a module is added from another role for this position */
export function isAddedModule(
  moduleKey: string,
  rules: ModuleVisibilityRule[],
  userPositionId: string | null,
): boolean {
  if (!userPositionId) return false;
  return rules.some(
    (r) => r.module_key === moduleKey && r.position_id === userPositionId && r.source_role_id && r.is_visible
  );
}

/** Get all added modules for a position */
export function getAddedModules(
  rules: ModuleVisibilityRule[],
  userPositionId: string | null,
): ModuleVisibilityRule[] {
  if (!userPositionId) return [];
  return rules.filter((r) => r.position_id === userPositionId && r.source_role_id && r.is_visible);
}

/** Alias for dashboards and UI — same resolution as sidebar. */
export function isModuleVisible(
  moduleKey: ModuleKey | string,
  rules: ModuleVisibilityRule[],
  userPositionId: string | null,
): boolean {
  // Check if it's an added module first
  if (isAddedModule(moduleKey, rules, userPositionId)) {
    return true;
  }
  return getEffectiveModuleVisibility(moduleKey, rules, userPositionId);
}

/**
 * Resolve visible modules for sidebar navigation.
 * Now supports "add mode" - positions can have modules from other roles added.
 * Borrowed items honor an optional `insertAfter` anchor on the NavItem; when the
 * anchor module_key is present in the host role's visible items, the borrowed
 * item is placed immediately after it. Otherwise it falls back to the end.
 */
export function resolveVisibleModules(
  navItems: NavItem[],
  rules: ModuleVisibilityRule[],
  userPositionId: string | null,
): NavItem[] {
  // Start with base role's visible modules
  const visibleFromRole = navItems.filter((item) =>
    getEffectiveModuleVisibility(item.module_key, rules, userPositionId)
  );

  // Get added modules from other roles
  const addedModuleRules = getAddedModules(rules, userPositionId);

  // Resolve added rules to NavItem definitions, deduped against the host role's items
  const addedNavItems: NavItem[] = [];
  for (const rule of addedModuleRules) {
    const navEntry = Object.values(ALL_NAV).find(nav => nav.module_key === rule.module_key);
    if (!navEntry) continue;
    if (visibleFromRole.some(v => v.module_key === rule.module_key)) continue;
    if (addedNavItems.some(v => v.module_key === rule.module_key)) continue;
    addedNavItems.push(navEntry);
  }

  // Place each borrowed item after its anchor when possible; otherwise queue for the tail
  const result: NavItem[] = [...visibleFromRole];
  const tail: NavItem[] = [];
  for (const item of addedNavItems) {
    const anchor = item.insertAfter;
    const anchorIdx = anchor
      ? result.findIndex(v => v.module_key === anchor)
      : -1;
    if (anchorIdx >= 0) {
      result.splice(anchorIdx + 1, 0, item);
    } else {
      tail.push(item);
    }
  }
  return [...result, ...tail];
}

/**
 * Persist admin toggles for one scope (role default or a specific position).
 * Role default: hidden = row with position_id null and is_visible false; visible = delete that row.
 * Position: store override only when different from current role default at save time.
 */
export async function saveModuleVisibilityRules(
  roleId: string,
  scopePositionId: string | null,
  desiredVisible: Record<string, boolean>,
  moduleKeys: string[],
): Promise<void> {
  const allRules = await fetchAllModuleVisibilityRulesForRole(roleId);

  for (const key of moduleKeys) {
    const want = desiredVisible[key] !== false;

    if (scopePositionId === null) {
      if (want) {
        const { error } = await db.from('role_position_module_visibility')
          .delete()
          .eq('role_id', roleId)
          .eq('module_key', key)
          .is('position_id', null)
          .is('source_role_id', null);
        if (error) throw new Error(error.message);
      } else {
        const existing = allRules.find((r) => r.module_key === key && r.position_id === null && !r.source_role_id);
        if (existing) {
          const { error } = await db.from('role_position_module_visibility')
            .update({ is_visible: false, updated_at: new Date().toISOString() })
            .eq('role_id', roleId)
            .eq('module_key', key)
            .is('position_id', null)
            .is('source_role_id', null);
          if (error) throw new Error(error.message);
        } else {
          const { error } = await db.from('role_position_module_visibility').insert({
            role_id: roleId,
            position_id: null,
            module_key: key,
            is_visible: false,
            source_role_id: null,
          });
          if (error) throw new Error(error.message);
        }
      }
    } else {
      const base = getRoleDefaultVisibility(key, allRules);
      const posRow = allRules.find((r) => r.module_key === key && r.position_id === scopePositionId && !r.source_role_id);

      if (want === base) {
        const { error } = await db.from('role_position_module_visibility')
          .delete()
          .eq('role_id', roleId)
          .eq('module_key', key)
          .eq('position_id', scopePositionId)
          .is('source_role_id', null);
        if (error) throw new Error(error.message);
      } else if (posRow) {
        const { error } = await db.from('role_position_module_visibility')
          .update({ is_visible: want, updated_at: new Date().toISOString() })
          .eq('role_id', roleId)
          .eq('module_key', key)
          .eq('position_id', scopePositionId)
          .is('source_role_id', null);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await db.from('role_position_module_visibility').insert({
          role_id: roleId,
          position_id: scopePositionId,
          module_key: key,
          is_visible: want,
          source_role_id: null,
        });
        if (error) throw new Error(error.message);
      }
    }
  }
  
  // Clear cache after saving
  clearModuleVisibilityCache();
}

/**
 * Add a module from another role to a specific position.
 * This is the "add mode" feature - allows positions to have modules from other roles.
 */
export async function addModuleFromOtherRole(
  roleId: string,
  positionId: string,
  moduleKey: string,
  sourceRoleId: string,
): Promise<void> {
  // Check if already exists
  const { data: existing } = await supabase
    .from('role_position_module_visibility')
    .select('id')
    .eq('role_id', roleId)
    .eq('position_id', positionId)
    .eq('module_key', moduleKey)
    .eq('source_role_id', sourceRoleId)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingRow = existing as any;
  
  if (existingRow?.id) {
    // Update to visible
    const { error } = await db.from('role_position_module_visibility')
      .update({ is_visible: true, updated_at: new Date().toISOString() })
      .eq('id', existingRow.id);
    if (error) throw new Error(error.message);
  } else {
    // Insert new
    const { error } = await db.from('role_position_module_visibility').insert({
      role_id: roleId,
      position_id: positionId,
      module_key: moduleKey,
      source_role_id: sourceRoleId,
      is_visible: true,
    });
    if (error) throw new Error(error.message);
  }
  
  clearModuleVisibilityCache();
}

/**
 * Remove an added module from a position.
 */
export async function removeAddedModule(
  roleId: string,
  positionId: string,
  moduleKey: string,
  sourceRoleId: string,
): Promise<void> {
  const { error } = await db.from('role_position_module_visibility')
    .delete()
    .eq('role_id', roleId)
    .eq('position_id', positionId)
    .eq('module_key', moduleKey)
    .eq('source_role_id', sourceRoleId);
  
  if (error) throw new Error(error.message);
  
  clearModuleVisibilityCache();
}

/**
 * Save added modules for a position (bulk operation).
 * Replaces all added modules for the position with the new set.
 */
export async function saveAddedModulesForPosition(
  roleId: string,
  positionId: string,
  addedModules: Array<{ module_key: string; source_role_id: string }>,
): Promise<void> {
  // Delete all existing added modules for this position
  const { error: deleteError } = await db.from('role_position_module_visibility')
    .delete()
    .eq('role_id', roleId)
    .eq('position_id', positionId)
    .not('source_role_id', 'is', null);
  
  if (deleteError) throw new Error(deleteError.message);

  // Insert new added modules
  if (addedModules.length > 0) {
    const rows = addedModules.map(m => ({
      role_id: roleId,
      position_id: positionId,
      module_key: m.module_key,
      source_role_id: m.source_role_id,
      is_visible: true,
    }));

    const { error: insertError } = await db.from('role_position_module_visibility').insert(rows);
    if (insertError) throw new Error(insertError.message);
  }
  
  clearModuleVisibilityCache();
}
