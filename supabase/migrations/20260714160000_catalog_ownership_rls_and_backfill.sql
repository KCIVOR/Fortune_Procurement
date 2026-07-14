/*
  Catalog ownership shift + supply-type backfill
  - Suppliers who already have any supplier_products → raw_material
  - Deny supplier INSERT on supplier_products
  - Allow procurement/admin INSERT of verified rows for any supplier_id
*/

UPDATE public.profiles AS p
SET supplier_supply_type = 'raw_material'
FROM public.roles AS r
WHERE p.role_id = r.id
  AND r.name = 'supplier'
  AND EXISTS (
    SELECT 1 FROM public.supplier_products sp WHERE sp.supplier_id = p.id
  );

DROP POLICY IF EXISTS "supplier_products_supplier_insert" ON public.supplier_products;

DROP POLICY IF EXISTS "supplier_products_procurement_insert" ON public.supplier_products;
CREATE POLICY "supplier_products_procurement_insert"
  ON public.supplier_products FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name IN ('procurement', 'admin')
    )
    AND status = 'verified'
  );
