const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');
// Build first, then run this suite: a concurrent build replaces .next CSS.
// Require and snapshot the real styles rather than silently testing an unstyled page.
const cssDir = path.join(root, '.next/static/css');
assert.ok(fs.existsSync(cssDir), 'Run npm run build before the editor browser suite');
const styles = fs.readdirSync(cssDir).filter(f => f.endsWith('.css'))
  .map(file => fs.readFileSync(path.join(cssDir, file), 'utf8'));
assert.ok(styles.length > 0, 'Production CSS is required; do not run concurrently with next build');
const compiled = ts.transpileModule(fs.readFileSync(path.join(root, 'app/warehouse/[id]/page.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
const requesterPages = Object.fromEntries(['detail','print'].map(kind => [kind, ts.transpileModule(
  fs.readFileSync(path.join(root, kind === 'detail' ? 'app/pr1/[id]/page.tsx' : 'app/pr1/[id]/print/page.tsx'),'utf8'),
  {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}},
).outputText]));

async function mount(browser, options = {}) {
  const page = await browser.newPage();
  page.on('pageerror', error => process.stderr.write(`Synthetic browser error: ${error.message}\n`));
  await page.setViewport({ width: options.narrow ? 390 : 1280, height: 900 });
  await page.setContent('<div id="root"></div>');
  await page.addScriptTag({ path: path.join(root, 'node_modules/react/umd/react.development.js') });
  await page.addScriptTag({ path: path.join(root, 'node_modules/react-dom/umd/react-dom.development.js') });
  // Styling is the required real application build, not a test-only layout.
  for (const content of styles) await page.addStyleTag({ content });
  await page.evaluate(({ compiled, options }) => {
    const React = window.React;
    const profile = { id: options.role === 'employee' ? 'requestor' : 'warehouse', role: options.role || 'warehouse', active: options.active !== false, full_name: 'Test Warehouse' };
    const original = { id: 'item', item_code: options.staleInitial ? '001-ORIGINAL' : options.effectiveCode ?? '002-CORRECTED', item_order: 1, description: 'Synthetic item', unit_of_measure: 'pc',
      quantity_requested: 10, stock_on_hand: 0, attachments: [], remarks: '', is_raw_material: false };
    const pr1 = { id: 'pr1', pr1_number: 'PR1-TEST', request_type: options.requestType || 'goods', status: options.status || 'approved_for_warehouse',
      purpose: 'Synthetic test only', requisitioner_id: 'requestor', submitted_at: '2026-10-10T00:00:00Z', date_required: '2026-10-20', items: [original] };
    const validation = { id: 'validation', pr1_id: 'pr1', decision: options.completed ? 'sufficient' : null, notes: 'Saved overall notes',
      items: [{ ...original, id: 'line', validation_id: 'validation', pr1_item_id: 'item', requestor_soh: 0, validated_soh: 20,
        item_notes: 'Saved line notes', quantity_override_reason: '', availability: 'available' }] };
    const persisted = { validation_id: 'validation', validation_item_id: 'line', pr1_item_id: 'item', original_pr1_code: options.effectiveCode ?? '002-CORRECTED',
      effective_code: options.effectiveCode ?? '002-CORRECTED', correction_id: '1', changed_at: '2026-10-10T00:00:00Z', changed_by_name: 'Test Warehouse' };
    const state = window.fixture = { calls: [], persisted, reads: 0 };
    if (options.twoLines) {
      pr1.items.push({ ...original, id: 'item2', item_order: 2 });
      validation.items.push({ ...validation.items[0], id: 'line2', pr1_item_id: 'item2', item_order: 2 });
      state.persistedTwo = { ...persisted, validation_item_id: 'line2', pr1_item_id: 'item2' };
    }
    const empty = () => null;
    const shell = ({ children }) => React.createElement('main', null, children);
    const data = {
      getWarehouseItemCodes: async () => {
        state.reads++;
        if (options.readError || state.readError) throw { code: '42501', message: 'Item-code read denied' };
        return options.missingLine ? [] : [{ ...state.persisted }, ...(state.persistedTwo ? [{ ...state.persistedTwo }] : [])];
      },
      hasCurrentWarehouseItemCodePR2: async () => Boolean(options.currentPR2),
      updateWarehouseItemCode: async (line, expected, attempted) => {
        state.calls.push({ type: 'code', line, expected, attempted });
        if (options.conflict && !state.conflicted) {
          state.conflicted = true;
          state.persisted.effective_code = '003-CONCURRENT';
          state.persisted.original_pr1_code = '003-CONCURRENT';
          throw { code: '40001', message: 'Changed elsewhere' };
        }
        if (options.saveError) throw { code: '42501', message: 'Item-code save denied' };
        if (options.pending) await new Promise(resolve => { state.finishSave = resolve; });
        const key = line === 'line2' ? 'persistedTwo' : 'persisted';
        const saved = attempted.replace(/^ +| +$/g, '');
        state[key] = { ...state[key], effective_code: saved, original_pr1_code: saved };
        if (options.ambiguous && !state.ambiguous) {
          state.ambiguous = true;
          throw { message: 'Connection lost after commit' };
        }
        return { ...state[key] };
      },
    };
    const warehouse = {
      openValidation: async () => validation,
      fetchPR1RevisionRemarks: async () => null,
      saveValidationProgress: async (...args) => state.calls.push({ type: 'progress', args }),
      submitValidationDecision: async (...args) => { state.calls.push({ type: 'submit', args }); return {}; },
      submitWarehouseTerminalAction: async (...args) => state.calls.push({ type: 'terminal', args }),
      computeWarehouseItemRouting: (soh, qty) => ({ item_route: soh >= qty ? 'internal' : soh > 0 ? 'partial' : 'procurement',
        internal_fulfilled_qty: Math.min(soh, qty), procurement_qty: Math.max(qty - soh, 0), availability: soh >= qty ? 'available' : 'unavailable' }),
    };
    // Observe real hook values without adding test-only exports to the page.
    const observedReact = { ...React, useState(initial) {
      const pair = React.useState(initial);
      const value = pair[0];
      if (value && typeof value === 'object' && Array.isArray(value.items)) {
        if (value.id === 'pr1') state.renderedPR1 = value;
        else if (value.id === 'validation') state.renderedValidation = value;
        else if (!('id' in value)) state.renderedForm = value;
      }
      return pair;
    } };
    const require = name => {
      if (name === 'react') return observedReact;
      if (name === 'react/jsx-runtime') return { Fragment: React.Fragment, jsx: (type, props, key) => React.createElement(type, { ...props, key }), jsxs: (type, props, key) => React.createElement(type, { ...props, key }) };
      if (name === 'next/navigation') return { useParams: () => ({ id: 'pr1' }), useRouter: () => ({ push: url => state.calls.push({ type: 'navigate', url }) }) };
      if (name === 'next/link') return { __esModule: true, default: ({ children, href, ...rest }) => React.createElement('a', { ...rest, href }, children) };
      if (name === '@/context/AuthContext') return { useAuth: () => ({ profile }) };
      if (name === '@/lib/pr1') return { fetchPR1ById: async () => { state.pr1Reads=(state.pr1Reads||0)+1; return pr1; },
        canUpdatePR1Priority:()=>false,fetchPR1LifecycleSummaries:async()=>({}),fetchDownstreamRejectionRemark:async()=>null,fetchWarehouseQtyOverrides:async()=>[] };
      if (name === '@/hooks/use-back-navigation') return {useBackNavigation:()=>({handleBack:()=>{}})};
      if (name === '@/lib/pr1-access') return {canViewPr1Detail:()=>true};
      if (name === '@/lib/approvals') return {fetchPR1ApprovalSignatories:async()=>null};
      if (name === '@/lib/print-approval-signatures') return {labelForApprovalAction:()=>'',latestActionForStep:()=>null};
      if (name === '@/types/pr1') return {PR1_STATUS_LABELS:{approved_for_warehouse:'Warehouse review'}};
      if (name === '@/lib/warehouse') return warehouse;
      if (name === '@/lib/warehouse-item-code-data') return data;
      if (name === '@/lib/pr2') return { fetchSuggestedPR2Sequence: async () => '0001' };
      if (name === 'date-fns') return { format: () => 'October 10, 2026' };
      if (name === 'lucide-react') return new Proxy({}, { get: () => empty });
      if (name.startsWith('@/components/')) return new Proxy({ __esModule: true, default: name.endsWith('AppShell') || (options.reader && name.includes('/Detail')) ? shell : empty }, { get: (obj, key) => obj[key] ?? empty });
      throw new Error(`Unexpected import: ${name}`);
    };
    const module = { exports: {} };
    const process = { env: {
    } };
    new Function('require', 'module', 'exports', 'process', compiled)(require, module, module.exports, process);
    window.print=()=>{};
    window.ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(module.exports.default));
  }, { compiled: options.reader ? requesterPages[options.reader] : compiled, options });
  await page.waitForFunction(() => document.body.textContent.includes('Synthetic item'));
  await page.waitForFunction(() => !document.body.textContent.includes('Loading item codes'));
  return page;
}

async function button(page, text) {
  const found = await page.evaluateHandle(text => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === text), text);
  const element = found.asElement();
  assert.ok(element, `Expected button: ${text}`);
  return element;
}
async function click(page, text) { await (await button(page, text)).click(); }
async function disabled(page, text) { return (await button(page, text)).evaluate(b => b.disabled); }
async function enter(page, selector, value) {
  await page.$eval(selector, (el, value) => {
    const setter = Object.getOwnPropertyDescriptor(el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

test('warehouse editor browser behavior', async t => {
  const browser = await puppeteer.launch({ headless: true });
  try {
    await t.test('loads authoritative code, saves blank, and preserves dirty non-code inputs', async () => {
      const page = await mount(browser);
      try {
        assert.ok((await page.$eval('body', el => el.textContent)).includes('002-CORRECTED'));
        await enter(page, 'input[type="number"]', '25');
        await page.$$eval('input[type="number"]', inputs => {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inputs[1], '12');
          inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
        });
        await enter(page, 'input[placeholder^="Reason for changing"]', 'Unsaved quantity reason');
        await enter(page, 'input[placeholder="Optional note..."]', 'Unsaved line note');
        await enter(page, 'textarea[rows="3"]', 'Unsaved overall note');
        await click(page, 'Edit code');
        await enter(page, 'input[aria-label="Warehouse item code for line 1"]', '');
        if (process.env.WIC_EDITOR_SCREENSHOTS === '1') await page.screenshot({ path: path.join(root, 'scratch/warehouse-item-code-tests/editor-wide.png'), fullPage: true });
        assert.equal(await disabled(page, 'Save Progress'), true);
        assert.equal(await disabled(page, 'Submit Warehouse Validation'), true);
        await click(page, 'Save code');
        await page.waitForFunction(() => document.body.textContent.includes('Item code saved'));
        assert.equal(await page.$eval('input[type="number"]', e => e.value), '25');
        assert.equal(await page.$eval('input[placeholder="Optional note..."]', e => e.value), 'Unsaved line note');
        assert.equal(await page.$eval('textarea[rows="3"]', e => e.value), 'Unsaved overall note');
        assert.equal(await page.$$eval('input[type="number"]', inputs => inputs[1].value), '12');
        assert.equal(await page.$eval('input[placeholder^="Reason for changing"]', e => e.value), 'Unsaved quantity reason');
        assert.equal(await disabled(page, 'Save Progress'), false);
        const calls = await page.evaluate(() => window.fixture.calls);
        assert.deepEqual(calls, [{ type: 'code', line: 'line', expected: '002-CORRECTED', attempted: '' }]);
        const body = await page.$eval('body', e => e.textContent);
        assert.ok(!body.includes('Requestor code:'));
        assert.ok(!body.includes('Warehouse item code:'));
        assert.ok(!body.includes('saved separately'));
        await click(page, 'Save Progress');
        await page.waitForFunction(() => window.fixture.calls.some(c => c.type === 'progress'));
        const form = await page.evaluate(() => window.fixture.calls.find(c => c.type === 'progress').args[1]);
        assert.equal(form.items[0].item_code, '');
        assert.deepEqual(await page.evaluate(() => ({
          pr1: window.fixture.renderedPR1.items.map(i => [i.id,i.item_code]),
          validation: window.fixture.renderedValidation.items.map(i => [i.id,i.item_code]),
        })), {pr1:[['item','']],validation:[['line','']]});
        assert.equal(form.items[0].quantity_requested, 12);
        assert.equal(form.items[0].validated_soh, 25);
      } finally { await page.close(); }
    });
    await t.test('conflict preserves attempted text and requires reload before retry', async () => {
      const page = await mount(browser, { conflict: true });
      try {
        await click(page, 'Edit code');
        await enter(page, 'input[aria-label="Warehouse item code for line 1"]', '004-ATTEMPT');
        await click(page, 'Save code');
        await page.waitForFunction(() => document.body.textContent.includes('changed elsewhere'));
        if (process.env.WIC_EDITOR_SCREENSHOTS === '1') await page.screenshot({ path: path.join(root, 'scratch/warehouse-item-code-tests/editor-conflict.png'), fullPage: true });
        assert.equal(await page.$eval('input[aria-label="Warehouse item code for line 1"]', e => e.value), '004-ATTEMPT');
        assert.equal(await disabled(page, 'Save code'), true);
        await click(page, 'Reload item codes');
        await page.waitForFunction(() => document.body.textContent.includes('003-CONCURRENT') || document.body.textContent.includes('Item-code response does not match'));
        assert.ok((await page.$eval('body', e => e.textContent)).includes('003-CONCURRENT'));
        assert.equal(await page.$eval('input[aria-label="Warehouse item code for line 1"]', e => e.value), '004-ATTEMPT');
        await click(page, 'Save code');
        await page.waitForFunction(() => document.body.textContent.includes('Item code saved'));
        assert.equal(await page.evaluate(() => window.fixture.calls[1].expected), '003-CONCURRENT');
      } finally { await page.close(); }
    });
    await t.test('cancel sends no save and releases workflow guards; Escape is keyboard cancel', async () => {
      const page = await mount(browser, { narrow: true, effectiveCode: '0'.repeat(160) });
      try {
        await click(page, 'Edit code');
        await enter(page, 'input[aria-label="Warehouse item code for line 1"]', 'abandoned');
        if (process.env.WIC_EDITOR_SCREENSHOTS === '1') await page.screenshot({ path: path.join(root, 'scratch/warehouse-item-code-tests/editor-narrow.png'), fullPage: true });
        await page.focus('input[aria-label="Warehouse item code for line 1"]');
        await page.keyboard.press('Escape');
        await page.waitForSelector('input[aria-label="Warehouse item code for line 1"]', { hidden: true });
        assert.equal(await disabled(page, 'Save Progress'), false);
        assert.deepEqual(await page.evaluate(() => window.fixture.calls), []);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
      } finally { await page.close(); }
    });
    await t.test('pending save locks workflow and cancellation, then releases after persisted result', async () => {
      const page = await mount(browser, { pending: true });
      try {
        await click(page, 'Edit code');
        await enter(page, 'input[aria-label="Warehouse item code for line 1"]', '005');
        await click(page, 'Save code');
        await page.waitForFunction(() => window.fixture.finishSave);
        assert.equal(await disabled(page, 'Save Progress'), true);
        assert.equal(await disabled(page, 'Cancel code edit'), true);
        assert.equal(await disabled(page, 'Request Revision'), true);
        assert.equal(await disabled(page, 'Reject'), true);
        await page.evaluate(() => window.fixture.finishSave());
        await page.waitForFunction(() => document.body.textContent.includes('Item code saved'));
        assert.equal(await disabled(page, 'Save Progress'), false);
      } finally { await page.close(); }
    });
    await t.test('failed save preserves text, requires re-verification, and cancel releases dirty workflow guard', async () => {
      const page = await mount(browser, { saveError: true });
      try {
        await click(page, 'Edit code');
        await enter(page, 'input[aria-label="Warehouse item code for line 1"]', 'denied attempt');
        await click(page, 'Save code');
        await page.waitForFunction(() => document.body.textContent.includes('Item-code save denied'));
        assert.equal(await page.$eval('input[aria-label="Warehouse item code for line 1"]', e => e.value), 'denied attempt');
        assert.equal(await disabled(page, 'Cancel code edit'), false);
        assert.equal(await page.evaluate(() => document.body.textContent.includes('Item code saved')), false);
        await click(page, 'Cancel code edit');
        assert.equal(await disabled(page, 'Save Progress'), false);
        assert.equal(await disabled(page, 'Submit Warehouse Validation'), true);
        await click(page, 'Reload item codes');
        await page.waitForFunction(() => !document.body.textContent.includes('Checking item codes...'));
        assert.equal(await disabled(page, 'Submit Warehouse Validation'), false);
      } finally { await page.close(); }
    });
    await t.test('read failure or missing expected line blocks submission without original-code fallback', async () => {
      for (const options of [{ readError: true }, { missingLine: true }]) {
        const page = await mount(browser, options);
        try {
          assert.equal(await disabled(page, 'Submit Warehouse Validation'), true);
          assert.equal(await page.evaluate(() => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Edit code')), false);
          assert.ok((await page.$eval('body', e => e.textContent)).includes('Item codes unavailable'));
        } finally { await page.close(); }
      }
    });
    await t.test('edit authority excludes admin/inactive/decided/current PR2/wrong lifecycle', async () => {
      for (const options of [{ role: 'admin' }, { active: false }, { completed: true }, { currentPR2: true }, { status: 'rejected' }]) {
        const page = await mount(browser, options);
        try {
          assert.equal(await page.evaluate(() => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Edit code')), false);
          if (options.completed) assert.ok((await page.$eval('body', e => e.textContent)).includes('002-CORRECTED'));
        } finally { await page.close(); }
      }
    });
    await t.test('services and duplicate codes use immutable line IDs; Enter saves with formatting intact', async () => {
      const page = await mount(browser, { requestType: 'services', twoLines: true });
      try {
        await page.evaluate(() => [...document.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Edit code')[1].click());
        assert.equal(await disabled(page, 'Save Progress'), false); // clean editor does not block workflow
        await enter(page, 'input[aria-label="Warehouse item code for line 2"]', '  0007-Ab /  02  ');
        await page.focus('input[aria-label="Warehouse item code for line 2"]');
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => document.body.textContent.includes('Item code saved'));
        const codes = await page.$$eval('tbody tr', rows => rows.map(r => r.cells[1].textContent));
        assert.ok(codes[0].includes('002-CORRECTED'));
        assert.ok(!codes[0].includes('0007-Ab'));
        assert.ok(codes[1].includes('0007-Ab /  02'));
        assert.deepEqual(await page.evaluate(() => window.fixture.calls), [{ type: 'code', line: 'line2', expected: '002-CORRECTED', attempted: '  0007-Ab /  02  ' }]);
        const states = await page.evaluate(() => [window.fixture.renderedPR1,window.fixture.renderedValidation,window.fixture.renderedForm].map(s=>s.items.map(i=>i.item_code)));
        assert.deepEqual(states,Array.from({length:3},()=>['002-CORRECTED','0007-Ab /  02']));
      } finally { await page.close(); }
    });
    await t.test('reload errors preserve dirty form values and prevent stale-code submission', async () => {
      const page = await mount(browser);
      try {
        await enter(page, 'input[placeholder="Optional note..."]', 'Keep dirty note');
        await page.evaluate(() => { window.fixture.readError = true; });
        await click(page, 'Reload item codes');
        await page.waitForFunction(() => document.body.textContent.includes('Item codes unavailable'));
        assert.equal(await page.$eval('input[placeholder="Optional note..."]', e => e.value), 'Keep dirty note');
        assert.equal(await disabled(page, 'Submit Warehouse Validation'), true);
        await page.evaluate(() => { window.fixture.readError = false; });
        await click(page, 'Reload item codes');
        await page.waitForFunction(() => !document.body.textContent.includes('Checking item codes...'));
        assert.equal(await page.$eval('input[placeholder="Optional note..."]', e => e.value), 'Keep dirty note');
        assert.equal(await disabled(page, 'Submit Warehouse Validation'), false);
      } finally { await page.close(); }
    });
    await t.test('eligible warehouse editor works without any rollout environment flags', async () => {
      const page = await mount(browser);
      try {
        assert.ok((await page.$eval('body', e => e.textContent)).includes('002-CORRECTED'));
        assert.equal(await page.evaluate(() => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Edit code')), true);
        assert.equal(await page.evaluate(() => window.fixture.reads), 1);
      } finally { await page.close(); }
    });
    await t.test('fresh checked read replaces stale initial code copies without a split/banner', async () => {
      const page = await mount(browser, { staleInitial: true });
      try {
        const body = await page.$eval('body', e => e.textContent);
        assert.ok(body.includes('002-CORRECTED'));
        assert.ok(!body.includes('001-ORIGINAL'));
        assert.ok(!body.includes('saved separately'));
        assert.ok(!body.includes('Requestor code:'));
        assert.ok(!body.includes('Warehouse item code:'));
        await click(page, 'Save Progress');
        await page.waitForFunction(() => window.fixture.calls.some(c => c.type === 'progress'));
        assert.equal(await page.evaluate(() => window.fixture.calls.find(c => c.type === 'progress').args[1].items[0].item_code), '002-CORRECTED');
      } finally { await page.close(); }
    });
    await t.test('reload merges concurrent codes only and retains every dirty non-code value', async () => {
      const page = await mount(browser);
      try {
        await enter(page, 'input[type="number"]', '25');
        await page.$$eval('input[type="number"]', inputs => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(inputs[1],'12'); inputs[1].dispatchEvent(new Event('input',{bubbles:true})); });
        await enter(page, 'input[placeholder^="Reason for changing"]', 'Keep reason');
        await enter(page, 'input[placeholder="Optional note..."]', 'Keep line');
        await enter(page, 'textarea[rows="3"]', 'Keep overall');
        await page.evaluate(() => { window.fixture.persisted.original_pr1_code='003-CONCURRENT'; window.fixture.persisted.effective_code='003-CONCURRENT'; });
        await click(page, 'Reload item codes');
        await page.waitForFunction(() => document.body.textContent.includes('003-CONCURRENT') || document.body.textContent.includes('Item-code response does not match'));
        assert.ok((await page.$eval('body',e=>e.textContent)).includes('003-CONCURRENT'));
        await click(page, 'Save Progress');
        await page.waitForFunction(() => window.fixture.calls.some(c => c.type === 'progress'));
        const form=await page.evaluate(() => window.fixture.calls.find(c=>c.type==='progress').args[1]);
        assert.equal(form.items[0].item_code,'003-CONCURRENT');assert.equal(form.items[0].validated_soh,25);assert.equal(form.items[0].quantity_requested,12);
        assert.equal(form.items[0].quantity_override_reason,'Keep reason');assert.equal(form.items[0].item_notes,'Keep line');assert.equal(form.notes,'Keep overall');
        assert.deepEqual(await page.evaluate(()=>[window.fixture.renderedPR1.items[0].item_code,window.fixture.renderedValidation.items[0].item_code]),['003-CONCURRENT','003-CONCURRENT']);
      } finally { await page.close(); }
    });
    await t.test('ambiguous committed save reloads current code, preserving attempted text and notes', async () => {
      const page=await mount(browser,{ambiguous:true});
      try {
        await enter(page,'input[placeholder="Optional note..."]','Keep ambiguous note');
        await click(page,'Edit code');await enter(page,'input[aria-label="Warehouse item code for line 1"]','004-COMMITTED');await click(page,'Save code');
        await page.waitForFunction(()=>document.body.textContent.includes('Connection lost after commit'));
        assert.equal(await disabled(page,'Submit Warehouse Validation'),true);
        assert.equal(await page.evaluate(()=>document.body.textContent.includes('Item code saved')),false);
        await click(page,'Reload item codes');
        await page.waitForFunction(()=>document.body.textContent.includes('004-COMMITTED') || document.body.textContent.includes('Item-code response does not match'));
        assert.equal(await disabled(page,'Save code'),false);
        assert.equal(await page.$eval('input[aria-label="Warehouse item code for line 1"]',e=>e.value),'004-COMMITTED');
        await click(page,'Cancel code edit');await click(page,'Save Progress');
        await page.waitForFunction(()=>window.fixture.calls.some(c=>c.type==='progress'));
        const form=await page.evaluate(()=>window.fixture.calls.find(c=>c.type==='progress').args[1]);
        assert.equal(form.items[0].item_code,'004-COMMITTED');assert.equal(form.items[0].item_notes,'Keep ambiguous note');
      } finally { await page.close(); }
    });
    await t.test('requester detail and print render corrected existing code from a fresh read', async () => {
      const editor=await mount(browser);let code;
      try {
        await click(editor,'Edit code');await enter(editor,'input[aria-label="Warehouse item code for line 1"]','0007-SAME-ITEM');await click(editor,'Save code');
        await editor.waitForFunction(()=>document.body.textContent.includes('Item code saved'));
        code=await editor.evaluate(()=>window.fixture.renderedPR1.items[0].item_code);
      } finally {await editor.close();}
      for(const reader of ['detail','print']) {
        const page=await mount(browser,{reader,role:'employee',effectiveCode:code});
        try {
          assert.ok((await page.$eval('body',e=>e.textContent)).includes('0007-SAME-ITEM'));
          assert.equal(await page.evaluate(()=>window.fixture.pr1Reads),1);
        } finally {await page.close();}
      }
    });
  } finally { await browser.close(); }
});
