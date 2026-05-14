import { supabase, db } from './supabase';
import type { ModuleKey, NavItem } from '@/config/navigation';

export interface ModuleVisibilityRule {
  role_id: string;
  position_id: string | null;
  module_key: string;
  is_visible: boolean;
}

const visibilityRulesCache = new Map<string, ModuleVisibilityRule[]>();
const visibilityRulesInflight = new Map<string, Promise<ModuleVisibilityRule[]>>();

function moduleVisibilityCacheKey(userId: string, roleId: string, positionId: string | null) {
  return `${userId}:${roleId}:${positionId ?? ''}`;
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

/** Sidebar: rules that apply to this user’s role (and optional position override rows). */
export async function fetchModuleVisibilityRules(
  roleId: string,
  positionId: string | null,
): Promise<ModuleVisibilityRule[]> {
  let q = supabase
    .from('role_position_module_visibility')
    .select('role_id, position_id, module_key, is_visible')
    .eq('role_id', roleId);

  if (positionId) {
    q = q.or(`position_id.is.null,position_id.eq.${positionId}`);
  } else {
    q = q.is('position_id', null);
  }

  const { data, error } = await q;
  if (error) {
    console.error('fetchModuleVisibilityRules', error);
    throw error;
  }
  return (data || []) as ModuleVisibilityRule[];
}

/** Admin: all visibility rows for a role (role-wide + every position override). */
export async function fetchAllModuleVisibilityRulesForRole(roleId: string): Promise<ModuleVisibilityRule[]> {
  const { data, error } = await supabase
    .from('role_position_module_visibility')
    .select('role_id, position_id, module_key, is_visible')
    .eq('role_id', roleId);

  if (error) {
    console.error('fetchAllModuleVisibilityRulesForRole', error);
    throw error;
  }
  return (data || []) as ModuleVisibilityRule[];
}

export function getRoleDefaultVisibility(moduleKey: string, rules: ModuleVisibilityRule[]): boolean {
  const rr = rules.find((r) => r.module_key === moduleKey && r.position_id === null);
  if (rr) return rr.is_visible;
  return true;
}

export function getEffectiveModuleVisibility(
  moduleKey: string,
  rules: ModuleVisibilityRule[],
  userPositionId: string | null,
): boolean {
  if (userPositionId) {
    const pr = rules.find((r) => r.module_key === moduleKey && r.position_id === userPositionId);
    if (pr) return pr.is_visible;
  }
  return getRoleDefaultVisibility(moduleKey, rules);
}

/** Alias for dashboards and UI — same resolution as sidebar. */
export function isModuleVisible(
  moduleKey: ModuleKey | string,
  rules: ModuleVisibilityRule[],
  userPositionId: string | null,
): boolean {
  return getEffectiveModuleVisibility(moduleKey, rules, userPositionId);
}

export function resolveVisibleModules(
  navItems: NavItem[],
  rules: ModuleVisibilityRule[],
  userPositionId: string | null,
): NavItem[] {
  return navItems.filter((item) => getEffectiveModuleVisibility(item.module_key, rules, userPositionId));
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
          .is('position_id', null);
        if (error) throw new Error(error.message);
      } else {
        const existing = allRules.find((r) => r.module_key === key && r.position_id === null);
        if (existing) {
          const { error } = await db.from('role_position_module_visibility')
            .update({ is_visible: false, updated_at: new Date().toISOString() })
            .eq('role_id', roleId)
            .eq('module_key', key)
            .is('position_id', null);
          if (error) throw new Error(error.message);
        } else {
          const { error } = await db.from('role_position_module_visibility').insert({
            role_id: roleId,
            position_id: null,
            module_key: key,
            is_visible: false,
          });
          if (error) throw new Error(error.message);
        }
      }
    } else {
      const base = getRoleDefaultVisibility(key, allRules);
      const posRow = allRules.find((r) => r.module_key === key && r.position_id === scopePositionId);

      if (want === base) {
        const { error } = await db.from('role_position_module_visibility')
          .delete()
          .eq('role_id', roleId)
          .eq('module_key', key)
          .eq('position_id', scopePositionId);
        if (error) throw new Error(error.message);
      } else if (posRow) {
        const { error } = await db.from('role_position_module_visibility')
          .update({ is_visible: want, updated_at: new Date().toISOString() })
          .eq('role_id', roleId)
          .eq('module_key', key)
          .eq('position_id', scopePositionId);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await db.from('role_position_module_visibility').insert({
          role_id: roleId,
          position_id: scopePositionId,
          module_key: key,
          is_visible: want,
        });
        if (error) throw new Error(error.message);
      }
    }
  }
}
