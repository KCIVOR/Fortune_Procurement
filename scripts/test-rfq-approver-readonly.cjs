const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');
const React = require('react');

const root = path.resolve(__dirname, '..');
const pr2Id = '149e10d8-5375-466f-b12b-ac9320fe2279';

function compile(file) {
  return ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    fileName: file,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
}

const pageCode = compile('app/rfq/[id]/page.tsx');
const pricingCode = compile('lib/price-visibility.ts');
const pricingModule = { exports: {} };
vm.runInNewContext(pricingCode, { exports: pricingModule.exports });

function renderPage({ role = 'approver', position = 'Supervisor', status = 'open', selected = true, noSuppliers = false } = {}) {
  const item = {
    id: 'item-1', item_order: 1, item_code: 'PUMP', description: 'Replacement pump',
    quantity_requested: 2, unit_of_measure: 'pcs', is_raw_material: false, attachments: [],
  };
  const suppliers = noSuppliers ? [] : [
    { id: 'supplier-1', supplier_id: 'user-supplier', supplier_name_snapshot: 'Confidential supplier', status: 'submitted' },
    { id: 'external-1', supplier_id: null, supplier_name_snapshot: 'External vendor', status: 'invited', is_external: true },
  ];
  const detail = {
    rfq: { id: 'rfq-1', rfq_number: 'RFQ-TEST-001', pr1_id: 'pr1-1', status, notes: 'Requested repair' },
    pr1: { pr1_number: 'PR1-TEST-001', department_name_snapshot: 'Finance', purpose: 'Maintenance', request_type: 'goods' },
    items: [item], suppliers,
    allSuppliers: [{ id: 'available-1', full_name: 'Available supplier', email: null }],
  };
  const matrix = [{
    item, selected_rfq_supplier_id: selected ? 'supplier-1' : null,
    quotes: noSuppliers ? [] : [{
      rfq_supplier_id: 'supplier-1', quote_id: 'quote-1', unit_price: 12345.67,
      total_price: 24691.34, quoted_description: 'Confidential quotation', lead_time_days: '3 days',
      supplier_product_item_type: 'goods', response_status: 'quoted',
      attachments: [{ id: 'quote-file', file_name: 'confidential-quote.pdf' }],
    }],
  }];
  const profile = { id: 'audit-user', role, position };
  const pushed = [];
  const effects = [];
  const modals = [];
  // Seed the existing page's loaded state; all other hooks keep their defaults.
  // These slots correspond to detail, matrix, loading, and existingPR2Id.
  const states = new Map([[0, detail], [1, matrix], [2, false], [6, pr2Id]]);
  let hookIndex = 0;
  const hooks = {
    ...React,
    useState(initial) {
      const index = hookIndex++;
      return [states.has(index) ? states.get(index) : (typeof initial === 'function' ? initial() : initial), () => {}];
    },
    useEffect() {},
    useCallback(fn) { return fn; },
  };
  const passthrough = ({ children }) => children ?? null;
  const exportsFor = (component) => ({ __esModule: true, default: component });
  const modules = {
    react: hooks,
    'react/jsx-runtime': require('react/jsx-runtime'),
    'next/navigation': { useParams: () => ({ id: detail.rfq.id }), useRouter: () => ({ push: (url) => pushed.push(url) }) },
    'next/link': exportsFor(({ href, children }) => React.createElement('a', { href }, children)),
    '@/context/AuthContext': { useAuth: () => ({ profile }) },
    '@/hooks/use-back-navigation': { useBackNavigation: () => ({ handleBack() {} }) },
    '@/lib/price-visibility': pricingModule.exports,
    '@/lib/supplier-supply-type': { SUPPLY_TYPE_FILTER_OPTIONS: [], matchesSupplyTypeFilter: () => true },
    '@/components/shared/DetailHeaderLayout': exportsFor(({ left, right }) => React.createElement('div', null, left, right)),
    '@/components/shared/DetailInfoField': exportsFor(({ label, value }) => React.createElement('div', null, label, ': ', value)),
    '@/components/shared/DetailBackButton': exportsFor(({ onClick }) => React.createElement('button', { onClick }, 'Back')),
    '@/components/shared/RequestTypeBadge': { RequestTypeBadge: () => null },
    '@/components/pr1/PR1AttachmentsSection': { PR1AttachmentsGallery: () => null },
    '@/components/rfq/QuoteAttachmentPills': exportsFor(({ attachments }) => attachments.map(a => a.file_name).join(', ')),
    '@/components/canvassing/AssignSuppliersModal': exportsFor(props => { modals.push({ name: 'assign', props }); return null; }),
    '@/components/canvassing/JustificationModal': exportsFor(props => { modals.push({ name: 'justify', props }); return null; }),
    '@/lib/canvassing': new Proxy({}, { get: (_, name) => async () => { effects.push(name); return { ok: true }; } }),
    '@/lib/pr2': { fetchPR2ByRfqId: async () => ({ id: pr2Id }) },
    '@/lib/rfq-approvals': { fetchRfqApprovalInstanceForRfq: async () => null, fetchRfqApprovalDetail: async () => null },
    '@/lib/supabase': { db: { from: () => { effects.push('database'); throw new Error('Unexpected database call'); } } },
    '@/lib/authenticated-fetch': { authFetch: async () => { effects.push('email'); } },
    '@/lib/viber-utils': { formatRfqForViber: () => 'RFQ summary' },
    sonner: { toast: { success() {}, error() {} } },
    'date-fns': { format: () => 'September 21, 2026' },
    'lucide-react': new Proxy({}, { get: () => () => null }),
  };
  const module = { exports: {} };
  vm.runInNewContext(pageCode, {
    module, exports: module.exports,
    require(name) {
      if (name in modules) return modules[name];
      if (name.startsWith('@/components/')) return exportsFor(passthrough);
      throw new Error(`Unmocked module: ${name}`);
    },
    navigator: { clipboard: { writeText: async () => { effects.push('clipboard'); } } },
    console,
  });

  const nodes = [];
  const text = [];
  function walk(element) {
    if (element == null || typeof element === 'boolean') return;
    if (Array.isArray(element)) { element.forEach(walk); return; }
    if (typeof element === 'string' || typeof element === 'number') { text.push(String(element)); return; }
    if (typeof element.type === 'function') { walk(element.type(element.props)); return; }
    if (typeof element.type === 'string') nodes.push(element);
    walk(element.props?.children);
  }
  walk(module.exports.default());
  function nodeText(element) {
    if (element == null || typeof element === 'boolean') return '';
    if (Array.isArray(element)) return element.map(nodeText).join('');
    if (typeof element !== 'object') return String(element);
    if (typeof element.type === 'function') return nodeText(element.type(element.props));
    return nodeText(element.props?.children);
  }
  const buttons = nodes.filter(node => node.type === 'button').map(node => ({
    label: nodeText(node).trim(), title: node.props.title ?? '', onClick: node.props.onClick,
  }));
  return { text: text.join(' '), buttons, modals, pushed, effects };
}

for (const position of ['Supervisor', 'Department Head']) {
  for (const status of ['draft', 'open', 'closed']) {
    test(`${position} reads ${status} RFQ without management or commercial content`, () => {
      const page = renderPage({ position, status });
      assert.match(page.text, /RFQ-TEST-001/);
      assert.match(page.text, /Replacement pump/);
      assert.match(page.text, /Finance/);
      const forbidden = page.buttons.filter(b => !['Back', 'View PR2'].includes(b.label));
      assert.deepEqual(forbidden.map(b => b.label || b.title), []);
      assert.equal(page.modals.length, 0, 'Approvers must not receive mutation modal callbacks');
      assert.doesNotMatch(page.text, /Confidential supplier|Confidential quotation|confidential-quote\.pdf|12,345\.67|24,691\.34/);
      assert.match(page.text, /quotation.*restricted/i);
    });
  }
  test(`${position} with restricted supplier rows is not told to assign suppliers`, () => {
    const page = renderPage({ position, status: 'draft', noSuppliers: true });
    assert.doesNotMatch(page.text, /No suppliers assigned yet|Assign suppliers to begin|Assign at least/);
    assert.match(page.text, /Replacement pump/);
  });
  test(`${position} View PR2 opens the approval detail`, async () => {
    const page = renderPage({ position, status: 'closed' });
    const view = page.buttons.find(b => b.label === 'View PR2');
    assert.ok(view);
    await view.onClick();
    assert.deepEqual(page.pushed, [`/approvals/pr2/${pr2Id}`]);
    assert.deepEqual(page.effects, []);
  });
}

for (const role of ['procurement', 'admin']) {
  test(`${role} retains RFQ issuing, supplier management and quotation visibility`, () => {
    const page = renderPage({ role, position: role === 'admin' ? 'System Administrator' : 'Buyer', status: 'draft' });
    for (const label of ['Issue RFQ', 'Send Email', 'Copy for Viber', 'Canvass Supplier']) {
      assert.ok(page.buttons.some(b => b.label === label), label);
    }
    assert.match(page.text, /Confidential supplier/);
    assert.match(page.text, /12,345\.67/);
  });
  test(`${role} retains winner selection and external quote entry`, () => {
    const page = renderPage({ role, status: 'open', selected: false });
    assert.ok(page.buttons.some(b => b.label === 'Select'));
    assert.ok(page.buttons.some(b => b.label === 'Enter quote'));
  });
  test(`${role} retains RFQ closing and reopening`, () => {
    assert.ok(renderPage({ role, status: 'open' }).buttons.some(b => b.label === 'Close & Submit for Approval'));
    assert.ok(renderPage({ role, status: 'closed' }).buttons.some(b => b.label === 'Reopen RFQ'));
  });
}

test('Director can still view commercial quotations, with read-only controls', () => {
  const page = renderPage({ position: 'Director' });
  assert.match(page.text, /12,345\.67/);
  assert.match(page.text, /confidential-quote\.pdf/);
  assert.deepEqual(page.buttons.map(b => b.label), ['Back']);
  assert.equal(page.modals.length, 0);
});

test('Procurement View PR2 keeps its procurement detail route', async () => {
  const page = renderPage({ role: 'procurement', status: 'closed' });
  await page.buttons.find(b => b.label === 'View PR2').onClick();
  assert.deepEqual(page.pushed, [`/pr2/${pr2Id}`]);
});
