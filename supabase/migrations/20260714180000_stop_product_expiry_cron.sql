/*
  Stop nightly auto-expiry of supplier_products.
  Catalog products stay verified; accreditation expiry is unchanged.
  Column supplier_products.valid_until remains nullable (unused by app writes).
*/

SELECT cron.unschedule('expire-accreditations-and-products');

SELECT cron.schedule(
  'expire-accreditations-and-products',
  '0 0 * * *',
  $$
    UPDATE public.supplier_accreditations
    SET status = 'expired', updated_at = now()
    WHERE status = 'approved'
      AND valid_until IS NOT NULL
      AND valid_until < CURRENT_DATE;
  $$
);
