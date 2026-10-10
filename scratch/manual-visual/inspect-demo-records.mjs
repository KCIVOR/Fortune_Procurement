import puppeteer from "puppeteer";

const baseUrl = "http://localhost:3001";
const cases = [
  ["warehouse@fortune.com", "/warehouse"],
  ["supervisor@fortune.com", "/approvals"],
  ["procurement@fortune.com", "/rfq"],
  ["procurement@fortune.com", "/po"],
  ["supplier@fortune.com", "/supplier/delivery"],
  ["warehouse@fortune.com", "/grn"],
  ["ubeeeyk@gmail.com", "/tsqa"],
  ["warehouse@fortune.com", "/warehouse/fb6ca8e0-4a28-40b8-bf09-d540418e9954"],
  ["supervisor@fortune.com", "/approvals/0424f80f-dce2-46ef-9a6d-cb5f464640dc"],
  ["supplier@fortune.com", "/supplier/delivery/929af7a2-dc33-4d1f-b969-5ce541c76635"],
  ["ubeeeyk@gmail.com", "/tsqa/grn"],
];

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function clickContaining(page, text) {
  const handle = await page.evaluateHandle((needle) =>
    [...document.querySelectorAll("button,a,[role='button']")].find((el) =>
      (el.innerText || "").toLowerCase().includes(needle.toLowerCase()),
    ), text);
  const element = handle.asElement();
  if (!element) throw new Error(`Could not find ${text}`);
  await element.click();
}

async function login(browser, email) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: 1440, height: 980 });
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle2" });
  await clickContaining(page, "Dev Quick Login");
  await clickContaining(page, email);
  await page.waitForFunction(() => !location.pathname.startsWith("/login"), { timeout: 30000 });
  await pause(1600);
  return { page, context };
}

const browser = await puppeteer.launch({ headless: true });
try {
  for (const [email, route] of cases) {
    const { page, context } = await login(browser, email);
    await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle2" });
    await pause(1600);
    const result = await page.evaluate(() => ({
      text: document.body.innerText,
      links: [...document.querySelectorAll("a")]
        .filter((link) => link.innerText.trim())
        .map((link) => ({ text: link.innerText.trim(), href: link.getAttribute("href") }))
        .slice(-30),
      buttons: [...document.querySelectorAll("button")]
        .filter((button) => button.innerText.trim())
        .map((button) => button.innerText.trim()),
    }));
    console.log(`\n=== ${email} ${route} ===`);
    console.log(result.text.slice(0, 7000));
    console.log("LINKS", JSON.stringify(result.links));
    console.log("BUTTONS", JSON.stringify(result.buttons));
    await context.close();
  }
} finally {
  await browser.close();
}
