import type { AppRole } from '@/types/auth';

export interface NavItem {
  label: string;
  href: string;
  icon: string;
}

export interface NavGroup {
  section: string;
  items: NavItem[];
}

const ALL_NAV: Record<string, NavItem> = {
  dashboard:        { label: 'Dashboard',         href: '/dashboard',            icon: 'LayoutDashboard' },
  myRequests:       { label: 'My Requests',        href: '/pr1',                  icon: 'FileText' },
  myDeliveries:     { label: 'Delivery Status',    href: '/delivery',             icon: 'Truck' },
  warehouseQueue:   { label: 'Warehouse Queue',    href: '/warehouse',            icon: 'PackageSearch' },
  approvalQueue:    { label: 'Approval Queue',     href: '/approvals',            icon: 'CheckSquare' },
  pr2:              { label: 'Purchase Requests',  href: '/pr2',                  icon: 'ClipboardList' },
  rfq:              { label: 'Canvassing / RFQ',   href: '/rfq',                  icon: 'SendHorizonal' },
  purchaseOrders:   { label: 'Purchase Orders',    href: '/po',                   icon: 'ShoppingCart' },
  deliveryTracking: { label: 'Delivery Tracking',  href: '/delivery',             icon: 'Truck' },
  grn:              { label: 'Goods Receipt',      href: '/grn',                  icon: 'PackageCheck' },
  supplierPortal:   { label: 'Quotations',         href: '/supplier/quotations',  icon: 'Tag' },
  supplierPO:       { label: 'Purchase Orders',    href: '/supplier/po',          icon: 'ShoppingCart' },
  supplierDelivery: { label: 'Deliveries',         href: '/supplier/delivery',    icon: 'Truck' },
  substitutes:      { label: 'Substitute Review',  href: '/substitutes',          icon: 'Replace' },
  adminUsers:       { label: 'User Management',    href: '/admin/users',          icon: 'Users' },
  adminRoles:       { label: 'Roles',              href: '/admin/roles',          icon: 'Shield' },
  adminPositions:   { label: 'Positions',          href: '/admin/positions',       icon: 'Tag' },
  adminDepts:       { label: 'Departments',        href: '/admin/departments',     icon: 'FileText' },
  adminAudit:       { label: 'Audit Logs',         href: '/admin/audit',          icon: 'Clock' },
};

export const ROLE_NAV: Record<AppRole, NavItem[]> = {
  admin: [
    ALL_NAV.dashboard,
    ALL_NAV.adminUsers,
    ALL_NAV.adminRoles,
    ALL_NAV.adminPositions,
    ALL_NAV.adminDepts,
    ALL_NAV.adminAudit,
  ],
  employee: [
    ALL_NAV.dashboard,
    ALL_NAV.myRequests,
    ALL_NAV.substitutes,
    ALL_NAV.myDeliveries,
  ],
  warehouse: [
    ALL_NAV.dashboard,
    ALL_NAV.warehouseQueue,
    { label: 'Warehouse History', href: '/warehouse/history', icon: 'ClipboardList' },
    ALL_NAV.deliveryTracking,
    ALL_NAV.grn,
  ],
  procurement: [
    ALL_NAV.dashboard,
    ALL_NAV.approvalQueue,
    { label: 'Approval History', href: '/approvals/history', icon: 'CheckSquare' },
    ALL_NAV.pr2,
    ALL_NAV.rfq,
    ALL_NAV.purchaseOrders,
    ALL_NAV.deliveryTracking,
    ALL_NAV.grn,
  ],
  approver: [
    ALL_NAV.dashboard,
    { label: 'PR1 Requests', href: '/approvals/pr1', icon: 'FileText' },
    { label: 'PR2 Requests', href: '/approvals/pr2', icon: 'ClipboardList' },
    { label: 'Purchase Orders', href: '/approvals/po', icon: 'ShoppingCart' },
    { label: 'Approval History', href: '/approvals/history', icon: 'CheckSquare' },
  ],
  supplier: [
    ALL_NAV.dashboard,
    ALL_NAV.supplierPortal,
    ALL_NAV.supplierPO,
    ALL_NAV.supplierDelivery,
  ],
};
