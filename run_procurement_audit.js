const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const URL = 'http://localhost:3000';
const EMAIL = 'procurement@fortune.com';
const PASSWORD = 'Fortune2024!';

async function run() {
  console.log("Creating procurement audit directories...");
  const dirs = [
    'docs/procurement/audit',
    'docs/procurement/manual',
    'docs/procurement/screenshots/dashboard',
    'docs/procurement/screenshots/pr2_requests',
    'docs/procurement/screenshots/rfq',
    'docs/procurement/screenshots/purchase_orders',
    'docs/procurement/screenshots/delivery_tracking',
    'docs/procurement/screenshots/goods_receipt',
    'docs/procurement/screenshots/supplier_accreditation',
    'docs/procurement/screenshots/product_review',
    'docs/procurement/screenshots/approval_queue',
    'docs/procurement/screenshots/approval_history',
    'docs/procurement/screenshots/messages',
    'docs/procurement/screenshots/profile',
    'docs/procurement/screenshots/bugtrack'
  ];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }

  console.log("Launching browser for Procurement audit...");
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const auditLog = {};

  async function auditPageInfo(pageName, urlPath) {
    console.log(`Auditing page: ${pageName} (${urlPath})`);
    const info = await page.evaluate(() => {
      const clean = (txt) => txt ? txt.trim().replace(/\s+/g, ' ') : '';
      
      const title = document.title;
      const h1s = Array.from(document.querySelectorAll('h1')).map(el => clean(el.innerText));
      const h2s = Array.from(document.querySelectorAll('h2')).map(el => clean(el.innerText));
      const h3s = Array.from(document.querySelectorAll('h3')).map(el => clean(el.innerText));
      
      const buttons = Array.from(document.querySelectorAll('button')).map(el => ({
        text: clean(el.innerText || el.value || el.title),
        id: el.id || '',
        disabled: el.disabled,
        classes: el.className
      }));

      const links = Array.from(document.querySelectorAll('a')).map(el => ({
        text: clean(el.innerText),
        href: el.getAttribute('href'),
        classes: el.className
      }));

      const formFields = Array.from(document.querySelectorAll('input, select, textarea')).map(el => ({
        tagName: el.tagName.toLowerCase(),
        type: el.type || '',
        name: el.name || '',
        id: el.id || '',
        placeholder: el.placeholder || '',
        label: clean(document.querySelector(`label[for="${el.id}"]`)?.innerText || el.closest('label')?.innerText || '')
      }));

      const tableHeaders = Array.from(document.querySelectorAll('table')).map((table, tIdx) => {
        const headers = Array.from(table.querySelectorAll('th')).map(th => clean(th.innerText));
        return { tableIndex: tIdx, headers };
      });

      const badges = Array.from(document.querySelectorAll('[class*="badge"], [class*="status"], [class*="rounded-full"]')).map(el => clean(el.innerText)).filter(t => t.length > 0 && t.length < 35);
      const alerts = Array.from(document.querySelectorAll('[class*="alert"], [class*="error"], [class*="success"], [class*="bg-red-"], [class*="bg-green-"], [class*="text-red-"]')).map(el => clean(el.innerText)).filter(t => t.length > 0);

      return {
        title,
        h1s,
        h2s,
        h3s,
        buttons,
        links,
        formFields,
        tableHeaders,
        badges: Array.from(new Set(badges)),
        alerts: Array.from(new Set(alerts)),
        bodyText: document.body.innerText.substring(0, 2000)
      };
    });

    auditLog[pageName] = {
      path: urlPath,
      url: page.url(),
      ...info
    };
  }

  // --- Step 1: Login ---
  console.log("Navigating to login page...");
  await page.goto(`${URL}/login`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'docs/procurement/screenshots/profile/login_step_01.png' });
  
  console.log("Typing credentials...");
  await page.type('input[type="email"]', EMAIL);
  await page.type('input[type="password"]', PASSWORD);
  
  console.log("Clicking submit...");
  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form) {
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.click();
    }
  });

  await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 5000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));

  // --- Step 2: Dashboard ---
  console.log("Navigating to /dashboard...");
  await page.goto(`${URL}/dashboard`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'docs/procurement/screenshots/dashboard/dashboard_step_01.png' });
  await auditPageInfo('Dashboard', '/dashboard');

  // --- Step 3: PR2 Requests ---
  console.log("Navigating to /pr2...");
  await page.goto(`${URL}/pr2`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'docs/procurement/screenshots/pr2_requests/pr2_requests_step_01.png' });
  await auditPageInfo('PR2 Requests List', '/pr2');

  // Find a PR2 details path
  const pr2DetailPath = await page.evaluate(() => {
    const link = Array.from(document.querySelectorAll('a[href^="/pr2/"]'))
      .find(a => a.getAttribute('href') !== '/pr2/new');
    return link ? link.getAttribute('href') : null;
  });
  console.log(`Found PR2 Detail path: ${pr2DetailPath}`);
  if (pr2DetailPath) {
    console.log(`Navigating to PR2 Details: ${pr2DetailPath}`);
    await page.goto(`${URL}${pr2DetailPath}`, { waitUntil: 'networkidle0' }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'docs/procurement/screenshots/pr2_requests/pr2_requests_step_02.png' });
    await auditPageInfo('PR2 Detail View', pr2DetailPath);
  }

  // --- Step 4: RFQ / Canvassing ---
  console.log("Navigating to /rfq...");
  await page.goto(`${URL}/rfq`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'docs/procurement/screenshots/rfq/rfq_step_01.png' });
  await auditPageInfo('RFQ List', '/rfq');

  const rfqDetailPath = await page.evaluate(() => {
    const link = document.querySelector('a[href^="/rfq/"]');
    return link ? link.getAttribute('href') : null;
  });
  console.log(`Found RFQ Detail path: ${rfqDetailPath}`);
  if (rfqDetailPath) {
    console.log(`Navigating to RFQ Details: ${rfqDetailPath}`);
    await page.goto(`${URL}${rfqDetailPath}`, { waitUntil: 'networkidle0' }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'docs/procurement/screenshots/rfq/rfq_step_02.png' });
    await auditPageInfo('RFQ Detail View', rfqDetailPath);
  }

  // --- Step 5: Purchase Orders ---
  console.log("Navigating to /po...");
  await page.goto(`${URL}/po`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'docs/procurement/screenshots/purchase_orders/purchase_orders_step_01.png' });
  await auditPageInfo('Purchase Orders List', '/po');

  const poDetailPath = await page.evaluate(() => {
    const link = document.querySelector('a[href^="/po/"]');
    return link ? link.getAttribute('href') : null;
  });
  console.log(`Found PO Detail path: ${poDetailPath}`);
  if (poDetailPath) {
    console.log(`Navigating to PO Details: ${poDetailPath}`);
    await page.goto(`${URL}${poDetailPath}`, { waitUntil: 'networkidle0' }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'docs/procurement/screenshots/purchase_orders/purchase_orders_step_02.png' });
    await auditPageInfo('Purchase Order Detail View', poDetailPath);
  }

  // --- Step 6: Delivery Tracking ---
  console.log("Navigating to /delivery...");
  await page.goto(`${URL}/delivery`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'docs/procurement/screenshots/delivery_tracking/delivery_tracking_step_01.png' });
  await auditPageInfo('Delivery Tracking List', '/delivery');

  const deliveryDetailPath = await page.evaluate(() => {
    const link = document.querySelector('a[href^="/delivery/"]');
    return link ? link.getAttribute('href') : null;
  });
  console.log(`Found Delivery Detail path: ${deliveryDetailPath}`);
  if (deliveryDetailPath) {
    console.log(`Navigating to Delivery Details: ${deliveryDetailPath}`);
    await page.goto(`${URL}${deliveryDetailPath}`, { waitUntil: 'networkidle0' }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'docs/procurement/screenshots/delivery_tracking/delivery_tracking_step_02.png' });
    await auditPageInfo('Delivery Detail View', deliveryDetailPath);
  }

  // --- Step 7: Goods Receipt ---
  console.log("Navigating to /grn...");
  await page.goto(`${URL}/grn`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'docs/procurement/screenshots/goods_receipt/goods_receipt_step_01.png' });
  await auditPageInfo('Goods Receipt List', '/grn');

  const grnDetailPath = await page.evaluate(() => {
    const link = document.querySelector('a[href^="/grn/"]');
    return link ? link.getAttribute('href') : null;
  });
  console.log(`Found GRN Detail path: ${grnDetailPath}`);
  if (grnDetailPath) {
    console.log(`Navigating to GRN Details: ${grnDetailPath}`);
    await page.goto(`${URL}${grnDetailPath}`, { waitUntil: 'networkidle0' }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'docs/procurement/screenshots/goods_receipt/goods_receipt_step_02.png' });
    await auditPageInfo('Goods Receipt Detail View', grnDetailPath);
  }

  // --- Step 8: Supplier Accreditation ---
  console.log("Navigating to /accreditation...");
  await page.goto(`${URL}/accreditation`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'docs/procurement/screenshots/supplier_accreditation/supplier_accreditation_step_01.png' });
  await auditPageInfo('Supplier Accreditation List', '/accreditation');

  const accDetailPath = await page.evaluate(() => {
    const link = document.querySelector('a[href^="/accreditation/"]:not([href^="/accreditation/products"])');
    return link ? link.getAttribute('href') : null;
  });
  console.log(`Found Accreditation Detail path: ${accDetailPath}`);
  if (accDetailPath) {
    console.log(`Navigating to Accreditation Details: ${accDetailPath}`);
    await page.goto(`${URL}${accDetailPath}`, { waitUntil: 'networkidle0' }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'docs/procurement/screenshots/supplier_accreditation/supplier_accreditation_step_02.png' });
    await auditPageInfo('Supplier Accreditation Detail View', accDetailPath);
  }

  // --- Step 9: Product Review ---
  console.log("Navigating to /accreditation/products...");
  await page.goto(`${URL}/accreditation/products`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'docs/procurement/screenshots/product_review/product_review_step_01.png' });
  await auditPageInfo('Product Review List', '/accreditation/products');

  const prodDetailPath = await page.evaluate(() => {
    const link = document.querySelector('a[href^="/accreditation/products/"]');
    return link ? link.getAttribute('href') : null;
  });
  console.log(`Found Product Review Detail path: ${prodDetailPath}`);
  if (prodDetailPath) {
    console.log(`Navigating to Product Review Details: ${prodDetailPath}`);
    await page.goto(`${URL}${prodDetailPath}`, { waitUntil: 'networkidle0' }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'docs/procurement/screenshots/product_review/product_review_step_02.png' });
    await auditPageInfo('Product Review Detail View', prodDetailPath);
  }

  // --- Step 10: Approval Queue ---
  console.log("Navigating to /approvals...");
  await page.goto(`${URL}/approvals`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'docs/procurement/screenshots/approval_queue/approval_queue_step_01.png' });
  await auditPageInfo('Approval Queue', '/approvals');

  // --- Step 11: Approval History ---
  console.log("Navigating to /approvals/history...");
  await page.goto(`${URL}/approvals/history`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'docs/procurement/screenshots/approval_history/approval_history_step_01.png' });
  await auditPageInfo('Approval History', '/approvals/history');

  // --- Step 12: Messages ---
  console.log("Navigating to /messages...");
  await page.goto(`${URL}/messages`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'docs/procurement/screenshots/messages/messages_step_01.png' });
  await auditPageInfo('Messages', '/messages');

  // --- Step 13: Profile ---
  console.log("Navigating to /profile...");
  await page.goto(`${URL}/profile`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'docs/procurement/screenshots/profile/profile_step_01.png' });
  await auditPageInfo('Profile Settings', '/profile');

  // --- Step 14: Bugtrack ---
  console.log("Navigating to /bugtrack...");
  await page.goto(`${URL}/bugtrack`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await auditPageInfo('Bug Reports (Empty)', '/bugtrack');

  console.log("Triggering Bugtrack validation...");
  await page.evaluate(() => {
    const submitBtn = Array.from(document.querySelectorAll('button')).find(btn => btn.innerText.toLowerCase().includes('submit') || btn.innerText.toLowerCase().includes('report'));
    if (submitBtn) submitBtn.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'docs/procurement/screenshots/bugtrack/bugtrack_step_01.png' });
  await auditPageInfo('Bug Reports Validation Errors', '/bugtrack');

  console.log("Filling in Bugtrack form...");
  await page.evaluate(() => {
    const titleInput = document.querySelector('input[placeholder*="title"], input[name*="title"], input[placeholder*="Summary"]');
    if (titleInput) {
      titleInput.value = 'Procurement UI Bug Report Test';
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const locInput = document.querySelector('input[placeholder*="Happens"]');
    if (locInput) {
      locInput.value = '/pr2';
      locInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const descInput = document.querySelector('textarea[placeholder*="description"], textarea[name*="description"], textarea[placeholder*="detail"]');
    if (descInput) {
      descInput.value = 'This is a test bug description for the procurement role automated UI manual audit.';
      descInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const expInput = document.querySelector('textarea[placeholder*="Expected"], textarea[placeholder*="instead"]');
    if (expInput) {
      expInput.value = 'Correct UI loaded.';
      expInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'docs/procurement/screenshots/bugtrack/bugtrack_step_02.png' });
  await auditPageInfo('Bug Reports (Filled)', '/bugtrack');

  // Save log
  console.log("Writing raw audit results to file...");
  fs.writeFileSync('docs/procurement/audit_results_raw.json', JSON.stringify(auditLog, null, 2));

  await browser.close();
  console.log("Audit complete successfully!");
}

run().catch(console.error);
