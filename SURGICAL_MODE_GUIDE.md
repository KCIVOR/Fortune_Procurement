# Surgical Mode Implementation Guide

## 🎯 Core Principle
**Add new code only. Never modify existing approval logic.**

---

## ✅ Safe Operations (GREEN LIGHT)

### 1. Creating New Files
```bash
✅ types/workflow-admin.ts          # New type definitions
✅ lib/workflow-admin.ts            # New data access layer
✅ app/admin/workflows/page.tsx     # New admin page
✅ components/admin/Workflow*.tsx   # New UI components
```

### 2. Reading Existing Code
```bash
✅ Read lib/approvals.ts            # Study patterns, don't modify
✅ Read lib/pr2-approvals.ts        # Understand logic, don't touch
✅ Read lib/po-approvals.ts         # Reference only
✅ Read components/approvals/*      # UI patterns reference
```

### 3. Database Operations
```sql
✅ SELECT from approval_workflows   # Read operations
✅ SELECT from approval_steps       # Read operations
✅ INSERT INTO approval_steps       # Add new steps
✅ UPDATE approval_steps            # Modify step config
✅ DELETE FROM approval_steps       # Remove steps (with validation)
```

---

## ⚠️ Caution Zone (YELLOW LIGHT)

### 1. Validation Before Writes
```typescript
⚠️ Before DELETE: Check if step has active instances
⚠️ Before UPDATE: Validate position exists
⚠️ Before INSERT: Check for duplicate step_order
⚠️ Before marking final: Unmark other final steps
```

### 2. Special Workflow Warnings
```typescript
⚠️ PR2_PHASE1 Steps 1-2: Show warning about auto-approval
⚠️ PO_APPROVAL Step 4: Show warning about delivery creation
⚠️ Any workflow with active instances: Warn before changes
```

### 3. Database Transactions
```typescript
⚠️ Reordering steps: Use transaction to update multiple rows
⚠️ Changing final step: Transaction to unmark old + mark new
⚠️ Deleting step: Transaction to renumber remaining steps
```

---

## 🚫 Forbidden Operations (RED LIGHT)

### 1. Never Modify These Files
```bash
❌ lib/approvals.ts                # Core approval logic
❌ lib/pr2-approvals.ts            # PR2 auto-approval logic
❌ lib/po-approvals.ts             # PO delivery creation
❌ components/approvals/WorkflowTimeline.tsx  # Timeline rendering
```

### 2. Never Change These Functions
```typescript
❌ canActOnStep()                  # Permission checking
❌ submitApprovalAction()          # Approval submission
❌ submitPR2ApprovalAction()       # PR2 approval with auto-logic
❌ acknowledgeSupplierPO()         # PO delivery creation
```

### 3. Never Alter Database Schema
```sql
❌ ALTER TABLE approval_workflows  # Schema changes
❌ ALTER TABLE approval_steps      # Schema changes
❌ ALTER TABLE approval_instances  # Schema changes
❌ ALTER TABLE approval_actions    # Schema changes
```

### 4. Never Break These Constraints
```typescript
❌ Remove all steps from a workflow
❌ Create workflow with no final step
❌ Create workflow with multiple final steps
❌ Create non-sequential step orders (1, 2, 4 ❌)
❌ Assign position that doesn't exist
❌ Assign position that doesn't match role
```

---

## 🔍 Conflict Avoidance Checklist

### Before Starting Implementation
- [ ] Backup database (approval_workflows, approval_steps, approval_instances)
- [ ] Document current workflow configurations
- [ ] Identify active approval instances
- [ ] Review hardcoded business logic locations

### During Implementation
- [ ] Create new files only (no modifications to existing)
- [ ] Import from existing libs (don't copy-paste)
- [ ] Use existing UI components where possible
- [ ] Follow existing naming conventions
- [ ] Match existing error handling patterns

### Before Each Database Write
- [ ] Validate data on client side
- [ ] Validate data on server side
- [ ] Check for active instances
- [ ] Use transactions for multi-row updates
- [ ] Log to audit_logs

### After Each Feature
- [ ] Test with existing workflows
- [ ] Verify approval flow still works
- [ ] Check PR2 auto-approval
- [ ] Check PO delivery creation
- [ ] Review audit logs

---

## 🛡️ Safety Patterns

### Pattern 1: Read-Validate-Write
```typescript
async function updateWorkflowStep(stepId: string, updates: Partial<StepData>) {
  // 1. READ: Fetch current state
  const current = await getStep(stepId);
  if (!current) return { error: 'Step not found' };
  
  // 2. VALIDATE: Check constraints
  const validation = await validateStepUpdate(current, updates);
  if (!validation.valid) return { error: validation.errors };
  
  // 3. WRITE: Apply changes
  const result = await supabase
    .from('approval_steps')
    .update(updates)
    .eq('id', stepId);
  
  // 4. AUDIT: Log change
  await logWorkflowAudit('WORKFLOW_STEP_UPDATED', stepId, actorId, {
    old: current,
    new: updates
  });
  
  return result;
}
```

### Pattern 2: Transaction for Multi-Row Updates
```typescript
async function reorderSteps(workflowId: string, newOrder: {id: string, order: number}[]) {
  const { data, error } = await supabase.rpc('reorder_workflow_steps', {
    p_workflow_id: workflowId,
    p_new_order: newOrder
  });
  
  // Or use explicit transaction if RPC not available
  // BEGIN; UPDATE...; UPDATE...; COMMIT;
}
```

### Pattern 3: Soft Validation with Warnings
```typescript
function validateWorkflowChanges(workflowCode: string, changes: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Hard errors (block operation)
  if (changes.steps.length === 0) {
    errors.push('Workflow must have at least one step');
  }
  
  // Soft warnings (allow but warn)
  if (workflowCode === 'PR2_PHASE1' && changes.affectsSteps([1, 2])) {
    warnings.push('⚠️ Changes may affect auto-approval logic');
  }
  
  return { valid: errors.length === 0, errors, warnings };
}
```

### Pattern 4: Defensive Queries
```typescript
// ❌ BAD: Assumes step exists
await supabase.from('approval_steps').update(data).eq('id', stepId);

// ✅ GOOD: Checks existence first
const { data: step } = await supabase
  .from('approval_steps')
  .select('id')
  .eq('id', stepId)
  .maybeSingle();

if (!step) {
  return { error: 'Step not found' };
}

await supabase.from('approval_steps').update(data).eq('id', stepId);
```

---

## 🧪 Testing Strategy

### Unit Tests (Isolated)
```typescript
describe('validateWorkflowSteps', () => {
  it('should reject workflow with no steps', () => {
    const result = validateWorkflowSteps([]);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Workflow must have at least one step');
  });
  
  it('should reject workflow with no final step', () => {
    const steps = [{ step_order: 1, is_final: false, ... }];
    const result = validateWorkflowSteps(steps);
    expect(result.valid).toBe(false);
  });
});
```

### Integration Tests (End-to-End)
```typescript
describe('Workflow Admin Integration', () => {
  it('should add step and reflect in approval flow', async () => {
    // 1. Add new step to PR1_APPROVAL
    await createWorkflowStep('PR1_APPROVAL', {
      step_order: 3,
      role_required: 'approver',
      position_required: 'Director',
      action_label: 'Final Approval',
      is_final: true
    });
    
    // 2. Submit new PR1 request
    const pr1 = await createPR1Request();
    await submitPR1ForApproval(pr1.id);
    
    // 3. Verify new step appears in timeline
    const detail = await fetchApprovalDetail(pr1.instance_id);
    expect(detail.workflow_steps).toHaveLength(3);
    expect(detail.workflow_steps[2].position_required).toBe('Director');
  });
});
```

### Regression Tests (Existing Functionality)
```typescript
describe('Existing Approval Logic', () => {
  it('should still auto-approve PR2 Phase 1 Step 2 when no alternatives', async () => {
    // Verify PR2 auto-approval logic still works after workflow changes
  });
  
  it('should still create delivery when PO Step 4 acknowledged', async () => {
    // Verify PO delivery creation still works after workflow changes
  });
});
```

---

## 📋 Pre-Commit Checklist

Before committing any code:
- [ ] No modifications to `lib/approvals.ts`
- [ ] No modifications to `lib/pr2-approvals.ts`
- [ ] No modifications to `lib/po-approvals.ts`
- [ ] No modifications to `components/approvals/WorkflowTimeline.tsx`
- [ ] All new files follow naming conventions
- [ ] All database writes have validation
- [ ] All mutations have audit logging
- [ ] All errors have user-friendly messages
- [ ] All warnings are displayed to user
- [ ] No console.log statements (use proper logging)
- [ ] TypeScript types are properly defined
- [ ] No `any` types (use proper interfaces)

---

## 🚨 Emergency Rollback

If something goes wrong:

### Immediate Actions
1. **Stop writes**: Comment out all write operations in `lib/workflow-admin.ts`
2. **Restore database**: Use backup from pre-deployment
3. **Hide UI**: Remove route from navigation or add feature flag

### Database Rollback
```sql
-- Restore from backup
pg_restore -d your_database backup_file.dump

-- Or restore specific tables
TRUNCATE approval_steps;
COPY approval_steps FROM 'backup_approval_steps.csv' CSV HEADER;
```

### Code Rollback
```bash
# Revert to previous commit
git revert HEAD

# Or remove new files
rm -rf app/admin/workflows
rm lib/workflow-admin.ts
rm types/workflow-admin.ts
rm components/admin/Workflow*.tsx
```

---

## ✅ Success Indicators

You're doing it right if:
- ✅ All existing tests still pass
- ✅ No changes to existing approval logic files
- ✅ All new code is in separate files
- ✅ Database writes are validated and logged
- ✅ UI shows warnings for risky operations
- ✅ Existing approval instances continue to work
- ✅ PR2 auto-approval still functions
- ✅ PO delivery creation still functions

---

**Remember: When in doubt, don't modify. Create new.**
