const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const URL = 'http://localhost:3000';
const EMAIL = 'employee@fortune.com';
const PASSWORD = 'Fortune2024!';

async function run() {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const auditLog = {};

  async function auditPageInfo(pageName, urlPath) {
    console.log(`Auditing page: ${pageName} (${urlPath})`);
    const info = await page.evaluate((name) => {
      // Helper to extract clean text
      const clean = (txt) => txt ? txt.trim().replace(/\s+/g, ' ') : '';
      
      // Page title
      const title = document.title;
      const h1s = Array.from(document.querySelectorAll('h1')).map(el => clean(el.innerText));
      const h2s = Array.from(document.querySelectorAll('h2')).map(el => clean(el.innerText));
      const h3s = Array.from(document.querySelectorAll('h3')).map(el => clean(el.innerText));
      
      // Buttons
      const buttons = Array.from(document.querySelectorAll('button')).map(el => ({
        text: clean(el.innerText || el.value || el.title),
        id: el.id || '',
        disabled: el.disabled,
        classes: el.className
      }));

      // Links
      const links = Array.from(document.querySelectorAll('a')).map(el => ({
        text: clean(el.innerText),
        href: el.getAttribute('href'),
        classes: el.className
      }));

      // Inputs/Selects/Textareas
      const formFields = Array.from(document.querySelectorAll('input, select, textarea')).map(el => ({
        tagName: el.tagName.toLowerCase(),
        type: el.type || '',
        name: el.name || '',
        id: el.id || '',
        placeholder: el.placeholder || '',
        label: clean(document.querySelector(`label[for="${el.id}"]`)?.innerText || el.closest('label')?.innerText || '')
      }));

      // Table headers
      const tableHeaders = Array.from(document.querySelectorAll('table')).map((table, tIdx) => {
        const headers = Array.from(table.querySelectorAll('th')).map(th => clean(th.innerText));
        return { tableIndex: tIdx, headers };
      });

      // Badges or status elements (common tailwind/classes)
      const badges = Array.from(document.querySelectorAll('[class*="badge"], [class*="status"], [class*="rounded-full"]')).map(el => clean(el.innerText)).filter(t => t.length > 0 && t.length < 30);

      // Error/Success messages or banners
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
        bodyText: document.body.innerText.substring(0, 1000) // snippet
      };
    }, pageName);

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
  await page.screenshot({ path: 'docs/employee_login_step_01.png' });
  await auditPageInfo('Login Page', '/login');

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
  await page.screenshot({ path: 'docs/employee_dashboard_step_01.png' });
  await auditPageInfo('Dashboard', '/dashboard');

  // --- Step 3: My Requests (PR1) List ---
  console.log("Navigating to /pr1...");
  await page.goto(`${URL}/pr1`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'docs/employee_pr1_list_step_01.png' });
  await auditPageInfo('My Requests List', '/pr1');

  // Get a detail link if possible for later
  const pr1DetailPath = await page.evaluate(() => {
    const link = document.querySelector('a[href^="/pr1/"]:not([href="/pr1/new"])');
    return link ? link.getAttribute('href') : null;
  });
  console.log(`Found PR1 detail path: ${pr1DetailPath}`);

  // --- Step 4: PR1 New (Form & Validation) ---
  console.log("Navigating to /pr1/new...");
  await page.goto(`${URL}/pr1/new`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await auditPageInfo('New PR1 Form (Empty)', '/pr1/new');

  // Trigger validation
  console.log("Triggering validation on New PR1 form...");
  await page.evaluate(() => {
    const submitBtn = Array.from(document.querySelectorAll('button')).find(btn => btn.innerText.includes('Submit'));
    if (submitBtn) submitBtn.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'docs/employee_pr1_new_validation_step_01.png' });
  await auditPageInfo('New PR1 Validation Errors', '/pr1/new');

  // Fill in form details (but don't submit, or cancel after screenshot)
  console.log("Filling in New PR1 form...");
  await page.evaluate(() => {
    // Fill purpose suffix if input exists
    const suffixInput = document.querySelector('input[placeholder="e.g. 001"]');
    if (suffixInput) {
      suffixInput.value = '999';
      suffixInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    // Fill purpose (select option or input)
    const purposeSelect = document.querySelector('select');
    if (purposeSelect) {
      // Find first option that is not empty
      const option = Array.from(purposeSelect.options).find(opt => opt.value !== '');
      if (option) {
        purposeSelect.value = option.value;
        purposeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    // Set date required (input[type="date"])
    const dateInput = document.querySelector('input[type="date"]');
    if (dateInput) {
      dateInput.value = '2026-06-15';
      dateInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  // Click "Add Item" button
  console.log("Adding an item line...");
  const addedItem = await page.evaluate(() => {
    const addItemBtn = Array.from(document.querySelectorAll('button')).find(btn => btn.innerText.includes('Add Item') || btn.innerText.includes('+ Item'));
    if (addItemBtn) {
      addItemBtn.click();
      return true;
    }
    return false;
  });

  if (addedItem) {
    await new Promise(r => setTimeout(r, 500));
    // Fill the item details
    await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input, select'));
      // Find item name input
      const nameInput = inputs.find(i => i.placeholder && (i.placeholder.includes('Item name') || i.placeholder.includes('description')));
      if (nameInput) {
        nameInput.value = 'Audit Premium Notebooks';
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      // Find quantity input
      const qtyInput = inputs.find(i => i.type === 'number');
      if (qtyInput) {
        qtyInput.value = '10';
        qtyInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  }

  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'docs/employee_pr1_new_filled_step_02.png' });
  await auditPageInfo('New PR1 Form (Filled)', '/pr1/new');

  // --- Step 5: PR1 Details ---
  if (pr1DetailPath) {
    console.log(`Navigating to details page: ${pr1DetailPath}`);
    await page.goto(`${URL}${pr1DetailPath}`, { waitUntil: 'networkidle0' }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'docs/employee_pr1_details_step_01.png' });
    await auditPageInfo('PR1 Details', pr1DetailPath);
  } else {
    console.log("No PR1 detail page link found, skipping detailed audit.");
  }

  // --- Step 6: Substitutes List ---
  console.log("Navigating to /substitutes...");
  await page.goto(`${URL}/substitutes`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'docs/employee_substitutes_list_step_01.png' });
  await auditPageInfo('Substitute Review List', '/substitutes');

  // Find a substitute detail link
  const subDetailPath = await page.evaluate(() => {
    const link = document.querySelector('a[href^="/substitutes/"]');
    return link ? link.getAttribute('href') : null;
  });
  console.log(`Found substitute detail path: ${subDetailPath}`);

  // --- Step 7: Substitutes Details ---
  if (subDetailPath) {
    console.log(`Navigating to substitute details: ${subDetailPath}`);
    await page.goto(`${URL}${subDetailPath}`, { waitUntil: 'networkidle0' }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'docs/employee_substitutes_details_step_01.png' });
    await auditPageInfo('Substitute Review Details', subDetailPath);
  } else {
    console.log("No substitute details link found, skipping.");
  }

  // --- Step 8: Delivery List ---
  console.log("Navigating to /delivery...");
  await page.goto(`${URL}/delivery`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'docs/employee_delivery_list_step_01.png' });
  await auditPageInfo('Delivery Tracking List', '/delivery');

  // Find a delivery detail link
  const deliveryDetailPath = await page.evaluate(() => {
    const link = document.querySelector('a[href^="/delivery/"]');
    return link ? link.getAttribute('href') : null;
  });
  console.log(`Found delivery detail path: ${deliveryDetailPath}`);

  // --- Step 9: Delivery Details ---
  if (deliveryDetailPath) {
    console.log(`Navigating to delivery details: ${deliveryDetailPath}`);
    await page.goto(`${URL}${deliveryDetailPath}`, { waitUntil: 'networkidle0' }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'docs/employee_delivery_details_step_01.png' });
    await auditPageInfo('Delivery Tracking Details', deliveryDetailPath);
  } else {
    console.log("No delivery details link found, skipping.");
  }

  // --- Step 10: Messages ---
  console.log("Navigating to /messages...");
  await page.goto(`${URL}/messages`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'docs/employee_messages_step_01.png' });
  await auditPageInfo('Messages', '/messages');

  // --- Step 11: Profile ---
  console.log("Navigating to /profile...");
  await page.goto(`${URL}/profile`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'docs/employee_profile_step_01.png' });
  await auditPageInfo('Profile', '/profile');

  // --- Step 12: Bugtrack ---
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
  await page.screenshot({ path: 'docs/employee_bugtrack_validation_step_01.png' });
  await auditPageInfo('Bug Reports Validation Errors', '/bugtrack');

  // Fill in bug details
  console.log("Filling in Bugtrack form...");
  await page.evaluate(() => {
    const titleInput = document.querySelector('input[placeholder*="title"], input[name*="title"]');
    if (titleInput) {
      titleInput.value = 'UI Bug Report Test';
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const descInput = document.querySelector('textarea[placeholder*="description"], textarea[name*="description"]');
    if (descInput) {
      descInput.value = 'This is a test bug description for the automated UI manual audit.';
      descInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'docs/employee_bugtrack_filled_step_02.png' });
  await auditPageInfo('Bug Reports (Filled)', '/bugtrack');

  // Write log to file
  console.log("Writing raw audit results to file...");
  fs.writeFileSync('docs/audit_results_raw.json', JSON.stringify(auditLog, null, 2));

  await browser.close();
  console.log("Audit browser run complete!");
}

run().catch(console.error);
