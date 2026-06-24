-- Phase 3: pg_cron nightly expiry job
-- Runs at midnight UTC daily.
-- Only touches rows where valid_until IS NOT NULL — pre-existing records without
-- an expiry date are never affected.

SELECT cron.schedule(
  'expire-accreditations-and-products',
  '0 0 * * *',
  $$
    UPDATE public.supplier_accreditations
    SET status = 'expired', updated_at = now()
    WHERE status = 'approved'
      AND valid_until IS NOT NULL
      AND valid_until < CURRENT_DATE;

    UPDATE public.supplier_products
    SET status = 'expired', updated_at = now()
    WHERE status = 'verified'
      AND valid_until IS NOT NULL
      AND valid_until < CURRENT_DATE;
  $$
);
