# FilterBar - Quick Reference

**Component:** `components/shared/FilterBar.tsx`  
**Version:** 2.0 (Responsive)  
**Updated:** June 2, 2026

---

## 🎯 Quick Summary

FilterBar is now **fully responsive** with:
- ✅ Full-width buttons on mobile
- ✅ 48px touch targets (WCAG AAA)
- ✅ Clean vertical layout
- ✅ Better focus states
- ✅ Optimized spacing

---

## 📱 Responsive Behavior

```
Mobile (< 640px):
  - 1 column layout
  - Full-width buttons (stacked)
  - 48px input/button height
  - 16px padding

Tablet (≥ 640px):
  - 2 column layout
  - Side-by-side buttons
  - 44px input/button height
  - 24px padding

Desktop (≥ 1024px):
  - 3-4 column layout
  - Side-by-side buttons
  - 44px input/button height
  - 24px padding
```

---

## 💻 Basic Usage

```tsx
import FilterBar from '@/components/shared/FilterBar';
import type { FilterConfig } from '@/components/shared/FilterBar.types';

const filters: FilterConfig[] = [
  {
    type: 'search',
    id: 'search',
    label: 'Search',
    placeholder: 'Search...',
    value: search,
    onChange: setSearch,
  },
];

<FilterBar
  filters={filters}
  onApply={handleApply}
  onClear={handleClear}
  resultCount={totalCount}
  resultLabel="item"
/>
```

---

## 🎨 Filter Types

### Search:
```tsx
{
  type: 'search',
  id: 'search',
  label: 'Search',
  placeholder: 'Search...',
  value: search,
  onChange: setSearch,
}
```

### Select:
```tsx
{
  type: 'select',
  id: 'status',
  label: 'Status',
  placeholder: 'Select status',
  value: status,
  onChange: setStatus,
  options: [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
  ],
}
```

### Date:
```tsx
{
  type: 'date',
  id: 'date',
  label: 'Date',
  value: date,
  onChange: setDate,
}
```

### Date Range:
```tsx
{
  type: 'dateRange',
  id: 'dateRange',
  label: 'Date Range',
  value: [fromDate, toDate],
  onChange: setDateRange,
}
```

---

## ✨ Key Features

### Responsive Grid:
- 1 filter: Full width
- 2 filters: 1 col → 2 cols
- 3 filters: 1 col → 2 cols → 3 cols
- 4+ filters: 1 col → 2 cols → 4 cols

### Buttons:
- Mobile: Full-width, stacked
- Desktop: Auto-width, side-by-side
- Height: 48px mobile, 44px desktop
- Padding: 32px horizontal

### Inputs:
- Height: 48px mobile, 44px desktop
- Focus: 2px blue ring
- Icons: Search icon for search inputs
- Disabled state: Reduced opacity

---

## 📏 Touch Targets

All elements meet WCAG standards:

| Element | Mobile | Desktop | Standard |
|---------|--------|---------|----------|
| Buttons | 48px | 44px | ✅ AAA / AA |
| Inputs | 48px | 44px | ✅ AAA / AA |
| Selects | 48px | 44px | ✅ AAA / AA |

---

## 🎨 Styling Classes

### Container:
```
bg-white rounded-lg border border-pq-neutral-200 shadow-sm
p-4 sm:p-6
```

### Buttons:
```
Apply:
  w-full sm:w-auto
  h-12 sm:h-11
  bg-pq-primary-600 hover:bg-pq-primary-700
  px-8 rounded-md

Clear:
  w-full sm:w-auto
  h-12 sm:h-11
  border-pq-neutral-200
  px-8 rounded-md
```

### Inputs:
```
h-12 sm:h-11
focus:ring-2 focus:ring-pq-primary-600
```

---

## ✅ Testing Checklist

- [ ] Mobile (375px): Full-width buttons?
- [ ] Tablet (768px): 2-column grid?
- [ ] Desktop (1280px): All filters visible?
- [ ] Touch targets: 48px on mobile?
- [ ] Focus states: Blue ring visible?
- [ ] Loading state: Works correctly?
- [ ] Result count: Displays properly?

---

## 🐛 Common Issues

### Buttons Not Full-Width on Mobile?
✅ Check: Should have `w-full sm:w-auto`

### Inputs Too Small?
✅ Check: Should have `h-12 sm:h-11`

### Layout Breaking?
✅ Test at exact breakpoints: 640px, 1024px

### Focus Not Visible?
✅ Check: Should have `focus:ring-2 focus:ring-pq-primary-600`

---

## 📖 Documentation

- **Full Guide:** `FILTERBAR_RESPONSIVE_FIXES.md`
- **Visual Guide:** `FILTERBAR_VISUAL_COMPARISON.md`
- **Summary:** `FILTERBAR_FIX_SUMMARY.md`
- **This File:** `FILTERBAR_QUICK_REFERENCE.md`

---

## 🎯 Best Practices

### ✅ Do:
- Use concise placeholder text
- Test on actual devices
- Follow responsive patterns
- Use appropriate filter types

### ❌ Don't:
- Override component styles
- Use fixed widths
- Forget to test mobile
- Use too many filters (max 4-5)

---

**Last Updated:** June 2, 2026  
**Status:** Production Ready ✅
