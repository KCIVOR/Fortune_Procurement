// Phase 1 local design proof. No environment/production target or credentials accepted.
const { execFileSync, spawn } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const assert = require('node:assert/strict');
const psql=resolve('scratch/warehouse-item-code-db/runtime/pgsql/bin/psql.exe');
const db=`wic_test_${Date.now()}`;
const common=['-X','-h','127.0.0.1','-p','55439','-U','wic_test_owner','-v','ON_ERROR_STOP=1'];
const sql=(q,d=db)=>execFileSync(psql,[...common,'-d',d,'-At','-c',q],{encoding:'utf8',windowsHide:true,timeout:15000}).trim();
const file=p=>execFileSync(psql,[...common,'-d',db,'-f',resolve(p)],{encoding:'utf8',windowsHide:true,timeout:30000,stdio:['ignore','pipe','pipe']});
const actor=a=>`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub',md5('${a}'),false);`;
const save=n=>`${actor('warehouse')} SELECT wic_test.save_direct(${n},'001-ORIGINAL','DIRECT');`;
let passed=0;
function check(name, fn){fn();passed++;console.log(`PASS: ${name}`);}
function session(q,name){
 const child=spawn(psql,[...common,'-d',db,'-c',q],{windowsHide:true,env:{...process.env,PGAPPNAME:name}});
 let out='';child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>out+=x);
 const done=new Promise((yes,no)=>{const timer=setTimeout(()=>{child.kill();no(Error('session timeout'));},15000);
 child.on('error',no);child.on('close',code=>{clearTimeout(timer);yes({code,out});});});return {done};
}
async function ordered(a,b,name){
 const first=session(`BEGIN; ${a} SELECT pg_sleep(0.7); COMMIT;`,name);
 const until=Date.now()+8000;
 while(sql(`SELECT count(*) FROM pg_stat_activity WHERE application_name='${name}' AND wait_event='PgSleep'`)!=='1'){
  assert.ok(Date.now()<until,'first writer did not acquire its locks');await new Promise(r=>setTimeout(r,20));
 }
 const second=session(b,`${name}_second`);const results=await Promise.all([first.done,second.done]);
 assert.equal(results[0].code,0,results[0].out);return results[1];
}
async function main(){
 assert.equal(sql('SELECT current_user','postgres'),'wic_test_owner');sql(`CREATE DATABASE ${db}`,'postgres');
 file('scripts/test-warehouse-item-code-fixture.sql');file('scripts/test-warehouse-item-code-archive-fixture.sql');
 file('scripts/test-warehouse-item-code-direct-live-functions.sql');
 file('supabase/migrations/20261010034723_warehouse_item_code_corrections.sql');
 check('deployed baseline does not directly edit PR1',()=>{
  sql(`BEGIN; ${actor('warehouse')} SELECT * FROM public.update_warehouse_item_code(md5('line1')::uuid,'001-ORIGINAL','OLD-OVERRIDE'); RESET ROLE;
    SELECT wic_test.assert((SELECT item_code='001-ORIGINAL' FROM public.pr1_items WHERE id=md5('item1')::uuid),'baseline mutated original'); ROLLBACK;`);
 });
 file('scripts/test-warehouse-item-code-direct-proof.sql');
 // Patch freshly captured live bodies only in this disposable DB; preserve their statements.
 const live=readFileSync(resolve('scripts/test-warehouse-item-code-direct-live-functions.sql'),'utf8');
 const locked=live.replace(/BEGIN\r?\n/g,"BEGIN\n  PERFORM public.wic_lock_pr1(p_pr1_id);\n");
 sql(locked);
 check('same existing rows update; blank/noop/stale and atomic rollback',()=>{
  sql(`BEGIN; ${save(1)} RESET ROLE;
    SELECT wic_test.assert((SELECT item_code='DIRECT' FROM public.pr1_items WHERE id=md5('item1')::uuid),'PR1 not direct');
    SELECT wic_test.assert((SELECT item_code='DIRECT' FROM public.warehouse_validation_items WHERE id=md5('line1')::uuid),'copy stale');
    SELECT wic_test.assert((SELECT count(*)=40 FROM public.pr1_items),'new item created');
    ${actor('warehouse')} SELECT wic_test.save_direct(1,'DIRECT','DIRECT');
    SELECT wic_test.expect_error($q$SELECT wic_test.save_direct(1,'001-ORIGINAL','BAD')$q$,'40001');
    SELECT wic_test.save_direct(1,'DIRECT','   '); RESET ROLE;
    SELECT wic_test.assert((SELECT item_code='' FROM public.pr1_items WHERE id=md5('item1')::uuid),'blank lost');
    SELECT wic_test.assert((SELECT count(*)=2 FROM public.warehouse_item_code_corrections),'noop event'); ROLLBACK;`);
  assert.equal(sql("SELECT item_code FROM public.pr1_items WHERE id=md5('item1')::uuid"),'001-ORIGINAL');
 });
 check('all other roles/inactive and no identity denied',()=>{
  for(const a of ['employee','admin','procurement','supplier','approver','inactive']) sql(`${actor(a)} SELECT wic_test.expect_error($q$SELECT wic_test.save_direct(1,'001-ORIGINAL','BAD')$q$,'42501');`);
  sql(`SET ROLE authenticated; SELECT wic_test.expect_error($q$SELECT wic_test.save_direct(1,'001-ORIGINAL','BAD')$q$,'42501');`);
 });
 check('actual reset preserves changed PR1; actual unwind preserves archived code',()=>{
  sql(`${save(2)} RESET ROLE; UPDATE public.pr1_requests SET status='revision_requested' WHERE id=md5('pr12')::uuid;
    ${actor('employee')} SELECT public.reset_warehouse_validation_on_pr1_resubmit(md5('pr12')::uuid); RESET ROLE;
    SELECT wic_test.assert((SELECT item_code='DIRECT' FROM public.pr1_items WHERE id=md5('item2')::uuid),'reset lost code');
    ${save(3)} RESET ROLE; INSERT INTO public.pr2_requests(id,pr1_id) VALUES(md5('header3')::uuid,md5('pr13')::uuid);
    INSERT INTO public.pr2_items(id,pr2_id,pr1_item_id,item_code) VALUES(md5('doc3')::uuid,md5('header3')::uuid,md5('item3')::uuid,'STALE');
    UPDATE public.pr1_requests SET status='pr2_pending_approval' WHERE id=md5('pr13')::uuid;
    ${actor('approver')} SELECT public.unwind_pr2_to_warehouse(md5('pr13')::uuid,false); RESET ROLE;
    SELECT wic_test.assert((SELECT item_code='DIRECT' FROM public.pr2_items_archive WHERE id=md5('doc3')::uuid),'archive stale');`);
 });
 check('legacy/missing-PR2-line history requires snapshot, not current PR1',()=>{
  sql(`INSERT INTO public.rfq_batches VALUES(md5('legacy4')::uuid,md5('pr14')::uuid,null);
    ${save(4)} RESET ROLE; SELECT wic_test.assert(wic_test.rfq_code(md5('legacy4')::uuid,md5('item4')::uuid)='001-ORIGINAL','legacy changed');
    INSERT INTO public.pr2_requests_archive(id,pr1_id) VALUES(md5('archive5')::uuid,md5('pr15')::uuid);
    INSERT INTO public.rfq_batches VALUES(md5('missing5')::uuid,md5('pr15')::uuid,md5('archive5')::uuid);
    ${save(5)} RESET ROLE; SELECT wic_test.assert(wic_test.rfq_code(md5('missing5')::uuid,md5('item5')::uuid)='001-ORIGINAL','missing-line history changed');
    DELETE FROM wic_test.rfq_history WHERE rfq_id=md5('missing5')::uuid;
    SELECT wic_test.expect_error($q$SELECT wic_test.rfq_code(md5('missing5')::uuid,md5('item5')::uuid)$q$,'55000');`);
 });
 check('linked archived source wins over later PR1 value',()=>{
  sql(`INSERT INTO public.rfq_batches VALUES(md5('rfq3')::uuid,md5('pr13')::uuid,md5('header3')::uuid);
    UPDATE public.pr1_items SET item_code='LATER' WHERE id=md5('item3')::uuid;
    SELECT wic_test.assert(wic_test.rfq_code(md5('rfq3')::uuid,md5('item3')::uuid)='DIRECT','archive overwritten');`);
 });
 let n=10;
 for(const boundary of ['header','status','decision','delete','reset'])for(const first of ['boundary','save']){
  const actions={header:`INSERT INTO public.pr2_requests(id,pr1_id) VALUES(md5('h${n}')::uuid,md5('pr1${n}')::uuid);`,
   status:`UPDATE public.pr1_requests SET status='resolved_internal' WHERE id=md5('pr1${n}')::uuid;`,
   decision:`UPDATE public.warehouse_validations SET decision='rejected' WHERE id=md5('validation${n}')::uuid;`,
   delete:`DELETE FROM public.warehouse_validations WHERE id=md5('validation${n}')::uuid;`,
   reset:`UPDATE public.pr1_requests SET status='revision_requested' WHERE id=md5('pr1${n}')::uuid; ${actor('employee')} SELECT public.reset_warehouse_validation_on_pr1_resubmit(md5('pr1${n}')::uuid);`};
  const b=actions[boundary],s=save(n);const r=await ordered(first==='boundary'?b:s,first==='boundary'?s:b,`direct_${n}`);
  assert.equal(r.code===0,first==='save',r.out);passed++;console.log(`PASS: ${boundary} ${first}-first no deadlock`);n++;
 }
 for(const first of ['rfq','save']){
  const r=await ordered(first==='rfq'?`INSERT INTO public.rfq_batches VALUES(md5('rfq${n}')::uuid,md5('pr1${n}')::uuid,null);`:save(n),
    first==='rfq'?save(n):`INSERT INTO public.rfq_batches VALUES(md5('rfq${n}')::uuid,md5('pr1${n}')::uuid,null);`,`rfq_${n}`);
  assert.equal(r.code,0,r.out);
  assert.equal(sql(`SELECT wic_test.rfq_code(md5('rfq${n}')::uuid,md5('item${n}')::uuid)`),first==='rfq'?'001-ORIGINAL':'DIRECT');
  passed++;console.log(`PASS: RFQ creation ${first}-first captures ordered code`);n++;
 }
 const conflict=await ordered(save(n),save(n),`stale_${n}`);assert.notEqual(conflict.code,0);assert.match(conflict.out,/stale/);passed++;
 // Reproduce audited owner UPDATE and warehouse validation UPDATE policies, not a full schema clone.
 sql(`GRANT UPDATE ON public.pr1_items,public.warehouse_validation_items TO authenticated;
   ALTER TABLE public.pr1_items ENABLE ROW LEVEL SECURITY;
   CREATE POLICY probe_item_read ON public.pr1_items FOR SELECT TO authenticated USING(true);
   CREATE POLICY probe_owner_update ON public.pr1_items FOR UPDATE TO authenticated
     USING(EXISTS(SELECT 1 FROM public.pr1_requests r WHERE r.id=pr1_id AND r.requisitioner_id=auth.uid()))
     WITH CHECK(EXISTS(SELECT 1 FROM public.pr1_requests r WHERE r.id=pr1_id AND r.requisitioner_id=auth.uid()));
   ALTER TABLE public.warehouse_validation_items ENABLE ROW LEVEL SECURITY;
   CREATE POLICY probe_line_read ON public.warehouse_validation_items FOR SELECT TO authenticated USING(true);
   CREATE POLICY probe_warehouse_update ON public.warehouse_validation_items FOR UPDATE TO authenticated
     USING(public.is_role('warehouse')) WITH CHECK(public.is_role('warehouse'));`);
 check('GAP reproduced: owner PATCH after direct save can overwrite submitted PR1 code',()=>{
   sql(`${save(25)} ${actor('employee')} UPDATE public.pr1_items SET item_code='OWNER-BYPASS' WHERE id=md5('item25')::uuid; RESET ROLE;`);
   assert.equal(sql("SELECT p.item_code||'/'||w.item_code FROM public.pr1_items p JOIN public.warehouse_validation_items w ON w.pr1_item_id=p.id WHERE p.id=md5('item25')::uuid"),'OWNER-BYPASS/DIRECT');
 });
 check('GAP reproduced: warehouse PATCH can alter code copy outside checked RPC',()=>{
   sql(`${actor('warehouse')} UPDATE public.warehouse_validation_items SET item_code='COPY-BYPASS' WHERE id=md5('line26')::uuid; RESET ROLE;`);
   assert.equal(sql("SELECT p.item_code||'/'||w.item_code FROM public.pr1_items p JOIN public.warehouse_validation_items w ON w.pr1_item_id=p.id WHERE p.id=md5('item26')::uuid"),'001-ORIGINAL/COPY-BYPASS');
 });
 check('GAP reproduced: changing RFQ link chooses a different code without immutable snapshot priority',()=>{
   sql(`INSERT INTO public.rfq_batches VALUES(md5('link27')::uuid,md5('pr127')::uuid,null);
     INSERT INTO public.pr2_requests_archive(id,pr1_id) VALUES(md5('archive27')::uuid,md5('pr127')::uuid);
     INSERT INTO public.pr2_items_archive(id,pr2_id,pr1_item_id,item_code) VALUES(md5('archline27')::uuid,md5('archive27')::uuid,md5('item27')::uuid,'OTHER-DOCUMENT-CODE');
     UPDATE public.rfq_batches SET pr2_id=md5('archive27')::uuid WHERE id=md5('link27')::uuid;`);
   assert.equal(sql("SELECT wic_test.rfq_code(md5('link27')::uuid,md5('item27')::uuid)"),'OTHER-DOCUMENT-CODE');
   assert.equal(sql("SELECT item_code FROM wic_test.rfq_history WHERE rfq_id=md5('link27')::uuid"),'001-ORIGINAL');
 });
 console.log(`PASS: simultaneous saves have one winner; ${passed} proof groups passed. Disposable database: ${db}`);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
