export interface UserAssignmentUpdate {
  role_id: string | null;
  position_id: string | null;
  department_id: string | null;
}

export interface UserAssignmentSnapshot {
  before: {
    role_id: string | null;
    position_id: string | null;
    department_id: string | null;
  };
  after: {
    role_id: string | null;
    position_id: string | null;
    department_id: string | null;
  };
}
