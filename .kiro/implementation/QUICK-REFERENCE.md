# Quick Reference - Unified Filter Implementation

## 🎯 5 Phases Overview

| Phase | What | Pages | Risk | Time |
|-------|------|-------|------|------|
| **1** | Create FilterBar Component | 0 (new component) | 🟢 LOW | 1-1.5h |
| **2** | Migrate Simple Pages | 7 pages | 🟢 LOW | 2-3h |
| **3** | Migrate Pages with Tabs | 3 pages | 🟡 MEDIUM | 1.5-2h |
| **4** | Migrate Complex Pages | 3 pages | 🟠 MEDIUM-HIGH | 1.5-2h |
| **5** | Add Filters to Pages | 6 pages | 🟢 LOW | 2-3h |

**Total:** 8-11.5 hours (1-2 days)

---

## 📋 Phase 1: Create Component

### Files to Create
1. `components/shared/FilterBar.tsx` - Main component
2. `components/shared/FilterBar.types.ts` - TypeScript types
3. `app/test-filter/page.tsx` - Test page (temporary)

### What It Does
- Tab filters (optional)
- Search input
- Select dropdowns
- Date pickers
- Date range
- Apply/Clear buttons
- Result count display
- Responsive layout

### Exit Criteria
✅ Component compiles  
✅ All filter types work  
✅ Test page works  
✅ No impact on existing pages

---

## 📋 Phase 2: Simple Pages (7 pages)

### Migration Order
1. `/pr2` ← Start here (proof of concept)
2. `/pr1`
3. `/po`
4. `/substitutes`
5. `/supplier/po`
6. `/supplier/delivery`
7. `/rfq`

### Pattern
- Replace filter section with `<FilterBar />`
- Keep all state unchanged
- Keep all API calls unchanged

### Test Each Page
✅ Search works  
✅ Status filter works  
✅ Apply button works  
✅ Clear button works  
✅ Pagination works  
✅ No console errors

---

## 📋 Phase 3: Pages with Tabs (3 pages)

### Migration Order
1. `/grn` - Tabs: All/Open/Closed
2. `/delivery` - Tabs: All/Pending/Scheduled/etc.
3. `/approvals/history` ⭐ - Tabs: All/PR1/PR2/PO (your screenshot!)

### Pattern
- Replace custom tab buttons with FilterBar tabs
- Replace search section with FilterBar
- Keep all state unchanged

### Test Each Page
✅ All tabs work  
✅ Search works  
✅ Tab + search combination works  
✅ Matches screenshot design (for approval history)

---

## 📋 Phase 4: Complex Pages (3 pages)

### Migration Order
1. `/warehouse` - Search + priority
2. `/warehouse/history` - Search + 2 selects + date range
3. `/admin/users` - Search + role + department

### Pattern
- Replace complex filter section with FilterBar
- Map all filters to FilterBar config
- Keep all state unchanged

### Test Each Page
✅ All filters work  
✅ Filter combinations work  
✅ Date ranges work  
✅ Clear resets everything

---

## 📋 Phase 5: Add Filters (6 pages)

### Enhancement Order
1. `/supplier/products` - Add search + status
2. `/supplier/quotations` - Add search + status
3. `/tsqa/rse` - Add search
4. `/accreditation` - Add search
5. `/accreditation/products` - Add search
6. `/bugtrack` - Add search

### Pattern
- Add FilterBar component
- Add filter state
- Update data fetching to use filters

### Test Each Page
✅ New search works  
✅ Existing features still work  
✅ No regressions

---

## 🚨 Stop Conditions

**STOP immediately if:**
- TypeScript errors appear
- Console errors appear
- Existing functionality breaks
- Data doesn't load
- Pagination breaks
- Any page becomes unusable

**Then:**
1. Identify the issue
2. Fix or rollback
3. Re-test
4. Continue only when stable

---

## ✅ Testing Checklist (After Each Page)

- [ ] Navigate to the page
- [ ] Test search
- [ ] Test each filter
- [ ] Test Apply button
- [ ] Test Clear button
- [ ] Test pagination
- [ ] Test on mobile
- [ ] Check console for errors
- [ ] Verify data loads
- [ ] Verify existing features work

---

## 🔧 Commands

```bash
# TypeScript check
npm run type-check
# or
tsc --noEmit

# Lint
npm run lint

# Build
npm run build

# Commit after each phase
git add .
git commit -m "feat: [phase description]"

# Rollback if needed
git revert HEAD
```

---

## 📊 Progress Tracker

### Phase 1: Create Component
- [ ] Create FilterBar.tsx
- [ ] Create FilterBar.types.ts
- [ ] Create test page
- [ ] Test all filter types
- [ ] Delete test page
- [ ] Commit

### Phase 2: Simple Pages (7)
- [ ] `/pr2`
- [ ] `/pr1`
- [ ] `/po`
- [ ] `/substitutes`
- [ ] `/supplier/po`
- [ ] `/supplier/delivery`
- [ ] `/rfq`
- [ ] Commit

### Phase 3: Pages with Tabs (3)
- [ ] `/grn`
- [ ] `/delivery`
- [ ] `/approvals/history` ⭐
- [ ] Commit

### Phase 4: Complex Pages (3)
- [ ] `/warehouse`
- [ ] `/warehouse/history`
- [ ] `/admin/users`
- [ ] Commit

### Phase 5: Add Filters (6)
- [ ] `/supplier/products`
- [ ] `/supplier/quotations`
- [ ] `/tsqa/rse`
- [ ] `/accreditation`
- [ ] `/accreditation/products`
- [ ] `/bugtrack`
- [ ] Commit

---

## 🎉 Success Metrics

- ✅ ~750 lines of code removed
- ✅ 20 pages use unified FilterBar
- ✅ 6 pages have new search capability
- ✅ 100% design system compliance
- ✅ Zero regressions
- ✅ All tests pass

---

**Ready to start Phase 1?** Say "start phase 1"!
