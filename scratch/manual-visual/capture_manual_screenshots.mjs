import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";

const baseUrl = "http://localhost:3001";
const outDir = path.resolve("scratch/manual-visual/screenshots");

const shots = [
  {
    file: "01-dashboard.png",
    title: "Dashboard overview",
    role: "employee@fortune.com",
    route: "/dashboard",
    targets: ["New PR1", "TOTAL REQUESTS", "PENDING APPROVAL", "Recent Requests", "View"],
  },
  {
    file: "02-pr1-new-request.png",
    title: "Create PR1 request",
    role: "employee@fortune.com",
    route: "/pr1/new",
    targets: ["REQUEST TYPE", "PURPOSE", "DATE REQUIRED", "PRIORITY", "Add Item", "Save Draft", "Submit PR1"],
  },
  {
    file: "03-planning-pr2.png",
    title: "Create Planning PR2 request",
    role: "planning@fortune.com",
    route: "/planning/pr2/new",
    targets: ["REQUEST TYPE", "PURPOSE", "DATE REQUIRED", "PRIORITY", "Add Line", "Save as Draft", "Submit for Approval"],
  },
  {
    file: "04-warehouse-validation.png",
    title: "Warehouse validation detail",
    role: "warehouse@fortune.com",
    route: "/warehouse/fb6ca8e0-4a28-40b8-bf09-d540418e9954",
    targets: [],
  },
  {
    file: "05-approval-queue.png",
    title: "Approval queue",
    role: "supervisor@fortune.com",
    route: "/approvals",
    targets: ["Approval Queue", "Awaiting My Action", "Current Step", "Review"],
  },
  {
    file: "06-rfq.png",
    title: "Request for quotation",
    role: "procurement@fortune.com",
    route: "/rfq",
    targets: ["Awaiting RFQ", "RFQ Issued", "ACTIVE RFQS", "Open RFQ"],
  },
  {
    file: "07-purchase-orders.png",
    title: "Purchase orders",
    role: "procurement@fortune.com",
    route: "/po",
    targets: ["Generate PO", "TOTAL POS", "FOR APPROVAL", "STATUS", "View"],
  },
  {
    file: "08-supplier-quotations.png",
    title: "Supplier quotation workspace",
    role: "supplier@fortune.com",
    route: "/supplier/quotations",
    targets: ["Awaiting Response", "RFQ NO.", "STATUS", "Submit Quote"],
  },
  {
    file: "09-supplier-deliveries.png",
    title: "Supplier delivery updates",
    role: "supplier@fortune.com",
    route: "/supplier/delivery",
    targets: ["Deliveries", "SEARCH", "STATUS", "View"],
  },
  {
    file: "10-goods-receipt.png",
    title: "Goods receipt notes",
    role: "warehouse@fortune.com",
    route: "/grn",
    targets: ["Goods Receipt Notes", "Open", "Status", "View"],
  },
  {
    file: "11-tsqa.png",
    title: "TSQA quality review",
    role: "ubeeeyk@gmail.com",
    route: "/tsqa",
    targets: ["TSQA Dashboard", "View GRN QA Queue", "GRNS IN QUEUE", "ITEMS PENDING QA", "FULLY APPROVED"],
  },
  {
    file: "12-wishlist.png",
    title: "Wishlist ideas",
    role: "employee@fortune.com",
    route: "/wishlist",
    targets: ["Submit an idea", "Title", "Description", "Category", "Submit idea"],
  },
  {
    file: "13-admin-users.png",
    title: "Admin user management",
    role: "admin@fortune.com",
    route: "/admin/users",
    targets: ["Create User", "Bulk Import", "SEARCH", "ROLE", "View"],
  },
  {
    file: "14-admin-bulk-import.png",
    title: "Bulk import users",
    role: "admin@fortune.com",
    route: "/admin/users",
    click: "Bulk Import",
    targets: ["UPLOAD", "Template", "Click or drag & drop to upload", "Cancel"],
  },
  {
    file: "15-admin-roles.png",
    title: "Admin roles",
    role: "admin@fortune.com",
    route: "/admin/roles",
    targets: ["Roles", "Role Name", "Users", "Created"],
  },
  {
    file: "16-admin-workflows.png",
    title: "Admin workflows",
    role: "admin@fortune.com",
    route: "/admin/workflows",
    targets: ["Approval Workflows", "Code", "Name", "Steps"],
  },
  {
    file: "17-admin-settings.png",
    title: "Admin settings",
    role: "admin@fortune.com",
    route: "/admin/settings",
    targets: ["VAT Rate", "Save VAT Rate", "SMTP", "DROPDOWN OPTIONS"],
  },
  {
    file: "18-admin-create-user.png",
    title: "Create administrator user",
    role: "admin@fortune.com",
    route: "/admin/users",
    click: "Create User",
    targets: ["Create New User", "Full Name", "Email", "Role", "Position", "Department", "Create User"],
  },
  {
    file: "19-admin-positions.png",
    title: "Admin positions",
    role: "admin@fortune.com",
    route: "/admin/positions",
    targets: ["Positions", "Create Position", "Position Title", "Role", "Active"],
  },
  {
    file: "20-admin-departments.png",
    title: "Admin departments",
    role: "admin@fortune.com",
    route: "/admin/departments",
    targets: ["Departments", "Create Department", "Department Name", "Code", "Active"],
  },
  {
    file: "21-admin-module-visibility.png",
    title: "Admin module visibility",
    role: "admin@fortune.com",
    route: "/admin/module-visibility",
    targets: ["Module Visibility", "Role", "Position scope", "Save changes"],
  },
  {
    file: "22-admin-audit-logs.png",
    title: "Admin audit logs",
    role: "admin@fortune.com",
    route: "/admin/audit",
    targets: ["Audit Logs", "Action", "Document Type", "Apply Filters", "Clear"],
  },
  {
    file: "23-admin-dropdown-options.png",
    title: "Admin dropdown options",
    role: "admin@fortune.com",
    route: "/admin/settings",
    click: "Payment Terms",
    targets: ["DROPDOWN OPTIONS", "Payment Terms", "Move up", "Edit label", "Remove", "Add Option"],
  },
];

async function clickText(page, text, options = {}) {
  const timeout = options.timeout ?? 5000;
  await page.waitForFunction(
    (needle) => {
      const elements = [...document.querySelectorAll("button,a,input,[role='button']")];
      return elements.some((el) => (el.innerText || el.value || "").toLowerCase().includes(needle.toLowerCase()));
    },
    { timeout },
    text,
  );
  const handle = await page.evaluateHandle((needle) => {
    const elements = [...document.querySelectorAll("button,a,input,[role='button']")];
    return elements.find((el) => (el.innerText || el.value || "").toLowerCase().includes(needle.toLowerCase()));
  }, text);
  await handle.asElement().click();
}

async function login(browser, email) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: 1440, height: 980, deviceScaleFactor: 1 });
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle2", timeout: 60000 });
  await clickText(page, "Dev Quick Login", { timeout: 60000 });
  await clickText(page, email, { timeout: 60000 });
  await page.waitForFunction(() => !location.pathname.startsWith("/login"), { timeout: 30000 }).catch(() => {});
  return { page, context };
}

async function waitForWorkspace(page) {
  await page.waitForFunction(
    () => {
      const text = document.body?.innerText || "";
      return !text.includes("Loading your workspace") && !text.includes("Signing in");
    },
    { timeout: 45000 },
  ).catch(() => {});
  await page.waitForFunction(
    () => {
      const text = document.body?.innerText || "";
      return text.includes("Dashboard") || text.includes("Users") || text.includes("Requests") || text.includes("Purchase") || text.includes("Supplier") || text.includes("Admin") || text.includes("Wishlist") || text.includes("TSQA") || text.length > 400;
    },
    { timeout: 45000 },
  ).catch(() => {});
}

async function annotate(page, targets) {
  return await page.evaluate((labels) => {
    document.querySelectorAll("[data-manual-overlay]").forEach((el) => el.remove());
    const style = document.createElement("style");
    style.setAttribute("data-manual-overlay", "style");
    style.textContent = `
      [data-manual-overlay] { pointer-events: none !important; z-index: 2147483647 !important; }
      .manual-callout-box { position: fixed; border: 4px solid #dc2626; border-radius: 8px; box-shadow: 0 0 0 2px rgba(255,255,255,.95), 0 6px 18px rgba(0,0,0,.18); }
      .manual-callout-number { position: fixed; width: 28px; height: 28px; border-radius: 999px; background: #dc2626; color: white; font: 700 15px/28px Arial, sans-serif; text-align: center; box-shadow: 0 0 0 3px white, 0 4px 12px rgba(0,0,0,.22); }
      .manual-callout-title { position: fixed; left: 18px; bottom: 18px; max-width: 680px; padding: 10px 14px; border-radius: 8px; background: rgba(17,24,39,.92); color: white; font: 600 15px/1.35 Arial, sans-serif; }
    `;
    document.head.appendChild(style);

    const all = [...document.querySelectorAll("button,a,input,textarea,select,label,h1,h2,h3,h4,th,td,p,span,div")];
    const matches = [];
    const missing = [];
    for (const label of labels) {
      const needle = label.toLowerCase();
      const candidates = all
        .map((el) => {
          const text = (el.innerText || el.value || el.getAttribute("aria-label") || el.getAttribute("placeholder") || "").trim();
          const rect = el.getBoundingClientRect();
          return { el, text, rect };
        })
        .filter(({ text, rect }) =>
          text.toLowerCase().includes(needle) &&
          rect.width > 18 &&
          rect.height > 12 &&
          rect.bottom >= 0 &&
          rect.top <= window.innerHeight &&
          rect.right >= 0 &&
          rect.left <= window.innerWidth
        )
        .sort((a, b) => (a.rect.width * a.rect.height) - (b.rect.width * b.rect.height));
      if (candidates[0]) matches.push({ label, rect: candidates[0].rect });
      else missing.push(label);
    }

    matches.slice(0, 6).forEach(({ rect }, index) => {
      const pad = 6;
      const box = document.createElement("div");
      box.className = "manual-callout-box";
      box.setAttribute("data-manual-overlay", "box");
      box.style.left = `${Math.max(2, rect.left - pad)}px`;
      box.style.top = `${Math.max(2, rect.top - pad)}px`;
      box.style.width = `${Math.min(window.innerWidth - rect.left - 4, rect.width + pad * 2)}px`;
      box.style.height = `${Math.min(window.innerHeight - rect.top - 4, rect.height + pad * 2)}px`;
      document.body.appendChild(box);

      const marker = document.createElement("div");
      marker.className = "manual-callout-number";
      marker.setAttribute("data-manual-overlay", "marker");
      marker.textContent = String(index + 1);
      marker.style.left = `${Math.max(4, rect.left - 16)}px`;
      marker.style.top = `${Math.max(4, rect.top - 18)}px`;
      document.body.appendChild(marker);
    });

    const legend = document.createElement("div");
    legend.className = "manual-callout-title";
    legend.setAttribute("data-manual-overlay", "legend");
    legend.textContent = matches.slice(0, 6).map((m, i) => `${i + 1}. ${m.label}`).join("   ");
    if (matches.length) document.body.appendChild(legend);
    return { matched: matches.map((match) => match.label), missing };
  }, targets);
}

async function capture(browser, shot) {
  const { page, context } = await login(browser, shot.role);
  const output = path.join(outDir, shot.file);
  try {
    await page.goto(`${baseUrl}${shot.route}`, { waitUntil: "networkidle2", timeout: 60000 });
    await waitForWorkspace(page);
    await new Promise((resolve) => setTimeout(resolve, 1800));
    if (shot.click) {
      await clickText(page, shot.click, { timeout: 6000 }).catch(() => {});
      await waitForWorkspace(page);
      await new Promise((resolve) => setTimeout(resolve, 1800));
    }
    await page.screenshot({ path: output, fullPage: false });
    return { ...shot, ok: true, path: output };
  } catch (error) {
    await page.screenshot({ path: output, fullPage: false }).catch(() => {});
    return { ...shot, ok: false, path: output, error: String(error?.message || error) };
  } finally {
    await context.close();
  }
}

await fs.mkdir(outDir, { recursive: true });
const requested = new Set(process.argv.slice(2));
const runShots = requested.size ? shots.filter((shot) => requested.has(shot.file) || requested.has(shot.title)) : shots;
const browser = await puppeteer.launch({ headless: true, defaultViewport: { width: 1440, height: 900 } });
const results = [];
try {
  for (const shot of runShots) {
    console.log(`Capturing ${shot.file} - ${shot.title}`);
    results.push(await capture(browser, shot));
  }
} finally {
  await browser.close();
}

await fs.writeFile(
  path.join(outDir, "manifest.json"),
  JSON.stringify(results, null, 2),
  "utf8",
);

const failed = results.filter((item) => !item.ok);
console.log(`Captured ${results.length} screenshots; ${failed.length} failed.`);
for (const item of failed) console.log(`FAILED ${item.file}: ${item.error}`);
