-- Raw Materials Phase 1 (Bundle A): schema additions for PR2-direct
-- requisition flow. Additive & nullable only — must not affect existing
-- Goods/Services rows or RLS behavior. See docs/raw-materials-implementation-plan.md.

-- 1.1 pr2_requests.request_type (defaults existing rows to 'goods')
ALTER TABLE pr2_requests
  ADD COLUMN request_type text NOT NULL DEFAULT 'goods'
    CHECK (request_type IN ('goods', 'services', 'raw_material'));

-- 1.2 pr2_requests.pr1_id nullable — raw-material PR2s have no PR1.
ALTER TABLE pr2_requests
  ALTER COLUMN pr1_id DROP NOT NULL;

-- 1.3 rfq_batches.pr1_id nullable + partial unique on pr2_id (mirrors the
-- existing UNIQUE(pr1_id) used by the Goods path).
ALTER TABLE rfq_batches
  ALTER COLUMN pr1_id DROP NOT NULL;

CREATE UNIQUE INDEX rfq_batches_pr2_id_key
  ON rfq_batches (pr2_id)
  WHERE pr2_id IS NOT NULL;

-- 1.4 supplier_item_selections: allow PR2-native line identity for raw
-- material RFQ lines that have no pr1_item.
ALTER TABLE supplier_item_selections
  ALTER COLUMN pr1_item_id DROP NOT NULL,
  ADD COLUMN pr2_item_id uuid REFERENCES pr2_items(id),
  ADD CONSTRAINT supplier_item_selections_line_ref_chk
    CHECK (pr1_item_id IS NOT NULL OR pr2_item_id IS NOT NULL);

-- 1.5 rfq_item_quotes: mirror supplier_item_selections.
ALTER TABLE rfq_item_quotes
  ALTER COLUMN pr1_item_id DROP NOT NULL,
  ADD COLUMN pr2_item_id uuid REFERENCES pr2_items(id),
  ADD CONSTRAINT rfq_item_quotes_line_ref_chk
    CHECK (pr1_item_id IS NOT NULL OR pr2_item_id IS NOT NULL);

-- 1.6 request_type_for_delivery(): pr2.pr1_id can now be null, so the pr1
-- join must be LEFT (an inner join would silently return NULL and break
-- warehouse/TSQA '= goods' RLS checks). Map raw_material -> goods here
-- rather than returning it literally, since existing GRN/warehouse RLS
-- policies still check '= goods' and haven't been migrated to include
-- 'raw_material' yet.
CREATE OR REPLACE FUNCTION public.request_type_for_delivery(p_delivery_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    CASE
      WHEN COALESCE(pr2.request_type, pr1.request_type, 'goods') = 'raw_material' THEN 'goods'
      ELSE COALESCE(pr2.request_type, pr1.request_type, 'goods')
    END
  FROM public.deliveries d
  JOIN public.po_requests po   ON po.id  = d.po_id
  JOIN public.pr2_requests pr2 ON pr2.id = po.pr2_id
  LEFT JOIN public.pr1_requests pr1 ON pr1.id = pr2.pr1_id
  WHERE d.id = p_delivery_id;
$function$;

-- request_type_for_grn() delegates to request_type_for_delivery() and
-- needs no change — it picks up the fix above automatically.
