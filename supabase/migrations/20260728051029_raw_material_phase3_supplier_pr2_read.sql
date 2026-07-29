-- Raw Materials Phase 3 (Bundle C): suppliers had no RLS grant to read
-- pr2_requests/pr2_items at all — only pr1_requests (via
-- is_supplier_assigned_to_pr1). A raw-material RFQ has no PR1, so a supplier
-- assigned to it could not resolve the request header/items. Mirrors the
-- existing pr1 pattern.

CREATE OR REPLACE FUNCTION public.is_supplier_assigned_to_pr2(p_pr2_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    public.is_role('supplier')
    AND EXISTS (
      SELECT 1
      FROM public.rfq_batches rb
      INNER JOIN public.rfq_suppliers rs ON rs.rfq_id = rb.id
      WHERE rb.pr2_id = p_pr2_id
        AND rs.supplier_id = auth.uid()
    );
$function$;

CREATE POLICY "Suppliers can read assigned pr2_requests"
  ON pr2_requests
  FOR SELECT
  TO authenticated
  USING (is_supplier_assigned_to_pr2(id));

CREATE POLICY "Suppliers can read assigned pr2_items"
  ON pr2_items
  FOR SELECT
  TO authenticated
  USING (is_supplier_assigned_to_pr2(pr2_id));
