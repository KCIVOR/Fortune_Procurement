# Document F — Screen Inventory
## Fortune Procurement System

**Total screens:** 72 `page.tsx` files  
**Auth source:** `middleware.ts`, `config/route-access.ts`, `hooks/use-require-roles.ts`

---

## Legend

- **Roles:** Minimum role required (admin bypass applies except `/supplier/*`)
- **Tables:** Primary data tables displayed
- **Filters:** FilterBar tabs, search, or status filters

---

## Authentication Screens

| Screen | URL | Roles | Purpose | Buttons / Actions | Related Tables |
|--------|-----|-------|---------|-------------------|----------------|
| Home Redirect | `/` | Public | Redirect to login/dashboard/tsqa | — | — |
| Login | `/login` | Public | Email/password sign-in | Sign In, Forgot Password | `auth.users`, `profiles` |
| Forgot Password | `/forgot-password` | Public | Request reset email | Send Reset Link | `auth.users` |
| Reset Password | `/reset-password` | Public | Set new password from link | Reset Password | `auth.users` |
| Invite Complete | `/invite/complete` | Public | Set password after invite | Complete Setup | `auth.users`, `profiles` |

---

## Dashboard & Utilities

| Screen | URL | Roles | Purpose | Key UI | Related Tables |
|--------|-----|-------|---------|--------|----------------|
| Dashboard | `/dashboard` | Auth | Role-specific home | Role dashboard component | varies by role |
| Profile | `/profile` | Auth | View/edit profile, change password | Save Name, Change Password | `profiles` |
| Messages | `/messages` | Auth | 1:1 messaging inbox | ConversationList, MessageThread, UserSearch | `conversations`, `messages` |
| Messages New | `/messages/new` | Auth | **Orphan** — standalone new conversation | UserSearch picker | `conversations` |
| Bug Track List | `/bugtrack` | Auth | Bug report list | Report Bug, Settings, FilterBar tabs | `bug_reports` |
| Bug Track Detail | `/bugtrack/[id]` | Auth | Bug detail & status update | Status actions, Generate AI Prompt | `bug_reports` |

---

## Employee Screens

| Screen | URL | Roles | Purpose | Buttons / Filters | Status Values | Related Tables |
|--------|-----|-------|---------|-------------------|---------------|----------------|
| My Requests | `/pr1` | employee | List own PR1s | New Request, FilterBar (status/search) | All PR1 statuses | `pr1_requests` |
| New PR1 | `/pr1/new` | employee | Create PR1 | PR1Form: Submit, Add Item | draft | `pr1_requests`, `pr1_items` |
| PR1 Detail | `/pr1/[id]` | employee*, warehouse, procurement, approver, admin | PR1 lifecycle view | Edit, Delete, Print, Priority (proc/approver) | PR1 + lifecycle | `pr1_requests`, `pr1_items`, `approval_instances` |
| Edit PR1 | `/pr1/[id]/edit` | same | Edit draft PR1 | PR1Form save/submit | draft only | `pr1_requests`, `pr1_items` |
| PR1 Print | `/pr1/[id]/print` | role-gated | Printable PR1 | Print | — | `pr1_requests`, `pr1_items` |
| Substitute Queue | `/substitutes` | employee | PR1s with pending substitutes | FilterBar | pending/responded | `substitute_decisions`, `rfq_item_quotes` |
| Substitute Review | `/substitutes/[pr1Id]` | employee | Accept/reject alternatives | Accept, Reject per item | accepted/rejected | `substitute_decisions` |
| Delivery List | `/delivery` | employee, warehouse, procurement | Delivery tracking | FilterBar tabs | delivery statuses | `deliveries` |
| Delivery Detail | `/delivery/[id]` | same | Delivery timeline & actions | Mark Delivered (wh/proc), Follow-up (proc) | delivery statuses | `deliveries`, `delivery_status_history` |

---

## Warehouse Screens

| Screen | URL | Roles | Purpose | Buttons / Filters | Related Tables |
|--------|-----|-------|---------|-------------------|----------------|
| Warehouse Queue | `/warehouse` | warehouse | PR1 validation queue | FilterBar (priority/search), StatCards | `pr1_requests`, `warehouse_validations` |
| Validate PR1 | `/warehouse/[id]` | warehouse | Per-item stock validation | Save, Submit Validation | `warehouse_validations`, `warehouse_validation_items` |
| Warehouse History | `/warehouse/history` | warehouse | Past validations | FilterBar, pagination | `warehouse_validations` |
| GRN List | `/grn` | warehouse, procurement | GRN queue | FilterBar (all/open/closed) | `grn_receipts` |
| GRN Detail | `/grn/[id]` | warehouse, procurement | Receive goods | Save Progress, Close GRN | `grn_receipts`, `grn_items` |
| GRN Print | `/grn/[id]/print` | role-gated | Printable GRN | Print | `grn_receipts`, `grn_items` |

---

## Procurement Screens

| Screen | URL | Roles | Purpose | Buttons / Filters | Related Tables |
|--------|-----|-------|---------|-------------------|----------------|
| PR2 List | `/pr2` | procurement | PR2 requests | FilterBar (status/search) | `pr2_requests` |
| PR2 Detail | `/pr2/[id]` | procurement | Edit PR2, submit approval | Edit items, Submit, Print | `pr2_requests`, `pr2_items` |
| PR2 Print | `/pr2/[id]/print` | role-gated | Printable PR2 | Print | `pr2_requests`, `pr2_items` |
| RFQ Queue | `/rfq` | procurement | Awaiting/Issued RFQ sections | Create RFQ | `rfq_batches`, `pr1_requests` |
| RFQ Detail | `/rfq/[id]` | procurement | Manage RFQ, select winners | Assign Suppliers, Issue, Close, Generate PR2, Viber/Email | `rfq_batches`, `rfq_suppliers`, `rfq_item_quotes`, `supplier_item_selections` |
| PO List | `/po` | procurement | PO list | FilterBar, link to /po/new | `po_requests` |
| PO Generate | `/po/new` | procurement | Generate PO from PR2 | Generate PO | `po_requests`, `pr2_requests` |
| PO Detail | `/po/[id]` | procurement | PO detail, submit approval | Submit for Approval, Print | `po_requests`, `po_items` |
| PO Print | `/po/[id]/print` | role-gated | Printable PO | Print | `po_requests`, `po_items` |
| Accreditation Queue | `/accreditation` | procurement, tsqa, admin | Supplier accreditation review | FilterBar tabs | `supplier_accreditations` |
| Accreditation Detail | `/accreditation/[id]` | same | Review application & docs | Approve, Reject, Request Docs, Under Review | `supplier_accreditations`, `supplier_documents` |
| Product Review Queue | `/accreditation/products` | same | Product review queue | FilterBar tabs | `supplier_products` |
| Product Review Detail | `/accreditation/products/[id]` | same | Review product, create RSE | Verify, Reject, Create RSE | `supplier_products`, `rse_records` |

---

## Approval Screens

| Screen | URL | Roles | Purpose | Buttons / Filters | Related Tables |
|--------|-----|-------|---------|-------------------|----------------|
| Unified Approval Queue | `/approvals` | approver, procurement | PR1+PR2+PO sections | Act, View links | `approval_instances` |
| Approval History | `/approvals/history` | approver, procurement | Signed approval history | FilterBar, pagination | `approval_actions` |
| PR1 Approval Queue | `/approvals/pr1` | approver, procurement | PR1-only queue | FilterBar (status/search) | `approval_instances` |
| PR2 Approval Queue | `/approvals/pr2` | approver, procurement | PR2-only queue | FilterBar | `approval_instances` |
| PO Approval Queue | `/approvals/po` | approver, procurement | PO-only queue | FilterBar | `approval_instances` |
| PR1 Approval Detail | `/approvals/[id]` | approver, procurement | Approve/reject/revision PR1 | Approve, Reject, Request Revision | `approval_instances`, `pr1_requests` |
| PR2 Approval Detail | `/approvals/pr2/[id]` | approver, procurement | Approve/reject PR2 (phase 1/2) | Approve, Reject, Request Revision | `approval_instances`, `pr2_requests` |
| PO Approval Detail | `/approvals/po/[id]` | approver, procurement | Approve/reject PO | Approve, Reject, Request Revision | `approval_instances`, `po_requests` |

---

## Supplier Portal Screens

| Screen | URL | Roles | Purpose | Buttons / Filters | Related Tables |
|--------|-----|-------|---------|-------------------|----------------|
| Quotations Inbox | `/supplier/quotations` | supplier | RFQ inbox | FilterBar, StatCards | `rfq_suppliers`, `rfq_batches` |
| Submit Quotation | `/supplier/quotations/[rfqSupplierId]` | supplier | Quote line items | Submit, Select from Catalog | `rfq_item_quotes`, `supplier_products` |
| Supplier PO List | `/supplier/po` | supplier | PO list | FilterBar (awaiting/acknowledged) | `po_requests` |
| Supplier PO Detail | `/supplier/po/[id]` | supplier | PO detail & acknowledge | Acknowledge PO | `po_requests`, `po_receipts` |
| Supplier Delivery List | `/supplier/delivery` | supplier | Delivery list | FilterBar tabs | `deliveries` |
| Supplier Delivery Detail | `/supplier/delivery/[id]` | supplier | Update status, upload DR | Update Status, Upload DR | `deliveries`, `delivery_status_history` |
| Product Catalog List | `/supplier/products` | supplier | Product list | FilterBar, New Product | `supplier_products` |
| New Product | `/supplier/products/new` | supplier | Create catalog product | Submit | `supplier_products` |
| Product Detail | `/supplier/products/[id]` | supplier | Edit/submit/withdraw | Edit, Submit, Withdraw | `supplier_products`, `rse_records` |
| Accreditation Application | `/supplier/accreditation` | supplier | Company accreditation | Submit, Upload Docs, Withdraw | `supplier_accreditations`, `supplier_documents` |

---

## TSQA Screens

| Screen | URL | Roles | Purpose | Buttons / Filters | Related Tables |
|--------|-----|-------|---------|-------------------|----------------|
| TSQA Dashboard | `/tsqa` | tsqa, admin | RSE stats & recent queue | Link to RSE Queue | `rse_records` |
| RSE Queue | `/tsqa/rse` | tsqa, admin | Full RSE queue | FilterBar, pagination | `rse_records` |
| RSE Evaluation | `/tsqa/rse/[id]` | tsqa, admin | Scientific evaluation | Start Review, Submit Pass/Fail | `rse_records`, `tsqa_reviews` |

---

## Admin Screens

| Screen | URL | Roles | Purpose | Buttons / Modals | Related Tables |
|--------|-----|-------|---------|------------------|----------------|
| Admin Landing | `/admin` | admin | **Orphan** — AdminDashboard duplicate | — | — |
| User Management | `/admin/users` | admin | User list & create | Create User (modal), FilterBar, Status column | `profiles`, `roles`, `positions` |
| User Detail | `/admin/users/[id]` | admin | User profile view | Reset Password (modal), Deactivate/Reactivate (dialogs) | `profiles` |
| Edit User Assignment | `/admin/users/[id]/edit` | admin | Change role/dept/position | Save Assignment | `profiles` |
| Roles | `/admin/roles` | admin | Read-only roles list | — | `roles` |
| Positions | `/admin/positions` | admin | Position CRUD | Create/Edit (dialog), Deactivate/Reactivate | `positions` |
| Departments | `/admin/departments` | admin | Department CRUD | Create/Edit (dialog), Deactivate/Reactivate | `departments` |
| Audit Logs | `/admin/audit` | admin | System audit trail | FilterBar, row click → detail modal | `audit_logs` |
| Module Visibility | `/admin/module-visibility` | admin | Sidebar module config | Toggle visibility, Add Module (dialog) | `role_position_module_visibility` |
| Workflows | `/admin/workflows` | admin | Approval workflow steps | Add/Edit/Delete step (dialogs) | `approval_workflows`, `approval_steps` |

---

## Dev-Only Screens (404 in Production)

| Screen | URL | Flag |
|--------|-----|------|
| Test Dashboard | `/test-dashboard` | UI prototype, no real data |
| Test Filter | `/test-filter` | FilterBar demo, delete candidate |

---

## Header Utilities (All Authenticated Roles)

| Element | Location | Action | Related |
|---------|----------|--------|---------|
| Notification Bell | TopHeader | Dropdown, mark read | `notifications` |
| Messages Icon | TopHeader | Navigate to `/messages` | `conversations` |
| Bug Track Link | TopHeader | Navigate to `/bugtrack` | `bug_reports` |
| Profile Avatar | TopHeader | Navigate to `/profile` | `profiles` |
| Department / Position | TopHeader | Display only | `profiles` |

---

## Modals Inventory

| Modal | Trigger Screen | Purpose |
|-------|----------------|---------|
| CreateUserModal | `/admin/users` | Create new user |
| ResetPasswordModal | `/admin/users/[id]` | Admin password reset |
| UserDeactivateDialog | `/admin/users/[id]` | Confirm user deactivation |
| UserReactivateDialog | `/admin/users/[id]` | Confirm user reactivation |
| AuditLogDetail | `/admin/audit` | Audit log detail view |
| Department/Position Create/Edit Dialogs | Admin pages | CRUD dialogs |
| Department/Position Deactivate/Reactivate Dialogs | `/admin/departments`, `/admin/positions` | Master-data soft-delete confirmations |
| Workflow Step Form/Delete | `/admin/workflows` | Step management |
| Add Module Dialog | `/admin/module-visibility` | Borrow modules from other roles |
| AssignSuppliersModal | `/rfq/[id]` | Assign suppliers to RFQ |
| JustificationModal | `/rfq/[id]` | Raw material award justification |
| Catalog Product Picker | Supplier quotation page | Select catalog product for quote line |
| Withdraw Product/Accreditation AlertDialog | Supplier pages | Withdraw confirmations |
| ReportBugModal / BugTrackSettingsModal | `/bugtrack` | Bug reporting & settings |
| AIReadyPromptModal | `/bugtrack/[id]` | Generate AI debug prompt |
| GRN Close Confirm | `/grn/[id]` | Confirm GRN closure |

---

## Orphan / Dead Routes Summary

| Route | Issue |
|-------|-------|
| `/admin` | Not in sidebar; duplicates dashboard |
| `/messages/new` | No in-app links; superseded by inline search |
| `/test-dashboard`, `/test-filter` | Dev-only, blocked in production |
| Print sub-routes | Accessed from detail Print buttons only |
