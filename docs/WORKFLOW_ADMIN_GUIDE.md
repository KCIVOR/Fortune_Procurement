# Workflow Admin Configuration - User Guide

**Version**: 1.0  
**Last Updated**: May 21, 2026  
**Audience**: System Administrators

---

## 📖 Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Understanding Workflows](#understanding-workflows)
4. [Managing Approval Steps](#managing-approval-steps)
5. [Best Practices](#best-practices)
6. [Special Workflows](#special-workflows)
7. [Troubleshooting](#troubleshooting)

---

## Overview

The Workflow Admin Configuration feature allows administrators to dynamically configure approval workflows without requiring code changes. You can add, edit, reorder, and delete approval steps to customize how documents flow through your organization.

### What You Can Do

- ✅ View all approval workflows and their steps
- ✅ Add new approval steps to workflows
- ✅ Edit existing step properties (role, position, action label)
- ✅ Delete unused approval steps
- ✅ Mark which step is the final approval
- ✅ See warnings for workflows with special business logic

### What You Cannot Do

- ❌ Create entirely new workflows (only modify existing ones)
- ❌ Delete workflows
- ❌ Change workflow codes or names
- ❌ Modify steps while active approvals are in progress (not recommended)

---

## Getting Started

### Accessing Workflow Configuration

1. **Login** as an administrator
2. **Navigate** to the Admin section
3. **Click** on "Workflows" or go to `/admin/workflows`

### Page Layout

The Workflow Configuration page has two main sections:

1. **Workflow List** (top): Shows all available workflows
2. **Step Editor** (bottom): Appears when you select a workflow

---

## Understanding Workflows

### Current Workflows

Your system has 4 approval workflows:

| Code | Name | Purpose | Steps |
|------|------|---------|-------|
| **PR1_APPROVAL** | PR1 Approval Routing | Simple purchase requisitions | 2 |
| **PR2_PHASE1** | PR2 Phase 1 Routing | Complex PR initial approval | 4 |
| **PR2_PHASE2** | PR2 Phase 2 Routing | Complex PR final approval | 3 |
| **PO_APPROVAL** | PO Approval Routing | Purchase order approval | 4 |

### Workflow Properties

Each workflow displays:

- **Code**: Unique identifier (e.g., PR1_APPROVAL)
- **Name**: Human-readable description
- **Steps**: Number of approval steps configured
- **Active Instances**: Number of ongoing approvals using this workflow
- **Status**: Active or Inactive

⚠️ **Warning**: If a workflow has active instances, changes may affect ongoing approvals. Wait for instances to complete before making major changes.

---

## Managing Approval Steps

### Viewing Steps

1. **Click** on a workflow in the list
2. The **Step Editor** appears below
3. Review the step details:
   - **Order**: Sequential number (1, 2, 3...)
   - **Role**: Required role (approver, procurement, supplier, warehouse)
   - **Position**: Required position title
   - **Action Label**: Text shown in approval timeline
   - **Final**: Whether this is the last approval step

### Adding a New Step

1. **Select** a workflow
2. **Click** the "Add Step" button
3. **Fill in** the form:
   - **Step Order**: Enter the sequence number (e.g., 3)
   - **Role Required**: Select the role (e.g., approver)
   - **Position Required**: Select the position (filtered by role)
   - **Action Label**: Enter the label (e.g., "Approved By")
   - **Is Final Step**: Check if this is the last approval
4. **Click** "Create Step"

#### Tips for Adding Steps

- The form suggests the next available step order
- Positions are filtered based on the selected role
- Only one step can be marked as "final"
- If you mark a new step as final, the previous final step is automatically unmarked

### Editing a Step

1. **Click** the "Edit" button next to a step
2. **Modify** the fields you want to change
3. **Click** "Update Step"

#### What You Can Edit

- ✅ Step order (to reorder steps)
- ✅ Role required
- ✅ Position required
- ✅ Action label
- ✅ Final step flag

#### What Happens When You Edit

- If you change the position, future approvals will require the new position
- If you change the step order, the approval flow sequence changes
- If you mark a different step as final, the previous final step is unmarked
- All changes are logged in the audit trail

### Deleting a Step

1. **Click** the "Delete" button next to a step
2. **Review** the dependency check:
   - Active instances using this workflow
   - Historical approval actions referencing this step
3. **Confirm** deletion if allowed

#### When You Cannot Delete

- ❌ Workflow has active approval instances
- ❌ Would leave workflow with no steps

#### When You Can Delete (with Warning)

- ⚠️ Historical approval actions reference this step order
- The historical data remains intact, but the step configuration is removed

---

## Best Practices

### 1. Plan Before Making Changes

- Review the current workflow structure
- Understand the approval flow
- Consider the impact on ongoing approvals

### 2. Wait for Active Instances to Complete

- Check the "Active Instances" count
- If > 0, wait for approvals to finish
- Or coordinate with users to complete pending approvals

### 3. Test with a Single Document

- After making changes, test with one document
- Verify the approval flow works as expected
- Check that the right people can approve

### 4. Use Clear Action Labels

Good examples:
- ✅ "Reviewed By"
- ✅ "Approved By"
- ✅ "Acknowledged By"
- ✅ "Final Approved By"

Avoid:
- ❌ "Step 1"
- ❌ "OK"
- ❌ Generic labels

### 5. Maintain Sequential Step Orders

- Keep step orders sequential: 1, 2, 3, 4...
- Don't skip numbers (e.g., 1, 3, 5)
- The system validates this automatically

### 6. Document Your Changes

- Note why you made the change
- Inform affected users
- Update any process documentation

---

## Special Workflows

Some workflows have special business logic that runs automatically. Be careful when editing these steps.

### PR2_PHASE1 - Auto-Approval Logic

**Steps with Special Logic**: Step 1 and Step 2

**What Happens**:
- If Step 1 approves AND there are no alternative items
- Step 2 is automatically approved (skipped)

**Warning When Editing**:
> ⚠️ This step has special auto-approval logic. If Step 1 approves and there are no alternatives, Step 2 is automatically approved. Changing the position may affect this automated workflow.

**Recommendation**:
- Keep Step 1 as a procurement role
- Test auto-approval after changes
- Verify Step 2 still gets auto-approved when conditions are met

### PO_APPROVAL - Delivery Creation

**Step with Special Logic**: Step 4

**What Happens**:
- When Step 4 is approved (supplier acknowledgment)
- A delivery tracking record is automatically created

**Warning When Editing**:
> ⚠️ This step triggers delivery tracking creation. Ensure the position remains a supplier role to maintain proper delivery workflow functionality.

**Recommendation**:
- Keep Step 4 as a supplier role
- Test delivery creation after changes
- Verify delivery records are created correctly

---

## Troubleshooting

### Problem: "Step order already exists"

**Cause**: You're trying to create a step with an order number that's already used.

**Solution**: Choose a different step order, or edit the existing step.

---

### Problem: "Position belongs to role X, not Y"

**Cause**: The selected position doesn't match the selected role.

**Solution**: 
1. Check the position's role in the Positions admin page
2. Select a position that matches your chosen role
3. Or select a different role that matches the position

---

### Problem: "Cannot delete: X active approval instances"

**Cause**: The workflow has ongoing approvals.

**Solution**:
1. Wait for active approvals to complete
2. Check the Approvals page to see pending items
3. Coordinate with users to finish approvals
4. Try deleting again when count reaches 0

---

### Problem: "Workflow must have exactly one final step"

**Cause**: Either no steps are marked as final, or multiple steps are marked as final.

**Solution**:
1. Edit one step and mark it as final
2. The system automatically unmarks other final steps
3. Ensure exactly one step has the "Final" flag

---

### Problem: Changes don't appear in approval flow

**Cause**: You may be viewing an old approval instance created before the change.

**Solution**:
1. Changes only affect NEW approval instances
2. Existing approvals use the workflow configuration from when they were created
3. Submit a new document to test the updated workflow

---

### Problem: Wrong person can approve

**Cause**: The step's position doesn't match the intended approver.

**Solution**:
1. Check the step's position requirement
2. Verify the user's position in their profile
3. Edit the step to use the correct position
4. Or update the user's position in User Management

---

## Need Help?

If you encounter issues not covered in this guide:

1. **Check the audit logs** to see what changes were made
2. **Review the test validation document** for known issues
3. **Contact your system administrator** for assistance
4. **Refer to the technical documentation** for advanced troubleshooting

---

## Appendix: Roles and Positions

### Understanding Roles vs Positions

**Role**: A broad category of user type
- Examples: approver, procurement, supplier, warehouse, admin

**Position**: A specific job title within a role
- Examples: Supervisor, Department Head, Director (all under "approver" role)
- Examples: Buyer, Procurement Manager, Procurement Staff (all under "procurement" role)

### Why Both Matter

- **Role** determines general permissions and access
- **Position** determines specific approval authority
- A step requires BOTH a role AND a position to match

### Special Note: Approver and Procurement Role Flexibility

**Important**: The "approver" and "procurement" roles are **interchangeable** in the approval system. This means:

- When you select "approver" role, you'll see positions from both "approver" AND "procurement" roles
- When you select "procurement" role, you'll see positions from both "procurement" AND "approver" roles
- This flexibility allows procurement staff (like Buyers) to approve steps marked as "approver" and vice versa

**Why this matters**: If you're configuring a step and need a "Buyer" position, you can select either "approver" or "procurement" as the role - both will work.

### Example

```
Step 1:
  Role Required: approver
  Position Required: Buyer (from procurement role)
  
This is VALID because approver and procurement roles are interchangeable.
A user with role="procurement" AND position="Buyer" can approve this step.
```

---

**End of User Guide**
