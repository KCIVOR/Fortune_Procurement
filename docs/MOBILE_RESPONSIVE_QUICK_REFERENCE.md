# Mobile Responsive Design - Quick Reference Guide

## 🎯 Quick Patterns

### Responsive Sizing
```tsx
// Heights
h-12 sm:h-10          // Larger on mobile for better touch
h-12 sm:h-[42px]      // Standard input height

// Widths
w-full sm:w-auto      // Full width on mobile, auto on desktop
w-10 h-10 sm:w-8 sm:h-8  // Touch targets

// Text
text-base sm:text-sm  // Larger text on mobile
text-sm sm:text-xs    // Readable on mobile
```

### Responsive Layout
```tsx
// Flex Direction
flex flex-col sm:flex-row        // Stack on mobile
flex flex-col-reverse sm:flex-row // Reverse order

// Grid
grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4
grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3

// Spacing
gap-2 sm:gap-3 lg:gap-4
p-4 sm:p-6 lg:p-8
```

### Visibility
```tsx
hidden sm:block       // Desktop only
sm:hidden             // Mobile only
hidden md:flex        // Desktop flex
md:hidden             // Mobile only
```

### Touch Targets
```tsx
// Minimum 40x40px on mobile
w-10 h-10 sm:w-8 sm:h-8
px-4 py-2 sm:px-3 sm:py-1
min-w-[80px] sm:min-w-0
```

### Buttons
```tsx
// Full width on mobile
<Button className="w-full sm:w-auto h-12 sm:h-10">

// With active state
<Button className="... active:bg-pq-primary-800">
```

### Dropdowns
```tsx
// Responsive width
w-[calc(100vw-2rem)] sm:w-80 max-w-md

// Responsive height
max-h-[60vh] sm:max-h-[400px]
```

### Tables
```tsx
// Use ResponsiveTable wrapper
<ResponsiveTable
  mobileView={<MobileCards />}
>
  <table>...</table>
</ResponsiveTable>
```

### Scrolling
```tsx
// Horizontal scroll with hidden scrollbar
overflow-x-auto scrollbar-hide

// Vertical scroll
overflow-y-auto max-h-[60vh]
```

---

## 📏 Breakpoints

```
sm:  640px   (large phones landscape, small tablets)
md:  768px   (tablets)
lg:  1024px  (small laptops, large tablets)
xl:  1280px  (desktops)
2xl: 1536px  (large desktops)
```

---

## ✅ Checklist for New Components

- [ ] Touch targets ≥ 40x40px on mobile
- [ ] Text ≥ 14px on mobile
- [ ] Buttons full-width or large enough on mobile
- [ ] No viewport overflow
- [ ] Proper spacing (tighter on mobile)
- [ ] Active states for touch feedback
- [ ] Tested on 375px width minimum

---

## 🚫 Common Mistakes

### ❌ DON'T
```tsx
// Fixed small sizes
<button className="w-6 h-6">

// Fixed widths without max-width
<div className="w-80">

// Desktop-only layouts
<div className="flex">

// Small text everywhere
<span className="text-xs">
```

### ✅ DO
```tsx
// Responsive sizes
<button className="w-10 h-10 sm:w-6 sm:h-6">

// Responsive widths
<div className="w-full sm:w-80 max-w-md">

// Mobile-first layouts
<div className="flex flex-col sm:flex-row">

// Readable text
<span className="text-sm sm:text-xs">
```

---

## 🎨 Component Examples

### Filter Bar
```tsx
<FilterBar
  filters={[
    {
      type: 'search',
      id: 'search',
      label: 'Search',
      placeholder: 'Search...',
      value: search,
      onChange: setSearch,
    },
  ]}
  onApply={handleApply}
  onClear={handleClear}
/>
```

### Pagination
```tsx
<PaginationControls
  currentPage={page}
  totalPages={totalPages}
  pageSize={20}
  totalCount={count}
  entityLabel="items"
  onPageChange={setPage}
/>
```

### Responsive Table
```tsx
<ResponsiveTable
  mobileView={
    <div className="space-y-3">
      {items.map(item => (
        <div key={item.id} className="bg-white border rounded-lg p-4">
          {/* Mobile card content */}
        </div>
      ))}
    </div>
  }
>
  <table className="w-full">
    {/* Desktop table */}
  </table>
</ResponsiveTable>
```

---

## 🔧 Utility Classes

### Custom Utilities
```css
.scrollbar-hide          /* Hide scrollbar but keep scroll */
.label-caps              /* Uppercase labels */
```

### Common Combinations
```tsx
// Card
"bg-white border border-pq-neutral-200 rounded-lg p-4 sm:p-6"

// Button
"px-4 py-2 sm:px-3 sm:py-1 rounded-md font-medium transition active:scale-95"

// Input
"h-12 sm:h-10 px-3 border rounded-md"

// Touch target
"w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center"
```

---

## 📱 Testing

### Test on these widths:
- 320px (iPhone SE)
- 375px (iPhone 12/13)
- 390px (iPhone 14)
- 768px (iPad)
- 1024px (Desktop)

### Quick test command:
```bash
# Open Chrome DevTools
# Toggle device toolbar (Ctrl+Shift+M)
# Test responsive mode
```

---

**Last Updated:** June 1, 2026  
**Version:** 1.0
