-- Legacy override baseline only; current acceptance uses the direct-migration runner.
\set ON_ERROR_STOP on
SELECT wic_test.assert((SELECT count(*)=3 AND bool_and(relrowsecurity)
 FROM pg_class WHERE oid IN('public.warehouse_item_code_corrections'::regclass,
 'public.warehouse_item_code_pr2_context'::regclass,'public.warehouse_item_code_pr2_snapshots'::regclass)),'all feature tables have RLS');
SELECT wic_test.assert(NOT has_function_privilege('anon','public.update_warehouse_item_code(uuid,text,text)','EXECUTE'),'anon cannot execute save');
SELECT wic_test.assert(NOT has_function_privilege('authenticated','public.wic_snapshot_pr2_code()','EXECUTE'),'clients cannot execute trigger helpers');
SELECT wic_test.assert(NOT has_table_privilege('authenticated','public.warehouse_item_code_pr2_snapshots','INSERT'),'clients cannot forge snapshots');
SELECT wic_test.assert(NOT has_table_privilege('authenticated','public.warehouse_item_code_pr2_context','INSERT'),'clients cannot forge context');
-- Client PATCH of the seeded code is not authoritative correction provenance.
UPDATE public.warehouse_validation_items SET item_code='PATCH-FORGED' WHERE id=md5('line31')::uuid;
UPDATE public.pr1_requests SET request_type='services' WHERE id=md5('pr132')::uuid;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',md5('warehouse'),false);
INSERT INTO public.audit_logs(payload) VALUES(jsonb_build_object('validation_item_id',md5('line31')::uuid,'new_code','AUDIT-FORGED'));
SELECT wic_test.assert((SELECT effective_code='001-ORIGINAL' FROM public.get_warehouse_item_codes(md5('validation31')::uuid)),'seeded PATCH ignored');
SELECT wic_test.assert((SELECT correction_id IS NULL FROM public.get_warehouse_item_codes(md5('validation31')::uuid)),'forged general audit cannot establish provenance');
SELECT * FROM public.update_warehouse_item_code(md5('line32')::uuid,'001-ORIGINAL','SERVICE-CODE');
SELECT wic_test.assert((SELECT effective_code='SERVICE-CODE' FROM public.get_warehouse_item_codes(md5('validation32')::uuid)),'services supported');
SELECT wic_test.assert((SELECT correction_id IS NULL FROM public.update_warehouse_item_code(md5('line33')::uuid,'001-ORIGINAL','001-ORIGINAL')),'initial no-op creates no event');
SELECT * FROM public.update_warehouse_item_code(md5('line34')::uuid,'001-ORIGINAL','DUPLICATE');
SELECT * FROM public.update_warehouse_item_code(md5('line35')::uuid,'001-ORIGINAL','DUPLICATE');
SELECT * FROM public.update_warehouse_item_code(md5('line36')::uuid,'001-ORIGINAL','OLD-LIFECYCLE');
SELECT * FROM public.update_warehouse_item_code(md5('line37')::uuid,'001-ORIGINAL','ATOMIC-CODE');
RESET ROLE;
INSERT INTO public.pr2_requests(id,pr1_id) VALUES(md5('context36')::uuid,md5('pr136')::uuid);
DELETE FROM public.warehouse_validations WHERE id=md5('validation36')::uuid;
INSERT INTO public.warehouse_validations(id,pr1_id) VALUES(md5('new36')::uuid,md5('pr136')::uuid);
INSERT INTO public.warehouse_validation_items(id,validation_id,pr1_item_id,item_code)
 VALUES(md5('new-line36')::uuid,md5('new36')::uuid,md5('item36')::uuid,'001-ORIGINAL');
SELECT wic_test.expect_error($q$INSERT INTO public.pr2_items(id,pr2_id,pr1_item_id,item_code)
 VALUES(md5('stale36')::uuid,md5('context36')::uuid,md5('item36')::uuid,'bad')$q$,'P0001');
INSERT INTO public.pr2_requests(id,pr1_id) VALUES(md5('atomic37')::uuid,md5('pr137')::uuid);
SELECT wic_test.expect_error($q$INSERT INTO public.pr2_items(id,pr2_id,pr1_item_id,item_code)
 VALUES(md5('atomic-line37')::uuid,md5('atomic37')::uuid,md5('item37')::uuid,'bad'),
 (md5('invalid-line37')::uuid,md5('atomic37')::uuid,md5('nonexistent-item')::uuid,'bad')$q$,'23503');
SELECT wic_test.assert(NOT EXISTS(SELECT 1 FROM public.pr2_items WHERE pr2_id=md5('atomic37')::uuid),'failed item batch rolls back items');
SELECT wic_test.assert(NOT EXISTS(SELECT 1 FROM public.warehouse_item_code_pr2_snapshots WHERE pr2_id=md5('atomic37')::uuid),'failed item batch rolls back mappings');
SELECT 'extra provenance and atomicity suite passed' AS result;
