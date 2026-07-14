/*
  Catalog is goods-only for new products.
  Soft-deactivate existing verified services catalog rows so they cannot be offered.
  Services RFQs continue to use manual quote entry.
  Column supplier_products.item_type still allows 'services' for historical rows.
*/

UPDATE public.supplier_products
SET
  status = 'inactive',
  reviewed_at = now(),
  review_notes = CASE
    WHEN review_notes IS NULL OR btrim(review_notes) = '' THEN
      'Deactivated: catalog services offerings removed; services RFQs use manual quote entry.'
    ELSE
      review_notes || E'\nDeactivated: catalog services offerings removed; services RFQs use manual quote entry.'
  END,
  updated_at = now()
WHERE item_type = 'services'
  AND status = 'verified';
