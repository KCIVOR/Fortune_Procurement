export type AppRole = 'employee' | 'warehouse' | 'procurement' | 'approver' | 'supplier' | 'admin';

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
  | 'Director'
  | 'Finance Director'
  | 'Supplier Representative'
  | 'System Administrator';

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
}
