// Exercise the browser RPC boundary without credentials or a production database.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadApi(rpc, queryResponse = { data: [], error: null }, onQuery = () => {}) {
  const root = path.resolve(__dirname, '..');
  const helpers = require(path.join(root, 'scratch/warehouse-item-code-tests/warehouse-item-code.js'));
  const source = fs.readFileSync(path.join(root, 'lib/warehouse-item-code-data.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} };
  const mockRequire = name => {
    if (name === './supabase') return { supabase: { rpc, from: table => {
      onQuery('from', table);
      return { select: columns => {
        onQuery('select', columns);
        return { eq: (column, value) => {
          onQuery('eq', column, value);
          return { limit: count => { onQuery('limit', count); return Promise.resolve(queryResponse); } };
        } };
      } };
    } } };
    if (name === './warehouse-item-code') return helpers;
    throw new Error(`Unexpected dependency: ${name}`);
  };
  new Function('require', 'module', 'exports', compiled)(mockRequire, module, module.exports);
  return module.exports;
}

const row = { validation_id: 'v', validation_item_id: 'line', pr1_item_id: 'item', effective_code: '',
  original_pr1_code: '', correction_id: '9007199254740993', changed_at: '2026-10-10T00:00:00Z', changed_by_name: 'Warehouse' };

test('current PR2 hint includes any status, uses existing SELECT only, and propagates errors', async () => {
  const queries = [];
  const api = loadApi(null, { data: [{ id: 'draft-pr2' }], error: null }, (...args) => queries.push(args));
  assert.equal(await api.hasCurrentWarehouseItemCodePR2('pr1'), true);
  assert.deepEqual(queries, [['from', 'pr2_requests'], ['select', 'id'], ['eq', 'pr1_id', 'pr1'], ['limit', 1]]);
  assert.equal(await loadApi(null).hasCurrentWarehouseItemCodePR2('pr1'), false);
  await assert.rejects(loadApi(null, { data: null, error: null }).hasCurrentWarehouseItemCodePR2('pr1'));
  const denied = { code: '42501', message: 'Denied' };
  await assert.rejects(loadApi(null, { data: null, error: denied }).hasCurrentWarehouseItemCodePR2('pr1'), e => e === denied);
});

test('save uses expected persisted code unchanged and returns only RPC output', async () => {
  let called;
  const api = loadApi(async (name, args) => { called = { name, args }; return { data: [row], error: null }; });
  assert.deepEqual(await api.updateWarehouseItemCode('line', '  old ', '  001-New  '), row);
  assert.deepEqual(called, { name: 'update_warehouse_item_code', args: {
    p_validation_item_id: 'line', p_expected_code: '  old ', p_new_code: '001-New',
  } });
});

test('save rejects errors, missing rows, extra rows, and wrong item identity', async () => {
  const denied = { code: '42501', message: 'Denied' };
  for (const response of [{ data: null, error: denied }, { data: null, error: null },
    { data: [], error: null }, { data: [row, row], error: null },
    { data: [{ ...row, validation_item_id: 'other' }], error: null }]) {
    const api = loadApi(async () => response);
    await assert.rejects(api.updateWarehouseItemCode('line', 'old', ''), error => response.error ? error === denied : error instanceof Error);
  }
});

test('read checks validation and item identities; RPC errors never become fallback data', async () => {
  const api = loadApi(async (name, args) => {
    assert.equal(name, 'get_warehouse_item_codes');
    assert.deepEqual(args, { p_validation_id: 'v' });
    return { data: [row], error: null };
  });
  assert.deepEqual(await api.getWarehouseItemCodes('v'), [row]);
  for (const data of [null, [{ ...row, validation_id: 'other' }], [row, row], [{ ...row, original_pr1_code: null }]]) {
    await assert.rejects(loadApi(async () => ({ data, error: null })).getWarehouseItemCodes('v'));
  }
  const stale = { code: '40001', message: 'Stale code' };
  await assert.rejects(loadApi(async () => ({ data: null, error: stale })).getWarehouseItemCodes('v'), e => e === stale);
  await assert.rejects(api.updateWarehouseItemCode('line', 'old', null));
});
