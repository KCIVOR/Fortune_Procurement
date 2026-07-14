/*
  Deny supplier UPDATE on supplier_products.
  Catalog ownership moved to procurement; suppliers retain SELECT of own rows only.
*/

DROP POLICY IF EXISTS "supplier_products_supplier_update" ON public.supplier_products;

DROP TRIGGER IF EXISTS tr_supplier_products_supplier_update ON public.supplier_products;
