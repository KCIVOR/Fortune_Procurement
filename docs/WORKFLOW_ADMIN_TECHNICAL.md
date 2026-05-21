# Workflow Admin Configuration - Technical Documentation

**Version**: 1.0  
**Last Updated**: May 21, 2026  
**Audience**: Developers and Technical Staff

---

## 📖 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Schema](#database-schema)
3. [API Reference](#api-reference)
4. [Validation Rules](#validation-rules)
5. [Hardcoded Business Logic](#hardcoded-business-logic)
6. [Extension Points](#extension-points)
7. [Security Considerations](#security-considerations)
8. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### Design Principles

The Workflow Admin feature follows a **surgical mode** approach:

1. **Zero Breaking Changes**: New code only, no modifications to existing approval logic
2. **Isolated Components**: Self-contained workflow admin module
3. **Defensive Validation**: Prevent configurations that break hardcoded rules
4. **Audit Trail**: Log all workflow configuration changes
5. **Rollback Safety**: Preserve workflow history before changes

### Technology Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript
- **Backend**: Supabase (PostgreSQL)
- **UI Components**: Custom components + shadcn/ui
- **State Management**: React hooks (useState, useEffect)
- **Validation**: Client-side + Server-side

### File Structure

```
types/
└── workflow-admin.ts          # Type definitions

lib/
└── workflow-admin.ts          # Data access layer

components/admin/
├── WorkflowTable.tsx          # Workflow list table
├── WorkflowStepEditor.tsx     # Step management UI
├── WorkflowStepForm.tsx       # Step create/edit form
└── WorkflowStepDeleteDialog.tsx # Delete confirmation

app/admin/workflows/
└── page.tsx                   # Main admin page

docs/
├── WORKFLOW_ADMIN_GUIDE.md    # User documentation
├── WORKFLOW_ADMIN_TECHNICAL.md # This file
└── WORKFLOW_ADMIN_TEST_VALIDATION.md # Test documentation
```

---

## Database Schema

### Tables Used

#### `approval_workflows`
Stores workflow definitions.

```sql
CREATE TABLE approval_workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  form_template_id UUID,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Columns**:
- `id`: Unique identifier
- `code`: Workflow code (e.g., PR1_APPROVAL)
- `name`: Human-readable name
- `form_template_id`: Optional reference to form template
- `active`: Whether workflow is active
- `created_at`: Creation timestamp

#### `approval_steps`
Stores individual approval steps within workflows.

```sql
CREATE TABLE approval_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID REFERENCES approval_workflows(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  role_required TEXT NOT NULL,
  position_required TEXT,
  action_label TEXT NOT NULL,
  is_final BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workflow_id, step_order)
);
```

**Columns**:
- `id`: Unique identifier
- `workflow_id`: Foreign key to approval_workflows
- `step_order`: Sequential order (1, 2, 3...)
- `role_required`: Required role (approver, procurement, supplier, warehouse)
- `position_required`: Required position title
- `action_label`: Label shown in approval timeline
- `is_final`: Whether this is the final approval step
- `created_at`: Creation timestamp

**Constraints**:
- `UNIQUE(workflow_id, step_order)`: Prevents duplicate step orders

#### `approval_instances`
Stores active approval instances (not modified by this feature).

```sql
CREATE TABLE approval_instances (
  id UUID PRIMARY KEY,
  workflow_id UUID REFERENCES approval_workflows(id),
  document_type TEXT,
  document_id UUID,
  current_step INTEGER,
  status TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
```

#### `approval_actions`
Stores approval actions taken (not modified by this feature).

```sql
CREATE TABLE approval_actions (
  id UUID PRIMARY KEY,
  instance_id UUID REFERENCES approval_instances(id),
  step_order INTEGER,
  action TEXT,
  actor_id UUID,
  actor_name_snapshot TEXT,
  actor_position_snapshot TEXT,
  actor_department_snapshot TEXT,
  remarks TEXT,
  acted_at TIMESTAMPTZ
);
```

#### `audit_logs`
Stores audit trail of all changes.

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  action TEXT NOT NULL,
  document_type TEXT,
  document_id UUID,
  actor_id UUID,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## API Reference

### Data Access Functions

All functions are in `lib/workflow-admin.ts`.

#### Read Operations

##### `listWorkflows(): Promise<WorkflowConfig[]>`

Lists all workflows with step counts and active instance counts.

**Returns**:
```typescript
{
  id: string;
  code: string;
  name: string;
  form_template_id: string | null;
  active: boolean;
  created_at: string;
  step_count: number;
  instance_count: number;
}[]
```

**Example**:
```typescript
const workflows = await listWorkflows();
console.log(workflows[0].step_count); // 2
```

---

##### `getWorkflowWithSteps(workflowId: string): Promise<WorkflowDetail | null>`

Gets a workflow with all its steps.

**Parameters**:
- `workflowId`: UUID of the workflow

**Returns**:
```typescript
{
  ...WorkflowConfig,
  steps: WorkflowStepConfig[];
}
```

**Example**:
```typescript
const workflow = await getWorkflowWithSteps('uuid-here');
console.log(workflow.steps.length); // 2
```

---

##### `listRolesForDropdown(): Promise<RoleOption[]>`

Lists all roles for dropdown selection.

**Returns**:
```typescript
{
  id: string;
  name: string;
}[]
```

---

##### `listPositionsForDropdown(): Promise<PositionOption[]>`

Lists all active positions with role information.

**Returns**:
```typescript
{
  id: string;
  title: string;
  role_id: string;
  role_name: string;
}[]
```

---

#### Validation Functions

##### `validateWorkflowSteps(steps: WorkflowStepConfig[]): WorkflowValidationResult`

Validates a workflow's step configuration.

**Parameters**:
- `steps`: Array of workflow steps

**Returns**:
```typescript
{
  valid: boolean;
  errors: string[];
  warnings: string[];
}
```

**Validation Rules**:
1. At least one step must exist
2. Exactly one step must be marked as final
3. Step orders must be sequential (1, 2, 3...)
4. No duplicate step orders
5. All steps must have required fields

**Example**:
```typescript
const validation = validateWorkflowSteps(steps);
if (!validation.valid) {
  console.error(validation.errors);
}
```

---

##### `checkStepDependencies(stepId: string): Promise<StepDependencyCheck>`

Checks if a step can be safely deleted.

**Parameters**:
- `stepId`: UUID of the step

**Returns**:
```typescript
{
  canDelete: boolean;
  reason?: string;
  activeInstanceCount?: number;
  actionCount?: number;
}
```

**Example**:
```typescript
const check = await checkStepDependencies(stepId);
if (!check.canDelete) {
  alert(check.reason);
}
```

---

#### Write Operations

##### `createWorkflowStep(workflowId: string, stepData: WorkflowStepFormData, actorId: string): Promise<Result>`

Creates a new workflow step.

**Parameters**:
- `workflowId`: UUID of the workflow
- `stepData`: Step configuration
- `actorId`: UUID of the user creating the step

**Returns**:
```typescript
{
  success: boolean;
  error?: string;
  data?: WorkflowStepConfig;
}
```

**Validation**:
1. Position exists and is active
2. Role matches position's role
3. No duplicate step order
4. If marking as final, unmarks other final steps

**Example**:
```typescript
const result = await createWorkflowStep(workflowId, {
  step_order: 3,
  role_required: 'approver',
  position_required: 'Director',
  action_label: 'Final Approved By',
  is_final: true,
}, userId);

if (!result.success) {
  console.error(result.error);
}
```

---

##### `updateWorkflowStep(stepId: string, updates: Partial<WorkflowStepFormData>, actorId: string): Promise<Result>`

Updates an existing workflow step.

**Parameters**:
- `stepId`: UUID of the step
- `updates`: Partial step configuration
- `actorId`: UUID of the user updating the step

**Returns**: Same as `createWorkflowStep`

**Validation**: Same as `createWorkflowStep`

---

##### `deleteWorkflowStep(stepId: string, actorId: string): Promise<Result>`

Deletes a workflow step.

**Parameters**:
- `stepId`: UUID of the step
- `actorId`: UUID of the user deleting the step

**Returns**:
```typescript
{
  success: boolean;
  error?: string;
}
```

**Validation**:
1. Checks dependencies (active instances)
2. Prevents deletion if workflow has active instances

---

##### `reorderWorkflowSteps(workflowId: string, newOrder: Array<{id: string, step_order: number}>, actorId: string): Promise<Result>`

Reorders workflow steps.

**Parameters**:
- `workflowId`: UUID of the workflow
- `newOrder`: Array of step IDs with new orders
- `actorId`: UUID of the user reordering

**Returns**: Same as `deleteWorkflowStep`

**Validation**:
- New orders must be sequential (1, 2, 3...)

**Note**: This function is implemented but not exposed in the UI (Phase 2 limitation).

---

#### Audit Functions

##### `logWorkflowAudit(action: string, workflowId: string, actorId: string, payload: any): Promise<void>`

Logs workflow configuration changes.

**Parameters**:
- `action`: Action type (WORKFLOW_STEP_CREATED, WORKFLOW_STEP_UPDATED, etc.)
- `workflowId`: UUID of the workflow
- `actorId`: UUID of the actor
- `payload`: Additional data

**Actions**:
- `WORKFLOW_STEP_CREATED`
- `WORKFLOW_STEP_UPDATED`
- `WORKFLOW_STEP_DELETED`
- `WORKFLOW_STEPS_REORDERED`

**Payload Structure**:
```typescript
{
  workflow_code: string;
  step_order?: number;
  old_values?: Partial<WorkflowStepConfig>;
  new_values?: Partial<WorkflowStepConfig>;
  changed_fields?: string[];
  timestamp: string;
}
```

---

#### Utility Functions

##### `getWorkflowWarnings(workflowCode: string, stepOrder: number): string[]`

Returns warnings for workflows with special business logic.

**Parameters**:
- `workflowCode`: Workflow code (e.g., PR2_PHASE1)
- `stepOrder`: Step order number

**Returns**: Array of warning messages

**Special Workflows**:
- `PR2_PHASE1` Steps 1-2: Auto-approval logic warning
- `PO_APPROVAL` Step 4: Delivery creation warning

---

## Validation Rules

### Client-Side Validation

Implemented in `WorkflowStepForm.tsx`:

1. **Required Fields**: All fields must be filled
2. **Step Order**: Must be positive integer
3. **Duplicate Check**: Step order must be unique
4. **Role/Position Match**: Position filtered by selected role

### Server-Side Validation

Implemented in `lib/workflow-admin.ts`:

1. **Position Exists**: Position must exist in database and be active
2. **Role Match**: Position's role must match selected role (with approver/procurement flexibility)
3. **Duplicate Order**: Step order must be unique within workflow
4. **Final Step**: Only one step can be marked as final
5. **Sequential Orders**: Step orders must be sequential (1, 2, 3...)

### Role Flexibility

**Important**: The system has special handling for "approver" and "procurement" roles:

```typescript
// These roles are interchangeable
const rolesMatch = positionRole === stepData.role_required ||
  ((positionRole === 'approver' || positionRole === 'procurement') &&
   (stepData.role_required === 'approver' || stepData.role_required === 'procurement'));
```

This means:
- A step with role="approver" can use positions from "procurement" role
- A step with role="procurement" can use positions from "approver" role
- This matches the existing approval logic in `lib/approvals.ts:canActOnStepWithRole()`

### Validation Flow

```
User Input
    ↓
Client Validation (immediate feedback)
    ↓
Form Submit
    ↓
Server Validation (database checks)
    ↓
Database Operation
    ↓
Audit Log
```

---

## Hardcoded Business Logic

### PR2_PHASE1 Auto-Approval

**Location**: `lib/pr2-approvals.ts:265-330`

**Logic**:
- If Step 1 approves AND no alternative items exist
- Step 2 is automatically approved (skipped)

**Impact on Workflow Admin**:
- Warning displayed when editing Steps 1 or 2
- Changing positions may affect auto-approval behavior
- Test auto-approval after changes

**Code Reference**:
```typescript
// lib/pr2-approvals.ts
if (step1Approved && !hasAlternatives) {
  // Auto-approve Step 2
  await autoApproveStep2(instanceId);
}
```

---

### PO_APPROVAL Delivery Creation

**Location**: `lib/po-approvals.ts:450-520`

**Logic**:
- When Step 4 is approved (supplier acknowledgment)
- Delivery tracking record is automatically created

**Impact on Workflow Admin**:
- Warning displayed when editing Step 4
- Step 4 must remain a supplier role
- Test delivery creation after changes

**Code Reference**:
```typescript
// lib/po-approvals.ts
if (stepOrder === 4 && action === 'approved') {
  // Create delivery tracking record
  await createDeliveryRecord(poId, supplierId);
}
```

---

## Extension Points

### Adding New Workflows

To add a new workflow (requires database access):

1. **Insert into `approval_workflows`**:
```sql
INSERT INTO approval_workflows (code, name, active)
VALUES ('NEW_WORKFLOW', 'New Workflow Name', true);
```

2. **Add steps via UI** or SQL:
```sql
INSERT INTO approval_steps (workflow_id, step_order, role_required, position_required, action_label, is_final)
VALUES 
  ('workflow-uuid', 1, 'approver', 'Supervisor', 'Reviewed By', false),
  ('workflow-uuid', 2, 'approver', 'Director', 'Approved By', true);
```

3. **Update approval logic** in relevant files (e.g., `lib/new-document-approvals.ts`)

---

### Adding New Roles

To add a new role:

1. **Insert into `roles` table**:
```sql
INSERT INTO roles (name) VALUES ('new_role');
```

2. **Create positions** for the role
3. **Update permission checks** in approval logic
4. **Test workflow configuration** with new role

---

### Custom Validation Rules

To add custom validation:

1. **Client-side**: Add to `WorkflowStepForm.tsx`
```typescript
if (customCondition) {
  setError('Custom validation message');
  return;
}
```

2. **Server-side**: Add to `lib/workflow-admin.ts`
```typescript
if (customCondition) {
  return { success: false, error: 'Custom validation message' };
}
```

---

### Custom Warnings

To add warnings for special workflows:

1. **Update `getWorkflowWarnings()` in `lib/workflow-admin.ts`**:
```typescript
if (workflowCode === 'NEW_WORKFLOW' && stepOrder === 1) {
  warnings.push('⚠️ Custom warning message');
}
```

2. **Warning appears automatically** in UI when editing that step

---

## Security Considerations

### Access Control

- **Admin Role Required**: Only users with `role='admin'` can access `/admin/workflows`
- **Enforced at Page Level**: `app/admin/workflows/page.tsx` checks `profile.role`
- **No API Endpoints**: All operations use Supabase client (RLS policies apply)

### RLS Policies

Ensure Row Level Security policies allow:
- Admins to read/write `approval_workflows` and `approval_steps`
- All users to read workflows (for approval logic)

**Example RLS Policy**:
```sql
-- Allow admins to modify workflow steps
CREATE POLICY "Admins can modify workflow steps"
ON approval_steps
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);
```

### Audit Trail

- All changes logged to `audit_logs` table
- Includes actor ID, action type, and payload
- Immutable audit trail (no delete/update on audit_logs)

---

## Troubleshooting

### Issue: Changes not reflected in approval flow

**Cause**: Existing approval instances use the workflow configuration from when they were created.

**Solution**: Changes only affect NEW approval instances. Test with a new document.

---

### Issue: "Position not found or inactive"

**Cause**: Position was deactivated or deleted.

**Solution**: 
1. Check `positions` table for `active=false`
2. Reactivate position or select a different one
3. Update workflow step to use active position

---

### Issue: Auto-approval not working after PR2_PHASE1 changes

**Cause**: Step 1 or 2 position changed, affecting auto-approval logic.

**Solution**:
1. Review `lib/pr2-approvals.ts` auto-approval logic
2. Ensure Step 1 is still a procurement role
3. Test with a PR2 that has no alternatives
4. Check audit logs for approval actions

---

### Issue: Delivery not created after PO_APPROVAL Step 4

**Cause**: Step 4 position changed to non-supplier role.

**Solution**:
1. Review `lib/po-approvals.ts` delivery creation logic
2. Ensure Step 4 is a supplier role
3. Test with a PO approval
4. Check `delivery_tracking` table for records

---

### Issue: "Workflow must have exactly one final step"

**Cause**: Multiple steps marked as final, or no steps marked as final.

**Solution**:
1. Query database:
```sql
SELECT * FROM approval_steps 
WHERE workflow_id = 'uuid' 
AND is_final = true;
```
2. Update to ensure exactly one final step:
```sql
UPDATE approval_steps 
SET is_final = false 
WHERE workflow_id = 'uuid';

UPDATE approval_steps 
SET is_final = true 
WHERE id = 'final-step-uuid';
```

---

## Performance Considerations

### Database Queries

- **Workflow List**: Single query with aggregations
- **Step Load**: Single query per workflow
- **CRUD Operations**: Individual queries (no batching)

### Optimization Opportunities

1. **Caching**: Cache workflow configurations (rarely change)
2. **Batch Updates**: Implement transaction support for reordering
3. **Lazy Loading**: Load steps only when workflow selected (already implemented)

---

## Migration and Rollback

### Backup Before Changes

```sql
-- Backup workflows
CREATE TABLE approval_workflows_backup AS 
SELECT * FROM approval_workflows;

-- Backup steps
CREATE TABLE approval_steps_backup AS 
SELECT * FROM approval_steps;
```

### Rollback Procedure

```sql
-- Restore workflows
DELETE FROM approval_workflows;
INSERT INTO approval_workflows 
SELECT * FROM approval_workflows_backup;

-- Restore steps
DELETE FROM approval_steps;
INSERT INTO approval_steps 
SELECT * FROM approval_steps_backup;
```

---

## Future Enhancements

### Planned Features

1. **Drag-and-Drop Reordering**: Visual step reordering
2. **Workflow Templates**: Copy workflow configurations
3. **Conditional Steps**: Steps that appear based on conditions
4. **Parallel Approvals**: Multiple approvers at same step
5. **Approval Delegation**: Temporary delegation to another user

### Extension Points

- `lib/workflow-admin.ts`: Add new functions
- `components/admin/`: Add new UI components
- `types/workflow-admin.ts`: Add new types

---

**End of Technical Documentation**
