const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const URL = 'http://localhost:3000';
const PASSWORD = 'Fortune2024!';

const LOGINS = {
  supervisor: { email: 'supervisor@fortune.com', name: 'Roberto Lim' },
  finance: { email: 'finance.director@fortune.com', name: 'Gloria Navarro' },
  director: { email: 'director@fortune.com', name: 'Eduardo Torres' }
};

async function run() {
  console.log("Creating directories...");
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

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

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
        bodyText: document.body.innerText.substring(0, 1500)
      };
    });

    auditLog[pageName] = {
      path: urlPath,
      url: page.url(),
      ...info
    };
  }

  async function loginAs(userKey) {
    const user = LOGINS[userKey];
    console.log(`Logging in as ${user.name} (${user.email})...`);
    await page.goto(`${URL}/login`, { waitUntil: 'networkidle0' }).catch(() => {});
    await new Promise(r => setTimeout(r, 1000));
    
    // Clear and type email
    await page.evaluate(() => {
      const email = document.querySelector('input[type="email"]');
      if (email) email.value = '';
      const pwd = document.querySelector('input[type="password"]');
      if (pwd) pwd.value = '';
    });
    
    await page.type('input[type="email"]', user.email);
    await page.type('input[type="password"]', PASSWORD);
    
    await page.evaluate(() => {
      const submitBtn = document.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.click();
    });
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 5000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 1500));
  }

  async function logout() {
    console.log("Logging out...");
    // Go to profile and click logout or clear local storage and cookies
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.deleteCookie(...(await page.cookies()));
    await page.goto(`${URL}/login`, { waitUntil: 'networkidle0' }).catch(() => {});
    await new Promise(r => setTimeout(r, 1000));
  }

  // ==========================================
  // PART 1: SUPERVISOR (PR1)
  // ==========================================
  await loginAs('supervisor');
  
  console.log("Navigating to PR1 List...");
  await page.goto(`${URL}/approvals/pr1`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'docs/approver/screenshots/pr1_requests/pr1_list.png' });
  await auditPageInfo('PR1 List (Supervisor)', '/approvals/pr1');

  // Find review link
  const pr1Path = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href^="/approvals/"]'));
    const pr1Link = links.find(a => {
      const h = a.getAttribute('href');
      return h && !h.startsWith('/approvals/pr1') && !h.startsWith('/approvals/pr2') && !h.startsWith('/approvals/po') && !h.startsWith('/approvals/history');
    });
    return pr1Link ? pr1Link.getAttribute('href') : null;
  });

  console.log(`Found PR1 path: ${pr1Path}`);
  if (pr1Path) {
    await page.goto(`${URL}${pr1Path}`, { waitUntil: 'networkidle0' }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'docs/approver/screenshots/pr1_requests/pr1_detail.png' });
    
    // Timeline
    await page.evaluate(() => {
      const t = Array.from(document.querySelectorAll('h2')).find(h => h.innerText.toLowerCase().includes('timeline') || h.innerText.toLowerCase().includes('history'));
      if (t) t.scrollIntoView();
    });
    await page.screenshot({ path: 'docs/approver/screenshots/pr1_requests/pr1_timeline.png' });

    // Actions panel
    await page.evaluate(() => {
      const act = Array.from(document.querySelectorAll('h2, button')).find(el => el.innerText.toLowerCase().includes('your action') || el.innerText.toLowerCase().includes('approve'));
      if (act) act.scrollIntoView();
    });
    await page.screenshot({ path: 'docs/approver/screenshots/pr1_requests/pr1_actions.png' });

    await auditPageInfo('PR1 Detail (Supervisor)', pr1Path);
  } else {
    console.log("WARNING: PR1 path was null! Make sure data is seeded.");
  }

  await logout();

  // ==========================================
  // PART 2: FINANCE DIRECTOR (PO)
  // ==========================================
  await loginAs('finance');

  console.log("Navigating to PO List...");
  await page.goto(`${URL}/approvals/po`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'docs/approver/screenshots/purchase_orders/po_list.png' });
  await auditPageInfo('PO List (Finance Director)', '/approvals/po');

  const poPath = await page.evaluate(() => {
    const link = document.querySelector('a[href^="/approvals/po/"]');
    return link ? link.getAttribute('href') : null;
  });

  console.log(`Found PO path: ${poPath}`);
  if (poPath) {
    await page.goto(`${URL}${poPath}`, { waitUntil: 'networkidle0' }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'docs/approver/screenshots/purchase_orders/po_detail.png' });

    // Timeline
    await page.evaluate(() => {
      const t = Array.from(document.querySelectorAll('h2')).find(h => h.innerText.toLowerCase().includes('timeline') || h.innerText.toLowerCase().includes('chain'));
      if (t) t.scrollIntoView();
    });
    await page.screenshot({ path: 'docs/approver/screenshots/purchase_orders/po_timeline.png' });

    // Actions
    await page.evaluate(() => {
      const act = Array.from(document.querySelectorAll('h2, button')).find(el => el.innerText.toLowerCase().includes('your action') || el.innerText.toLowerCase().includes('approve'));
      if (act) act.scrollIntoView();
    });
    await page.screenshot({ path: 'docs/approver/screenshots/purchase_orders/po_actions.png' });

    await auditPageInfo('PO Detail (Finance Director)', poPath);
  } else {
    console.log("WARNING: PO path was null! Make sure data is seeded.");
  }

  await logout();

  // ==========================================
  // PART 3: DIRECTOR (Dashboard, PR2, Messages, Bugtrack, Profile)
  // ==========================================
  await loginAs('director');

  console.log("Navigating to Dashboard...");
  await page.goto(`${URL}/dashboard`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'docs/approver/screenshots/dashboard/dashboard_full.png' });

  // Crop sections or scroll
  await page.evaluate(() => {
    const k = document.querySelector('[class*="grid"]');
    if (k) k.scrollIntoView();
  });
  await page.screenshot({ path: 'docs/approver/screenshots/dashboard/dashboard_kpi.png' });

  await page.evaluate(() => {
    const p = Array.from(document.querySelectorAll('h2')).find(h => h.innerText.toLowerCase().includes('pending') || h.innerText.toLowerCase().includes('queue'));
    if (p) p.scrollIntoView();
  });
  await page.screenshot({ path: 'docs/approver/screenshots/dashboard/dashboard_pending.png' });

  // Sidebar & TopNav screenshots (using full layouts)
  await page.screenshot({ path: 'docs/approver/screenshots/dashboard/dashboard_sidebar.png' });
  await page.screenshot({ path: 'docs/approver/screenshots/dashboard/dashboard_top.png' });

  await auditPageInfo('Dashboard (Director)', '/dashboard');

  console.log("Navigating to PR2 List...");
  await page.goto(`${URL}/approvals/pr2`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'docs/approver/screenshots/pr2_requests/pr2_list.png' });
  await auditPageInfo('PR2 List (Director)', '/approvals/pr2');

  const pr2Path = await page.evaluate(() => {
    const link = document.querySelector('a[href^="/approvals/pr2/"]');
    return link ? link.getAttribute('href') : null;
  });

  console.log(`Found PR2 path: ${pr2Path}`);
  if (pr2Path) {
    await page.goto(`${URL}${pr2Path}`, { waitUntil: 'networkidle0' }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'docs/approver/screenshots/pr2_requests/pr2_detail.png' });

    // Items Section
    await page.evaluate(() => {
      const itemsSec = Array.from(document.querySelectorAll('h2')).find(h => h.innerText.toLowerCase().includes('items'));
      if (itemsSec) itemsSec.scrollIntoView();
    });
    await page.screenshot({ path: 'docs/approver/screenshots/pr2_requests/pr2_items.png' });

    // Timeline
    await page.evaluate(() => {
      const t = Array.from(document.querySelectorAll('h2')).find(h => h.innerText.toLowerCase().includes('timeline') || h.innerText.toLowerCase().includes('phase'));
      if (t) t.scrollIntoView();
    });
    await page.screenshot({ path: 'docs/approver/screenshots/pr2_requests/pr2_timeline.png' });

    // Actions
    await page.evaluate(() => {
      const act = Array.from(document.querySelectorAll('h2, button')).find(el => el.innerText.toLowerCase().includes('your action') || el.innerText.toLowerCase().includes('approve'));
      if (act) act.scrollIntoView();
    });
    await page.screenshot({ path: 'docs/approver/screenshots/pr2_requests/pr2_actions.png' });

    await auditPageInfo('PR2 Detail (Director)', pr2Path);
  } else {
    console.log("WARNING: PR2 path was null!");
  }

  // Queue List & Queue Detail
  console.log("Navigating to General Queue...");
  await page.goto(`${URL}/approvals`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'docs/approver/screenshots/approval_queue/queue_list.png' });
  await auditPageInfo('Approval Queue (Director)', '/approvals');

  const generalPath = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    const reviewLink = links.find(a => {
      const text = a.innerText.toLowerCase();
      const href = a.getAttribute('href');
      return href && (text.includes('review') || text.includes('→')) && href.includes('/approvals/') && !href.startsWith('/approvals/history') && !href.startsWith('/approvals/pr1') && !href.startsWith('/approvals/pr2') && !href.startsWith('/approvals/po');
    });
    return reviewLink ? reviewLink.getAttribute('href') : null;
  });

  console.log(`Found general path: ${generalPath}`);
  if (generalPath) {
    await page.goto(`${URL}${generalPath}`, { waitUntil: 'networkidle0' }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'docs/approver/screenshots/approval_queue/queue_detail.png' });
    await auditPageInfo('Queue Detail (Director)', generalPath);
  }

  // History List & History Detail
  console.log("Navigating to History...");
  await page.goto(`${URL}/approvals/history`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'docs/approver/screenshots/approval_history/history_list.png' });
  await auditPageInfo('Approval History List (Director)', '/approvals/history');

  const historyPath = await page.evaluate(() => {
    const link = document.querySelector('a[href*="/approvals/"]');
    return link ? link.getAttribute('href') : null;
  });

  console.log(`Found history detail path: ${historyPath}`);
  if (historyPath) {
    await page.goto(`${URL}${historyPath}`, { waitUntil: 'networkidle0' }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'docs/approver/screenshots/approval_history/history_detail.png' });
    await auditPageInfo('History Detail (Director)', historyPath);
  }

  // Messages
  console.log("Navigating to Messages...");
  await page.goto(`${URL}/messages`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'docs/approver/screenshots/messages/messages_list.png' });
  await auditPageInfo('Messages List (Director)', '/messages');

  const msgClicked = await page.evaluate(() => {
    const conv = document.querySelector('[class*="cursor-pointer"]');
    if (conv) { conv.click(); return true; }
    return false;
  });
  if (msgClicked) {
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: 'docs/approver/screenshots/messages/message_detail.png' });
  }

  // Bugtrack
  console.log("Navigating to Bugtrack...");
  await page.goto(`${URL}/bugtrack`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'docs/approver/screenshots/bugtrack/bugtrack_list.png' });
  await auditPageInfo('Bugtrack Form (Director)', '/bugtrack');

  // Trigger validation error
  await page.evaluate(() => {
    const submitBtn = Array.from(document.querySelectorAll('button')).find(btn => btn.innerText.toLowerCase().includes('submit') || btn.innerText.toLowerCase().includes('report'));
    if (submitBtn) submitBtn.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'docs/approver/screenshots/bugtrack/bugtrack_detail.png' });

  // Fill in form for a create bug
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

  // Profile
  console.log("Navigating to Profile...");
  await page.goto(`${URL}/profile`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'docs/approver/screenshots/profile/profile.png' });
  await auditPageInfo('Profile Settings (Director)', '/profile');

  // Make change to name input
  await page.evaluate(() => {
    const nameInput = document.querySelector('input[value*="Eduardo"], input[name*="name"], input[placeholder*="name"]');
    if (nameInput) {
      nameInput.value = 'Eduardo Torres - Director';
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'docs/approver/screenshots/profile/profile_edit.png' });

  console.log("Writing raw audit results...");
  fs.writeFileSync('docs/approver/audit_results_raw.json', JSON.stringify(auditLog, null, 2));

  await browser.close();
  console.log("Multi-role audit complete successfully!");
}

run().catch(console.error);
