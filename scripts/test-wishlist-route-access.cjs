const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
function load(relativePath) {
  const filename = path.join(root, relativePath);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports){${source}\n})`, { console, process })(
    (request) => request === '@/types/auth' ? {} : require(request), module, module.exports,
  );
  return module.exports;
}

const routeAccess = load('config/route-access.ts');
const navigation = load('config/navigation.ts');

test('allows every application role to access wishlist and keeps admin restricted', () => {
  for (const role of ['employee', 'warehouse', 'procurement', 'approver', 'supplier', 'admin', 'tsqa']) {
    assert.equal(routeAccess.isRoleAllowedForPath('/wishlist', role, null), true, `${role} /wishlist`);
    assert.equal(routeAccess.isRoleAllowedForPath('/wishlist/', role, null), true, `${role} /wishlist/`);
  }
  assert.equal(routeAccess.isRoleAllowedForPath('/admin', 'employee', null), false);
});

test('wishlist route is authenticated and does not widen unrelated protected routes', () => {
  const wishlistRule = routeAccess.ROUTE_ACCESS_RULES.find((rule) => rule.prefix === '/wishlist');
  assert.equal(wishlistRule?.prefix, '/wishlist');
  assert.equal(wishlistRule?.decision?.kind, 'authenticated');
  assert.equal(routeAccess.evaluateRouteAccess('/wishlist').kind, 'authenticated');
  assert.equal(routeAccess.evaluateRouteAccess('/wishlist/').kind, 'authenticated');
  assert.equal(routeAccess.isRoleAllowedForPath('/admin', 'approver', null), false);
  assert.equal(routeAccess.isRoleAllowedForPath('/rfq', 'employee', null), false);
});

test('wishlist is header-only and absent from sidebar navigation', () => {
  for (const [role, items] of Object.entries(navigation.ROLE_NAV)) {
    assert.equal(items.some((item) => item.href === '/wishlist'), false, `${role} sidebar navigation`);
  }
  const header = fs.readFileSync(path.join(root, 'components/layout/TopHeader.tsx'), 'utf8');
  assert.match(header, /href="\/wishlist"/);
});
