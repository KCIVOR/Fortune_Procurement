# Workflow Admin Configuration - Implementation Plan

## 🎯 Project Overview

**Goal**: Enable administrators to configure approval workflows (add/edit/reorder steps, change authorities) through a UI without code changes.

**Architecture**: Database-driven approval system with dynamic rendering and permission checking.

**Scope**: Create `/admin/workflows` page with full CRUD operations for workflow configuration.

---

## 📊 System Design Analysis

### Current Database Schema
```
approval_workflows (4 workflows)
├── id, code, name, form_template_id, active
└── approval_steps (13 steps total)
    ├── id, workflow_id, step_order
    ├── role_required, position_required
    ├── action_label, is_final
    └── created_at
```

### Existing Workflows
1. **PR1_APPROVAL** - 2 steps (Supervisor → Department Head)
2. **PR2_PHASE1** - 4 steps (Procurement Staff → Dept Head → Proc Manager → Director)
3. **PR2_PHASE2** - 3 steps (Buyer → Proc Manager → Director)
4. **PO_APPROVAL** - 4 steps (Buyer → Proc Manager → Finance Director → Supplier)

### Hardcoded Business Logic (Preserve)
1. **PR2 Phase 1 Auto-Approval** (`lib/pr2-approvals.ts:265-330`)
   - If Step 1 approves + no alternatives → auto-approve Step 2
2. **PO Supplier Acknowledgment** (`lib/po-approvals.ts:450-520`)
   - Step 4 creates delivery tracking record

---

## 🏗️ Architecture Principles

### Surgical Mode Strategy

1. **Zero Breaking Changes**: New code only, no modifications to existing approval logic
2. **Isolated Components**: Self-contained workflow admin module
3. **Defensive Validation**: Prevent configurations that break hardcoded rules
4. **Audit Trail**: Log all workflow configuration changes
5. **Rollback Safety**: Preserve workflow history before changes

### Design Patterns (From Existing Admin Pages)
- **Page Structure**: AppShell → PageHeader → Table → Dialogs
- **Data Fetching**: Async load on mount with error handling
- **CRUD Operations**: Separate functions in lib file
- **Audit Logging**: Record all mutations with actor_id + payload
- **Validation**: Client + server-side with user-friendly errors
- **Loading States**: Skeleton loaders + disabled buttons during operations

---

## 📋 Phase-by-Phase Implementation

### **PHASE 1: Foundation & Data Layer** (Day 1-2)
**Goal**: Create data access layer and type definitions

#### 1.1 Type Definitions
**File**: `types/workflow-admin.ts` (NEW)
```typescript
export interface WorkflowConfig {
  id: string;
  code: string;
  name: string;
  form_template_id: string | null;
  active: boolean;
  created_at: string;
  step_count?: number;
  instance_count?: number;
}

export interface WorkflowStepConfig {
  id: string;
  workflow_id: string;
  step_order: number;
  role_required: string;
  position_required: string | null;
  action_label: string;
  is_final: boolean;
  created_at: string;
}

export interface WorkflowStepFormData {
  step_order: number;
  role_required: string;
  position_required: string;
  action_label: string;
  is_final: boolean;
}

export interface WorkflowValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
```

#### 1.2 Data Access Library
**File**: `lib/workflow-admin.ts` (NEW)

**Functions to implement**:
```typescript
// Read operations
- listWorkflows(): Promise<WorkflowConfig[]>
- getWorkflowWithSteps(workflowId: string): Promise<WorkflowDetail>
- listRolesForDropdown(): Promise<{id: string, name: string}[]>
- listPositionsForDropdown(): Promise<{id: string, title: string, role: string}[]>

// Validation
- validateWorkflowSteps(steps: WorkflowStepConfig[]): WorkflowValidationResult
- checkStepDependencies(stepId: string): Promise<{canDelete: boolean, reason?: string}>

// Write operations
- createWorkflowStep(workflowId: string, stepData: WorkflowStepFormData): Promise<Result>
- updateWorkflowStep(stepId: string, updates: Partial<WorkflowStepFormData>): Promise<Result>
- deleteWorkflowStep(stepId: string): Promise<Result>
- reorderWorkflowSteps(workflowId: string, newOrder: {id: string, step_order: number}[]): Promise<Result>

// Audit
- logWorkflowAudit(action: string, workflowId: string, actorId: string, payload: any): Promise<void>
```

**Validation Rules**:

- ✅ At least one step must exist
- ✅ Exactly one step must be marked `is_final: true`
- ✅ Step orders must be sequential (1, 2, 3...)
- ✅ No duplicate step orders
- ✅ Position must exist in `positions` table
- ✅ Role must exist in `roles` table
- ⚠️ **PR2_PHASE1 Warning**: Changing Step 1 or 2 may affect auto-approval logic
- ⚠️ **PO_APPROVAL Warning**: Step 4 must remain supplier role (delivery creation)

**Deliverables**:
- [ ] `types/workflow-admin.ts` created
- [ ] `lib/workflow-admin.ts` created with all functions
- [ ] Unit tests for validation logic
- [ ] Audit logging integrated

---

### **PHASE 2: UI Components** (Day 3-4)
**Goal**: Build reusable UI components for workflow management

#### 2.1 Workflow List Table
**File**: `components/admin/WorkflowTable.tsx` (NEW)

**Props**:
```typescript
interface WorkflowTableProps {
  workflows: WorkflowConfig[];
  isLoading: boolean;
  onSelectWorkflow: (workflow: WorkflowConfig) => void;
}
```

**Features**:
- Display: Code, Name, Step Count, Active Status, Actions
- Click row to view/edit steps
- Badge for active/inactive workflows
- Skeleton loader during fetch

#### 2.2 Workflow Step Editor
**File**: `components/admin/WorkflowStepEditor.tsx` (NEW)

**Props**:
```typescript
interface WorkflowStepEditorProps {
  workflowId: string;
  steps: WorkflowStepConfig[];
  roles: {id: string, name: string}[];
  positions: {id: string, title: string, role: string}[];
  onStepsChange: () => void;
}
```

**Features**:

- Table with columns: Order, Role, Position, Action Label, Final, Actions
- Inline edit mode for each row
- Add new step button
- Delete step with confirmation
- Drag-and-drop reordering (react-beautiful-dnd or @dnd-kit)
- Real-time validation feedback
- Warning banners for PR2_PHASE1 and PO_APPROVAL

#### 2.3 Step Form Dialog
**File**: `components/admin/WorkflowStepForm.tsx` (NEW)

**Props**:
```typescript
interface WorkflowStepFormProps {
  mode: 'create' | 'edit';
  initialData?: WorkflowStepConfig;
  roles: {id: string, name: string}[];
  positions: {id: string, title: string, role: string}[];
  existingStepOrders: number[];
  onSubmit: (data: WorkflowStepFormData) => Promise<void>;
  onCancel: () => void;
}
```

**Fields**:
- Step Order (number input, auto-suggest next available)
- Role Required (dropdown: approver, procurement, supplier, warehouse)
- Position Required (dropdown, filtered by selected role)
- Action Label (text input, e.g., "Reviewed By", "Approved By")
- Is Final Step (checkbox)

**Validation**:
- Required fields
- Unique step order
- Position must match role
- Only one final step allowed

#### 2.4 Confirmation Dialogs
**Files**: 
- `components/admin/WorkflowStepDeleteDialog.tsx` (NEW)
- `components/admin/WorkflowReorderConfirmDialog.tsx` (NEW)

**Deliverables**:
- [ ] WorkflowTable.tsx created
- [ ] WorkflowStepEditor.tsx created with drag-drop
- [ ] WorkflowStepForm.tsx created with validation
- [ ] Delete/Reorder confirmation dialogs created
- [ ] Responsive design tested

---

### **PHASE 3: Main Page Integration** (Day 5)
**Goal**: Create the admin workflows page

#### 3.1 Page Component
**File**: `app/admin/workflows/page.tsx` (NEW)

**Structure**:

```typescript
export default function WorkflowsPage() {
  // State
  const [workflows, setWorkflows] = useState<WorkflowConfig[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowConfig | null>(null);
  const [steps, setSteps] = useState<WorkflowStepConfig[]>([]);
  const [roles, setRoles] = useState([]);
  const [positions, setPositions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Dialogs
  const [isStepFormOpen, setIsStepFormOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<WorkflowStepConfig | null>(null);
  
  // Load data on mount
  useEffect(() => {
    loadWorkflows();
    loadRolesAndPositions();
  }, []);
  
  // Load steps when workflow selected
  useEffect(() => {
    if (selectedWorkflow) {
      loadWorkflowSteps(selectedWorkflow.id);
    }
  }, [selectedWorkflow]);
  
  // CRUD handlers
  async function handleCreateStep(data: WorkflowStepFormData) { ... }
  async function handleUpdateStep(stepId: string, data: WorkflowStepFormData) { ... }
  async function handleDeleteStep(stepId: string) { ... }
  async function handleReorderSteps(newOrder: any[]) { ... }
  
  return (
    <AppShell title="Workflow Configuration">
      <div className="space-y-6">
        <PageHeader 
          title="Approval Workflows" 
          description="Configure approval pipeline steps and authorities"
        />
        
        {/* Workflow Selector */}
        <WorkflowTable 
          workflows={workflows}
          isLoading={isLoading}
          onSelectWorkflow={setSelectedWorkflow}
        />
        
        {/* Step Editor (shown when workflow selected) */}
        {selectedWorkflow && (
          <WorkflowStepEditor
            workflowId={selectedWorkflow.id}
            steps={steps}
            roles={roles}
            positions={positions}
            onStepsChange={() => loadWorkflowSteps(selectedWorkflow.id)}
          />
        )}
        
        {/* Dialogs */}
        <WorkflowStepForm ... />
        <WorkflowStepDeleteDialog ... />
      </div>
    </AppShell>
  );
}
```

**Access Control**:
- Admin role required (same pattern as positions/roles pages)
- Redirect non-admins to dashboard

**Deliverables**:
- [ ] `app/admin/workflows/page.tsx` created
- [ ] Admin role guard implemented
- [ ] Error boundaries added
- [ ] Loading states handled

---

### **PHASE 4: Testing & Validation** (Day 6)
**Goal**: Ensure system stability and data integrity

#### 4.1 Test Scenarios

**Positive Tests**:

1. ✅ Add new step to PR1_APPROVAL
2. ✅ Edit step position/role in PR2_PHASE2
3. ✅ Reorder steps in PO_APPROVAL
4. ✅ Delete unused step
5. ✅ Mark different step as final

**Negative Tests**:
1. ❌ Try to delete all steps (should fail validation)
2. ❌ Try to create duplicate step order (should fail)
3. ❌ Try to mark multiple steps as final (should fail)
4. ❌ Try to delete step with active instances (should warn)
5. ❌ Try to set non-existent position (should fail)

**Integration Tests**:
1. 🔄 Create new step → Submit PR1 → Verify new step appears in timeline
2. 🔄 Change step position → Verify permission check uses new position
3. 🔄 Reorder steps → Verify approval flow follows new order
4. 🔄 Verify PR2 auto-approval still works after Step 1/2 edits
5. 🔄 Verify PO delivery creation still works after Step 4 edits

#### 4.2 Data Integrity Checks
- [ ] Backup `approval_workflows` and `approval_steps` tables
- [ ] Test rollback procedure
- [ ] Verify audit logs capture all changes
- [ ] Check for orphaned approval_instances after step deletion

**Deliverables**:
- [ ] Test plan document created
- [ ] All positive tests passing
- [ ] All negative tests handled gracefully
- [ ] Integration tests verified
- [ ] Rollback procedure documented

---

### **PHASE 5: Documentation & Deployment** (Day 7)
**Goal**: Prepare for production deployment

#### 5.1 User Documentation
**File**: `docs/WORKFLOW_ADMIN_GUIDE.md` (NEW)

**Contents**:
- Overview of workflow configuration
- Step-by-step guide to add/edit/delete steps
- Explanation of roles vs positions
- Warning about PR2 and PO special logic
- Troubleshooting common issues
- Screenshots of UI

#### 5.2 Developer Documentation
**File**: `docs/WORKFLOW_ADMIN_TECHNICAL.md` (NEW)

**Contents**:
- Architecture overview
- Database schema
- API reference for lib/workflow-admin.ts
- Validation rules
- Hardcoded business logic locations
- Extension points for future workflows

#### 5.3 Migration Plan


**Pre-Deployment**:
1. Backup database (especially `approval_workflows`, `approval_steps`, `approval_instances`)
2. Test on staging environment
3. Verify all existing approval instances still work
4. Train admin users

**Deployment Steps**:
1. Deploy new code (zero breaking changes)
2. Verify `/admin/workflows` page loads
3. Test CRUD operations on non-critical workflow (create test workflow)
4. Monitor audit logs
5. Gradual rollout to admin users

**Rollback Plan**:
- If critical issue: Restore database backup
- If UI issue: Hide `/admin/workflows` route
- If validation issue: Disable write operations, keep read-only

**Deliverables**:
- [ ] User guide written
- [ ] Technical docs written
- [ ] Migration checklist created
- [ ] Rollback procedure tested
- [ ] Admin training completed

---

## 🔧 Technical Implementation Details

### File Structure
```
app/
└── admin/
    └── workflows/
        └── page.tsx (NEW)

components/
└── admin/
    ├── WorkflowTable.tsx (NEW)
    ├── WorkflowStepEditor.tsx (NEW)
    ├── WorkflowStepForm.tsx (NEW)
    ├── WorkflowStepDeleteDialog.tsx (NEW)
    └── WorkflowReorderConfirmDialog.tsx (NEW)

lib/
└── workflow-admin.ts (NEW)

types/
└── workflow-admin.ts (NEW)

docs/
├── WORKFLOW_ADMIN_GUIDE.md (NEW)
└── WORKFLOW_ADMIN_TECHNICAL.md (NEW)
```

### Database Operations

**Read Queries**:
```sql
-- List workflows with step counts
SELECT w.*, COUNT(s.id) as step_count
FROM approval_workflows w
LEFT JOIN approval_steps s ON s.workflow_id = w.id
GROUP BY w.id
ORDER BY w.code;

-- Get workflow with steps
SELECT w.*, 
  json_agg(s ORDER BY s.step_order) as steps
FROM approval_workflows w
LEFT JOIN approval_steps s ON s.workflow_id = w.id
WHERE w.id = $1
GROUP BY w.id;

-- Check step dependencies
SELECT COUNT(*) as active_instances
FROM approval_instances ai
JOIN approval_steps s ON s.workflow_id = ai.workflow_id
WHERE s.id = $1 AND ai.status = 'active';
```

**Write Queries**:
```sql
-- Create step
INSERT INTO approval_steps (workflow_id, step_order, role_required, position_required, action_label, is_final)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- Update step
UPDATE approval_steps
SET step_order = $2, role_required = $3, position_required = $4, action_label = $5, is_final = $6
WHERE id = $1;

-- Delete step
DELETE FROM approval_steps WHERE id = $1;

-- Reorder steps (transaction)
BEGIN;
UPDATE approval_steps SET step_order = $2 WHERE id = $1;
UPDATE approval_steps SET step_order = $3 WHERE id = $2;
-- ... (for each step)
COMMIT;
```

### Validation Logic

**Client-Side** (Immediate feedback):

```typescript
function validateStepForm(data: WorkflowStepFormData, existingSteps: WorkflowStepConfig[]): string[] {
  const errors: string[] = [];
  
  if (!data.role_required) errors.push('Role is required');
  if (!data.position_required) errors.push('Position is required');
  if (!data.action_label.trim()) errors.push('Action label is required');
  if (data.step_order < 1) errors.push('Step order must be positive');
  
  const duplicate = existingSteps.find(s => s.step_order === data.step_order);
  if (duplicate) errors.push(`Step order ${data.step_order} already exists`);
  
  return errors;
}

function validateWorkflowSteps(steps: WorkflowStepConfig[]): WorkflowValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (steps.length === 0) {
    errors.push('Workflow must have at least one step');
  }
  
  const finalSteps = steps.filter(s => s.is_final);
  if (finalSteps.length === 0) {
    errors.push('Workflow must have exactly one final step');
  } else if (finalSteps.length > 1) {
    errors.push('Workflow can only have one final step');
  }
  
  const orders = steps.map(s => s.step_order).sort((a, b) => a - b);
  for (let i = 0; i < orders.length; i++) {
    if (orders[i] !== i + 1) {
      errors.push('Step orders must be sequential (1, 2, 3...)');
      break;
    }
  }
  
  return { valid: errors.length === 0, errors, warnings };
}
```

**Server-Side** (Database constraints):
```typescript
async function createWorkflowStep(workflowId: string, stepData: WorkflowStepFormData): Promise<Result> {
  // 1. Validate position exists
  const { data: position } = await supabase
    .from('positions')
    .select('id, role_id, roles(name)')
    .eq('title', stepData.position_required)
    .maybeSingle();
  
  if (!position) {
    return { success: false, error: 'Position not found' };
  }
  
  // 2. Validate role matches position's role
  const positionRole = position.roles?.name;
  if (positionRole !== stepData.role_required) {
    return { success: false, error: `Position "${stepData.position_required}" belongs to role "${positionRole}", not "${stepData.role_required}"` };
  }
  
  // 3. Check for duplicate step order
  const { data: existing } = await supabase
    .from('approval_steps')
    .select('id')
    .eq('workflow_id', workflowId)
    .eq('step_order', stepData.step_order)
    .maybeSingle();
  
  if (existing) {
    return { success: false, error: 'Step order already exists' };
  }
  
  // 4. If marking as final, unmark other final steps
  if (stepData.is_final) {
    await supabase
      .from('approval_steps')
      .update({ is_final: false })
      .eq('workflow_id', workflowId)
      .eq('is_final', true);
  }
  
  // 5. Insert new step
  const { data, error } = await supabase
    .from('approval_steps')
    .insert([{ workflow_id: workflowId, ...stepData }])
    .select()
    .single();
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  return { success: true, data };
}
```

### Audit Logging

**Audit Actions**:

- `WORKFLOW_STEP_CREATED`
- `WORKFLOW_STEP_UPDATED`
- `WORKFLOW_STEP_DELETED`
- `WORKFLOW_STEPS_REORDERED`

**Payload Structure**:
```typescript
{
  workflow_code: 'PR1_APPROVAL',
  step_order: 2,
  old_values: { position_required: 'Department Head', ... },
  new_values: { position_required: 'Director', ... },
  changed_fields: ['position_required'],
  actor: 'Admin User Name',
  timestamp: '2026-05-21T12:00:00Z'
}
```

---

## ⚠️ Risk Mitigation

### Critical Risks

**Risk 1: Breaking Active Approval Instances**
- **Mitigation**: Warn admin if workflow has active instances
- **Detection**: Query `approval_instances` for `status = 'active'`
- **UI**: Show warning banner with instance count
- **Recommendation**: Wait for instances to complete before major changes

**Risk 2: Orphaning Approval Actions**
- **Mitigation**: Soft delete steps (add `deleted_at` column) instead of hard delete
- **Alternative**: Prevent deletion if step has recorded actions
- **Query**: Check `approval_actions` for `step_order` references

**Risk 3: Breaking PR2 Auto-Approval Logic**
- **Mitigation**: Show prominent warning when editing PR2_PHASE1 Steps 1-2
- **Warning Text**: "⚠️ This step has special auto-approval logic. Changing the position may affect automated workflows."
- **Validation**: Ensure Step 1 remains procurement role

**Risk 4: Breaking PO Delivery Creation**
- **Mitigation**: Show warning when editing PO_APPROVAL Step 4
- **Warning Text**: "⚠️ This step triggers delivery tracking creation. Ensure the position remains a supplier role."
- **Validation**: Ensure Step 4 role remains 'supplier'

### Non-Critical Risks

**Risk 5: Inconsistent Step Numbering**
- **Mitigation**: Auto-renumber steps after deletion
- **UI**: Show preview of new numbering before confirming

**Risk 6: Accidental Workflow Deactivation**
- **Mitigation**: Require confirmation dialog
- **Scope**: Phase 1 doesn't include workflow activation toggle (steps only)

---

## 🎨 UI/UX Mockup

### Workflow List View
```
┌─────────────────────────────────────────────────────────────┐
│ Approval Workflows                                          │
│ Configure approval pipeline steps and authorities           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Code            │ Name                    │ Steps │ Status  │
├─────────────────┼─────────────────────────┼───────┼─────────┤
│ PR1_APPROVAL    │ PR1 Approval Routing    │   2   │ Active  │
│ PR2_PHASE1      │ PR2 Phase 1 Routing     │   4   │ Active  │
│ PR2_PHASE2      │ PR2 Phase 2 Routing     │   3   │ Active  │
│ PO_APPROVAL     │ PO Approval Routing     │   4   │ Active  │
└─────────────────────────────────────────────────────────────┘
```

### Step Editor View (After selecting PR1_APPROVAL)
```
┌─────────────────────────────────────────────────────────────┐
│ PR1_APPROVAL - PR1 Approval Routing                         │
│ [+ Add Step]                                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Order │ Role     │ Position        │ Action Label      │ Final│
├───────┼──────────┼─────────────────┼───────────────────┼──────┤
│   1   │ Approver │ Supervisor      │ Reviewed By       │  ☐   │
│   2   │ Approver │ Department Head │ Approved By       │  ☑   │
└─────────────────────────────────────────────────────────────┘
         [Edit] [Delete]              [Edit] [Delete]
```

### Step Form Dialog
```
┌─────────────────────────────────────────────────────────────┐
│ Add Approval Step                                      [X]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Step Order: [3]                                             │
│                                                             │
│ Role Required: [Approver ▼]                                │
│                                                             │
│ Position Required: [Director ▼]                            │
│                                                             │
│ Action Label: [Approved By]                                │
│                                                             │
│ ☐ This is the final approval step                          │
│                                                             │
│                                    [Cancel]  [Save Step]   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📝 Implementation Checklist

### Phase 1: Foundation (Day 1-2)
- [ ] Create `types/workflow-admin.ts`
- [ ] Create `lib/workflow-admin.ts`
- [ ] Implement `listWorkflows()`
- [ ] Implement `getWorkflowWithSteps()`
- [ ] Implement `listRolesForDropdown()`
- [ ] Implement `listPositionsForDropdown()`
- [ ] Implement `validateWorkflowSteps()`
- [ ] Implement `checkStepDependencies()`
- [ ] Implement `createWorkflowStep()`
- [ ] Implement `updateWorkflowStep()`
- [ ] Implement `deleteWorkflowStep()`
- [ ] Implement `reorderWorkflowSteps()`
- [ ] Implement `logWorkflowAudit()`
- [ ] Write validation unit tests

### Phase 2: UI Components (Day 3-4)
- [ ] Create `components/admin/WorkflowTable.tsx`
- [ ] Create `components/admin/WorkflowStepEditor.tsx`
- [ ] Implement drag-and-drop reordering
- [ ] Create `components/admin/WorkflowStepForm.tsx`
- [ ] Add form validation
- [ ] Create `components/admin/WorkflowStepDeleteDialog.tsx`
- [ ] Create `components/admin/WorkflowReorderConfirmDialog.tsx`
- [ ] Add warning banners for PR2/PO
- [ ] Test responsive design

### Phase 3: Page Integration (Day 5)
- [ ] Create `app/admin/workflows/page.tsx`
- [ ] Implement admin role guard
- [ ] Wire up all CRUD operations
- [ ] Add error handling
- [ ] Add loading states
- [ ] Test full user flow

### Phase 4: Testing (Day 6)
- [ ] Run all positive test scenarios
- [ ] Run all negative test scenarios
- [ ] Run integration tests
- [ ] Verify PR2 auto-approval still works
- [ ] Verify PO delivery creation still works
- [ ] Test rollback procedure
- [ ] Verify audit logs

### Phase 5: Documentation & Deployment (Day 7)
- [ ] Write user guide
- [ ] Write technical documentation
- [ ] Create migration checklist
- [ ] Backup production database
- [ ] Deploy to staging
- [ ] Test on staging
- [ ] Train admin users
- [ ] Deploy to production
- [ ] Monitor for issues

---

## 🚀 Quick Start Commands

```bash
# Create new files
touch types/workflow-admin.ts
touch lib/workflow-admin.ts
mkdir -p app/admin/workflows
touch app/admin/workflows/page.tsx
mkdir -p components/admin
touch components/admin/WorkflowTable.tsx
touch components/admin/WorkflowStepEditor.tsx
touch components/admin/WorkflowStepForm.tsx
touch components/admin/WorkflowStepDeleteDialog.tsx
touch components/admin/WorkflowReorderConfirmDialog.tsx

# Install dependencies (if needed)
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

# Run development server
npm run dev

# Access admin page
# http://localhost:3000/admin/workflows
```

---

## 📞 Support & Escalation

**Questions During Implementation**:
1. Check this implementation plan
2. Review existing admin pages (roles, positions, departments)
3. Consult `lib/approvals.ts` for approval logic patterns
4. Check database schema in Supabase dashboard

**Blockers**:
- Database constraint issues → Check RLS policies
- Validation failures → Review `lib/workflow-admin.ts` validation logic
- UI rendering issues → Check component props and state management

---

## ✅ Success Criteria

1. ✅ Admin can view all workflows and their steps
2. ✅ Admin can add new steps to any workflow
3. ✅ Admin can edit existing steps (role, position, label)
4. ✅ Admin can delete steps (with validation)
5. ✅ Admin can reorder steps via drag-and-drop
6. ✅ System prevents invalid configurations
7. ✅ All changes are logged in audit_logs
8. ✅ Existing approval instances continue to work
9. ✅ PR2 auto-approval logic still functions
10. ✅ PO delivery creation still functions
11. ✅ UI is responsive and user-friendly
12. ✅ Documentation is complete and accurate

---

**END OF IMPLEMENTATION PLAN**
