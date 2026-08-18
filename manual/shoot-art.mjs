// 線画とキャラクターを、Word 版で使える透過 PNG に焼く。
import { chromium } from "@playwright/test";

const SP = "/private/tmp/claude-501/-Users-matsumotohayato-AI-------/290fe67c-34a0-4339-98ae-2a732a119a69/scratchpad";
const OUT = "/Users/matsumotohayato/AIマインドマップ/manual/assets";

const IDS = [
  "ico-phone", "ico-browser", "ico-wifi", "ico-clock", "ico-mail", "ico-none",
  "ico-check", "ico-cross", "vignette",
  "m-wave", "m-sit", "m-read", "m-work", "m-sleep", "m-annoyed", "m-meditate",
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ deviceScaleFactor: 4 });
const page = await ctx.newPage();
await page.goto(`file://${SP}/art.html`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);

for (const id of IDS) {
  await page.locator("#" + id).screenshot({
    path: `${OUT}/${id}.png`,
    omitBackground: true,
  });
  console.log("✓", id);
}

await browser.close();
