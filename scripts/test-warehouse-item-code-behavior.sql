-- Legacy override baseline only; current acceptance uses the direct-migration runner.
\set ON_ERROR_STOP on
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',md5('warehouse'),false);
SELECT wic_test.assert((SELECT effective_code='001-ORIGINAL' AND correction_id IS NULL
 FROM public.get_warehouse_item_codes(md5('validation1')::uuid)), 'original fallback');
SELECT wic_test.assert((SELECT effective_code='001-Mixed.Code  A'
 FROM public.update_warehouse_item_code(md5('line1')::uuid,'001-ORIGINAL',' 001-Mixed.Code  A ')),
 'normalization preserves formatting');
SELECT wic_test.assert((SELECT effective_code='001-Mixed.Code  A'
 FROM public.get_warehouse_item_codes(md5('validation1')::uuid)), 'persisted reload');
SELECT wic_test.assert((SELECT item_code='001-ORIGINAL' FROM public.pr1_items
 WHERE id=md5('item1')::uuid),'original PR1 preserved');
SELECT wic_test.assert((SELECT item_code='001-ORIGINAL' FROM public.warehouse_validation_items
 WHERE id=md5('line1')::uuid),'seeded validation preserved');
SELECT * FROM public.update_warehouse_item_code(md5('line1')::uuid,'001-Mixed.Code  A','001-Mixed.Code  A');
SELECT wic_test.expect_error($q$SELECT * FROM public.update_warehouse_item_code(md5('line1')::uuid,'stale','bad')$q$,'40001');
SELECT * FROM public.update_warehouse_item_code(md5('line1')::uuid,'001-Mixed.Code  A','  ');
SELECT wic_test.assert((SELECT effective_code='' FROM public.get_warehouse_item_codes(md5('validation1')::uuid)), 'blank stays blank');
SELECT wic_test.expect_error($q$SELECT * FROM public.update_warehouse_item_code(md5('line1')::uuid,'',null)$q$,'22004');
SELECT wic_test.expect_error($q$SELECT nextval('public.warehouse_item_code_corrections_id_seq')$q$,'42501');
SELECT wic_test.expect_error($q$INSERT INTO public.warehouse_item_code_corrections DEFAULT VALUES$q$,'42501');
SELECT wic_test.expect_error($q$UPDATE public.warehouse_item_code_corrections SET new_code='forged'$q$,'42501');
SELECT wic_test.expect_error($q$DELETE FROM public.warehouse_item_code_corrections$q$,'42501');
SELECT wic_test.expect_error($q$SELECT public.wic_lock_pr1(md5('pr11')::uuid)$q$,'42501');
SELECT wic_test.assert((SELECT count(*)=0 FROM public.warehouse_item_code_corrections),'warehouse cannot read raw history');
DO $$ DECLARE actor text; BEGIN
 FOREACH actor IN ARRAY ARRAY['admin','employee','procurement','approver','supplier','inactive'] LOOP
  PERFORM set_config('request.jwt.claim.sub',md5(actor),false);
  PERFORM wic_test.expect_error($q$SELECT * FROM public.update_warehouse_item_code(md5('line1')::uuid,'','forbidden')$q$,'42501');
 END LOOP;
END $$;
SELECT set_config('request.jwt.claim.sub',md5('employee'),false);
SELECT wic_test.expect_error($q$SELECT * FROM public.get_warehouse_item_codes(md5('validation1')::uuid)$q$,'42501');
SELECT set_config('request.jwt.claim.sub',md5('admin'),false);
SELECT wic_test.assert((SELECT count(*)=2 FROM public.warehouse_item_code_corrections),'no-op and stale produce no extra event');
SELECT wic_test.assert((SELECT bool_and(actor_id=md5('warehouse')::uuid AND actor_name_snapshot='warehouse')
 FROM public.warehouse_item_code_corrections),'actor is database-derived');
RESET ROLE;
SET ROLE anon;
SELECT wic_test.expect_error($q$SELECT * FROM public.get_warehouse_item_codes(md5('validation1')::uuid)$q$,'42501');
SELECT wic_test.expect_error($q$SELECT * FROM public.update_warehouse_item_code(md5('line1')::uuid,'','forbidden')$q$,'42501');
RESET ROLE;
-- Stage, decision, raw-material, wrong-parent and current-PR2 boundaries.
UPDATE public.pr1_requests SET status='resolved_internal' WHERE id=md5('pr12')::uuid;
UPDATE public.warehouse_validations SET decision='rejected' WHERE id=md5('validation3')::uuid;
UPDATE public.pr1_requests SET request_type='raw_material' WHERE id=md5('pr14')::uuid;
INSERT INTO public.pr2_requests(id,pr1_id) VALUES(md5('draft5')::uuid,md5('pr15')::uuid);
UPDATE public.warehouse_validation_items SET pr1_item_id=md5('item7')::uuid WHERE id=md5('line6')::uuid;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',md5('warehouse'),false);
DO $$ DECLARE n integer; BEGIN
 FOR n IN 2..5 LOOP
  PERFORM wic_test.expect_error(format('SELECT * FROM public.update_warehouse_item_code(%L::uuid,%L,%L)',md5('line'||n),'001-ORIGINAL','bad'),'55000');
 END LOOP;
END $$;
SELECT wic_test.expect_error($q$SELECT * FROM public.update_warehouse_item_code(md5('line6')::uuid,'001-ORIGINAL','bad')$q$,'P0001');
SELECT wic_test.expect_error($q$SELECT * FROM public.update_warehouse_item_code(md5('missing')::uuid,'','bad')$q$,'P0001');
RESET ROLE;
-- Corrected and uncorrected insert paths, including intentional blank.
INSERT INTO public.pr2_requests(id,pr1_id) VALUES(md5('pr2-one')::uuid,md5('pr11')::uuid);
INSERT INTO public.pr2_items(id,pr2_id,pr1_item_id,item_code)
 VALUES(md5('pr2-line-one')::uuid,md5('pr2-one')::uuid,md5('item1')::uuid,'client-forged');
SELECT wic_test.assert((SELECT item_code='' FROM public.pr2_items WHERE id=md5('pr2-line-one')::uuid),'insert guard uses trusted blank');
SELECT wic_test.assert((SELECT item_code='' AND validation_id=md5('validation1')::uuid
 FROM public.warehouse_item_code_pr2_snapshots WHERE pr2_item_id=md5('pr2-line-one')::uuid),'provenance stored atomically');
INSERT INTO public.pr2_requests(id,pr1_id) VALUES(md5('pr2-eight')::uuid,md5('pr18')::uuid);
INSERT INTO public.pr2_items(id,pr2_id,pr1_item_id,item_code)
 VALUES(md5('pr2-line-eight')::uuid,md5('pr2-eight')::uuid,md5('item8')::uuid,'legacy-code');
SELECT wic_test.assert((SELECT item_code='legacy-code' FROM public.pr2_items WHERE id=md5('pr2-line-eight')::uuid),'uncorrected legacy unchanged');
INSERT INTO public.pr2_requests(id,request_type) VALUES(md5('native')::uuid,'raw_material');
INSERT INTO public.pr2_items(id,pr2_id,item_code) VALUES(md5('native-line')::uuid,md5('native')::uuid,'native-code');
SELECT wic_test.assert((SELECT item_code='native-code' FROM public.pr2_items WHERE id=md5('native-line')::uuid),'native unchanged');
-- Deleted validation history survives and new validation starts clean.
DELETE FROM public.warehouse_validations WHERE id=md5('validation1')::uuid;
SELECT wic_test.assert((SELECT count(*)=2 FROM public.warehouse_item_code_corrections),'history survives validation cascade');
SELECT wic_test.assert((SELECT count(*)=1 FROM public.warehouse_item_code_pr2_snapshots),'snapshot survives reset');
DELETE FROM public.pr2_items WHERE id=md5('pr2-line-one')::uuid;
DELETE FROM public.pr2_requests WHERE id=md5('pr2-one')::uuid;
INSERT INTO public.warehouse_validations(id,pr1_id) VALUES(md5('replacement')::uuid,md5('pr11')::uuid);
INSERT INTO public.warehouse_validation_items(id,validation_id,pr1_item_id,item_code)
 VALUES(md5('replacement-line')::uuid,md5('replacement')::uuid,md5('item1')::uuid,'001-ORIGINAL');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',md5('warehouse'),false);
SELECT wic_test.assert((SELECT effective_code='001-ORIGINAL' AND correction_id IS NULL
 FROM public.get_warehouse_item_codes(md5('replacement')::uuid)), 'replacement validation starts clean');
RESET ROLE;
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',md5('warehouse'),true);
SELECT * FROM public.update_warehouse_item_code(md5('line9')::uuid,'001-ORIGINAL','rolled-back');
ROLLBACK;
SELECT wic_test.assert(NOT EXISTS(SELECT 1 FROM public.warehouse_item_code_corrections
 WHERE pr1_id=md5('pr19')::uuid),'rollback leaves no event');
SELECT 'behavior suite passed' AS result;
