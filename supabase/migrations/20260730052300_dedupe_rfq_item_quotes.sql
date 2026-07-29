/*
  # Deduplicate rfq_item_quotes for PR2-Native Items

  Deletes legacy duplicate rfq_item_quotes rows where pr1_item_id was set
  to a pr2_items UUID prior to the parameter routing fix.
*/

DELETE FROM public.rfq_item_quotes q1
USING public.rfq_item_quotes q2
WHERE q1.rfq_supplier_id = q2.rfq_supplier_id
  AND q1.pr1_item_id IS NOT NULL
  AND q2.pr2_item_id = q1.pr1_item_id
  AND q1.id <> q2.id;
