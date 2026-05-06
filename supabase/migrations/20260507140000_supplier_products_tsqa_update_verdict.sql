/*
  # Allow TSQA to apply product verdict after RSE evaluation

  submitTSQAResult (lib/tsqa.ts) updates rse_records to passed/failed then
  supplier_products to verified/rejected. Only SELECT was granted to tsqa on
  supplier_products, so the product update had no permissive policy and the
  database stayed inconsistent (RSE/review passed, product still pending_tsqa).

  This policy allows a narrow UPDATE only from TSQA, only from pending_tsqa,
  only when an RSE for that product is assigned to the current user and
  already marked passed/failed (matches post–step-3 state in submitTSQAResult).

  Includes a one-time repair for rows already stuck with RSE terminal status
  and product still pending_tsqa.
*/

-- ═══════════════════════════════════════════════════════════════════════════
-- TSQA: set product verified/rejected after evaluation (assigned RSE only)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE POLICY "supplier_products_tsqa_update_verdict"
  ON public.supplier_products FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'tsqa'
    )
    AND status = 'pending_tsqa'
    AND EXISTS (
      SELECT 1 FROM public.rse_records rr
      WHERE rr.supplier_product_id = supplier_products.id
        AND rr.assigned_to = auth.uid()
        AND rr.status IN ('passed', 'failed')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'tsqa'
    )
    AND (
      (status = 'verified' AND verified_at IS NOT NULL)
      OR
      (status = 'rejected' AND rejected_at IS NOT NULL)
    )
  );

COMMENT ON POLICY "supplier_products_tsqa_update_verdict" ON public.supplier_products IS
  'TSQA may set supplier_products to verified/rejected only from pending_tsqa when assigned RSE is passed/failed.';

-- ═══════════════════════════════════════════════════════════════════════════
-- One-time repair: RSE already terminal, product still pending_tsqa
-- (Pick latest terminal RSE per product if multiples.)
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE public.supplier_products sp
SET
  status      = 'verified',
  verified_at = COALESCE(v.t_at, now()),
  updated_at  = now()
FROM (
  SELECT DISTINCT ON (rr.supplier_product_id)
    rr.supplier_product_id AS pid,
    COALESCE(rr.completed_at, rr.updated_at) AS t_at
  FROM public.rse_records rr
  WHERE rr.status = 'passed'
  ORDER BY rr.supplier_product_id, rr.completed_at DESC NULLS LAST, rr.updated_at DESC NULLS LAST
) v
WHERE sp.id = v.pid
  AND sp.status = 'pending_tsqa';

UPDATE public.supplier_products sp
SET
  status      = 'rejected',
  rejected_at = COALESCE(v.t_at, now()),
  updated_at  = now()
FROM (
  SELECT DISTINCT ON (rr.supplier_product_id)
    rr.supplier_product_id AS pid,
    COALESCE(rr.completed_at, rr.updated_at) AS t_at
  FROM public.rse_records rr
  WHERE rr.status = 'failed'
  ORDER BY rr.supplier_product_id, rr.completed_at DESC NULLS LAST, rr.updated_at DESC NULLS LAST
) v
WHERE sp.id = v.pid
  AND sp.status = 'pending_tsqa';
