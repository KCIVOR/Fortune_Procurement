/* Synthetic fixtures only. Never load the application's production .env files. */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createClient } = require('@supabase/supabase-js');

function target(env = process.env) {
  const url = new URL(env.WIC_TEST_URL || 'http://invalid');
  const allowed = (env.WIC_TEST_ALLOWED_HOSTS || '').split(',');
  assert.notEqual(url.hostname, 'emddvbocupvufzvhcacz.supabase.co', 'Production tests prohibited');
  assert.ok(allowed.includes(url.hostname), 'Set an explicit isolated WIC_TEST_ALLOWED_HOSTS');
  assert.ok(env.WIC_TEST_ANON_KEY, 'Isolated publishable/anon key required');
  return url.origin;
}

test('production is refused even when explicitly allowlisted', () => {
  assert.throws(() => target({
    WIC_TEST_URL: 'https://emddvbocupvufzvhcacz.supabase.co',
    WIC_TEST_ALLOWED_HOSTS: 'emddvbocupvufzvhcacz.supabase.co', WIC_TEST_ANON_KEY: 'test',
  }), /Production tests prohibited/);
});
test('unconfigured target is refused before any request', () => {
  assert.throws(() => target({}), /explicit isolated/);
});
test('explicit local target is accepted', () => {
  assert.equal(target({ WIC_TEST_URL: 'http://127.0.0.1:54321',
    WIC_TEST_ALLOWED_HOSTS: '127.0.0.1', WIC_TEST_ANON_KEY: 'test',
  }), 'http://127.0.0.1:54321');
});

const safetyOnly = process.env.WIC_TEST_SAFETY_ONLY === '1';
test('isolated target and synthetic fixtures are configured', { skip: safetyOnly }, () => {
  target();
  const f = JSON.parse(process.env.WIC_TEST_FIXTURES || '{}');
  assert.ok(f.validationId && f.validationItemId && f.pr1ItemId && f.warehouseToken);
});

// Sequential: this suite intentionally changes only the nominated synthetic line.
test('warehouse correction contract and direct-write denial', { skip: safetyOnly }, async () => {
  const url = target();
  const f = JSON.parse(process.env.WIC_TEST_FIXTURES || '{}');
  assert.ok((f.deniedTokens || []).length >= 2, 'Provide non-warehouse and inactive fixture tokens');
  const client = token => createClient(url, process.env.WIC_TEST_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const warehouse = client(f.warehouseToken);
  const read = async () => {
    const r = await warehouse.rpc('get_warehouse_item_codes', { p_validation_id: f.validationId });
    assert.equal(r.error, null, 'Code read failed');
    const row = r.data.find(x => x.validation_item_id === f.validationItemId);
    assert.ok(row, 'Synthetic line missing');
    return row;
  };
  const save = (expected, code) => warehouse.rpc('update_warehouse_item_code', {
    p_validation_item_id: f.validationItemId, p_expected_code: expected, p_new_code: code,
  });
  const original = await warehouse.from('pr1_items').select('item_code').eq('id', f.pr1ItemId).single();
  assert.equal(original.error, null);
  const start = await read();
  const newCode = `001-WIC-${Date.now()}`;
  const saved = await save(start.effective_code, ` ${newCode} `);
  assert.equal(saved.error, null, 'Warehouse save failed');
  assert.equal(saved.data[0].effective_code, newCode);
  const persisted = await read();
  assert.equal(persisted.effective_code, newCode);
  const noop = await save(newCode, newCode);
  assert.equal(noop.error, null);
  assert.equal(String(noop.data[0].correction_id), String(persisted.correction_id));
  const stale = await save(start.effective_code, 'stale');
  assert.ok(stale.error, 'Stale write must fail');
  const blank = await save(newCode, '  ');
  assert.equal(blank.error, null);
  assert.equal((await read()).effective_code, '');
  const nullSave = await save('', null);
  assert.ok(nullSave.error, 'Null code must fail');
  for (const token of f.deniedTokens || []) {
    const r = await client(token).rpc('update_warehouse_item_code', {
      p_validation_item_id: f.validationItemId, p_expected_code: '', p_new_code: 'forbidden',
    });
    assert.ok(r.error, 'Non-warehouse/inactive save must fail');
  }
  assert.ok((f.deniedTokens || []).length >= 2, 'Provide non-warehouse and inactive fixture tokens');
  const direct = await warehouse.from('warehouse_item_code_corrections').insert({
    pr1_id: f.pr1Id, validation_id: f.validationId, validation_item_id: f.validationItemId,
    pr1_item_id: f.pr1ItemId, original_pr1_code: original.data.item_code,
    previous_code: '', new_code: 'forged', actor_id: f.warehouseId, actor_name_snapshot: 'forged',
  });
  assert.ok(direct.error, 'Direct history insertion must fail');
  const after = await warehouse.from('pr1_items').select('item_code').eq('id', f.pr1ItemId).single();
  assert.equal(after.error, null);
  assert.equal(after.data.item_code, '', 'The same PR1 item must contain the persisted blank code');
  const copy = await warehouse.from('warehouse_validation_items').select('id,item_code').eq('id', f.validationItemId).single();
  assert.equal(copy.error, null);
  assert.deepEqual(copy.data, { id: f.validationItemId, item_code: '' });
  assert.equal((await save('', start.effective_code)).error, null);
});
