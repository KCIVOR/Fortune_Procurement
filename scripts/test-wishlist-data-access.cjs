const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
function load(mocks = {}) {
  const filename = path.join(root, 'lib/wishlist.ts');
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  const localRequire = (request) => request in mocks ? mocks[request] : require(request);
  vm.runInNewContext(`(function(require,module,exports){${source}\n})`, { console, process })(localRequire, module, module.exports);
  return module.exports;
}

function chain(result) {
  const query = {
    select() { return query; },
    eq() { return query; },
    order() { return query; },
    maybeSingle: async () => result,
    single: async () => result,
    then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
  };
  return query;
}

test('createWishlistItem trims input and scopes insert to the authenticated user', async () => {
  const calls = [];
  const wishlist = load({
    '@/lib/supabase': {
      db: {
        auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
        from(table) { calls.push({ table }); return { insert(rows) { calls.push({ rows }); return chain({ data: { id: 'w1' }, error: null }); } }; },
      },
    },
  });
  const result = await wishlist.createWishlistItem({ title: '  Better reports  ', description: '  Add export  ', category: '  Reporting ' });
  assert.equal(result.id, 'w1');
  assert.equal(JSON.stringify(calls[1].rows[0]), JSON.stringify({ user_id: 'user-1', title: 'Better reports', description: 'Add export', category: 'Reporting', status: 'open' }));
});

test('listMyWishlistItems always filters by the requested owner', async () => {
  const filters = [];
  const wishlist = load({
    '@/lib/supabase': { db: { from() { return { select() { return { eq(field, value) { filters.push({ field, value }); return { order: async () => ({ data: [], error: null }) }; } }; } }; } } },
  });
  await wishlist.listMyWishlistItems('user-7');
  assert.equal(JSON.stringify(filters), JSON.stringify([{ field: 'user_id', value: 'user-7' }]));
});

test('adminUpdateWishlistItem rejects non-admin profiles before querying', async () => {
  let queried = false;
  const wishlist = load({ '@/lib/supabase': { db: { from() { queried = true; return {}; } } } });
  await assert.rejects(() => wishlist.adminUpdateWishlistItem('w1', { status: 'planned' }, { role: 'employee' }), /admin/i);
  assert.equal(queried, false);
});
