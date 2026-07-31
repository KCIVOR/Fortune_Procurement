-- Heal active PR2 records
UPDATE public.pr2_requests pr2
SET request_type = pr1.request_type
FROM public.pr1_requests pr1
WHERE pr2.pr1_id = pr1.id
  AND pr2.request_type <> pr1.request_type;

-- Heal archived PR2 records
UPDATE public.pr2_requests_archive pr2a
SET request_type = pr1.request_type
FROM public.pr1_requests pr1
WHERE pr2a.pr1_id = pr1.id
  AND pr2a.request_type <> pr1.request_type;
