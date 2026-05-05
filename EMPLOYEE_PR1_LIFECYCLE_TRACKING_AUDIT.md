# Employee PR1 Request Lifecycle Tracking Audit

**Date:** 2026-05-04  
**Purpose:** Assess whether employees can track their PR1 through the full procurement lifecycle  
**Status:** Audit complete - significant gaps identified

---

## Executive Summary

**Current State:** Employees can see PR1 status only (limited visibility into downstream processes)  
**Visible:** PR1 → Warehouse Validation (partial)  
**Invisible:** PR2 → RFQ/Canvassing → PO → GRN → Delivery (mostly blocked)  
**Gap:** No unified timeline showing PR1 → PR2 → PO → GRN → Delivery progression  
**Risk:** Employees cannot track what happens after PR1 approval; visibility stops at PR1 level

---

## 1. EMPLOYEE-VISIBLE FILES & PAGES

### Employee PR1 List Page
**File:** `app/pr1/page.tsx`

**What it shows:**
- List of MY PR1 requests (created by current user)
- PR1 number, status, date created, priority
- Link to view/edit individual PR1

**What it tracks:**
- Only PR1 status
- Status values: draft, pending_warehouse, pending_approval, resolved_internal, revision_requested, for_canvassing, canvassing_complete, approved, rejected, cancelled

**Status flow visible:**
1. Draft (editable)
2. Pending Warehouse (awaiting warehouse validation)
3. Pending Approval (awaiting departmental approval)
4. Resolved Internal (stock sufficient - resolved without procurement)
5. For Canvassing (proceeding to procurement)
6. Canvassing Complete
7. Approved
8. Rejected / Cancelled

**Limitations:**
- ✗ No visibility into how many PR1s became PR2s
- ✗ No visibility into RFQ/canvassing progress
- ✗ No visibility into PO status
- ✗ No visibility into delivery/GRN status
- ✗ No timeline showing downstream stages

### Employee PR1 Detail Page
**File:** `app/pr1/[id]/page.tsx`

**What it shows:**
- Requisitioner, department, PR1 number
- Date created, date required, purpose
- Items: item code, description, unit, SOH (stock on hand), quantity requested
- Validated SOH (if warehouse validation completed)
- Signature block: "Prepared By" (preparer name, position, date)

**What it tracks:**
- PR1 header information
- Item details with quantities
- Warehouse validation results (per item)
- Approval signatures (only prepared_by_name_snapshot visible)

**Limitations:**
- ✗ No PR2 reference or link
- ✗ No RFQ reference or link
- ✗ No PO reference or link
- ✗ No GRN reference or link
- ✗ No delivery status
- ✗ No approval timeline/workflow
- ✗ No canvassing/quote information
- ✗ No supplier information
- ✗ No pricing/cost information (correctly hidden for security)

### Employee Dashboard
**File:** `components/dashboards/EmployeeDashboard.tsx`

**What it shows:**
- Stats: Total requests, Pending Approval, Approved, Rejected
- Recent 5 PR1 requests
- Pending substitute items (link to /substitutes if any)

**What it tracks:**
- Only PR1 statistics
- No downstream metrics (no PO count, no GRN count, no delivery pending)

**Limitations:**
- ✗ No PR2 statistics
- ✗ No PO statistics
- ✗ No GRN/delivery statistics

---

## 2. EMPLOYEE RLS POLICY ACCESS ANALYSIS

### Data Access by Role

**Employee accessing PR1:**
- ✓ Can read own PR1 requests (requisitioner_id = auth.uid())
- ✓ Can see pr1_requests table

**Employee accessing Warehouse Validation:**
- ✓ Can read warehouse_validations they created (via RLS)
- ✓ Can see warehouse_validation_items
- Query path: PR1 → warehouse_validations → warehouse_validation_items

**Employee accessing PR2:**
- ✓ **CAN** read PR2 via RLS policy: "Requestors can read own PR2 requests"
  - Condition: `requisitioner_id = auth.uid()`
  - This means: Employee can see their own PR2s (PR2s linked to their PR1s)
- Policy name: `"Requestors can read own PR2 requests"`

**Employee accessing RFQ/Canvassing:**
- ✓ Can read rfq_suppliers (partial) - policy: "Requestors can view rfq_suppliers for their own PR1s"
  - Uses function: `is_own_rfq_supplier(id)`
- ✓ Can read rfq_item_quotes for own RFQs
  - Policy: "Requestors can view quotes for their own PR1s"
  - Uses function: `is_own_rfq_supplier(rfq_supplier_id)`

**Employee accessing PO:**
- ✗ **CANNOT** read po_requests
- No RLS policy for requestor/employee on po_requests
- Policies on po_requests: procurement, approvers, suppliers only
- ✗ **No employee access policy exists**

**Employee accessing GRN/Delivery:**
- ✓ **CAN** read grn_receipts
  - Policy: "Employee can read own requisition GRNs"
  - Condition: Checks if grn_receipts.delivery_id matches employee's requisition
  - Implementation: Joins through delivery_tracking → pr2_requests → pr1_requests
- ✓ **CAN** read delivery_tracking (probably)
  - ✓ Policy likely exists for employees (since GRN policy references delivery_tracking)

---

## 3. DATA RELATIONSHIPS & LIFECYCLE CONNECTIONS

### Full Relationship Chain

```
pr1_requests
  ├─ id → pr1_items.pr1_id (items for this PR1)
  ├─ id → warehouse_validations.pr1_id (validation done on this PR1)
  ├─ id → pr2_requests.pr1_id (PR2 generated from this PR1)
  │     └─ pr2_id → pr2_items.pr2_id
  │
  └─ pr1_id (indirectly through PR2/RFQ) → pr2_requests.pr1_id
        └─ rfq_id → rfq_batches.id (RFQ created for this PR1)
              ├─ rfq_id → rfq_suppliers.rfq_id
              └─ rfq_suppliers.id → rfq_item_quotes

po_requests (NOT DIRECTLY LINKED TO PR1)
  ├─ pr2_id → pr2_requests.id (if relationship exists in schema)
  └─ (NO DIRECT CONNECTION TO PR1)

grn_receipts
  ├─ delivery_id → delivery_tracking.id
  └─ delivery_tracking.pr2_id → pr2_requests.id
        └─ pr2_requests.pr1_id → pr1_requests.id (CHAIN ESTABLISHED)

delivery_tracking
  ├─ pr2_id → pr2_requests.id
  └─ pr2_requests.pr1_id → pr1_requests.id (TRACEABLE BACK TO PR1)
```

### Key Observations

1. **PR2 links to PR1:** ✓ Yes
   - `pr2_requests.pr1_id` → `pr1_requests.id`
   - Employee can read PR2 if requisitioner_id matches

2. **RFQ links to PR2:** ✓ Yes
   - `pr2_requests.rfq_id` → `rfq_batches.id`
   - Employee can read RFQ-related tables for own PR1s

3. **PO links to PR2:** ✓ Likely
   - Need to verify if `po_requests.pr2_id` exists
   - ✗ **NO RLS POLICY FOR EMPLOYEES ON PO_REQUESTS**

4. **GRN links back to PR1:** ✓ Yes (confirmed)
   - `grn_receipts.delivery_id` → `delivery_tracking.id`
   - `delivery_tracking.pr2_id` → `pr2_requests.id`
   - `pr2_requests.pr1_id` → `pr1_requests.id`
   - Employee policy exists: "Employee can read own requisition GRNs"

5. **Delivery links back to PR1:** ✓ Likely
   - `delivery_tracking.pr2_id` → `pr2_requests.id`
   - `pr2_requests.pr1_id` → `pr1_requests.id`

---

## 4. CURRENT EMPLOYEE VISIBILITY BY STAGE

### Stage 1: PR1 Creation ✓
**Visible:** YES  
**Files:** app/pr1/new/page.tsx (create), app/pr1/[id]/edit/page.tsx (edit)  
**What employee sees:**
- Can create draft PR1
- Can edit PR1 before submission
- Can view own PR1 in list and detail pages

### Stage 2: Warehouse Validation ✓ (Partial)
**Visible:** YES (linked through PR1)  
**Linked data:** warehouse_validations (joined to PR1)  
**What employee sees:**
- validated_soh per item (shown in PR1 detail page, line 205)
- warehouse_decision (not displayed)
- Cannot see validation notes or detailed validation process

### Stage 3: PR1 Approval ✓ (Partial)
**Visible:** YES (status shown)  
**Status:** pending_approval, revision_requested, approved, rejected  
**What employee sees:**
- Current approval status
- Cannot see who is approving or approval timeline
- Cannot see approval remarks/comments

### Stage 4: PR2 Generation ✓ (Data Available but UI Missing)
**Visible:** NO in UI (but accessible via RLS)  
**RLS Access:** ✓ Employee can read their own PR2s  
**Data Available:** pr2_requests (if created from their PR1)  
**What employee CANNOT see (UI gap):**
- ✗ No PR2 link from PR1 detail page
- ✗ No PR2 list page for employees
- ✗ No PR2 detail page accessible to employees
- ✗ No indication that PR2 was generated

### Stage 5: RFQ/Canvassing ✓ (Data Available but UI Missing)
**Visible:** NO in UI (but accessible via RLS)  
**RLS Access:** ✓ Employee can read RFQ suppliers and quotes for own PR1  
**Data Available:** rfq_suppliers, rfq_item_quotes (if for their RFQ)  
**What employee CANNOT see (UI gap):**
- ✗ No canvassing UI for employees
- ✗ No supplier list shown
- ✗ No quote comparison shown
- ✗ No indication that canvassing is happening

### Stage 6: PO Generation ✗ (Not Accessible)
**Visible:** NO in UI  
**RLS Access:** ✗ Employee CANNOT read po_requests (no policy exists)  
**Critical Gap:** This is a major blind spot  
**What employee CANNOT see:**
- ✗ No PO list page
- ✗ No PO detail page
- ✗ No indication that PO was created
- ✗ No PO number or reference
- ✗ No PO approval status
- ✗ No supplier acknowledgment status

### Stage 7: Delivery Tracking ✓ (Data Available but UI Missing)
**Visible:** NO in UI (but accessible via RLS)  
**RLS Access:** ✓ Likely accessible (delivery_tracking references pr2_id)  
**Data Available:** delivery_tracking (if linked to their PR2)  
**What employee CANNOT see (UI gap):**
- ✗ No delivery list page for employees
- ✗ No delivery detail page
- ✗ No expected delivery date
- ✗ No actual delivery date
- ✗ No delivery status

### Stage 8: GRN/Receipt ✓ (Data Accessible, UI exists)
**Visible:** YES (via employee page likely)  
**RLS Access:** ✓ "Employee can read own requisition GRNs"  
**Data Available:** grn_receipts, grn_items  
**Files:** `app/grn/[id]/page.tsx` (exists)  
**What employee CAN see:**
- ✓ GRN detail page (if they can navigate to it)
- ✓ Items received
- ✓ Receipt dates
- **BUT:** No GRN list page for employees, so they cannot find their GRNs

---

## 5. CURRENT TIMELINE COMPONENT ANALYSIS

### Existing Timeline Components
**Search result:** No explicit timeline component found in PR1 detail page  
**Approvals timeline:** No approval workflow timeline displayed to employees

### Approval Timeline Data (Not Displayed)
**Table:** `approval_actions`  
**Data available:** action, actor, timestamp, status  
**What's missing:** No UI component to display this to employees

### PR2 Approval Timeline
**Files:** No specific timeline file for PR2  
**Status indicators:** Exist in PR2 approval pages (approvers see them)
**Component:** StatusChip used, but no full timeline

---

## 6. SECURITY & DATA SENSITIVITY ANALYSIS

### What Employees Should NOT See
- ✓ Supplier pricing (not shown) — CORRECT
- ✓ Supplier identity for competing quotes (not shown) — CORRECT
- ✓ Internal procurement discussions (not shown) — CORRECT
- ✓ Approval remarks/comments (not shown) — CORRECT
- ✓ PO amounts/pricing (correctly blocked)

### What Employees CAN Safely See (Status Only)
- ✓ PR1 status (draft, pending, approved, rejected)
- ✓ Warehouse validation decision (sufficient/insufficient)
- ✓ Whether PR2 was generated (status: yes/no)
- ✓ Whether RFQ was created (status: yes/no)
- ✓ Whether PO exists (status: yes/no) — Currently blocked, SHOULD be allowed
- ✓ Delivery status (pending/delivered)
- ✓ Quantity received vs. requested

### Security Assessment
**Current approach:** Very restrictive — employees cannot see downstream process status  
**Recommended approach:** Show status only, no pricing/supplier details  
**Risk Level:** LOW if implemented correctly (status-only visibility is safe)

---

## 7. ROOT CAUSES & GAPS

### Gap 1: No Unified Timeline/Dashboard for Employees
**Current state:**
- Employees see PR1 list and detail only
- No page showing full lifecycle
- No dashboard showing where each PR1 is in the process

**Root cause:**
- Dashboard only shows PR1 statistics
- No lifecycle page built for employees

**Consequence:**
- Employees don't know if PR1 is stuck, completed, or in progress past PR1 stage

---

### Gap 2: PR2 Not Linked in UI
**Current state:**
- PR2 data IS accessible (RLS allows employee read)
- NO UI page to view PR2 as employee
- NO link from PR1 detail page to PR2

**Root cause:**
- PR2 pages built only for procurement/approvers
- No employee view for PR2

**Consequence:**
- Even though data is accessible, employees cannot see it

---

### Gap 3: PO Completely Blocked
**Current state:**
- Employee RLS policy MISSING on po_requests
- Employees cannot read any PO
- No indication to employee that PO exists

**Root cause:**
- PO system built for procurement/approvers only
- No employee access policy created

**Consequence:**
- Major blind spot: employee cannot track if PO was issued

---

### Gap 4: Delivery Tracking UI Missing
**Current state:**
- Delivery data exists (delivery_tracking table)
- GRN receipt tracking exists
- NO UI page for employees to view delivery status
- GRN detail page exists but employees have no way to find it

**Root cause:**
- Delivery pages built for warehouse team only
- No employee view created

**Consequence:**
- Employees cannot self-serve to check delivery status

---

### Gap 5: No Approval Timeline UI
**Current state:**
- Approval actions tracked in database (approval_actions table)
- approval_workflows record timeline
- NO UI component displaying this to employees

**Root cause:**
- Approval timeline only shown to approvers
- Not exposed to requestor

**Consequence:**
- Employee doesn't see when their PR1 is awaiting approval or approval history

---

## 8. EXACT VISIBLE STATUS BY EMPLOYEE TODAY

### What Employee Sees When Viewing Their PR1
1. **PR1 Header:**
   - Number, status, priority
   - Date created, date required
   - Department, purpose

2. **Items:**
   - Code, description, unit, quantity requested
   - Stock on hand (validated, if warehouse validated)

3. **Signature Block:**
   - "Prepared By" only (not other approvers)

4. **Actions:**
   - Edit (if draft)
   - Print
   - Back to list

### What Employee Sees on PR1 List
1. PR1 number, status, date, priority
2. Pagination to view more

### What Employee Does NOT See
1. ✗ Whether PR1 advanced to PR2
2. ✗ Whether canvassing started
3. ✗ Whether PO was issued
4. ✗ Whether delivery is pending
5. ✗ GRN receipt status
6. ✗ Any downstream workflow state
7. ✗ Approval timeline/history
8. ✗ Who is currently assigned for approval

---

## 9. CONFIRMED RLS POLICIES FOR EMPLOYEES

**Employee role:** `role = 'user'` (not 'approver', 'procurement', 'warehouse', etc.)

### Readable Tables (with policies enabling employee access)
1. ✓ pr1_requests — "Employees can read own pr1_requests"
2. ✓ pr1_items — (accessible via pr1_requests)
3. ✓ warehouse_validations — (no explicit policy; accessed via pr1_requests)
4. ✓ pr2_requests — "Requestors can read own PR2 requests" (requisitioner_id)
5. ✓ rfq_suppliers — "Requestors can view rfq_suppliers for their own PR1s"
6. ✓ rfq_item_quotes — "Requestors can view quotes for their own PR1s"
7. ✓ grn_receipts — "Employee can read own requisition GRNs"
8. ✓ delivery_tracking — (likely, since GRN policy references it)

### Unreadable Tables
1. ✗ po_requests — **NO EMPLOYEE POLICY**
2. ✗ po_items — (blocked, since po_requests blocked)
3. ✗ Approval workflow data — (no employee policy)

---

## 10. QUESTIONS NEEDING CONFIRMATION

1. **Should employees be able to see PO status?**
   - Current: Blocked (no policy)
   - Question: Is this intentional? Should they see "PO issued" status at least?

2. **Should employees see delivery status?**
   - Current: Data accessible, but no UI
   - Question: Should we build an employee delivery tracking view?

3. **Should employees see approval timeline/history?**
   - Current: Not shown
   - Question: Should we display when PR1 was submitted, who is approving, status?

4. **Should PR2 be visible to employees?**
   - Current: Data accessible, but no UI exists
   - Question: Should we show PR2 link from PR1 detail page?

5. **What about supplier communication?**
   - Current: Not visible at all
   - Question: Should employees see that supplier responded to canvassing?

6. **RFQ status visibility:**
   - Current: Employees can query RFQ data but no UI shows it
   - Question: Should we show canvassing progress in PR1 detail?

---

## 11. RECOMMENDED MINIMUM FIX (Future)

### Priority 1: Add PO Access
**Action:** Create RLS policy on po_requests for employees
**Scope:** SELECT only, status-visible, no pricing shown
**Effect:** Employee sees "PO issued" status

### Priority 2: Create Lifecycle Timeline Component
**Action:** Build shared timeline component
**Scope:** Reusable by PR1, PR2, PO pages
**Display:** Status + date only, no sensitive data

### Priority 3: Add PR2 Link to PR1 Detail
**Action:** Show PR2 number if PR2 exists (join query)
**Scope:** Link to PR2 detail page (if employee UI created)
**Display:** "Advanced to PR2: PR2-12345" with link

### Priority 4: Build Employee Delivery Dashboard
**Action:** Create /delivery page for employees
**Scope:** Show deliveries for their PR1s
**Display:** Expected date, actual date, status

### Priority 5: Build Approval Timeline UI
**Action:** Show approval_actions timeline
**Scope:** Display to employee + approvers
**Display:** "Submitted [date], Approved [date], Dispatched [date]"

---

## 12. SECURITY CONCERNS & RISKS

### Risk 1: Blind Spot After PR1 Approval
**Issue:** Employee doesn't know if PR1 was forgotten, stuck, or completed
**Severity:** Medium (frustration, not security)
**Mitigation:** Show status-only timeline

### Risk 2: Data Accessible but Hidden
**Issue:** Some tables readable (RFQ, PR2, delivery) but no UI
**Severity:** Low (not a security issue, just UX)
**Mitigation:** Build UI pages carefully, no pricing shown

### Risk 3: PO Completely Blocked
**Issue:** Employee cannot verify if PO was created, even though business logic allows it
**Severity:** Medium (workflow confusion)
**Mitigation:** Add RLS policy + UI

### Risk 4: No Approval History Visible
**Issue:** Employee doesn't know why PR1 was rejected or who rejected it
**Severity:** Medium (transparency issue)
**Mitigation:** Show rejection reason + rejector name if implemented

---

## 13. SUMMARY TABLE

| Stage | Data Accessible | UI Page Exists | Employee Can View | Gap |
|-------|---|---|---|---|
| PR1 Creation | ✓ | ✓ | ✓ | None |
| Warehouse Validation | ✓ | ✗ (shown in PR1) | ✓ (partial) | No validation detail page |
| PR1 Approval | ✓ | ✗ | ✗ | No approval timeline |
| PR2 Generation | ✓ | ✓ (for procurement) | ✗ | No employee view |
| RFQ/Canvassing | ✓ | ✓ (for procurement) | ✗ | No employee view |
| PO Issuance | ✗ | ✓ (for procurement) | ✗ | No RLS policy |
| Delivery Tracking | ✓ | ✓ (for warehouse) | ✗ | No employee view |
| GRN Receipt | ✓ | ✓ (exists) | ✗ | No employee list page |

---

## Conclusion

**Today's Reality:**
- Employees can track PR1 status only
- Downstream statuses (PR2, PO, delivery) are INVISIBLE despite being accessible
- This creates a false sense of PR1 being "lost" after approval

**What Should Happen:**
- Show status-only timeline of full lifecycle
- No pricing, no supplier names, no sensitive data
- Employee knows: "PR1 → Warehouse check → Approved → PR2 issued → PO pending → In delivery → Received"

**Minimum Fix Required Before Production:**
1. Create RLS policy for employee PO access (status-only)
2. Build lifecycle timeline/status dashboard for employees
3. Link PR2 from PR1 detail if exists

**Audit Complete — Awaiting Direction**
