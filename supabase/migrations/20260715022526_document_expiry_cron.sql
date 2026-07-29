/*
  # Document-level expiry for accreditation documents (Path B)

  Evidence: Phase 1 baseline 2026-07-15
  - Cron previously expired supplier_accreditations by valid_until
  - All 19 documents were status=uploaded with expires_at null
  - 3 accreditations had valid_until set

  Changes:
  - Stop nightly auto-expiry of supplier_accreditations via valid_until
  - Expire accepted accreditation application documents past expires_at
  - Scope: accreditation_id IS NOT NULL AND supplier_product_id IS NULL
  - Leave supplier_accreditations.valid_until column (no DROP)
  - Clear lingering account valid_until values
  - Does NOT alter supplier_documents status CHECK
*/

CREATE INDEX IF NOT EXISTS idx_supplier_documents_accreditation_expiry_check
  ON public.supplier_documents (expires_at)
  WHERE status = 'accepted'
    AND expires_at IS NOT NULL
    AND accreditation_id IS NOT NULL
    AND supplier_product_id IS NULL;

SELECT cron.unschedule('expire-accreditations-and-products');

SELECT cron.schedule(
  'expire-accreditations-and-products',
  '0 0 * * *',
  $$
    UPDATE public.supplier_documents
    SET status = 'expired', updated_at = now()
    WHERE status = 'accepted'
      AND expires_at IS NOT NULL
      AND expires_at < CURRENT_DATE
      AND accreditation_id IS NOT NULL
      AND supplier_product_id IS NULL;
  $$
);

UPDATE public.supplier_accreditations
SET valid_until = NULL, updated_at = now()
WHERE valid_until IS NOT NULL;
