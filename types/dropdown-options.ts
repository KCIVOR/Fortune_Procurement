/** Categories supported by the dynamic dropdown system. */
export type DropdownCategory =
  | 'WAREHOUSE_OPTIONS'
  | 'PAYMENT_TERMS_OPTIONS'
  | 'PURPOSE_OPTIONS'
  | 'UNIT_OPTIONS'
  | 'ACCREDITATION_DOC_TYPE_OPTIONS'
  | 'PRODUCT_DOC_TYPE_OPTIONS';

/** Human-friendly labels for each category (used in admin UI). */
export const DROPDOWN_CATEGORY_LABELS: Record<DropdownCategory, string> = {
  WAREHOUSE_OPTIONS:              'Warehouse',
  PAYMENT_TERMS_OPTIONS:          'Payment Terms',
  PURPOSE_OPTIONS:                'Request Purpose',
  UNIT_OPTIONS:                   'Unit of Measure',
  ACCREDITATION_DOC_TYPE_OPTIONS: 'Accreditation Document Types',
  PRODUCT_DOC_TYPE_OPTIONS:       'Product / Service Document Types',
};

/** All categories in display order. */
export const DROPDOWN_CATEGORIES: DropdownCategory[] = [
  'WAREHOUSE_OPTIONS',
  'PAYMENT_TERMS_OPTIONS',
  'PURPOSE_OPTIONS',
  'UNIT_OPTIONS',
  'ACCREDITATION_DOC_TYPE_OPTIONS',
  'PRODUCT_DOC_TYPE_OPTIONS',
];

/** A single row from the `system_dropdown_options` table. */
export interface DropdownOption {
  id: string;
  category: DropdownCategory;
  option_value: string;
  option_label: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
