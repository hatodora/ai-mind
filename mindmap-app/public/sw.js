/**
 * Service Worker（OFL-02）。
 *
 * 受け持つのは «アプリの殻»（HTML / JS / CSS / フォント）だけ。
 * マップやプロフィールのデータは Firestore の persistentLocalCache が
 * IndexedDB で面倒を見ているので、ここでは一切触らない（OFL-01）。
 * 両方でキャッシュすると、どちらが正しいのか分からなくなる。
 *
 * 方針:
 *   - 画面の移動  … ネットを先に試し、駄目なら控えを出す
 *     （キャッシュ優先にすると、デプロイ後も古い画面が出続ける）
 *   - /_next/static … 中身が変わればURLも変わるので、控え優先でよい
 *   - それ以外    … 素通し。特に Firestore / Functions / 認証には触らない
 *
 * バージョンを上げると古い控えは捨てられる。
 * 壊れた版を配ってしまったときは、ここを上げれば全端末で入れ替わる。
 */

const VERSION = "v1";
const SHELL_CACHE = `mindmap-shell-${VERSION}`;
const ASSET_CACHE = `mindmap-asset-${VERSION}`;

/** 通信できないときに見せる控え。無ければブラウザ既定のエラー画面になる */
const FALLBACK_URL = "/";

self.addEventListener("install", (event) => {
  // 新しい版をすぐ使い始める。待たせると、直したはずの不具合が
  // タブを閉じるまで直らない
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.add(FALLBACK_URL)).catch(() => {
      // 初回インストール時にオフラインだと失敗する。致命的ではない
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("mindmap-") && !k.endsWith(VERSION))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

/** 触ってよいのは自分のドメインの GET だけ */
function isOurs(request) {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  return url.origin === self.location.origin;
}

/** 中身が変わればURLも変わる資産。控え優先でよい */
function isImmutableAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/fonts/")
  );
}

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(request);
    // 成功した分だけ控えておく。エラー画面を控えても意味がない
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch (e) {
    const hit = (await cache.match(request)) ?? (await cache.match(FALLBACK_URL));
    if (hit) return hit;
    throw e;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (!isOurs(request)) return;

  const url = new URL(request.url);

  // 画面の移動。オフラインでも «アプリが立ち上がる» ようにする
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isImmutableAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // それ以外は素通し。RSC のペイロードや API を控えると、
  // 古い内容が混ざって原因の分からない不具合になる
});
