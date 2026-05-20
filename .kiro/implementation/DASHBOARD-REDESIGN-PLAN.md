# Dashboard Redesign - Implementation Plan

## Overview

This plan outlines a surgical, phase-by-phase approach to improve all 6 dashboards while preserving existing logic, module visibility rules, and data fetching.

**Estimated Total Time:** 4-6 hours
**Risk Level:** Low (UI-only changes, no backend modifications)

---

## Phase 0: Create Shared Components (Foundation)
**Time:** 30-45 minutes
**Files to Create:**
- `components/shared/DashboardSection.tsx`
- `components/shared/AttentionBanner.tsx`
- `components/shared/EnhancedStatCard.tsx`

### Tasks

#### 0.1 Create DashboardSection Component
```typescript
// components/shared/DashboardSection.tsx
interface DashboardSectionProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}
```
- Section header with icon, title, description
- Consistent spacing and typography
- Reusable across all dashboards

#### 0.2 Create AttentionBanner Component
```typescript
// components/shared/AttentionBanner.tsx
interface AttentionBannerProps {
  items: { label: string; count: number; href: string }[];
}
```
- Shows "All caught up!" when no items need attention
- Shows warning banner with count + links when items exist
- Animated icon for visual appeal

#### 0.3 Create EnhancedStatCard Component
```typescript
// components/shared/EnhancedStatCard.tsx
interface EnhancedStatCardProps extends StatCardProps {
  showClearState?: boolean;  // Show "All clear" when value is 0
  subtext?: string;          // Contextual helper text
}
```
- Extends existing StatCard
- Adds "All clear" zero state
- Adds subtext support
- Muted styling for zero values

#### 0.4 Export from index
- Update `components/shared/index.ts` to export new components

---

## Phase 1: Procurement Dashboard (Most Complex)
**Time:** 45-60 minutes
**File:** `components/dashboards/ProcurementDashboard.tsx`

### Current Issues
- 12 KPI cards in one band (overwhelming)
- 2 redundant panels ("Canvassing Queue" + "Open RFQs")
- Single heading doesn't cover all sections
- No visual hierarchy

### Changes

#### 1.1 Remove Redundant Panels
**Lines to Delete:** ~170-215 (the entire `showCanvassingRfq &&` block with 2 panels)

**Reason:** These panels show the same data as "Awaiting RFQ" and "Open RFQs" KPI cards.

#### 1.2 Add Attention Banner
**Add after PageHeader:**
```typescript
const attentionItems = [
  { label: 'accreditation reviews', count: cStats.accreditationPendingReview, href: '/accreditation' },
  { label: 'product reviews', count: cStats.productsPendingReview, href: '/accreditation/products' },
  { label: 'high priority RFQs', count: stats.high_priority_count, href: '/rfq' },
  { label: 'medium priority RFQs', count: stats.medium_priority_count, href: '/rfq' },
];

<AttentionBanner items={attentionItems} />
```

#### 1.3 Reorganize KPIs into Sections
**Replace single KPI band with 2 sections:**

**Section 1: RFQ Pipeline**
- Awaiting RFQ (subtext: "ready to send")
- Open RFQs (subtext: "awaiting response")
- Canvassing Done (subtext: "ready for award")
- Purchase Orders

**Section 2: Compliance Status**
- Pending TSQA (subtext: "products awaiting eval")
- RSE Pending (subtext: "evaluations pending")
- Verified (green accent)
- Rejected (showClearState: true)

#### 1.4 Remove Priority Cards from KPI Grid
High Priority and Medium Priority are now in the AttentionBanner, so remove them from the KPI grid.

#### 1.5 Remove Accreditation Queue from KPI Grid
Accreditation Queue is now in the AttentionBanner.

### Preserved Logic
- ✅ `useModuleVisibility` checks
- ✅ `fetchProcurementStats()` and `fetchProcurementComplianceDashboardStats()`
- ✅ Loading skeleton
- ✅ All href links

---

## Phase 2: Supplier Dashboard
**Time:** 30-45 minutes
**File:** `components/dashboards/SupplierDashboard.tsx`

### Current Issues
- 7 product cards (could consolidate)
- "RFQ Inbox" panel duplicates "Pending Response" KPI
- 10 total KPIs

### Changes

#### 2.1 Remove RFQ Inbox Panel
**Lines to Delete:** ~95-125 (the RFQ Inbox panel)

**Reason:** "Pending Response" KPI already shows this data.

#### 2.2 Consolidate Product Review Cards
**Merge:** "Under procurement review" + "Pending TSQA" → "In Review"

**Before:** 5 product cards
**After:** 4 product cards (Total, Verified, In Review, Rejected)

#### 2.3 Add Subtext to Cards
- Total products: no subtext
- Verified: "approved for RFQ"
- In Review: "awaiting verification"
- Rejected: showClearState: true

#### 2.4 Keep Warning Banner
The existing `rfqsPendingProductValidation` warning banner is good - keep it.

### Preserved Logic
- ✅ `useModuleVisibility` checks
- ✅ `fetchSupplierStats()` and `fetchSupplierComplianceDashboardStats()`
- ✅ Accreditation status text handling
- ✅ Loading skeleton

---

## Phase 3: Warehouse Dashboard
**Time:** 20-30 minutes
**File:** `components/dashboards/WarehouseDashboard.tsx`

### Current State
✅ Already well-designed with 4 KPIs + 2 queue panels

### Minor Improvements

#### 3.1 Add Section Headers
Add `<DashboardSection>` wrapper around KPI grid with title "Overview"

#### 3.2 Add Subtext to Cards
- Pending Validation: "PR1s awaiting check"
- Validated Today: no subtext (dynamic)
- Open GRN: "receipts in progress"
- GRN Completed: no subtext

#### 3.3 Keep Queue Panels
The queue panels show actual items (not just counts), so they're valuable - keep them.

### Preserved Logic
- ✅ All existing logic preserved
- ✅ `fetchWarehouseStats()`, `fetchWarehouseQueue()`, `fetchGRNQueue()`
- ✅ Module visibility checks

---

## Phase 4: Approver Dashboard
**Time:** 15-20 minutes
**File:** `components/dashboards/ApproverDashboard.tsx`

### Current State
✅ Already well-designed with 4 KPIs + queue panel

### Minor Improvements

#### 4.1 Add Subtext to Cards
- Awaiting My Action: "requires your signature"
- Approved This Week: no subtext
- Rejected This Week: showClearState: true
- Total Processed: "all time"

#### 4.2 Keep Queue Panel
Shows actual approval items with details - valuable, keep it.

### Preserved Logic
- ✅ All existing logic preserved
- ✅ `fetchApprovalQueue()`, `fetchApproverStats()`
- ✅ `canActOnStep()` logic

---

## Phase 5: Employee Dashboard
**Time:** 15-20 minutes
**File:** `components/dashboards/EmployeeDashboard.tsx`

### Current State
✅ Already well-designed with 4 KPIs + substitute banner + table

### Minor Improvements

#### 5.1 Add Subtext to Cards
- Total Requests: "all your PR1s"
- Pending Approval: "in review"
- Approved: no subtext
- Rejected: showClearState: true

#### 5.2 Keep Substitute Banner
Already follows the attention banner pattern - keep it.

### Preserved Logic
- ✅ All existing logic preserved
- ✅ `fetchMyPR1s()`, `fetchPendingSubstituteCount()`
- ✅ Module visibility for substitute_review

---

## Phase 6: Admin Dashboard
**Time:** 15-20 minutes
**File:** `components/dashboards/AdminDashboard.tsx`

### Current State
✅ Already well-designed with 5 KPIs + activity panel

### Minor Improvements

#### 6.1 Use PageHeader Component
Replace custom welcome section with `<PageHeader>` for consistency.

#### 6.2 Add Section Header
Add `<DashboardSection title="System Overview">` around KPI grid.

#### 6.3 Keep Activity Panel
Shows actual log entries - valuable, keep it.

### Preserved Logic
- ✅ All existing logic preserved
- ✅ All admin data fetching functions

---

## Phase 7: Cleanup & Testing
**Time:** 30 minutes

### Tasks

#### 7.1 Delete Test Dashboard
```bash
rm app/test-dashboard/page.tsx
```

#### 7.2 Run TypeScript Check
```bash
npx tsc --noEmit
```

#### 7.3 Visual Testing
Test each dashboard with different data states:
- All zeros (should show "All clear" states)
- Some items needing attention
- Full data

#### 7.4 Module Visibility Testing
Verify dashboards still respect module visibility rules.

---

## Summary Table

| Dashboard | Current KPIs | New KPIs | Panels Removed | Effort |
|-----------|--------------|----------|----------------|--------|
| Procurement | 12 | 8 | 2 (redundant) | High |
| Supplier | 10 | 7 | 1 (redundant) | Medium |
| Warehouse | 4 | 4 | 0 | Low |
| Approver | 4 | 4 | 0 | Low |
| Employee | 4 | 4 | 0 | Low |
| Admin | 5 | 5 | 0 | Low |

---

## Files Changed Summary

### New Files (Phase 0)
- `components/shared/DashboardSection.tsx`
- `components/shared/AttentionBanner.tsx`
- `components/shared/EnhancedStatCard.tsx`

### Modified Files (Phases 1-6)
- `components/dashboards/ProcurementDashboard.tsx` (major)
- `components/dashboards/SupplierDashboard.tsx` (medium)
- `components/dashboards/WarehouseDashboard.tsx` (minor)
- `components/dashboards/ApproverDashboard.tsx` (minor)
- `components/dashboards/EmployeeDashboard.tsx` (minor)
- `components/dashboards/AdminDashboard.tsx` (minor)

### Deleted Files (Phase 7)
- `app/test-dashboard/page.tsx`

---

## Risk Mitigation

1. **No Backend Changes** - All changes are UI-only
2. **Preserve Module Visibility** - All `isModuleVisible()` checks remain
3. **Preserve Data Fetching** - All fetch functions unchanged
4. **Incremental Approach** - Each phase can be tested independently
5. **Rollback Ready** - Git commit after each phase

---

## Approval Checklist

Before starting implementation, confirm:

- [ ] Phase 0: Create shared components first
- [ ] Phase 1: Procurement dashboard (most complex, do first)
- [ ] Phase 2-6: Other dashboards (simpler changes)
- [ ] Phase 7: Cleanup and testing

Ready to proceed?
