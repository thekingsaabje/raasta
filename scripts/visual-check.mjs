// Visual QA: screenshots key pages at desktop (1440x900) and mobile (390x844) and flags elements that stay
// invisible (stuck entrance animations) or overflow horizontally.
// Usage: node scripts/visual-check.mjs [baseUrl]   → writes PNGs to qa-shots/
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:5173";
const pages = ["/", "/scholarships", "/scholarships/test-cn-master", "/costs", "/pricing", "/how-it-works", "/login", "/signup"];
const sizes = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };
mkdirSync("qa-shots", { recursive: true });

const browser = await chromium.launch();
let problems = 0;
for (const [name, viewport] of Object.entries(sizes)) {
  const ctx = await browser.newContext({ viewport, isMobile: name === "mobile", hasTouch: name === "mobile", deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  for (const path of pages) {
    await page.goto(base + path, { waitUntil: "networkidle" });
    await page.waitForTimeout(1800);
    const r = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const faded = [...document.querySelectorAll("main *")]
        .filter((el) => !el.closest(":disabled"))
        .filter((el) => { const b = el.getBoundingClientRect(); return b.top < innerHeight && b.bottom > 0 && b.height > 0 && getComputedStyle(el).opacity !== "1" && Number(getComputedStyle(el).opacity) < 0.5; })
        .map((el) => (el.textContent ?? "").trim().slice(0, 40)).filter(Boolean).slice(0, 3);
      const overflow = document.documentElement.scrollWidth > vw + 1;
      return { faded, overflow, scrollWidth: document.documentElement.scrollWidth, vw };
    });
    const file = `qa-shots/${name}${path.replace(/\//g, "_") || "_home"}.png`;
    await page.screenshot({ path: file });
    const bad = r.faded.length || r.overflow;
    if (bad) problems++;
    console.log(`${bad ? "PROBLEM" : "ok     "} ${name.padEnd(7)} ${path.padEnd(32)} ${r.overflow ? `overflow ${r.scrollWidth}>${r.vw} ` : ""}${r.faded.length ? `faded: ${JSON.stringify(r.faded)}` : ""}`);
  }
  await ctx.close();
}
await browser.close();
console.log(problems ? `${problems} page(s) with problems` : "no problems found");
