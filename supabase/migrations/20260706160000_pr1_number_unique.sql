/*
  # PR1 number uniqueness — root-cause fix for duplicate PR1-2026-0019

  1. Problem
    Two pr1_requests rows shared the number PR1-2026-0019. Root cause: the number
    generator (fetchSuggestedPR1Sequence) and duplicate check (checkPR1NumberExists)
    run client-side under the caller's RLS — an employee only sees their OWN PR1s, so
    the "next available" computation and the duplicate check are both blind to other
    users' rows. There was also no DB-level unique constraint as a backstop, so the
    blind check let the duplicate through. Downstream, joins by pr1_number text
    (GRN/delivery request_type resolution) silently misresolved.

  2. Fix (three parts)
    a. Renumber the older duplicate (9a107673, 'Mendoza Electrical Supply', still
       pending_approval, no downstream RFQ/PR2/PO) to the next free 2026 number.
       The newer row (cb29feb7, Juan Dela Cruz) keeps PR1-2026-0019 since it is
       already deep in canvassing with downstream documents referencing the number.
    b. UNIQUE constraint on pr1_number — hard guarantee no future duplicate can be
       inserted regardless of app-code bugs or races.
    c. SECURITY DEFINER helpers (same pattern as request_type_for_*):
       - next_pr1_sequence(p_year)     → next free 4-digit suffix across ALL rows
       - pr1_number_exists(p_number, p_exclude_id) → duplicate check across ALL rows
       Client code switches to these RPCs so RLS can no longer blind the generator.

  3. Security
    - Helpers expose only: the max sequence number per year, and a boolean existence
      check. No row data leaks past RLS.
*/

-- ─── a. Renumber the older duplicate ─────────────────────────────────────────

DO $$
DECLARE
  v_next text;
  v_old  text;
BEGIN
  SELECT pr1_number INTO v_old
  FROM public.pr1_requests
  WHERE id = '9a107673-7012-4c73-98ff-4c87305067a7';

  -- Only act if the duplicate still exists as expected
  IF v_old = 'PR1-2026-0019' THEN
    SELECT 'PR1-2026-' || lpad(
      (coalesce(max((regexp_match(pr1_number, '^PR1-2026-(\d+)', 'i'))[1]::int), 0) + 1)::text,
      4, '0'
    )
    INTO v_next
    FROM public.pr1_requests
    WHERE pr1_number ~* '^PR1-2026-\d+';

    UPDATE public.pr1_requests
    SET pr1_number = v_next, updated_at = now()
    WHERE id = '9a107673-7012-4c73-98ff-4c87305067a7';

    INSERT INTO public.audit_logs (action, document_type, document_id, payload)
    VALUES (
      'PR1_RENUMBERED',
      'PR1',
      '9a107673-7012-4c73-98ff-4c87305067a7',
      jsonb_build_object(
        'from', v_old,
        'to', v_next,
        'reason', 'duplicate pr1_number resolution (Rev data-integrity fix)'
      )
    );
  END IF;
END $$;

-- ─── b. Unique constraint (hard backstop) ────────────────────────────────────

ALTER TABLE public.pr1_requests
  ADD CONSTRAINT pr1_requests_pr1_number_key UNIQUE (pr1_number);

-- ─── c. RLS-blind helpers for generation + duplicate check ───────────────────

CREATE OR REPLACE FUNCTION public.next_pr1_sequence(p_year int)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lpad(
    (coalesce(
      max((regexp_match(pr1_number, '^PR1-' || p_year::text || '-(\d+)', 'i'))[1]::int),
      0
    ) + 1)::text,
    4, '0'
  )
  FROM public.pr1_requests
  WHERE pr1_number ~* ('^PR1-' || p_year::text || '-\d+');
$$;

CREATE OR REPLACE FUNCTION public.pr1_number_exists(p_number text, p_exclude_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pr1_requests
    WHERE lower(pr1_number) = lower(trim(p_number))
      AND (p_exclude_id IS NULL OR id <> p_exclude_id)
  );
$$;
