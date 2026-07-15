/*
  # Multi-milestone near-expiry notifications (2mo / 1mo / 15d / day-of)

  Follow-up to 20260715054550_document_near_expiry_notifications.sql, which
  only fired once, anywhere inside a 2-month window. Replaced with four
  independent checkpoints, each with its own "already sent" flag, so a
  document can (and should) fire more than once as it gets closer to expiry —
  and so a document verified with only e.g. 10 days left immediately catches
  up on every milestone it's already past, in one run.

  supplier_documents.expiry_notified_at (single-flag) is replaced by four
  columns: notified_60d_at, notified_30d_at, notified_15d_at, notified_0d_at.
  All four are cleared by the app layer any time expires_at is set, changed,
  or cleared, so a renewed document gets a fresh notification cycle.

  Same cron job (notify-accreditation-documents-near-expiry, 10 0 * * *)
  keeps calling the same function name — only the function body changes, so
  no re-scheduling needed.
*/

ALTER TABLE public.supplier_documents
  DROP COLUMN IF EXISTS expiry_notified_at;

ALTER TABLE public.supplier_documents
  ADD COLUMN IF NOT EXISTS notified_60d_at timestamptz,
  ADD COLUMN IF NOT EXISTS notified_30d_at timestamptz,
  ADD COLUMN IF NOT EXISTS notified_15d_at timestamptz,
  ADD COLUMN IF NOT EXISTS notified_0d_at  timestamptz;

CREATE OR REPLACE FUNCTION public.notify_accreditation_documents_near_expiry()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_60d uuid[];
  v_30d uuid[];
  v_15d uuid[];
  v_0d  uuid[];
BEGIN
  SELECT array_agg(id) INTO v_60d FROM public.supplier_documents
  WHERE status = 'accepted' AND expires_at IS NOT NULL
    AND expires_at >= CURRENT_DATE AND expires_at <= CURRENT_DATE + INTERVAL '2 months'
    AND accreditation_id IS NOT NULL AND supplier_product_id IS NULL
    AND notified_60d_at IS NULL;

  SELECT array_agg(id) INTO v_30d FROM public.supplier_documents
  WHERE status = 'accepted' AND expires_at IS NOT NULL
    AND expires_at >= CURRENT_DATE AND expires_at <= CURRENT_DATE + INTERVAL '1 month'
    AND accreditation_id IS NOT NULL AND supplier_product_id IS NULL
    AND notified_30d_at IS NULL;

  SELECT array_agg(id) INTO v_15d FROM public.supplier_documents
  WHERE status = 'accepted' AND expires_at IS NOT NULL
    AND expires_at >= CURRENT_DATE AND expires_at <= CURRENT_DATE + 15
    AND accreditation_id IS NOT NULL AND supplier_product_id IS NULL
    AND notified_15d_at IS NULL;

  SELECT array_agg(id) INTO v_0d FROM public.supplier_documents
  WHERE status = 'accepted' AND expires_at IS NOT NULL
    AND expires_at = CURRENT_DATE
    AND accreditation_id IS NOT NULL AND supplier_product_id IS NULL
    AND notified_0d_at IS NULL;

  -- ── 2 months ────────────────────────────────────────────────────────────
  IF v_60d IS NOT NULL AND array_length(v_60d, 1) IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, type, document_type, document_id, action_url, read)
    SELECT sd.supplier_id, 'Accreditation Document Expiring in 2 Months',
      'Your document "' || sd.file_name || '" expires on ' || to_char(sd.expires_at, 'Mon DD, YYYY') || '. Please prepare a renewal.',
      'action_required', 'ACCREDITATION_DOCUMENT', sd.id, '/supplier/accreditation', false
    FROM public.supplier_documents sd WHERE sd.id = ANY(v_60d);

    INSERT INTO public.notifications (user_id, title, body, type, document_type, document_id, action_url, read)
    SELECT pr.id, 'Supplier Document Expiring in 2 Months',
      sup.full_name || '''s document "' || sd.file_name || '" expires on ' || to_char(sd.expires_at, 'Mon DD, YYYY') || '.',
      'action_required', 'ACCREDITATION_DOCUMENT', sd.id, '/accreditation/' || sd.accreditation_id, false
    FROM public.supplier_documents sd
    JOIN public.profiles sup ON sup.id = sd.supplier_id
    CROSS JOIN LATERAL (
      SELECT p.id FROM public.profiles p JOIN public.roles r ON r.id = p.role_id
      WHERE r.name = 'procurement' AND p.active = true
    ) pr
    WHERE sd.id = ANY(v_60d);

    UPDATE public.supplier_documents SET notified_60d_at = now() WHERE id = ANY(v_60d);
  END IF;

  -- ── 1 month ─────────────────────────────────────────────────────────────
  IF v_30d IS NOT NULL AND array_length(v_30d, 1) IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, type, document_type, document_id, action_url, read)
    SELECT sd.supplier_id, 'Accreditation Document Expiring in 1 Month',
      'Your document "' || sd.file_name || '" expires on ' || to_char(sd.expires_at, 'Mon DD, YYYY') || '. Please prepare a renewal.',
      'action_required', 'ACCREDITATION_DOCUMENT', sd.id, '/supplier/accreditation', false
    FROM public.supplier_documents sd WHERE sd.id = ANY(v_30d);

    INSERT INTO public.notifications (user_id, title, body, type, document_type, document_id, action_url, read)
    SELECT pr.id, 'Supplier Document Expiring in 1 Month',
      sup.full_name || '''s document "' || sd.file_name || '" expires on ' || to_char(sd.expires_at, 'Mon DD, YYYY') || '.',
      'action_required', 'ACCREDITATION_DOCUMENT', sd.id, '/accreditation/' || sd.accreditation_id, false
    FROM public.supplier_documents sd
    JOIN public.profiles sup ON sup.id = sd.supplier_id
    CROSS JOIN LATERAL (
      SELECT p.id FROM public.profiles p JOIN public.roles r ON r.id = p.role_id
      WHERE r.name = 'procurement' AND p.active = true
    ) pr
    WHERE sd.id = ANY(v_30d);

    UPDATE public.supplier_documents SET notified_30d_at = now() WHERE id = ANY(v_30d);
  END IF;

  -- ── 15 days ─────────────────────────────────────────────────────────────
  IF v_15d IS NOT NULL AND array_length(v_15d, 1) IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, type, document_type, document_id, action_url, read)
    SELECT sd.supplier_id, 'Accreditation Document Expiring in 15 Days',
      'Your document "' || sd.file_name || '" expires on ' || to_char(sd.expires_at, 'Mon DD, YYYY') || '. Please prepare a renewal.',
      'action_required', 'ACCREDITATION_DOCUMENT', sd.id, '/supplier/accreditation', false
    FROM public.supplier_documents sd WHERE sd.id = ANY(v_15d);

    INSERT INTO public.notifications (user_id, title, body, type, document_type, document_id, action_url, read)
    SELECT pr.id, 'Supplier Document Expiring in 15 Days',
      sup.full_name || '''s document "' || sd.file_name || '" expires on ' || to_char(sd.expires_at, 'Mon DD, YYYY') || '.',
      'action_required', 'ACCREDITATION_DOCUMENT', sd.id, '/accreditation/' || sd.accreditation_id, false
    FROM public.supplier_documents sd
    JOIN public.profiles sup ON sup.id = sd.supplier_id
    CROSS JOIN LATERAL (
      SELECT p.id FROM public.profiles p JOIN public.roles r ON r.id = p.role_id
      WHERE r.name = 'procurement' AND p.active = true
    ) pr
    WHERE sd.id = ANY(v_15d);

    UPDATE public.supplier_documents SET notified_15d_at = now() WHERE id = ANY(v_15d);
  END IF;

  -- ── Day of expiration ───────────────────────────────────────────────────
  IF v_0d IS NOT NULL AND array_length(v_0d, 1) IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, type, document_type, document_id, action_url, read)
    SELECT sd.supplier_id, 'Accreditation Document Expires Today',
      'Your document "' || sd.file_name || '" expires today. Please prepare a renewal immediately.',
      'action_required', 'ACCREDITATION_DOCUMENT', sd.id, '/supplier/accreditation', false
    FROM public.supplier_documents sd WHERE sd.id = ANY(v_0d);

    INSERT INTO public.notifications (user_id, title, body, type, document_type, document_id, action_url, read)
    SELECT pr.id, 'Supplier Document Expires Today',
      sup.full_name || '''s document "' || sd.file_name || '" expires today.',
      'action_required', 'ACCREDITATION_DOCUMENT', sd.id, '/accreditation/' || sd.accreditation_id, false
    FROM public.supplier_documents sd
    JOIN public.profiles sup ON sup.id = sd.supplier_id
    CROSS JOIN LATERAL (
      SELECT p.id FROM public.profiles p JOIN public.roles r ON r.id = p.role_id
      WHERE r.name = 'procurement' AND p.active = true
    ) pr
    WHERE sd.id = ANY(v_0d);

    UPDATE public.supplier_documents SET notified_0d_at = now() WHERE id = ANY(v_0d);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_accreditation_documents_near_expiry() FROM PUBLIC;
