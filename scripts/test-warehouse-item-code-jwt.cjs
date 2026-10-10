// Called only by the native disposable-database runner, never against Supabase production.
const { spawn } = require('node:child_process');
const { createHash, createHmac, randomBytes } = require('node:crypto');
const { resolve } = require('node:path');
const assert = require('node:assert/strict');
const uuid = label => {
  const h = createHash('md5').update(label).digest('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
};
module.exports = async function jwtTests(database, { rfqOnly = false, direct = false } = {}) {
  assert.match(database, /^wic_test_(?:direct_)?[0-9]+$/);
  const secret = randomBytes(32).toString('hex');
  const encode = x => Buffer.from(JSON.stringify(x)).toString('base64url');
  function token(actor) {
    const body = encode({ alg:'HS256',typ:'JWT' }) + '.' + encode({
      role:'authenticated',sub:uuid(actor),exp:Math.floor(Date.now()/1000)+300,
    });
    return body + '.' + createHmac('sha256',secret).update(body).digest('base64url');
  }
  const gateway = spawn(resolve('scratch/warehouse-item-code-db/postgrest/postgrest.exe'), [], {
    windowsHide:true, stdio:['ignore','pipe','pipe'], env:{...process.env,
      PGRST_DB_URI:`postgresql://wic_authenticator@127.0.0.1:55439/${database}`,
      PGRST_DB_SCHEMAS:'public',PGRST_DB_ANON_ROLE:'anon',PGRST_JWT_SECRET:secret,
      PGRST_SERVER_HOST:'127.0.0.1',PGRST_SERVER_PORT:'55440',
    },
  });
  let log='';
  gateway.stdout.on('data',x=>{log+=x;});
  gateway.stderr.on('data',x=>{log+=x;});
  let startupError;
  gateway.on('error',e=>{startupError=e;});
  const request = async (path, actor, body, rawToken, method) => {
    const headers={'Content-Type':'application/json'};
    if(actor || rawToken) headers.Authorization=`Bearer ${rawToken || token(actor)}`;
    const r=await fetch(`http://127.0.0.1:55440/${path}`,{
      method:method || (body===undefined?'GET':'POST'),headers,
      body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(5000),
    });
    const text=await r.text();
    return {status:r.status,data:text ? JSON.parse(text) : null};
  };
  try {
    const until=Date.now()+10000;
    while(true){
      if(startupError)throw startupError;
      try { if((await request('',null)).status===200)break; } catch {}
      assert.ok(Date.now()<until,`Local JWT gateway failed to start: ${log}`);
      await new Promise(r=>setTimeout(r,60));
    }
    if (rfqOnly) {
      const args = { p_rfq_id: uuid('rfq-live') };
      for (const actor of ['warehouse','procurement','supplier','employee','approver']) {
        const r = await request('rpc/get_rfq_warehouse_item_code_snapshots', actor, args);
        assert.equal(r.status, 200, `${actor}: ${JSON.stringify(r.data)}`);
        assert.deepEqual(r.data, [{ pr1_item_id: uuid('item38'), item_code: '' }]);
      }
      for (const actor of ['admin','inactive','other-employee']) {
        assert.equal((await request('rpc/get_rfq_warehouse_item_code_snapshots', actor, args)).status, 403);
      }
      const unassigned = await request('rpc/get_rfq_warehouse_item_code_snapshots','supplier',{ p_rfq_id:uuid('rfq-unassigned') });
      assert.equal(unassigned.status,403);
      const archive = await request('rpc/get_rfq_warehouse_item_code_snapshots','supplier',{ p_rfq_id:uuid('rfq-archive') });
      assert.deepEqual(archive.data, [{ pr1_item_id:uuid('item29'), item_code:'ARCHIVE-CODE' }]);
      assert.equal((await request('rpc/get_rfq_warehouse_item_code_snapshots',null,args)).status,401);
      assert.equal((await request('rpc/get_rfq_warehouse_item_code_snapshots',null,args,'not.a.valid.jwt')).status,401);
      const mismatch = await request('rpc/get_rfq_warehouse_item_code_snapshots','procurement',{ p_rfq_id:uuid('rfq-mismatch') });
      assert.ok(mismatch.status>=400);
      assert.equal(mismatch.data.code,'55000');
      console.log('PASS: signed JWT RFQ reader staff/owner/exact-supplier access, blank/archive, denied/anonymous/invalid-token matrix');
      return;
    }
    const args={p_validation_item_id:uuid('line38'),p_expected_code:'001-ORIGINAL',p_new_code:' 000-Mixed.Code '};
    const readArgs={p_validation_id:uuid('validation38')};
    const saved=await request('rpc/update_warehouse_item_code','warehouse',args);
    assert.equal(saved.status,200,JSON.stringify(saved.data));
    assert.equal(saved.data[0].effective_code,'000-Mixed.Code');
    const loaded=await request('rpc/get_warehouse_item_codes','warehouse',readArgs);
    assert.equal(loaded.status,200);
    assert.equal(loaded.data[0].effective_code,'000-Mixed.Code');
    const noop=await request('rpc/update_warehouse_item_code','warehouse',{
      ...args,p_expected_code:'000-Mixed.Code',p_new_code:'000-Mixed.Code',
    });
    assert.equal(noop.data[0].correction_id,saved.data[0].correction_id);
    const stale=await request('rpc/update_warehouse_item_code','warehouse',args);
    assert.ok(stale.status>=400);
    assert.equal(stale.data.code,'40001');
    const blank=await request('rpc/update_warehouse_item_code','warehouse',{
      ...args,p_expected_code:'000-Mixed.Code',p_new_code:' ',
    });
    assert.equal(blank.status,200);
    assert.equal(blank.data[0].effective_code,'');
    for(const actor of ['admin','employee','procurement','approver','supplier','inactive']){
      const denied=await request('rpc/update_warehouse_item_code',actor,{...args,p_expected_code:''});
      assert.equal(denied.status,403,`Role ${actor} was not denied`);
    }
    assert.equal((await request('rpc/update_warehouse_item_code',null,args)).status,401);
    assert.equal((await request('rpc/get_warehouse_item_codes',null,readArgs,'not.a.valid.jwt')).status,401);
    const raw=await request('warehouse_item_code_corrections?select=id','warehouse');
    assert.equal(raw.status,200);
    assert.deepEqual(raw.data,[]);
    const forged=await request('warehouse_item_code_corrections','warehouse',{});
    assert.equal(forged.status,403);
    const original=await request(`pr1_items?id=eq.${uuid('item38')}&select=item_code`,'warehouse');
    assert.equal(original.status,200);
    assert.equal(original.data[0].item_code,direct?'':'001-ORIGINAL');
    if(direct){
      assert.equal(loaded.data[0].original_pr1_code,'000-Mixed.Code');
      const copy=await request(`warehouse_validation_items?id=eq.${uuid('line38')}&select=id,item_code`,'warehouse');
      assert.deepEqual(copy.data,[{id:uuid('line38'),item_code:''}]);
      const patch=await request(`pr1_items?id=eq.${uuid('item38')}`,'warehouse',{item_code:'BYPASS'},undefined,'PATCH');
      assert.ok([200,204,403].includes(patch.status));
      assert.equal((await request(`pr1_items?id=eq.${uuid('item38')}&select=item_code`,'warehouse')).data[0].item_code,'');
      const owner=await request(`pr1_items?id=eq.${uuid('item38')}`,'employee',{item_code:'BYPASS'},undefined,'PATCH');
      assert.equal(owner.status,403);
      const validationPatch=await request(`warehouse_validation_items?id=eq.${uuid('line38')}`,'warehouse',{item_code:'BYPASS'},undefined,'PATCH');
      assert.equal(validationPatch.status,403);
      for(const actor of ['warehouse','employee','procurement','supplier']){
        const history=await request('rpc/get_rfq_warehouse_item_code_snapshots',actor,{p_rfq_id:uuid('direct-jwt-rfq')});
        assert.equal(history.status,200,JSON.stringify(history.data));
        assert.deepEqual(history.data,[{pr1_item_id:uuid('item38'),item_code:'001-ORIGINAL'}]);
      }
      for(const actor of ['other-employee','inactive','admin'])assert.equal((await request('rpc/get_rfq_warehouse_item_code_snapshots',actor,{p_rfq_id:uuid('direct-jwt-rfq')})).status,403);
      const browser=await require('puppeteer').launch({headless:true});
      try{
        const page=await browser.newPage();await page.goto('http://127.0.0.1:55440/');
        const result=await page.evaluate(async ({jwt,pr1,item,line,header,p2line})=>{
          async function api(path,body){
            const r=await fetch('/'+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+jwt,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body)});
            const text=await r.text();if(!r.ok)throw Error(r.status+': '+text);return text?JSON.parse(text):null;
          }
          // Exact critical browser sequence: PR1 read BEFORE header; another
          // warehouse save completes; stale payload is sent AFTER header commit.
          const stale=(await api(`pr1_items?id=eq.${item}&select=item_code`))[0].item_code;
          await api('rpc/update_warehouse_item_code',{p_validation_item_id:line,p_expected_code:stale,p_new_code:'FRESH-BROWSER'});
          await api('pr2_requests',{id:header,pr1_id:pr1});
          await api('pr2_items',{id:p2line,pr2_id:header,pr1_item_id:item,item_code:stale,quantity_to_purchase:7,description:'UNCHANGED DESCRIPTION',unit_price:15,total_price:105});
          return {stale,row:(await api(`pr2_items?id=eq.${p2line}&select=*`))[0]};
        },{jwt:token('warehouse'),pr1:uuid('pr139'),item:uuid('item39'),line:uuid('line39'),header:uuid('browser-header'),p2line:uuid('browser-line')});
        assert.equal(result.stale,'001-ORIGINAL');assert.equal(result.row.item_code,'FRESH-BROWSER');
        assert.equal(result.row.quantity_to_purchase,7);assert.equal(result.row.unit_price,15);assert.equal(result.row.total_price,105);assert.equal(result.row.description,'UNCHANGED DESCRIPTION');
        console.log('PASS: real Chromium + signed JWT + PostgreSQL pre-header stale-read sequence persists fresh PR2 code, preserving commercial payload');
      }finally{await browser.close();}
      console.log('PASS: signed JWT direct same-item/copy edits, stale/noop/blank, denied roles/tokens, direct PATCH protection and immutable exact-supplier RFQ history');
    }else console.log('PASS: legacy override signed JWT baseline (not direct-edit acceptance)');
  } finally {
    const closed=new Promise(r=>gateway.once('close',r));
    gateway.kill();
    await closed;
  }
};
