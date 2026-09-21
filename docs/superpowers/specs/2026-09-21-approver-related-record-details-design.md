# Approver related-record detail access

The user authorized allowing Supervisor and Department Head approvers to open RFQ, Delivery, and GRN records after the read-only access audit. The existing module restrictions and commercial-pricing policy remain in force.

## Approach

Allow `approver` users with position `Supervisor` or `Department Head` through the shared route guard for UUID detail routes `/rfq/{id}`, `/delivery/{id}`, and `/grn/{id}` only. Do not admit module lists, new routes, nested edit/print routes, or other approver positions. Existing Director and PR2/PO print exceptions remain unchanged. Existing database row policies still determine which records can be read.

Reuse the existing detail pages. Delivery and GRN already restrict operational controls to the appropriate roles. RFQ needs an explicit management capability for procurement/admin, checked by mutation handlers as well as controls and modals. Approvers can inspect RFQ request information and status; supplier quotations and price information keep their existing restrictions. Hide the supplier/comparison section when commercial pricing is unavailable so restricted data is not presented as missing suppliers.

Keep approver navigation inside permitted document routes: View PR2 goes to the approval detail route, and back navigation uses existing role-aware behavior. No database policies or server APIs are broadened.

An alternative was creating three new approval-specific detail pages; this would duplicate existing display and data-loading logic. Broadly allowing the entire modules would exceed the requested read-only scope. Narrow detail access is the smallest change that preserves the current application structure.

## Verification

Run route/middleware regressions for allowed detail URLs, denied lists/create/nested routes, both affected positions, and existing roles. Render RFQ with controlled data for draft/open/closed states to verify approvers cannot issue/reopen/close, contact or assign suppliers, enter quotes, or select winners, while procurement retains those controls. Verify prices remain hidden and View PR2 uses `/approvals/pr2/{id}`. Run TypeScript and targeted lint; compare unrelated baseline failures if present.

## Workspace

Implement in the existing checkout because it contains the user's uncommitted PR2/PO link work needed by this flow. Preserve all unrelated modifications. No commit, deployment, database change, or external messages are part of this request.
