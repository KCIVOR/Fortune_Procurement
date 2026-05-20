# FilterBar Component - Feature Overview

## Component Structure

```
┌─────────────────────────────────────────────────────────────┐
│  Tab Filters (Optional)                                     │
│  [All] [PR1] [PR2] [PO]                                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Filter Container                                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Search Input    │ Status Dropdown │ Date From │ Date To │
│  │ [Search...]     │ [Select...]     │ [Date]    │ [Date]  │
│  │                 │                 │           │ [Clear] │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  [Apply]                                    8 results found │
└─────────────────────────────────────────────────────────────┘
```

## Supported Filter Types

### 1. **Search Filter**
```typescript
{
  type: 'search',
  id: 'search',
  label: 'Search',
  placeholder: 'Search by name...',
  value: search,
  onChange: setSearch,
}
```
- Text input with search icon
- Real-time filtering
- Placeholder text

### 2. **Select Filter**
```typescript
{
  type: 'select',
  id: 'status',
  label: 'Status',
  placeholder: 'Select status...',
  value: status,
  onChange: setStatus,
  options: [
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
  ],
}
```
- Dropdown with options
- Placeholder support
- Disabled state support

### 3. **Date Filter**
```typescript
{
  type: 'date',
  id: 'dateFrom',
  label: 'Date From',
  value: dateFrom,
  onChange: setDateFrom,
}
```
- Single date input
- HTML5 date picker
- Optional

### 4. **Date Range Filter**
```typescript
{
  type: 'dateRange',
  id: 'dateRange',
  label: 'Date Range',
  value: [dateFrom, dateTo],
  onChange: ([from, to]) => { /* ... */ },
}
```
- Two date inputs (From/To)
- Renders as two separate fields
- Handles array values

### 5. **Custom Filter**
```typescript
{
  type: 'custom',
  id: 'custom',
  label: 'Custom',
  value: '',
  onChange: () => {},
  renderCustom: () => <YourCustomComponent />,
}
```
- Render any custom component
- Full control over UI
- Useful for complex filters

## Tab Filters

```typescript
const tabs: TabFilter[] = [
  { value: 'all', label: 'All' },
  { value: 'pr1', label: 'PR1' },
  { value: 'pr2', label: 'PR2' },
  { value: 'po', label: 'PO' },
];
```

- Optional (can be omitted)
- Active tab highlighted
- Disabled during loading
- Callback on change

## Props Reference

```typescript
interface FilterBarProps {
  // Tab filters
  tabs?: TabFilter[];
  activeTab?: string;
  onTabChange?: (value: string) => void;

  // Filter configuration
  filters: FilterConfig[];
  onApply?: () => void;
  onClear: () => void;

  // State
  loading?: boolean;
  resultCount?: number;
  resultLabel?: string;

  // Styling
  className?: string;
}
```

## Usage Example

```typescript
'use client';

import FilterBar from '@/components/shared/FilterBar';
import type { FilterConfig, TabFilter } from '@/components/shared/FilterBar.types';

export default function MyPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  const tabs: TabFilter[] = [
    { value: 'all', label: 'All' },
    { value: 'pr1', label: 'PR1' },
    { value: 'pr2', label: 'PR2' },
  ];

  const filters: FilterConfig[] = [
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
      options: [
        { value: 'pending', label: 'Pending' },
        { value: 'approved', label: 'Approved' },
      ],
    },
  ];

  return (
    <FilterBar
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      filters={filters}
      onClear={() => {
        setSearch('');
        setStatus('');
        setActiveTab('all');
      }}
      resultCount={filteredData.length}
      resultLabel="request"
    />
  );
}
```

## Design System Tokens Used

- **Colors:** `pq-primary-*`, `pq-neutral-*`, `pq-success-*`, `pq-error-*`, `pq-warning-*`
- **Typography:** Design system font sizes and weights
- **Spacing:** Consistent padding and gaps
- **Borders:** `pq-neutral-200` for subtle borders
- **Hover States:** `pq-neutral-50` background on hover

## Responsive Behavior

### Desktop (lg)
- 4-column grid layout
- All filters visible
- Horizontal layout

### Tablet (md)
- 2-column grid layout
- Filters wrap to next row
- Compact spacing

### Mobile (sm)
- 1-column stacked layout
- Full-width inputs
- Labels above inputs
- Table rows stack vertically

## Loading State

When `loading={true}`:
- All inputs are disabled
- Buttons are disabled
- Opacity reduced to 50%
- Cursor shows "not-allowed"

## Result Count Display

```
"8 results found"     // plural
"1 result found"      // singular
```

Automatically handles singular/plural based on count.

## Accessibility Features

- ✅ Proper `<Label>` components with `htmlFor`
- ✅ Semantic HTML structure
- ✅ ARIA-compliant button states
- ✅ Keyboard navigation support
- ✅ Focus states on inputs
- ✅ Disabled state indicators

## Performance Considerations

- ✅ No unnecessary re-renders
- ✅ Memoized filter components
- ✅ Efficient state management
- ✅ No external API calls in component
- ✅ Filtering logic in parent component

## Browser Support

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers

## Known Limitations

- Date range filter renders as two separate fields (not a range picker)
- Custom filters require manual implementation
- No built-in API integration (filtering done in parent)
- No export/import functionality

## Future Enhancements

- [ ] Date range picker component
- [ ] Multi-select filter type
- [ ] Saved filter presets
- [ ] Advanced search syntax
- [ ] Filter history
- [ ] Export filtered results
