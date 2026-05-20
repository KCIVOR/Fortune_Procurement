# Complete Filter & Search Audit - ALL Pages

**Date:** May 20, 2026  
**Status:** ✅ COMPLETE AUDIT  
**Total Pages Analyzed:** 20+ list pages

---

## Executive Summary

I've audited **EVERY list page** in your application. Here's what I found:

### Pages WITH Filters (Need Unified Component)
**13 pages** have search/filter implementations that should use the unified component

### Pages WITHOUT Filters (Need Filters Added)
**7 pages** have NO filters but would benefit from them

### Total Impact
- **Before:** ~850 lines of duplicated filter code
- **After:** ~250 lines (unified component + usage)
- **Savings:** ~600 lines (70% reduction)
- **New filters added:** 7 pages improved with search/filter capability

---

## Category 1: Pages WITH Existing Filters (13 pages)

### ✅ Simple Search + Status Filter (7 pages)

| # | Page | Current Filter | Lines | Status |
|---|------|----------------|-------|--------|
| 1 | `/pr2` | Search + Status select | ~50 | Has Apply/Clear |
| 2 | `/pr1` | Search + Status select | ~50 | Has Apply/Clear |
| 3 | `/po` | Search + Status select | ~60 | Has Apply/Clear |
| 4 | `/grn` | Search + Status tabs | ~55 | Has Apply/Clear |
| 5 | `/substitutes` | Search + Status select | ~55 | Has Apply/Clear |
| 6 | `/supplier/po` | Search + Status select | ~50 | Has Apply/Clear |
| 7 | `/supplier/delivery` | Search + Status select | ~50 | Has Apply/Clear |

**Pattern:** Search input + Status dropdown/tabs + Apply + Clear buttons

---

### ✅ Complex Filters (3 pages)

| # | Page | Current Filter | Lines | Complexity |
|---|------|----------------|-------|------------|
| 8 | `/warehouse/history` | Search + Decision + PR1 Status + Date Range | ~120 | HIGH |
| 9 | `/approvals/history` | **Tabs (All/PR1/PR2/PO)** + Search + Action + Date Range | ~150 | **HIGHEST** |
| 10 | `/warehouse` | Search + Priority select | ~60 | MEDIUM |

**Pattern:** Multiple filters + date ranges + optional tab filters

---

### ✅ Search Only (3 pages)

| # | Page | Current Filter | Lines | Notes |
|---|------|----------------|-------|-------|
| 11 | `/rfq` | Search only | ~40 | Has Apply/Clear |
| 12 | `/delivery` | Search + Status tabs | ~55 | Has Apply/Clear |
| 13 | `/admin/users` | Search + Role + Department | ~80 | Custom filter panel |

**Pattern:** Search input with Apply/Clear, some have additional dropdowns

---

## Category 2: Pages WITHOUT Filters (7 pages)

### ❌ Pages That NEED Filters Added

| # | Page | Current State | Recommended Filters | Priority |
|---|------|---------------|---------------------|----------|
| 1 | `/supplier/products` | **NO FILTERS** | Search (product name/code) + Status (draft/submitted/verified/rejected) | **HIGH** |
| 2 | `/supplier/quotations` | **NO FILTERS** | Search (RFQ number/purpose) + Status (invited/submitted/declined) | **HIGH** |
| 3 | `/tsqa/rse` | Status dropdown only | Add Search (RSE number/product/supplier) | **MEDIUM** |
| 4 | `/accreditation` | Status tabs only | Add Search (supplier name) | **MEDIUM** |
| 5 | `/accreditation/products` | Status tabs only | Add Search (product name/supplier) | **MEDIUM** |
| 6 | `/bugtrack` | Status tabs + Pagination | Add Search (bug title/description) | **MEDIUM** |
| 7 | `/messages` | **NO FILTERS** | Add Search (conversation/user name) | **LOW** |

---

## Detailed Findings by Page

### 1. `/pr2` - Purchase Requests
**Current:** Search + Status select + Apply/Clear  
**Lines:** ~50  
**Pattern:** Standard search + status filter  
**Action:** ✅ Migrate to unified FilterBar

---

### 2. `/pr1` - My Requests
**Current:** Search + Status select + Apply/Clear  
**Lines:** ~50  
**Pattern:** Standard search + status filter  
**Action:** ✅ Migrate to unified FilterBar

---

### 3. `/po` - Purchase Orders
**Current:** Search + Status select + Clear  
**Lines:** ~60  
**Pattern:** Search + status + stat cards  
**Action:** ✅ Migrate to unified FilterBar

---

### 4. `/grn` - Goods Receipt Notes
**Current:** Search + Status tabs + Apply/Clear  
**Lines:** ~55  
**Pattern:** Search + custom tab buttons (All/Open/Closed)  
**Action:** ✅ Migrate to unified FilterBar with tabs

---

### 5. `/substitutes` - Substitute Review
**Current:** Search + Status select + Apply/Clear  
**Lines:** ~55  
**Pattern:** Standard search + status filter  
**Action:** ✅ Migrate to unified FilterBar

---

### 6. `/supplier/po` - Supplier Purchase Orders
**Current:** Search + Status select + Apply/Clear  
**Lines:** ~50  
**Pattern:** Standard search + status filter  
**Action:** ✅ Migrate to unified FilterBar

---

### 7. `/supplier/delivery` - Supplier Deliveries
**Current:** Search + Status select + Apply/Clear  
**Lines:** ~50  
**Pattern:** Standard search + status filter  
**Action:** ✅ Migrate to unified FilterBar

---

### 8. `/warehouse/history` - Warehouse History
**Current:** Search + Decision + PR1 Status + Date Range + Clear  
**Lines:** ~120  
**Pattern:** Complex multi-filter with date range  
**Action:** ✅ Migrate to unified FilterBar (complex example)

---

### 9. `/approvals/history` - Approval History ⭐ MOST COMPLEX
**Current:** **Tab filters (All/PR1/PR2/PO)** + Search + Action + Date Range + Clear  
**Lines:** ~150  
**Pattern:** Custom tab buttons + complex filters + date range  
**Action:** ✅ Migrate to unified FilterBar with tabs (your screenshot example!)

---

### 10. `/warehouse` - Warehouse Queue
**Current:** Search + Priority select + Apply/Clear  
**Lines:** ~60  
**Pattern:** Search + priority filter  
**Action:** ✅ Migrate to unified FilterBar

---

### 11. `/rfq` - Canvassing Queue
**Current:** Search only + Apply/Clear  
**Lines:** ~40  
**Pattern:** Simple search with icon  
**Action:** ✅ Migrate to unified FilterBar (search only)

---

### 12. `/delivery` - Delivery Tracking
**Current:** Search + Status tabs + Apply/Clear  
**Lines:** ~55  
**Pattern:** Search + custom tab buttons  
**Action:** ✅ Migrate to unified FilterBar with tabs

---

### 13. `/admin/users` - User Management
**Current:** Search + Role + Department + Apply/Clear  
**Lines:** ~80  
**Pattern:** Custom filter panel with multiple selects  
**Action:** ✅ Migrate to unified FilterBar

---

### 14. `/supplier/products` - Product Catalog ❌ NO FILTERS
**Current:** **NO FILTERS AT ALL**  
**Lines:** 0  
**Pattern:** Just a list with no way to filter  
**Recommendation:** **ADD FilterBar with:**
- Search (product name, product code, category)
- Status filter (Draft, Submitted, Under Review, Verified, Rejected, Inactive)
**Priority:** **HIGH** - Users need to find products quickly

---

### 15. `/supplier/quotations` - RFQ Inbox ❌ NO FILTERS
**Current:** **NO FILTERS AT ALL**  
**Lines:** 0  
**Pattern:** Just sections (Pending, Submitted, Other)  
**Recommendation:** **ADD FilterBar with:**
- Search (RFQ number, purpose, department)
- Status filter (Awaiting Response, Submitted, Declined, All)
**Priority:** **HIGH** - Suppliers need to find RFQs quickly

---

### 16. `/tsqa/rse` - RSE Queue ⚠️ PARTIAL FILTERS
**Current:** Status dropdown only (no search)  
**Lines:** ~20  
**Pattern:** Single status filter  
**Recommendation:** **ADD Search to FilterBar:**
- Search (RSE number, product name, supplier name)
- Keep existing status filter
**Priority:** **MEDIUM** - Would improve usability

---

### 17. `/accreditation` - Accreditation Queue ⚠️ PARTIAL FILTERS
**Current:** Status tabs only (no search)  
**Lines:** 0 (uses StatusFilterTabs component)  
**Pattern:** Tab filters only  
**Recommendation:** **ADD Search to FilterBar:**
- Search (supplier name)
- Keep existing status tabs
**Priority:** **MEDIUM** - Would help find specific suppliers

---

### 18. `/accreditation/products` - Product Review ⚠️ PARTIAL FILTERS
**Current:** Status tabs only (no search)  
**Lines:** 0 (uses StatusFilterTabs component)  
**Pattern:** Tab filters only  
**Recommendation:** **ADD Search to FilterBar:**
- Search (product name, supplier name)
- Keep existing status tabs
**Priority:** **MEDIUM** - Would help find specific products

---

### 19. `/bugtrack` - Bug Tracking ⚠️ PARTIAL FILTERS
**Current:** Status tabs + Pagination (no search)  
**Lines:** 0 (uses StatusFilterTabs component)  
**Pattern:** Tab filters only  
**Recommendation:** **ADD Search to FilterBar:**
- Search (bug title, description, reporter)
- Keep existing status tabs
**Priority:** **MEDIUM** - Would help find specific bugs

---

### 20. `/messages` - Messages ❌ NO FILTERS
**Current:** **NO FILTERS AT ALL**  
**Lines:** 0  
**Pattern:** Conversation list with no search  
**Recommendation:** **ADD Search:**
- Search (conversation participant name, message content)
**Priority:** **LOW** - Nice to have, not critical

---

## Unified FilterBar Component Design

### Component Features

```typescript
interface FilterBarProps {
  // Optional tab filters (like approval history: All, PR1, PR2, PO)
  tabs?: { value: string; label: string }[];
  activeTab?: string;
  onTabChange?: (value: string) => void;
  
  // Filter inputs
  filters: FilterConfig[];
  
  // Actions
  onApply?: () => void; // Optional Apply button
  onClear: () => void;
  
  // Display
  loading?: boolean;
  resultCount?: number;
  resultLabel?: string;
  className?: string;
}

interface FilterConfig {
  type: 'search' | 'select' | 'date' | 'dateRange' | 'custom';
  id: string;
  label: string;
  placeholder?: string;
  value: string | [string, string];
  onChange: (value: string | [string, string]) => void;
  options?: { value: string; label: string }[]; // for select
  disabled?: boolean;
  className?: string;
  renderCustom?: () => React.ReactNode;
}
```

### Supported Filter Types

1. **Search** - Text input with optional icon
2. **Select** - Dropdown with options
3. **Date** - Single date picker
4. **Date Range** - Two date pickers (from/to)
5. **Custom** - Render custom filter component
6. **Tabs** - Optional tab buttons (All, PR1, PR2, PO)

---

## Implementation Plan

### Phase 1: Create Unified Component (1 hour)
- [ ] Create `components/shared/FilterBar.tsx`
- [ ] Implement tab filters (optional)
- [ ] Implement all filter types
- [ ] Add Apply/Clear buttons
- [ ] Add result count display
- [ ] Add responsive layout
- [ ] Test with simple example

### Phase 2: Migrate Existing Pages (3 hours)
- [ ] `/pr2` - Simple
- [ ] `/pr1` - Simple
- [ ] `/po` - Simple
- [ ] `/grn` - Simple with tabs
- [ ] `/substitutes` - Simple
- [ ] `/supplier/po` - Simple
- [ ] `/supplier/delivery` - Simple
- [ ] `/rfq` - Search only
- [ ] `/delivery` - Simple with tabs
- [ ] `/warehouse` - Simple
- [ ] `/warehouse/history` - Complex
- [ ] `/approvals/history` - Complex with tabs ⭐
- [ ] `/admin/users` - Complex

### Phase 3: Add Filters to Pages Without Them (2 hours)
- [ ] `/supplier/products` - Add search + status
- [ ] `/supplier/quotations` - Add search + status
- [ ] `/tsqa/rse` - Add search
- [ ] `/accreditation` - Add search
- [ ] `/accreditation/products` - Add search
- [ ] `/bugtrack` - Add search
- [ ] `/messages` - Add search (optional)

### Phase 4: Testing & Polish (1 hour)
- [ ] Test all filter types
- [ ] Test responsive layout
- [ ] Test keyboard navigation
- [ ] Run TypeScript diagnostics
- [ ] Verify design system compliance

**Total Time:** 7-8 hours

---

## Benefits

### Code Quality
- ✅ **70% code reduction** (~600 lines eliminated)
- ✅ **Single source of truth** for all filters
- ✅ **Type-safe** configurations
- ✅ **Consistent behavior** across all pages

### User Experience
- ✅ **Consistent UI** - Same filter design everywhere
- ✅ **Better search** - 7 pages get search capability
- ✅ **Faster navigation** - Users can find items quickly
- ✅ **Mobile responsive** - Works on all devices

### Design System
- ✅ **100% compliant** with `procurement-design-system (2).html`
- ✅ **Uses `pq-*` tokens** throughout
- ✅ **Matches your screenshot** - Tab filters + search section

---

## Priority Recommendations

### 🔴 HIGH PRIORITY (Do First)
1. Create unified `FilterBar` component
2. Migrate `/approvals/history` (your screenshot example)
3. Add filters to `/supplier/products` (no filters currently)
4. Add filters to `/supplier/quotations` (no filters currently)

### 🟡 MEDIUM PRIORITY (Do Next)
5. Migrate all simple pages (PR2, PR1, PO, GRN, etc.)
6. Add search to `/tsqa/rse`, `/accreditation`, `/bugtrack`

### 🟢 LOW PRIORITY (Nice to Have)
7. Add search to `/messages`

---

## Next Steps

**Ready to implement?** I can:

1. ✅ Create the unified `FilterBar` component
2. ✅ Migrate `/approvals/history` first (your screenshot example)
3. ✅ Add filters to pages that don't have them
4. ✅ Migrate all remaining pages
5. ✅ Test everything

**Just say "yes" and I'll start building!**

---

**Audit Completed By:** Kiro AI  
**Date:** May 20, 2026  
**Pages Analyzed:** 20+  
**Status:** ✅ Ready for Implementation
