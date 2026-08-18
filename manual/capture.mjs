// 取扱説明書用のスクリーンショット取得。印刷に耐えるよう 3x で撮る。
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OUT = "/private/tmp/claude-501/-Users-matsumotohayato-AI-------/290fe67c-34a0-4339-98ae-2a732a119a69/scratchpad/shots";
mkdirSync(OUT, { recursive: true });

const now = Date.now();
const day = 86400000;

function node(id, label, role, x, y) {
  return { id, data: { label, role }, position: { x, y }, type: "mindNode" };
}
function edge(s, t) {
  return { id: `e-${s}-${t}`, source: s, target: t };
}

const demo = {
  id: "demo-tenshoku",
  theme: "転職について考えたい",
  nodes: [
    node("root", "転職について考えたい", "root", 0, 0),
    node("n1", "いまの仕事の不満", "user", -520, 210),
    node("n2", "やりたいこと", "user", -260, 210),
    node("n3", "給料と生活", "user", 0, 210),
    node("n4", "いまの職場の良い所", "user", 260, 210),
    node("n5", "5年後どうなりたい", "user", 520, 210),
    node("n6", "裁量がない", "user", -520, 420),
    node("n8", "人に教えるのが好き", "ai", -260, 420),
    node("n10", "固定費を洗い出す", "ai", 0, 420),
    node("n11", "同僚は信頼できる", "user", 260, 420),
  ],
  edges: [
    edge("root", "n1"), edge("root", "n2"), edge("root", "n3"),
    edge("root", "n4"), edge("root", "n5"),
    edge("n1", "n6"),
    edge("n2", "n8"),
    edge("n3", "n10"),
    edge("n4", "n11"),
  ],
  currentTurn: "user",
  turnCount: 6,
  aiGauge: 6,
  assistLevel: "level2",
  aiRequestCount: 2,
  createdAt: now - 2 * day,
  updatedAt: now - 3600_000,
};

const demo2 = {
  id: "demo-shumi",
  theme: "新しい趣味を探す",
  nodes: [
    node("root", "新しい趣味を探す", "root", 0, 0),
    node("m1", "体を動かすもの", "user", -220, 220),
    node("m2", "家でできること", "user", 0, 220),
    node("m3", "人と会えるもの", "user", 220, 220),
    node("m4", "続けられる値段か", "ai", 0, 440),
  ],
  edges: [edge("root", "m1"), edge("root", "m2"), edge("root", "m3"), edge("m2", "m4")],
  currentTurn: "user",
  turnCount: 3,
  aiGauge: 3,
  assistLevel: "level2",
  aiRequestCount: 1,
  completed: true,
  completedAt: now - 5 * day,
  createdAt: now - 9 * day,
  updatedAt: now - 5 * day,
};

const seed = {
  "mindmap-app:maps": JSON.stringify({ [demo.id]: demo, [demo2.id]: demo2 }),
  // チュートリアルのバーが撮影に割り込まないよう、完走済みにしておく
  "mindmap-app:tutorial": JSON.stringify({
    active: false, done: [], seen: true, clearedAt: now - 6 * day,
  }),
  "mindmap-app:theme": "light",
};

const browser = await chromium.launch();

async function open({ width, height, path: url, scale = 3, wait = 1600 }) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
    locale: "ja-JP",
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  await page.addInitScript((s) => {
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
  }, seed);
  await page.goto("http://localhost:3000" + url, { waitUntil: "networkidle" });
  await page.waitForTimeout(wait);
  return { ctx, page };
}

const fit = async (page) => {
  const b = page.locator('button[title="fit view"]');
  if (await b.count()) { await b.click(); await page.waitForTimeout(1000); }
};

const shot = (t, name) => t.screenshot({ path: `${OUT}/${name}.png` });

// ---------- 1. ホーム（モバイル） ----------
{
  const { ctx, page } = await open({ width: 390, height: 844, path: "/" });
  await shot(page, "home-mobile");
  await shot(page.locator(".card-soft").first(), "crop-ring");
  await ctx.close();
  console.log("✓ home");
}

// ---------- 2. テーマ入力（モバイル） ----------
{
  const { ctx, page } = await open({ width: 390, height: 844, path: "/new" });
  await shot(page, "new-mobile");
  await ctx.close();
  console.log("✓ new");
}

// ---------- 3. エディタ（デスクトップ）＋ 各部の切り抜き ----------
{
  const { ctx, page } = await open({ width: 1440, height: 900, path: "/map/demo-tenshoku" });
  await fit(page);
  await shot(page, "editor-desktop");
  await shot(page.locator(".react-flow").first(), "crop-canvas");

  const cards = page.locator(".card-soft");
  await shot(cards.nth(0), "crop-level");
  await shot(cards.nth(1), "crop-gauge");
  await shot(cards.nth(2), "crop-selected");
  await shot(cards.nth(3), "crop-input");
  await shot(page.getByText("あなたの番"), "crop-turn");

  // ノードの3つの状態
  const nodes = page.locator(".react-flow__node");
  await shot(nodes.nth(0), "crop-node-root");
  await shot(nodes.nth(1), "crop-node-user");
  await shot(page.locator('.react-flow__node:has-text("人に教えるのが好き")'), "crop-node-ai");

  // AI に相談 → 提案パネル
  const ask = page.getByRole("button", { name: "AI にアイデアを聞く" });
  if (await ask.count()) {
    await ask.click();
    try {
      const label = page.getByText("AI の提案 — 採用するものを選ぶ");
      await label.waitFor({ timeout: 30000 });
      await page.waitForTimeout(800);
      await shot(
        label.locator('xpath=ancestor::div[contains(@class,"border-dashed")][1]'),
        "crop-suggest",
      );
      await shot(page, "editor-suggest");
      console.log("✓ AI 提案");
    } catch (e) {
      console.log("! AI 提案は撮れず:", e.message.split("\n")[0]);
    }
  }
  await ctx.close();
  console.log("✓ editor desktop");
}

// ---------- 4. エディタ（モバイル） ----------
{
  const { ctx, page } = await open({ width: 390, height: 844, path: "/map/demo-tenshoku" });
  await fit(page);
  await shot(page, "editor-mobile");
  await ctx.close();
  console.log("✓ editor mobile");
}

await browser.close();
console.log("done ->", OUT);
