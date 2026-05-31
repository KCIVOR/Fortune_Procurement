# PR2 Phase 1 Workflow Comparison

## Current Workflow (4 Steps with Auto-Approval)

```
┌─────────────────────────────────────────────────────────────────┐
│                    PR2 PHASE 1 - CURRENT                        │
└─────────────────────────────────────────────────────────────────┘

Step 1: Procurement Staff
┌──────────────────────────┐
│  Procurement Staff       │
│  "Prepared By"           │
│  Role: procurement       │
└──────────┬───────────────┘
           │
           ▼
    ┌──────────────┐
    │  Approves?   │
    └──┬───────┬───┘
       │       │
    YES│       │NO → Reject/Revision → Back to Draft
       │       │
       ▼       │
  ┌────────────┴──────────┐
  │ Check for Alternatives│
  └────┬──────────────┬───┘
       │              │
    NO │           YES│
       │              │
       ▼              ▼
┌──────────────┐  ┌──────────────────────┐
│ AUTO-APPROVE │  │ Step 2: Dept Head    │
│ Step 2       │  │ "Certified By"       │
│ (Skip)       │  │ Role: approver       │
└──────┬───────┘  └──────┬───────────────┘
       │                 │
       │                 ▼
       │          ┌──────────────┐
       │          │  Approves?   │
       │          └──┬───────┬───┘
       │             │       │
       │          YES│       │NO → Reject/Revision
       │             │       │
       └─────────────┴───────┘
                     │
                     ▼
           Step 3: Procurement Manager
           ┌──────────────────────┐
           │ Procurement Manager  │
           │ "Reviewed By"        │
           │ Role: procurement    │
           └──────┬───────────────┘
                  │
                  ▼
           ┌──────────────┐
           │  Approves?   │
           └──┬───────┬───┘
              │       │
           YES│       │NO → Reject/Revision
              │       │
              ▼       │
           Step 4: Director (FINAL)
           ┌──────────────────────┐
           │ Director             │
           │ "Approved By"        │
           │ Role: approver       │
           │ is_final: true       │
           └──────┬───────────────┘
                  │
                  ▼
           ┌──────────────┐
           │  Approves?   │
           └──┬───────┬───┘
              │       │
           YES│       │NO → Reject/Revision
              │       │
              ▼       │
    ┌─────────────────┴──────┐
    │ Phase 1 Complete       │
    │ Start Phase 2          │
    └────────────────────────┘
```

**Issues with Current Workflow**:
- ❌ Complex auto-approval logic
- ❌ Conditional step skipping confuses users
- ❌ Department Head may not add value (already approved PR1)
- ❌ 4 steps can be slow
- ❌ Special case handling in code

---

## Proposed Workflow (3 Steps, No Auto-Approval)

```
┌─────────────────────────────────────────────────────────────────┐
│                    PR2 PHASE 1 - PROPOSED                       │
└─────────────────────────────────────────────────────────────────┘

Step 1: Procurement Staff
┌──────────────────────────┐
│  Procurement Staff       │
│  "Prepared By"           │
│  Role: procurement       │
└──────────┬───────────────┘
           │
           ▼
    ┌──────────────┐
    │  Approves?   │
    └──┬───────┬───┘
       │       │
    YES│       │NO → Reject/Revision → Back to Draft
       │       │
       ▼       │
Step 2: Procurement Manager
┌──────────────────────────┐
│ Procurement Manager      │
│ "Reviewed By"            │
│ Role: procurement        │
└──────────┬───────────────┘
           │
           ▼
    ┌──────────────┐
    │  Approves?   │
    └──┬───────┬───┘
       │       │
    YES│       │NO → Reject/Revision
       │       │
       ▼       │
Step 3: Director (FINAL)
┌──────────────────────────┐
│ Director                 │
│ "Approved By"            │
│ Role: approver           │
│ is_final: true           │
└──────────┬───────────────┘
           │
           ▼
    ┌──────────────┐
    │  Approves?   │
    └──┬───────┬───┘
       │       │
    YES│       │NO → Reject/Revision
       │       │
       ▼       │
┌─────────────────┴──────┐
│ Phase 1 Complete       │
│ Start Phase 2          │
└────────────────────────┘
```

**Benefits of Proposed Workflow**:
- ✅ Simple, linear flow
- ✅ No conditional logic
- ✅ Faster (3 steps vs 4)
- ✅ Clearer approval chain
- ✅ No "magic" auto-approvals
- ✅ Easier to understand and maintain

---

## Side-by-Side Comparison

| Aspect | Current (4 Steps) | Proposed (3 Steps) |
|--------|-------------------|-------------------|
| **Total Steps** | 4 | 3 |
| **Procurement Staff** | Step 1 ✅ | Step 1 ✅ |
| **Department Head** | Step 2 (conditional) | ❌ Removed |
| **Procurement Manager** | Step 3 | Step 2 (renumbered) |
| **Director** | Step 4 (final) | Step 3 (final) |
| **Auto-Approval Logic** | Yes (complex) | No (simple) |
| **Average Time** | 3-4 approvals | 3 approvals |
| **Code Complexity** | High | Low |
| **User Confusion** | Medium | Low |

---

## Migration Impact on Active Instances

### Scenario 1: PR2 Currently at Step 1 (Procurement Staff)
```
BEFORE: Step 1 → [Waiting for approval]
AFTER:  Step 1 → [Waiting for approval] ✅ No change
```

### Scenario 2: PR2 Currently at Step 2 (Department Head)
```
BEFORE: Step 2 → [Waiting for Department Head]
AFTER:  Step 2 → [Auto-advanced to Procurement Manager] ⚠️
```
**Action**: Migration automatically advances to new Step 2 (Procurement Manager)

### Scenario 3: PR2 Currently at Step 3 (Procurement Manager)
```
BEFORE: Step 3 → [Waiting for Procurement Manager]
AFTER:  Step 2 → [Waiting for Procurement Manager] ✅ Renumbered
```

### Scenario 4: PR2 Currently at Step 4 (Director)
```
BEFORE: Step 4 → [Waiting for Director]
AFTER:  Step 3 → [Waiting for Director] ✅ Renumbered
```

---

## Historical Data Handling

### Approval Actions Table
```sql
-- BEFORE Migration
instance_id | step_order | action   | actor_position
------------|------------|----------|------------------
abc-123     | 1          | approved | Procurement Staff
abc-123     | 2          | approved | Department Head (auto)
abc-123     | 3          | approved | Procurement Manager
abc-123     | 4          | approved | Director

-- AFTER Migration (Renumbered)
instance_id | step_order | action   | actor_position
------------|------------|----------|------------------
abc-123     | 1          | approved | Procurement Staff
abc-123     | 2          | approved | Procurement Manager  ← Renumbered from 3
abc-123     | 3          | approved | Director             ← Renumbered from 4
```

**Note**: Historical Department Head approvals (step_order = 2) are removed during migration since that step no longer exists.

---

## Business Justification

### Why Remove Department Head from PR2 Phase 1?

1. **Already Approved at PR1**
   - Department Head approved the original PR1 request
   - Same items, same purpose, same department
   - Only difference: supplier selection and pricing

2. **Procurement Expertise**
   - Supplier selection is procurement's domain
   - Procurement Manager better positioned to evaluate
   - Director provides final oversight

3. **Efficiency**
   - Reduces approval time by 25%
   - Reduces Department Head workload
   - Streamlines procurement process

4. **Consistency**
   - PR2 Phase 2 doesn't have Department Head
   - PO approval doesn't have Department Head
   - Department Head focus on PR1 (original requests)

### When Department Head IS Involved

| Stage | Department Head Role |
|-------|---------------------|
| **PR1** | ✅ Approves original request (Step 2 - Final) |
| **PR2 Phase 1** | ❌ Not involved (Removed) |
| **PR2 Phase 2** | ❌ Not involved |
| **PO** | ❌ Not involved |

**Result**: Department Head approves once at PR1, then procurement takes over.

---

## Rollback Plan

If the change needs to be reversed:

```sql
-- Rollback Migration: Restore Department Head to PR2_PHASE1

DO $$
DECLARE
  v_pr2p1_wf uuid;
BEGIN
  SELECT id INTO v_pr2p1_wf 
  FROM approval_workflows 
  WHERE code = 'PR2_PHASE1';

  -- Step 1: Renumber existing steps to make room
  -- Step 3 → Step 4
  UPDATE approval_steps
  SET step_order = 4
  WHERE workflow_id = v_pr2p1_wf AND step_order = 3;

  -- Step 2 → Step 3
  UPDATE approval_steps
  SET step_order = 3
  WHERE workflow_id = v_pr2p1_wf AND step_order = 2;

  -- Step 2: Insert Department Head step
  INSERT INTO approval_steps (workflow_id, step_order, role_required, position_required, action_label, is_final)
  VALUES (v_pr2p1_wf, 2, 'approver', 'Department Head', 'Certified By', false);

  -- Step 3: Update active instances (if any)
  -- This is complex and may require manual intervention

  -- Step 4: Restore auto-approval logic in code
  -- (Manual code change required)

END $$;
```

**Note**: Rollback is possible but requires code changes to restore auto-approval logic.

---

## Recommendation

✅ **PROCEED** with the proposed 3-step workflow after stakeholder approval.

The benefits significantly outweigh the risks, and the migration is straightforward with proper testing.
