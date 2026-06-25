import type { ModuleKey } from '@/config/navigation';

/**
 * Maps sidebar module keys to route prefixes guarded in `config/route-access.ts`.
 * Module visibility controls nav/KPI only — it does not grant route access (see migration comment).
 */
export const MODULE_ROUTE_PREFIX: Partial<Record<ModuleKey, string>> = {
  dashboard: '/dashboard',
  my_requests: '/pr1',
  substitute_review: '/substitutes',
  delivery_tracking: '/delivery',
  warehouse_validation: '/warehouse',
  warehouse_history: '/warehouse',
  goods_receipt: '/grn',
  approval_queue: '/approvals',
  approval_history: '/approvals',
  approver_pr1: '/approvals',
  approver_pr2: '/approvals',
  approver_po: '/approvals',
  purchase_requests: '/pr2',
  canvassing_rfq: '/rfq',
  purchase_orders: '/po',
  supplier_accounts: '/suppliers',
  supplier_accreditation: '/accreditation',
  product_review: '/accreditation',
  supplier_portal_accreditation: '/supplier',
  supplier_products: '/supplier',
  supplier_quotations: '/supplier',
  supplier_po: '/supplier',
  supplier_delivery: '/supplier',
  tsqa_dashboard: '/tsqa',
  tsqa_rse: '/tsqa',
  admin_users: '/admin',
  admin_roles: '/admin',
  admin_positions: '/admin',
  admin_departments: '/admin',
  admin_audit: '/admin',
  admin_module_visibility: '/admin',
  admin_workflows: '/admin',
  admin_settings: '/admin',
};

/** Module keys that remain visible when visibility rules cannot be loaded (fail-closed). */
export const ESSENTIAL_MODULE_KEYS: readonly ModuleKey[] = ['dashboard'] as const;

export function isEssentialModuleKey(moduleKey: ModuleKey | string): boolean {
  return (ESSENTIAL_MODULE_KEYS as readonly string[]).includes(moduleKey);
}
