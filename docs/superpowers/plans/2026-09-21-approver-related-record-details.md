# Approver Related Record Details Implementation Plan

> Execute the independent route and RFQ tasks in this session with subagent-driven-development and test-driven-development. Preserve the existing working tree changes.

**Goal:** Let Supervisor and Department Head approvers read related RFQ, Delivery, and GRN details while retaining module, editing, and pricing restrictions.

**Architecture:** Add a narrow exception to the shared route guard, then make the existing RFQ page explicitly read-only for approvers. Reuse existing Delivery/GRN action guards and existing database policies.

**Tech Stack:** Next.js, React, TypeScript, Node's built-in test runner and the installed TypeScript compiler.

### Task 1: Route access

- [ ] Add `scripts/test-approver-related-record-access.cjs` using the installed TypeScript compiler to load the actual shared guard and middleware in memory. Assert UUID details pass for Supervisor/Department Head and list, new, nested edit/print and unsupported module routes stay blocked. Assert other roles retain their access, including Director's exception.
- [ ] Run `node --test scripts/test-approver-related-record-access.cjs`; confirm the newly allowed cases fail before implementation.
- [ ] Update `config/route-access.ts` to recognize only the three UUID detail routes and the two requested approver positions. Apply the exception in `isRoleAllowedForPath` without changing the broad role rules.
- [ ] Repeat the focused test and inspect the diff.

### Task 2: RFQ read-only behavior

- [ ] Add `scripts/test-rfq-approver-readonly.cjs` to render the actual RFQ component with controlled auth/data hooks. Assert approvers cannot reach mutation controls or handlers, commercial data remains restricted, the detail stays readable, and View PR2 uses its approval URL.
- [ ] Run `node --test scripts/test-rfq-approver-readonly.cjs` and confirm failures identify the existing controls/navigation.
- [ ] Update `app/rfq/[id]/page.tsx` with a procurement/admin management capability; apply it to mutation handlers, supplier contact/export, quote selection, assignment, external quote and justification modals, and management guidance. Preserve display-only content and existing commercial visibility.
- [ ] Route View PR2 to `/approvals/pr2/{id}` for approvers. Display a clear restriction message where supplier/quotation details are unavailable to the role.
- [ ] Repeat the focused render tests, including procurement controls and Director read-only pricing access.

### Task 3: Review and verification

- [ ] Review requirements and code quality independently, then address concrete findings.
- [ ] Run both focused Node test files, `node node_modules/typescript/bin/tsc --noEmit --incremental false`, and targeted Next lint with caching disabled.
- [ ] Inspect final diff and report verification outcomes and any live-account validation limitations.
