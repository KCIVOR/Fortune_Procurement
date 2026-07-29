-- Raw Materials Phase 3 (Bundle C): extend RFQ identity/read RLS to resolve
-- through pr2_requests when rfq_batches.pr1_id is null (raw-material RFQs).
-- Additive only — every existing pr1-based disjunct/join is preserved verbatim.

CREATE OR REPLACE FUNCTION public.is_own_rfq_batch(batch_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM rfq_batches rb
    LEFT JOIN pr1_requests pr1 ON pr1.id = rb.pr1_id
    LEFT JOIN pr2_requests pr2 ON pr2.id = rb.pr2_id AND rb.pr1_id IS NULL
    WHERE rb.id = batch_id
      AND (pr1.requisitioner_id = auth.uid() OR pr2.requisitioner_id = auth.uid())
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_own_rfq_supplier(rs_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM rfq_suppliers rs
    JOIN rfq_batches rb ON rb.id = rs.rfq_id
    LEFT JOIN pr1_requests pr1 ON pr1.id = rb.pr1_id
    LEFT JOIN pr2_requests pr2 ON pr2.id = rb.pr2_id AND rb.pr1_id IS NULL
    WHERE rs.id = rs_id
      AND (pr1.requisitioner_id = auth.uid() OR pr2.requisitioner_id = auth.uid())
  );
$function$;

DROP POLICY "rfq_quote_attachments_select" ON rfq_quote_attachments;
CREATE POLICY "rfq_quote_attachments_select" ON rfq_quote_attachments
FOR SELECT USING (
  uploaded_by = auth.uid()
  OR is_role('procurement')
  OR is_role('approver')
  OR is_role('warehouse')
  OR is_role('admin')
  OR EXISTS (SELECT 1 FROM rfq_suppliers rs WHERE rs.id = rfq_quote_attachments.rfq_supplier_id AND rs.supplier_id = auth.uid())
  OR EXISTS (SELECT 1 FROM rfq_batches rb JOIN pr1_requests pr ON pr.id = rb.pr1_id
             WHERE rb.id = rfq_quote_attachments.rfq_id AND pr.requisitioner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM rfq_batches rb JOIN pr2_requests pr2 ON pr2.id = rb.pr2_id
             WHERE rb.id = rfq_quote_attachments.rfq_id AND rb.pr1_id IS NULL AND pr2.requisitioner_id = auth.uid())
);
