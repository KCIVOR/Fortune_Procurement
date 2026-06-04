/**
 * FilterBar Component Types
 * Unified search and filter component for all list pages
 */

export type FilterType = 'search' | 'select' | 'date' | 'dateRange' | 'custom';

export interface TabFilter {
  /** Unique identifier for the tab */
  value: string;
  /** Display label */
  label: string;
}

export interface FilterConfig {
  /** Filter type determines how it renders */
  type: FilterType;
  
  /** Unique identifier for the filter */
  id: string;
  
  /** Display label */
  label: string;
  
  /** Placeholder text (for search, date inputs) */
  placeholder?: string;
  
  /** Current value(s) */
  value: string | [string, string];
  
  /** Callback when value changes */
  onChange: (value: string | [string, string]) => void;
  
  /** Options for select type */
  options?: Array<{ value: string; label: string }>;
  
  /** Whether the filter is disabled */
  disabled?: boolean;
  
  /** Custom CSS classes for grid positioning */
  className?: string;
  
  /** Custom render function for custom type */
  renderCustom?: () => React.ReactNode;
}

export interface FilterBarProps {
  /** Optional tab filters (e.g., All, PR1, PR2, PO) */
  tabs?: TabFilter[];
  
  /** Currently active tab value */
  activeTab?: string;
  
  /** Callback when tab changes */
  onTabChange?: (value: string) => void;
  
  /** Array of filter configurations */
  filters: FilterConfig[];
  
  /** Optional callback for Apply button */
  onApply?: () => void;
  
  /** Required callback for Clear button */
  onClear: () => void;
  
  /** Whether filters are loading */
  loading?: boolean;
  
  /** Total count of results (displays "X results found") */
  resultCount?: number;
  
  /** Label for result count (e.g., "validations", "requests") */
  resultLabel?: string;
  
  /** Additional CSS classes for the container */
  className?: string;

  /** Tighter spacing for dialogs and embedded panels */
  compact?: boolean;
}
