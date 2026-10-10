// Historical override-only baseline. NOT direct-edit acceptance or release verification.
// Retained to reproduce the deployed predecessor; fixed loopback, never reads .env.
const { execFileSync, spawn } = require('node:child_process');
const { resolve } = require('node:path');
const assert = require('node:assert/strict');
const psql = resolve('scratch/warehouse-item-code-db/runtime/pgsql/bin/psql.exe');
const database = `wic_test_${Date.now()}`;
const common = ['-X', '-h', '127.0.0.1', '-p', '55439', '-U', 'wic_test_owner', '-v', 'ON_ERROR_STOP=1'];
function sql(query, db = database) {
  return execFileSync(psql, [...common, '-d', db, '-At', '-c', query],
    { encoding: 'utf8', windowsHide: true, timeout: 15000 }).trim();
}
function file(path) {
  execFileSync(psql, [...common, '-d', database, '-f', resolve(path)],
    { encoding: 'utf8', windowsHide: true, timeout: 30000, stdio: ['ignore','pipe','pipe'] });
}
function session(query, name) {
  const child = spawn(psql, [...common, '-d', database, '-c', query], {
    windowsHide: true, env: { ...process.env, PGAPPNAME: name },
  });
  let out = '';
  child.stdout.on('data', x => { out += x; });
  child.stderr.on('data', x => { out += x; });
  const done = new Promise((accept, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error('Session timeout')); }, 15000);
    child.on('error', e => { clearTimeout(timer); reject(e); });
    child.on('close', code => { clearTimeout(timer); accept({ code, out }); });
  });
  return { done };
}
const warehouse = `SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub',md5('warehouse'),false);`;
const save = n => `SELECT * FROM public.update_warehouse_item_code(md5('line${n}')::uuid,'001-ORIGINAL','corrected');`;
const boundaries = {
  header: n => `INSERT INTO public.pr2_requests(id,pr1_id) VALUES(md5('header${n}')::uuid,md5('pr1${n}')::uuid);`,
  status: n => `UPDATE public.pr1_requests SET status='resolved_internal' WHERE id=md5('pr1${n}')::uuid;`,
  decision: n => `UPDATE public.warehouse_validations SET decision='rejected' WHERE id=md5('validation${n}')::uuid;`,
  reset: n => `DELETE FROM public.warehouse_validations WHERE id=md5('validation${n}')::uuid;`,
};
async function ordered(firstSql, secondSql, name) {
  const first = session(firstSql, name);
  const deadline = Date.now() + 10000;
  // Observe actual first-session state instead of assuming an arbitrary startup delay.
  while (sql(`SELECT count(*) FROM pg_stat_activity WHERE application_name='${name}' AND wait_event='PgSleep'`) !== '1') {
    assert.ok(Date.now() < deadline, `First writer did not reach held-lock state: ${name}`);
    await new Promise(r => setTimeout(r, 30));
  }
  const second = session(secondSql, `${name}_second`);
  const result = await Promise.all([first.done, second.done]);
  assert.equal(result[0].code, 0, result[0].out);
  return result[1];
}
async function main() {
  assert.equal(sql('SELECT current_user', 'postgres'), 'wic_test_owner');
  sql(`CREATE DATABASE ${database}`, 'postgres');
  file('scripts/test-warehouse-item-code-fixture.sql');
  file('scripts/test-warehouse-item-code-archive-fixture.sql');
  file('supabase/migrations/20260609130000_fix_warehouse_validation_reset_on_draft.sql');
  file('supabase/migrations/20261010020736_fix_pr2_archive_buyer_assignment.sql');
  assert.equal(sql(`SELECT to_regprocedure('public.update_warehouse_item_code(uuid,text,text)') IS NULL`), 't');
  sql(`SELECT wic_test.expect_error($q$SELECT public.update_warehouse_item_code(md5('line1')::uuid,'001-ORIGINAL','test')$q$,'42883')`);
  console.log('Missing-feature check: database rejects RPC before migration (42883)');
  file('supabase/migrations/20261010034723_warehouse_item_code_corrections.sql');
  file('scripts/test-warehouse-item-code-behavior.sql');
  console.log('PASS: role/code/lifecycle/rollback suite');
  file('scripts/test-warehouse-item-code-archive.sql');
  console.log('PASS: actual reset and unwind/archive functions');
  file('scripts/test-warehouse-item-code-extra.sql');
  console.log('PASS: provenance, services, legacy paths and batch atomicity');
  sql(`DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='wic_authenticator') THEN
    CREATE ROLE wic_authenticator LOGIN NOINHERIT; END IF; END $$;
    GRANT anon, authenticated TO wic_authenticator;`);
  await require('./test-warehouse-item-code-jwt.cjs')(database);
  file('scripts/test-warehouse-item-code-rfq.sql');
  console.log('PASS: exact RFQ assignment, existing staff access, provenance and archived snapshots');
  await require('./test-warehouse-item-code-jwt.cjs')(database, { rfqOnly: true });
  let n = 10;
  for (const [kind, boundary] of Object.entries(boundaries)) {
    for (const order of ['boundary-first', 'code-first']) {
      for (const rollback of [false, true]) {
        const firstAction = order === 'boundary-first' ? boundary(n) : warehouse + save(n);
        const secondAction = order === 'boundary-first' ? warehouse + save(n) : boundary(n);
        const r = await ordered(`BEGIN; ${firstAction} SELECT pg_sleep(1.5); ${rollback ? 'ROLLBACK' : 'COMMIT'};`,
          secondAction, `wic_${kind}_${n}`);
        const denied = order === 'boundary-first' && !rollback;
        assert.equal(r.code === 0, !denied, r.out);
        if (denied) assert.match(r.out, /no longer available|replaced or removed/);
        const count = sql(`SELECT count(*) FROM public.warehouse_item_code_corrections WHERE pr1_id=md5('pr1${n}')::uuid`);
        assert.equal(count, denied || (order === 'code-first' && rollback) ? '0' : '1');
        console.log(`PASS: ${kind} ${order} ${rollback ? 'rollback' : 'commit'}`);
        n++;
      }
    }
  }
  const conflict = await ordered(`BEGIN; ${warehouse} ${save(26)} SELECT pg_sleep(1.5); COMMIT;`,
    warehouse + save(26), 'wic_two_saves');
  assert.notEqual(conflict.code, 0, 'Second stale save must fail');
  assert.match(conflict.out, /Item code changed/);
  assert.equal(sql(`SELECT count(*) FROM public.warehouse_item_code_corrections WHERE pr1_id=md5('pr126')::uuid`), '1');
  console.log('PASS: simultaneous correction saves produce one event and one stale conflict');
  console.log(`Native PostgreSQL verification passed. Disposable database: ${database}`);
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
