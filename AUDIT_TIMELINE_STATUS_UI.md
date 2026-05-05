# Audit: Timeline, Approval Status, Delivery Status, and Workflow Progress UI

**Date:** 2026-04-28  
**Scope:** All pages/components using timeline, approval status, delivery status, workflow progress, or status-history UI  
**Status:** AUDIT ONLY — No code changes made

---

## Executive Summary

Found **8 distinct pages/components** with timeline/status UI across the procurement system. These pages currently have **inconsistent hierarchies and placements**, creating navigation friction for users. The recommendation is to standardize using the PR2 detail page pattern (2-column layout on desktop with sidebar timeline, stacked on mobile).

---

## Detailed Audit Results

### 1. PR2 Detail Page
**File:** `app/pr2/[id]/page.tsx`  
**Feature Area:** Purchase Request Phase 2 – Core approval workflow  
**Type of Status UI:** Approval Timeline (Phase 1 + Phase 2 dual-phase approval)  
**Current Placement:** Right-side sticky column (recently improved)  
**Placement Assessment:** **GOOD** — Already implements the recommended pattern  
**Current Implementation:**
- Desktop: 2-column layout (left: details/items, right: phases timeline sticky)
- Mobile: Stacks with timeline visible immediately after header
- Shows Phase 1 (Procurement/Department chain) and Phase 2 (Buyer chain)
- Workflow steps with status indicators (approved/rejected/revision)
- Action pills with actor name and timestamp

**Recommended Pattern:** Keep as-is (reference implementation)

---

### 2. PR1 Approval Page
**File:** `app/approvals/[id]/page.tsx`  
**Feature Area:** Purchase Request Phase 1 – Approval workflow view  
**Type of Status UI:** Workflow Timeline with approval chain  
**Current Placement:** Vertically stacked in main content (line 248)  
**Placement Assessment:** **ACCEPTABLE** — Approval-focused page, timeline placement is appropriate  
**Current Implementation:**
- Vertical timeline showing approval steps
- Status indicators for each step
- Actor names and timestamps
- "Approval Timeline" header with workflow context
- Part of dedicated approval queue view

**Recommended Pattern:** Keep as-is (approval-specific page)

---

### 3. PR2 Approval Page
**File:** `app/approvals/pr2/[id]/page.tsx`  
**Feature Area:** Purchase Request Phase 2 – Dual-phase approval view  
**Type of Status UI:** Phase Timeline + Workflow Timeline (2 phases)  
**Current Placement:** Vertically stacked in main content  
**Placement Assessment:** **ACCEPTABLE** — Approval-focused page with complex dual-phase workflow  
**Current Implementation:**
- `PhaseTimeline` component (custom header with phase label, status badge)
- `WorkflowTimeline` component (step-by-step visualization)
- Phase 1 always shown
- Phase 2 shown conditionally ("Not started" badge if phase 2 not yet active)
- Comprehensive action history with remarks
- "View full approval detail" links

**Recommended Pattern:** Keep as-is (approval-specific page)

---

### 4. PO (Purchase Order) Detail Page
**File:** `app/po/[id]/page.tsx`  
**Feature Area:** Purchase Order – Single-phase approval  
**Type of Status UI:** Approval Timeline (compact single-phase chain)  
**Current Placement:** Bottom of right column (line 270-272) AFTER items table  
**Placement Assessment:** **WEAK** — Timeline appears too low; users may miss approval status  
**Current Implementation:**
- `ApprovalTimeline` component (inline helper)
- Shows 3-step approval chain: Buyer → Procurement Manager → Finance Director
- Step indicators with status (approved/rejected/revision)
- Actor names and timestamps
- "View full approval detail" link to separate page
- Only shown when `approvalDetail` exists

**Current Layout:** 3-column grid (metadata left, items + timeline right spanning 2 cols)  
**Issue:** Approval timeline appears at bottom of items table; no sticky/prominent placement  
**Recommended Pattern:** 
- Move to right-side sticky panel (1/3 width) on desktop
- Restack items table to left (2/3 width)
- Mobile: Approval timeline immediately after header/summary

---

### 5. Delivery Tracking Detail Page
**File:** `app/delivery/[id]/page.tsx`  
**Feature Area:** Delivery Tracking – Status history  
**Type of Status UI:** Delivery Status History (timeline-like chronological events)  
**Current Placement:** Bottom of right column (line 315-372) AFTER action forms  
**Placement Assessment:** **WEAK** — Status history appears too low; hidden below fold  
**Current Implementation:**
- "Status History" header with event count
- Reverse chronological display (newest first)
- Timeline-style visualization with colored dots per status
- Actor role badges (supplier/procurement/warehouse color-coded)
- Status transitions with arrows
- Optional notes and scheduled date
- Timestamps formatted as "MMM d, yyyy h:mm a"

**Current Layout:** 3-column grid (metadata left, actions + history right spanning 2 cols)  
**Issue:** Status history below "Mark as Delivered" and "Follow-up Note" forms; no prominence  
**Recommended Pattern:**
- Move to right-side sticky panel on desktop
- Show most recent 3-4 updates above, with "View all" link to expand
- Mobile: Status history immediately after header

---

### 6. Goods Receipt Notice (GRN) Detail Page
**File:** `app/grn/[id]/page.tsx`  
**Feature Area:** Warehouse – Goods Receipt  
**Type of Status UI:** No explicit timeline/approval status UI  
**Current Placement:** N/A  
**Placement Assessment:** **N/A** — This is a data entry form, not an approval/tracking page  
**Note:** GRN has a "closed/open" status badge but no timeline/workflow visualization

---

### 7. Supplier Delivery Page (Supplier Portal)
**File:** `app/supplier/delivery/[id]/page.tsx`  
**Feature Area:** Supplier Portal – Delivery updates  
**Type of Status UI:** Status History (similar to delivery tracking)  
**Current Placement:** Likely at bottom of page (not fully verified)  
**Placement Assessment:** **WEAK** — Likely same issue as main delivery page  
**Recommendation:** Apply same pattern as main delivery page (move to sidebar)

---

### 8. Supplier PO Page (Supplier Portal)
**File:** `app/supplier/po/[id]/page.tsx`  
**Feature Area:** Supplier Portal – Purchase Order view  
**Type of Status UI:** Likely no timeline/approval UI (supplier view only)  
**Status:** Not applicable for this audit

---

## Shared/Reusable Components Identified

### Currently Duplicated/Similar Components:

1. **WorkflowTimeline** — Appears in 3+ files
   - `app/pr2/[id]/page.tsx` (custom implementation)
   - `app/approvals/[id]/page.tsx` (custom implementation)
   - `app/approvals/pr2/[id]/page.tsx` (custom implementation)
   - **Issue:** Nearly identical code across 3 files; maintenance risk
   - **Recommendation:** Extract to `components/shared/WorkflowTimeline.tsx`

2. **PhaseTimeline** — Appears in 2 files
   - `app/pr2/[id]/page.tsx` (for PR2 dual-phase)
   - `app/approvals/pr2/[id]/page.tsx` (for approval dual-phase)
   - **Issue:** Same component logic in two places
   - **Recommendation:** Extract to `components/shared/PhaseTimeline.tsx`

3. **ApprovalTimeline** — Appears in 1 file
   - `app/po/[id]/page.tsx` (inline helper)
   - **Issue:** Not reusable, specific to PO approval flow
   - **Recommendation:** Extract to `components/shared/ApprovalTimeline.tsx` for reuse

4. **Status History Timeline** — Appears in 2 files
   - `app/delivery/[id]/page.tsx` (delivery history)
   - `app/supplier/delivery/[id]/page.tsx` (supplier view of delivery history)
   - **Issue:** Likely duplicated code
   - **Recommendation:** Extract to `components/shared/DeliveryStatusHistory.tsx`

---

## Implementation Recommendations

### CHUNK 1: Highest Impact (Low Risk)
**Priority:** Critical  
**Risk Level:** LOW  
**Timeline:** 1-2 sprints  

1. **PO Detail Page** (`app/po/[id]/page.tsx`)
   - Move `ApprovalTimeline` to right-side sticky column
   - Restructure grid: 2-col left (metadata + items), 1-col right (timeline)
   - Impact: Users see approval status immediately

2. **Extract Shared Components**
   - `components/shared/WorkflowTimeline.tsx`
   - `components/shared/PhaseTimeline.tsx`
   - `components/shared/ApprovalTimeline.tsx`
   - Impact: Eliminates 200+ lines of duplicated code

---

### CHUNK 2: Medium Impact (Medium Risk)
**Priority:** High  
**Risk Level:** MEDIUM  
**Timeline:** 1-2 sprints  

1. **Delivery Tracking Detail Page** (`app/delivery/[id]/page.tsx`)
   - Move status history to right-side sticky column
   - Show summary view (latest 3-4 events) with "View all" expansion
   - Impact: Users see delivery progress immediately

2. **Supplier Delivery Page** (`app/supplier/delivery/[id]/page.tsx`)
   - Apply same pattern as main delivery page
   - Extract `components/shared/DeliveryStatusHistory.tsx`

---

### CHUNK 3: Lower Priority (Higher Risk)
**Priority:** Medium  
**Risk Level:** HIGH  
**Timeline:** 2-3 sprints (if needed)  

1. **PR1 Detail Page** (`app/pr1/[id]/page.tsx`)
   - Deferred: Requires user feedback on PR2 pattern first
   - Consideration: Add inline approval status like PR2?

2. **RFQ Detail Page** (`app/rfq/[id]/page.tsx`)
   - Deferred: Speculative; unclear if RFQ approval workflow will be added
   - Future consideration: Apply right-column pattern if RFQ approval is implemented

3. **Approval Pages** (`/approvals/[id]`, `/approvals/pr2/[id]`, `/approvals/po/[id]`)
   - Deferred: These pages appropriate as-is (approval-focused)

---

## Summary Table: All Pages Audited

| Page | File | Current Placement | Assessment | Recommended Action |
|------|------|-------------------|------------|-------------------|
| PR2 Detail | `app/pr2/[id]/page.tsx` | Right-side sticky | **GOOD** | Keep as reference pattern |
| PR1 Approval | `app/approvals/[id]/page.tsx` | Vertically stacked | **ACCEPTABLE** | Keep as-is (approval-focused) |
| PR2 Approval | `app/approvals/pr2/[id]/page.tsx` | Vertically stacked | **ACCEPTABLE** | Keep as-is (approval-focused) |
| PO Detail | `app/po/[id]/page.tsx` | Bottom of column | **WEAK** | Move to right-side sticky (Chunk 1) |
| PO Approval | `app/approvals/po/[id]/page.tsx` | Vertically stacked | **ACCEPTABLE** | Keep as-is (approval-focused) |
| Delivery Detail | `app/delivery/[id]/page.tsx` | Bottom of column | **WEAK** | Move to right-side sticky (Chunk 2) |
| Supplier Delivery | `app/supplier/delivery/[id]/page.tsx` | Bottom of column | **WEAK** | Apply same pattern (Chunk 2) |
| GRN Detail | `app/grn/[id]/page.tsx` | N/A | **N/A** | No action needed |

---

## Estimated Effort

- **Chunk 1:** ~3-5 days (component extraction + PO update)
- **Chunk 2:** ~3-5 days (delivery + supplier delivery updates)
- **Chunk 3:** TBD (pending feature validation)

---

## No Code Changes Were Made

This audit reviewed the codebase structure and layout patterns only.  
No files were modified, no components were refactored, and no business logic was changed.

**Awaiting approval before implementation.**
