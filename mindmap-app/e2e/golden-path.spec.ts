import { expect, test } from "@playwright/test";

/**
 * 未ログインでも通る主要フロー（REL-07）。
 * ログイン必須の範囲（Firestore同期・共有・コミュニティ等）は
 * Firebaseエミュレータが必要なため対象外。まずは「入口が壊れていない」
 * ことを機械的に保証する。
 */

test("ホーム画面が表示される", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /考えよう/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "新しいマップを作る" }),
  ).toBeVisible();
});

test("テーマを入力してマップを作成すると、ルートノードが表示される", async ({
  page,
}) => {
  const theme = `E2Eテスト-${Date.now()}`;

  await page.goto("/");
  await page.getByRole("link", { name: "新しいマップを作る" }).click();
  await expect(page).toHaveURL(/\/new$/);

  await page.getByPlaceholder("例: 転職について考えたい").fill(theme);
  await page.getByRole("button", { name: "マインドマップを始める" }).click();

  await expect(page).toHaveURL(/\/map\/.+/);
  // ルートノード（React Flow のノード要素）にテーマが表示されることを確認する
  await expect(
    page.locator('[data-testid^="rf__node-"]').getByText(theme),
  ).toBeVisible();
});

test("テーマ未入力では作成ボタンが無効化される", async ({ page }) => {
  await page.goto("/new");
  const submit = page.getByRole("button", { name: "マインドマップを始める" });
  await expect(submit).toBeDisabled();
});

test("フッターから利用規約・プライバシーポリシーに遷移できる（ログイン不要）", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByRole("link", { name: "利用規約" }).click();
  await expect(page).toHaveURL(/\/terms$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await page.goto("/");
  await page.getByRole("link", { name: "プライバシー" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
});

test("未ログインでお問い合わせを開くとログインへ誘導される", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "お問い合わせ" }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Fcontact/);
});

test("存在しないマップIDでは「見つかりません」を表示する", async ({
  page,
}) => {
  await page.goto("/map/does-not-exist-12345");
  await expect(page.getByText("マップが見つかりません")).toBeVisible();
});

/**
 * チュートリアルとキャラクター（TUT-02 / CHR-02）。
 * 初回訪問の入口なので、自動で始まってミッションが進むところまでを見る。
 */

test("初回訪問ではチュートリアルが自動で始まり、操作すると進む", async ({
  page,
}) => {
  await page.goto("/");
  // 自動開始は 0.6 秒後。バーが出て、最初のミッションを案内している
  const bar = page.getByRole("status").filter({ hasText: "Tutorial" });
  await expect(bar).toBeVisible();
  await expect(bar).toContainText("新しいマップを作る");
  await expect(bar).toContainText("0/6");

  // 「新しいマップを作成する」を達成する
  await page.getByRole("link", { name: "新しいマップを作る" }).click();
  await expect(bar).toContainText("1/6");

  // 「自分でテーマを決める」を達成する
  await page
    .getByPlaceholder("例: 転職について考えたい")
    .fill(`E2Eチュートリアル-${Date.now()}`);
  await page.getByRole("button", { name: "マインドマップを始める" }).click();
  await expect(page).toHaveURL(/\/map\/.+/);
  await expect(bar).toContainText("2/6");
});

test("チュートリアルは「やめる」で閉じられる", async ({ page }) => {
  await page.goto("/");
  const bar = page.getByRole("status").filter({ hasText: "Tutorial" });
  await expect(bar).toBeVisible();
  await page.getByRole("button", { name: "やめる" }).click();
  await expect(bar).toBeHidden();

  // 一度やめたら、次に開いても勝手には始まらない
  await page.reload();
  await expect(page.getByRole("heading", { name: /考えよう/ })).toBeVisible();
  await expect(bar).toBeHidden();
});

test("キャラクターは常駐し、さわると手を振る", async ({ page }) => {
  await page.goto("/");
  const mascot = page.getByRole("button", { name: "キャラクターにさわる" });
  await expect(mascot).toBeVisible();

  await mascot.click();
  await expect(
    mascot.getByRole("img", { name: "手を振っているキャラクター" }),
  ).toBeVisible();
});

/**
 * ダーク／ライトの切り替え（THM）。
 * 見た目そのものではなく「選択が効いて、次に開いても保たれる」ことを見る。
 */

test("テーマを切り替えると、再読み込みしても保たれる", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");

  // 既定は端末に合わせる。Playwright の既定はライト
  await expect(html).toHaveAttribute("data-theme", "light");

  await page.getByRole("radio", { name: "ダーク" }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");

  // 再読み込み。<head> のスクリプトが描画前に当て直す
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("radio", { name: "ダーク" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
});

test("端末に合わせるを選ぶと、OS の設定に従う", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "dark");

  // 明示的に選んだライトは、OS がダークでも勝つ
  await page.getByRole("radio", { name: "ライト" }).click();
  await expect(html).toHaveAttribute("data-theme", "light");

  // 端末に合わせるへ戻すと、また OS 側が効く
  await page.getByRole("radio", { name: "端末に合わせる" }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");
});

test("開いたまま OS の設定が変わっても追従する", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  // 「端末に合わせる」のままなので、OS が変われば画面も変わってほしい
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

/**
 * 読み込み中の骨組み（SKL）。
 * 出ている «瞬間» は目視で確かめる。ここで守りたいのは、
 * 読み込みが終わったのに骨組みが残り続けないことのほう。
 */

test("読み込みが終わると骨組みは消え、中身に置き換わる", async ({ page }) => {
  await page.goto("/");

  // 中身が出そろったら、待ちを示す印はどこにも残っていてはいけない
  await expect(
    page.getByRole("heading", { name: /考えよう/ }),
  ).toBeVisible();
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
});

test("マップ一覧が来る前に「まだマップがありません」と言い切らない", async ({
  page,
}) => {
  // 一覧を取り終えるまで空だと決めつけると、
  // 毎回«無い»と言ってから中身が出る、という見え方になる
  await page.goto("/");
  await page.getByRole("link", { name: "新しいマップを作る" }).click();
  await page
    .getByPlaceholder("例: 転職について考えたい")
    .fill(`E2E骨組み-${Date.now()}`);
  await page.getByRole("button", { name: "マインドマップを始める" }).click();
  await expect(page).toHaveURL(/\/map\/.+/);

  await page.goto("/");
  await expect(page.getByText("まだマップがありません")).toHaveCount(0);
});
