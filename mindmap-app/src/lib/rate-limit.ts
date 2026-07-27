/**
 * API Routes（匿名・フォールバック経路）の簡易レートリミット（SEC-04）。
 *
 * Cloud Functions 側は uid ごとに Firestore トランザクションで制限するが、
 * この経路は認証がないため IP 単位・プロセス内メモリで制限する。
 *
 * 既知の限界（PHASE5_SPEC.md にも記載）:
 *  - サーバーレスで複数インスタンスに分散すると窓もインスタンスごとになる
 *    （それでも1クライアントからの連打は大幅に抑えられる）
 *  - X-Forwarded-For は信頼できるプロキシ配下でのみ正確
 * 完全な対策が必要になったら Redis 等の共有ストアに置き換える。
 */

/** 時間窓（1時間）。Functions 側の HOURLY_LIMIT と同じ考え方 */
const WINDOW_MS = 60 * 60 * 1000;
/** 窓あたりの許可回数（IP単位） */
const LIMIT_PER_WINDOW = 30;
/**
 * このプロセス全体で1時間に許可する回数（REL-06）。
 * IP はいくらでも詐称・分散できるため、IP 単位の上限だけでは
 * 「多数の IP から少しずつ」という叩き方を止められない。
 * 1インスタンスあたりの総量に蓋をして、課金の暴走を抑える。
 */
const GLOBAL_LIMIT_PER_WINDOW = Number(
  process.env.AI_PUBLIC_HOURLY_LIMIT ?? 300,
);
/** メモリ肥大化を防ぐための掃除しきい値 */
const CLEANUP_THRESHOLD = 10_000;

const buckets = new Map<string, { start: number; count: number }>();
/** プロセス全体の窓。IP 単位のバケツとは別に数える */
let globalBucket = { start: 0, count: 0 };

/** リクエスト元IPの推定。取れなければ "unknown"（全体で1バケツ共有） */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** このリクエストを許可するか。false なら 429 を返すこと */
export function allowRequest(ip: string): boolean {
  const now = Date.now();
  if (buckets.size > CLEANUP_THRESHOLD) {
    for (const [key, b] of buckets) {
      if (now - b.start >= WINDOW_MS) buckets.delete(key);
    }
  }

  // プロセス全体の上限を先に見る（IP を分散されても総量で止められる）
  if (now - globalBucket.start >= WINDOW_MS) {
    globalBucket = { start: now, count: 0 };
  }
  if (globalBucket.count >= GLOBAL_LIMIT_PER_WINDOW) return false;

  const bucket = buckets.get(ip);
  if (!bucket || now - bucket.start >= WINDOW_MS) {
    buckets.set(ip, { start: now, count: 1 });
    globalBucket.count += 1;
    return true;
  }
  if (bucket.count >= LIMIT_PER_WINDOW) return false;
  bucket.count += 1;
  globalBucket.count += 1;
  return true;
}
