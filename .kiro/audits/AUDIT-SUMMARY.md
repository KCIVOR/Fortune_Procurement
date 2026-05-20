# Unified Filter Component - Complete Audit Summary

**Date:** May 20, 2026  
**Status:** ✅ COMPLETE - Ready for Implementation  
**Complexity:** ⭐⭐☆☆☆ (LOW)

---

## What You Asked For

You want to eliminate the duplicated filter code across your app, specifically:
1. **Search + filter sections** (search input, status/action dropdowns, date ranges, clear button)
2. **Tab filters** (All, PR1, PR2, PO buttons) like in the approval history page screenshot

---

## What I Found

### 9 Pages with Duplicated Filter Code

| # | Page | Tab Filters | Search | Dropdowns | Date Range | Lines |
|---|------|-------------|--------|-----------|------------|-------|
| 1 | `/pr2` | ❌ | ✅ | Status | ❌ | ~50 |
| 2 | `/pr1` | ❌ | ✅ | Status | ❌ | ~50 |
| 3 | `/po` | ❌ | ✅ | Status | ❌ | ~50 |
| 4 | `/grn` | ❌ | ✅ | Status | ❌ | ~50 |
| 5 | `/supplier/po` | ❌ | ✅ | Status | ❌ | ~50 |
| 6 | `/supplier/delivery` | ❌ | ✅ | Status | ❌ | ~50 |
| 7 | `/substitutes` | ❌ | ✅ | Status | ❌ | ~50 |
| 8 | `/warehouse/history` | ❌ | ✅ | Decision + PR1 Status | ✅ | ~120 |
| 9 | **`/approvals/history`** | **✅ All/PR1/PR2/PO** | **✅** | **Action** | **✅** | **~150** |

**Total:** ~620 lines of duplicated code  
**After:** ~200 lines (component + usage)  
**Savings:** ~420 lines (68% reduction)

---

## The Solution

### Create `FilterBar` Component

**Location:** `components/shared/FilterBar.tsx`

**Features:**
- ✅ Optional tab filters (All, PR1, PR2, PO) - like in your screenshot
- ✅ Search input with optional Apply button
- ✅ Select dropdowns (status, action, etc.)
- ✅ Date inputs (single or range)
- ✅ Clear filters button
- ✅ Optional result count display ("X results found")
- ✅ Responsive grid layout (stacks on mobile)
- ✅ Design system compliant (uses `pq-*` tokens)

### Component API

```typescript
<FilterBar
  // Optional tabs (like in approval history)
  tabs={[
    { value: 'all', label: 'All' },
    { value: 'PR1', label: 'PR1' },
    { value: 'PR2', label: 'PR2' },
    { value: 'PO', label: 'PO' },
  ]}
  activeTab={documentType}
  onTabChange={setDocumentType}
  
  // Filter inputs
  filters={[
    {
      type: 'search',
      id: 'search',
      label: 'Search',
      placeholder: 'Search...',
      value: search,
      onChange: setSearch,
    },
    {
      type: 'select',
      id: 'status',
      label: 'Status',
      value: status,
      onChange: setStatus,
      options: STATUS_OPTIONS,
    },
    {
      type: 'date',
      id: 'from',
      label: 'From',
      value: dateFrom,
      onChange: setDateFrom,
    },
  ]}
  
  // Actions
  onApply={() => setAppliedSearch(search)} // Optional
  onClear={clearFilters}
  
  // Display
  loading={loading}
  resultCount={totalCount}
  resultLabel="results"
/>
```

---

## Design System Compliance

All patterns match `procurement-design-system (2).html`:

### Tab Filters (from approval history screenshot)
```css
Active: bg-pq-neutral-900 text-white border-pq-primary-600
Inactive: bg-white text-pq-neutral-500 border-pq-neutral-200
Hover: hover:border-pq-primary-600 hover:bg-pq-neutral-50
```

### Filter Container
```css
Container: bg-white border-pq-neutral-200 rounded-md p-4
Grid: grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3
```

### Labels
```css
text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1
```

### Inputs
```css
border-pq-neutral-200
focus:border-pq-primary-600
focus:ring-2 focus:ring-[#1E4BFF]/30
```

---

## Implementation Plan

### Phase 1: Create Component (30 min)
- Create `components/shared/FilterBar.tsx`
- Implement tab filters (optional)
- Implement filter type renderers (search, select, date)
- Add Clear button
- Add optional Apply button
- Add optional result count display
- Add responsive grid layout

### Phase 2: Check Button Component (15 min)
- Verify `components/ui/button.tsx` exists
- If not, create it following design system

### Phase 3: Migrate 9 Pages (2 hours)
1. `/pr2` - simple (search + status)
2. `/pr1` - simple (search + status)
3. `/po` - simple (search + status)
4. `/grn` - simple (search + status)
5. `/supplier/po` - simple (search + status)
6. `/supplier/delivery` - simple (search + status)
7. `/substitutes` - simple (search + status)
8. `/warehouse/history` - complex (search + 2 selects + date range)
9. `/approvals/history` - complex with tabs (tabs + search + select + date range)

### Phase 4: Testing (30 min)
- Test all filter types
- Test tab filters
- Test responsive layout
- Test keyboard navigation
- Run TypeScript diagnostics

**Total Time:** 3-3.5 hours

---

## Before & After Examples

### Simple Filter (PR2, PR1, etc.)

**Before (50 lines):**
```tsx
<div className="bg-white rounded-md border border-pq-neutral-200 p-4 mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
  <div className="space-y-1.5 md:col-span-2">
    <Label>Search</Label>
    <div className="flex gap-2">
      <input ... />
      <button>Apply</button>
      <button>Clear</button>
    </div>
  </div>
  <div className="space-y-1.5">
    <Label>Status</Label>
    <Select>...</Select>
  </div>
</div>
```

**After (15 lines):**
```tsx
<FilterBar
  filters={[
    { type: 'search', id: 'search', label: 'Search', value: search, onChange: setSearch },
    { type: 'select', id: 'status', label: 'Status', value: status, onChange: setStatus, options: STATUS_OPTIONS },
  ]}
  onApply={() => setAppliedSearch(search)}
  onClear={clearFilters}
  loading={loading}
/>
```

### Complex Filter with Tabs (Approval History)

**Before (150 lines):**
```tsx
{/* Tab buttons */}
<div className="flex gap-2 flex-wrap mb-4">
  {TABS.map((t) => (
    <button key={t.value} onClick={() => setTab(t.value)} className={...}>
      {t.label}
    </button>
  ))}
</div>

{/* Filter section */}
<div className="bg-white rounded-md border border-pq-neutral-200 p-4 mb-5 space-y-3">
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
    {/* Search */}
    {/* Action select */}
    {/* Clear button */}
  </div>
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
    {/* Date from */}
    {/* Date to */}
  </div>
  {/* Result count */}
</div>
```

**After (30 lines):**
```tsx
<FilterBar
  tabs={[
    { value: 'all', label: 'All' },
    { value: 'PR1', label: 'PR1' },
    { value: 'PR2', label: 'PR2' },
    { value: 'PO', label: 'PO' },
  ]}
  activeTab={documentType}
  onTabChange={setDocumentType}
  filters={[
    { type: 'search', id: 'search', label: 'Search', value: search, onChange: setSearch },
    { type: 'select', id: 'action', label: 'Your action', value: action, onChange: setAction, options: ACTION_OPTIONS },
    { type: 'date', id: 'from', label: 'Signed from', value: dateFrom, onChange: setDateFrom },
    { type: 'date', id: 'to', label: 'Signed to', value: dateTo, onChange: setDateTo },
  ]}
  onClear={clearFilters}
  loading={loading}
  resultCount={totalCount}
  resultLabel="actions"
/>
```

---

## Benefits

### Code Quality
- ✅ **68% code reduction** (~420 lines eliminated)
- ✅ **Single source of truth** for filter UI
- ✅ **Type-safe** filter configurations
- ✅ **Easy to maintain** - changes in one place

### Design Consistency
- ✅ **Unified look** across all pages
- ✅ **Design system compliant** - uses `pq-*` tokens
- ✅ **Matches screenshot** - tab filters + search/filter section

### Developer Experience
- ✅ **Declarative API** - just pass filter configs
- ✅ **Flexible** - supports simple and complex scenarios
- ✅ **Extensible** - custom filter types supported

---

## Recommendation

✅ **PROCEED WITH IMPLEMENTATION**

This is:
- **Feasible** - All patterns are consistent
- **Low Risk** - Incremental migration, test each page
- **High Value** - 68% code reduction + design consistency
- **Design System Compliant** - Matches your reference HTML

---

## Next Steps

1. **Review this audit** - Make sure it covers everything you need
2. **Approve implementation** - Give me the go-ahead
3. **I'll create the component** - `FilterBar.tsx` with all features
4. **I'll migrate pages** - One by one, starting with simple ones
5. **Test and verify** - Ensure everything works correctly

---

**Full Details:** See `unified-filter-component-design.md` for complete technical specification.

**Ready to proceed?** Just say "yes" and I'll start implementing!
