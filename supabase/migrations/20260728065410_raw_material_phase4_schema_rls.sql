-- Raw Materials Phase 4 (Bundle D): delivery display type + Planning PO read.
-- Additive only.

-- request_type_for_delivery() deliberately collapses raw_material -> 'goods'
-- for RLS purposes (Phase 1). UI badges need the real value, so add sibling
-- display-only functions instead of touching the RLS-purposed one.
CREATE OR REPLACE FUNCTION public.request_type_for_delivery_display(p_delivery_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(pr2.request_type, pr1.request_type, 'goods')
  FROM public.deliveries d
  JOIN public.po_requests po   ON po.id  = d.po_id
  JOIN public.pr2_requests pr2 ON pr2.id = po.pr2_id
  LEFT JOIN public.pr1_requests pr1 ON pr1.id = pr2.pr1_id
  WHERE d.id = p_delivery_id;
$function$;

CREATE OR REPLACE FUNCTION public.request_types_for_deliveries(p_delivery_ids uuid[])
 RETURNS TABLE(delivery_id uuid, request_type text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT d.id, COALESCE(pr2.request_type, pr1.request_type, 'goods')
  FROM public.deliveries d
  JOIN public.po_requests po   ON po.id  = d.po_id
  JOIN public.pr2_requests pr2 ON pr2.id = po.pr2_id
  LEFT JOIN public.pr1_requests pr1 ON pr1.id = pr2.pr1_id
  WHERE d.id = ANY(p_delivery_ids);
$function$;

GRANT EXECUTE ON FUNCTION public.request_type_for_delivery_display(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_types_for_deliveries(uuid[]) TO authenticated;

-- "Employee can read own requisition POs" is an inner join through
-- pr1_requests — never matches a raw-material PO (pr2.pr1_id IS NULL).
-- Additive companion policy resolving ownership straight off pr2_requests
-- (works for both goods, where requisitioner_id was copied from pr1 at
-- warehouse-generation time, and raw material, where it's the Planning
-- user's own id).
CREATE POLICY "Employee can read own PR2-requisitioner POs"
  ON po_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pr2_requests pr2
      WHERE pr2.id = po_requests.pr2_id
        AND pr2.requisitioner_id = auth.uid()
    )
  );
