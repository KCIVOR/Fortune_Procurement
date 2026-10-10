// Actual reader/sync/PO functions, synthetic transport only. No network or credentials.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function fixture(options = {}) {
  const item = { id: 'item', pr1_id: 'pr1', item_order: 1, item_code: '001-ORIGINAL', description: 'Original', unit_of_measure: 'pc', quantity_requested: 7, is_raw_material: false };
  const rfqs = ['rfq1', 'rfq2'].map((id, i) => ({ id, pr1_id: 'pr1', pr2_id: `pr2-${i + 1}`, rfq_number: id, status: 'open' }));
  const tables = {
    pr1_requests: [{ id: 'pr1', requisitioner_id: 'requestor', pr1_number: 'PR1-TEST', purpose: 'Test', request_type: 'goods' }],
    pr1_items: [item],
    rfq_batches: rfqs,
    rfq_suppliers: rfqs.map((r, i) => ({ id: `slot${i + 1}`, rfq_id: r.id, supplier_id: 'supplier', supplier_name_snapshot: 'Supplier', status: 'submitted' })),
    rfq_item_quotes: rfqs.map((r, i) => ({ id: `quote${i + 1}`, rfq_supplier_id: `slot${i + 1}`, pr1_item_id: 'item',
      is_alternative: true, quoted_description: 'Alternative', unit_price: 15, submitted_at: '2026-10-10T00:00:00Z', remarks: 'Keep commercial data' })),
    profiles: [], warehouse_validations: [], warehouse_validation_items: [],
    substitute_decisions: [], supplier_item_selections: [],
    pr2_requests: [{ id: 'pr2-1', pr1_id: 'pr1', pr2_number: 'PR2-TEST', status: 'approved', request_type: 'goods', rfq_id: 'rfq1' }],
    pr2_items: [{ ...item, id: 'pr2-item', pr2_id: 'pr2-1', pr1_item_id: 'item', item_code: '', quantity_to_purchase: 7,
      unit_price: 15, selected_rfq_supplier_id: 'slot1', supplier_name_snapshot: 'Supplier' }],
    po_requests: [], po_items: [],
    ...options.tables,
  };
  const calls = [];
  const snapshots = { rfq1: [{ pr1_item_id: 'item', item_code: '' }], rfq2: [{ pr1_item_id: 'item', item_code: '0002-SECOND' }], ...options.snapshots };
  const db = {
    rpc: async (name, args) => {
      calls.push({ type: 'rpc', name, args });
      assert.equal(name, 'get_rfq_warehouse_item_code_snapshots');
      if (options.denied) return { data: null, error: { code: '42501', message: 'Denied snapshot' } };
      return { data: options.malformed ? null : snapshots[args.p_rfq_id] ?? [], error: null };
    },
    from: table => {
      let filters = [], single = false, action = 'select', payload;
      const chain = {
        select: () => chain,
        eq: (key, value) => { filters.push(row => row[key] === value); return chain; },
        in: (key, values) => { filters.push(row => values.includes(row[key])); return chain; },
        not: (key, operator, value) => { assert.equal(operator, 'is'); filters.push(row => row[key] != value); return chain; },
        order: () => chain,
        maybeSingle: () => { single = true; return chain; },
        single: () => { single = true; return chain; },
        update: value => { action = 'update'; payload = value; return chain; },
        insert: value => { action = 'insert'; payload = value; return chain; },
        then: (accept, reject) => Promise.resolve().then(() => {
          let rows = (tables[table] ?? []).filter(r => filters.every(f => f(r)));
          if (action !== 'select') {
            calls.push({ type: action, table, payload: structuredClone(payload) });
            if (action === 'update') rows.forEach(r => Object.assign(r, payload));
            if (action === 'insert') {
              rows = (Array.isArray(payload) ? payload : [payload]).map((r, i) => ({ id: `generated-${table}-${i}`, ...r }));
              (tables[table] ??= []).push(...rows);
            }
          }
          return { data: single ? rows[0] ?? null : rows, error: null, count: rows.length };
        }).then(accept, reject),
      };
      return chain;
    },
  };
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const source = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    const requireMock = name => {
      if (name === '@/lib/supabase' || name === './supabase') return { supabase: db };
      if (name === './warehouse-item-code' || name === '@/lib/warehouse-item-code') return load('lib/warehouse-item-code.ts');
      if (name === './warehouse-item-code-data' || name === '@/lib/warehouse-item-code-data') return load('lib/warehouse-item-code-data.ts');
      if (name === './pr1') return { fetchPR1Attachments: async () => [{ id: 'attachment', pr1_item_id: 'item', storage_path: 'unchanged' }] };
      if (name === '@/lib/vat') return {
        getVatSettings: async () => ({ vat_rate: 12 }),
        computeLineVat: (price, qty) => ({ total: price * qty, vatAmount: 0, vatType: null, baseAmount: price * qty }),
      };
      if (name === '@/lib/pr2-classification') return load('lib/pr2-classification.ts');
      if (name === '@/lib/pr2-rfq-sync') return file === 'lib/po.ts' ? { isRfqApprovalComplete: async () => true } : load('lib/pr2-rfq-sync.ts');
      if (name === '@/lib/canvassing') return load('lib/canvassing.ts');
      if (name === '@/lib/auth-session') return { requireAuthUserId: async () => 'test-user' };
      if (name === '@/lib/notifications' || name === '@/lib/rfq-approvals' || name === '@/lib/authenticated-fetch') return {};
      throw new Error(`Unexpected dependency ${name} in ${file}`);
    };
    const processMock = { env: {} };
    new Function('require', 'module', 'exports', 'process', source)(requireMock, module, module.exports, processMock);
    return module.exports;
  }
  return { api: load('lib/canvassing.ts'), load, calls, tables };
}

test('RFQ detail and comparison matrix overlay only codes, preserving quantities, quotes and attachments', async () => {
  const enabled = fixture(), baseline = fixture({ snapshots: { rfq1: [] } });
  const detail = await enabled.api.fetchRfqDetail('rfq1');
  const original = await baseline.api.fetchRfqDetail('rfq1');
  assert.equal(detail.items[0].item_code, '');
  assert.equal(original.items[0].item_code, '001-ORIGINAL');
  assert.deepEqual({ ...detail, items: original.items }, original);
  assert.deepEqual(detail.items[0], { ...original.items[0], item_code: '' });
  assert.equal(enabled.api.buildQuoteMatrix(detail)[0].item.item_code, '');
  assert.equal(enabled.tables.pr1_items[0].item_code, '001-ORIGINAL');
});

test('supplier detail keeps ownership check and applies exact RFQ code', async () => {
  const f = fixture();
  const detail = await f.api.fetchSupplierQuoteDetail('slot2', 'supplier');
  assert.equal(detail.items[0].item_code, '0002-SECOND');
  assert.equal(detail.items[0].quantity_requested, 7);
  assert.equal(await f.api.fetchSupplierQuoteDetail('slot1', 'other-supplier'), null);
  assert.deepEqual(f.calls.filter(c => c.type === 'rpc').map(c => c.args.p_rfq_id), ['rfq2']);
});

test('both substitute loaders cache by RFQ, never one global code per PR1 item', async () => {
  for (const method of ['fetchSubstituteReviewBundles', 'fetchSubstituteBundleForPr1']) {
    const f = fixture();
    const result = method === 'fetchSubstituteReviewBundles' ? (await f.api[method]())[0] : await f.api[method]('pr1');
    assert.deepEqual(result.substitutes.map(s => [s.rfq_id, s.item_code]), [['rfq1', ''], ['rfq2', '0002-SECOND']]);
    assert.deepEqual(f.calls.filter(c => c.type === 'rpc').map(c => c.args.p_rfq_id).sort(), ['rfq1', 'rfq2']);
    assert.ok(result.substitutes.every(s => s.original_quantity === 7 && s.unit_price === 15));
  }
});

test('all four PR1 readers propagate denied and malformed correction responses', async () => {
  for (const options of [{ denied: true }, { malformed: true }]) {
    const f = fixture(options);
    await assert.rejects(f.api.fetchRfqDetail('rfq1'));
    await assert.rejects(f.api.fetchSupplierQuoteDetail('slot1', 'supplier'));
    await assert.rejects(f.api.fetchSubstituteReviewBundles());
    await assert.rejects(f.api.fetchSubstituteBundleForPr1('pr1'));
  }
});

test('PR2-native detail/supplier/substitute readers do not call correction RPC', async () => {
  const f = fixture({ tables: {
    rfq_batches: [{ id: 'native', pr1_id: null, pr2_id: 'pr2-1', status: 'open' }],
    rfq_suppliers: [{ id: 'native-slot', rfq_id: 'native', supplier_id: 'supplier' }],
    rfq_item_quotes: [{ id: 'native-quote', rfq_supplier_id: 'native-slot', pr2_item_id: 'pr2-item', is_alternative: true, submitted_at: '2026-10-10', unit_price: 15 }],
  } });
  assert.equal((await f.api.fetchRfqDetail('native')).items[0].item_code, '');
  assert.equal((await f.api.fetchSupplierQuoteDetail('native-slot', 'supplier')).items[0].item_code, '');
  assert.equal((await f.api.fetchSubstituteReviewBundles())[0].substitutes[0].item_code, '');
  assert.equal(f.calls.filter(c => c.type === 'rpc').length, 0);
});

test('uncorrected history stays original and corrected readers work without rollout flags', async () => {
  const f = fixture({ snapshots: { rfq1: [] } });
  assert.equal((await f.api.fetchRfqDetail('rfq1')).items[0].item_code, '001-ORIGINAL');
  const off = fixture();
  assert.equal((await off.api.fetchSupplierQuoteDetail('slot1', 'supplier')).items[0].item_code, '');
  assert.equal(off.calls.filter(c => c.type === 'rpc').length, 1);
});

test('actual quote sync preserves existing PR2 code; actual PO generator inherits blank snapshot', async () => {
  const f = fixture({ tables: {
    supplier_item_selections: [{ rfq_id: 'rfq1', pr1_item_id: 'item', selected_rfq_supplier_id: 'slot1' }],
    rfq_item_quotes: [{ id: 'quote1', rfq_supplier_id: 'slot1', pr1_item_id: 'item', unit_price: 15, is_alternative: false }],
  } });
  await f.load('lib/pr2-rfq-sync.ts').syncPR2ItemsFromRfqSelections('pr2-1', 'rfq1', { id: 'procurement', full_name: 'Buyer' });
  assert.equal(f.tables.pr2_items[0].item_code, '');
  const update = f.calls.find(c => c.table === 'pr2_items' && c.type === 'update');
  assert.ok(!Object.hasOwn(update.payload, 'item_code'));
  await f.load('lib/po.ts').generatePOFromPR2('pr2-1', 'supplier', {
    po_number: 'PO-TEST', delivery_address: 'Test', warehouse: 'Test', payment_terms: '', packing: '', remarks: '',
  }, { id: 'procurement' }, ['slot1']);
  assert.equal(f.tables.po_items[0].item_code, '');
  assert.equal(f.tables.po_items[0].quantity_to_purchase, 7);
  assert.equal(f.tables.po_items[0].unit_price, 15);
  assert.equal(f.tables.po_items[0].total_price, 105);
  assert.equal(f.tables.po_items[0].description, f.tables.pr2_items[0].description);
});
