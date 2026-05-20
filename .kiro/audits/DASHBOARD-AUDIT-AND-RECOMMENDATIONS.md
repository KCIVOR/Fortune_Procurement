# Dashboard Audit & Improvement Recommendations

## Executive Summary

After auditing all 6 dashboard components, I've identified several issues and opportunities for improvement:

1. **KPI Card Overload** - Procurement dashboard shows 12 KPI cards, which is overwhelming
2. **Redundant Information** - "Canvassing Queue" and "Open RFQs" panels duplicate KPI card data
3. **Inconsistent Layouts** - Different dashboards use different grid systems
4. **Missing Actionable Context** - Some cards show numbers without context
5. **No Trend Data** - StatCard supports trends but none are used

---

## Dashboard-by-Dashboard Analysis

### 1. Procurement Dashboard (Most Complex)
**File:** `components/dashboards/ProcurementDashboard.tsx`

**Current State:**
- **12 KPI cards** in a single band (6 compliance + 6 RFQ)
- 2 additional panels ("Canvassing Queue" + "Open RFQs") that duplicate KPI data
- Uses `auto-fit` grid which can create awkward layouts

**Issues Identified:**
| Issue | Severity | Description |
|-------|----------|-------------|
| Too many KPIs | High | 12 cards overwhelm users; hard to find what matters |
| Duplicate data | Medium | "Awaiting RFQ" KPI = "Canvassing Queue" panel number |
| No visual hierarchy | Medium | All cards look equally important |
| Single heading | Low | "Supplier accreditation & products" doesn't cover RFQ cards |

**Screenshot Analysis (from user):**
- Shows 12 KPI cards in 2 rows of 6
- "Canvassing Queue" and "Open RFQs" panels below show same numbers as KPIs
- User sees "1" in both "Awaiting RFQ" card AND "Canvassing Queue" panel

---

### 2. Supplier Dashboard
**File:** `components/dashboards/SupplierDashboard.tsx`

**Current State:**
- 7 KPI cards (1 accreditation + 6 products) in "Accreditation & catalog" section
- 3 KPI cards in RFQ section
- 1 "RFQ Inbox" panel
- Warning banner for pending product validation

**Issues Identified:**
| Issue | Severity | Description |
|-------|----------|-------------|
| 10 total KPIs | Medium | Still quite a lot, but better organized |
| Accreditation status text | Fixed ✓ | Previously fixed - now uses `text-xl` for text values |
| Redundant RFQ panel | Low | "Pending Response" KPI duplicates inbox panel |

---

### 3. Approver Dashboard
**File:** `components/dashboards/ApproverDashboard.tsx`

**Current State:**
- 4 KPI cards (clean, focused)
- 1 "Pending Approvals" queue panel with actual items
- Good balance of summary + detail

**Assessment:** ✅ **Well-designed** - This is the model to follow

---

### 4. Employee Dashboard
**File:** `components/dashboards/EmployeeDashboard.tsx`

**Current State:**
- 4 KPI cards (Total, Pending, Approved, Rejected)
- Substitute items banner (conditional)
- Recent Requests table

**Assessment:** ✅ **Well-designed** - Clean and actionable

---

### 5. Warehouse Dashboard
**File:** `components/dashboards/WarehouseDashboard.tsx`

**Current State:**
- 4 KPI cards (2 validation + 2 GRN)
- 2 queue panels with actual items

**Assessment:** ✅ **Well-designed** - Good balance

---

### 6. Admin Dashboard
**File:** `components/dashboards/AdminDashboard.tsx`

**Current State:**
- 5 KPI cards (Users, Roles, Positions, Departments, Audit Logs)
- Recent Activity panel

**Assessment:** ✅ **Well-designed** - Appropriate for admin overview

---

## Recommendations

### Priority 1: Fix Procurement Dashboard (High Impact)

#### Option A: Group KPIs into Collapsible Sections
```
┌─────────────────────────────────────────────────────────────┐
│ SUPPLIER COMPLIANCE                              [Collapse] │
├─────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│ │Accred    │ │Product   │ │Pending   │ │Verified  │        │
│ │Queue: 0  │ │Review: 0 │ │TSQA: 2   │ │Products:1│        │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ RFQ & CANVASSING                                 [Collapse] │
├─────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐                     │
│ │Awaiting  │ │Open RFQs │ │Canvassing│                     │
│ │RFQ: 1    │ │1         │ │Done: 3   │                     │
│ └──────────┘ └──────────┘ └──────────┘                     │
└─────────────────────────────────────────────────────────────┘
```

#### Option B: Remove Redundant Panels (Recommended - Simpler)
- **Remove** "Canvassing Queue" and "Open RFQs" panels entirely
- They just show the same numbers as the KPI cards
- The KPI cards already link to `/rfq`

#### Option C: Convert to Summary Cards with Drill-Down
Instead of 12 small KPIs, use 2-3 larger summary cards:

```
┌─────────────────────────────────┐  ┌─────────────────────────────────┐
│ SUPPLIER COMPLIANCE             │  │ RFQ PIPELINE                    │
│                                 │  │                                 │
│ 3 items need attention          │  │ 5 active RFQs                   │
│ • 0 accreditation pending       │  │ • 1 awaiting RFQ creation       │
│ • 2 products pending TSQA       │  │ • 1 open (awaiting response)    │
│ • 1 verified this week          │  │ • 3 canvassing complete         │
│                                 │  │                                 │
│ [View Accreditation →]          │  │ [View RFQ Queue →]              │
└─────────────────────────────────┘  └─────────────────────────────────┘
```

---

### Priority 2: Add Trend Data to StatCards

The `StatCard` component already supports trends but none are used:

```typescript
// Current (no trend)
<StatCard label="Open RFQs" value={1} />

// Enhanced (with trend)
<StatCard 
  label="Open RFQs" 
  value={1} 
  trend={{ value: "+2", direction: "up" }}
  subtext="vs last week"
/>
```

**Implementation:**
1. Add `_previous_period` columns to stats queries
2. Calculate delta in fetch functions
3. Pass trend data to StatCard

---

### Priority 3: Reduce Supplier Dashboard KPIs

Current: 10 KPIs
Recommended: 6 KPIs

**Remove or Consolidate:**
- Merge "Under procurement review" + "Pending TSQA" → "In Review" (combined count)
- Keep "Rejected" separate (important for action)

---

### Priority 4: Standardize Grid Classes

Current inconsistency:
```typescript
// Procurement
'grid grid-cols-1 gap-3 md:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]'

// Supplier  
'grid grid-cols-1 gap-3 md:grid-cols-[repeat(auto-fit,minmax(10.5rem,1fr))]'

// Warehouse
'grid grid-cols-1 gap-3 md:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]'

// Approver/Employee
'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3'
```

**Recommendation:** Create shared grid classes:
```typescript
// In a shared constants file
export const DASHBOARD_GRIDS = {
  // For 4 or fewer KPIs - fixed columns
  small: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3',
  
  // For 5-8 KPIs - auto-fit with min width
  medium: 'grid grid-cols-1 gap-3 md:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]',
  
  // For 2-column layout (queue panels)
  panels: 'grid grid-cols-1 lg:grid-cols-2 gap-4',
};
```

---

## Specific Recommendations by Dashboard

### Procurement Dashboard
| Change | Type | Effort |
|--------|------|--------|
| Remove "Canvassing Queue" panel | Delete | Low |
| Remove "Open RFQs" panel | Delete | Low |
| Split KPIs into 2 sections with headings | Refactor | Medium |
| Add "Priority" section for High/Medium priority items | Add | Medium |

### Supplier Dashboard
| Change | Type | Effort |
|--------|------|--------|
| Consolidate review statuses | Refactor | Low |
| Remove "RFQ Inbox" panel (redundant with KPI) | Delete | Low |

### All Dashboards
| Change | Type | Effort |
|--------|------|--------|
| Add trend data to key metrics | Enhance | High |
| Standardize grid classes | Refactor | Low |
| Add loading skeletons consistently | Enhance | Medium |

---

## Implementation Priority

### Phase 1: Quick Wins (1-2 hours)
1. ✅ Remove redundant panels from Procurement dashboard
2. ✅ Standardize grid classes across all dashboards

### Phase 2: Structural Improvements (2-4 hours)
1. Split Procurement KPIs into logical sections
2. Consolidate Supplier product review statuses
3. Add section headings where missing

### Phase 3: Enhanced Features (4-8 hours)
1. Add trend data to StatCards
2. Create "attention needed" summary cards
3. Add sparkline charts for key metrics

---

## Visual Mockup: Improved Procurement Dashboard

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Procurement — Ana                                                       │
│ Procurement Staff · Procurement                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ SUPPLIER COMPLIANCE                                                     │
│ Accreditation and product verification status                           │
│                                                                         │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐            │
│ │ Accred     │ │ Product    │ │ Pending    │ │ Verified   │            │
│ │ Queue      │ │ Review     │ │ TSQA       │ │ Products   │            │
│ │     0      │ │     0      │ │     2      │ │     1      │            │
│ └────────────┘ └────────────┘ └────────────┘ └────────────┘            │
│                                                                         │
│ RFQ & PURCHASE ORDERS                                                   │
│ Canvassing pipeline and order status                                    │
│                                                                         │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐            │
│ │ Awaiting   │ │ Open       │ │ Canvassing │ │ Purchase   │            │
│ │ RFQ        │ │ RFQs       │ │ Done       │ │ Orders     │            │
│ │     1      │ │     1      │ │     3      │ │     0      │            │
│ └────────────┘ └────────────┘ └────────────┘ └────────────┘            │
│                                                                         │
│ ⚠️ NEEDS ATTENTION                                                      │
│ ┌───────────────────────────────────────────────────────────────────┐  │
│ │ 0 High Priority  │  0 Medium Priority  │  2 Products pending TSQA │  │
│ └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key Changes:**
1. Removed redundant "Canvassing Queue" and "Open RFQs" panels
2. Organized KPIs into 2 clear sections with headings
3. Moved priority items to a separate "Needs Attention" banner
4. Reduced visual clutter while keeping all information accessible

---

## Questions for User

Before implementing, please confirm:

1. **Remove redundant panels?** The "Canvassing Queue" and "Open RFQs" panels show the same data as the KPI cards. Should I remove them?

2. **Priority items display:** Should High/Medium priority be:
   - A) Kept as KPI cards (current)
   - B) Moved to a warning banner (like the substitute items banner)
   - C) Removed from dashboard (visible on /rfq page)

3. **Trend data:** Would you like to add "vs last week" trends to key metrics? This requires backend changes.

4. **Supplier dashboard:** Should I consolidate "Under procurement review" + "Pending TSQA" into a single "In Review" card?
