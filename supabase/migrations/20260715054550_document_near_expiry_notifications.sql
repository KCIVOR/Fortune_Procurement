/*
  # Near-expiry notifications for accreditation documents

  Evidence: audit 2026-07-15 confirmed the expiry cron (20260715120000) only
  flips supplier_documents.status to 'expired' — no notification is ever sent,
  to either the supplier or procurement, at expiry or any point before it.

  This adds a second daily job that fires once per document, ~2 calendar
  months before expires_at, notifying:
    - the document's own supplier
    - every active procurement user

  expiry_notified_at prevents re-notifying every day for the same document
  while it sits in the 2-month window. It is cleared by the app layer
  (verifyAccreditationDocument / updateAccreditationDocumentExpiry) whenever
  a document's expiry date is set or changed, so a re-verified/renewed
  document gets a fresh notification cycle for its new date.

  Scope: accreditation application documents only
  (accreditation_id IS NOT NULL AND supplier_product_id IS NULL) — same
  filter used by the expiry cron and every other Path B function.
*/

ALTER TABLE public.supplier_documents
  ADD COLUMN IF NOT EXISTS expiry_notified_at timestamptz;

CREATE OR REPLACE FUNCTION public.notify_accreditation_documents_near_expiry()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_doc_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO v_doc_ids
  FROM public.supplier_documents
  WHERE status = 'accepted'
    AND expires_at IS NOT NULL
    AND expires_at >= CURRENT_DATE
    AND expires_at <= CURRENT_DATE + INTERVAL '2 months'
    AND accreditation_id IS NOT NULL
    AND supplier_product_id IS NULL
    AND expiry_notified_at IS NULL;

  IF v_doc_ids IS NULL OR array_length(v_doc_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Notify the document's own supplier
  INSERT INTO public.notifications (user_id, title, body, type, document_type, document_id, action_url, read)
  SELECT
    sd.supplier_id,
    'Accreditation Document Nearing Expiry',
    'Your document "' || sd.file_name || '" expires on ' ||
      to_char(sd.expires_at, 'Mon DD, YYYY') || '. Please prepare a renewal.',
    'action_required',
    'ACCREDITATION_DOCUMENT',
    sd.id,
    '/supplier/accreditation',
    false
  FROM public.supplier_documents sd
  WHERE sd.id = ANY(v_doc_ids);

  -- Notify every active procurement user, one row per (document, procurement user)
  INSERT INTO public.notifications (user_id, title, body, type, document_type, document_id, action_url, read)
  SELECT
    pr.id,
    'Supplier Document Nearing Expiry',
    sup.full_name || '''s document "' || sd.file_name || '" expires on ' ||
      to_char(sd.expires_at, 'Mon DD, YYYY') || '.',
    'action_required',
    'ACCREDITATION_DOCUMENT',
    sd.id,
    '/accreditation/' || sd.accreditation_id,
    false
  FROM public.supplier_documents sd
  JOIN public.profiles sup ON sup.id = sd.supplier_id
  CROSS JOIN LATERAL (
    SELECT p.id
    FROM public.profiles p
    JOIN public.roles r ON r.id = p.role_id
    WHERE r.name = 'procurement' AND p.active = true
  ) pr
  WHERE sd.id = ANY(v_doc_ids);

  -- Mark as notified so this job doesn't repeat for these documents tomorrow
  UPDATE public.supplier_documents
  SET expiry_notified_at = now()
  WHERE id = ANY(v_doc_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.notify_accreditation_documents_near_expiry() FROM PUBLIC;

SELECT cron.unschedule('notify-accreditation-documents-near-expiry')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify-accreditation-documents-near-expiry');

SELECT cron.schedule(
  'notify-accreditation-documents-near-expiry',
  '10 0 * * *',
  $$SELECT public.notify_accreditation_documents_near_expiry();$$
);
