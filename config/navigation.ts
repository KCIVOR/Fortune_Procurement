import type { AppRole } from '@/types/auth';

/** Stable keys for sidebar + module visibility rules (global uniqueness). */
export type ModuleKey =
  | 'dashboard'
  | 'my_requests'
  | 'substitute_review'
  | 'delivery_tracking'
  | 'warehouse_validation'
  | 'warehouse_history'
  | 'goods_receipt'
  | 'approval_queue'
  | 'approval_history'
  | 'approver_pr1'
  | 'approver_pr2'
  | 'approver_po'
  | 'purchase_requests'
  | 'canvassing_rfq'
  | 'purchase_orders'
  | 'supplier_accounts'
  | 'supplier_accreditation'
  | 'product_review'
  | 'supplier_portal_accreditation'
  | 'supplier_products'
  | 'supplier_quotations'
  | 'supplier_po'
  | 'supplier_delivery'
  | 'tsqa_dashboard'
  | 'tsqa_rse'
  | 'admin_users'
  | 'admin_roles'
  | 'admin_positions'
  | 'admin_departments'
  | 'admin_audit'
  | 'admin_module_visibility'
  | 'admin_workflows'
  | 'admin_settings';

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  module_key: ModuleKey;
}

export interface NavGroup {
  section: string;
  items: NavItem[];
}

/** All available navigation items - exported for module visibility "add mode" */
export const ALL_NAV: Record<string, NavItem> = {
  dashboard: {
    label: 'Dashboard',
    href: '/dashboard',
    icon: 'LayoutDashboard',
    module_key: 'dashboard',
  },
  myRequests: {
    label: 'My Requests',
    href: '/pr1',
    icon: 'FileText',
    module_key: 'my_requests',
  },
  myDeliveries: {
    label: 'Delivery Status',
    href: '/delivery',
    icon: 'Truck',
    module_key: 'delivery_tracking',
  },
  warehouseQueue: {
    label: 'Warehouse Queue',
    href: '/warehouse',
    icon: 'PackageSearch',
    module_key: 'warehouse_validation',
  },
  approvalQueue: {
    label: 'Approval Queue',
    href: '/approvals',
    icon: 'CheckSquare',
    module_key: 'approval_queue',
  },
  pr2: {
    label: 'Purchase Requests',
    href: '/pr2',
    icon: 'ClipboardList',
    module_key: 'purchase_requests',
  },
  rfq: {
    label: 'Canvassing / RFQ',
    href: '/rfq',
    icon: 'SendHorizonal',
    module_key: 'canvassing_rfq',
  },
  purchaseOrders: {
    label: 'Purchase Orders',
    href: '/po',
    icon: 'ShoppingCart',
    module_key: 'purchase_orders',
  },
  deliveryTracking: {
    label: 'Delivery Tracking',
    href: '/delivery',
    icon: 'Truck',
    module_key: 'delivery_tracking',
  },
  grn: {
    label: 'Goods Receipt',
    href: '/grn',
    icon: 'PackageCheck',
    module_key: 'goods_receipt',
  },
  supplierAccounts: {
    label: 'Supplier Accounts',
    href: '/suppliers',
    icon: 'Users',
    module_key: 'supplier_accounts',
  },
  supplierAccredQueue: {
    label: 'Supplier Accreditation',
    href: '/accreditation',
    icon: 'BadgeCheck',
    module_key: 'supplier_accreditation',
  },
  productReviewQueue: {
    label: 'Product Review',
    href: '/accreditation/products',
    icon: 'PackageSearch',
    module_key: 'product_review',
  },
  supplierPortal: {
    label: 'Quotations',
    href: '/supplier/quotations',
    icon: 'Tag',
    module_key: 'supplier_quotations',
  },
  supplierPO: {
    label: 'Purchase Orders',
    href: '/supplier/po',
    icon: 'ShoppingCart',
    module_key: 'supplier_po',
  },
  supplierDelivery: {
    label: 'Deliveries',
    href: '/supplier/delivery',
    icon: 'Truck',
    module_key: 'supplier_delivery',
  },
  supplierAccreditation: {
    label: 'Accreditation',
    href: '/supplier/accreditation',
    icon: 'BadgeCheck',
    module_key: 'supplier_portal_accreditation',
  },
  supplierProducts: {
    label: 'Product Catalog',
    href: '/supplier/products',
    icon: 'Package',
    module_key: 'supplier_products',
  },
  substitutes: {
    label: 'Substitute Review',
    href: '/substitutes',
    icon: 'Replace',
    module_key: 'substitute_review',
  },
  adminUsers: {
    label: 'User Management',
    href: '/admin/users',
    icon: 'Users',
    module_key: 'admin_users',
  },
  adminRoles: {
    label: 'Roles',
    href: '/admin/roles',
    icon: 'Shield',
    module_key: 'admin_roles',
  },
  adminPositions: {
    label: 'Positions',
    href: '/admin/positions',
    icon: 'Tag',
    module_key: 'admin_positions',
  },
  adminDepts: {
    label: 'Departments',
    href: '/admin/departments',
    icon: 'FileText',
    module_key: 'admin_departments',
  },
  adminAudit: {
    label: 'Audit Logs',
    href: '/admin/audit',
    icon: 'Clock',
    module_key: 'admin_audit',
  },
  adminModuleVisibility: {
    label: 'Module Visibility',
    href: '/admin/module-visibility',
    icon: 'Settings2',
    module_key: 'admin_module_visibility',
  },
  adminWorkflows: {
    label: 'Workflows',
    href: '/admin/workflows',
    icon: 'GitBranch',
    module_key: 'admin_workflows',
  },
  adminSettings: {
    label: 'System Settings',
    href: '/admin/settings',
    icon: 'Settings2',
    module_key: 'admin_settings',
  },
  approverPR1: {
    label: 'PR1 Requests',
    href: '/approvals/pr1',
    icon: 'FileText',
    module_key: 'approver_pr1',
  },
  approverPR2: {
    label: 'PR2 Requests',
    href: '/approvals/pr2',
    icon: 'ClipboardList',
    module_key: 'approver_pr2',
  },
  approverPO: {
    label: 'Purchase Orders',
    href: '/approvals/po',
    icon: 'ShoppingCart',
    module_key: 'approver_po',
  },
  approvalHistory: {
    label: 'Approval History',
    href: '/approvals/history',
    icon: 'CheckSquare',
    module_key: 'approval_history',
  },
  warehouseHistory: {
    label: 'Warehouse History',
    href: '/warehouse/history',
    icon: 'ClipboardList',
    module_key: 'warehouse_history',
  },
  tsqaDashboard: {
    label: 'Dashboard',
    href: '/tsqa',
    icon: 'LayoutDashboard',
    module_key: 'tsqa_dashboard',
  },
  tsqaRse: {
    label: 'RSE Queue',
    href: '/tsqa/rse',
    icon: 'ClipboardList',
    module_key: 'tsqa_rse',
  },
};

export const ROLE_NAV: Record<AppRole, NavItem[]> = {
  // Admin: Dashboard → People & Org Management → System Configuration → Monitoring
  admin: [
    ALL_NAV.dashboard,
    // People & Org Management
    ALL_NAV.adminUsers,
    ALL_NAV.adminRoles,
    ALL_NAV.adminPositions,
    ALL_NAV.adminDepts,
    // System Configuration
    ALL_NAV.adminWorkflows,
    ALL_NAV.adminModuleVisibility,
    ALL_NAV.adminSettings,
    // Monitoring (reference, last)
    ALL_NAV.adminAudit,
  ],
  // Employee: Dashboard → Primary workflow (request → delivery) → Edge cases
  employee: [
    ALL_NAV.dashboard,
    ALL_NAV.myRequests,
    ALL_NAV.myDeliveries,
    ALL_NAV.substitutes, // Edge case (less frequent), moved to bottom
  ],
  // Warehouse: Dashboard → Active work (validate → receive → ship) → History (reference)
  warehouse: [
    ALL_NAV.dashboard,
    ALL_NAV.warehouseQueue,
    ALL_NAV.grn,
    ALL_NAV.deliveryTracking,
    ALL_NAV.warehouseHistory, // Reference, moved to bottom
  ],
  // Procurement: Dashboard → Procurement workflow → Logistics → Supplier mgmt → Approvals (secondary)
  procurement: [
    ALL_NAV.dashboard,
    // Primary procurement workflow (PR2 Approvals → RFQ → PO)
    ALL_NAV.approverPR2,
    ALL_NAV.rfq,
    ALL_NAV.purchaseOrders,
    // Logistics & receiving
    ALL_NAV.deliveryTracking,
    ALL_NAV.grn,
    // Supplier management
    ALL_NAV.supplierAccounts,
    ALL_NAV.supplierAccredQueue,
    ALL_NAV.productReviewQueue,
    ALL_NAV.substitutes, // Rev #5: accept/reject substitutes on behalf of requestor
    // Approvals (secondary task for procurement, moved to bottom)
    ALL_NAV.approvalQueue,
    ALL_NAV.approvalHistory,
  ],
  // Approver: Dashboard → Combined queue → Approvals by document type (PR1 → PR2 → PO) → History
  approver: [
    ALL_NAV.dashboard,
    ALL_NAV.approvalQueue,
    ALL_NAV.approverPR1,
    ALL_NAV.approverPR2,
    ALL_NAV.approverPO,
    ALL_NAV.approvalHistory, // Reference, last
  ],
  // Supplier: Dashboard → Daily operations (quotes → POs → deliveries) → Setup/maintenance
  supplier: [
    ALL_NAV.dashboard,
    // Daily operations
    ALL_NAV.supplierPortal,      // Quotations
    ALL_NAV.supplierPO,           // Purchase Orders
    ALL_NAV.supplierDelivery,     // Deliveries
    // Setup & maintenance (less frequent)
    ALL_NAV.supplierProducts,     // Product Catalog
    ALL_NAV.supplierAccreditation, // Accreditation (one-time)
  ],
  // TSQA: Already simple, no changes needed
  tsqa: [
    ALL_NAV.tsqaDashboard,
    ALL_NAV.tsqaRse,
  ],
};
