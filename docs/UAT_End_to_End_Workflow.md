# User Acceptance Testing (UAT) - End-to-End Workflow Based
## Fortune Procurement System

**Document Version:** 3.0  
**Date:** May 22, 2026  
**Approach:** End-to-End Workflow + Role-Based Testing

---

## Table of Contents
1. [Introduction](#introduction)
2. [Testing Approach](#testing-approach)
3. [Complete Procurement Workflow](#complete-procurement-workflow)
4. [End-to-End Test Scenarios](#end-to-end-test-scenarios)
5. [Role-Specific Scenarios](#role-specific-scenarios)

---

## Introduction

This UAT document follows the **actual procurement workflow** from start to finish. Each test scenario is organized by the **business process flow**, making it easy to understand how the system works end-to-end.

### Document Structure:
1. **End-to-End Workflows** - Complete business processes (PR1 → Delivery)
2. **Role-Specific Scenarios** - Individual role capabilities
3. **Cross-Role Integration** - Handoff validation between roles

---

## Testing Approach

### Primary Testing Method: End-to-End Workflow
Testers will follow the **actual procurement process** step by step, with each role performing their part in sequence.

### Test Execution:
1. **Workflow Testing** (Week 1-2) - Complete end-to-end scenarios
2. **Role-Specific Testing** (Week 2-3) - Individual role capabilities
3. **Integration Testing** (Week 3) - Cross-role handoffs
4. **Regression Testing** (Week 4) - Retest after fixes

---

## Complete Procurement Workflow

```
┌──────────────────────────────────────────────────────────────────────┐
│                    FORTUNE PROCUREMENT WORKFLOW                       │
└──────────────────────────────────────────────────────────────────────┘

PHASE 1: PURCHASE REQUEST (PR1)
┌─────────────┐
│  EMPLOYEE   │ 1. Create PR1 with items
│   (Staff)   │ 2. Submit PR1
└──────┬──────┘
       │ PR1 Status: draft → pending_warehouse
       ▼
┌─────────────┐
│  WAREHOUSE  │ 3. Validate Stock on Hand (SOH)
│   (Staff)   │ 4. Mark items available/unavailable
│             │ 5. Submit decision: SUFFICIENT or INSUFFICIENT
└──────┬──────┘
       │
       ├─ If SUFFICIENT → PR1 Status: resolved_internal (END)
       │
       └─ If INSUFFICIENT → PR1 Status: pending_approval
       │
       ▼
┌─────────────┐
│ SUPERVISOR  │ 6. Review PR1
│             │ 7. Approve as "Reviewed and Noted By"
└──────┬──────┘
       │ PR1 moves to Step 2
       ▼
┌─────────────┐
│ DEPT HEAD   │ 8. Review PR1
│             │ 9. Approve as "Approved By" (FINAL)
└──────┬──────┘
       │ PR1 Status: approved
       │
       ▼

PHASE 2: CANVASSING (RFQ)
┌─────────────┐
│PROCUREMENT  │ 10. Create RFQ from approved PR1
│   STAFF     │ 11. Select suppliers (minimum 3)
│             │ 12. Set deadline
│             │ 13. Send RFQ to suppliers
└──────┬──────┘
       │ RFQ Status: draft → open
       ▼
┌─────────────┐
│  SUPPLIER   │ 14. Receive RFQ notification
│    (A,B,C)  │ 15. Submit quotation (unit price, lead time)
└──────┬──────┘
       │ Quotations submitted
       ▼
┌─────────────┐
│PROCUREMENT  │ 16. Compare quotations
│   STAFF     │ 17. Select winning supplier per item
│             │ 18. Close RFQ
└──────┬──────┘
       │ RFQ Status: closed
       │
       ▼

PHASE 3: PURCHASE REQUEST 2 (PR2) - PHASE 1
┌─────────────┐
│PROCUREMENT  │ 19. Generate PR2 from closed RFQ
│   STAFF     │ 20. Enter qty on hand, qty incoming
│             │ 21. Calculate qty to purchase
│             │ 22. Submit PR2 for Phase 1 approval
│             │ 23. Sign as "Prepared By" (Step 1)
└──────┬──────┘
       │ PR2 Status: pending_phase1_approval
       ▼
┌─────────────┐
│ DEPT HEAD   │ 24. Review PR2
│             │ 25. Sign as "Certified By" (Step 2)
└──────┬──────┘
       │ PR2 moves to Step 3
       ▼
┌─────────────┐
│PROCUREMENT  │ 26. Review PR2
│  MANAGER    │ 27. Sign as "Reviewed By" (Step 3)
└──────┬──────┘
       │ PR2 moves to Step 4
       ▼
┌─────────────┐
│  DIRECTOR   │ 28. Review PR2
│             │ 29. Sign as "Approved By" (Step 4 - FINAL)
└──────┬──────┘
       │ PR2 Status: phase1_approved
       │
       ▼

PHASE 4: PURCHASE REQUEST 2 (PR2) - PHASE 2
┌─────────────┐
│   BUYER     │ 30. Review PR2 Phase 1 approved
│             │ 31. Sign as "Prepared By" (Step 1)
└──────┬──────┘
       │ PR2 Status: pending_phase2_approval
       ▼
┌─────────────┐
│PROCUREMENT  │ 32. Review PR2
│  MANAGER    │ 33. Sign as "Reviewed By" (Step 2)
└──────┬──────┘
       │ PR2 moves to Step 3
       ▼
┌─────────────┐
│  DIRECTOR   │ 34. Review PR2
│             │ 35. Sign as "Approved By" (Step 3 - FINAL)
└──────┬──────┘
       │ PR2 Status: phase2_approved
       │
       ▼

PHASE 5: PURCHASE ORDER (PO)
┌─────────────┐
│   BUYER     │ 36. Create PO from approved PR2
│             │ 37. Enter delivery address, warehouse
│             │ 38. Enter payment terms, packing
│             │ 39. Submit PO for approval
│             │ 40. Sign as "Prepared By" (Step 1)
└──────┬──────┘
       │ PO Status: for_approval
       ▼
┌─────────────┐
│PROCUREMENT  │ 41. Review PO
│  MANAGER    │ 42. Sign as "Reviewed By" (Step 2)
└──────┬──────┘
       │ PO moves to Step 3
       ▼
┌─────────────┐
│  FINANCE    │ 43. Review PO
│  DIRECTOR   │ 44. Sign as "Approved By" (Step 3)
└──────┬──────┘
       │ PO Status: approved, moves to Step 4
       ▼
┌─────────────┐
│  SUPPLIER   │ 45. Receive PO notification
│             │ 46. Review PO details
│             │ 47. Acknowledge PO as "Received By" (Step 4 - FINAL)
│             │ 48. Enter commitment date
└──────┬──────┘
       │ PO Status: sent
       │ Delivery record created
       │
       ▼

PHASE 6: DELIVERY TRACKING
┌─────────────┐
│  SUPPLIER   │ 49. Update delivery status to "scheduled"
│             │ 50. Enter scheduled delivery date
│             │ 51. Update status to "in_transit"
│             │ 52. Upload delivery receipt (DR)
│             │ 53. Upload invoice
│             │ 54. Confirm delivery completion
└──────┬──────┘
       │ Delivery Status: pending → scheduled → in_transit → delivered
       │
       ▼

PHASE 7: GOODS RECEIPT NOTE (GRN)
┌─────────────┐
│  WAREHOUSE  │ 55. Create GRN from delivered PO
│   (Staff)   │ 56. Enter invoice number, DR number, DR date
│             │ 57. Enter quantity received per item
│             │ 58. Enter quantity rejected (if any)
│             │ 59. Add remarks
│             │ 60. Close GRN
└──────┬──────┘
       │ GRN Status: open → closed
       │
       ▼
┌─────────────┐
│  EMPLOYEE   │ 61. View completed delivery
│   (Staff)   │ 62. View GRN details
└─────────────┘

END OF WORKFLOW
```

---


## End-to-End Test Scenarios

---

### WORKFLOW 1: Complete Procurement Cycle (Happy Path)

**Objective:** Test the complete procurement process from PR1 creation to GRN closure.

**Prerequisites:**
- Test users for all roles are created
- Sample items are available
- Supplier accounts are registered and accredited

**Test Data:**
- PR1 Number: PR1-TEST-001
- Items: 3 items (Laptop, Office Chair, Printer Paper)
- Suppliers: ABC Trading, XYZ Supplies, Global Office

---

#### PHASE 1: PR1 Creation & Approval

| Step | Role | Scenario | Expected Result | Status | Remarks |
|------|------|----------|----------------|--------|---------|
| 1.1 | Employee | Login to system | Successfully logged in | | |
| 1.2 | Employee | Navigate to PR1 module | PR1 page displayed | | |
| 1.3 | Employee | Click "Create New PR1" | PR1 form displayed | | |
| 1.4 | Employee | Enter PR1 number: PR1-TEST-001 | PR1 number accepted | | |
| 1.5 | Employee | Select department: Operations | Department selected | | |
| 1.6 | Employee | Enter purpose: "Office equipment for new staff" | Purpose entered | | |
| 1.7 | Employee | Select date required: 30 days from today | Date selected | | |
| 1.8 | Employee | Add Item 1: Laptop, Qty: 2, UOM: Unit | Item added | | |
| 1.9 | Employee | Add Item 2: Office Chair, Qty: 2, UOM: Unit | Item added | | |
| 1.10 | Employee | Add Item 3: Printer Paper, Qty: 5, UOM: Ream | Item added | | |
| 1.11 | Employee | Save as draft | PR1 saved, status = draft | | |
| 1.12 | Employee | Submit PR1 | PR1 status = pending_warehouse | | |
| 1.13 | Employee | Verify cannot edit after submission | Edit button disabled | | |
| 1.14 | Employee | Logout | Logged out | | |

---

#### PHASE 2: Warehouse Validation

| Step | Role | Scenario | Expected Result | Status | Remarks |
|------|------|----------|----------------|--------|---------|
| 2.1 | Warehouse | Login to system | Successfully logged in | | |
| 2.2 | Warehouse | Navigate to Warehouse module | Warehouse validation queue displayed | | |
| 2.3 | Warehouse | View PR1-TEST-001 in queue | PR1 visible with status pending_warehouse | | |
| 2.4 | Warehouse | Open PR1-TEST-001 | PR1 details displayed | | |
| 2.5 | Warehouse | View Item 1: Laptop, Requestor SOH: 0 | Item displayed | | |
| 2.6 | Warehouse | Enter validated SOH: 0 | SOH entered | | |
| 2.7 | Warehouse | Mark Item 1 as "unavailable" | Item marked unavailable | | |
| 2.8 | Warehouse | View Item 2: Office Chair, Requestor SOH: 0 | Item displayed | | |
| 2.9 | Warehouse | Enter validated SOH: 0 | SOH entered | | |
| 2.10 | Warehouse | Mark Item 2 as "unavailable" | Item marked unavailable | | |
| 2.11 | Warehouse | View Item 3: Printer Paper, Requestor SOH: 10 | Item displayed | | |
| 2.12 | Warehouse | Enter validated SOH: 10 | SOH entered | | |
| 2.13 | Warehouse | Mark Item 3 as "unavailable" (need more) | Item marked unavailable | | |
| 2.14 | Warehouse | Add warehouse notes: "All items need procurement" | Notes added | | |
| 2.15 | Warehouse | Submit decision: INSUFFICIENT | PR1 status = pending_approval | | |
| 2.16 | Warehouse | Logout | Logged out | | |

---

#### PHASE 3: PR1 Approval (Step 1 - Supervisor)

| Step | Role | Scenario | Expected Result | Status | Remarks |
|------|------|----------|----------------|--------|---------|
| 3.1 | Supervisor | Login to system | Successfully logged in | | |
| 3.2 | Supervisor | Navigate to Approvals module | Approval queue displayed | | |
| 3.3 | Supervisor | View PR1-TEST-001 in queue | PR1 visible, Step 1 pending | | |
| 3.4 | Supervisor | Open PR1-TEST-001 | PR1 details displayed | | |
| 3.5 | Supervisor | Review requisitioner: Employee name | Requisitioner visible | | |
| 3.6 | Supervisor | Review department: Operations | Department visible | | |
| 3.7 | Supervisor | Review purpose | Purpose visible | | |
| 3.8 | Supervisor | Review all items | All 3 items visible | | |
| 3.9 | Supervisor | Review warehouse validation | Warehouse notes visible | | |
| 3.10 | Supervisor | Click "Approve" | Approval dialog displayed | | |
| 3.11 | Supervisor | Add remarks: "Approved for procurement" | Remarks entered | | |
| 3.12 | Supervisor | Submit approval | PR1 moves to Step 2 (Department Head) | | |
| 3.13 | Supervisor | Verify PR1 no longer in own queue | PR1 not visible | | |
| 3.14 | Supervisor | Logout | Logged out | | |

---

#### PHASE 4: PR1 Approval (Step 2 - Department Head - FINAL)

| Step | Role | Scenario | Expected Result | Status | Remarks |
|------|------|----------|----------------|--------|---------|
| 4.1 | Dept Head | Login to system | Successfully logged in | | |
| 4.2 | Dept Head | Navigate to Approvals module | Approval queue displayed | | |
| 4.3 | Dept Head | View PR1-TEST-001 in queue | PR1 visible, Step 2 pending | | |
| 4.4 | Dept Head | Open PR1-TEST-001 | PR1 details displayed | | |
| 4.5 | Dept Head | Review previous approval (Supervisor) | Supervisor signature visible | | |
| 4.6 | Dept Head | Review all PR1 details | All details visible | | |
| 4.7 | Dept Head | Click "Approve" | Approval dialog displayed | | |
| 4.8 | Dept Head | Add remarks: "Final approval granted" | Remarks entered | | |
| 4.9 | Dept Head | Submit approval | PR1 status = approved | | |
| 4.10 | Dept Head | Verify approval workflow complete | Workflow shows 2/2 steps complete | | |
| 4.11 | Dept Head | Logout | Logged out | | |

---

#### PHASE 5: RFQ Creation & Canvassing

| Step | Role | Scenario | Expected Result | Status | Remarks |
|------|------|----------|----------------|--------|---------|
| 5.1 | Proc Staff | Login to system | Successfully logged in | | |
| 5.2 | Proc Staff | Navigate to RFQ module | RFQ page displayed | | |
| 5.3 | Proc Staff | View approved PR1 list | PR1-TEST-001 visible | | |
| 5.4 | Proc Staff | Select PR1-TEST-001 | PR1 selected | | |
| 5.5 | Proc Staff | Click "Create RFQ" | RFQ form displayed | | |
| 5.6 | Proc Staff | Verify RFQ number auto-generated | RFQ number displayed (e.g., RFQ-2026-0001) | | |
| 5.7 | Proc Staff | Verify items copied from PR1 | All 3 items visible | | |
| 5.8 | Proc Staff | Select Supplier A: ABC Trading | Supplier A added | | |
| 5.9 | Proc Staff | Select Supplier B: XYZ Supplies | Supplier B added | | |
| 5.10 | Proc Staff | Select Supplier C: Global Office | Supplier C added | | |
| 5.11 | Proc Staff | Set deadline: 7 days from today | Deadline set | | |
| 5.12 | Proc Staff | Add RFQ notes: "Please quote best price" | Notes added | | |
| 5.13 | Proc Staff | Save as draft | RFQ saved, status = draft | | |
| 5.14 | Proc Staff | Send RFQ to suppliers | RFQ status = open | | |
| 5.15 | Proc Staff | Verify email sent notification | Email sent confirmation displayed | | |
| 5.16 | Proc Staff | Logout | Logged out | | |

---

#### PHASE 6: Supplier Quotation Submission

| Step | Role | Scenario | Expected Result | Status | Remarks |
|------|------|----------|----------------|--------|---------|
| 6.1 | Supplier A | Login to supplier portal | Successfully logged in | | |
| 6.2 | Supplier A | View RFQ notification | RFQ notification visible | | |
| 6.3 | Supplier A | Navigate to RFQ module | RFQ list displayed | | |
| 6.4 | Supplier A | Open RFQ (RFQ-2026-0001) | RFQ details displayed | | |
| 6.5 | Supplier A | View Item 1: Laptop | Item displayed | | |
| 6.6 | Supplier A | Enter unit price: 45000 | Price entered | | |
| 6.7 | Supplier A | Enter lead time: 7 days | Lead time entered | | |
| 6.8 | Supplier A | View Item 2: Office Chair | Item displayed | | |
| 6.9 | Supplier A | Enter unit price: 5000 | Price entered | | |
| 6.10 | Supplier A | Enter lead time: 5 days | Lead time entered | | |
| 6.11 | Supplier A | View Item 3: Printer Paper | Item displayed | | |
| 6.12 | Supplier A | Enter unit price: 250 | Price entered | | |
| 6.13 | Supplier A | Enter lead time: 3 days | Lead time entered | | |
| 6.14 | Supplier A | Submit quotation | Quotation status = submitted | | |
| 6.15 | Supplier A | Logout | Logged out | | |
| 6.16 | Supplier B | Login and submit quotation (higher prices) | Quotation submitted | | |
| 6.17 | Supplier C | Login and submit quotation (competitive prices) | Quotation submitted | | |

---

#### PHASE 7: Quote Evaluation & Winner Selection

| Step | Role | Scenario | Expected Result | Status | Remarks |
|------|------|----------|----------------|--------|---------|
| 7.1 | Proc Staff | Login to system | Successfully logged in | | |
| 7.2 | Proc Staff | Navigate to RFQ module | RFQ list displayed | | |
| 7.3 | Proc Staff | Open RFQ (RFQ-2026-0001) | RFQ details displayed | | |
| 7.4 | Proc Staff | View quotations received | 3 quotations visible | | |
| 7.5 | Proc Staff | Click "Compare Quotes" | Comparison table displayed | | |
| 7.6 | Proc Staff | View Item 1 quotes from all suppliers | All quotes visible side-by-side | | |
| 7.7 | Proc Staff | Select Supplier A for Item 1 (best price) | Supplier A selected | | |
| 7.8 | Proc Staff | Add selection note: "Lowest price" | Note added | | |
| 7.9 | Proc Staff | View Item 2 quotes | All quotes visible | | |
| 7.10 | Proc Staff | Select Supplier A for Item 2 | Supplier A selected | | |
| 7.11 | Proc Staff | View Item 3 quotes | All quotes visible | | |
| 7.12 | Proc Staff | Select Supplier A for Item 3 | Supplier A selected | | |
| 7.13 | Proc Staff | Save selections | Selections saved | | |
| 7.14 | Proc Staff | Close RFQ | RFQ status = closed | | |
| 7.15 | Proc Staff | Verify cannot edit closed RFQ | Edit disabled | | |
| 7.16 | Proc Staff | Logout | Logged out | | |

---


#### PHASE 8: PR2 Generation & Phase 1 Approval

| Step | Role | Scenario | Expected Result | Status | Remarks |
|------|------|----------|----------------|--------|---------|
| 8.1 | Proc Staff | Login to system | Successfully logged in | | |
| 8.2 | Proc Staff | Navigate to PR2 module | PR2 page displayed | | |
| 8.3 | Proc Staff | Click "Generate PR2 from RFQ" | RFQ selection displayed | | |
| 8.4 | Proc Staff | Select closed RFQ (RFQ-2026-0001) | RFQ selected | | |
| 8.5 | Proc Staff | Click "Generate" | PR2 created with auto-generated number | | |
| 8.6 | Proc Staff | Verify PR1 and RFQ numbers captured | Numbers visible in PR2 | | |
| 8.7 | Proc Staff | Verify items with winning supplier data | All items show Supplier A data | | |
| 8.8 | Proc Staff | View Item 1: Unit price 45000 | Price visible | | |
| 8.9 | Proc Staff | Enter qty on hand: 0 | Qty entered | | |
| 8.10 | Proc Staff | Enter qty incoming: 0 | Qty entered | | |
| 8.11 | Proc Staff | Verify qty to purchase: 2 (auto-calculated) | Qty calculated | | |
| 8.12 | Proc Staff | Repeat for Items 2 and 3 | All items configured | | |
| 8.13 | Proc Staff | Add PR2 remarks: "Urgent procurement" | Remarks added | | |
| 8.14 | Proc Staff | Submit PR2 for Phase 1 approval | PR2 status = pending_phase1_approval | | |
| 8.15 | Proc Staff | Sign as "Prepared By" (Step 1) | Signature captured | | |
| 8.16 | Proc Staff | Verify PR2 moves to Step 2 | PR2 in Dept Head queue | | |
| 8.17 | Proc Staff | Logout | Logged out | | |

---

| Step | Role | Scenario | Expected Result | Status | Remarks |
|------|------|----------|----------------|--------|---------|
| 8.18 | Dept Head | Login to system | Successfully logged in | | |
| 8.19 | Dept Head | Navigate to Approvals (PR2 Phase 1) | Approval queue displayed | | |
| 8.20 | Dept Head | Open PR2 | PR2 details displayed | | |
| 8.21 | Dept Head | Review previous signature (Proc Staff) | Signature visible | | |
| 8.22 | Dept Head | Review items and pricing | All details visible | | |
| 8.23 | Dept Head | Sign as "Certified By" (Step 2) | Signature captured | | |
| 8.24 | Dept Head | Add remarks: "Certified correct" | Remarks added | | |
| 8.25 | Dept Head | Submit approval | PR2 moves to Step 3 | | |
| 8.26 | Dept Head | Logout | Logged out | | |

---

| Step | Role | Scenario | Expected Result | Status | Remarks |
|------|------|----------|----------------|--------|---------|
| 8.27 | Proc Manager | Login to system | Successfully logged in | | |
| 8.28 | Proc Manager | Navigate to Approvals (PR2 Phase 1) | Approval queue displayed | | |
| 8.29 | Proc Manager | Open PR2 | PR2 details displayed | | |
| 8.30 | Proc Manager | Review previous signatures (2 signatures) | Signatures visible | | |
| 8.31 | Proc Manager | Sign as "Reviewed By" (Step 3) | Signature captured | | |
| 8.32 | Proc Manager | Add remarks: "Reviewed and recommended" | Remarks added | | |
| 8.33 | Proc Manager | Submit approval | PR2 moves to Step 4 | | |
| 8.34 | Proc Manager | Logout | Logged out | | |

---

| Step | Role | Scenario | Expected Result | Status | Remarks |
|------|------|----------|----------------|--------|---------|
| 8.35 | Director | Login to system | Successfully logged in | | |
| 8.36 | Director | Navigate to Approvals (PR2 Phase 1) | Approval queue displayed | | |
| 8.37 | Director | Open PR2 | PR2 details displayed | | |
| 8.38 | Director | Review previous signatures (3 signatures) | Signatures visible | | |
| 8.39 | Director | Review total amount | Total amount visible | | |
| 8.40 | Director | Sign as "Approved By" (Step 4 - FINAL) | Signature captured | | |
| 8.41 | Director | Add remarks: "Final approval granted" | Remarks added | | |
| 8.42 | Director | Submit approval | PR2 status = phase1_approved | | |
| 8.43 | Director | Verify Phase 1 workflow complete | 4/4 steps complete | | |
| 8.44 | Director | Logout | Logged out | | |

---

#### PHASE 9: PR2 Phase 2 Approval

| Step | Role | Scenario | Expected Result | Status | Remarks |
|------|------|----------|----------------|--------|---------|
| 9.1 | Buyer | Login to system | Successfully logged in | | |
| 9.2 | Buyer | Navigate to PR2 module | PR2 list displayed | | |
| 9.3 | Buyer | View PR2 with status phase1_approved | PR2 visible | | |
| 9.4 | Buyer | Open PR2 | PR2 details displayed | | |
| 9.5 | Buyer | Review Phase 1 approvals | All 4 signatures visible | | |
| 9.6 | Buyer | Sign as "Prepared By" (Phase 2 Step 1) | Signature captured | | |
| 9.7 | Buyer | Add remarks: "Ready for Phase 2" | Remarks added | | |
| 9.8 | Buyer | Submit for Phase 2 approval | PR2 status = pending_phase2_approval | | |
| 9.9 | Buyer | Logout | Logged out | | |

---

| Step | Role | Scenario | Expected Result | Status | Remarks |
|------|------|----------|----------------|--------|---------|
| 9.10 | Proc Manager | Login to system | Successfully logged in | | |
| 9.11 | Proc Manager | Navigate to Approvals (PR2 Phase 2) | Approval queue displayed | | |
| 9.12 | Proc Manager | Open PR2 | PR2 details displayed | | |
| 9.13 | Proc Manager | Review Buyer signature | Signature visible | | |
| 9.14 | Proc Manager | Sign as "Reviewed By" (Step 2) | Signature captured | | |
| 9.15 | Proc Manager | Add remarks: "Reviewed" | Remarks added | | |
| 9.16 | Proc Manager | Submit approval | PR2 moves to Step 3 | | |
| 9.17 | Proc Manager | Logout | Logged out | | |

---

| Step | Role | Scenario | Expected Result | Status | Remarks |
|------|------|----------|----------------|--------|---------|
| 9.18 | Director | Login to system | Successfully logged in | | |
| 9.19 | Director | Navigate to Approvals (PR2 Phase 2) | Approval queue displayed | | |
| 9.20 | Director | Open PR2 | PR2 details displayed | | |
| 9.21 | Director | Review previous signatures (2 signatures) | Signatures visible | | |
| 9.22 | Director | Sign as "Approved By" (Step 3 - FINAL) | Signature captured | | |
| 9.23 | Director | Add remarks: "Phase 2 approved" | Remarks added | | |
| 9.24 | Director | Submit approval | PR2 status = phase2_approved | | |
| 9.25 | Director | Verify Phase 2 workflow complete | 3/3 steps complete | | |
| 9.26 | Director | Logout | Logged out | | |

---

#### PHASE 10: PO Creation & Approval

| Step | Role | Scenario | Expected Result | Status | Remarks |
|------|------|----------|----------------|--------|---------|
| 10.1 | Buyer | Login to system | Successfully logged in | | |
| 10.2 | Buyer | Navigate to PO module | PO page displayed | | |
| 10.3 | Buyer | View approved PR2 list | PR2 visible with status phase2_approved | | |
| 10.4 | Buyer | Select PR2 | PR2 selected | | |
| 10.5 | Buyer | Click "Create PO" | PO form displayed | | |
| 10.6 | Buyer | Verify PO number auto-generated | PO number displayed (e.g., PO-2026-0001) | | |
| 10.7 | Buyer | Verify PR2, PR1, RFQ numbers captured | Numbers visible | | |
| 10.8 | Buyer | Verify supplier: Supplier A | Supplier name visible | | |
| 10.9 | Buyer | Verify items from PR2 | All 3 items visible | | |
| 10.10 | Buyer | Enter delivery address: "Main Office, 123 Street" | Address entered | | |
| 10.11 | Buyer | Select warehouse: "Main Warehouse" | Warehouse selected | | |
| 10.12 | Buyer | Enter payment terms: "30 days net" | Terms entered | | |
| 10.13 | Buyer | Enter packing: "Standard packaging" | Packing entered | | |
| 10.14 | Buyer | Add PO remarks: "Deliver ASAP" | Remarks added | | |
| 10.15 | Buyer | Save as draft | PO saved, status = draft | | |
| 10.16 | Buyer | Submit PO for approval | PO status = for_approval | | |
| 10.17 | Buyer | Sign as "Prepared By" (Step 1) | Signature captured | | |
| 10.18 | Buyer | Logout | Logged out | | |

---

| Step | Role | Scenario | Expected Result | Status | Remarks |
|------|------|----------|----------------|--------|---------|
| 10.19 | Proc Manager | Login to system | Successfully logged in | | |
| 10.20 | Proc Manager | Navigate to Approvals (PO) | Approval queue displayed | | |
| 10.21 | Proc Manager | Open PO | PO details displayed | | |
| 10.22 | Proc Manager | Review Buyer signature | Signature visible | | |
| 10.23 | Proc Manager | Review PO details | All details visible | | |
| 10.24 | Proc Manager | Sign as "Reviewed By" (Step 2) | Signature captured | | |
| 10.25 | Proc Manager | Add remarks: "Reviewed" | Remarks added | | |
| 10.26 | Proc Manager | Submit approval | PO moves to Step 3 | | |
| 10.27 | Proc Manager | Logout | Logged out | | |

---

| Step | Role | Scenario | Expected Result | Status | Remarks |
|------|------|----------|----------------|--------|---------|
| 10.28 | Finance Dir | Login to system | Successfully logged in | | |
| 10.29 | Finance Dir | Navigate to Approvals (PO) | Approval queue displayed | | |
| 10.30 | Finance Dir | Open PO | PO details displayed | | |
| 10.31 | Finance Dir | Review previous signatures (2 signatures) | Signatures visible | | |
| 10.32 | Finance Dir | Review total PO amount | Amount visible | | |
| 10.33 | Finance Dir | Review payment terms | Terms visible | | |
| 10.34 | Finance Dir | Sign as "Approved By" (Step 3) | Signature captured | | |
| 10.35 | Finance Dir | Add remarks: "Approved for payment" | Remarks added | | |
| 10.36 | Finance Dir | Submit approval | PO status = approved, moves to Step 4 | | |
| 10.37 | Finance Dir | Logout | Logged out | | |

---

| Step | Role | Scenario | Expected Result | Status | Remarks |
|------|------|----------|----------------|--------|---------|
| 10.38 | Supplier A | Login to supplier portal | Successfully logged in | | |
| 10.39 | Supplier A | View PO notification | PO notification visible | | |
| 10.40 | Supplier A | Navigate to PO module | PO list displayed | | |
| 10.41 | Supplier A | Open PO (PO-2026-0001) | PO details displayed | | |
| 10.42 | Supplier A | Review PO items | All 3 items visible | | |
| 10.43 | Supplier A | Review delivery address | Address visible | | |
| 10.44 | Supplier A | Review payment terms | Terms visible | | |
| 10.45 | Supplier A | Click "Acknowledge PO" | Acknowledgment form displayed | | |
| 10.46 | Supplier A | Enter commitment date: 14 days from today | Date entered | | |
| 10.47 | Supplier A | Add remarks: "Will deliver on time" | Remarks added | | |
| 10.48 | Supplier A | Sign as "Received By" (Step 4 - FINAL) | Signature captured | | |
| 10.49 | Supplier A | Submit acknowledgment | PO status = sent | | |
| 10.50 | Supplier A | Verify delivery record created | Delivery visible in Delivery module | | |
| 10.51 | Supplier A | Logout | Logged out | | |

---

#### PHASE 11: Delivery Tracking

| Step | Role | Scenario | Expected Result | Status | Remarks |
|------|------|----------|----------------|--------|---------|
| 11.1 | Supplier A | Login to supplier portal | Successfully logged in | | |
| 11.2 | Supplier A | Navigate to Delivery module | Delivery list displayed | | |
| 11.3 | Supplier A | View delivery for PO-2026-0001 | Delivery visible, status = pending | | |
| 11.4 | Supplier A | Open delivery | Delivery details displayed | | |
| 11.5 | Supplier A | Update status to "scheduled" | Status updated | | |
| 11.6 | Supplier A | Enter scheduled date: 10 days from today | Date entered | | |
| 11.7 | Supplier A | Add note: "Preparing items" | Note added | | |
| 11.8 | Supplier A | Save changes | Delivery status = scheduled | | |
| 11.9 | Supplier A | Wait 5 days (simulated) | Time passed | | |
| 11.10 | Supplier A | Update status to "in_transit" | Status updated | | |
| 11.11 | Supplier A | Add note: "Items shipped" | Note added | | |
| 11.12 | Supplier A | Save changes | Delivery status = in_transit | | |
| 11.13 | Supplier A | Wait 5 days (simulated) | Time passed | | |
| 11.14 | Supplier A | Upload delivery receipt (DR) | DR uploaded | | |
| 11.15 | Supplier A | Upload invoice | Invoice uploaded | | |
| 11.16 | Supplier A | Update status to "delivered" | Status updated | | |
| 11.17 | Supplier A | Enter actual delivery date: Today | Date entered | | |
| 11.18 | Supplier A | Add note: "Delivered successfully" | Note added | | |
| 11.19 | Supplier A | Confirm delivery | Delivery status = delivered | | |
| 11.20 | Supplier A | Logout | Logged out | | |

---

#### PHASE 12: GRN Creation & Closure

| Step | Role | Scenario | Expected Result | Status | Remarks |
|------|------|----------|----------------|--------|---------|
| 12.1 | Warehouse | Login to system | Successfully logged in | | |
| 12.2 | Warehouse | Navigate to GRN module | GRN page displayed | | |
| 12.3 | Warehouse | View delivered PO list | PO-2026-0001 visible | | |
| 12.4 | Warehouse | Select PO-2026-0001 | PO selected | | |
| 12.5 | Warehouse | Click "Create GRN" | GRN form displayed | | |
| 12.6 | Warehouse | Verify GRN number auto-generated | GRN number displayed (e.g., GRN-202605-0001) | | |
| 12.7 | Warehouse | Verify PO, PR2, PR1 numbers captured | Numbers visible | | |
| 12.8 | Warehouse | Verify supplier: Supplier A | Supplier visible | | |
| 12.9 | Warehouse | Enter invoice number: INV-2026-001 | Invoice number entered | | |
| 12.10 | Warehouse | Enter DR number: DR-2026-001 | DR number entered | | |
| 12.11 | Warehouse | Enter DR date: Today | Date entered | | |
| 12.12 | Warehouse | Enter transaction date: Today | Date entered | | |
| 12.13 | Warehouse | View Item 1: Laptop, Qty ordered: 2 | Item displayed | | |
| 12.14 | Warehouse | Enter qty received: 2 | Qty entered | | |
| 12.15 | Warehouse | Enter qty rejected: 0 | Qty entered | | |
| 12.16 | Warehouse | View Item 2: Office Chair, Qty ordered: 2 | Item displayed | | |
| 12.17 | Warehouse | Enter qty received: 2 | Qty entered | | |
| 12.18 | Warehouse | Enter qty rejected: 0 | Qty entered | | |
| 12.19 | Warehouse | View Item 3: Printer Paper, Qty ordered: 5 | Item displayed | | |
| 12.20 | Warehouse | Enter qty received: 5 | Qty entered | | |
| 12.21 | Warehouse | Enter qty rejected: 0 | Qty entered | | |
| 12.22 | Warehouse | Add GRN remarks: "All items received in good condition" | Remarks added | | |
| 12.23 | Warehouse | Save as open | GRN saved, status = open | | |
| 12.24 | Warehouse | Close GRN | GRN status = closed | | |
| 12.25 | Warehouse | Verify cannot edit closed GRN | Edit disabled | | |
| 12.26 | Warehouse | Print GRN | GRN printed | | |
| 12.27 | Warehouse | Logout | Logged out | | |

---

#### PHASE 13: Employee Verification

| Step | Role | Scenario | Expected Result | Status | Remarks |
|------|------|----------|----------------|--------|---------|
| 13.1 | Employee | Login to system | Successfully logged in | | |
| 13.2 | Employee | Navigate to Dashboard | Dashboard displayed | | |
| 13.3 | Employee | View PR1-TEST-001 status | Status = approved | | |
| 13.4 | Employee | Navigate to Delivery module | Delivery list displayed | | |
| 13.5 | Employee | View delivery for own PR1 | Delivery visible, status = delivered | | |
| 13.6 | Employee | Open delivery details | Delivery details displayed | | |
| 13.7 | Employee | View delivery history | All status updates visible | | |
| 13.8 | Employee | Navigate to GRN module | GRN list displayed | | |
| 13.9 | Employee | View GRN for own PR1 | GRN visible, status = closed | | |
| 13.10 | Employee | Open GRN details | GRN details displayed | | |
| 13.11 | Employee | View quantities received | All items received | | |
| 13.12 | Employee | Verify workflow complete | All phases complete | | |
| 13.13 | Employee | Logout | Logged out | | |

---

### **END OF WORKFLOW 1**

**Total Steps:** 200+  
**Estimated Time:** 4-6 hours  
**Roles Involved:** 9 roles  
**Documents Created:** PR1, RFQ, PR2, PO, Delivery, GRN

---


### WORKFLOW 2: PR1 Rejection & Resubmission

**Objective:** Test the rejection flow and resubmission process.

**Scenario:** Department Head rejects PR1, Employee creates corrected PR1.

| Phase | Role | Key Actions | Expected Result |
|-------|------|-------------|----------------|
| 1 | Employee | Create & submit PR1 with incorrect items | PR1 submitted |
| 2 | Warehouse | Validate as insufficient | PR1 to approval |
| 3 | Supervisor | Review and approve | PR1 to Dept Head |
| 4 | Dept Head | **REJECT** with reason: "Items not justified" | PR1 status = rejected |
| 5 | Employee | View rejection reason | Reason visible |
| 6 | Employee | Create new PR1 with corrections | New PR1 created |
| 7 | Employee | Submit corrected PR1 | New PR1 submitted |
| 8 | Warehouse | Validate | PR1 to approval |
| 9 | Supervisor | Approve | PR1 to Dept Head |
| 10 | Dept Head | **APPROVE** | PR1 approved |

**Test Scenarios:** 50 steps  
**Estimated Time:** 1 hour

---

### WORKFLOW 3: Supplier Accreditation to Product Approval

**Objective:** Test supplier onboarding and product accreditation with TSQA review.

**Scenario:** New supplier registers, submits accreditation, adds products, TSQA approves.

| Phase | Role | Key Actions | Expected Result |
|-------|------|-------------|----------------|
| 1 | Supplier | Register account | Account created |
| 2 | Supplier | Submit accreditation with documents | Accreditation submitted |
| 3 | Procurement | Review accreditation | Accreditation under review |
| 4 | Procurement | Approve accreditation | Accreditation approved |
| 5 | Supplier | Add product to catalog | Product created |
| 6 | Supplier | Submit product for accreditation | Product submitted |
| 7 | Procurement | Create RSE for product | RSE created |
| 8 | TSQA | Self-assign RSE | RSE assigned |
| 9 | TSQA | Conduct inspection | RSE under review |
| 10 | TSQA | Upload inspection report | Report uploaded |
| 11 | TSQA | Approve product (RSE passed) | Product verified |
| 12 | Supplier | View verified product | Product visible as verified |

**Test Scenarios:** 80 steps  
**Estimated Time:** 2 hours

---

### WORKFLOW 4: Multi-Supplier RFQ with Mixed Winners

**Objective:** Test RFQ with multiple suppliers and different winners per item.

**Scenario:** 3 suppliers quote, different suppliers win different items.

| Phase | Role | Key Actions | Expected Result |
|-------|------|-------------|----------------|
| 1 | Procurement | Create RFQ with 5 items | RFQ created |
| 2 | Procurement | Send to 3 suppliers | RFQ sent |
| 3 | Supplier A | Submit quotes (best on items 1,2) | Quotes submitted |
| 4 | Supplier B | Submit quotes (best on items 3,4) | Quotes submitted |
| 5 | Supplier C | Submit quotes (best on item 5) | Quotes submitted |
| 6 | Procurement | Compare quotes | Comparison visible |
| 7 | Procurement | Select Supplier A for items 1,2 | Winners selected |
| 8 | Procurement | Select Supplier B for items 3,4 | Winners selected |
| 9 | Procurement | Select Supplier C for item 5 | Winners selected |
| 10 | Procurement | Close RFQ | RFQ closed |
| 11 | Procurement | Generate PR2 | **PR2 shows mixed suppliers** |

**Test Scenarios:** 60 steps  
**Estimated Time:** 1.5 hours

---

### WORKFLOW 5: Delivery Delay & Follow-up

**Objective:** Test delivery delay handling and procurement follow-up.

**Scenario:** Supplier delays delivery, procurement follows up, delivery completes.

| Phase | Role | Key Actions | Expected Result |
|-------|------|-------------|----------------|
| 1 | Supplier | Acknowledge PO | Delivery created |
| 2 | Supplier | Update status to "scheduled" | Status updated |
| 3 | Supplier | **Update status to "delayed"** | Status = delayed |
| 4 | Supplier | Add delay reason: "Supply chain issue" | Reason visible |
| 5 | Procurement | View delayed delivery | Delay visible |
| 6 | Procurement | Add follow-up note: "Please expedite" | Note added |
| 7 | Supplier | View procurement note | Note visible |
| 8 | Supplier | Update status to "in_transit" | Status updated |
| 9 | Supplier | Add note: "Expedited shipping" | Note added |
| 10 | Supplier | Confirm delivery | Delivery completed |

**Test Scenarios:** 40 steps  
**Estimated Time:** 1 hour

---

### WORKFLOW 6: Warehouse Validation - Sufficient Stock

**Objective:** Test PR1 closure when warehouse has sufficient stock.

**Scenario:** Employee requests items, warehouse has stock, PR1 closed internally.

| Phase | Role | Key Actions | Expected Result |
|-------|------|-------------|----------------|
| 1 | Employee | Create PR1 with 3 items | PR1 created |
| 2 | Employee | Submit PR1 | PR1 to warehouse |
| 3 | Warehouse | Validate Item 1: SOH = 10, Requested = 5 | Item available |
| 4 | Warehouse | Mark Item 1 as "available" | Item marked |
| 5 | Warehouse | Validate Item 2: SOH = 20, Requested = 10 | Item available |
| 6 | Warehouse | Mark Item 2 as "available" | Item marked |
| 7 | Warehouse | Validate Item 3: SOH = 50, Requested = 30 | Item available |
| 8 | Warehouse | Mark Item 3 as "available" | Item marked |
| 9 | Warehouse | Submit decision: **SUFFICIENT** | **PR1 status = resolved_internal** |
| 10 | Employee | View PR1 status | Status = resolved_internal |
| 11 | Employee | Verify no approval needed | **Workflow ends here** |

**Test Scenarios:** 30 steps  
**Estimated Time:** 30 minutes

---

## Summary of End-to-End Workflows

| Workflow | Objective | Roles | Steps | Time | Priority |
|----------|-----------|-------|-------|------|----------|
| **1. Complete Procurement Cycle** | Full happy path | 9 | 200+ | 4-6h | **CRITICAL** |
| **2. PR1 Rejection** | Rejection handling | 4 | 50 | 1h | HIGH |
| **3. Supplier Accreditation** | Supplier onboarding | 3 | 80 | 2h | HIGH |
| **4. Multi-Supplier RFQ** | Mixed winners | 2 | 60 | 1.5h | MEDIUM |
| **5. Delivery Delay** | Delay handling | 2 | 40 | 1h | MEDIUM |
| **6. Sufficient Stock** | Internal resolution | 2 | 30 | 30m | MEDIUM |
| **7. Admin System Setup** | System configuration | 1 | 100+ | 3h | HIGH |

**Total Test Time:** ~13-15 hours for all workflows

---

## Role-Specific Scenarios

After completing end-to-end workflows, test individual role capabilities:

### Employee Role
- Create multiple PR1s
- Edit draft PR1
- Delete draft PR1
- View approval history
- Track delivery status
- Report bugs
- Send messages

### Warehouse Role
- Validate multiple PR1s
- Create multiple GRNs
- Handle partial receipts
- Handle rejected items
- View PO details

### Procurement Roles
- **Procurement Staff:** RFQ management, quote comparison
- **Buyer:** PO creation, delivery address management
- **Procurement Manager:** Approval oversight, reporting

### Approver Roles
- **Supervisor:** PR1 review queue management
- **Department Head:** PR1 and PR2 approvals
- **Director:** Final PR2 approvals
- **Finance Director:** PO financial approval

### Supplier Role
- Manage multiple products
- Respond to multiple RFQs
- Acknowledge multiple POs
- Update multiple deliveries

### TSQA Role
- Self-assign RSE
- Conduct inspections
- Upload reports
- Approve/reject products

### Admin Role
- User management
- Master data management
- Module visibility configuration
- Audit log review
- Bug tracking management

---

### WORKFLOW 7: Admin System Setup & Management

**Objective:** Test admin capabilities for system configuration and user management.

**Scenario:** Admin sets up new department, creates users, configures module visibility, reviews audit logs.

| Phase | Role | Key Actions | Expected Result |
|-------|------|-------------|----------------|
| 1 | Admin | Login to admin portal | Admin dashboard visible |
| 2 | Admin | Create new department "Marketing" | Department created |
| 3 | Admin | Create new position "Marketing Manager" under approver role | Position created |
| 4 | Admin | Create new user account | User created |
| 5 | Admin | Assign user to Marketing dept, Marketing Manager position | User assigned |
| 6 | Admin | Invite user via email | Invitation sent |
| 7 | Admin | Configure module visibility for Marketing Manager | Modules configured |
| 8 | Admin | Hide "Supplier" module for employee role | Module hidden |
| 9 | Admin | View audit log | All actions logged |
| 10 | Admin | Filter audit log by document type (PR1) | Filtered results shown |
| 11 | Admin | View bug reports | All bugs visible |
| 12 | Admin | Update bug status to "in_progress" | Status updated |
| 13 | Admin | Resolve bug and send notification | Bug resolved, email sent |
| 14 | Admin | View approval workflows | All workflows visible |
| 15 | Admin | View workflow steps | Steps displayed correctly |

**Test Scenarios:** 100+ steps (see UAT_Role_Position_Based.md for detailed scenarios)  
**Estimated Time:** 3 hours

**Note:** For comprehensive Admin testing (143 scenarios), refer to **ROLE 7: ADMIN** section in `UAT_Role_Position_Based.md`.

---

## Testing Schedule

### Week 1: End-to-End Workflows
- **Day 1-2:** Workflow 1 (Complete Procurement Cycle)
- **Day 3:** Workflow 2 (PR1 Rejection)
- **Day 4:** Workflow 3 (Supplier Accreditation)
- **Day 5:** Workflows 4, 5, 6

### Week 2: Role-Specific Testing
- **Day 1:** Employee, Warehouse roles
- **Day 2:** Procurement roles
- **Day 3:** Approver roles
- **Day 4:** Supplier, TSQA roles
- **Day 5:** Workflow 7 (Admin System Setup)

### Week 3: Integration & Edge Cases
- **Day 1-2:** Cross-role integration scenarios
- **Day 3-4:** Edge cases and error handling
- **Day 5:** Regression testing

### Week 4: Bug Fixes & Final Testing
- **Day 1-3:** Retest failed scenarios
- **Day 4:** Final regression
- **Day 5:** Sign-off

---

## Test Data Requirements

### Users (17 accounts)
- 2 Employees
- 2 Warehouse Staff
- 1 Procurement Staff
- 1 Buyer
- 1 Procurement Manager
- 1 Supervisor
- 1 Department Head
- 1 Director
- 1 Finance Director
- 3 Suppliers
- 1 TSQA Staff
- 1 Admin

### Master Data
- 8 Departments
- 12 Positions
- 7 Roles
- 20 Sample Items
- 5 Sample Suppliers

---

## Success Criteria

### Workflow 1 (Critical)
- ✅ All 200+ steps pass
- ✅ All documents created correctly
- ✅ All approvals captured
- ✅ All status transitions correct
- ✅ All notifications sent
- ✅ All data persisted

### Overall UAT
- ✅ 95% of scenarios pass
- ✅ No critical bugs
- ✅ All high-priority bugs fixed
- ✅ All roles sign-off
- ✅ Performance acceptable
- ✅ Security validated

---

## Issue Severity & Response Time

| Severity | Response Time | Fix Time | Example |
|----------|--------------|----------|---------|
| **Critical** | 1 hour | 1 day | Cannot login, data loss |
| **High** | 4 hours | 3 days | Cannot submit PR1, approval fails |
| **Medium** | 1 day | 1 week | Filter not working |
| **Low** | 3 days | 2 weeks | UI misalignment |

---

## Sign-Off

### Workflow Testing Sign-Off

| Workflow | Tester | Date | Status | Signature |
|----------|--------|------|--------|-----------|
| 1. Complete Procurement Cycle | | | | |
| 2. PR1 Rejection | | | | |
| 3. Supplier Accreditation | | | | |
| 4. Multi-Supplier RFQ | | | | |
| 5. Delivery Delay | | | | |
| 6. Sufficient Stock | | | | |
| 7. Admin System Setup | | | | |

### Final UAT Sign-Off

**UAT Manager:** _____________________ **Date:** _____________________

**Project Manager:** _____________________ **Date:** _____________________

**Business Owner:** _____________________ **Date:** _____________________

---

**END OF DOCUMENT**

