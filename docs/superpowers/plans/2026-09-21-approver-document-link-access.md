# Approver Document Link Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Procurement creation and editing restricted while allowing Supervisor and Department Head users to open PR2 and Purchase Order approval records, including revision links, in read-only approval routes.
**Architecture:** Correct the approval queue revision links so they stay under `/approvals/...`, where the existing role guard and approver-scoped database policies apply. Do not broaden RLS or procurement routes.
**Tech Stack:** Next.js, React, TypeScript, existing project lint/type checks.

---

### Task 1: Correct PR2 approval revision links

- [x] Update the PR2 approval queue revision branch to link to `/approvals/pr2/{instance_id}`.
- [x] Confirm active review links remain unchanged.

### Task 2: Correct Purchase Order approval revision links

- [x] Update the Purchase Order approval queue revision branch to link to `/approvals/po/{instance_id}`.
- [x] Confirm active review links remain unchanged.

### Task 3: Validate the access boundary

- [ ] Inspect the diff for unintended route or RLS changes.
- [ ] Run the repository's available lint/type validation.
- [ ] Verify the resulting links cannot enter `/pr2/{id}` or `/po/{id}` from approver queues.
