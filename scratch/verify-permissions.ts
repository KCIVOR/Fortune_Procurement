import { canActOnStepWithRole } from '../lib/approvals';
import { canActOnPR2Step } from '../lib/pr2-approvals';
import { canActOnPOStep } from '../lib/po-approvals';
import type { UserProfile } from '../types/auth';

const procurementStaffProfile: UserProfile = {
  id: 'user-staff',
  full_name: 'Procurement Staff User',
  email: 'staff@fortune.com',
  role: 'procurement',
  role_id: 'role-procurement',
  position: 'Procurement Staff',
  position_id: 'pos-staff',
  department: 'Procurement',
  department_id: 'dept-proc',
  active: true,
  supplier_supply_type: null,
};

const procurementManagerProfile: UserProfile = {
  id: 'user-mgr',
  full_name: 'Procurement Manager User',
  email: 'mgr@fortune.com',
  role: 'procurement',
  role_id: 'role-procurement',
  position: 'Procurement Manager',
  position_id: 'pos-mgr',
  department: 'Procurement',
  department_id: 'dept-proc',
  active: true,
  supplier_supply_type: null,
};

const otherProfile: UserProfile = {
  id: 'user-other',
  full_name: 'Employee User',
  email: 'emp@fortune.com',
  role: 'employee',
  role_id: 'role-employee',
  position: 'Staff',
  position_id: 'pos-staff',
  department: 'Sales',
  department_id: 'dept-sales',
  active: true,
  supplier_supply_type: null,
};

interface TestCase {
  name: string;
  func: (profile: UserProfile, role: string, position: string) => boolean;
}

const functionsToTest: TestCase[] = [
  { name: 'canActOnStepWithRole', func: canActOnStepWithRole },
  { name: 'canActOnPR2Step', func: canActOnPR2Step },
  { name: 'canActOnPOStep', func: canActOnPOStep },
];

let failed = false;

function assertEqual(actual: boolean, expected: boolean, message: string) {
  if (actual !== expected) {
    console.error(`❌ FAILED: ${message}. Expected ${expected}, got ${actual}`);
    failed = true;
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

for (const t of functionsToTest) {
  console.log(`\nTesting function: ${t.name}`);

  // Scenario 1: Staff acting on Staff step -> should be TRUE
  assertEqual(
    t.func(procurementStaffProfile, 'procurement', 'Procurement Staff'),
    true,
    'Procurement Staff acting on Procurement Staff step'
  );

  // Scenario 2: Manager acting on Staff step -> should be TRUE (Phase 2 Requirement)
  assertEqual(
    t.func(procurementManagerProfile, 'procurement', 'Procurement Staff'),
    true,
    'Procurement Manager acting on Procurement Staff step'
  );

  // Scenario 3: Staff acting on Manager step -> should be FALSE
  assertEqual(
    t.func(procurementStaffProfile, 'procurement', 'Procurement Manager'),
    false,
    'Procurement Staff acting on Procurement Manager step'
  );

  // Scenario 4: Manager acting on Manager step -> should be TRUE
  assertEqual(
    t.func(procurementManagerProfile, 'procurement', 'Procurement Manager'),
    true,
    'Procurement Manager acting on Procurement Manager step'
  );

  // Scenario 5: Unauthorized employee acting on Staff step -> should be FALSE
  assertEqual(
    t.func(otherProfile, 'procurement', 'Procurement Staff'),
    false,
    'Employee acting on Procurement Staff step'
  );
}

if (failed) {
  console.log('\n❌ Verification failed.');
  process.exit(1);
} else {
  console.log('\n✨ All permission checks passed successfully!');
  process.exit(0);
}
