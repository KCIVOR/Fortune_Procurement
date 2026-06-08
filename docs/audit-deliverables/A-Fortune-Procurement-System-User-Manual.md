# Fortune Procurement System — User Manual

**Date Prepared:** June 6, 2026  
**Version:** 3.0 (Codebase-Verified Audit Edition)  
**Prepared by:** System Architecture Audit (automated from verified codebase)

---

## Table of Contents

1. [Revision History](#revision-history)
2. [Introduction](#introduction)
3. [Getting Started](#getting-started)
4. [User Roles & Access Levels](#user-roles--access-levels)
5. [User Interface Overview](#user-interface-overview)
6. [Data Table Operations](#data-table-operations)
7. [Functional Instructions — Module-by-Module Guide](#functional-instructions--module-by-module-guide)
8. [Troubleshooting & FAQs](#troubleshooting--faqs)
9. [Appendices](#appendices)
10. [Glossary](#glossary)

---

## Revision History

| Ver. | Date | Document Changes | Author |
|------|------|------------------|--------|
| 1.0 | Aug 2025 | HRIS User Manual (separate product — not applicable) | — |
| 2.0 | — | Fortune Procurement System v2.0 draft | — |
| 3.0 | Jun 6, 2026 | Complete rewrite from codebase audit — all content verified against routes, schema, workflows, and permissions | System Audit |

---

## Introduction

### Purpose

This user manual is the authoritative reference for operating the **Fortune Procurement System**. It documents only functionality verified in the application codebase, database schema, and workflow configuration.

The system automates the complete procurement lifecycle:

- Employee purchase requests (PR1)
- Warehouse stock validation
- Multi-step approval routing
- Request for Quotation (RFQ) and supplier canvassing
- Substitute item review
- Purchase Request 2 (PR2) with dual-phase approval
- Purchase Order (PO) generation and approval
- Supplier acknowledgment
- Delivery tracking
- Goods Receipt Note (GRN)
- Supplier accreditation and product catalog management
- Request for Sample Evaluation (RSE) and TSQA scientific review

This manual provides step-by-step procedures, role-based access guidance, navigation instructions, and troubleshooting for daily operations.

### System Scope

The Fortune Procurement System is a web-based procurement platform built on Next.js and Supabase. It is **not** an HRIS — it does not include payroll, attendance, leave, recruitment, or performance management.

#### Core Modules (Verified)

| Module | Description |
|--------|-------------|
| **PR1 — Purchase Request** | Employees create and submit purchase requisitions with line items |
| **Warehouse Validation** | Warehouse staff verify stock availability and route items (internal vs procurement) |
| **PR1 Approval** | Supervisor reviews and notes; Department Head gives final approval |
| **RFQ / Canvassing** | Procurement issues RFQs, invites suppliers, collects quotes, selects winners |
| **Substitute Review** | Employees accept or reject alternative supplier items |
| **PR2 — Purchase Request 2** | Procurement generates canvass slip with dual-phase approval (Phase 1 + Phase 2) |
| **Purchase Orders** | Buyer generates PO from approved PR2; multi-step approval ending with Finance Director |
| **Supplier Portal** | External suppliers submit quotes, acknowledge POs, track deliveries, manage catalog |
| **Delivery Tracking** | End-to-end shipment status from PO acknowledgment through delivery |
| **GRN — Goods Receipt** | Warehouse records received quantities and closes receipt |
| **Supplier Accreditation** | Company-level supplier qualification with document upload |
| **Product Catalog** | Supplier product registration with procurement and TSQA review |
| **RSE / TSQA** | Scientific sample evaluation for product compliance |
| **Administration** | User management, org structure, workflows, module visibility, audit logs |
| **Notifications** | In-app bell notifications for workflow events |
| **Messaging** | Internal 1:1 messaging between users |
| **BugTrack** | Internal bug reporting with email alerts |

#### Modules NOT Present

Payroll, attendance, leave, employee 201 file, performance management, recruitment, training, HR calendar, general finance, assets management, CRM/client invoicing, multi-language settings.

---

## Getting Started

### How to Access

1. Open your web browser (Chrome, Edge, or Firefox recommended).
2. Navigate to your organization's Fortune Procurement System URL.
3. You will see the **Login** page (`/login`).
4. Enter your **email address** and **password**.
5. Click **Sign In**.
6. After login:
   - **TSQA users** are redirected to `/tsqa`
   - **All other users** are redirected to `/dashboard`
7. Use **Remember Me** to persist your session across browser restarts.

#### First-Time Login (Invited Users)

1. Admin sends an invite email via User Management.
2. Click the link in the invite email.
3. You arrive at `/invite/complete`.
4. Set your password and confirm.
5. You are logged in and redirected to your role dashboard.

#### Password Reset

1. On the login page, click **Forgot Password**.
2. Enter your email on `/forgot-password`.
3. Check your email for the reset link.
4. Click the link to open `/reset-password`.
5. Enter and confirm your new password.

#### Demo Accounts (Development)

The login page may display demo credentials for testing. Default demo password: `Fortune2024!` (seeded in migrations).

---

## User Roles & Access Levels

The system has **7 roles** and **14 positions**. Your role determines which modules you can access. Your position determines which approval steps you can act on.

### Role Summary

| Role | Who Uses It | Primary Tasks |
|------|-------------|---------------|
| **Employee** | Internal staff requesting items | Create PR1, track deliveries, review substitutes |
| **Warehouse** | Warehouse operations staff | Validate PR1 stock, receive goods (GRN), track deliveries |
| **Procurement** | Procurement department | RFQ, PR2, PO, supplier accreditation, product review, partial approvals |
| **Approver** | Supervisors and managers | Approve PR1, PR2 (Director only), PO (Finance Director) |
| **Supplier** | External vendor representatives | Submit quotes, acknowledge POs, manage deliveries and catalog |
| **Admin** | System administrator | User/org management, workflows, audit logs |
| **TSQA** | Technical/Scientific QA staff | RSE scientific evaluation |

### Position-Based Approval Authority

| Workflow | Step | Position Required |
|----------|------|-------------------|
| PR1 | 1 | Supervisor |
| PR1 | 2 (final) | Department Head |
| PR2 Phase 1 | 1 | Procurement Staff |
| PR2 Phase 1 | 2 | Procurement Manager |
| PR2 Phase 1 | 3 (final) | Director |
| PR2 Phase 2 | 1 | Buyer |
| PR2 Phase 2 | 2 | Procurement Manager |
| PR2 Phase 2 | 3 (final) | Director |
| PO | 1 | Buyer |
| PO | 2 | Procurement Manager |
| PO | 3 (final internal) | Finance Director |
| PO | 4 | Supplier Representative (acknowledgment) |

### Commercial Price Visibility

Only these roles/positions can see unit prices and totals:
- Admin
- Procurement (all positions)
- Approver with position Director or Finance Director

All other users see "Price hidden" where pricing is displayed.

### Director Special Access

Approvers with position **Director** (not Finance Director) can additionally access logistics modules: GRN, RFQ, PR2, PO, and Delivery Tracking for read/operate purposes.

---

## User Interface Overview

### Navigation Overview

After login, the screen layout consists of:

1. **Sidebar** (left) — Role-specific menu items
2. **Top Header** (top) — Department, position, notification bell, messages, bug track, profile
3. **Main Content Area** (center) — Page content

The sidebar menu is determined by your role. An administrator can further customize which modules appear for specific role+position combinations via Module Visibility settings. Hidden modules can still be accessed by direct URL if your role permits.

### Dashboard Layout

Each role sees a different dashboard at `/dashboard` (TSQA users see `/tsqa` instead):

| Role | Dashboard Content |
|------|-------------------|
| **Employee** | PR1 statistics (total, pending, approved, rejected), pending substitute count, recent requests table, "New Request" button |
| **Warehouse** | Pending validations, validated today, open/closed GRNs, pending PR1 queue, open GRN queue |
| **Procurement** | Awaiting RFQ count, open RFQs, high-priority items, PO count, accreditation queue, pending TSQA |
| **Approver** | Unified PR1+PR2+PO approval queue (actionable steps only), weekly approve/reject statistics |
| **Supplier** | Open RFQs, pending responses, accreditation status, product catalog compliance |
| **Admin** | User/role/position/department counts, recent audit log entries |
| **TSQA** | RSE statistics (created, assigned, under review, passed, failed), recent RSE queue |

### Menu Structure

#### Employee Menu
1. Dashboard
2. My Requests (`/pr1`)
3. Delivery Status (`/delivery`)
4. Substitute Review (`/substitutes`)

#### Warehouse Menu
1. Dashboard
2. Warehouse Queue (`/warehouse`)
3. Goods Receipt (`/grn`)
4. Delivery Tracking (`/delivery`)
5. Warehouse History (`/warehouse/history`)

#### Procurement Menu
1. Dashboard
2. PR2 Requests (`/approvals/pr2`)
3. Canvassing / RFQ (`/rfq`)
4. Purchase Orders (`/po`)
5. Delivery Tracking (`/delivery`)
6. Goods Receipt (`/grn`)
7. Supplier Accreditation (`/accreditation`)
8. Product Review (`/accreditation/products`)
9. Approval Queue (`/approvals`)
10. Approval History (`/approvals/history`)

#### Approver Menu
1. Dashboard
2. PR1 Requests (`/approvals/pr1`)
3. PR2 Requests (`/approvals/pr2`)
4. Purchase Orders (`/approvals/po`)
5. Approval History (`/approvals/history`)

#### Supplier Menu
1. Dashboard
2. Quotations (`/supplier/quotations`)
3. Purchase Orders (`/supplier/po`)
4. Deliveries (`/supplier/delivery`)
5. Product Catalog (`/supplier/products`)
6. Accreditation (`/supplier/accreditation`)

#### TSQA Menu
1. Dashboard (`/tsqa`)
2. RSE Queue (`/tsqa/rse`)

#### Admin Menu
1. Dashboard
2. User Management (`/admin/users`)
3. Roles (`/admin/roles`)
4. Positions (`/admin/positions`)
5. Departments (`/admin/departments`)
6. Workflows (`/admin/workflows`)
7. Module Visibility (`/admin/module-visibility`)
8. Audit Logs (`/admin/audit`)

### Additional Icons & Symbols

| Icon / Element | Location | Function |
|----------------|----------|----------|
| 🔔 Notification Bell | Top header | Shows unread notifications; click to view, mark read, or navigate to action |
| 💬 Messages | Top header | Opens messaging inbox (`/messages`) |
| 🐛 Bug Track | Top header | Opens bug reporting (`/bugtrack`) |
| 👤 Profile Avatar | Top header | Opens profile page (`/profile`) |
| Status Chips | List/detail pages | Color-coded document status (draft, pending, approved, rejected, etc.) |
| Print Button | PR1, PR2, PO, GRN detail pages | Opens printable version in new tab |
| FilterBar | List pages | Search, status tabs, filters, pagination controls |
| StatCards | Dashboard and list pages | Summary count cards at top of pages |

---

## Data Table Operations

Most list screens use the **FilterBar** component with consistent operations:

### Searching
- Type in the search box to filter by document number, name, or description.
- Search is applied in real time or on Enter depending on the page.

### Status Tabs
- Click tab buttons (e.g., All, Pending, Approved, Open, Closed) to filter by status.
- Active tab is highlighted.

### Pagination
- Use **Previous** / **Next** buttons or page numbers at the bottom of tables.
- Page size is fixed per screen (typically 10–20 rows).

### Sorting
- Tables display items in default order (usually most recent first).
- Column-level sorting is not available on most screens.

### Row Actions
- Click a row or the **View** / **Act** link to open the detail page.
- Action buttons (Approve, Edit, Delete) appear on detail pages based on your role and document status.

### Empty States
- When no records match your filters, the table shows an empty state message.
- Adjust filters or create a new record using the action button (e.g., "New Request").

---

## Functional Instructions — Module-by-Module Guide

### Module 1: PR1 — Purchase Request (Employee)

#### Create a New PR1

1. Navigate to **My Requests** (`/pr1`).
2. Click **New Request**.
3. On `/pr1/new`, fill in:
   - **PR1 Number** (your reference number)
   - **Purpose** (reason for the request)
   - **Date Required** (when items are needed)
4. Add line items:
   - **Item Code**, **Description**, **Unit of Measure**
   - **Stock on Hand** (your estimate)
   - **Quantity Requested**
   - **Raw Material** toggle (if applicable for compliance routing)
5. Click **Save as Draft** or **Submit**.

#### Submit a Draft PR1

1. Open the PR1 from My Requests (`/pr1/[id]`).
2. Review all fields and items.
3. Click **Submit**.
4. Status changes to **Pending Warehouse**.
5. Warehouse staff receive a notification.

#### Edit or Delete a Draft

- Only **draft** PR1s can be edited (`/pr1/[id]/edit`) or deleted.
- If an approver requests revision, PR1 status becomes **Revision Requested** and you receive a notification. **Known limitation:** the edit page currently accepts only `draft` status, so resubmission from `revision_requested` may require admin assistance until this path is enabled in code.

#### Track PR1 Status

On the PR1 detail page, view:
- Current status chip
- Lifecycle summary (e.g., "Pending Warehouse", "For Canvassing", "Delivery In Progress")
- Approval timeline with signatory names
- Linked RFQ, PR2, PO, delivery, and GRN records

#### Print a PR1

Click **Print** on the detail page to open `/pr1/[id]/print`.

---

### Module 2: Warehouse Validation (Warehouse)

#### Validate a PR1

1. Navigate to **Warehouse Queue** (`/warehouse`).
2. Click a pending PR1 to open `/warehouse/[id]`.
3. For each line item:
   - Verify **Validated SOH** (stock on hand)
   - Set **Availability** (available / unavailable)
   - Choose **Route**: Internal (fulfill from stock), Procurement (buy externally), or Partial (split)
   - For partial routing, enter **Internal Fulfilled Qty** and **Procurement Qty**
4. Add notes if needed.
5. Click **Submit Validation**.

**Outcomes:**
- **All items internal** → PR1 status = "Resolved Internally" (fulfilled from stock). Employee notified.
- **Any item needs procurement** → PR1 status = "Pending Approval". PR1 approval workflow starts (Supervisor first).

#### View Validation History

Navigate to **Warehouse History** (`/warehouse/history`) for past validations with filters.

---

### Module 3: PR1 Approval (Approver)

#### Approve a PR1

1. Navigate to **PR1 Requests** (`/approvals/pr1`) or the unified **Approval Queue**.
2. Click a pending item to open `/approvals/[id]`.
3. Review PR1 summary and line items.
4. Choose an action:
   - **Approve** — advances to next step or final approval
   - **Reject** — PR1 is rejected; employee notified
   - **Request Revision** — PR1 returns to draft; employee must edit and resubmit
5. Add remarks (optional but recommended for reject/revision).

**Approval chain:** Supervisor (Step 1) → Department Head (Step 2, final). On final approval, PR1 moves to **For Canvassing** and procurement is notified.

---

### Module 4: RFQ / Canvassing (Procurement)

#### Create and Issue an RFQ

1. Navigate to **Canvassing / RFQ** (`/rfq`).
2. In the "Awaiting RFQ" section, find PR1s with status "For Canvassing".
3. Click **Create RFQ** — an RFQ batch is created in draft status.
4. Open the RFQ detail (`/rfq/[id]`).
5. Click **Assign Suppliers** — select suppliers from the modal.
6. Click **Issue RFQ** — status changes to Open.
   - Suppliers receive in-app notifications.
   - Optionally send email invitations via the email action.
   - Optionally copy Viber message text for manual sharing.

#### Review Supplier Quotes

1. When suppliers submit quotes, they appear on the RFQ detail page.
2. Review unit prices, lead times, and alternative items.
3. If alternatives were submitted, the employee must review substitutes first (Module 5).

#### Select Winning Quotes

1. For each PR1 line item, select the winning supplier quote.
2. If awarding an unverified product on a raw material line, the **Justification Modal** requires a written justification.
3. Save selections.

#### Close RFQ and Generate PR2

1. Click **Close RFQ** when all selections are made.
2. PR1 status changes to "Canvassing Complete".
3. Click **Generate PR2** to create the Purchase Request 2.

---

### Module 5: Substitute Review (Employee)

When a supplier quotes an alternative item:

1. Navigate to **Substitute Review** (`/substitutes`).
2. Click a pending PR1 to open `/substitutes/[pr1Id]`.
3. Compare the original request with the alternative offer.
4. For each alternative, click **Accept** or **Reject**.
5. Procurement is notified of your decision.

Only accepted substitutes (or non-alternative quotes) can be selected by procurement in the RFQ.

---

### Module 6: PR2 — Purchase Request 2 (Procurement + Approvers)

#### Edit and Submit PR2

1. Navigate to **Purchase Requests** (`/pr2`) or find PR2 from RFQ detail.
2. Open PR2 detail (`/pr2/[id]`).
3. Review and edit line items (quantities, pricing visibility depends on role).
4. Click **Submit for Approval** to start Phase 1.

#### Phase 1 Approval

| Step | Who Acts | Label |
|------|----------|-------|
| 1 | Procurement Staff | Prepared By |
| 2 | Procurement Manager | Reviewed By |
| 3 | Director | Approved By (final) |

Approvers act on `/approvals/pr2/[id]`.

#### Phase 2 (Auto-Started)

After Phase 1 approval, Phase 2 starts automatically:

| Step | Who Acts | Label |
|------|----------|-------|
| 1 | Buyer | Prepared By |
| 2 | Procurement Manager | Reviewed By |
| 3 | Director | Approved By (final) |

On Phase 2 final approval, PR2 status = "Phase 2 Approved". Employee is notified.

---

### Module 7: Purchase Orders (Procurement + Approvers + Supplier)

#### Generate a PO

1. Navigate to **Purchase Orders** → **New PO** (`/po/new`).
2. View approved PR2 candidates.
3. Select a candidate and enter the **PO Number** (buyer-entered).
4. Click **Generate PO**.
5. Review on `/po/[id]` — edit delivery address, payment terms, packing, remarks.

#### Submit PO for Approval

1. Click **Submit for Approval**.
2. Approval chain:
   - Buyer (Prepared By)
   - Procurement Manager (Reviewed By)
   - Finance Director (Approved By — final internal)
3. Approvers act on `/approvals/po/[id]`.

#### Supplier Acknowledgment

1. After Finance Director approval, PO status = "Approved".
2. Supplier receives notification.
3. Supplier opens `/supplier/po/[id]`.
4. Clicks **Acknowledge PO**, enters commitment date and remarks.
5. PO status = "Sent". Delivery record is auto-created.

---

### Module 8: Delivery Tracking

#### Supplier Updates Delivery

1. Supplier navigates to **Deliveries** (`/supplier/delivery`).
2. Opens delivery detail (`/supplier/delivery/[id]`).
3. Updates status: Scheduled → In Transit → Delivered (or Delayed).
4. When setting **In Transit**, upload a Delivery Receipt (DR) document (PDF/JPG/PNG, max 10 MB).
5. Employee receives notifications on status changes.

#### Internal Tracking

- **Employee** views own deliveries at `/delivery`.
- **Warehouse/Procurement** can mark delivery as **Delivered** and open GRN.

---

### Module 9: GRN — Goods Receipt (Warehouse)

#### Receive Goods

1. Navigate to **Goods Receipt** (`/grn`).
2. Open an open GRN (`/grn/[id]`) — created from a delivered PO.
3. Enter for each line:
   - **Quantity Received**
   - **Quantity Rejected** (damaged/unacceptable)
   - Line remarks
4. Fill header: DR Number, DR Date, Transaction Date, Remarks.
5. Click **Save Progress** to save without closing.

#### Close GRN

1. Click **Close GRN** (confirmation dialog appears).
2. GRN status = "Closed". Delivery forced to "Delivered".
3. Employee notified. Request lifecycle shows "Completed (GRN Closed)" when all POs are closed.

#### Print GRN

Click **Print** to open `/grn/[id]/print`.

---

### Module 10: Supplier Accreditation (Supplier + Procurement)

#### Supplier: Apply for Accreditation

1. Navigate to **Accreditation** (`/supplier/accreditation`).
2. Fill company information.
3. Upload required documents (PDF/JPG/PNG, max 20 MB each).
4. Click **Submit Application**.
5. Procurement is notified.

#### Procurement: Review Accreditation

1. Navigate to **Supplier Accreditation** (`/accreditation`).
2. Open application (`/accreditation/[id]`).
3. Review documents. Actions:
   - **Mark Under Review**
   - **Approve** — supplier can participate in RFQs
   - **Reject** — with review notes
   - **Request Missing Documents** — supplier can re-submit

#### Supplier: Withdraw

Click **Withdraw Application** on the supplier accreditation page (if submitted).

---

### Module 11: Product Catalog (Supplier + Procurement + TSQA)

#### Supplier: Register a Product

1. Navigate to **Product Catalog** (`/supplier/products`).
2. Click **New Product** (`/supplier/products/new`).
3. Fill product name, code, category, description, specifications.
4. Upload supporting documents.
5. Click **Submit for Review**.

#### Procurement: Review Product

1. Navigate to **Product Review** (`/accreditation/products`).
2. Open product (`/accreditation/products/[id]`).
3. Actions:
   - **Mark Under Review**
   - **Verify** (direct approval without TSQA)
   - **Reject**
   - **Create RSE** (route to TSQA for scientific evaluation)

#### TSQA Path

If RSE is created, product status = "Pending TSQA". See Module 12.

---

### Module 12: RSE / TSQA (Procurement + TSQA)

#### Procurement: Create RSE

1. From product review detail, click **Create RSE**.
2. Optionally assign a TSQA reviewer.
3. RSE record created; product status = "Pending TSQA".

#### TSQA: Evaluate

1. Navigate to **RSE Queue** (`/tsqa/rse`).
2. Open RSE (`/tsqa/rse/[id]`).
3. Click **Start Review** (self-assigns if unassigned).
4. Review product documents and conduct testing.
5. Submit **Pass** or **Fail** with findings and remarks.
6. Product status updates to Verified (pass) or Rejected (fail). Supplier and procurement notified.

---

### Module 13: Approvals (Approver + Procurement)

The unified **Approval Queue** (`/approvals`) shows three sections:
- PR1 Approvals
- PR2 Approvals
- PO Approvals

Each section lists only items where you are the current-step approver (matching your role and position).

**Approval History** (`/approvals/history`) shows all past signed actions with filters.

---

### Module 14: Notifications

1. Click the **bell icon** in the top header.
2. Unread notifications show a badge count.
3. Click a notification to navigate to the related document.
4. Mark individual notifications as read, or **Mark All Read**.

Notification types: Action Required, Info, Approved, Rejected.

---

### Module 15: Messaging

1. Click the **messages icon** in the top header.
2. On `/messages`, use **User Search** to find a colleague and start a conversation.
3. Type messages in the thread panel.
4. Attach files (images, PDF, Office docs — max 10 MB, up to 5 per message).

---

### Module 16: BugTrack

1. Navigate to `/bugtrack` via the header link.
2. Click **Report Bug** to file a new issue.
3. Fill title, description, expected behavior, severity, and location.
4. Admin users can update bug status (Open → In Progress → Resolved → Closed).
5. Email notification sent to configured admin email on new reports.

---

### Module 17: Administration (Admin)

#### User Management (`/admin/users`)

- **Create User** — set email, name, role, department, position, optional password
- **Invite User** — sends email invite link (blocked if email belongs to a deactivated account — reactivate first)
- **Reset Password** — admin sets new password
- **Edit Assignment** — change role, department, position
- **Deactivate User** — soft-deactivate from user detail page; user cannot sign in; historical PRs/approvals preserved
- **Reactivate User** — restore sign-in access from user detail page

**Deactivate / reactivate rules (verified):**

- Admin cannot deactivate their own account
- Admin cannot deactivate the last active administrator
- Deactivated users are blocked at login, on session refresh, and on protected routes
- User list shows Active/Inactive status; inactive rows appear dimmed
- Actions are recorded in Audit Logs as `USER_DEACTIVATED` or `USER_REACTIVATED`

#### Roles (`/admin/roles`)

- View-only list of roles with user counts

#### Positions (`/admin/positions`)

- Create, edit, deactivate, reactivate positions

#### Departments (`/admin/departments`)

- Create, edit, deactivate, reactivate departments

#### Workflows (`/admin/workflows`)

- Select workflow (PR1, PR2 Phase 1, PR2 Phase 2, PO)
- Add, edit, reorder, or delete approval steps
- Set role, position, action label, and final-step flag

#### Module Visibility (`/admin/module-visibility`)

- Select role and position
- Toggle sidebar module visibility
- Add modules from other roles ("borrow" modules)

#### Audit Logs (`/admin/audit`)

- View system audit trail with filters (action, document type, date range)
- Click a row for detail modal with payload JSON

---

## Troubleshooting & FAQs

### Common Issues and Solutions

| Issue | Solution |
|-------|----------|
| Cannot access a page (Access Denied) | Your role does not have permission for that route. Contact admin to verify your role and position assignment. |
| Cannot see prices | Price visibility is restricted to admin, procurement, and Director/Finance Director approvers. |
| Approval button not visible | Your position must exactly match the current workflow step. Verify with admin. |
| PR1 stuck at Pending Warehouse | Warehouse has not yet submitted validation. Contact warehouse staff. |
| Cannot submit PR1 | Ensure at least one line item exists and all required fields are filled. Only drafts can be submitted. |
| Supplier cannot log in | Supplier must use the supplier portal (`/supplier/*`). Admin accounts cannot access supplier routes. |
| Notification not received | Check the bell icon. Notifications are in-app only (except RFQ emails to suppliers and bug report emails). |
| PR1 revision requested but cannot edit | Edit page allows only `draft` status; `revision_requested` resubmit path is not fully wired. Contact admin. |
| File upload fails | Check file type (PDF/JPG/PNG for docs) and size limits (10–20 MB). |
| Module missing from sidebar | Admin may have hidden it via Module Visibility. Route may still be accessible by URL. |

### Frequently Asked Questions

**Q: What is the difference between PR1 and PR2?**  
A: PR1 is the employee's initial purchase request. PR2 is the procurement-managed canvass slip generated after RFQ, containing selected supplier quotes and pricing.

**Q: Why does PR2 have two approval phases?**  
A: Phase 1 validates the canvass selection (Procurement Staff → Procurement Manager → Director). Phase 2 validates the purchase authorization (Buyer → Procurement Manager → Director).

**Q: Who approves the PO?**  
A: Buyer prepares, Procurement Manager reviews, Finance Director gives final internal approval. The supplier then acknowledges receipt.

**Q: Can I edit a submitted PR1?**  
A: Only **draft** PR1s are editable in the current UI. If an approver requests revision, status becomes `revision_requested` and you are notified, but the edit screen still requires `draft` — contact your administrator if you cannot resubmit after a revision request.

**Q: What happens when warehouse has sufficient stock?**  
A: The PR1 is resolved internally — items are fulfilled from warehouse stock without entering the procurement/RFQ path.

**Q: How do substitute items work?**  
A: When a supplier quotes an alternative item, the employee must accept or reject it before procurement can select that quote.

**Q: Is email used for approvals?**  
A: No. Approvals use in-app notifications only. Email is used for RFQ invitations (to suppliers), bug reports, and user invites.

---

## Appendices

### Appendix A — Document Number Formats

| Document | Format | Generated By |
|----------|--------|--------------|
| RFQ | RFQ-YYYY-XXXX | System auto-generates |
| GRN | GRN-YYYY-XXXX | System auto-generates |
| RSE | RSE-YYYYMM-XXXX | System auto-generates |
| PR1 | User-entered | Employee |
| PR2 | User-entered / system | Procurement |
| PO | Buyer-entered | Buyer |

### Appendix B — Notification Triggers

See Document G (Notification Matrix) for the complete list of 37+ in-app notification triggers and 5 email triggers.

### Appendix C — File Upload Specifications

| Context | Bucket | Max Size | Allowed Types |
|---------|--------|----------|---------------|
| Accreditation documents | accreditation-docs | 20 MB | PDF, JPG, PNG |
| Delivery receipts | delivery-receipts | 10 MB | PDF, JPG, PNG |
| Message attachments | message-attachments | 10 MB | Images, PDF, Office (max 5 per message) |

### Appendix D — Audit Log Actions

See Document B (System Architecture Audit) Section on audit logs for the complete list of 40+ logged action types.

### Appendix E — Role Permission Quick Reference

See Document E (Role & Permission Matrix) for the complete route, module, and workflow permission tables.

### Appendix F — End-to-End Workflow Diagram

```
Employee PR1 → Warehouse Validation → PR1 Approval
  → RFQ/Canvassing → Substitute Review (if needed)
  → PR2 (Phase 1 + Phase 2) → PO → Supplier Ack
  → Delivery → GRN

Parallel: Supplier Accreditation → Product Catalog → RSE → TSQA
```

---

## Glossary

| Term | Definition |
|------|------------|
| **PR1** | Purchase Request 1 — employee-initiated requisition |
| **PR2** | Purchase Request 2 / Canvass Slip — procurement-managed document after RFQ |
| **RFQ** | Request for Quotation — invitation to suppliers to submit prices |
| **PO** | Purchase Order — formal order to supplier after PR2 approval |
| **GRN** | Goods Receipt Note — warehouse document recording received quantities |
| **RSE** | Request for Sample Evaluation — product testing request for TSQA |
| **TSQA** | Technical/Scientific Quality Assurance — scientific product review role |
| **Canvassing** | Process of collecting and comparing supplier quotations |
| **Substitute Item** | Alternative product offered by supplier in place of requested item |
| **Raw Material** | Flag on PR1/PR2 items requiring compliance/TSQA verification |
| **RLS** | Row Level Security — database-level access control |
| **Approval Instance** | Active workflow execution on a document |
| **Approval Action** | Individual signer action (approved, rejected, revision_requested) |
| **Module Visibility** | Admin setting controlling sidebar menu items per role/position |
| **FilterBar** | Standard search/filter/pagination component on list pages |
| **DR** | Delivery Receipt — document uploaded by supplier when goods are in transit |
| **SOH** | Stock on Hand — current inventory quantity |
| **UOM** | Unit of Measure (e.g., pcs, kg, liters) |
| **Brevo** | Email service provider used for RFQ and bug report emails |
| **Supabase** | Backend platform (database, auth, storage) powering the system |

---

*This manual was generated from a complete codebase audit conducted June 6, 2026. All features, workflows, and permissions documented herein are verified against application source code, database migrations, and configuration files. For technical reference documents, see Documents B–H in the `docs/audit-deliverables/` folder.*
