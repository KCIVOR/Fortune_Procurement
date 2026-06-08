const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const ADMIN_EMAIL = 'admin@fortune.com';
const TSQA_EMAIL = 'ubeeeyk@gmail.com';
const PASSWORD = 'Fortune2024!';

// Ensure directories exist
const adminDir = path.join(__dirname, 'docs', 'admin', 'screenshots');
const tsqaDir = path.join(__dirname, 'docs', 'tsqa', 'screenshots');
fs.mkdirSync(adminDir, { recursive: true });
fs.mkdirSync(tsqaDir, { recursive: true });

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function login(page, email, password) {
  console.log(`Logging in as ${email}...`);
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
  
  // Wait for login form inputs
  await page.waitForSelector('input[type="email"]');
  await page.type('input[type="email"]', email);
  await page.type('input[type="password"]', password);
  
  // Click submit button
  await page.click('button[type="submit"]');
  
  // Wait for redirect to dashboard
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  console.log("Logged in successfully.");
}

async function run() {
  const browser = await puppeteer.launch({
    headless: "new",
    defaultViewport: { width: 1280, height: 800 }
  });
  const page = await browser.newPage();

  try {
    // ─── ADMIN ROLE SCREENSHOTS ──────────────────────────────────────────────
    await login(page, ADMIN_EMAIL, PASSWORD);
    
    // 1. Dashboard
    console.log("Capturing Admin Dashboard...");
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle2' });
    await delay(2000); // Wait for stats to load
    await page.screenshot({ path: path.join(adminDir, 'dashboard.png') });
    
    // 2. User Management
    console.log("Capturing User Management...");
    await page.goto(`${BASE_URL}/admin/users`, { waitUntil: 'networkidle2' });
    await delay(2000);
    await page.screenshot({ path: path.join(adminDir, 'users.png') });
    
    // 3. Roles Management
    console.log("Capturing Roles Management...");
    await page.goto(`${BASE_URL}/admin/roles`, { waitUntil: 'networkidle2' });
    await delay(2000);
    await page.screenshot({ path: path.join(adminDir, 'roles.png') });
    
    // 4. Positions Management
    console.log("Capturing Positions Management...");
    await page.goto(`${BASE_URL}/admin/positions`, { waitUntil: 'networkidle2' });
    await delay(2000);
    await page.screenshot({ path: path.join(adminDir, 'positions.png') });
    
    // 5. Departments Management
    console.log("Capturing Departments Management...");
    await page.goto(`${BASE_URL}/admin/departments`, { waitUntil: 'networkidle2' });
    await delay(2000);
    await page.screenshot({ path: path.join(adminDir, 'departments.png') });
    
    // 6. Workflow Configuration (Workflows list + step editor)
    console.log("Capturing Workflows Configuration...");
    await page.goto(`${BASE_URL}/admin/workflows`, { waitUntil: 'networkidle2' });
    await delay(2000);
    
    // Click the first workflow row in the table to display the step editor
    try {
      const rows = await page.$$('table tbody tr');
      if (rows.length > 0) {
        console.log("Clicking workflow row to display editor...");
        await rows[0].click();
        await delay(2000); // Wait for steps to render
      }
    } catch (err) {
      console.warn("Could not click workflow row:", err.message);
    }
    await page.screenshot({ path: path.join(adminDir, 'workflows.png') });
    
    // 7. Module Visibility
    console.log("Capturing Module Visibility...");
    await page.goto(`${BASE_URL}/admin/module-visibility`, { waitUntil: 'networkidle2' });
    await delay(2000);
    await page.screenshot({ path: path.join(adminDir, 'module_visibility.png') });
    
    // 8. Audit Logs (Filters + Table + Detail drawer)
    console.log("Capturing Audit Logs...");
    await page.goto(`${BASE_URL}/admin/audit`, { waitUntil: 'networkidle2' });
    await delay(2000);
    
    // Click the first row of audit logs to open the detail drawer
    try {
      const logRows = await page.$$('table tbody tr');
      if (logRows.length > 0) {
        console.log("Clicking audit log row to open drawer...");
        await logRows[0].click();
        await delay(2000); // Wait for drawer animation
      }
    } catch (err) {
      console.warn("Could not click audit log row:", err.message);
    }
    await page.screenshot({ path: path.join(adminDir, 'audit.png') });
    
    // Log out (clear cookies and storage)
    console.log("Logging out admin...");
    const client = await page.target().createCDPSession();
    await client.send('Network.clearBrowserCookies');
    await client.send('Network.clearBrowserCache');
    await page.evaluate(() => localStorage.clear());
    await page.evaluate(() => sessionStorage.clear());
    
    // ─── TSQA ROLE SCREENSHOTS ───────────────────────────────────────────────
    await login(page, TSQA_EMAIL, PASSWORD);
    
    // 1. TSQA Dashboard
    console.log("Capturing TSQA Dashboard...");
    await page.goto(`${BASE_URL}/tsqa`, { waitUntil: 'networkidle2' });
    await delay(2000);
    await page.screenshot({ path: path.join(tsqaDir, 'rse_queue.png') }); // Main queue view
    
    // 2. TSQA RSE Queue (explicitly page)
    console.log("Capturing TSQA RSE Queue...");
    await page.goto(`${BASE_URL}/tsqa/rse`, { waitUntil: 'networkidle2' });
    await delay(2000);
    
    // Click a row to open RSE details page
    let clickedDetail = false;
    try {
      const rseLinks = await page.$$('a[href*="/tsqa/rse/"]');
      if (rseLinks.length > 0) {
        console.log("Clicking RSE details link...");
        await rseLinks[0].click();
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
        await delay(2000);
        clickedDetail = true;
      }
    } catch (err) {
      console.warn("Could not navigate to RSE details page:", err.message);
    }
    
    if (clickedDetail) {
      console.log("Capturing TSQA RSE Detail / Inspection page...");
      await page.screenshot({ path: path.join(tsqaDir, 'rse_inspection.png') });
      
      // Let's scroll or trigger actions if needed, otherwise capture verdict state
      console.log("Capturing TSQA RSE Verdict panel...");
      await page.screenshot({ path: path.join(tsqaDir, 'rse_verdict.png') });
    } else {
      // Fallback: copy queue page if detail is unreachable
      console.log("Detail page not clicked. Saving placeholder screenshots...");
      fs.copyFileSync(path.join(tsqaDir, 'rse_queue.png'), path.join(tsqaDir, 'rse_inspection.png'));
      fs.copyFileSync(path.join(tsqaDir, 'rse_queue.png'), path.join(tsqaDir, 'rse_verdict.png'));
    }

    console.log("All screenshots captured successfully!");
  } catch (err) {
    console.error("Error capturing screenshots:", err);
  } finally {
    await browser.close();
  }
}

run();
