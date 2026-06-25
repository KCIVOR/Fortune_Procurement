# User Acceptance Testing (UAT) — Fortune Procurement System

**Company:** Fortune Procurement
**Document version:** 2.0 (comprehensive, end-to-end)
**Date prepared:** _______________
**Prepared by:** _______________

**Legend:** P = Passed · F = Failed · N/A = Not Applicable / Not Implemented · B = Blocked

> Scope note: This UAT is derived from the verified application routes, role/route-access rules,
> approval-workflow configuration, and the live user manual. It covers **all 7 roles**
> (Employee, Warehouse, Procurement, Approver, Supplier, TSQA, Admin), every module reachable
> from each role's sidebar, all cross-cutting features (auth, notifications, messaging, bug
> tracking, profile, print), and **end-to-end integration flows** that span multiple roles.
> Each test case states an **Expected Result** so testers verify against defined behavior rather
> than assumption.

---

## How to use this document

1. Provision the test accounts in **Section 0** before starting.
2. Execute sections **A → I** to validate each role/module in isolation.
3. Execute **Section J** (end-to-end integration scenarios) last — these chain roles together
   and are the true acceptance gate.
4. Record **P/F** and a remark for every row. Any **F** must have a remark and a linked bug ticket.
5. Complete the **Sign-off & Summary** at the end.

---

## Section 0 — Test Environment & Accounts

### 0.1 Preconditions

| # | Precondition | Notes |
|---|---|---|
| 0.1.1 | Application URL is reachable | e.g. https://fortune-procurement.vercel.app/login |
| 0.1.2 | Database seeded with master data | roles, positions, departments, workflows |
| 0.1.3 | Approval workflows configured | PR1 (2 steps), PR2 Phase 1 (3 steps), PR2 Phase 2 (3 steps), PO (3 internal steps + supplier acknowledgment) — see Section E reference |
| 0.1.4 | Dropdown options seeded | Warehouse, Payment Terms, Request Purpose, Unit of Measure, Accreditation/Product Doc Types |
| 0.1.5 | At least one accredited supplier with verified products | needed for RFQ → award |
| 0.1.6 | Email delivery configured | invites, password reset, bug notifications |

### 0.2 Test accounts (one per role)

| Role | Sample login | Position |
|---|---|---|
| Employee / Requestor | employee@fortune.com | Staff |
| Warehouse | warehouse@fortune.com | Warehouse Staff |
| Procurement | procurement@fortune.com | Procurement Staff |
| Approver | approver accounts | Supervisor / Department Head / Director / Finance Director |
| Supplier | supplier@fortune.com | Supplier Representative |
| TSQA | tsqa account | TSQA Staff |
| Admin | admin@fortune.com | System Administrator |

---

## Section A — Authentication & Access Control (all roles)

### A.1 Login, Password & Session

| No. | Module | Scenario | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| A-1 | Login | Login with valid email + password | Redirected to role-specific dashboard | | |
| A-2 | Login | Login with invalid password | Error shown; no session created | | |
| A-3 | Login | Login with unknown email | Error shown; no account enumeration leak | | |
| A-4 | Login | Login with a **deactivated** account | Access denied with clear message | | |
| A-5 | Login | "Remember this device for 30 days" enabled | Session persists per remember-me policy | | |
| A-6 | Forgot Password | Submit registered email | Reset email sent; neutral confirmation shown | | |
| A-7 | Forgot Password | Submit unregistered email | Neutral confirmation (no enumeration) | | |
| A-8 | Reset Password | Open reset link from email | Reset form loads with valid token | | |
| A-9 | Reset Password | Submit weak password | Complexity validation blocks submit | | |
| A-10 | Reset Password | Submit matching strong password | Password updated; can log in with new password | | |
| A-11 | Reset Password | Reuse an already-used/expired reset link | Rejected with expired-token message | | |
| A-12 | Invite | Open invite-complete link as new user | Can set password and activate account | | |
| A-13 | Session | Idle session / token expiry | User routed to login on next protected action | | |
| A-14 | Logout | Click Sign Out | Session cleared; protected routes redirect to login | | |

### A.2 Role-Based Route Access (negative access control)

> Verifies the middleware route guards. Each role must be **blocked** from routes outside its scope.

| No. | Module | Scenario | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| A-15 | Access Control | Employee opens `/admin/*` | Blocked / redirected (not authorized) | | |
| A-16 | Access Control | Employee opens `/rfq`, `/po`, `/pr2` | Blocked (procurement-only) | | |
| A-17 | Access Control | Employee opens `/substitutes` | Allowed (employee-only) | | |
| A-18 | Access Control | Warehouse opens `/warehouse`, `/grn`, `/delivery` | Allowed | | |
| A-19 | Access Control | Warehouse opens `/rfq` or `/admin` | Blocked | | |
| A-20 | Access Control | Procurement opens `/rfq`, `/pr2`, `/po`, `/grn`, `/suppliers`, `/accreditation`, `/approvals` | Allowed | | |
| A-21 | Access Control | Procurement opens `/admin` | Blocked | | |
| A-22 | Access Control | Approver opens `/approvals` | Allowed | | |
| A-23 | Access Control | **Director-position approver** opens `/grn`, `/rfq`, `/pr2`, `/po`, `/delivery` | Allowed (Director logistics exception) | | |
| A-24 | Access Control | **Non-Director approver** opens `/po` or `/rfq` | Blocked | | |
| A-25 | Access Control | Supplier opens any internal route (`/admin`, `/rfq`, `/pr1`) | Blocked (supplier portal only, no admin bypass) | | |
| A-26 | Access Control | TSQA opens `/tsqa`, `/accreditation` | Allowed | | |
| A-27 | Access Control | TSQA opens `/rfq` or `/admin` | Blocked | | |
| A-28 | Access Control | Admin opens admin-bypass routes | Allowed across admin-guarded modules | | |
| A-29 | Access Control | Unauthenticated user opens any protected route | Redirected to login | | |
| A-30 | Access Control | Direct-URL access to a record outside the user's ownership (e.g. another employee's PR1) | Denied by row-level security | | |
| A-31 | Access Control | Open dev-only routes (`/test-dashboard`, `/test-filter`) in production | Blocked in production environment | | |

---

## Section B — Employee / Requestor

### B.1 Dashboard

| No. | Module | Scenario | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| B-1 | Dashboard | Load employee dashboard | Welcome header + 4 KPI cards (Total/Pending/Approved/Rejected) render | | |
| B-2 | Dashboard | KPI counts | Counts match the employee's own PR1 records only | | |
| B-3 | Dashboard | Recent Requests table | Shows 5 most recent PR1s with PR1 No., Purpose, Submitted, Priority, Status, View | | |
| B-4 | Dashboard | Substitute banner appears when pending substitutes exist | Clicking banner opens Substitute Review | | |
| B-5 | Dashboard | Substitute banner hidden when none pending | No banner shown | | |

### B.2 My Requests (PR1 list)

| No. | Module | Scenario | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| B-6 | PR1 List | Open `/pr1` | Lists only PR1s created by this employee | | |
| B-7 | PR1 List | Search by PR1 number / purpose | Table filters to matches | | |
| B-8 | PR1 List | Filter by status | Rows filtered by selected status | | |
| B-9 | PR1 List | Filter by date-created range | Rows filtered to range | | |
| B-10 | PR1 List | Apply then Clear filters | Filters reset; full list returns | | |
| B-11 | PR1 List | New PR1 button | Navigates to creation form | | |

### B.3 Create PR1

| No. | Module | Scenario | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| B-12 | PR1 Create | Submit empty form | Validation: Purpose required, at least one item required | | |
| B-13 | PR1 Create | Requisitioner/Department/Date prefilled read-only | Shows current user context | | |
| B-14 | PR1 Create | Enter custom PR1 sequence suffix | Suffix accepted into PR1 number | | |
| B-15 | PR1 Create | Select Purpose (dynamic dropdown) | Options load from configured Request Purpose list | | |
| B-16 | PR1 Create | Choose "Other" purpose | Custom free-text input appears and is captured | | |
| B-17 | PR1 Create | Pick Date Required | Date accepted | | |
| B-18 | PR1 Create | Add Item rows | New line row appended | | |
| B-19 | PR1 Create | Enter description, Unit of Measure (dynamic dropdown), Req. Qty | Values captured per line | | |
| B-20 | PR1 Create | Mark "Raw Mat." checkbox on an item | Item flagged as raw material | | |
| B-21 | PR1 Create | Remove an item row | Row removed; totals update | | |
| B-22 | PR1 Create | Attach a supporting file to an item (PR1 attachments) | File uploads and is listed on the item | | |
| B-23 | PR1 Create | Attach an oversized / disallowed file | Rejected with validation message | | |
| B-24 | PR1 Create | Save Draft | PR1 saved as Draft (not routed) | | |
| B-25 | PR1 Create | Submit PR1 | Status set to "Pending Warehouse Validation"; warehouse notified | | |

### B.4 PR1 Edit / Delete / Details

| No. | Module | Scenario | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| B-26 | PR1 Edit | Edit a Draft PR1 | Changes saved | | |
| B-27 | PR1 Edit | Attempt to edit a submitted/approved PR1 | Editing blocked | | |
| B-28 | PR1 Delete | Delete a Draft PR1 | Draft removed | | |
| B-29 | PR1 Delete | Attempt to delete a submitted PR1 | Deletion blocked | | |
| B-30 | PR1 Details | Open PR1 detail | Header, items grid (with warehouse route), signatories timeline shown | | |
| B-31 | PR1 Details | Signatories timeline | Shows completed sign-offs and the active pending signatory | | |
| B-32 | PR1 Details | Print PR1 | Opens print-formatted view of the requisition | | |
| B-33 | PR1 Details | Status reflects lifecycle | Status badge matches current workflow stage | | |

### B.5 Substitute Review

| No. | Module | Scenario | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| B-34 | Substitutes | Open `/substitutes` | KPI counters (Pending/Accepted/Rejected) + cards grouped by PR1 | | |
| B-35 | Substitutes | Search by PR1 / purpose / supplier | Cards filtered | | |
| B-36 | Substitutes | Filter by status (All/Pending/Decided) | Cards filtered | | |
| B-37 | Substitutes | Open a substitute card | Side-by-side: "You requested" vs "Supplier is offering" | | |
| B-38 | Substitutes | Price visibility | Supplier price displayed as "Price hidden" to employee | | |
| B-39 | Substitutes | View supplier-uploaded attachment on a substitute | "View (N)" opens supplier's files (image lightbox / PDF in new tab) | | |
| B-40 | Substitutes | Accept substitute with notes | Decision = Accepted; saved immediately | | |
| B-41 | Substitutes | Reject substitute with notes | Decision = Rejected; system sources original | | |
| B-42 | Substitutes | Change a prior decision | Decision resets and can be re-selected | | |

### B.6 Delivery Status (employee view)

| No. | Module | Scenario | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| B-43 | Delivery | Open `/delivery` | Status tabs (All/Pending/Scheduled/In Transit/Delayed/Delivered) + cards | | |
| B-44 | Delivery | Search by PO / supplier / warehouse | Cards filtered | | |
| B-45 | Delivery | Filter by each status tab | Cards filtered correctly | | |
| B-46 | Delivery | Open delivery detail | Read-only: delivery info, key dates, status history timeline | | |
| B-47 | Delivery | Price visibility | Pricing masked ("Price hidden") for employee | | |
| B-48 | Delivery | No action buttons present | Screen is read-only for employee | | |

---

## Section C — Warehouse

### C.1 Dashboard & Queue

| No. | Module | Scenario | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| C-1 | Dashboard | Load warehouse dashboard | KPIs: Pending Validation, Validated Today, Open GRN, GRN Completed | | |
| C-2 | Dashboard | Pending Validation queue preview + View all | Opens Warehouse Queue | | |
| C-3 | Dashboard | Open Goods Receipts preview + View all | Opens GRN module | | |
| C-4 | Queue | Open `/warehouse` | Lists PR1s awaiting SOH validation | | |
| C-5 | Queue | Search by PR1/requestor/department/purpose | Filters list | | |
| C-6 | Queue | Filter by Priority | Filters list | | |
| C-7 | Queue | Validate row action | Opens SOH verification page | | |

### C.2 SOH Validation

| No. | Module | Scenario | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| C-8 | SOH | View requested quantities per item | Displays PR1 line items + requested qty | | |
| C-9 | SOH | Enter Verified SOH ≥ requested | Outcome dynamically shows "Sufficient" | | |
| C-10 | SOH | Enter Verified SOH < requested | Outcome dynamically shows "Insufficient" | | |
| C-11 | SOH | Add per-line notes | Notes captured | | |
| C-12 | SOH | Save Progress (draft) | Counts saved without advancing workflow | | |
| C-13 | SOH | Submit Validation | Workflow advances: sufficient → internal fulfillment, insufficient → routed to procurement | | |
| C-14 | SOH | Mixed sufficient/insufficient lines | Each line routed independently per outcome | | |
| C-15 | SOH | Validation recorded in Warehouse History | Entry created with validator + outcome | | |

### C.3 Goods Receipt (GRN)

| No. | Module | Scenario | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| C-16 | GRN | Open `/grn` with tabs (All/Open/Closed) | GRN list renders per tab | | |
| C-17 | GRN | Search by GRN/PO/supplier/department/warehouse | Filters list | | |
| C-18 | GRN | Open a GRN from a delivered PO | GRN detail shows ordered vs received vs rejected | | |
| C-19 | GRN | Record received quantities per line | Quantities saved | | |
| C-20 | GRN | Record a discrepancy (short/over) | Discrepancy captured with remarks | | |
| C-21 | GRN | Record rejected quantity with reason | Rejection captured | | |
| C-22 | GRN | Partial acceptance | GRN remains Open for outstanding qty | | |
| C-23 | GRN | Close GRN when fully received | GRN status → Closed; PR1 progresses to "Completed (GRN Closed)" | | |
| C-24 | GRN | Price visibility | Cost columns masked ("Price hidden") for warehouse | | |
| C-25 | GRN | Print GRN | Opens printable GRN | | |

### C.4 Delivery Tracking & History (warehouse)

| No. | Module | Scenario | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| C-26 | Delivery | Open delivery list (warehouse) | Read-only list of shipments | | |
| C-27 | Delivery | Open delivery detail | Status history + estimated/actual dates visible | | |
| C-28 | History | Open `/warehouse/history` | Historic validations table (PR1, requisitioner, validator, date, outcome) | | |
| C-29 | History | Filter history by date/type | Filtered results | | |

---

## Section D — Procurement

### D.1 Dashboard

| No. | Module | Scenario | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| D-1 | Dashboard | Load procurement dashboard | KPIs: Accreditation Queue, Pending TSQA, Awaiting RFQ, Open RFQs, High Priority, Purchase Orders | | |
| D-2 | Dashboard | KPI cards clickable | Each opens its corresponding module | | |
| D-3 | Dashboard | Canvassing queue + Open RFQs panels | View all opens RFQ module; empty states render | | |

### D.2 Canvassing / RFQ

| No. | Module | Scenario | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| D-4 | RFQ | Open `/rfq` canvassing queue | Lists warehouse-validated PR1s ready for RFQ | | |
| D-5 | RFQ | Create RFQ from a validated PR1 | RFQ batch created with RFQ number | | |
| D-6 | RFQ | Assign/invite registered suppliers | Selected suppliers added to RFQ | | |
| D-7 | RFQ | **Add external vendor** (no supplier account, e.g. Shopee) | External vendor slot created on RFQ (name-only, no login) | | |
| D-8 | RFQ | Add RFQ items & specifications | Items carried from PR1 | | |
| D-9 | RFQ | Set RFQ deadline / closing date | Deadline saved | | |
| D-10 | RFQ | Send RFQ to suppliers | Suppliers notified; RFQ status = Sent/Active | | |
| D-11 | RFQ | View RFQ list & details | Records render with batch status | | |
| D-12 | RFQ | Receive supplier quotations | Submitted quotes appear in matrix | | |
| D-13 | RFQ | View supplier-uploaded quote attachments | "View (N)" opens supplier files | | |
| D-14 | RFQ | **Enter a quote on behalf of an external vendor** | Procurement-entered quote saved for external slot | | |
| D-15 | RFQ | Compare quotations side-by-side per line | Matrix shows competing quotes per item | | |
| D-16 | RFQ | Review supplier alternative (substitute) items | Alternatives flagged; routed to employee substitute review | | |
| D-17 | RFQ | Award winning quote per line item | Winner selected per line | | |
| D-18 | RFQ | Award an external vendor line | External vendor can be awarded | | |
| D-19 | RFQ | Changing a quote unselects prior award | Award resets when underlying quote changes | | |
| D-20 | RFQ | Close RFQ | RFQ status = Closed; no further bids accepted | | |

### D.3 PR2 (procurement-generated)

| No. | Module | Scenario | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| D-21 | PR2 | Generate PR2 from awarded RFQ | PR2 created from awarded items | | |
| D-22 | PR2 | External vendors flow into PR2 | Each external vendor carried by name snapshot | | |
| D-23 | PR2 | View PR2 list & details | Records render | | |
| D-24 | PR2 | Filter PR2 by status/date | Filtered list | | |
| D-25 | PR2 | View price comparison report | Awarded vs competing prices shown | | |
| D-26 | PR2 | Submit PR2 for approval (Phase 1) | Routed to Phase 1 approvers | | |
| D-27 | PR2 | Track dual-phase approval status | Phase 1 (3 steps) then Phase 2 (3 steps) progression visible | | |
| D-28 | PR2 | Print PR2 | Printable PR2 opens | | |

### D.4 Purchase Orders

| No. | Module | Scenario | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| D-29 | PO | Generate PO from approved PR2 | PO created, prefilled supplier + line items | | |
| D-30 | PO | **Per-supplier PO grouping** | Each supplier/external vendor gets its own PO (no merge of distinct external vendors) | | |
| D-31 | PO | Enter custom PO number | PO number accepted | | |
| D-32 | PO | Set payment terms (dynamic dropdown) | Options from Payment Terms config; supplier default prefilled | | |
| D-33 | PO | Set delivery address / instructions | Saved on PO | | |
| D-34 | PO | Add remarks | Saved | | |
| D-35 | PO | Save PO as Draft | Draft saved | | |
| D-36 | PO | Submit PO for approval | Routed into PO approval workflow (3 internal steps + supplier acknowledgment) | | |
| D-37 | PO | View PO list, filter by status, search by PO number | List behaves correctly | | |
| D-38 | PO | Track PO status | Draft → For Approval → Sent to Supplier → Delivered | | |
| D-39 | PO | Print PO | Printable PO opens | | |

### D.5 Suppliers, Accreditation & Product Review

| No. | Module | Scenario | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| D-40 | Suppliers | Open `/suppliers` accounts list | Supplier accounts listed | | |
| D-41 | Suppliers | Search suppliers | Filtered list | | |
| D-42 | Suppliers | Open supplier detail | Profile + records visible | | |
| D-43 | Accreditation | Open accreditation queue | Pending applications listed | | |
| D-44 | Accreditation | Open application detail & review documents | Uploaded compliance docs viewable | | |
| D-45 | Accreditation | Approve accreditation | Supplier marked Accredited; supplier notified | | |
| D-46 | Accreditation | Reject accreditation with remarks | Rejected; reason recorded; supplier notified | | |
| D-47 | Product Review | Open product review list | Products with status (Pending/Under TSQA/Verified/Rejected) | | |
| D-48 | Product Review | Verify a non-raw-material product directly | Product → Verified; eligible for RFQ | | |
| D-49 | Product Review | Reject a product with remarks | Product → Rejected with reason | | |
| D-50 | Product Review | "Create RSE" for a raw-material product | RSE record created and routed to TSQA | | |

### D.6 Approval Queue & Logistics (procurement participant)

| No. | Module | Scenario | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| D-51 | Approvals | Open procurement approval queue | Pending PR2/PO documents at procurement's step shown | | |
| D-52 | Approvals | Approval history | Completed actions with remarks/timestamps | | |
| D-53 | Delivery | Procurement delivery tracking | Full list with totals + status log | | |
| D-54 | GRN | Procurement GRN access | GRN records viewable | | |

---

## Section E — Approver

> **Configured approval-workflow reference** (verify against `/admin/workflows`; these are the
> currently seeded steps):
>
> | Workflow | Steps |
> |---|---|
> | **PR1_APPROVAL** (2) | 1) Supervisor — *Reviewed and Noted By* → 2) Department Head — *Approved By* (final) |
> | **PR2_PHASE1** (3) | 1) Procurement Staff — *Prepared By* → 2) Procurement Manager — *Reviewed By* → 3) Director — *Approved By* (final) |
> | **PR2_PHASE2** (3) | 1) Buyer — *Prepared By* → 2) Procurement Manager — *Reviewed By* → 3) Director — *Approved By* (final) |
> | **PO_APPROVAL** (3 internal + ack) | 1) Buyer — *Prepared By* → 2) Procurement Manager — *Reviewed By* → 3) Finance Director — *Approved By* (final internal; transitions PO to Approved/Sent) → 4) Supplier Representative — *Received By* (acknowledgment, done in supplier portal, not the approval queue) |
>
> Note: PR2 Phase 1 previously had a Department Head "Certified By" step; it was removed. Procurement
> steps (Prepared By / Reviewed By) are acted on by procurement users, not approvers.

### E.1 Dashboard & Unified Queue

| No. | Module | Scenario | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| E-1 | Dashboard | Load approver dashboard | KPIs: Awaiting My Action, Approved This Week, Rejected This Week, Total Processed | | |
| E-2 | Dashboard | Pending Approvals queue | Documents routed to this approver's step only | | |
| E-3 | Dashboard | Empty state | "No pending approvals" message shown when none | | |
| E-4 | Approvals | Open `/approvals` unified queue | PR1/PR2/PO tabs aggregate pending items | | |

### E.2 PR1 Approval (2-step workflow)

| No. | Module | Scenario | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| E-5 | PR1 Approval | Open PR1 approval queue | Routing PR1s listed; filter by priority/department/date | | |
| E-6 | PR1 Approval | Open PR1 detail | Requestor, purpose, items with verified SOH shown | | |
| E-7 | PR1 Approval | Approval timeline | Stepper shows signatories and active step | | |
| E-8 | PR1 Approval | Approve at my step | Advances to next step / completes after final step | | |
| E-9 | PR1 Approval | Reject (mandatory remarks) | Reject requires remarks; PR1 → Rejected; requestor notified | | |
| E-10 | PR1 Approval | Request Revision | Returns to requestor for changes | | |
| E-11 | PR1 Approval | Act on a step not assigned to me | Action unavailable (cannot approve out of turn) | | |

### E.3 PR2 Approval (Phase 1: 3 steps, Phase 2: 3 steps)

| No. | Module | Scenario | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| E-12 | PR2 Approval | Open PR2 approval queue | Shows phase, priority, purpose, department | | |
| E-13 | PR2 Approval | Open PR2 detail | Header + related-records chain (PR1 → RFQ → PR2) | | |
| E-14 | PR2 Approval | Items grid w/ awarded suppliers, unit costs, totals | Renders; toggle to view competing canvass quotes | | |
| E-15 | PR2 Approval | Approve active Phase 1 step | Advances through 3 Phase-1 steps in order (Director is final) | | |
| E-16 | PR2 Approval | Phase 1 completion triggers Phase 2 | Phase 2 (3 steps) becomes active | | |
| E-17 | PR2 Approval | Approve final Phase 2 step | PR2 fully approved; eligible for PO generation | | |
| E-18 | PR2 Approval | Reject at any step (remarks) | PR2 → Rejected; reason recorded | | |
| E-19 | PR2 Approval | Threshold-based step routing | Step applies only within configured min/max value range | | |

### E.4 PO Approval (3 internal steps + supplier acknowledgment)

| No. | Module | Scenario | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| E-20 | PO Approval | Open PO approval queue | POs routing through approval listed | | |
| E-21 | PO Approval | Open PO detail | Payment terms, delivery address, items, grand total visible | | |
| E-22 | PO Approval | Approve internal steps (Buyer → Procurement Manager) | Advances in order | | |
| E-23 | PO Approval | Finance Director approval (final internal step) | PO transitions to Approved/Sent and is routed to the supplier | | |
| E-24 | PO Approval | Reject PO (remarks) | PO → Rejected; reason recorded; not sent to supplier | | |
| E-25 | PO Approval | Supplier acknowledgment (step 4, "Received By") | Handled in supplier portal (see F.4), not the approval queue | | |

### E.5 Approval History

| No. | Module | Scenario | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| E-26 | History | Open `/approvals/history` | All past actions with action badge + remarks | | |
| E-27 | History | Search + date range filter | Filtered history | | |
| E-28 | History | Open a completed document | Read-only final signatory record | | |

---

## Section F — Supplier

### F.1 Dashboard & Accreditation

| No. | Module | Scenario | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| F-1 | Dashboard | Load supplier dashboard | KPIs: Accreditation Status, Total Products, Verified, Pending Review, Open RFQs, Pending Response | | |
| F-2 | Dashboard | RFQ inbox | Assigned RFQs with due dates; empty state when none | | |
| F-3 | Dashboard | KPI cards clickable | Open corresponding modules | | |
| F-4 | Dashboard | Org-scoped data | Only this supplier's records visible | | |
| F-5 | Accreditation | Submit accreditation application | Application created | | |
| F-6 | Accreditation | Upload required documents (DTI, Mayor's Permit, Tax Clearance, SEC, etc.) | Files uploaded with per-doc status | | |
| F-7 | Accreditation | Document type dropdown (dynamic) | Options from Accreditation Doc Types config | | |
| F-8 | Accreditation | View accreditation status | Status badge (Pending/Under Review/Accredited) | | |
| F-9 | Accreditation | Receive approval/rejection outcome | Status + notification update | | |

### F.2 Product Catalog

| No. | Module | Scenario | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| F-10 | Products | View catalog | Products with SKU, category, price, stock, status | | |
| F-11 | Products | Add product (code, name, category, price, stock) | Product created (Pending review) | | |
| F-12 | Products | Upload product image | Image attached | | |
| F-13 | Products | Product document type dropdown (dynamic) | Options from Product Doc Types config | | |
| F-14 | Products | View product detail + verification history | Status log (Pending TSQA / Verified) shown | | |
| F-15 | Products | Verified products selectable in quotes | Only Verified products available for RFQ bids | | |

### F.3 Quotations

| No. | Module | Scenario | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| F-16 | Quotations | View RFQ queue | RFQ number, closing date, status, action | | |
| F-17 | Quotations | Open RFQ detail | Requested items + company billing/shipping shown | | |
| F-18 | Quotations | Link each line to a catalog product | Catalog product selectable per line | | |
| F-19 | Quotations | Enter unit price + lead time (days) | Values captured | | |
| F-20 | Quotations | Propose an alternative item with remarks | Alternative flagged (routes to employee substitute review) | | |
| F-21 | Quotations | Upload quote attachment (spec/brochure) | File uploaded with the quote | | |
| F-22 | Quotations | Submit quotation | RFQ status → Submitted; visible to procurement | | |
| F-23 | Quotations | Edit a submitted quotation before close | Changes saved (award unselects if changed) | | |
| F-24 | Quotations | Attempt to quote after RFQ closed | Blocked (Closed state) | | |

### F.4 Purchase Orders (supplier)

| No. | Module | Scenario | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| F-25 | Supplier PO | View received POs | POs with status (Pending Acknowledgment/Acknowledged/Delivered) | | |
| F-26 | Supplier PO | Open PO detail | Items, billing address, commercial terms shown | | |
| F-27 | Supplier PO | Acknowledge PO with commitment date | PO → Acknowledged; delivery record created | | |
| F-28 | Supplier PO | Acknowledge without required commitment date | Validation blocks submit | | |
| F-29 | Supplier PO | Add acknowledgment remarks | Remarks saved | | |

### F.5 Delivery Management (supplier)

| No. | Module | Scenario | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| F-30 | Supplier Delivery | View deliveries | Dispatches with PO ref, ETA, status | | |
| F-31 | Supplier Delivery | Update status (Scheduled/In Transit/Delayed/Delivered) | Status updated; timeline log entry added | | |
| F-32 | Supplier Delivery | Set actual delivery date | Date saved | | |
| F-33 | Supplier Delivery | Upload Delivery Receipt (DR) + Invoice | Files attached | | |
| F-34 | Supplier Delivery | Confirm update | Update logged; warehouse sees new status | | |

---

## Section G — TSQA

| No. | Module | Scenario | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| G-1 | Dashboard | Load TSQA dashboard | KPIs: Open/Created, Assigned, Under Review, Passed, Failed | | |
| G-2 | Dashboard | Active RSE records + empty state | Assigned RSEs listed; empty message when none | | |
| G-3 | RSE Queue | Open `/tsqa/rse` with tabs | Created/Assigned/Under Review/Passed/Failed tabs | | |
| G-4 | RSE Queue | Self-assign an RSE from Created | Status → Assigned; moves to reviewer's worklist | | |
| G-5 | RSE Detail | Start Review | Status → Under Review | | |
| G-6 | RSE Detail | Enter Test Findings + Inspection Remarks | Captured | | |
| G-7 | RSE Detail | Upload inspection report (PDF/JPG) | File attached | | |
| G-8 | RSE Detail | Save Progress | Draft saved without verdict | | |
| G-9 | Verdict | Submit Passed Verdict | RSE → Passed; linked product → Verified | | |
| G-10 | Verdict | Submit Failed Verdict (requires reason) | RSE → Failed; product not verified; reason recorded | | |
| G-11 | Access | TSQA cannot access procurement/admin routes | Blocked | | |

---

## Section H — Admin

### H.1 Dashboard

| No. | Module | Scenario | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| H-1 | Dashboard | Load admin dashboard | KPIs: Total Users, Roles, Positions, Departments, Audit Logs | | |
| H-2 | Dashboard | KPI cards clickable | Each opens its module | | |
| H-3 | Dashboard | Recent Activity (5 latest audit logs) + View All | Opens Audit Logs | | |

### H.2 User Management

| No. | Module | Scenario | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| H-4 | Users | View user directory | Name/email, role, dept, position, status | | |
| H-5 | Users | Search + filter by role/department | Filtered list | | |
| H-6 | Users | Create user (name, email, role, dept, position, password) | User created | | |
| H-7 | Users | Invite user via email | Invite sent; invitee completes setup | | |
| H-8 | Users | Edit user assignments (role/dept/position) | Changes saved; sidebar/access updates accordingly | | |
| H-9 | Users | Reset user password | Password overwritten | | |
| H-10 | Users | Deactivate user | Account disabled; cannot log in | | |
| H-11 | Users | Reactivate user | Access restored | | |

### H.3 Roles / Positions / Departments

| No. | Module | Scenario | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| H-12 | Roles | View roles list | Role names + user counts + created dates | | |
| H-13 | Positions | View positions | Title, role, status, created date | | |
| H-14 | Positions | Create position (title + role) | Position created | | |
| H-15 | Positions | Edit position | Changes saved; workflow-usage warning if referenced | | |
| H-16 | Positions | Deactivate position used in active workflow step | Blocked with warning until steps updated | | |
| H-17 | Positions | Deactivate unused position | Deactivated | | |
| H-18 | Departments | View departments | Name, code, status, user count | | |
| H-19 | Departments | Create department (name + code) | Created | | |
| H-20 | Departments | Edit department | Saved | | |
| H-21 | Departments | Deactivate department with active users | Safety dialog shows user count; confirm required | | |

### H.4 Workflow Configuration

| No. | Module | Scenario | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| H-22 | Workflows | View workflows list | Code, name, steps count, active instances, status | | |
| H-23 | Workflows | Select a workflow (e.g. PR1_APPROVAL) | Step editor + stepper diagram load | | |
| H-24 | Workflows | Add step (order, label, role, position) | Step added; order contiguity validated | | |
| H-25 | Workflows | Add threshold step (min/max value) | Step applies within value range | | |
| H-26 | Workflows | Add step with non-contiguous order | Validation blocks the gap | | |
| H-27 | Workflows | Edit a step | Saved | | |
| H-28 | Workflows | Delete step with active document instances | Blocked | | |
| H-29 | Workflows | Delete unused step | Deleted | | |

### H.5 Module Visibility

| No. | Module | Scenario | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| H-30 | Module Visibility | Toggle a role's default module visibility | Sidebar updates for that role on save | | |
| H-31 | Module Visibility | Position-scope override | Visibility set for a specific position | | |
| H-32 | Module Visibility | Borrow module from another role (Add Module) | Module appears in the host role/position sidebar | | |
| H-33 | Module Visibility | Remove a borrowed module | Removed on save | | |
| H-34 | Module Visibility | Visibility does not grant route access | Hidden module still route-guarded; URL access still enforced | | |

### H.6 System Settings (Expiry + Dropdown Options)

| No. | Module | Scenario | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| H-35 | Settings | Open `/admin/settings` | Expiry settings + Dropdown Options manager render | | |
| H-36 | Expiry | Set Accreditation validity (1–3650 days) | Saved; applies to new approvals only | | |
| H-37 | Expiry | Set Product verification validity | Saved | | |
| H-38 | Expiry | Enter out-of-range value | Validation blocks save | | |
| H-39 | Dropdowns | Switch between the 6 categories | Each category's options load | | |
| H-40 | Dropdowns | Add a new option | Option added and appears in the corresponding form | | |
| H-41 | Dropdowns | Add a duplicate value | Blocked (unique constraint) with clear error | | |
| H-42 | Dropdowns | Edit an option label | Updated everywhere it's used | | |
| H-43 | Dropdowns | Reorder options (up/down) | New order reflected in forms | | |
| H-44 | Dropdowns | Delete an option | Permanently removed (no inactive residue) | | |
| H-45 | Dropdowns | "Other" option | Locked — cannot edit, reorder, or delete | | |
| H-46 | Dropdowns | Doc-type categories use value+label | Both fields editable for doc types | | |

### H.7 Audit Logs

| No. | Module | Scenario | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| H-47 | Audit | Open `/admin/audit` | Logs table: action, actor, doc type, ref, IP, timestamp | | |
| H-48 | Audit | Search by action/actor/reference | Filtered logs | | |
| H-49 | Audit | Filter by document type / action / date range | Filtered logs | | |
| H-50 | Audit | Open a log row detail drawer | Shows user agent + before/after payload JSON | | |
| H-51 | Audit | Key actions are logged | e.g. USER_DEACTIVATED, approvals, awards recorded | | |

---

## Section I — Cross-Cutting Features (all roles)

### I.1 Notifications

| No. | Module | Scenario | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| I-1 | Notifications | View notification list (bell) | Unread/read items listed | | |
| I-2 | Notifications | Mark as read | Read state updates; badge count decreases | | |
| I-3 | Notifications | Click notification | Navigates to related record | | |
| I-4 | Notification Trigger | PR1 submitted | Warehouse notified | | |
| I-5 | Notification Trigger | PR1 approved / rejected | Requestor notified | | |
| I-6 | Notification Trigger | RFQ sent | Suppliers notified | | |
| I-7 | Notification Trigger | Substitute proposed | Employee notified | | |
| I-8 | Notification Trigger | PR2 submitted / approval routed | Approvers notified | | |
| I-9 | Notification Trigger | PO sent to supplier | Supplier notified | | |
| I-10 | Notification Trigger | Delivery status change | Relevant parties notified | | |
| I-11 | Notification Trigger | Accreditation / product verdict | Supplier notified | | |

### I.2 Messaging

| No. | Module | Scenario | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| I-12 | Messaging | Open message center | Conversation list + chat pane | | |
| I-13 | Messaging | Search/select a recipient | Conversation opens | | |
| I-14 | Messaging | Compose & send a message | Message delivered; appears in thread | | |
| I-15 | Messaging | Reply within a thread | Reply appended | | |
| I-16 | Messaging | Send a file attachment | Attachment delivered and downloadable | | |
| I-17 | Messaging | Unread indicator / badge | Updates on new message and on read | | |
| I-18 | Messaging | Empty state (no conversation selected) | Empty-state UI shown | | |

### I.3 Bug Tracking

| No. | Module | Scenario | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| I-19 | Bug | Submit empty bug form | Validation highlights required fields | | |
| I-20 | Bug | Create bug (summary, URL, severity, description, expected) | Ticket created | | |
| I-21 | Bug | Attach screenshot / console log | Attachment saved | | |
| I-22 | Bug | Email to developer on new bug | Notification email sent to configured address | | |
| I-23 | Bug | Admin views bug list + filters | List filterable by status/severity | | |
| I-24 | Bug | Update status / resolve / close / reopen | Status transitions work | | |
| I-25 | Bug | Resolution email to reporter | Reporter notified on resolution | | |

### I.4 Profile

| No. | Module | Scenario | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| I-26 | Profile | View profile | Name (editable), role/dept/position (read-only) | | |
| I-27 | Profile | Update display name | Saved | | |
| I-28 | Profile | Change password (current + new) | Password updated; re-login works | | |
| I-29 | Profile | Wrong current password | Rejected | | |

### I.5 Print Views

| No. | Module | Scenario | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| I-30 | Print | Print PR1 | Print-formatted PR1 renders | | |
| I-31 | Print | Print PR2 | Print-formatted PR2 renders | | |
| I-32 | Print | Print PO | Print-formatted PO renders | | |
| I-33 | Print | Print GRN | Print-formatted GRN renders | | |

---

## Section J — End-to-End Integration Scenarios

> These chain multiple roles and are the primary acceptance gate. Each scenario passes only when
> every step completes and the originating employee sees the final state.

### J.1 — Happy path: procurement-sourced item, full lifecycle

| Step | Role | Action | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| J1-1 | Employee | Create & submit PR1 with a non-stocked item | Status: Pending Warehouse Validation | | |
| J1-2 | Warehouse | Validate, mark **Insufficient** | Item routed to procurement | | |
| J1-3 | Approver(s) | Approve PR1 (2 steps) | PR1 approved | | |
| J1-4 | Procurement | Create RFQ, invite suppliers, set deadline, send | RFQ active; suppliers notified | | |
| J1-5 | Supplier | Submit quote (price, lead time, attachment) | Quote visible to procurement | | |
| J1-6 | Procurement | Compare & award winner | Award recorded | | |
| J1-7 | Procurement | Generate PR2; submit for approval | PR2 routed Phase 1 → Phase 2 | | |
| J1-8 | Approver(s) | Approve PR2 (Phase 1: 3 steps, then Phase 2: 3 steps) | PR2 fully approved | | |
| J1-9 | Procurement | Generate PO; submit for approval | PO routed (3 internal steps) | | |
| J1-10 | Approver (Finance Director) | Final internal PO approval | PO approved and sent to supplier | | |
| J1-11 | Supplier | Acknowledge PO + commitment date | Delivery record created | | |
| J1-12 | Supplier | Update delivery to Delivered + upload DR/invoice | Warehouse sees Delivered | | |
| J1-13 | Warehouse | Create GRN, record received qty, close GRN | GRN Closed | | |
| J1-14 | Employee | View PR1 | Status: Completed (GRN Closed) | | |

### J.2 — Substitute / alternative item path

| Step | Role | Action | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| J2-1 | Supplier | Quote an **alternative** item against an RFQ line | Alternative flagged | | |
| J2-2 | Employee | Open Substitute Review; price hidden | Side-by-side comparison shown | | |
| J2-3 | Employee | Accept substitute | Award routes to the substitute | | |
| J2-4 | Employee | (Alt) Reject substitute | System sources the original item | | |
| J2-5 | Procurement | Continue award → PR2 with accepted substitute | Substitute carried downstream | | |

### J.3 — External vendor (manual quote) path

| Step | Role | Action | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| J3-1 | Procurement | Add external vendor (e.g. Shopee) to RFQ | External slot created, no login | | |
| J3-2 | Procurement | Enter quote on the vendor's behalf | Quote saved for external slot | | |
| J3-3 | Procurement | Award the external vendor | Award recorded | | |
| J3-4 | Procurement | Generate PR2 → PO | External vendor carried by name; **its own PO** (not merged with other external vendors) | | |
| J3-5 | Approver | Approve PR2 + PO | Approved | | |
| J3-6 | Warehouse | Receive goods → GRN | GRN proceeds without supplier portal acknowledgment | | |

### J.4 — Internal fulfillment (sufficient stock)

| Step | Role | Action | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| J4-1 | Employee | Submit PR1 for a stocked item | Pending Warehouse Validation | | |
| J4-2 | Warehouse | Validate, mark **Sufficient** | Routed to internal fulfillment (no procurement/RFQ) | | |
| J4-3 | Employee | Track PR1 to completion | Status reflects internal fulfillment | | |

### J.5 — Supplier onboarding → product availability

| Step | Role | Action | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| J5-1 | Supplier | Submit accreditation + documents | Pending Review | | |
| J5-2 | Procurement | Approve accreditation | Supplier Accredited | | |
| J5-3 | Supplier | Add a raw-material product | Pending review | | |
| J5-4 | Procurement | Create RSE for raw material | RSE routed to TSQA | | |
| J5-5 | TSQA | Self-assign → review → Passed verdict | Product → Verified | | |
| J5-6 | Supplier | Product now selectable in RFQ quotes | Verified product appears in bid form | | |

### J.6 — Rejection paths

| Step | Role | Action | Expected Result | Status | Remarks |
|---|---|---|---|---|---|
| J6-1 | Approver | Reject PR1 with remarks | PR1 → Rejected; employee notified; not editable | | |
| J6-2 | Approver | Reject PR2 with remarks | PR2 → Rejected; reason recorded | | |
| J6-3 | Approver | Reject PO with remarks | PO → Rejected; not sent to supplier | | |
| J6-4 | Procurement | Reject accreditation / product | Supplier notified with reason | | |
| J6-5 | TSQA | Failed verdict | Product not verified; reason recorded | | |

---

## Sign-off & Summary

### UAT Summary

| Metric | Value |
|---|---|
| Total test cases | _____ |
| Passed | _____ |
| Failed | _____ |
| Pass rate | _____ % |
| Testing period | From _________ To _________ |
| Overall status | ☐ Approved for Production  ☐ Requires Fixes  ☐ Major Issues Found |

### Overall comments / enhancements for consideration

1. ________________________________________________________________
2. ________________________________________________________________
3. ________________________________________________________________

### Test participants

**Spearheaded by:**
Name: __________________  Signature: __________________  Date: __________

**Participants:**
Name: __________________  Signature: __________________  Date: __________
Name: __________________  Signature: __________________  Date: __________

---

_Last updated: _______________  ·  Next review date: ________________
