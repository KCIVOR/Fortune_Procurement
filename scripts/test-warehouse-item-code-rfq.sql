-- Legacy override baseline only; current acceptance uses the direct-migration runner.
\set ON_ERROR_STOP on
-- Synthetic RFQs refer to actual trigger-generated live and archived snapshots.
INSERT INTO public.rfq_batches(id,pr1_id,pr2_id) VALUES
 (md5('rfq-live')::uuid,md5('pr138')::uuid,md5('rfq-header')::uuid),
 (md5('rfq-archive')::uuid,md5('pr129')::uuid,md5('archive29')::uuid),
 (md5('rfq-legacy')::uuid,md5('pr138')::uuid,null),
 (md5('rfq-other')::uuid,md5('pr139')::uuid,null),
 (md5('rfq-mismatch')::uuid,md5('pr139')::uuid,md5('rfq-header')::uuid),
 (md5('rfq-unassigned')::uuid,md5('pr138')::uuid,md5('rfq-header')::uuid);
INSERT INTO public.rfq_suppliers(id,rfq_id,supplier_id) VALUES
 (md5('slot-live')::uuid,md5('rfq-live')::uuid,md5('supplier')::uuid),
 (md5('slot-archive')::uuid,md5('rfq-archive')::uuid,md5('supplier')::uuid);
-- JWT suite has already recorded a deliberately blank correction on line 38.
INSERT INTO public.pr2_requests(id,pr1_id) VALUES(md5('rfq-header')::uuid,md5('pr138')::uuid);
INSERT INTO public.pr2_items(id,pr2_id,pr1_item_id,item_code)
 VALUES(md5('rfq-line')::uuid,md5('rfq-header')::uuid,md5('item38')::uuid,'ignored');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',md5('procurement'),false);
SELECT wic_test.assert((SELECT count(*)=1 AND min(item_code)='' FROM public.get_rfq_warehouse_item_code_snapshots(md5('rfq-live')::uuid)), 'live RFQ gets exact blank snapshot');
SELECT wic_test.assert((SELECT count(*)=0 FROM public.get_rfq_warehouse_item_code_snapshots(md5('rfq-legacy')::uuid)), 'legacy unlinked RFQ never borrows current PR2');
SELECT wic_test.assert((SELECT item_code='ARCHIVE-CODE' FROM public.get_rfq_warehouse_item_code_snapshots(md5('rfq-archive')::uuid)), 'archive remains readable after validation reset');
SELECT wic_test.expect_error($q$SELECT * FROM public.get_rfq_warehouse_item_code_snapshots(md5('rfq-mismatch')::uuid)$q$,'55000');
SELECT set_config('request.jwt.claim.sub',md5('supplier'),false);
SELECT wic_test.assert((SELECT count(*)=1 FROM public.get_rfq_warehouse_item_code_snapshots(md5('rfq-live')::uuid)), 'exact assigned supplier allowed');
SELECT wic_test.assert((SELECT count(*)=1 FROM public.get_rfq_warehouse_item_code_snapshots(md5('rfq-archive')::uuid)), 'exact archived assignment allowed');
SELECT wic_test.expect_error($q$SELECT * FROM public.get_rfq_warehouse_item_code_snapshots(md5('rfq-unassigned')::uuid)$q$,'42501');
SELECT set_config('request.jwt.claim.sub',md5('employee'),false);
SELECT wic_test.assert((SELECT count(*)=1 FROM public.get_rfq_warehouse_item_code_snapshots(md5('rfq-live')::uuid)), 'owning requestor allowed without general history access');
SELECT set_config('request.jwt.claim.sub',md5('other-employee'),false);
SELECT wic_test.expect_error($q$SELECT * FROM public.get_rfq_warehouse_item_code_snapshots(md5('rfq-live')::uuid)$q$,'42501');
SELECT set_config('request.jwt.claim.sub',md5('inactive'),false);
SELECT wic_test.expect_error($q$SELECT * FROM public.get_rfq_warehouse_item_code_snapshots(md5('rfq-live')::uuid)$q$,'42501');
SELECT set_config('request.jwt.claim.sub',md5('admin'),false);
SELECT wic_test.expect_error($q$SELECT * FROM public.get_rfq_warehouse_item_code_snapshots(md5('rfq-live')::uuid)$q$,'42501');
SELECT set_config('request.jwt.claim.sub',md5('approver'),false);
SELECT wic_test.expect_error($q$SELECT * FROM public.get_rfq_warehouse_item_code_snapshots(md5('rfq-live')::uuid)$q$,'42501');
RESET ROLE;
INSERT INTO wic_test.document_access VALUES(md5('approver')::uuid,md5('pr138')::uuid);
SET ROLE authenticated;
SELECT wic_test.assert((SELECT count(*)=1 FROM public.get_rfq_warehouse_item_code_snapshots(md5('rfq-live')::uuid)), 'staff require existing document access');
RESET ROLE;
-- A new validation lifecycle cannot contaminate the explicitly linked old archive.
BEGIN;
UPDATE public.pr1_requests SET requisitioner_id=md5('supplier')::uuid WHERE id=md5('pr138')::uuid;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',md5('supplier'),true);
SELECT wic_test.expect_error($q$SELECT * FROM public.get_rfq_warehouse_item_code_snapshots(md5('rfq-unassigned')::uuid)$q$,'42501');
ROLLBACK;
INSERT INTO public.warehouse_validations(id,pr1_id,decision) VALUES(md5('new-validation29')::uuid,md5('pr129')::uuid,null);
INSERT INTO public.warehouse_validation_items(id,validation_id,pr1_item_id,item_code)
 VALUES(md5('new-line29')::uuid,md5('new-validation29')::uuid,md5('item29')::uuid,'001-ORIGINAL');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',md5('warehouse'),false);
SELECT * FROM public.update_warehouse_item_code(md5('new-line29')::uuid,'001-ORIGINAL','NEW-LIFECYCLE');
SELECT wic_test.assert((SELECT item_code='ARCHIVE-CODE' FROM public.get_rfq_warehouse_item_code_snapshots(md5('rfq-archive')::uuid)), 'old RFQ ignores new current validation correction');
SELECT wic_test.expect_error($q$SELECT * FROM public.get_rfq_warehouse_item_code_snapshots(md5('missing-rfq')::uuid)$q$,'42501');
RESET ROLE;
INSERT INTO public.pr2_requests(id,pr1_id) VALUES(md5('legacy-header')::uuid,md5('pr139')::uuid);
INSERT INTO public.pr2_requests(id,pr1_id,request_type) VALUES(md5('native-header')::uuid,null,'raw_material');
INSERT INTO public.rfq_batches(id,pr1_id,pr2_id) VALUES
 (md5('rfq-linked-legacy')::uuid,md5('pr139')::uuid,md5('legacy-header')::uuid),
 (md5('rfq-native')::uuid,null,md5('native-header')::uuid);
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',md5('procurement'),false);
SELECT wic_test.assert((SELECT count(*)=0 FROM public.get_rfq_warehouse_item_code_snapshots(md5('rfq-linked-legacy')::uuid)), 'uncorrected linked history remains unchanged');
SELECT wic_test.assert((SELECT count(*)=0 FROM public.get_rfq_warehouse_item_code_snapshots(md5('rfq-native')::uuid)), 'native path never overlays warehouse codes');
RESET ROLE;
-- Never hide provenance corruption by returning an empty successful map.
BEGIN;
UPDATE public.pr2_items SET item_code='tampered' WHERE id=md5('rfq-line')::uuid;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',md5('procurement'),true);
SELECT wic_test.expect_error($q$SELECT * FROM public.get_rfq_warehouse_item_code_snapshots(md5('rfq-live')::uuid)$q$,'55000');
ROLLBACK;
BEGIN;
UPDATE public.warehouse_item_code_pr2_context SET pr1_id=md5('pr139')::uuid WHERE pr2_id=md5('rfq-header')::uuid;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',md5('procurement'),true);
SELECT wic_test.expect_error($q$SELECT * FROM public.get_rfq_warehouse_item_code_snapshots(md5('rfq-live')::uuid)$q$,'55000');
ROLLBACK;
BEGIN;
DELETE FROM public.warehouse_item_code_pr2_snapshots WHERE pr2_item_id=md5('rfq-line')::uuid;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',md5('procurement'),true);
SELECT wic_test.expect_error($q$SELECT * FROM public.get_rfq_warehouse_item_code_snapshots(md5('rfq-live')::uuid)$q$,'55000');
ROLLBACK;
BEGIN;
UPDATE public.pr2_items_archive SET item_code='tampered archive' WHERE id=md5('archive-line29')::uuid;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',md5('procurement'),true);
SELECT wic_test.expect_error($q$SELECT * FROM public.get_rfq_warehouse_item_code_snapshots(md5('rfq-archive')::uuid)$q$,'55000');
ROLLBACK;
SELECT wic_test.assert(NOT has_function_privilege('anon','public.get_rfq_warehouse_item_code_snapshots(uuid)','EXECUTE'),'anonymous cannot execute RFQ reader');
SELECT 'RFQ snapshot role/association/archive suite passed' AS result;
