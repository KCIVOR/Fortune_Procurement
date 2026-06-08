const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const URL = 'http://localhost:3000';
const EMAIL = 'director@fortune.com';
const PASSWORD = 'Fortune2024!';

async function run() {
  console.log("Creating approver audit directories...");
  const dirs = [
    'docs/approver/audit',
    'docs/approver/manual',
    'docs/approver/screenshots/dashboard',
    'docs/approver/screenshots/pr1_requests',
    'docs/approver/screenshots/pr2_requests',
    'docs/approver/screenshots/purchase_orders',
    'docs/approver/screenshots/approval_queue',
    'docs/approver/screenshots/approval_history',
    'docs/approver/screenshots/messages',
    'docs/approver/screenshots/profile',
    'docs/approver/screenshots/bugtrack'
  ];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }

  console.log("Launching browser for Approver audit...");
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
  await page.screenshot({ path: 'docs/approver/screenshots/profile/login_step_01.png' });
  
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
  
  // Capturing multiple dashboard views as requested
  await page.screenshot({ path: 'docs/approver/screenshots/dashboard/dashboard_full.png' });
  
  // Crop dashboard parts or take screenshots of parts (we will just take full and highlight parts or scroll)
  // Let's scroll to the KPI section
  await page.evaluate(() => {
    const kpis = document.querySelector('[class*="grid"]');
    if (kpis) kpis.scrollIntoView();
  });
  await page.screenshot({ path: 'docs/approver/screenshots/dashboard/dashboard_kpi.png' });
  
  // Pending approvals section scroll
  await page.evaluate(() => {
    const pendingSec = document.querySelector('h2');
    if (pendingSec) pendingSec.scrollIntoView();
  });
  await page.screenshot({ path: 'docs/approver/screenshots/dashboard/dashboard_pending.png' });

  // Sidebar navigation highlight
  await page.screenshot({ path: 'docs/approver/screenshots/dashboard/dashboard_sidebar.png' });

  // Top navigation highlight
  await page.screenshot({ path: 'docs/approver/screenshots/dashboard/dashboard_top.png' });

  await auditPageInfo('Dashboard', '/dashboard');

  // --- Step 3: PR1 Requests approvals ---
  console.log("Navigating to /approvals/pr1...");
  await page.goto(`${URL}/approvals/pr1`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'docs/approver/screenshots/pr1_requests/pr1_list.png' });
  await auditPageInfo('PR1 Requests List', '/approvals/pr1');

  // Find a PR1 approval path
  const pr1DetailPath = await page.evaluate(() => {
    const link = document.querySelector('a[href^="/approvals/"]');
    // Needs to make sure it doesn't match approvals/pr1, /approvals/pr2, /approvals/po, /approvals/history
    const links = Array.from(document.querySelectorAll('a[href^="/approvals/"]'));
    const pr1Link = links.find(a => {
      const h = a.getAttribute('href');
      return h && !h.startsWith('/approvals/pr1') && !h.startsWith('/approvals/pr2') && !h.startsWith('/approvals/po') && !h.startsWith('/approvals/history');
    });
    return pr1Link ? pr1Link.getAttribute('href') : null;
  });
  console.log(`Found PR1 Detail path: ${pr1DetailPath}`);
  if (pr1DetailPath) {
    console.log(`Navigating to PR1 Details: ${pr1DetailPath}`);
    await page.goto(`${URL}${pr1DetailPath}`, { waitUntil: 'networkidle0' }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'docs/approver/screenshots/pr1_requests/pr1_detail.png' });
    
    // Approval Timeline screenshot
    await page.evaluate(() => {
      const el = document.querySelector('h2:has(text), h2'); // Look for timeline header or wrapper
      // We can scroll to the timeline
      const timeline = Array.from(document.querySelectorAll('h2')).find(h => h.innerText.toLowerCase().includes('timeline') || h.innerText.toLowerCase().includes('history'));
      if (timeline) timeline.scrollIntoView();
    });
    await page.screenshot({ path: 'docs/approver/screenshots/pr1_requests/pr1_timeline.png' });
    
    // Approval Actions screenshot
    await page.evaluate(() => {
      const actionPanel = Array.from(document.querySelectorAll('h2')).find(h => h.innerText.toLowerCase().includes('action') || h.innerText.toLowerCase().includes('your action'));
      if (actionPanel) actionPanel.scrollIntoView();
    });
    await page.screenshot({ path: 'docs/approver/screenshots/pr1_requests/pr1_actions.png' });

    await auditPageInfo('PR1 Approval Detail View', pr1DetailPath);
  }

  // --- Step 4: PR2 Requests approvals ---
  console.log("Navigating to /approvals/pr2...");
  await page.goto(`${URL}/approvals/pr2`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'docs/approver/screenshots/pr2_requests/pr2_list.png' });
  await auditPageInfo('PR2 Requests List', '/approvals/pr2');

  const pr2DetailPath = await page.evaluate(() => {
    const link = document.querySelector('a[href^="/approvals/pr2/"]');
    return link ? link.getAttribute('href') : null;
  });
  console.log(`Found PR2 Detail path: ${pr2DetailPath}`);
  if (pr2DetailPath) {
    console.log(`Navigating to PR2 Details: ${pr2DetailPath}`);
    await page.goto(`${URL}${pr2DetailPath}`, { waitUntil: 'networkidle0' }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'docs/approver/screenshots/pr2_requests/pr2_detail.png' });
    
    // Items Section screenshot
    await page.evaluate(() => {
      const itemsSec = Array.from(document.querySelectorAll('h2')).find(h => h.innerText.toLowerCase().includes('items'));
      if (itemsSec) itemsSec.scrollIntoView();
    });
    await page.screenshot({ path: 'docs/approver/screenshots/pr2_requests/pr2_items.png' });

    // Approval Timeline screenshot
    await page.evaluate(() => {
      const timeline = Array.from(document.querySelectorAll('h2')).find(h => h.innerText.toLowerCase().includes('timeline') || h.innerText.toLowerCase().includes('phase'));
      if (timeline) timeline.scrollIntoView();
    });
    await page.screenshot({ path: 'docs/approver/screenshots/pr2_requests/pr2_timeline.png' });

    // Actions panel
    await page.evaluate(() => {
      const actionPanel = Array.from(document.querySelectorAll('h2')).find(h => h.innerText.toLowerCase().includes('action') || h.innerText.toLowerCase().includes('your action'));
      if (actionPanel) actionPanel.scrollIntoView();
    });
    await page.screenshot({ path: 'docs/approver/screenshots/pr2_requests/pr2_actions.png' });

    await auditPageInfo('PR2 Approval Detail View', pr2DetailPath);
  }

  // --- Step 5: Purchase Orders approvals ---
  console.log("Navigating to /approvals/po...");
  await page.goto(`${URL}/approvals/po`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'docs/approver/screenshots/purchase_orders/po_list.png' });
  await auditPageInfo('PO Requests List', '/approvals/po');

  const poDetailPath = await page.evaluate(() => {
    const link = document.querySelector('a[href^="/approvals/po/"]');
    return link ? link.getAttribute('href') : null;
  });
  console.log(`Found PO Detail path: ${poDetailPath}`);
  if (poDetailPath) {
    console.log(`Navigating to PO Details: ${poDetailPath}`);
    await page.goto(`${URL}${poDetailPath}`, { waitUntil: 'networkidle0' }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'docs/approver/screenshots/purchase_orders/po_detail.png' });
    
    // Approval Timeline screenshot
    await page.evaluate(() => {
      const timeline = Array.from(document.querySelectorAll('h2')).find(h => h.innerText.toLowerCase().includes('timeline') || h.innerText.toLowerCase().includes('chain'));
      if (timeline) timeline.scrollIntoView();
    });
    await page.screenshot({ path: 'docs/approver/screenshots/purchase_orders/po_timeline.png' });

    // Actions panel
    await page.evaluate(() => {
      const actionPanel = Array.from(document.querySelectorAll('h2')).find(h => h.innerText.toLowerCase().includes('action') || h.innerText.toLowerCase().includes('your action'));
      if (actionPanel) actionPanel.scrollIntoView();
    });
    await page.screenshot({ path: 'docs/approver/screenshots/purchase_orders/po_actions.png' });

    await auditPageInfo('PO Approval Detail View', poDetailPath);
  }

  // --- Step 6: Approval Queue ---
  console.log("Navigating to /approvals...");
  await page.goto(`${URL}/approvals`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'docs/approver/screenshots/approval_queue/queue_list.png' });
  await auditPageInfo('Approval Queue', '/approvals');

  // Let's use the first available pending item review link (which might be PR1 or something else)
  const generalDetailPath = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    const reviewLink = links.find(a => {
      const text = a.innerText.toLowerCase();
      const href = a.getAttribute('href');
      return href && (text.includes('review') || text.includes('→')) && href.includes('/approvals/') && !href.startsWith('/approvals/history') && !href.startsWith('/approvals/pr1') && !href.startsWith('/approvals/pr2') && !href.startsWith('/approvals/po');
    });
    return reviewLink ? reviewLink.getAttribute('href') : null;
  });
  console.log(`Found General Detail path: ${generalDetailPath}`);
  if (generalDetailPath) {
    console.log(`Navigating to General Queue Detail: ${generalDetailPath}`);
    await page.goto(`${URL}${generalDetailPath}`, { waitUntil: 'networkidle0' }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'docs/approver/screenshots/approval_queue/queue_detail.png' });
    await auditPageInfo('Approval Queue Detail', generalDetailPath);
  }

  // --- Step 7: Approval History ---
  console.log("Navigating to /approvals/history...");
  await page.goto(`${URL}/approvals/history`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'docs/approver/screenshots/approval_history/history_list.png' });
  await auditPageInfo('Approval History List', '/approvals/history');

  // Find a view link in history
  const historyDetailPath = await page.evaluate(() => {
    const link = document.querySelector('a[href*="/approvals/"]');
    return link ? link.getAttribute('href') : null;
  });
  console.log(`Found History Detail path: ${historyDetailPath}`);
  if (historyDetailPath) {
    console.log(`Navigating to History Details: ${historyDetailPath}`);
    await page.goto(`${URL}${historyDetailPath}`, { waitUntil: 'networkidle0' }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'docs/approver/screenshots/approval_history/history_detail.png' });
    await auditPageInfo('Approval History Detail View', historyDetailPath);
  }

  // --- Step 8: Messages ---
  console.log("Navigating to /messages...");
  await page.goto(`${URL}/messages`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'docs/approver/screenshots/messages/messages_list.png' });
  await auditPageInfo('Messages List', '/messages');

  // Let's click on the first conversation to get detail if available
  const chatClicked = await page.evaluate(() => {
    const conversation = document.querySelector('[class*="cursor-pointer"]');
    if (conversation) {
      conversation.click();
      return true;
    }
    return false;
  });
  if (chatClicked) {
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: 'docs/approver/screenshots/messages/message_detail.png' });
  }

  // --- Step 9: Bugtrack ---
  console.log("Navigating to /bugtrack...");
  await page.goto(`${URL}/bugtrack`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'docs/approver/screenshots/bugtrack/bugtrack_list.png' });
  await auditPageInfo('Bugtrack Form', '/bugtrack');

  // Trigger validation error screenshot
  await page.evaluate(() => {
    const submitBtn = Array.from(document.querySelectorAll('button')).find(btn => btn.innerText.toLowerCase().includes('submit') || btn.innerText.toLowerCase().includes('report'));
    if (submitBtn) submitBtn.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'docs/approver/screenshots/bugtrack/bugtrack_detail.png' }); // validation screenshot

  // Fill in form for a create bug screenshot
  await page.evaluate(() => {
    const titleInput = document.querySelector('input[placeholder*="title"], input[name*="title"], input[placeholder*="Summary"]');
    if (titleInput) {
      titleInput.value = 'Approver Bug Report Test';
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const locInput = document.querySelector('input[placeholder*="Happens"]');
    if (locInput) {
      locInput.value = '/dashboard';
      locInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const descInput = document.querySelector('textarea[placeholder*="description"], textarea[name*="description"], textarea[placeholder*="detail"]');
    if (descInput) {
      descInput.value = 'Test description of bug reported by Approver role';
      descInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const expInput = document.querySelector('textarea[placeholder*="Expected"], textarea[placeholder*="instead"]');
    if (expInput) {
      expInput.value = 'Correct visual display.';
      expInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'docs/approver/screenshots/bugtrack/bugtrack_create.png' });

  // --- Step 10: Profile ---
  console.log("Navigating to /profile...");
  await page.goto(`${URL}/profile`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'docs/approver/screenshots/profile/profile.png' });
  await auditPageInfo('Profile Settings', '/profile');

  // Make a small change to edit profile area and screenshot
  await page.evaluate(() => {
    const nameInput = document.querySelector('input[placeholder*="name"], input[name*="name"], input[value*="Eduardo"]');
    if (nameInput) {
      nameInput.value = 'Eduardo Torres - Director';
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'docs/approver/screenshots/profile/profile_edit.png' });

  // Save log
  console.log("Writing raw audit results to file...");
  fs.writeFileSync('docs/approver/audit_results_raw.json', JSON.stringify(auditLog, null, 2));

  await browser.close();
  console.log("Audit complete successfully!");
}

run().catch(console.error);
