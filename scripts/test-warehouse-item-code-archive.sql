-- Legacy override baseline only; current acceptance uses the direct-migration runner.
\set ON_ERROR_STOP on
-- Execute the actual deployed reset/unwind definitions against synthetic rows.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',md5('warehouse'),false);
SELECT * FROM public.update_warehouse_item_code(md5('line28')::uuid,'001-ORIGINAL','RESET-CODE');
SELECT * FROM public.update_warehouse_item_code(md5('line29')::uuid,'001-ORIGINAL','ARCHIVE-CODE');
SELECT * FROM public.update_warehouse_item_code(md5('line30')::uuid,'001-ORIGINAL','TERMINAL-CODE');
RESET ROLE;
UPDATE public.pr1_requests SET status='revision_requested' WHERE id=md5('pr128')::uuid;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',md5('employee'),false);
SELECT public.reset_warehouse_validation_on_pr1_resubmit(md5('pr128')::uuid);
RESET ROLE;
SELECT wic_test.assert(NOT EXISTS(SELECT 1 FROM public.warehouse_validations WHERE id=md5('validation28')::uuid),'actual reset removes validation');
SELECT wic_test.assert(EXISTS(SELECT 1 FROM public.warehouse_item_code_corrections WHERE pr1_id=md5('pr128')::uuid),'actual reset preserves history');
INSERT INTO public.pr2_requests(id,pr1_id,assigned_buyer_name_snapshot)
 VALUES(md5('archive29')::uuid,md5('pr129')::uuid,'Synthetic Buyer'),
 (md5('archive30')::uuid,md5('pr130')::uuid,'Synthetic Buyer');
INSERT INTO public.pr2_items(id,pr2_id,pr1_item_id,item_code)
 VALUES(md5('archive-line29')::uuid,md5('archive29')::uuid,md5('item29')::uuid,'ignored'),
 (md5('archive-line30')::uuid,md5('archive30')::uuid,md5('item30')::uuid,'ignored');
UPDATE public.pr1_requests SET status='pr2_pending_approval' WHERE id IN(md5('pr129')::uuid,md5('pr130')::uuid);
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',md5('approver'),false);
SELECT public.unwind_pr2_to_warehouse(md5('pr129')::uuid,false);
SELECT public.unwind_pr2_to_warehouse(md5('pr130')::uuid,true);
RESET ROLE;
SELECT wic_test.assert((SELECT item_code='ARCHIVE-CODE' FROM public.pr2_items_archive
 WHERE id=md5('archive-line29')::uuid),'actual unwind archives correction');
SELECT wic_test.assert((SELECT assigned_buyer_name_snapshot='Synthetic Buyer' FROM public.pr2_requests_archive
 WHERE id=md5('archive29')::uuid),'actual unwind preserves buyer snapshot');
SELECT wic_test.assert((SELECT status='approved_for_warehouse' FROM public.pr1_requests WHERE id=md5('pr129')::uuid),'revision unwind retains routing');
SELECT wic_test.assert((SELECT status='rejected' FROM public.pr1_requests WHERE id=md5('pr130')::uuid),'terminal unwind retains routing');
SELECT wic_test.assert(NOT EXISTS(SELECT 1 FROM public.warehouse_validations WHERE id=md5('validation29')::uuid),'revision unwind deletes validation');
SELECT wic_test.assert(EXISTS(SELECT 1 FROM public.warehouse_validations WHERE id=md5('validation30')::uuid),'terminal unwind retains validation');
SELECT wic_test.assert((SELECT count(*)=2 FROM public.warehouse_item_code_pr2_snapshots
 WHERE pr2_id IN(md5('archive29')::uuid,md5('archive30')::uuid)),'actual unwind preserves mappings');
SELECT 'actual reset and unwind suite passed' AS result;
