# Surgical Implementation Plan - Unified Filter System

**Mode:** SURGICAL - No breaking changes, test after each phase  
**Date:** May 20, 2026  
**Total Phases:** 5 phases

---

## Phase 1: Create Unified FilterBar Component ✋ START HERE

**Goal:** Build the core FilterBar component with all filter types  
**Duration:** 1-1.5 hours  
**Risk:** LOW (new component, doesn't touch existing code)

### Step 1.1: Create FilterBar Component File
**File:** `components/shared/FilterBar.tsx`

**What it does:**
- Creates the main FilterBar component
- Supports: tabs, search, select, date, dateRange filters
- Includes Apply/Clear buttons
- Shows result count
- Responsive layout

**Testing:**
- Component compiles without errors
- TypeScript types are correct
- No impact on existing pages (new file only)

---

### Step 1.2: Create FilterBar Types File
**File:** `components/shared/FilterBar.types.ts`

**What it does:**
- Defines TypeScript interfaces
- Exports types for consumers

**Testing:**
- Types compile correctly
- No circular dependencies

---

### Step 1.3: Export from Shared Index (Optional)
**File:** `components/shared/index.ts` (if exists)

**What it does:**
- Exports FilterBar for easier imports

**Testing:**
- Import works: `import { FilterBar } from '@/components/shared'`

---

### Step 1.4: Create Test Page (Verification)
**File:** `app/test-filter/page.tsx` (temporary)

**What it does:**
- Creates a test page to verify FilterBar works
- Tests all filter types
- Tests tabs
- Tests responsive layout

**Testing:**
- Navigate to `/test-filter`
- Verify all filter types render
- Verify Apply/Clear buttons work
- Verify responsive layout
- Delete test page after verification

---

### Phase 1 Checklist
- [ ] Create `FilterBar.tsx` component
- [ ] Create `FilterBar.types.ts` types
- [ ] Export from shared index (optional)
- [ ] Create test page
- [ ] Test all filter types
- [ ] Test responsive layout
- [ ] Run TypeScript diagnostics: `npm run type-check` or `tsc --noEmit`
- [ ] Delete test page
- [ ] Commit: "feat: add unified FilterBar component"

**Exit Criteria:** FilterBar component works perfectly in isolation, no existing pages affected

---

## Phase 2: Migrate Simple Pages (Low Risk)

**Goal:** Migrate 7 simple pages with search + status filters  
**Duration:** 2-3 hours  
**Risk:** LOW (simple patterns, easy to revert)

### Pages to Migrate (in order)
1. `/pr2` - Purchase Requests
2. `/pr1` - My Requests  
3. `/po` - Purchase Orders
4. `/substitutes` - Substitute Review
5. `/supplier/po` - Supplier POs
6. `/supplier/delivery` - Supplier Deliveries
7. `/rfq` - Canvassing Queue (search only)

### Step 2.1: Migrate `/pr2` (Proof of Concept)
**File:** `app/pr2/page.tsx`

**Changes:**
- Import FilterBar
- Replace filter section with FilterBar
- Keep all state logic unchanged
- Keep all API calls unchanged

**Testing:**
- Navigate to `/pr2`
- Test search functionality
- Test status filter
- Test Apply button
- Test Clear button
- Test pagination still works
- Verify no console errors
- Verify data loads correctly

**Rollback Plan:** Git revert if issues found

---

### Step 2.2: Migrate `/pr1`
**File:** `app/pr1/page.tsx`

**Changes:** Same pattern as `/pr2`

**Testing:** Same tests as `/pr2`

---

### Step 2.3: Migrate `/po`
**File:** `app/po/page.tsx`

**Changes:** Same pattern as `/pr2`

**Testing:** Same tests as `/pr2`

---

### Step 2.4: Migrate `/substitutes`
**File:** `app/substitutes/page.tsx`

**Changes:** Same pattern as `/pr2`

**Testing:** Same tests as `/pr2`

---

### Step 2.5: Migrate `/supplier/po`
**File:** `app/supplier/po/page.tsx`

**Changes:** Same pattern as `/pr2`

**Testing:** Same tests as `/pr2`

---

### Step 2.6: Migrate `/supplier/delivery`
**File:** `app/supplier/delivery/page.tsx`

**Changes:** Same pattern as `/pr2`

**Testing:** Same tests as `/pr2`

---

### Step 2.7: Migrate `/rfq` (Search Only)
**File:** `app/rfq/page.tsx`

**Changes:** Same pattern, but only search filter (no status)

**Testing:** Same tests as `/pr2`

---

### Phase 2 Checklist
- [ ] Migrate `/pr2` and test thoroughly
- [ ] Migrate `/pr1` and test
- [ ] Migrate `/po` and test
- [ ] Migrate `/substitutes` and test
- [ ] Migrate `/supplier/po` and test
- [ ] Migrate `/supplier/delivery` and test
- [ ] Migrate `/rfq` and test
- [ ] Run full app test (navigate to all migrated pages)
- [ ] Run TypeScript diagnostics
- [ ] Commit: "feat: migrate simple pages to FilterBar"

**Exit Criteria:** All 7 simple pages use FilterBar, all functionality works, no regressions

---

## Phase 3: Migrate Pages with Tabs (Medium Risk)

**Goal:** Migrate pages with tab filters  
**Duration:** 1.5-2 hours  
**Risk:** MEDIUM (tabs are new feature in FilterBar)

### Pages to Migrate
1. `/grn` - Goods Receipt (tabs: All/Open/Closed)
2. `/delivery` - Delivery Tracking (tabs: All/Pending/Scheduled/etc.)
3. `/approvals/history` ⭐ - Approval History (tabs: All/PR1/PR2/PO)

### Step 3.1: Migrate `/grn`
**File:** `app/grn/page.tsx`

**Changes:**
- Replace custom tab buttons with FilterBar tabs
- Replace search section with FilterBar
- Keep all state logic unchanged

**Testing:**
- Test all tabs (All, Open, Closed)
- Test search functionality
- Test tab + search combination
- Test pagination
- Verify counts update correctly

---

### Step 3.2: Migrate `/delivery`
**File:** `app/delivery/page.tsx`

**Changes:** Same pattern as `/grn`

**Testing:** Same tests as `/grn`, test all status tabs

---

### Step 3.3: Migrate `/approvals/history` ⭐ (Your Screenshot)
**File:** `app/approvals/history/page.tsx`

**Changes:**
- Replace custom tab buttons (All/PR1/PR2/PO) with FilterBar tabs
- Replace search + filter section with FilterBar
- Keep all state logic unchanged

**Testing:**
- Test all tabs (All, PR1, PR2, PO)
- Test search functionality
- Test action filter
- Test date range (from/to)
- Test Clear button
- Test result count display
- Verify matches your screenshot design

---

### Phase 3 Checklist
- [ ] Migrate `/grn` and test
- [ ] Migrate `/delivery` and test
- [ ] Migrate `/approvals/history` and test thoroughly ⭐
- [ ] Compare `/approvals/history` with screenshot
- [ ] Run full app test
- [ ] Run TypeScript diagnostics
- [ ] Commit: "feat: migrate pages with tabs to FilterBar"

**Exit Criteria:** All tab-based pages use FilterBar, tabs work perfectly, design matches screenshot

---

## Phase 4: Migrate Complex Pages (Higher Risk)

**Goal:** Migrate pages with complex multi-filter setups  
**Duration:** 1.5-2 hours  
**Risk:** MEDIUM-HIGH (complex filter logic)

### Pages to Migrate
1. `/warehouse` - Warehouse Queue (search + priority)
2. `/warehouse/history` - Warehouse History (search + 2 selects + date range)
3. `/admin/users` - User Management (search + role + department)

### Step 4.1: Migrate `/warehouse`
**File:** `app/warehouse/page.tsx`

**Changes:**
- Replace filter section with FilterBar
- Keep all state logic unchanged

**Testing:**
- Test search
- Test priority filter
- Test combination of filters
- Test pagination
- Test stat cards still work

---

### Step 4.2: Migrate `/warehouse/history` (Most Complex)
**File:** `app/warehouse/history/page.tsx`

**Changes:**
- Replace complex filter section with FilterBar
- Map all filters: search, decision, PR1 status, date from, date to
- Keep all state logic unchanged

**Testing:**
- Test search
- Test decision filter
- Test PR1 status filter
- Test date range (from/to)
- Test all filter combinations
- Test Clear button resets everything
- Test result count display
- Test pagination

---

### Step 4.3: Migrate `/admin/users`
**File:** `app/admin/users/page.tsx`

**Changes:**
- Replace custom filter panel with FilterBar
- Map filters: search, role, department
- Keep all state logic unchanged

**Testing:**
- Test search
- Test role filter
- Test department filter
- Test Apply button
- Test Clear button
- Test pagination

---

### Phase 4 Checklist
- [ ] Migrate `/warehouse` and test
- [ ] Migrate `/warehouse/history` and test thoroughly
- [ ] Migrate `/admin/users` and test
- [ ] Run full app test
- [ ] Run TypeScript diagnostics
- [ ] Commit: "feat: migrate complex pages to FilterBar"

**Exit Criteria:** All complex pages use FilterBar, all filter combinations work, no regressions

---

## Phase 5: Add Filters to Pages Without Them (Enhancement)

**Goal:** Add search/filter capability to pages that don't have it  
**Duration:** 2-3 hours  
**Risk:** LOW (adding new features, not changing existing logic)

### Pages to Enhance
1. `/supplier/products` ❌ NO FILTERS
2. `/supplier/quotations` ❌ NO FILTERS
3. `/tsqa/rse` ⚠️ Add search
4. `/accreditation` ⚠️ Add search
5. `/accreditation/products` ⚠️ Add search
6. `/bugtrack` ⚠️ Add search

### Step 5.1: Add Filters to `/supplier/products`
**File:** `app/supplier/products/page.tsx`

**Changes:**
- Add FilterBar with search + status filter
- Add state: `search`, `appliedSearch`, `selectedStatus`
- Update data fetching to use filters
- May need to update API function to accept filters

**Testing:**
- Test search by product name
- Test search by product code
- Test status filter
- Test combination
- Verify existing functionality still works

---

### Step 5.2: Add Filters to `/supplier/quotations`
**File:** `app/supplier/quotations/page.tsx`

**Changes:**
- Add FilterBar with search + status filter
- Add state for filters
- Update data fetching

**Testing:** Same as Step 5.1

---

### Step 5.3: Add Search to `/tsqa/rse`
**File:** `app/tsqa/rse/page.tsx`

**Changes:**
- Add FilterBar with search + existing status filter
- Add search state
- Update data fetching

**Testing:**
- Test search by RSE number
- Test search by product name
- Test search by supplier
- Test with existing status filter

---

### Step 5.4: Add Search to `/accreditation`
**File:** `app/accreditation/page.tsx`

**Changes:**
- Add FilterBar with search + existing status tabs
- Add search state
- Update data fetching

**Testing:**
- Test search by supplier name
- Test with existing status tabs

---

### Step 5.5: Add Search to `/accreditation/products`
**File:** `app/accreditation/products/page.tsx`

**Changes:**
- Add FilterBar with search + existing status tabs
- Add search state
- Update data fetching

**Testing:**
- Test search by product name
- Test search by supplier name
- Test with existing status tabs

---

### Step 5.6: Add Search to `/bugtrack`
**File:** `app/bugtrack/page.tsx`

**Changes:**
- Add FilterBar with search + existing status tabs
- Add search state
- Update data fetching

**Testing:**
- Test search by bug title
- Test search by description
- Test with existing status tabs

---

### Phase 5 Checklist
- [ ] Add filters to `/supplier/products` and test
- [ ] Add filters to `/supplier/quotations` and test
- [ ] Add search to `/tsqa/rse` and test
- [ ] Add search to `/accreditation` and test
- [ ] Add search to `/accreditation/products` and test
- [ ] Add search to `/bugtrack` and test
- [ ] Run full app test
- [ ] Run TypeScript diagnostics
- [ ] Commit: "feat: add search/filter to pages without them"

**Exit Criteria:** All pages have search/filter capability, all new features work, no regressions

---

## Testing Strategy (After Each Phase)

### Manual Testing Checklist
- [ ] Navigate to the page
- [ ] Test search input
- [ ] Test each filter type
- [ ] Test Apply button (if present)
- [ ] Test Clear button
- [ ] Test filter combinations
- [ ] Test pagination
- [ ] Test responsive layout (mobile/tablet/desktop)
- [ ] Check browser console for errors
- [ ] Verify data loads correctly
- [ ] Verify existing features still work

### Automated Testing
```bash
# TypeScript check
npm run type-check
# or
tsc --noEmit

# Lint check
npm run lint

# Build check
npm run build
```

---

## Rollback Strategy

### If Issues Found in Any Phase:
1. **Stop immediately** - Don't proceed to next phase
2. **Identify the issue** - Check console, check network, check state
3. **Fix or revert** - Either fix the issue or git revert
4. **Re-test** - Verify fix works
5. **Continue** - Only proceed when phase is stable

### Git Workflow
```bash
# After each phase
git add .
git commit -m "feat: [phase description]"

# If need to rollback
git revert HEAD
# or
git reset --hard HEAD~1  # if not pushed
```

---

## Success Criteria

### Phase 1 Success
- ✅ FilterBar component exists
- ✅ All filter types work
- ✅ TypeScript compiles
- ✅ No impact on existing pages

### Phase 2 Success
- ✅ 7 simple pages migrated
- ✅ All search/filter functionality works
- ✅ No regressions
- ✅ ~350 lines of code removed

### Phase 3 Success
- ✅ 3 pages with tabs migrated
- ✅ Tab filters work perfectly
- ✅ Approval history matches screenshot
- ✅ ~200 lines of code removed

### Phase 4 Success
- ✅ 3 complex pages migrated
- ✅ All filter combinations work
- ✅ Date ranges work
- ✅ ~200 lines of code removed

### Phase 5 Success
- ✅ 6 pages enhanced with filters
- ✅ All new search functionality works
- ✅ User experience improved
- ✅ No regressions

### Overall Success
- ✅ **~750 lines of code removed**
- ✅ **20 pages use unified FilterBar**
- ✅ **6 pages have new search capability**
- ✅ **100% design system compliance**
- ✅ **Zero regressions**
- ✅ **All tests pass**

---

## Timeline

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Phase 1: Create Component | 1-1.5h | 1-1.5h |
| Phase 2: Simple Pages | 2-3h | 3-4.5h |
| Phase 3: Pages with Tabs | 1.5-2h | 4.5-6.5h |
| Phase 4: Complex Pages | 1.5-2h | 6-8.5h |
| Phase 5: Add Filters | 2-3h | 8-11.5h |
| **Total** | **8-11.5h** | **1-2 days** |

---

## Risk Mitigation

### Low Risk (Phases 1, 2, 5)
- New code or simple replacements
- Easy to test and verify
- Easy to rollback

### Medium Risk (Phase 3)
- Tab filters are new feature
- More complex state management
- Test thoroughly before proceeding

### Higher Risk (Phase 4)
- Complex filter logic
- Multiple filter combinations
- Date range handling
- Test all combinations

---

## Communication Plan

### After Each Phase
- ✅ Commit code with clear message
- ✅ Test thoroughly
- ✅ Document any issues found
- ✅ Get approval before next phase (if needed)

### If Issues Found
- 🚨 Stop immediately
- 🚨 Document the issue
- 🚨 Propose fix or rollback
- 🚨 Get approval before proceeding

---

## Ready to Start?

**Phase 1 is ready to begin!**

Say "start phase 1" and I'll create the FilterBar component with full design system compliance.

---

**Plan Created By:** Kiro AI  
**Date:** May 20, 2026  
**Status:** ✅ Ready for Surgical Implementation
