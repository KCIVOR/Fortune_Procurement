const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { NextRequest } = require('next/server');

const projectRoot = path.resolve(__dirname, '..');

function loadTypeScriptModule(relativePath, mocks = {}) {
  const filename = path.join(projectRoot, relativePath);
  const source = fs.readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      sourceMap: false,
    },
    fileName: filename,
  });
  const module = { exports: {} };
  const localRequire = (request) => {
    if (request in mocks) return mocks[request];
    if (request === '@/config/route-access') {
      return loadTypeScriptModule('config/route-access.ts', mocks);
    }
    return require(request);
  };
  const script = new vm.Script(`(function (require, module, exports, __filename, __dirname) {\n${outputText}\n})`, {
    filename,
  });
  script.runInThisContext()(localRequire, module, module.exports, filename, path.dirname(filename));
  return module.exports;
}

const routeAccess = loadTypeScriptModule('config/route-access.ts');

const uuid = '123e4567-e89b-12d3-a456-426614174000';
const otherUuid = '987e6543-e21b-34d3-b654-624681470999';

test('allows only Supervisor and Department Head approvers to read RFQ, Delivery, and GRN UUID details', () => {
  for (const position of ['Supervisor', 'Department Head']) {
    for (const resource of ['rfq', 'delivery', 'grn']) {
      assert.equal(
        routeAccess.isRoleAllowedForPath(`/${resource}/${uuid}?from=approval`, 'approver', position),
        true,
        `${position} should read /${resource}/${uuid}`,
      );
      assert.equal(
        routeAccess.isRoleAllowedForPath(`/${resource}/${uuid}/`, 'approver', position),
        true,
        `${position} should read a trailing-slash detail route`,
      );
    }
  }
});

test('keeps approver detail access bounded to canonical UUID routes', () => {
  for (const position of ['Supervisor', 'Department Head']) {
    const denied = [
      '/rfq',
      '/rfq/new',
      `/rfq/${uuid}/edit`,
      `/rfq/${uuid}/print`,
      `/rfq/${uuid}/nested`,
      `/rfq/${uuid}/extra/segment`,
      `/rfq/${uuid.replace('-', '')}`,
      `/rfq/${otherUuid.replace('e', 'g')}`,
      '/delivery',
      '/delivery/new',
      `/delivery/${uuid}/edit`,
      '/grn',
      '/grn/new',
      `/grn/${uuid}/print`,
      `/po/${uuid}`,
      `/pr2/${uuid}`,
    ];
    for (const pathname of denied) {
      assert.equal(
        routeAccess.isRoleAllowedForPath(pathname, 'approver', position),
        false,
        `${position} should not access ${pathname}`,
      );
    }
  }
});

test('retains existing Director and other approver position rules', () => {
  assert.equal(routeAccess.isRoleAllowedForPath(`/rfq/${uuid}`, 'approver', 'Director'), true);
  assert.equal(routeAccess.isRoleAllowedForPath(`/po/${uuid}`, 'approver', 'Director'), true);
  assert.equal(routeAccess.isRoleAllowedForPath(`/rfq/${uuid}`, 'approver', 'Finance Director'), false);
  assert.equal(routeAccess.isRoleAllowedForPath(`/rfq/${uuid}`, 'approver', 'Supervisor '), false);
  assert.equal(routeAccess.isRoleAllowedForPath(`/po/${uuid}/print`, 'approver', 'Finance Director'), true);
  assert.equal(routeAccess.isRoleAllowedForPath(`/pr2/${uuid}/print`, 'approver', 'Finance Director'), true);
  for (const role of ['employee', 'warehouse', 'supplier', 'tsqa']) {
    assert.equal(routeAccess.isRoleAllowedForPath(`/rfq/${uuid}`, role, null), false);
  }
  assert.equal(routeAccess.isRoleAllowedForPath(`/rfq/${uuid}`, 'procurement', null), true);
  assert.equal(routeAccess.isRoleAllowedForPath(`/rfq/${uuid}`, 'admin', null), true);
});

function createMiddlewareMock() {
  return {
    createMiddlewareSupabaseClient(request) {
      const role = request.headers.get('x-test-role') || 'approver';
      const position = request.headers.get('x-test-position') || null;
      const response = require('next/server').NextResponse.next();
      const profile = {
        active: true,
        roles: { name: role },
        positions: position ? { title: position } : null,
      };
      const supabase = {
        auth: {
          getUser: async () => ({ data: { user: { id: 'test-user' } } }),
          signOut: async () => ({}),
        },
        from() {
          return {
            select(selection) {
              return {
                eq() {
                  return {
                    maybeSingle: async () => ({
                      data: selection === 'active' ? { active: profile.active } : profile,
                      error: null,
                    }),
                  };
                },
              };
            },
          };
        },
      };
      return { supabase, response };
    },
  };
}

const middleware = loadTypeScriptModule(
  'middleware.ts',
  {
    '@/config/route-access': routeAccess,
    '@/lib/supabase/middleware': createMiddlewareMock(),
    '@/types/auth': {},
  },
);

async function runMiddleware(pathname, position, role = 'approver') {
  const request = new NextRequest(`http://localhost${pathname}`, {
    headers: {
      'x-test-role': role,
      ...(position ? { 'x-test-position': position } : {}),
    },
  });
  return middleware.middleware(request);
}

test('middleware allows authenticated related-record details and redirects denied routes', async () => {
  for (const position of ['Supervisor', 'Department Head']) {
    for (const resource of ['rfq', 'delivery', 'grn']) {
      const response = await runMiddleware(`/${resource}/${uuid}?source=approval`, position);
      assert.equal(response.status, 200, `${position} detail should pass middleware`);
      assert.equal(response.headers.get('location'), null);
    }

    for (const pathname of [`/${position === 'Supervisor' ? 'rfq' : 'delivery'}`, `/rfq/${uuid}/edit`, `/grn/${uuid}/print`, `/po/${uuid}`]) {
      const response = await runMiddleware(pathname, position);
      assert.equal(response.status, 307, `${position} should be redirected from ${pathname}`);
      assert.match(response.headers.get('location') || '', /\/dashboard\?access=denied/);
    }
  }
});

test('middleware preserves Director and Finance Director behavior', async () => {
  const director = await runMiddleware(`/po/${uuid}`, 'Director');
  assert.equal(director.status, 200);

  const financeDetail = await runMiddleware(`/rfq/${uuid}`, 'Finance Director');
  assert.equal(financeDetail.status, 307);

  const financePrint = await runMiddleware(`/po/${uuid}/print`, 'Finance Director');
  assert.equal(financePrint.status, 200);
});
