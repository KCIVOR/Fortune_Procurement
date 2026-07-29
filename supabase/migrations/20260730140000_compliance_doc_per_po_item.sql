/*
  Compliance documentation, take 2.

  Phase 9 keyed "requires compliance doc" off the supplier catalog product
  linked via rfq_item_quotes.supplier_product_id. That link is never
  populated for services quotes (canvassing.ts: "Services RFQs use manual
  entry" — only goods catalog products may be linked), so the feature could
  never surface anything for the services POs it was built for.

  New design, per product decision:
  - `requires_compliance_doc` moves to `po_items` directly, set by
    Procurement/Buyer (existing "Procurement or Buyer can update PO items"
    policy already covers this column — no new write policy needed).
  - The supplier may only upload once a GRN has actually been created for
    that PO item (proof warehouse/procurement received it), checked via
    `po_item_has_grn()`.
*/

ALTER TABLE public.po_items
  ADD COLUMN IF NOT EXISTS requires_compliance_doc boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.po_items.requires_compliance_doc IS
  'When true, the supplier must upload a compliance/certification document for this line item (e.g. Certificate of Calibration). Set by Procurement/Buyer. Upload unlocks once a GRN item exists for this po_item — see po_item_has_grn().';

-- ─── Helper: does this PO item have a GRN yet? ────────────────────────────────

CREATE OR REPLACE FUNCTION public.po_item_has_grn(p_po_item_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.grn_items WHERE po_item_id = p_po_item_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.po_item_has_grn(uuid) TO authenticated;

-- Batch variant so the supplier compliance page can resolve visibility in one round trip.
CREATE OR REPLACE FUNCTION public.po_items_with_grn(p_po_item_ids uuid[])
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT po_item_id), ARRAY[]::uuid[])
  FROM public.grn_items
  WHERE po_item_id = ANY(p_po_item_ids);
$$;

GRANT EXECUTE ON FUNCTION public.po_items_with_grn(uuid[]) TO authenticated;

-- ─── Tighten compliance_documents INSERT: require the flag + a GRN ───────────

DROP POLICY IF EXISTS "compliance_documents_insert" ON public.compliance_documents;
CREATE POLICY "compliance_documents_insert"
ON public.compliance_documents FOR INSERT TO authenticated
WITH CHECK (
  supplier_id = auth.uid()
  AND public.is_role('supplier')
  AND EXISTS (
    SELECT 1 FROM public.po_requests po
    WHERE po.id = po_id
      AND po.supplier_id = auth.uid()
      AND po.status IN ('approved', 'sent')
  )
  AND EXISTS (
    SELECT 1 FROM public.po_items pi
    WHERE pi.id = po_item_id
      AND pi.po_id = po_id
      AND pi.requires_compliance_doc = true
  )
  AND public.po_item_has_grn(po_item_id)
);

-- ─── Tighten storage upload the same way ──────────────────────────────────────

DROP POLICY IF EXISTS "compliance_documents_storage_upload" ON storage.objects;
CREATE POLICY "compliance_documents_storage_upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'compliance-documents'
  AND split_part(name, '/', 1) = 'compliance-documents'
  AND split_part(name, '/', 2) <> ''   -- po_id
  AND split_part(name, '/', 3) <> ''   -- po_item_id
  AND split_part(name, '/', 4) <> ''   -- filename
  AND split_part(name, '/', 5) = ''    -- no extra segments
  AND EXISTS (
    SELECT 1 FROM public.po_requests po
    WHERE po.id = split_part(name, '/', 2)::uuid
      AND po.supplier_id = auth.uid()
      AND po.status IN ('approved', 'sent')
  )
  AND EXISTS (
    SELECT 1 FROM public.po_items pi
    WHERE pi.id = split_part(name, '/', 3)::uuid
      AND pi.po_id = split_part(name, '/', 2)::uuid
      AND pi.requires_compliance_doc = true
  )
  AND public.po_item_has_grn(split_part(name, '/', 3)::uuid)
);
