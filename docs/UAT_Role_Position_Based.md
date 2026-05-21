# User Acceptance Testing (UAT) - Role + Position Based
## Fortune Procurement System

**Document Version:** 2.0  
**Date:** May 22, 2026  
**Approach:** Role + Position Based Testing

---

## Table of Contents
1. [Introduction](#introduction)
2. [Roles & Positions Matrix](#roles--positions-matrix)
3. [Testing Approach](#testing-approach)
4. [UAT Test Scenarios by Role](#uat-test-scenarios-by-role)

---

## Introduction

This UAT document is organized by **Role + Position** to reflect actual user workflows in the Fortune Procurement System. Each tester will follow scenarios that match their real job responsibilities, ensuring end-to-end validation of business processes.

### Key Changes from Previous UAT:
- ✅ **Role-based organization** - Tests grouped by actual user roles
- ✅ **End-to-end workflows** - Complete business processes, not fragmented modules
- ✅ **Position-specific scenarios** - Different positions within same role have distinct tests
- ✅ **System-audited** - All scenarios verified against actual database schema and code

---

## Roles & Positions Matrix

Based on system audit of `foundation_schema.sql`:

| Role | Positions | Primary Responsibilities |
|------|-----------|-------------------------|
| **employee** | Staff | Create PR1, track requests, view delivery status |
| **warehouse** | Warehouse Staff, Warehouse Manager | Validate PR1 SOH, create GRN, manage stock |
| **procurement** | Procurement Staff, Authorized Personnel, Buyer, Procurement Manager | Create RFQ, PR2, PO; manage suppliers |
| **approver** | Supervisor, Department Head, Director, Finance Director | Approve PR1, PR2, PO at various levels |
| **supplier** | Supplier Representative | Submit accreditation, respond to RFQ, acknowledge PO, update delivery |
| **tsqa** | TSQA Staff | Conduct RSE inspections, approve/reject supplier products |
| **admin** | System Administrator | Manage users, roles, departments, positions, workflows, module visibility |

---

## Testing Approach

### Test Execution Guidelines:
1. **Each tester is assigned ONE role + position**
2. **Complete all scenarios for your assigned role in sequence**
3. **Test data will be provided** (PR numbers, supplier names, etc.)
4. **Mark each scenario as P (Pass) or F (Fail)**
5. **Document any issues in Remarks column**
6. **Cross-role dependencies** are noted in scenarios

### Status Codes:
- **P** = Pass
- **F** = Fail
- **N/A** = Not Applicable
- **Blocked** = Cannot test due to dependency

---

## UAT Test Scenarios by Role


---

## ROLE 1: EMPLOYEE (Staff Position)

**Tester Assignment:** _________________  
**Test Date:** _________________

### Overview
Employees initiate purchase requests (PR1) and track their progress through the procurement cycle.

### End-to-End Workflow
Employee creates PR1 → Warehouse validates → Approvers approve → Procurement processes → Employee receives goods

---

### Authentication & Profile

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| E-01 | Login with email and password | | |
| E-02 | Use "Remember Me" functionality | | |
| E-03 | Logout successfully | | |
| E-04 | Forgot Password - Request reset link | | |
| E-05 | Reset password via email link | | |
| E-06 | View own profile information | | |
| E-07 | View assigned role (employee) | | |
| E-08 | View assigned department and position (Staff) | | |
| E-09 | Change own password | | |
| E-10 | Confirm password change | | |

---

### PR1 Creation & Management

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| E-11 | Navigate to PR1 module | | |
| E-12 | Create new PR1 | | |
| E-13 | Enter PR1 number (manual entry) | | |
| E-14 | Select department | | |
| E-15 | Enter purpose/reason for request | | |
| E-16 | Select date required | | |
| E-17 | Add first item to PR1 | | |
| E-18 | Enter item code | | |
| E-19 | Enter item description | | |
| E-20 | Enter quantity requested | | |
| E-21 | Select unit of measure | | |
| E-22 | View Stock on Hand (SOH) display | | |
| E-23 | Add multiple items (at least 3 items) | | |
| E-24 | Reorder items in the list | | |
| E-25 | Edit item details before saving | | |
| E-26 | Delete an item from draft PR1 | | |
| E-27 | Save PR1 as draft | | |
| E-28 | Close and reopen draft PR1 | | |
| E-29 | Edit draft PR1 | | |
| E-30 | Submit PR1 for approval | | |
| E-31 | Verify PR1 status changes to "pending_warehouse" | | |
| E-32 | Verify cannot edit PR1 after submission | | |
| E-33 | Verify cannot delete PR1 after submission | | |

---

### PR1 Tracking & Monitoring

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| E-34 | View list of own PR1s | | |
| E-35 | Filter PR1 by status (draft, pending, approved, rejected) | | |
| E-36 | Filter PR1 by date range | | |
| E-37 | Search PR1 by PR number | | |
| E-38 | View PR1 details | | |
| E-39 | View PR1 approval history | | |
| E-40 | View warehouse validation status | | |
| E-41 | View warehouse notes (if any) | | |
| E-42 | View approver signatures and timestamps | | |
| E-43 | View rejection reason (if rejected) | | |
| E-44 | Print PR1 | | |
| E-45 | Export PR1 to PDF | | |

---

### Delivery Tracking (Employee View)

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| E-46 | View expected deliveries for own PR1s | | |
| E-47 | View delivery schedule | | |
| E-48 | View delivery status (pending, scheduled, in_transit, delivered) | | |
| E-49 | View actual delivery date | | |
| E-50 | View delivery remarks | | |

---

### GRN Visibility (Employee View)

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| E-51 | View GRN for own requisition | | |
| E-52 | View GRN number | | |
| E-53 | View quantities received | | |
| E-54 | View quantities rejected (if any) | | |
| E-55 | View GRN remarks | | |

---

### Notifications

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| E-56 | View notification list | | |
| E-57 | Receive notification when PR1 is submitted | | |
| E-58 | Receive notification when PR1 is approved | | |
| E-59 | Receive notification when PR1 is rejected | | |
| E-60 | Receive notification when delivery is scheduled | | |
| E-61 | Receive notification when goods are delivered | | |
| E-62 | Mark notification as read | | |
| E-63 | Click notification to view related PR1 | | |

---

### Messaging

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| E-64 | View message inbox | | |
| E-65 | View sent messages | | |
| E-66 | Compose new message | | |
| E-67 | Select recipient (search by name) | | |
| E-68 | Send message | | |
| E-69 | Reply to message | | |
| E-70 | View message thread | | |
| E-71 | Mark message as read/unread | | |
| E-72 | Delete message | | |
| E-73 | Receive real-time message notification | | |

---

### Bug Reporting

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| E-74 | Navigate to Bug Tracking module | | |
| E-75 | Create new bug report | | |
| E-76 | Enter bug title | | |
| E-77 | Enter bug description ("What I See") | | |
| E-78 | Enter expected behavior | | |
| E-79 | Enter error message (if any) | | |
| E-80 | Set bug severity (Low, Medium, High) | | |
| E-81 | Upload screenshot | | |
| E-82 | Submit bug report | | |
| E-83 | View own bug reports | | |
| E-84 | View bug status (open, in_progress, resolved, closed) | | |
| E-85 | Receive notification when bug is resolved | | |

---

### Dashboard

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| E-86 | View dashboard | | |
| E-87 | View summary of own PR1s by status | | |
| E-88 | View pending approvals count | | |
| E-89 | View recent activity | | |

---


---

## ROLE 2: WAREHOUSE (Warehouse Staff Position)

**Tester Assignment:** _________________  
**Test Date:** _________________

### Overview
Warehouse staff validate PR1 stock availability, create GRNs for incoming deliveries, and manage stock records.

### End-to-End Workflow
Receive PR1 → Validate SOH → Mark sufficient/insufficient → Create GRN when goods arrive → Close GRN

---

### Authentication & Profile

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| W-01 | Login as Warehouse Staff | | |
| W-02 | View own profile | | |
| W-03 | Verify role is "warehouse" | | |
| W-04 | Verify position is "Warehouse Staff" | | |

---

### PR1 Warehouse Validation

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| W-05 | View PR1 queue (status = pending_warehouse) | | |
| W-06 | Filter PR1 by date | | |
| W-07 | Search PR1 by PR number | | |
| W-08 | Open PR1 for validation | | |
| W-09 | View PR1 details (requisitioner, department, purpose) | | |
| W-10 | View all items in PR1 | | |
| W-11 | View requestor's entered SOH per item | | |
| W-12 | Enter validated SOH for each item | | |
| W-13 | Mark item as "available" | | |
| W-14 | Mark item as "unavailable" | | |
| W-15 | Add item-level notes | | |
| W-16 | Add overall warehouse notes | | |
| W-17 | Save validation in progress (without submitting) | | |
| W-18 | Return to saved validation | | |
| W-19 | Submit validation with decision "sufficient" | | |
| W-20 | Verify PR1 status changes to "resolved_internal" | | |
| W-21 | Submit validation with decision "insufficient" | | |
| W-22 | Verify PR1 status changes to "pending_approval" | | |
| W-23 | View validation history for a PR1 | | |

---

### Delivery Monitoring

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| W-24 | View all expected deliveries | | |
| W-25 | Filter deliveries by status | | |
| W-26 | Filter deliveries by date range | | |
| W-27 | View delivery details | | |
| W-28 | View PO number linked to delivery | | |
| W-29 | View supplier name | | |
| W-30 | View commitment date | | |
| W-31 | View scheduled delivery date | | |
| W-32 | View delivery status history | | |

---

### GRN Creation & Management

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| W-33 | View GRN list | | |
| W-34 | Filter GRN by status (open, closed) | | |
| W-35 | Create new GRN from delivery | | |
| W-36 | Verify GRN number is auto-generated (GRN-YYYYMM-XXXX) | | |
| W-37 | View linked PO, PR2, PR1 numbers | | |
| W-38 | View supplier name | | |
| W-39 | View department and purpose | | |
| W-40 | Enter invoice number | | |
| W-41 | Enter DR (Delivery Receipt) number | | |
| W-42 | Enter DR date | | |
| W-43 | Enter transaction date | | |
| W-44 | View all items from PO | | |
| W-45 | View quantity ordered per item | | |
| W-46 | Enter quantity received per item | | |
| W-47 | Enter quantity rejected per item (if any) | | |
| W-48 | Add per-item remarks | | |
| W-49 | Add overall GRN remarks | | |
| W-50 | Save GRN as open (in progress) | | |
| W-51 | Return to open GRN and continue editing | | |
| W-52 | Close GRN (mark as complete) | | |
| W-53 | Verify GRN status changes to "closed" | | |
| W-54 | Verify cannot edit closed GRN | | |
| W-55 | Print GRN | | |
| W-56 | Export GRN to PDF | | |
| W-57 | View GRN history | | |

---

### PO Visibility (Warehouse View)

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| W-58 | View all POs (read-only) | | |
| W-59 | View PO details | | |
| W-60 | View PO items | | |
| W-61 | View delivery address and warehouse | | |

---

### Notifications

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| W-62 | Receive notification when new PR1 needs validation | | |
| W-63 | Receive notification when delivery is scheduled | | |
| W-64 | Receive notification when delivery arrives | | |

---

### Messaging

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| W-65 | Send message to procurement staff | | |
| W-66 | Send message to employee (requisitioner) | | |
| W-67 | Reply to messages | | |

---


---

## ROLE 3: PROCUREMENT (Multiple Positions)

### Position 3A: Procurement Staff / Authorized Personnel

**Tester Assignment:** _________________  
**Test Date:** _________________

#### Overview
Procurement Staff prepare PR2 Phase 1 documents after canvassing is complete.

#### Workflow
Approved PR1 → Create RFQ → Receive quotes → Select winners → Generate PR2 → Prepare PR2 Phase 1

---

#### RFQ Creation & Management

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| P1-01 | Login as Procurement Staff | | |
| P1-02 | View approved PR1 list (status = approved) | | |
| P1-03 | Select PR1 for canvassing | | |
| P1-04 | Create RFQ from PR1 | | |
| P1-05 | Verify RFQ number is auto-generated | | |
| P1-06 | View RFQ items (copied from PR1) | | |
| P1-07 | Select suppliers for RFQ (minimum 3) | | |
| P1-08 | Set RFQ deadline | | |
| P1-09 | Add RFQ notes | | |
| P1-10 | Save RFQ as draft | | |
| P1-11 | Edit draft RFQ | | |
| P1-12 | Send RFQ to suppliers (status = open) | | |
| P1-13 | Verify RFQ email sent to suppliers | | |
| P1-14 | View RFQ list | | |
| P1-15 | Filter RFQ by status (draft, open, closed) | | |
| P1-16 | Search RFQ by RFQ number | | |
| P1-17 | View RFQ details | | |
| P1-18 | View assigned suppliers | | |
| P1-19 | View supplier response status (invited, submitted, declined) | | |

---

#### Quote Evaluation & Selection

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| P1-20 | View received quotations | | |
| P1-21 | View quote details per supplier per item | | |
| P1-22 | View unit price | | |
| P1-23 | View lead time | | |
| P1-24 | View supplier remarks | | |
| P1-25 | Compare quotes side-by-side | | |
| P1-26 | Select winning supplier per item | | |
| P1-27 | Add selection notes | | |
| P1-28 | Save supplier selections | | |
| P1-29 | Close RFQ (status = closed) | | |
| P1-30 | Verify cannot edit closed RFQ | | |

---

#### PR2 Generation

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| P1-31 | Generate PR2 from closed RFQ | | |
| P1-32 | Verify PR2 number is auto-generated | | |
| P1-33 | Verify PR1 and RFQ numbers are captured | | |
| P1-34 | View PR2 items with winning supplier data | | |
| P1-35 | View unit price from selected quote | | |
| P1-36 | Enter quantity on hand per item | | |
| P1-37 | Enter quantity incoming per item | | |
| P1-38 | Calculate quantity to purchase (auto or manual) | | |
| P1-39 | Add PR2 remarks | | |
| P1-40 | Save PR2 as draft | | |
| P1-41 | Edit draft PR2 | | |
| P1-42 | Submit PR2 for Phase 1 approval | | |
| P1-43 | Verify PR2 status = "pending_phase1_approval" | | |

---

#### PR2 Phase 1 Approval Preparation (Procurement Staff signs as Step 1)

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| P1-44 | View PR2 pending own signature | | |
| P1-45 | Open PR2 for review | | |
| P1-46 | Verify all data is correct | | |
| P1-47 | Sign PR2 as "Prepared By" (Step 1) | | |
| P1-48 | Add remarks (optional) | | |
| P1-49 | Submit signature | | |
| P1-50 | Verify PR2 moves to next approval step | | |

---

### Position 3B: Buyer

**Tester Assignment:** _________________  
**Test Date:** _________________

#### Overview
Buyers create Purchase Orders from approved PR2 Phase 2 documents and prepare PR2 Phase 2 approvals.

#### Workflow
PR2 Phase 1 approved → Buyer prepares PR2 Phase 2 → Approved → Create PO → PO approval → Send to supplier

---

#### PR2 Phase 2 Preparation (Buyer signs as Step 1)

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| P2-01 | Login as Buyer | | |
| P2-02 | View PR2 list (status = phase1_approved) | | |
| P2-03 | Open PR2 for Phase 2 preparation | | |
| P2-04 | Review PR2 items and quantities | | |
| P2-05 | Sign PR2 Phase 2 as "Prepared By" (Step 1) | | |
| P2-06 | Add remarks | | |
| P2-07 | Submit for Phase 2 approval | | |
| P2-08 | Verify PR2 status = "pending_phase2_approval" | | |

---

#### PO Creation & Management

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| P2-09 | View approved PR2 list (status = phase2_approved) | | |
| P2-10 | Create PO from approved PR2 | | |
| P2-11 | Verify PO number is auto-generated (PO-YYYY-NNNN) | | |
| P2-12 | Verify PR2, PR1, RFQ numbers are captured | | |
| P2-13 | Verify supplier name is captured | | |
| P2-14 | View PO items (from PR2) | | |
| P2-15 | Enter delivery address | | |
| P2-16 | Select warehouse | | |
| P2-17 | Enter payment terms | | |
| P2-18 | Enter packing instructions | | |
| P2-19 | Add PO remarks | | |
| P2-20 | Save PO as draft | | |
| P2-21 | Edit draft PO | | |
| P2-22 | Submit PO for approval | | |
| P2-23 | Verify PO status = "for_approval" | | |

---

#### PO Approval Preparation (Buyer signs as Step 1)

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| P2-24 | View PO pending own signature | | |
| P2-25 | Open PO for review | | |
| P2-26 | Sign PO as "Prepared By" (Step 1) | | |
| P2-27 | Add remarks | | |
| P2-28 | Submit signature | | |
| P2-29 | Verify PO moves to next approval step | | |

---

#### PO Monitoring

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| P2-30 | View all POs | | |
| P2-31 | Filter PO by status (draft, for_approval, approved, sent) | | |
| P2-32 | Search PO by PO number | | |
| P2-33 | View PO details | | |
| P2-34 | View PO approval history | | |
| P2-35 | Print PO | | |
| P2-36 | Export PO to PDF | | |

---

### Position 3C: Procurement Manager

**Tester Assignment:** _________________  
**Test Date:** _________________

#### Overview
Procurement Manager reviews and approves PR2 (both phases) and PO documents.

#### Workflow
Review PR2 Phase 1 (Step 3) → Review PR2 Phase 2 (Step 2) → Review PO (Step 2)

---

#### PR2 Phase 1 Approval (Step 3: Reviewed By)

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| P3-01 | Login as Procurement Manager | | |
| P3-02 | View PR2 approval queue (Phase 1, Step 3) | | |
| P3-03 | Open PR2 for review | | |
| P3-04 | View PR2 details and items | | |
| P3-05 | View previous approval signatures | | |
| P3-06 | Approve PR2 Phase 1 as "Reviewed By" | | |
| P3-07 | Add approval remarks | | |
| P3-08 | Submit approval | | |
| P3-09 | Verify PR2 moves to next step (Director) | | |
| P3-10 | Reject PR2 with reason | | |
| P3-11 | Verify PR2 status changes to rejected | | |

---

#### PR2 Phase 2 Approval (Step 2: Reviewed By)

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| P3-12 | View PR2 approval queue (Phase 2, Step 2) | | |
| P3-13 | Open PR2 for review | | |
| P3-14 | Approve PR2 Phase 2 as "Reviewed By" | | |
| P3-15 | Add approval remarks | | |
| P3-16 | Submit approval | | |
| P3-17 | Verify PR2 moves to next step (Director) | | |

---

#### PO Approval (Step 2: Reviewed By)

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| P3-18 | View PO approval queue (Step 2) | | |
| P3-19 | Open PO for review | | |
| P3-20 | View PO details and items | | |
| P3-21 | View previous approval signatures | | |
| P3-22 | Approve PO as "Reviewed By" | | |
| P3-23 | Add approval remarks | | |
| P3-24 | Submit approval | | |
| P3-25 | Verify PO moves to next step (Finance Director) | | |

---

#### Procurement Oversight

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| P3-26 | View all PR1s (read-only) | | |
| P3-27 | View all RFQs | | |
| P3-28 | View all PR2s | | |
| P3-29 | View all POs | | |
| P3-30 | View all deliveries | | |
| P3-31 | View all GRNs (read-only) | | |
| P3-32 | View approval history for any document | | |

---


---

## ROLE 4: APPROVER (Multiple Positions)

### Position 4A: Supervisor

**Tester Assignment:** _________________  
**Test Date:** _________________

#### Overview
Supervisors review and note PR1 documents (Step 1 of PR1 approval).

#### Workflow
PR1 submitted → Supervisor reviews and notes → Department Head approves

---

#### PR1 Approval (Step 1: Reviewed and Noted By)

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| A1-01 | Login as Supervisor | | |
| A1-02 | View PR1 approval queue (Step 1) | | |
| A1-03 | Filter queue by date | | |
| A1-04 | Open PR1 for review | | |
| A1-05 | View PR1 details (requisitioner, department, purpose) | | |
| A1-06 | View all PR1 items | | |
| A1-07 | View warehouse validation results | | |
| A1-08 | View warehouse notes | | |
| A1-09 | Approve PR1 as "Reviewed and Noted By" | | |
| A1-10 | Add approval remarks | | |
| A1-11 | Submit approval | | |
| A1-12 | Verify PR1 moves to next step (Department Head) | | |
| A1-13 | Reject PR1 with reason | | |
| A1-14 | Verify PR1 status changes to rejected | | |
| A1-15 | View approval history | | |

---

#### Notifications

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| A1-16 | Receive notification when PR1 needs approval | | |
| A1-17 | Receive notification when PR1 is fully approved | | |

---

### Position 4B: Department Head

**Tester Assignment:** _________________  
**Test Date:** _________________

#### Overview
Department Heads approve PR1 (Step 2 - final) and certify PR2 Phase 1 (Step 2).

#### Workflow
PR1: Supervisor notes → Department Head approves (final)  
PR2 Phase 1: Procurement Staff prepares → Department Head certifies → Procurement Manager reviews → Director approves

---

#### PR1 Approval (Step 2: Approved By - FINAL)

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| A2-01 | Login as Department Head | | |
| A2-02 | View PR1 approval queue (Step 2) | | |
| A2-03 | Open PR1 for review | | |
| A2-04 | View previous approval (Supervisor signature) | | |
| A2-05 | Approve PR1 as "Approved By" (final step) | | |
| A2-06 | Add approval remarks | | |
| A2-07 | Submit approval | | |
| A2-08 | Verify PR1 status changes to "approved" | | |
| A2-09 | Verify approval workflow is complete | | |
| A2-10 | Reject PR1 with reason | | |
| A2-11 | Verify PR1 status changes to rejected | | |

---

#### PR2 Phase 1 Approval (Step 2: Certified By)

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| A2-12 | View PR2 Phase 1 approval queue (Step 2) | | |
| A2-13 | Open PR2 for review | | |
| A2-14 | View PR2 items and canvassing results | | |
| A2-15 | View previous approval (Procurement Staff signature) | | |
| A2-16 | Approve PR2 as "Certified By" | | |
| A2-17 | Add approval remarks | | |
| A2-18 | Submit approval | | |
| A2-19 | Verify PR2 moves to next step (Procurement Manager) | | |

---

#### Document Visibility

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| A2-20 | View all PR1s (read-only) | | |
| A2-21 | View all PR2s (read-only) | | |
| A2-22 | View all POs (read-only) | | |
| A2-23 | View all deliveries (read-only) | | |
| A2-24 | View all GRNs (read-only) | | |

---

### Position 4C: Director

**Tester Assignment:** _________________  
**Test Date:** _________________

#### Overview
Directors provide final approval for PR2 (both phases).

#### Workflow
PR2 Phase 1: Step 4 (final) - Approved By  
PR2 Phase 2: Step 3 (final) - Approved By

---

#### PR2 Phase 1 Approval (Step 4: Approved By - FINAL)

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| A3-01 | Login as Director | | |
| A3-02 | View PR2 Phase 1 approval queue (Step 4) | | |
| A3-03 | Open PR2 for review | | |
| A3-04 | View all previous approvals (3 signatures) | | |
| A3-05 | View PR2 items and pricing | | |
| A3-06 | View RFQ comparison data | | |
| A3-07 | Approve PR2 Phase 1 as "Approved By" (final) | | |
| A3-08 | Add approval remarks | | |
| A3-09 | Submit approval | | |
| A3-10 | Verify PR2 status changes to "phase1_approved" | | |
| A3-11 | Reject PR2 with reason | | |
| A3-12 | Verify PR2 status changes to rejected | | |

---

#### PR2 Phase 2 Approval (Step 3: Approved By - FINAL)

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| A3-13 | View PR2 Phase 2 approval queue (Step 3) | | |
| A3-14 | Open PR2 for review | | |
| A3-15 | View previous approvals (2 signatures) | | |
| A3-16 | Approve PR2 Phase 2 as "Approved By" (final) | | |
| A3-17 | Add approval remarks | | |
| A3-18 | Submit approval | | |
| A3-19 | Verify PR2 status changes to "phase2_approved" | | |

---

#### RFQ Quote Visibility

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| A3-20 | View all RFQs | | |
| A3-21 | View RFQ details | | |
| A3-22 | View all supplier quotes | | |
| A3-23 | View quote comparison | | |

---

### Position 4D: Finance Director

**Tester Assignment:** _________________  
**Test Date:** _________________

#### Overview
Finance Director approves Purchase Orders (Step 3).

#### Workflow
PO: Buyer prepares → Procurement Manager reviews → Finance Director approves → Supplier receives

---

#### PO Approval (Step 3: Approved By)

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| A4-01 | Login as Finance Director | | |
| A4-02 | View PO approval queue (Step 3) | | |
| A4-03 | Open PO for review | | |
| A4-04 | View PO details and items | | |
| A4-05 | View previous approvals (2 signatures) | | |
| A4-06 | View total PO amount | | |
| A4-07 | View payment terms | | |
| A4-08 | Approve PO as "Approved By" | | |
| A4-09 | Add approval remarks | | |
| A4-10 | Submit approval | | |
| A4-11 | Verify PO moves to next step (Supplier) | | |
| A4-12 | Verify PO status changes to "approved" | | |
| A4-13 | Reject PO with reason | | |

---

#### Financial Oversight

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| A4-14 | View all POs (read-only) | | |
| A4-15 | View all PR2s (read-only) | | |
| A4-16 | View all deliveries (read-only) | | |
| A4-17 | View all GRNs (read-only) | | |
| A4-18 | View approval history for any document | | |

---


---

## ROLE 5: SUPPLIER (Supplier Representative Position)

**Tester Assignment:** _________________  
**Test Date:** _________________

### Overview
Suppliers manage their accreditation, products, respond to RFQs, acknowledge POs, and update delivery status.

### End-to-End Workflow
Register → Submit accreditation → Add products → Receive RFQ → Submit quotation → Receive PO → Acknowledge PO → Update delivery status

---

### Authentication & Registration

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| S-01 | Access supplier registration page | | |
| S-02 | Register new supplier account | | |
| S-03 | Enter company name | | |
| S-04 | Enter contact person | | |
| S-05 | Enter email address | | |
| S-06 | Enter password | | |
| S-07 | Confirm password | | |
| S-08 | Submit registration | | |
| S-09 | Receive registration confirmation email | | |
| S-10 | Login with supplier credentials | | |
| S-11 | View supplier profile | | |

---

### Supplier Accreditation

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| S-12 | Navigate to Accreditation module | | |
| S-13 | Create new accreditation application | | |
| S-14 | Upload required documents (DTI, Mayor's Permit, etc.) | | |
| S-15 | Upload multiple document files | | |
| S-16 | View uploaded documents | | |
| S-17 | Delete uploaded document (before submission) | | |
| S-18 | Save accreditation as draft | | |
| S-19 | Edit draft accreditation | | |
| S-20 | Submit accreditation for review | | |
| S-21 | Verify accreditation status = "submitted" | | |
| S-22 | View accreditation status | | |
| S-23 | Receive notification when accreditation is approved | | |
| S-24 | Receive notification when accreditation is rejected | | |
| S-25 | View rejection reason | | |
| S-26 | Receive notification when additional documents requested | | |
| S-27 | Upload additional requested documents | | |
| S-28 | Resubmit accreditation after adding documents | | |

---

### Supplier Products

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| S-29 | Navigate to Products module | | |
| S-30 | Add new product to catalog | | |
| S-31 | Enter product name | | |
| S-32 | Enter product code | | |
| S-33 | Select product category | | |
| S-34 | Enter product description | | |
| S-35 | Enter product specifications | | |
| S-36 | Upload product images | | |
| S-37 | Save product as draft | | |
| S-38 | Edit draft product | | |
| S-39 | Submit product for accreditation | | |
| S-40 | View product list | | |
| S-41 | Filter products by status (draft, submitted, verified, rejected) | | |
| S-42 | View product accreditation status | | |
| S-43 | Receive notification when product is verified | | |
| S-44 | Receive notification when product is rejected | | |
| S-45 | View product rejection reason | | |
| S-46 | View RSE (Receiving & Storage Evaluation) status | | |
| S-47 | View TSQA review results | | |

---

### RFQ & Quotations

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| S-48 | View RFQ requests | | |
| S-49 | Receive email notification for new RFQ | | |
| S-50 | Open RFQ details | | |
| S-51 | View RFQ items | | |
| S-52 | View RFQ deadline | | |
| S-53 | View item specifications | | |
| S-54 | Submit quotation for each item | | |
| S-55 | Enter unit price | | |
| S-56 | Enter lead time (days) | | |
| S-57 | Add quotation remarks | | |
| S-58 | Mark item as alternative product (if applicable) | | |
| S-59 | Save quotation as draft | | |
| S-60 | Edit draft quotation | | |
| S-61 | Submit quotation | | |
| S-62 | Verify quotation status = "submitted" | | |
| S-63 | View submitted quotations | | |
| S-64 | Edit submitted quotation (before RFQ closes) | | |
| S-65 | View quotation status | | |
| S-66 | Decline RFQ with reason | | |

---

### Purchase Orders

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| S-67 | View received POs | | |
| S-68 | Receive email notification for new PO | | |
| S-69 | Open PO details | | |
| S-70 | View PO number | | |
| S-71 | View PO items | | |
| S-72 | View quantities ordered | | |
| S-73 | View unit prices | | |
| S-74 | View total PO amount | | |
| S-75 | View delivery address | | |
| S-76 | View payment terms | | |
| S-77 | View packing instructions | | |
| S-78 | Acknowledge PO (Step 4: Received By - FINAL) | | |
| S-79 | Enter commitment date | | |
| S-80 | Add PO acknowledgment remarks | | |
| S-81 | Submit PO acknowledgment | | |
| S-82 | Verify PO status changes to "sent" | | |
| S-83 | Verify delivery record is created | | |
| S-84 | Print PO | | |
| S-85 | Export PO to PDF | | |

---

### Delivery Management

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| S-86 | View own deliveries | | |
| S-87 | Filter deliveries by status | | |
| S-88 | Open delivery details | | |
| S-89 | View linked PO number | | |
| S-90 | View delivery address | | |
| S-91 | View commitment date | | |
| S-92 | Update delivery status to "scheduled" | | |
| S-93 | Enter scheduled delivery date | | |
| S-94 | Add delivery note | | |
| S-95 | Update delivery status to "in_transit" | | |
| S-96 | Add transit note | | |
| S-97 | Update delivery status to "delayed" | | |
| S-98 | Add delay reason | | |
| S-99 | Upload delivery receipt (DR) | | |
| S-100 | Upload invoice | | |
| S-101 | Confirm delivery completion | | |
| S-102 | View delivery status history | | |
| S-103 | View procurement follow-up notes | | |

---

### Messaging

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| S-104 | Send message to procurement staff | | |
| S-105 | Reply to messages from procurement | | |
| S-106 | View message history | | |

---

### Notifications

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| S-107 | Receive notification for new RFQ | | |
| S-108 | Receive notification for new PO | | |
| S-109 | Receive notification when accreditation is approved | | |
| S-110 | Receive notification when product is verified | | |
| S-111 | Receive notification when RSE is scheduled | | |

---


---

## ROLE 6: TSQA (TSQA Staff Position)

**Tester Assignment:** _________________  
**Test Date:** _________________

### Overview
TSQA (Technical Services & Quality Assurance) staff conduct RSE (Receiving & Storage Evaluation) inspections and approve/reject supplier products.

### End-to-End Workflow
Supplier submits product → Procurement creates RSE → TSQA self-assigns → Conduct inspection → Upload report → Approve/Reject product

---

### Authentication & Profile

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| T-01 | Login as TSQA Staff | | |
| T-02 | View own profile | | |
| T-03 | Verify role is "tsqa" | | |

---

### RSE (Receiving & Storage Evaluation) Management

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| T-04 | View RSE list | | |
| T-05 | View unassigned RSE records (status = created) | | |
| T-06 | View RSE assigned to self | | |
| T-07 | Filter RSE by status (created, assigned, under_review, passed, failed) | | |
| T-08 | Open RSE details | | |
| T-09 | View RSE number (RSE-YYYYMM-XXXX) | | |
| T-10 | View supplier name | | |
| T-11 | View product details | | |
| T-12 | View product specifications | | |
| T-13 | View accreditation documents | | |
| T-14 | Self-assign RSE | | |
| T-15 | Verify RSE status changes to "assigned" | | |
| T-16 | View assigned RSE in own queue | | |

---

### RSE Inspection & Review

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| T-17 | Open assigned RSE for inspection | | |
| T-18 | View product documents | | |
| T-19 | Download product documents | | |
| T-20 | View supplier documents | | |
| T-21 | Update RSE status to "under_review" | | |
| T-22 | Add inspection remarks | | |
| T-23 | Record test findings | | |
| T-24 | Upload RSE inspection report | | |
| T-25 | Save inspection progress | | |
| T-26 | Return to saved inspection | | |

---

### RSE Verdict & Product Approval

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| T-27 | Submit RSE verdict as "passed" | | |
| T-28 | Verify RSE status changes to "passed" | | |
| T-29 | Verify product status changes to "verified" | | |
| T-30 | Submit RSE verdict as "failed" | | |
| T-31 | Enter failure reason | | |
| T-32 | Verify RSE status changes to "failed" | | |
| T-33 | Verify product status changes to "rejected" | | |
| T-34 | View RSE completion timestamp | | |

---

### Product & Document Visibility

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| T-35 | View products with status "pending_tsqa" | | |
| T-36 | View products linked to assigned RSE | | |
| T-37 | View supplier documents for assigned RSE | | |
| T-38 | View product images | | |
| T-39 | View product specifications | | |

---

### TSQA Review History

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| T-40 | View own TSQA review history | | |
| T-41 | View review details | | |
| T-42 | View review result (passed/failed) | | |
| T-43 | View review remarks | | |
| T-44 | View test findings | | |
| T-45 | View review timestamp | | |

---

### Notifications

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| T-46 | Receive notification when new RSE is created | | |
| T-47 | Receive notification when RSE is assigned to self | | |

---

### Messaging

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| T-48 | Send message to procurement staff | | |
| T-49 | Send message to supplier | | |
| T-50 | Reply to messages | | |

---


---

## ROLE 7: ADMIN (System Administrator Position)

**Tester Assignment:** _________________  
**Test Date:** _________________

### Overview
System Administrators manage users, roles, departments, positions, workflows, module visibility, and system configuration.

### End-to-End Workflow
Manage master data → Create users → Assign roles → Configure module visibility → Monitor system → Review audit logs

---

### Authentication & Profile

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| AD-01 | Login as Admin | | |
| AD-02 | View own profile | | |
| AD-03 | Verify role is "admin" | | |

---

### User Management

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| AD-04 | Navigate to User Management | | |
| AD-05 | View user list | | |
| AD-06 | Search users by name | | |
| AD-07 | Search users by email | | |
| AD-08 | Filter users by role | | |
| AD-09 | Filter users by department | | |
| AD-10 | Filter users by position | | |
| AD-11 | View user details | | |
| AD-12 | Create new user | | |
| AD-13 | Enter user full name | | |
| AD-14 | Enter user email | | |
| AD-15 | Generate temporary password | | |
| AD-16 | Assign user role | | |
| AD-17 | Assign user department | | |
| AD-18 | Assign user position | | |
| AD-19 | Save new user | | |
| AD-20 | Verify user is created | | |
| AD-21 | Invite user via email | | |
| AD-22 | Verify invitation email sent | | |
| AD-23 | Edit user details | | |
| AD-24 | Change user role | | |
| AD-25 | Change user department | | |
| AD-26 | Change user position | | |
| AD-27 | Save user changes | | |
| AD-28 | Reset user password | | |
| AD-29 | Verify password reset email sent | | |
| AD-30 | Deactivate user account | | |
| AD-31 | Reactivate user account | | |

---

### Department Management

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| AD-32 | Navigate to Department Management | | |
| AD-33 | View department list | | |
| AD-34 | Create new department | | |
| AD-35 | Enter department name | | |
| AD-36 | Enter department code | | |
| AD-37 | Save new department | | |
| AD-38 | Verify department is created | | |
| AD-39 | Edit department | | |
| AD-40 | Change department name | | |
| AD-41 | Save department changes | | |
| AD-42 | Deactivate department | | |
| AD-43 | Verify deactivated department not shown in dropdowns | | |
| AD-44 | Reactivate department | | |
| AD-45 | Assign department head | | |

---

### Position Management

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| AD-46 | Navigate to Position Management | | |
| AD-47 | View position list | | |
| AD-48 | Filter positions by role | | |
| AD-49 | Create new position | | |
| AD-50 | Enter position title | | |
| AD-51 | Select role for position | | |
| AD-52 | Save new position | | |
| AD-53 | Verify position is created | | |
| AD-54 | Edit position | | |
| AD-55 | Change position title | | |
| AD-56 | Change position role | | |
| AD-57 | Save position changes | | |
| AD-58 | Deactivate position | | |
| AD-59 | Verify deactivated position not shown in dropdowns | | |
| AD-60 | Reactivate position | | |

---

### Role Management

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| AD-61 | Navigate to Role Management | | |
| AD-62 | View role list | | |
| AD-63 | View role details | | |
| AD-64 | View positions under each role | | |
| AD-65 | Create new role | | |
| AD-66 | Enter role name | | |
| AD-67 | Save new role | | |
| AD-68 | Edit role | | |
| AD-69 | Change role name | | |
| AD-70 | Save role changes | | |

---

### Module Visibility Configuration

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| AD-71 | Navigate to Module Visibility | | |
| AD-72 | View module visibility rules | | |
| AD-73 | Filter rules by role | | |
| AD-74 | Create new visibility rule | | |
| AD-75 | Select role | | |
| AD-76 | Select position (optional) | | |
| AD-77 | Select module | | |
| AD-78 | Set visibility (visible/hidden) | | |
| AD-79 | Save visibility rule | | |
| AD-80 | Verify rule is applied | | |
| AD-81 | Edit visibility rule | | |
| AD-82 | Toggle visibility on/off | | |
| AD-83 | Save rule changes | | |
| AD-84 | Delete visibility rule | | |
| AD-85 | Configure role-wide default (position_id = null) | | |
| AD-86 | Configure position-specific override | | |
| AD-87 | Verify position override takes precedence | | |

---

### Workflow Management

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| AD-88 | Navigate to Workflow Management | | |
| AD-89 | View approval workflows | | |
| AD-90 | View workflow details | | |
| AD-91 | View workflow steps | | |
| AD-92 | View step order | | |
| AD-93 | View role required per step | | |
| AD-94 | View position required per step | | |
| AD-95 | View action label per step | | |
| AD-96 | View final step indicator | | |
| AD-97 | Edit workflow (if allowed) | | |
| AD-98 | Activate/deactivate workflow | | |

---

### Audit Log

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| AD-99 | Navigate to Audit Log | | |
| AD-100 | View audit log entries | | |
| AD-101 | Filter by document type (PR1, PR2, PO, GRN, etc.) | | |
| AD-102 | Filter by action (created, submitted, approved, rejected) | | |
| AD-103 | Filter by date range | | |
| AD-104 | Filter by user (actor) | | |
| AD-105 | View audit entry details | | |
| AD-106 | View actor name | | |
| AD-107 | View action performed | | |
| AD-108 | View document type and ID | | |
| AD-109 | View payload (JSON data) | | |
| AD-110 | View IP address | | |
| AD-111 | View timestamp | | |
| AD-112 | Export audit log to CSV | | |

---

### Bug Tracking (Admin View)

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| AD-113 | Navigate to Bug Tracking | | |
| AD-114 | View all bug reports | | |
| AD-115 | Filter bugs by status (open, in_progress, resolved, closed) | | |
| AD-116 | Filter bugs by severity (low, medium, high) | | |
| AD-117 | Filter bugs by reporter | | |
| AD-118 | View bug details | | |
| AD-119 | View bug title and description | | |
| AD-120 | View expected behavior | | |
| AD-121 | View error message | | |
| AD-122 | View affected user | | |
| AD-123 | View location | | |
| AD-124 | View uploaded screenshots | | |
| AD-125 | Update bug status to "in_progress" | | |
| AD-126 | Update bug status to "resolved" | | |
| AD-127 | Send resolution notification email to reporter | | |
| AD-128 | Update bug status to "closed" | | |
| AD-129 | Reopen bug | | |
| AD-130 | Change bug severity | | |
| AD-131 | Add admin notes to bug | | |

---

### System Monitoring

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| AD-132 | View dashboard | | |
| AD-133 | View total users count | | |
| AD-134 | View active users count | | |
| AD-135 | View total PR1s count | | |
| AD-136 | View pending approvals count | | |
| AD-137 | View system activity summary | | |

---

### Messaging (Admin View)

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| AD-138 | View all conversations (if allowed) | | |
| AD-139 | Send message to any user | | |
| AD-140 | Send broadcast message (if feature exists) | | |

---

### Notifications

| # | Scenario | Status | Remarks |
|---|----------|--------|---------|
| AD-141 | Receive notification when new user is created | | |
| AD-142 | Receive notification when bug is reported | | |
| AD-143 | Receive notification for system errors | | |

---


---

## CROSS-ROLE INTEGRATION SCENARIOS

These scenarios test the handoffs and interactions between different roles to ensure end-to-end workflow integrity.

### Scenario 1: Complete PR1 to Delivery Workflow

| Step | Role | Action | Expected Result | Status | Remarks |
|------|------|--------|----------------|--------|---------|
| 1 | Employee | Create and submit PR1 | PR1 status = pending_warehouse | | |
| 2 | Warehouse | Validate PR1 as insufficient | PR1 status = pending_approval | | |
| 3 | Supervisor | Review and note PR1 | PR1 moves to Department Head | | |
| 4 | Department Head | Approve PR1 | PR1 status = approved | | |
| 5 | Procurement Staff | Create RFQ from PR1 | RFQ created and sent | | |
| 6 | Supplier | Submit quotation | Quotation received | | |
| 7 | Procurement Staff | Select winner and generate PR2 | PR2 created | | |
| 8 | Procurement Staff | Sign PR2 Phase 1 Step 1 | PR2 moves to Department Head | | |
| 9 | Department Head | Certify PR2 Phase 1 Step 2 | PR2 moves to Procurement Manager | | |
| 10 | Procurement Manager | Review PR2 Phase 1 Step 3 | PR2 moves to Director | | |
| 11 | Director | Approve PR2 Phase 1 Step 4 | PR2 status = phase1_approved | | |
| 12 | Buyer | Sign PR2 Phase 2 Step 1 | PR2 moves to Procurement Manager | | |
| 13 | Procurement Manager | Review PR2 Phase 2 Step 2 | PR2 moves to Director | | |
| 14 | Director | Approve PR2 Phase 2 Step 3 | PR2 status = phase2_approved | | |
| 15 | Buyer | Create PO from PR2 | PO created | | |
| 16 | Buyer | Sign PO Step 1 | PO moves to Procurement Manager | | |
| 17 | Procurement Manager | Review PO Step 2 | PO moves to Finance Director | | |
| 18 | Finance Director | Approve PO Step 3 | PO moves to Supplier | | |
| 19 | Supplier | Acknowledge PO Step 4 | PO status = sent, Delivery created | | |
| 20 | Supplier | Update delivery status | Delivery status updated | | |
| 21 | Warehouse | Create GRN from delivery | GRN created | | |
| 22 | Warehouse | Close GRN | GRN status = closed | | |
| 23 | Employee | View completed delivery | Delivery visible to employee | | |

---

### Scenario 2: PR1 Rejection and Resubmission

| Step | Role | Action | Expected Result | Status | Remarks |
|------|------|--------|----------------|--------|---------|
| 1 | Employee | Create and submit PR1 | PR1 status = pending_warehouse | | |
| 2 | Warehouse | Validate PR1 as insufficient | PR1 status = pending_approval | | |
| 3 | Supervisor | Review and note PR1 | PR1 moves to Department Head | | |
| 4 | Department Head | Reject PR1 with reason | PR1 status = rejected | | |
| 5 | Employee | View rejection reason | Rejection visible | | |
| 6 | Employee | Create new PR1 with corrections | New PR1 created | | |
| 7 | Employee | Submit corrected PR1 | PR1 status = pending_warehouse | | |

---

### Scenario 3: Supplier Accreditation to Product Approval

| Step | Role | Action | Expected Result | Status | Remarks |
|------|------|--------|----------------|--------|---------|
| 1 | Supplier | Register account | Account created | | |
| 2 | Supplier | Submit accreditation with documents | Accreditation status = submitted | | |
| 3 | Procurement | Review accreditation | Accreditation under review | | |
| 4 | Procurement | Approve accreditation | Accreditation status = approved | | |
| 5 | Supplier | Add product to catalog | Product created | | |
| 6 | Supplier | Submit product for accreditation | Product status = submitted | | |
| 7 | Procurement | Create RSE for product | RSE created | | |
| 8 | TSQA | Self-assign RSE | RSE status = assigned | | |
| 9 | TSQA | Conduct inspection | RSE status = under_review | | |
| 10 | TSQA | Upload inspection report | Report uploaded | | |
| 11 | TSQA | Approve product (RSE passed) | Product status = verified | | |
| 12 | Supplier | View verified product | Product visible as verified | | |

---

### Scenario 4: Multi-Supplier RFQ

| Step | Role | Action | Expected Result | Status | Remarks |
|------|------|--------|----------------|--------|---------|
| 1 | Procurement Staff | Create RFQ with 3 suppliers | RFQ sent to 3 suppliers | | |
| 2 | Supplier A | Submit quotation | Quotation A received | | |
| 3 | Supplier B | Submit quotation | Quotation B received | | |
| 4 | Supplier C | Decline RFQ | Supplier C status = declined | | |
| 5 | Procurement Staff | Compare quotes A and B | Comparison visible | | |
| 6 | Procurement Staff | Select Supplier A as winner | Supplier A selected | | |
| 7 | Procurement Staff | Generate PR2 | PR2 created with Supplier A data | | |

---

### Scenario 5: Delivery Delay and Follow-up

| Step | Role | Action | Expected Result | Status | Remarks |
|------|------|--------|----------------|--------|---------|
| 1 | Supplier | Acknowledge PO | Delivery created | | |
| 2 | Supplier | Update status to "scheduled" | Delivery status = scheduled | | |
| 3 | Supplier | Update status to "delayed" | Delivery status = delayed | | |
| 4 | Supplier | Add delay reason | Delay reason visible | | |
| 5 | Procurement | View delivery | Delay visible | | |
| 6 | Procurement | Add follow-up note | Note added to delivery history | | |
| 7 | Supplier | Update status to "in_transit" | Delivery status = in_transit | | |
| 8 | Supplier | Confirm delivery | Delivery status = delivered | | |

---

## TEST DATA REQUIREMENTS

### User Accounts Needed

| Role | Position | Username | Email | Quantity |
|------|----------|----------|-------|----------|
| employee | Staff | emp_staff_01 | emp1@test.com | 2 |
| warehouse | Warehouse Staff | wh_staff_01 | wh1@test.com | 1 |
| warehouse | Warehouse Manager | wh_manager_01 | whm1@test.com | 1 |
| procurement | Procurement Staff | proc_staff_01 | proc1@test.com | 1 |
| procurement | Authorized Personnel | proc_auth_01 | proca1@test.com | 1 |
| procurement | Buyer | proc_buyer_01 | buyer1@test.com | 1 |
| procurement | Procurement Manager | proc_mgr_01 | procm1@test.com | 1 |
| approver | Supervisor | app_super_01 | super1@test.com | 1 |
| approver | Department Head | app_dh_01 | dh1@test.com | 1 |
| approver | Director | app_dir_01 | dir1@test.com | 1 |
| approver | Finance Director | app_fin_01 | fin1@test.com | 1 |
| supplier | Supplier Representative | sup_rep_01 | sup1@test.com | 3 |
| tsqa | TSQA Staff | tsqa_staff_01 | tsqa1@test.com | 1 |
| admin | System Administrator | admin_01 | admin1@test.com | 1 |

---

### Master Data Requirements

#### Departments
- Executive Office (EXEC)
- Finance (FIN)
- Operations (OPS)
- Information Technology (IT)
- Human Resources (HR)
- Procurement (PROC)
- Warehouse (WH)
- General Services (GS)

#### Sample Items for PR1
- Item Code: ITM-001, Description: Laptop Computer, UOM: Unit
- Item Code: ITM-002, Description: Office Chair, UOM: Unit
- Item Code: ITM-003, Description: Printer Paper, UOM: Ream
- Item Code: ITM-004, Description: Ballpen (Blue), UOM: Box
- Item Code: ITM-005, Description: Whiteboard Marker, UOM: Set

#### Sample Suppliers
- Supplier A: ABC Trading Corp.
- Supplier B: XYZ Supplies Inc.
- Supplier C: Global Office Solutions

---

## TEST EXECUTION SCHEDULE

### Phase 1: Individual Role Testing (Week 1-2)
- Each tester completes their assigned role scenarios
- Document all issues found
- Mark scenarios as Pass/Fail

### Phase 2: Cross-Role Integration Testing (Week 3)
- Execute cross-role scenarios with multiple testers
- Validate handoffs between roles
- Test complete end-to-end workflows

### Phase 3: Regression Testing (Week 4)
- Retest failed scenarios after fixes
- Verify bug fixes
- Final sign-off

---

## ISSUE REPORTING TEMPLATE

When a scenario fails, document the issue using this format:

**Issue ID:** [Auto-generated or manual]  
**Scenario ID:** [e.g., E-25]  
**Role:** [e.g., Employee]  
**Severity:** [Low / Medium / High / Critical]  
**Description:** [What went wrong]  
**Steps to Reproduce:**  
1. Step 1
2. Step 2
3. Step 3

**Expected Result:** [What should happen]  
**Actual Result:** [What actually happened]  
**Screenshots:** [Attach if available]  
**Browser/Device:** [e.g., Chrome 120, Windows 11]  
**Reported By:** [Tester name]  
**Date:** [Date reported]

---

## SIGN-OFF

### Role-Based Testing Sign-Off

| Role | Position | Tester Name | Signature | Date | Status |
|------|----------|-------------|-----------|------|--------|
| Employee | Staff | | | | |
| Warehouse | Warehouse Staff | | | | |
| Procurement | Procurement Staff | | | | |
| Procurement | Buyer | | | | |
| Procurement | Procurement Manager | | | | |
| Approver | Supervisor | | | | |
| Approver | Department Head | | | | |
| Approver | Director | | | | |
| Approver | Finance Director | | | | |
| Supplier | Supplier Representative | | | | |
| TSQA | TSQA Staff | | | | |
| Admin | System Administrator | | | | |

---

### Final UAT Sign-Off

**UAT Manager:** _____________________ **Signature:** _____________________ **Date:** _____________________

**Project Manager:** _____________________ **Signature:** _____________________ **Date:** _____________________

**Business Owner:** _____________________ **Signature:** _____________________ **Date:** _____________________

**IT Manager:** _____________________ **Signature:** _____________________ **Date:** _____________________

---

## APPENDIX A: MODULE LIST

Based on system audit, the following modules exist:

1. **Dashboard** - Overview and summary
2. **PR1** - Purchase Request creation and management
3. **Approvals** - Approval queue and history
4. **Warehouse** - Warehouse validation
5. **RFQ** - Request for Quotation
6. **PR2** - Purchase Request Phase 2
7. **PO** - Purchase Order
8. **Delivery** - Delivery tracking
9. **GRN** - Goods Receipt Note
10. **Accreditation** - Supplier accreditation
11. **Supplier** - Supplier portal
12. **TSQA** - Technical Services & Quality Assurance
13. **Messages** - Internal messaging
14. **Bugtrack** - Bug reporting and tracking
15. **Profile** - User profile management
16. **Admin** - System administration
    - User Management
    - Department Management
    - Position Management
    - Role Management
    - Module Visibility
    - Workflow Management
    - Audit Log

---

## APPENDIX B: APPROVAL WORKFLOWS

### PR1 Approval Workflow
1. **Step 1:** Supervisor - "Reviewed and Noted By"
2. **Step 2:** Department Head - "Approved By" (FINAL)

### PR2 Phase 1 Approval Workflow
1. **Step 1:** Procurement Staff / Authorized Personnel - "Prepared By"
2. **Step 2:** Department Head - "Certified By"
3. **Step 3:** Procurement Manager - "Reviewed By"
4. **Step 4:** Director - "Approved By" (FINAL)

### PR2 Phase 2 Approval Workflow
1. **Step 1:** Buyer - "Prepared By"
2. **Step 2:** Procurement Manager - "Reviewed By"
3. **Step 3:** Director - "Approved By" (FINAL)

### PO Approval Workflow
1. **Step 1:** Buyer - "Prepared By"
2. **Step 2:** Procurement Manager - "Reviewed By"
3. **Step 3:** Finance Director - "Approved By"
4. **Step 4:** Supplier Representative - "Received By" (FINAL)

---

## APPENDIX C: STATUS FLOWS

### PR1 Status Flow
```
draft → pending_warehouse → pending_approval → approved
                          ↓
                    resolved_internal (if sufficient stock)
                          ↓
                      rejected
                          ↓
                      cancelled
```

### PR2 Status Flow
```
draft → pending_phase1_approval → phase1_approved → 
pending_phase2_approval → phase2_approved → cancelled
```

### PO Status Flow
```
draft → for_approval → approved → sent → cancelled
```

### Delivery Status Flow
```
pending → scheduled → in_transit → delivered
                   ↓
                delayed → delivered
```

### GRN Status Flow
```
open → closed
```

### Supplier Accreditation Status Flow
```
draft → submitted → under_review → approved
                                 ↓
                              rejected
                                 ↓
                          missing_documents → submitted
```

### Supplier Product Status Flow
```
draft → submitted → under_review → pending_tsqa → verified
                                                 ↓
                                              rejected
```

### RSE Status Flow
```
created → assigned → under_review → passed
                                   ↓
                                 failed
                                   ↓
                               cancelled
```

---

**END OF UAT DOCUMENT**

