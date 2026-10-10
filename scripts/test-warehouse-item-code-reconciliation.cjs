// User-authorized cancellation transition, disposable loopback fixtures ONLY.
const {execFileSync}=require('node:child_process');
const {readFileSync,readdirSync}=require('node:fs');
const {resolve}=require('node:path');
const assert=require('node:assert/strict');
const psql=resolve('scratch/warehouse-item-code-db/runtime/pgsql/bin/psql.exe');
const prefix=`wic_test_cancel_${Date.now()}`;
const args=['-X','-h','127.0.0.1','-p','55439','-U','wic_test_owner','-v','ON_ERROR_STOP=1'];
const sql=(q,db)=>execFileSync(psql,[...args,'-d',db,'-At','-c',q],{encoding:'utf8',windowsHide:true,timeout:20000,stdio:['ignore','pipe','pipe']}).trim();
const migration=readFileSync(resolve('supabase/migrations',readdirSync(resolve('supabase/migrations')).find(x=>x.endsWith('_warehouse_item_code_direct_edit_fix.sql'))),'utf8');
function setup(db){
 sql(`CREATE DATABASE ${db}`,'postgres');
 for(const p of ['scripts/test-warehouse-item-code-fixture.sql','scripts/test-warehouse-item-code-archive-fixture.sql','scripts/test-warehouse-item-code-direct-live-functions.sql','supabase/migrations/20261010034723_warehouse_item_code_corrections.sql'])sql(readFileSync(resolve(p),'utf8'),db);
 sql(`UPDATE public.pr1_items SET description='Demo Item' WHERE id=md5('item1')::uuid;
 UPDATE public.pr1_requests SET pr1_number='PR1-2026-0077' WHERE id=md5('pr11')::uuid;
 UPDATE public.pr1_items SET item_code='' WHERE id=md5('item1')::uuid;
 UPDATE public.warehouse_validation_items SET item_code='' WHERE id=md5('line1')::uuid;
 UPDATE public.profiles SET full_name='Pedro Santos' WHERE id=md5('warehouse')::uuid;
 SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub',md5('warehouse'),false);
 SELECT * FROM public.update_warehouse_item_code(md5('line1')::uuid,'','Demo Code'); RESET ROLE;
 UPDATE public.warehouse_item_code_corrections SET created_at='2026-10-10 04:47:45.345796+00';
 CREATE TABLE wic_test.before_pr1 AS SELECT to_jsonb(p) row FROM public.pr1_items p;
 CREATE TABLE wic_test.before_validation AS SELECT to_jsonb(p) row FROM public.warehouse_validation_items p;
 CREATE TABLE wic_test.before_audit AS SELECT to_jsonb(c) row FROM public.warehouse_item_code_corrections c;`,db);
}
const positive=`${prefix}_ok`;setup(positive);
if(process.argv.includes('--red')){
 assert.throws(()=>sql(migration,positive),e=>/requires reviewed reconciliation/.test(String(e.stderr)));
 console.log('RED: reviewed migration refuses saved Demo Code; cancellation transition is not implemented');process.exit(0);
}
sql(migration,positive);
sql(`SELECT wic_test.assert(NOT EXISTS((SELECT to_jsonb(p) FROM public.pr1_items p EXCEPT SELECT row FROM wic_test.before_pr1) UNION ALL (SELECT row FROM wic_test.before_pr1 EXCEPT SELECT to_jsonb(p) FROM public.pr1_items p)),'operational PR1 data changed');
 SELECT wic_test.assert(NOT EXISTS((SELECT to_jsonb(p) FROM public.warehouse_validation_items p EXCEPT SELECT row FROM wic_test.before_validation) UNION ALL (SELECT row FROM wic_test.before_validation EXCEPT SELECT to_jsonb(p) FROM public.warehouse_validation_items p)),'operational validation data changed');
 SELECT wic_test.assert((SELECT to_jsonb(c)-'transition_resolution'-'transition_resolved_at'=(SELECT row FROM wic_test.before_audit) AND transition_resolution='cancelled_override_keep_current' AND transition_resolved_at IS NOT NULL FROM public.warehouse_item_code_corrections c),'audit erased or changed');
 SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub',md5('warehouse'),false);
 SELECT wic_test.assert((SELECT original_pr1_code='' AND effective_code='' AND correction_id IS NULL FROM public.get_warehouse_item_codes(md5('validation1')::uuid)),'cancelled override still effective');
 SELECT * FROM public.update_warehouse_item_code(md5('line1')::uuid,'','REAL-DIRECT'); RESET ROLE;
 SELECT wic_test.assert((SELECT item_code='REAL-DIRECT' FROM public.pr1_items WHERE id=md5('item1')::uuid),'next edit did not update existing item');`,positive);
console.log(`PASS: cancellation preserves all operational rows and original audit; current code blank; next edit direct (${positive})`);
const mutations=[
 "UPDATE public.warehouse_item_code_corrections SET new_code='SOMETHING ELSE'",
 "UPDATE public.pr1_requests SET pr1_number='OTHER' WHERE id=md5('pr11')::uuid",
 "INSERT INTO public.pr2_requests(id,pr1_id) VALUES(md5('newheader')::uuid,md5('pr11')::uuid)",
 "INSERT INTO public.rfq_batches VALUES(md5('newrfq')::uuid,md5('pr11')::uuid,null)",
 "UPDATE public.warehouse_validation_items SET item_code='CHANGED' WHERE id=md5('line1')::uuid",
 "SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub',md5('warehouse'),false); SELECT * FROM public.update_warehouse_item_code(md5('line2')::uuid,'001-ORIGINAL','EXTRA')",
];
for(let i=0;i<mutations.length;i++){
 const db=`${prefix}_deny${i}`;setup(db);sql(mutations[i],db);
 assert.throws(()=>sql(migration,db),e=>/requires reviewed reconciliation/.test(String(e.stderr)));
 assert.equal(sql("SELECT to_regclass('public.warehouse_item_code_write_permits') IS NULL",db),'t');
 assert.equal(sql("SELECT count(*) FROM information_schema.columns WHERE table_name='warehouse_item_code_corrections' AND column_name='transition_resolution'",db),'0');
 console.log(`PASS: changed transition candidate ${i} refused atomically`);
}
console.log('RESULT: 7 reconciliation groups passed');
