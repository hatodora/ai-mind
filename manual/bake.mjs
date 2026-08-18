import { chromium } from "@playwright/test";
const OUT = "/Users/matsumotohayato/AIマインドマップ/manual/assets";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 3 });
const p = await ctx.newPage();
await p.goto("file:///Users/matsumotohayato/AI%E3%83%9E%E3%82%A4%E3%83%B3%E3%83%89%E3%83%9E%E3%83%83%E3%83%97/manual/manual.html",
  { waitUntil: "networkidle" });
await p.waitForTimeout(1200);
await p.locator(".callout-wrap").first().screenshot({ path: `${OUT}/editor-callouts.png` });
console.log("✓ editor-callouts");
await b.close();
