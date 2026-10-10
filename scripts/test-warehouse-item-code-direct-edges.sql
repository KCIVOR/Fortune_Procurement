-- Isolated direct-edit database only. Every synthetic mutation is rolled back.
BEGIN;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',md5('warehouse'),true);
SELECT wic_test.expect_error($q$SELECT * FROM public.update_warehouse_item_code(md5('line1')::uuid,'001-ORIGINAL',null)$q$,'22004');
RESET ROLE;
DELETE FROM public.warehouse_validations WHERE id=md5('validation1')::uuid;
INSERT INTO public.warehouse_validations VALUES(md5('replacement-validation')::uuid,md5('pr11')::uuid,null);
INSERT INTO public.warehouse_validation_items(id,validation_id,pr1_item_id,item_code)
 VALUES(md5('replacement-line')::uuid,md5('replacement-validation')::uuid,md5('item1')::uuid,'001-ORIGINAL');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',md5('warehouse'),true);
SELECT wic_test.expect_error($q$SELECT * FROM public.update_warehouse_item_code(md5('line1')::uuid,'001-ORIGINAL','STALE-VALIDATION')$q$,'55000');
SELECT * FROM public.update_warehouse_item_code(md5('replacement-line')::uuid,'001-ORIGINAL','REPLACEMENT');
RESET ROLE;
SELECT wic_test.assert((SELECT item_code='REPLACEMENT' FROM public.pr1_items WHERE id=md5('item1')::uuid),'replacement failed to edit same PR1 item');
ROLLBACK;

BEGIN;
-- Match the verified production FK action only within this rolled-back test.
ALTER TABLE public.pr1_items DROP CONSTRAINT pr1_items_pr1_id_fkey;
ALTER TABLE public.pr1_items ADD CONSTRAINT pr1_items_pr1_id_fkey FOREIGN KEY(pr1_id) REFERENCES public.pr1_requests(id) ON DELETE CASCADE;
UPDATE public.pr1_requests SET status='revision_requested' WHERE id=md5('pr11')::uuid;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',md5('employee'),true);
SELECT public.reset_warehouse_validation_on_pr1_resubmit(md5('pr11')::uuid);
RESET ROLE;
DELETE FROM public.pr1_requests WHERE id=md5('pr11')::uuid;
SELECT wic_test.assert((SELECT count(*)=0 FROM public.pr1_items WHERE id=md5('item1')::uuid),'permitted PR1 cascade blocked');
SELECT wic_test.assert((SELECT count(*)=0 FROM public.warehouse_item_code_write_permits),'permit leaked');
ROLLBACK;
