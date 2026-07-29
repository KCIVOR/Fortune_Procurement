export type AppRole = 'employee' | 'warehouse' | 'procurement' | 'approver' | 'supplier' | 'admin' | 'tsqa';

export type AppPosition =
  | 'Staff'
  | 'Warehouse Staff'
  | 'Warehouse Manager'
  | 'Procurement Staff'
  | 'Authorized Personnel'
  | 'Buyer'
  | 'Procurement Manager'
  | 'Supervisor'
  | 'Department Head'
  | 'Operations Manager'
  | 'Director'
  | 'Finance Director'
  | 'Supplier Representative'
  | 'System Administrator'
  | 'TSQA Staff'
  | 'Planning Staff';

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
  role_id: string;
  position: AppPosition;
  position_id: string;
  department: string;
  department_id: string;
  active: boolean;
  /** Supplier default payment terms — used to prefill PO generation. */
  payment_terms?: string | null;
  supplier_supply_type: 'raw_material' | 'normal' | 'service' | null;
}
