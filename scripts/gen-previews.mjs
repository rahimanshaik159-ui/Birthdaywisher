// Renders res/template-previews/template-NN.jpg for all 50 templates by running the real engine in "thumb" mode.
// Usage: npm i -D playwright && npx playwright install chromium && node scripts/gen-previews.mjs [templateNumber ...]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { serve } from "./static-server.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const only = process.argv.slice(2).map(Number);
const { srv, url } = await serve(root);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 0.625 });
fs.mkdirSync(path.join(root, "res/template-previews"), { recursive: true });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
for (let n = 1; n <= 50; n++) {
  if (only.length && !only.includes(n)) continue;
  const id = "template-" + String(n).padStart(2, "0");
  await page.goto(`${url}/scripts/harness.html?t=${String(n).padStart(2, "0")}&mode=thumb&s=welcome`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(root, "res/template-previews", id + ".jpg"), type: "jpeg", quality: 84 });
  process.stdout.write(id + " ");
}
console.log("\nerrors:", errs);
await browser.close(); srv.close();
