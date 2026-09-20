# Approver Document Link Access

## Goal

Allow Supervisor and Department Head users to open PR2 and PO records that are part of their approval work, without granting them Procurement authoring or editing capabilities.

## Current problem

Approval queues contain revision links that point to the Procurement routes (`/pr2/:id` and `/po/:id`). Those routes are intentionally restricted by role, so approvers are redirected to `/dashboard?access=denied` before the record loads.

## Design

Use the existing approval detail routes as the approver-facing read-only surface:

- PR2 review/revision links resolve to `/approvals/pr2/:instanceId`.
- PO review/revision links resolve to `/approvals/po/:instanceId`.
- Existing approval detail pages continue to show action controls only when the current workflow step matches the user’s role, position, and department.
- The Procurement routes (`/pr2`, `/pr2/new`, `/po`, `/po/new`, and their edit flows) remain restricted to Procurement/Admin behavior.

The change is limited to link targets and regression coverage. No RLS broadening is needed because approval detail queries already use the approver-scoped document policies.

## Validation

Verify that:

1. Supervisor and Department Head users can open PR2 and PO approval detail links, including revision links.
2. They cannot access Procurement creation/edit actions.
3. Procurement users retain their existing links and actions.
4. The redirect to `/dashboard?access=denied` no longer occurs for approver revision links.
