/*
  # Default supplier_supply_type for supplier accounts

  - Backfill existing supplier profiles with NULL → 'normal' (Non raw mat supplier).
  - Does NOT add a table-wide DEFAULT (non-supplier profiles stay NULL).
  - New suppliers get 'normal' from provision APIs (invite / create / bulk-import / admin when role=supplier).
*/

UPDATE public.profiles AS p
SET supplier_supply_type = 'normal'
FROM public.roles AS r
WHERE p.role_id = r.id
  AND r.name = 'supplier'
  AND p.supplier_supply_type IS NULL;
