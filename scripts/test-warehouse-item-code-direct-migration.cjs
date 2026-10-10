// Disposable loopback-only regression runner. Never reads application environment files.
const {execFileSync,spawn}=require('node:child_process');
const {readFileSync,readdirSync}=require('node:fs');
const {resolve}=require('node:path');
const assert=require('node:assert/strict');
const psql=resolve('scratch/warehouse-item-code-db/runtime/pgsql/bin/psql.exe');
const db=`wic_test_direct_${Date.now()}`;
const args=['-X','-h','127.0.0.1','-p','55439','-U','wic_test_owner','-v','ON_ERROR_STOP=1'];
const sql=(q,d=db)=>execFileSync(psql,[...args,'-d',d,'-At','-c',q],{encoding:'utf8',windowsHide:true,timeout:20000,stdio:['ignore','pipe','pipe']}).trim();
const file=p=>sql(readFileSync(resolve(p),'utf8'));
const actor=a=>`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub',md5('${a}'),false);`;
const save=(n,expected='001-ORIGINAL',next='DIRECT')=>`${actor('warehouse')} SELECT * FROM public.update_warehouse_item_code(md5('line${n}')::uuid,'${expected}','${next}');`;
let passed=0,failed=0;
function check(name,body){try{body();passed++;console.log(`PASS: ${name}`);}catch(e){failed++;console.error(`FAIL: ${name}\n${e.stderr||e.message}`);}}
function tx(q){sql(`BEGIN; ${q} ROLLBACK;`);}
function session(q,name,{hold=false}={}){
 const child=spawn(psql,[...args,'-d',db,...(hold?['-At']:['-c',q])],{windowsHide:true,env:{...process.env,PGAPPNAME:name}});
 let out='';child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>out+=x);
 const done=new Promise((yes,no)=>{const timer=setTimeout(()=>{child.kill();no(Error('session timeout'));},18000);child.on('error',no);child.on('close',code=>{clearTimeout(timer);yes({code,out});});});
 if(hold)child.stdin.write(`BEGIN; ${q} SELECT 'WIC_HELD';\n`);
 done.ready=()=>out.includes('WIC_HELD');
 done.release=ending=>child.stdin.end(`${ending};\n`);
 return done;
}
async function ordered(a,b,name,{rollback=false,wait=true}={}){
 const first=session(a,name,{hold:true});
 const end=Date.now()+8000;
 while(!first.ready()){
  assert.ok(Date.now()<end,'first session not ready');await new Promise(r=>setTimeout(r,20));
 }
 const second=session(b,`${name}_second`);
 let observed=false;
 if(wait)while(Date.now()<end){
  observed=sql(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity s JOIN pg_stat_activity f ON f.pid=ANY(pg_blocking_pids(s.pid)) WHERE s.application_name='${name}_second' AND f.application_name='${name}' AND s.wait_event_type='Lock')`)==='t';
  if(observed)break;
  await new Promise(r=>setTimeout(r,20));
 }
 first.release(rollback?'ROLLBACK':'COMMIT');
 const result=await Promise.all([first,second]);assert.equal(result[0].code,0,result[0].out);
 if(wait)assert.ok(observed,`No actual second-session lock wait observed: ${name}`);
 return result[1];
}
async function main(){
 assert.equal(sql('SELECT current_user','postgres'),'wic_test_owner');sql(`CREATE DATABASE ${db}`,'postgres');
 file('scripts/test-warehouse-item-code-fixture.sql');file('scripts/test-warehouse-item-code-archive-fixture.sql');file('scripts/test-warehouse-item-code-direct-live-functions.sql');file('supabase/migrations/20261010034723_warehouse_item_code_corrections.sql');
 sql(`ALTER TABLE public.pr1_items ADD COLUMN IF NOT EXISTS description text DEFAULT 'unchanged';
 ALTER TABLE public.warehouse_validation_items ADD COLUMN item_notes text DEFAULT 'keep notes';
 GRANT UPDATE ON public.pr1_items,public.warehouse_validation_items TO authenticated;
 ALTER TABLE public.pr1_items ENABLE ROW LEVEL SECURITY;
 CREATE POLICY direct_read ON public.pr1_items FOR SELECT TO authenticated USING(true);
 CREATE POLICY direct_owner ON public.pr1_items FOR UPDATE TO authenticated USING(EXISTS(SELECT 1 FROM public.pr1_requests r WHERE r.id=pr1_id AND r.requisitioner_id=auth.uid())) WITH CHECK(EXISTS(SELECT 1 FROM public.pr1_requests r WHERE r.id=pr1_id AND r.requisitioner_id=auth.uid()));
 ALTER TABLE public.warehouse_validation_items ENABLE ROW LEVEL SECURITY;
 CREATE POLICY direct_line_read ON public.warehouse_validation_items FOR SELECT TO authenticated USING(true);
 CREATE POLICY direct_line_write ON public.warehouse_validation_items FOR UPDATE TO authenticated USING(public.is_role('warehouse')) WITH CHECK(public.is_role('warehouse'));`);
 if(!process.argv.includes('--baseline')){
  const files=readdirSync(resolve('supabase/migrations')).filter(x=>x.endsWith('_warehouse_item_code_direct_edit_fix.sql'));assert.equal(files.length,1);file(`supabase/migrations/${files[0]}`);
 }
 check('same existing items change atomically; unrelated fields and counts unchanged',()=>tx(`CREATE TEMP TABLE before_items AS SELECT id,to_jsonb(p)-'item_code' row FROM public.pr1_items p;
 CREATE TEMP TABLE before_lines AS SELECT id,to_jsonb(p)-'item_code' row FROM public.warehouse_validation_items p;
 ${save(1)} RESET ROLE;
 SELECT wic_test.assert((SELECT item_code='DIRECT' FROM public.pr1_items WHERE id=md5('item1')::uuid),'Existing PR1 code was not updated');
 SELECT wic_test.assert((SELECT item_code='DIRECT' FROM public.warehouse_validation_items WHERE id=md5('line1')::uuid),'Existing validation code was not updated');
 SELECT wic_test.assert(NOT EXISTS((SELECT id,to_jsonb(p)-'item_code' FROM public.pr1_items p EXCEPT SELECT * FROM before_items) UNION ALL (SELECT * FROM before_items EXCEPT SELECT id,to_jsonb(p)-'item_code' FROM public.pr1_items p)),'unrelated PR1 change');
 SELECT wic_test.assert(NOT EXISTS((SELECT id,to_jsonb(p)-'item_code' FROM public.warehouse_validation_items p EXCEPT SELECT * FROM before_lines) UNION ALL (SELECT * FROM before_lines EXCEPT SELECT id,to_jsonb(p)-'item_code' FROM public.warehouse_validation_items p)),'unrelated validation change');`));
 check('submitted owner code PATCH blocked, ordinary description update preserved',()=>tx(`${actor('employee')} SELECT wic_test.expect_error($q$UPDATE public.pr1_items SET item_code='BYPASS' WHERE id=md5('item1')::uuid$q$,'42501'); UPDATE public.pr1_items SET description='allowed' WHERE id=md5('item1')::uuid;`));
 check('warehouse copy PATCH blocked, notes update preserved',()=>tx(`${actor('warehouse')} SELECT wic_test.expect_error($q$UPDATE public.warehouse_validation_items SET item_code='BYPASS' WHERE id=md5('line1')::uuid$q$,'42501'); UPDATE public.warehouse_validation_items SET item_notes='allowed' WHERE id=md5('line1')::uuid;`));
 check('RFQ immutable code survives direct edit and PR2 relink',()=>tx(`INSERT INTO public.rfq_batches VALUES(md5('rfq1')::uuid,md5('pr11')::uuid,null); ${save(1)} RESET ROLE;
 INSERT INTO public.pr2_requests_archive(id,pr1_id) VALUES(md5('a1')::uuid,md5('pr11')::uuid);
 INSERT INTO public.pr2_items_archive(id,pr2_id,pr1_item_id,item_code) VALUES(md5('ai1')::uuid,md5('a1')::uuid,md5('item1')::uuid,'OTHER');
 UPDATE public.rfq_batches SET pr2_id=md5('a1')::uuid WHERE id=md5('rfq1')::uuid;
 ${actor('warehouse')} SELECT wic_test.assert((SELECT item_code='001-ORIGINAL' FROM public.get_rfq_warehouse_item_code_snapshots(md5('rfq1')::uuid) WHERE pr1_item_id=md5('item1')::uuid),'RFQ history changed or missing');`));
 if(process.argv.includes('--baseline')){console.log(`RED baseline: ${failed} failed, ${passed} passed; ${db}`);assert.equal(failed,4);return;}
 sql(`INSERT INTO public.pr1_requests(id,status,request_type) SELECT md5('pr1'||n)::uuid,'approved_for_warehouse','goods' FROM generate_series(41,200) n;
 INSERT INTO public.pr1_items(id,pr1_id,item_code) SELECT md5('item'||n)::uuid,md5('pr1'||n)::uuid,'001-ORIGINAL' FROM generate_series(41,200) n;
 INSERT INTO public.warehouse_validations SELECT md5('validation'||n)::uuid,md5('pr1'||n)::uuid,null FROM generate_series(41,200) n;
 INSERT INTO public.warehouse_validation_items(id,validation_id,pr1_item_id,item_code) SELECT md5('line'||n)::uuid,md5('validation'||n)::uuid,md5('item'||n)::uuid,'001-ORIGINAL' FROM generate_series(41,200) n;`);
 check('format, long and duplicate codes have no invented catalog constraints',()=>tx(`${save(1,'001-ORIGINAL','  000-Mixed. Code/Ab  ')} ${save(2,'001-ORIGINAL','000-Mixed. Code/Ab')} RESET ROLE;
 SELECT wic_test.assert((SELECT count(*)=2 FROM public.pr1_items WHERE item_code='000-Mixed. Code/Ab'),'duplicate/format changed');
 ${actor('warehouse')} SELECT * FROM public.update_warehouse_item_code(md5('line3')::uuid,'001-ORIGINAL',repeat('Z',12000)); RESET ROLE;
 SELECT wic_test.assert((SELECT length(item_code)=12000 FROM public.pr1_items WHERE id=md5('item3')::uuid),'length truncated');`));
 check('second edit/noop/blank and stale expected value',()=>tx(`${save(1)} ${save(1,'DIRECT','DIRECT')} SELECT wic_test.expect_error($q$SELECT * FROM public.update_warehouse_item_code(md5('line1')::uuid,'001-ORIGINAL','BAD')$q$,'40001'); ${save(1,'DIRECT','   ')} RESET ROLE;
 SELECT wic_test.assert((SELECT count(*)=2 FROM public.warehouse_item_code_corrections),'noop audit or missing audit'); SELECT wic_test.assert((SELECT item_code='' FROM public.pr1_items WHERE id=md5('item1')::uuid),'blank not preserved'); SELECT wic_test.assert((SELECT count(*)=0 FROM public.warehouse_item_code_write_permits),'permit leaked');`));
 check('read returns persisted current code, not audit override',()=>tx(`${save(1)} SELECT wic_test.assert((SELECT original_pr1_code='DIRECT' AND effective_code='DIRECT' FROM public.get_warehouse_item_codes(md5('validation1')::uuid)),'current read stale');`));
 check('roles, inactive, anonymous and null inputs denied',()=>{
  for(const a of ['employee','admin','procurement','approver','supplier','inactive'])tx(`${actor(a)} SELECT wic_test.expect_error($q$SELECT * FROM public.update_warehouse_item_code(md5('line1')::uuid,'001-ORIGINAL','BAD')$q$,'42501');`);
  tx(`SET ROLE anon; SELECT wic_test.expect_error($q$SELECT * FROM public.update_warehouse_item_code(md5('line1')::uuid,'001-ORIGINAL','BAD')$q$,'42501');`);
  tx(`${actor('warehouse')} SELECT wic_test.expect_error($q$SELECT * FROM public.update_warehouse_item_code(md5('line1')::uuid,null,'BAD')$q$,'22004');`);
 });
 check('draft/revision requester code editing after normal reset remains allowed',()=>tx(`UPDATE public.pr1_requests SET status='revision_requested' WHERE id=md5('pr11')::uuid; ${actor('employee')} SELECT public.reset_warehouse_validation_on_pr1_resubmit(md5('pr11')::uuid); UPDATE public.pr1_items SET item_code='REQUESTER' WHERE id=md5('item1')::uuid; RESET ROLE; SELECT wic_test.assert((SELECT item_code='REQUESTER' FROM public.pr1_items WHERE id=md5('item1')::uuid),'requester blocked');`));
 check('PR2 insert replaces stale browser code only for warehouse validation path',()=>tx(`${save(1)} RESET ROLE; INSERT INTO public.pr2_requests(id,pr1_id) VALUES(md5('h1')::uuid,md5('pr11')::uuid); INSERT INTO public.pr2_items(id,pr2_id,pr1_item_id,item_code) VALUES(md5('d1')::uuid,md5('h1')::uuid,md5('item1')::uuid,'STALE'); SELECT wic_test.assert((SELECT item_code='DIRECT' FROM public.pr2_items WHERE id=md5('d1')::uuid),'stale PR2 code'); INSERT INTO public.pr2_requests(id,request_type) VALUES(md5('native')::uuid,'goods'); INSERT INTO public.pr2_items(id,pr2_id,item_code) VALUES(md5('nativeitem')::uuid,md5('native')::uuid,'NATIVE'); SELECT wic_test.assert((SELECT item_code='NATIVE' FROM public.pr2_items WHERE id=md5('nativeitem')::uuid),'native changed');`));
 check('non-Goods/Services PR1 code not rewritten by warehouse PR2 trigger',()=>tx(`UPDATE public.pr1_requests SET request_type='raw_materials' WHERE id=md5('pr11')::uuid; INSERT INTO public.pr2_requests(id,pr1_id) VALUES(md5('outside')::uuid,md5('pr11')::uuid); INSERT INTO public.pr2_items(id,pr2_id,pr1_item_id,item_code) VALUES(md5('outsideitem')::uuid,md5('outside')::uuid,md5('item1')::uuid,'KEEP'); SELECT wic_test.assert((SELECT item_code='KEEP' FROM public.pr2_items WHERE id=md5('outsideitem')::uuid),'outside warehouse path changed');`));
 check('failure after PR1 update rolls back code, snapshot and permit',()=>{
  sql(`CREATE FUNCTION wic_test.fail_copy() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced copy failure' USING ERRCODE='P0001'; END $$; CREATE TRIGGER z_fail_copy BEFORE UPDATE OF item_code ON public.warehouse_validation_items FOR EACH ROW EXECUTE FUNCTION wic_test.fail_copy();`);
  tx(`INSERT INTO public.rfq_batches VALUES(md5('rollbackrfq')::uuid,md5('pr11')::uuid,null); DELETE FROM public.warehouse_item_code_rfq_history WHERE rfq_id=md5('rollbackrfq')::uuid;
    ${actor('warehouse')} SELECT wic_test.expect_error($q$SELECT * FROM public.update_warehouse_item_code(md5('line1')::uuid,'001-ORIGINAL','BAD')$q$,'P0001'); RESET ROLE;
    SELECT wic_test.assert((SELECT item_code='001-ORIGINAL' FROM public.pr1_items WHERE id=md5('item1')::uuid),'PR1 rollback failed');
    SELECT wic_test.assert((SELECT count(*)=0 FROM public.warehouse_item_code_write_permits),'permit rollback failed');
    SELECT wic_test.assert((SELECT count(*)=0 FROM public.warehouse_item_code_rfq_history),'snapshot rollback failed');`);
  sql('DROP TRIGGER z_fail_copy ON public.warehouse_validation_items;');
 });
 check('audit failure rolls back both updates and history/permit inserts',()=>{
  sql(`CREATE FUNCTION wic_test.fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced audit failure' USING ERRCODE='P0001'; END $$; CREATE TRIGGER fail_audit BEFORE INSERT ON public.warehouse_item_code_corrections FOR EACH ROW EXECUTE FUNCTION wic_test.fail_audit();`);
  tx(`${actor('warehouse')} SELECT wic_test.expect_error($q$SELECT * FROM public.update_warehouse_item_code(md5('line1')::uuid,'001-ORIGINAL','BAD')$q$,'P0001'); RESET ROLE; SELECT wic_test.assert((SELECT item_code='001-ORIGINAL' FROM public.pr1_items WHERE id=md5('item1')::uuid),'PR1 rollback failed'); SELECT wic_test.assert((SELECT item_code='001-ORIGINAL' FROM public.warehouse_validation_items WHERE id=md5('line1')::uuid),'copy rollback failed'); SELECT wic_test.assert((SELECT count(*)=0 FROM public.warehouse_item_code_write_permits),'permit rollback failed');`);sql('DROP TRIGGER fail_audit ON public.warehouse_item_code_corrections;');
 });
 check('permit/history cannot be forged, internal functions not executable',()=>tx(`${actor('warehouse')} SELECT set_config('warehouse.item_code_authorized','true',true); SELECT wic_test.expect_error($q$UPDATE public.warehouse_validation_items SET item_code='FORGED' WHERE id=md5('line1')::uuid$q$,'42501'); SELECT wic_test.expect_error($q$INSERT INTO public.warehouse_item_code_write_permits VALUES(pg_backend_pid(),pg_current_xact_id(),md5('item1')::uuid,md5('line1')::uuid)$q$,'42501'); RESET ROLE; SELECT wic_test.assert(NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'wic_%' AND (has_function_privilege('authenticated',p.oid,'EXECUTE') OR has_function_privilege('anon',p.oid,'EXECUTE'))),'internal EXECUTE leaked');`));
 check('lifecycle, type, decision and missing item restrictions',()=>{
  for(const mutation of ["UPDATE public.pr1_requests SET status='draft' WHERE id=md5('pr11')::uuid", "UPDATE public.pr1_requests SET request_type='raw_materials' WHERE id=md5('pr11')::uuid", "UPDATE public.warehouse_validations SET decision='rejected' WHERE id=md5('validation1')::uuid", "DELETE FROM public.warehouse_validation_items WHERE id=md5('line1')::uuid"])
   tx(`${mutation}; ${actor('warehouse')} SELECT wic_test.expect_error($q$SELECT * FROM public.update_warehouse_item_code(md5('line1')::uuid,'001-ORIGINAL','BAD')$q$,'55000');`);
 });
 check('RFQ exact live/archive mapping, missing-line capture and explicit ambiguity errors',()=>tx(`
 INSERT INTO public.pr2_requests_archive(id,pr1_id) VALUES(md5('a2')::uuid,md5('pr12')::uuid);
 INSERT INTO public.pr2_items_archive(id,pr2_id,pr1_item_id,item_code) VALUES(md5('ai2')::uuid,md5('a2')::uuid,md5('item2')::uuid,'ARCHIVED');
 INSERT INTO public.rfq_batches VALUES(md5('rfq2')::uuid,md5('pr12')::uuid,md5('a2')::uuid);
 ${save(2)} SELECT wic_test.assert((SELECT item_code='ARCHIVED' FROM public.get_rfq_warehouse_item_code_snapshots(md5('rfq2')::uuid)),'archive source changed'); RESET ROLE;
 INSERT INTO public.pr2_requests_archive(id,pr1_id) VALUES(md5('a3')::uuid,md5('pr13')::uuid);
 INSERT INTO public.rfq_batches VALUES(md5('rfq3')::uuid,md5('pr13')::uuid,md5('a3')::uuid);
 ${save(3)} SELECT wic_test.assert((SELECT item_code='001-ORIGINAL' FROM public.get_rfq_warehouse_item_code_snapshots(md5('rfq3')::uuid)),'missing PR2 line not frozen'); RESET ROLE;
 DELETE FROM public.warehouse_item_code_rfq_history WHERE rfq_id=md5('rfq3')::uuid;
 ${actor('warehouse')} SELECT wic_test.expect_error($q$SELECT * FROM public.get_rfq_warehouse_item_code_snapshots(md5('rfq3')::uuid)$q$,'55000'); RESET ROLE;
 SELECT wic_test.expect_error($q$INSERT INTO public.rfq_batches VALUES(md5('wrong')::uuid,md5('pr13')::uuid,md5('a2')::uuid)$q$,'55000');
 INSERT INTO public.pr2_items_archive(id,pr2_id,pr1_item_id,item_code) VALUES(md5('duplicate')::uuid,md5('a2')::uuid,md5('item2')::uuid,'DUP');
 ${actor('warehouse')} SELECT wic_test.expect_error($q$SELECT * FROM public.get_rfq_warehouse_item_code_snapshots(md5('rfq2')::uuid)$q$,'55000');`));
 check('exact RFQ supplier assignment and owner/staff authorization retained',()=>tx(`INSERT INTO public.rfq_batches VALUES(md5('accessrfq')::uuid,md5('pr11')::uuid,null); INSERT INTO public.rfq_suppliers VALUES(md5('assignment')::uuid,md5('accessrfq')::uuid,md5('supplier')::uuid);
 ${actor('supplier')} SELECT wic_test.assert((SELECT count(*)=1 FROM public.get_rfq_warehouse_item_code_snapshots(md5('accessrfq')::uuid)),'assigned supplier denied');
 ${actor('other-employee')} SELECT wic_test.expect_error($q$SELECT * FROM public.get_rfq_warehouse_item_code_snapshots(md5('accessrfq')::uuid)$q$,'42501');
 ${actor('employee')} SELECT * FROM public.get_rfq_warehouse_item_code_snapshots(md5('accessrfq')::uuid);
 ${actor('admin')} SELECT wic_test.expect_error($q$SELECT * FROM public.get_rfq_warehouse_item_code_snapshots(md5('accessrfq')::uuid)$q$,'42501');
 ${actor('inactive')} SELECT wic_test.expect_error($q$SELECT * FROM public.get_rfq_warehouse_item_code_snapshots(md5('accessrfq')::uuid)$q$,'42501');`));
 check('protected RFQ cannot silently become native and discard history',()=>tx(`INSERT INTO public.rfq_batches VALUES(md5('nativeflip')::uuid,md5('pr11')::uuid,null); UPDATE public.rfq_batches SET pr1_id=null WHERE id=md5('nativeflip')::uuid; ${actor('warehouse')} SELECT wic_test.expect_error($q$SELECT * FROM public.get_rfq_warehouse_item_code_snapshots(md5('nativeflip')::uuid)$q$,'55000');`));
 check('actual unwind archives current code and reset preserves same PR1 item',()=>tx(`${save(1)} RESET ROLE;
 INSERT INTO public.pr2_requests(id,pr1_id) VALUES(md5('unwindheader')::uuid,md5('pr11')::uuid);
 INSERT INTO public.pr2_items(id,pr2_id,pr1_item_id,item_code) VALUES(md5('unwindline')::uuid,md5('unwindheader')::uuid,md5('item1')::uuid,'STALE');
 UPDATE public.pr1_requests SET status='pr2_pending_approval' WHERE id=md5('pr11')::uuid;
 ${actor('approver')} SELECT public.unwind_pr2_to_warehouse(md5('pr11')::uuid,false); RESET ROLE;
 SELECT wic_test.assert((SELECT item_code='DIRECT' FROM public.pr2_items_archive WHERE id=md5('unwindline')::uuid),'unwind lost code');
 SELECT wic_test.assert((SELECT item_code='DIRECT' FROM public.pr1_items WHERE id=md5('item1')::uuid),'unwind changed PR1');
 SELECT wic_test.assert((SELECT count(*)=0 FROM public.warehouse_validations WHERE pr1_id=md5('pr11')::uuid),'unwind did not reset');`));
 check('new protected tables RLS/grants and fixed search paths',()=>tx(`SELECT wic_test.assert((SELECT bool_and(relrowsecurity) FROM pg_class WHERE oid IN ('public.warehouse_item_code_rfq_history'::regclass,'public.warehouse_item_code_write_permits'::regclass)),'RLS missing');
 SELECT wic_test.assert(NOT has_table_privilege('authenticated','public.warehouse_item_code_write_permits','SELECT,INSERT,UPDATE,DELETE'),'permit ACL');
 SELECT wic_test.assert(NOT has_table_privilege('anon','public.warehouse_item_code_rfq_history','SELECT,INSERT,UPDATE,DELETE'),'history ACL');
 SELECT wic_test.assert(NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND (p.proname LIKE 'wic_%' OR p.proname IN ('update_warehouse_item_code','get_warehouse_item_codes','get_rfq_warehouse_item_code_snapshots')) AND NOT (coalesce(p.proconfig,ARRAY[]::text[]) @> ARRAY['search_path=""'])),'mutable feature search path');`));
 let n=10;
 for(const boundary of ['header','status','decision','delete','reset'])for(const first of ['save','boundary']){
  const actions={header:`INSERT INTO public.pr2_requests(id,pr1_id) VALUES(md5('h${n}')::uuid,md5('pr1${n}')::uuid);`,status:`UPDATE public.pr1_requests SET status='resolved_internal' WHERE id=md5('pr1${n}')::uuid;`,decision:`UPDATE public.warehouse_validations SET decision='rejected' WHERE id=md5('validation${n}')::uuid;`,delete:`DELETE FROM public.warehouse_validations WHERE id=md5('validation${n}')::uuid;`,reset:`UPDATE public.pr1_requests SET status='revision_requested' WHERE id=md5('pr1${n}')::uuid; ${actor('employee')} SELECT public.reset_warehouse_validation_on_pr1_resubmit(md5('pr1${n}')::uuid);`};
  const b=actions[boundary];const r=await ordered(first==='save'?save(n):b,first==='save'?b:save(n),`phase2_${n}`);assert.equal(r.code===0,first==='save',r.out);passed++;console.log(`PASS: ${boundary} ${first}-first serialization`);n++;
 }
 for(const first of ['save','rfq']){const q=`INSERT INTO public.rfq_batches VALUES(md5('rfq${n}')::uuid,md5('pr1${n}')::uuid,null);`;const r=await ordered(first==='save'?save(n):q,first==='save'?q:save(n),`phase2_rfq_${n}`);assert.equal(r.code,0,r.out);assert.equal(sql(`${actor('warehouse')} SELECT item_code FROM public.get_rfq_warehouse_item_code_snapshots(md5('rfq${n}')::uuid)` ).split('\n').at(-1),first==='save'?'DIRECT':'001-ORIGINAL');passed++;console.log(`PASS: RFQ ${first}-first snapshot`);n++;}
 const stale=await ordered(save(22),save(22),'phase2_stale');assert.notEqual(stale.code,0);assert.match(stale.out,/Item code changed/);passed++;
 sql(`GRANT INSERT ON public.pr1_items TO authenticated;
 CREATE POLICY direct_owner_insert ON public.pr1_items FOR INSERT TO authenticated WITH CHECK(EXISTS(SELECT 1 FROM public.pr1_requests r WHERE r.id=pr1_id AND r.requisitioner_id=auth.uid()));`);
 check('requester reset then existing-item upsert works; submitted PR1 deletion remains restricted',()=>{
  tx(`UPDATE public.pr1_requests SET status='revision_requested' WHERE id=md5('pr11')::uuid; ${actor('employee')} SELECT public.reset_warehouse_validation_on_pr1_resubmit(md5('pr11')::uuid);
   INSERT INTO public.pr1_items(id,pr1_id,item_code,description) VALUES(md5('item1')::uuid,md5('pr11')::uuid,'REQUESTER-UPSERT','REQUESTER DESCRIPTION') ON CONFLICT(id) DO UPDATE SET item_code=excluded.item_code,description=excluded.description;
   RESET ROLE; SELECT wic_test.assert((SELECT item_code='REQUESTER-UPSERT' AND description='REQUESTER DESCRIPTION' FROM public.pr1_items WHERE id=md5('item1')::uuid),'requester upsert broken');`);
  tx(`SELECT wic_test.expect_error($q$DELETE FROM public.pr1_requests WHERE id=md5('pr11')::uuid$q$,'23503'); SELECT wic_test.assert((SELECT count(*)=1 FROM public.pr1_items WHERE id=md5('item1')::uuid),'restricted deletion lost item');`);
 });
 n=41;
 for(const boundary of ['header','internal','rejection','revision','reset','cascade','line-delete','notes','owner-upsert'])for(const first of ['save','boundary'])for(const rollback of [false,true]){
  const actions={
   header:`INSERT INTO public.pr2_requests(id,pr1_id) VALUES(md5('h${n}')::uuid,md5('pr1${n}')::uuid);`,
   internal:`UPDATE public.pr1_requests SET status='resolved_internal' WHERE id=md5('pr1${n}')::uuid;`,
   rejection:`UPDATE public.warehouse_validations SET decision='rejected' WHERE id=md5('validation${n}')::uuid;`,
   revision:`UPDATE public.pr1_requests SET status='revision_requested' WHERE id=md5('pr1${n}')::uuid;`,
   reset:`UPDATE public.pr1_requests SET status='revision_requested' WHERE id=md5('pr1${n}')::uuid; ${actor('employee')} SELECT public.reset_warehouse_validation_on_pr1_resubmit(md5('pr1${n}')::uuid);`,
   cascade:`DELETE FROM public.warehouse_validations WHERE id=md5('validation${n}')::uuid;`,
   'line-delete':`DELETE FROM public.warehouse_validation_items WHERE id=md5('line${n}')::uuid;`,
   notes:`${actor('warehouse')} UPDATE public.warehouse_validation_items SET item_notes='CONCURRENT NOTES' WHERE id=md5('line${n}')::uuid;`,
   'owner-upsert':`${actor('employee')} INSERT INTO public.pr1_items(id,pr1_id,item_code,description) VALUES(md5('item${n}')::uuid,md5('pr1${n}')::uuid,'001-ORIGINAL','UPSERT DESCRIPTION') ON CONFLICT(id) DO UPDATE SET item_code=excluded.item_code,description=excluded.description;`,
  };
  // Child-only deletion takes no advisory lock: save sees the committed row,
  // blocks on its conditional UPDATE, then rejects removal or succeeds on rollback.
  const r=await ordered(first==='save'?save(n):actions[boundary],first==='save'?actions[boundary]:save(n),`phase4_${n}`,{rollback});
  const denied=first==='boundary'&&!rollback&&!['notes','owner-upsert'].includes(boundary) || first==='save'&&!rollback&&boundary==='owner-upsert';
  assert.equal(r.code===0,!denied,r.out);
  if(denied)assert.match(r.out,/no longer available|replaced or removed|changed or was removed|checked warehouse save|Item code changed/);
  const saved=first==='save'?!rollback:!denied;
  assert.equal(sql(`SELECT item_code FROM public.pr1_items WHERE id=md5('item${n}')::uuid`),saved?'DIRECT':'001-ORIGINAL');
  assert.equal(sql(`SELECT count(*) FROM public.warehouse_item_code_corrections WHERE pr1_id=md5('pr1${n}')::uuid`),saved?'1':'0');
  if(boundary==='notes')assert.equal(sql(`SELECT item_notes FROM public.warehouse_validation_items WHERE id=md5('line${n}')::uuid`),first==='boundary'&&rollback?'keep notes':'CONCURRENT NOTES');
  passed++;console.log(`PASS: observed-lock ${boundary} ${first}-first ${rollback?'rollback':'commit'}`);n++;
 }
 for(const rollback of [false,true]){
  const r=await ordered(save(n),save(n,'001-ORIGINAL','SECOND'),`phase4_two_saves_${n}`,{rollback});
  assert.equal(r.code===0,rollback,r.out);
  assert.equal(sql(`SELECT item_code FROM public.pr1_items WHERE id=md5('item${n}')::uuid`),rollback?'SECOND':'DIRECT');
  passed++;console.log(`PASS: observed-lock save/save ${rollback?'rollback':'commit'}`);n++;
 }
 for(const boundary of ['pr2-line','unwind'])for(const first of ['save','boundary'])for(const rollback of [false,true]){
  sql(`INSERT INTO public.pr2_requests(id,pr1_id) VALUES(md5('h${n}')::uuid,md5('pr1${n}')::uuid);`);
  if(boundary==='unwind')sql(`INSERT INTO public.pr2_items(id,pr2_id,pr1_item_id,item_code) VALUES(md5('p2i${n}')::uuid,md5('h${n}')::uuid,md5('item${n}')::uuid,'001-ORIGINAL'); UPDATE public.pr1_requests SET status='pr2_pending_approval' WHERE id=md5('pr1${n}')::uuid;`);
  const b=boundary==='pr2-line'?`INSERT INTO public.pr2_items(id,pr2_id,pr1_item_id,item_code) VALUES(md5('p2i${n}')::uuid,md5('h${n}')::uuid,md5('item${n}')::uuid,'STALE');`:`${actor('approver')} SELECT public.unwind_pr2_to_warehouse(md5('pr1${n}')::uuid,false);`;
  // Existing PR2 makes edit ineligible in either order. An intentionally denied
  // first RPC cannot retain its rolled-back subtransaction's advisory lock.
  const deniedSave=`${actor('warehouse')} SELECT wic_test.expect_error($q$SELECT * FROM public.update_warehouse_item_code(md5('line${n}')::uuid,'001-ORIGINAL','BAD')$q$,'55000');`;
  const r=await ordered(first==='save'?deniedSave:b,first==='save'?b:save(n),`phase4_ineligible_${n}`,{rollback,wait:first==='boundary'});
  assert.equal(r.code===0,first==='save',r.out);
  assert.equal(sql(`SELECT item_code FROM public.pr1_items WHERE id=md5('item${n}')::uuid`),'001-ORIGINAL');
  assert.equal(sql(`SELECT count(*) FROM public.warehouse_item_code_corrections WHERE pr1_id=md5('pr1${n}')::uuid`),'0');
  passed++;console.log(`PASS: ineligible-save ${boundary} ${first}-first ${rollback?'rollback':'commit'}`);n++;
 }
 for(const rollback of [false,true]){
  const r=await ordered(`SELECT public.wic_lock_pr1(md5('pr1${n}')::uuid); UPDATE public.profiles SET active=false WHERE id=md5('warehouse')::uuid;`,save(n),`phase4_profile_${n}`,{rollback});
  assert.equal(r.code===0,rollback,r.out);sql("UPDATE public.profiles SET active=true WHERE id=md5('warehouse')::uuid");
  passed++;console.log(`PASS: active profile rechecked after lock ${rollback?'rollback':'commit'}`);n++;
 }
 check('unlinked RFQ stays immutable across actual unwind/new validation/new edit',()=>tx(`INSERT INTO public.rfq_batches VALUES(md5('cycle-rfq')::uuid,md5('pr11')::uuid,null); ${save(1)} RESET ROLE;
 INSERT INTO public.pr2_requests(id,pr1_id) VALUES(md5('cycle-header')::uuid,md5('pr11')::uuid);
 INSERT INTO public.pr2_items(id,pr2_id,pr1_item_id,item_code) VALUES(md5('cycle-line')::uuid,md5('cycle-header')::uuid,md5('item1')::uuid,'STALE');
 UPDATE public.pr1_requests SET status='pr2_pending_approval' WHERE id=md5('pr11')::uuid; ${actor('approver')} SELECT public.unwind_pr2_to_warehouse(md5('pr11')::uuid,false); RESET ROLE;
 INSERT INTO public.warehouse_validations VALUES(md5('cycle-validation')::uuid,md5('pr11')::uuid,null);
 INSERT INTO public.warehouse_validation_items(id,validation_id,pr1_item_id,item_code) VALUES(md5('cycle-vline')::uuid,md5('cycle-validation')::uuid,md5('item1')::uuid,'DIRECT');
 ${actor('warehouse')} SELECT * FROM public.update_warehouse_item_code(md5('cycle-vline')::uuid,'DIRECT','SECOND-CYCLE');
 SELECT wic_test.assert((SELECT item_code='001-ORIGINAL' FROM public.get_rfq_warehouse_item_code_snapshots(md5('cycle-rfq')::uuid)),'RFQ changed across validation generations'); RESET ROLE;
 SELECT wic_test.assert((SELECT item_code='DIRECT' FROM public.pr2_items_archive WHERE id=md5('cycle-line')::uuid),'archived code rewritten');`));
 check('live RFQ foreign key baseline rejects unwind atomically; not silently broadened',()=>{
  sql('ALTER TABLE public.rfq_batches ADD CONSTRAINT phase4_live_pr2_fk FOREIGN KEY(pr2_id) REFERENCES public.pr2_requests(id) NOT VALID;');
  try{tx(`INSERT INTO public.pr2_requests(id,pr1_id) VALUES(md5('fk-header')::uuid,md5('pr11')::uuid);
   INSERT INTO public.rfq_batches VALUES(md5('fk-rfq')::uuid,md5('pr11')::uuid,md5('fk-header')::uuid);
   UPDATE public.pr1_requests SET status='pr2_pending_approval' WHERE id=md5('pr11')::uuid; ${actor('approver')}
   SELECT wic_test.expect_error($q$SELECT public.unwind_pr2_to_warehouse(md5('pr11')::uuid,false)$q$,'23503'); RESET ROLE;
   SELECT wic_test.assert((SELECT count(*)=1 FROM public.pr2_requests WHERE id=md5('fk-header')::uuid),'failed unwind lost live PR2');
   SELECT wic_test.assert((SELECT count(*)=0 FROM public.pr2_requests_archive WHERE id=md5('fk-header')::uuid),'failed unwind left archive');`);}finally{sql('ALTER TABLE public.rfq_batches DROP CONSTRAINT phase4_live_pr2_fk');}
 });
 check('migration preflight refuses nonzero events/contexts, mismatches and changed live bodies atomically',()=>{
  const migration=readdirSync(resolve('supabase/migrations')).find(x=>x.endsWith('_warehouse_item_code_direct_edit_fix.sql'));
  const mutations=[`${save(1)}`,`INSERT INTO public.warehouse_item_code_pr2_context(pr2_id,pr1_id,validation_id) VALUES(md5('x')::uuid,md5('pr11')::uuid,md5('validation1')::uuid);`,"UPDATE public.warehouse_validation_items SET item_code='MISMATCH' WHERE id=md5('line1')::uuid;",`CREATE OR REPLACE FUNCTION public.reset_warehouse_validation_on_pr1_resubmit(p_pr1_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RAISE EXCEPTION 'changed body'; END $$;`];
  for(let i=0;i<mutations.length;i++){
   const target=`${db}_gate${i}`;sql(`CREATE DATABASE ${target}`,'postgres');
   for(const p of ['scripts/test-warehouse-item-code-fixture.sql','scripts/test-warehouse-item-code-archive-fixture.sql','scripts/test-warehouse-item-code-direct-live-functions.sql','supabase/migrations/20261010034723_warehouse_item_code_corrections.sql'])sql(readFileSync(resolve(p),'utf8'),target);
   sql(mutations[i],target);let rejected=false;
   try{sql(readFileSync(resolve(`supabase/migrations/${migration}`),'utf8'),target);}catch(e){assert.match(String(e.stderr),i===3?/Unexpected reset\/unwind definition/:/requires reviewed reconciliation/);rejected=true;}
   assert.ok(rejected,'unsafe migration accepted');assert.equal(sql("SELECT to_regclass('public.warehouse_item_code_write_permits') IS NULL",target),'t');
  }
 });
 sql(`DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='wic_authenticator') THEN CREATE ROLE wic_authenticator LOGIN NOINHERIT; END IF; END $$; GRANT anon,authenticated TO wic_authenticator;
 GRANT INSERT ON public.pr2_requests,public.pr2_items TO authenticated;
 INSERT INTO public.rfq_batches VALUES(md5('direct-jwt-rfq')::uuid,md5('pr138')::uuid,null);
 INSERT INTO public.rfq_suppliers VALUES(md5('direct-jwt-supplier')::uuid,md5('direct-jwt-rfq')::uuid,md5('supplier')::uuid);`);
 await require('./test-warehouse-item-code-jwt.cjs')(db,{direct:true});passed++;
 check('no leaked permits, obsolete operational snapshots or database deadlocks',()=>{
  assert.equal(sql('SELECT count(*) FROM public.warehouse_item_code_write_permits'),'0');
  assert.equal(sql('SELECT count(*) FROM public.warehouse_item_code_pr2_context'),'0');
  assert.equal(sql('SELECT count(*) FROM public.warehouse_item_code_pr2_snapshots'),'0');
  assert.equal(sql('SELECT deadlocks FROM pg_stat_database WHERE datname=current_database()'),'0');
 });
 check('null new code, replaced validation and permitted post-reset PR1 cascade',()=>file('scripts/test-warehouse-item-code-direct-edges.sql'));
 console.log(`RESULT: ${passed} passed, ${failed} failed; ${db}`);if(failed)process.exitCode=1;
}
main().catch(e=>{console.error(e.stderr||e.message);process.exitCode=1;});
