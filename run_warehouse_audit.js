const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const URL = 'http://localhost:3000';
const EMAIL = 'warehouse@fortune.com';
const PASSWORD = 'Fortune2024!';

async function run() {
  console.log("Creating required directories...");
  const dirs = [
    'docs/warehouse/audit',
    'docs/warehouse/manual',
    'docs/warehouse/screenshots/dashboard',
    'docs/warehouse/screenshots/warehouse_queue',
    'docs/warehouse/screenshots/goods_receipt',
    'docs/warehouse/screenshots/delivery_tracking',
    'docs/warehouse/screenshots/warehouse_history',
    'docs/warehouse/screenshots/messages',
    'docs/warehouse/screenshots/profile',
    'docs/warehouse/screenshots/bugtrack'
  ];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }

  console.log("Launching browser...");
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

      const badges = Array.from(document.querySelectorAll('[class*="badge"], [class*="status"], [class*="rounded-full"]')).map(el => clean(el.innerText)).filter(t => t.length > 0 && t.length < 30);
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
        bodyText: document.body.innerText.substring(0, 1500)
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
  await page.screenshot({ path: 'docs/warehouse/screenshots/profile/login_step_01.png' }); // We can store the login screenshot or profile
  
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
  await page.screenshot({ path: 'docs/warehouse/screenshots/dashboard/dashboard_step_01.png' });
  await auditPageInfo('Dashboard', '/dashboard');

  // --- Step 3: Warehouse Queue (/warehouse) ---
  console.log("Navigating to /warehouse...");
  await page.goto(`${URL}/warehouse`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'docs/warehouse/screenshots/warehouse_queue/warehouse_queue_step_01.png' });
  await auditPageInfo('Warehouse Queue', '/warehouse');

  // Find a warehouse queue details path
  const warehouseDetailPath = await page.evaluate(() => {
    const link = document.querySelector('a[href^="/warehouse/"]:not([href="/warehouse/history"])');
    return link ? link.getAttribute('href') : null;
  });
  console.log(`Found Warehouse Detail path: ${warehouseDetailPath}`);

  if (warehouseDetailPath) {
    console.log(`Navigating to Warehouse Details: ${warehouseDetailPath}`);
    await page.goto(`${URL}${warehouseDetailPath}`, { waitUntil: 'networkidle0' }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'docs/warehouse/screenshots/warehouse_queue/warehouse_queue_step_02.png' });
    await auditPageInfo('Warehouse Detail View', warehouseDetailPath);
  }

  // --- Step 4: Goods Receipt (/grn) ---
  console.log("Navigating to /grn...");
  await page.goto(`${URL}/grn`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'docs/warehouse/screenshots/goods_receipt/goods_receipt_step_01.png' });
  await auditPageInfo('Goods Receipt', '/grn');

  // Find a GRN detail path
  const grnDetailPath = await page.evaluate(() => {
    const link = document.querySelector('a[href^="/grn/"]');
    return link ? link.getAttribute('href') : null;
  });
  console.log(`Found GRN Detail path: ${grnDetailPath}`);

  if (grnDetailPath) {
    console.log(`Navigating to GRN Details: ${grnDetailPath}`);
    await page.goto(`${URL}${grnDetailPath}`, { waitUntil: 'networkidle0' }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'docs/warehouse/screenshots/goods_receipt/goods_receipt_step_02.png' });
    await auditPageInfo('Goods Receipt Detail View', grnDetailPath);
  }

  // --- Step 5: Delivery Tracking (/delivery) ---
  console.log("Navigating to /delivery...");
  await page.goto(`${URL}/delivery`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'docs/warehouse/screenshots/delivery_tracking/delivery_tracking_step_01.png' });
  await auditPageInfo('Delivery Tracking', '/delivery');

  // Find a delivery details path
  const deliveryDetailPath = await page.evaluate(() => {
    const link = document.querySelector('a[href^="/delivery/"]');
    return link ? link.getAttribute('href') : null;
  });
  console.log(`Found Delivery Detail path: ${deliveryDetailPath}`);

  if (deliveryDetailPath) {
    console.log(`Navigating to Delivery Details: ${deliveryDetailPath}`);
    await page.goto(`${URL}${deliveryDetailPath}`, { waitUntil: 'networkidle0' }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'docs/warehouse/screenshots/delivery_tracking/delivery_tracking_step_02.png' });
    await auditPageInfo('Delivery Detail View', deliveryDetailPath);
  }

  // --- Step 6: Warehouse History (/warehouse/history) ---
  console.log("Navigating to /warehouse/history...");
  await page.goto(`${URL}/warehouse/history`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'docs/warehouse/screenshots/warehouse_history/warehouse_history_step_01.png' });
  await auditPageInfo('Warehouse History', '/warehouse/history');

  // --- Step 7: Messages (/messages) ---
  console.log("Navigating to /messages...");
  await page.goto(`${URL}/messages`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'docs/warehouse/screenshots/messages/messages_step_01.png' });
  await auditPageInfo('Messages', '/messages');

  // --- Step 8: Profile (/profile) ---
  console.log("Navigating to /profile...");
  await page.goto(`${URL}/profile`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'docs/warehouse/screenshots/profile/profile_step_01.png' });
  await auditPageInfo('Profile', '/profile');

  // --- Step 9: Bugtrack (/bugtrack) ---
  console.log("Navigating to /bugtrack...");
  await page.goto(`${URL}/bugtrack`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await auditPageInfo('Bug Reports (Empty)', '/bugtrack');

  // Trigger bugtrack validation
  console.log("Triggering validation on Bugtrack form...");
  await page.evaluate(() => {
    const submitBtn = Array.from(document.querySelectorAll('button')).find(btn => btn.innerText.toLowerCase().includes('submit') || btn.innerText.toLowerCase().includes('report'));
    if (submitBtn) submitBtn.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'docs/warehouse/screenshots/bugtrack/bugtrack_step_01.png' });
  await auditPageInfo('Bug Reports Validation Errors', '/bugtrack');

  // Fill in bug details
  console.log("Filling in Bugtrack form...");
  await page.evaluate(() => {
    const titleInput = document.querySelector('input[placeholder*="title"], input[name*="title"], input[placeholder*="Summary"]');
    if (titleInput) {
      titleInput.value = 'Warehouse UI Bug Report Test';
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const locInput = document.querySelector('input[placeholder*="Happens"]');
    if (locInput) {
      locInput.value = '/warehouse';
      locInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const descInput = document.querySelector('textarea[placeholder*="description"], textarea[name*="description"], textarea[placeholder*="detail"]');
    if (descInput) {
      descInput.value = 'This is a test bug description for the warehouse automated UI manual audit.';
      descInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const expInput = document.querySelector('textarea[placeholder*="Expected"], textarea[placeholder*="instead"]');
    if (expInput) {
      expInput.value = 'Correct UI loaded.';
      expInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'docs/warehouse/screenshots/bugtrack/bugtrack_step_02.png' });
  await auditPageInfo('Bug Reports (Filled)', '/bugtrack');

  // Write log to file
  console.log("Writing raw audit results to file...");
  fs.writeFileSync('docs/warehouse/audit_results_raw.json', JSON.stringify(auditLog, null, 2));

  await browser.close();
  console.log("Audit browser run complete!");
}

run().catch(console.error);
