import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FirebaseError } from "firebase/app";

/**
 * AI 呼び出しの経路選択（SEC-02 / REL-06）。
 *
 * 「ログイン済みなのに未認証経路（/api/ai/*）へ流れ、本番の遮断に当たって
 * 403『ログインが必要です』になる」事故を二度と起こさないためのテスト。
 * 経路の判定は環境変数ではなくログイン状態で決まることを固定する。
 */

const callable = vi.fn();
const currentUser = { value: null as { uid: string } | null };
const configured = { value: true };

vi.mock("firebase/functions", () => ({
  httpsCallable: (_fns: unknown, name: string) => (payload: unknown) =>
    callable(name, payload),
}));

vi.mock("./firebase", () => ({
  isFirebaseConfigured: () => configured.value,
  firebaseAuth: () => ({
    authStateReady: async () => {},
    get currentUser() {
      return currentUser.value;
    },
  }),
  firebaseFunctions: () => ({}),
}));

// 計測は本題ではないので黙らせる
vi.mock("./analytics", () => ({ track: vi.fn() }));

const SUGGEST_PAYLOAD = {
  theme: "夏休み",
  selectedNodeLabel: "自由研究",
  contextNodes: [],
};

async function importClient() {
  return import("./ai-client");
}

function mockFetchOk(body: unknown) {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => body,
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.resetModules();
  callable.mockReset();
  currentUser.value = null;
  configured.value = true;
  delete process.env.NEXT_PUBLIC_AI_BACKEND;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AI 経路の選択", () => {
  it("ログイン済みなら、環境変数が未設定でも Functions を使う", async () => {
    currentUser.value = { uid: "u1" };
    callable.mockResolvedValue({ data: { suggestions: ["案"] } });
    const fetchMock = mockFetchOk({});

    const { aiSuggest } = await importClient();
    await expect(aiSuggest(SUGGEST_PAYLOAD)).resolves.toEqual({
      suggestions: ["案"],
    });

    expect(callable).toHaveBeenCalledWith("aiSuggest", SUGGEST_PAYLOAD);
    // 未認証経路には一切触れない
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("未ログインなら API Routes にフォールバックする", async () => {
    const fetchMock = mockFetchOk({ suggestions: ["案"] });

    const { aiSuggest } = await importClient();
    await aiSuggest(SUGGEST_PAYLOAD);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ai/suggest",
      expect.objectContaining({ method: "POST" }),
    );
    expect(callable).not.toHaveBeenCalled();
  });

  it("NEXT_PUBLIC_AI_BACKEND=routes ならログイン済みでも旧経路を使う", async () => {
    process.env.NEXT_PUBLIC_AI_BACKEND = "routes";
    currentUser.value = { uid: "u1" };
    const fetchMock = mockFetchOk({ suggestions: ["案"] });

    const { aiSuggest } = await importClient();
    await aiSuggest(SUGGEST_PAYLOAD);

    expect(fetchMock).toHaveBeenCalled();
    expect(callable).not.toHaveBeenCalled();
  });

  it("Firebase 未設定なら旧経路を使う", async () => {
    configured.value = false;
    const fetchMock = mockFetchOk({ explanation: "せつめい" });

    const { aiExplain } = await importClient();
    await aiExplain({ label: "自由研究", theme: "夏休み" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ai/explain",
      expect.anything(),
    );
  });
});

describe("Functions のエラー文言", () => {
  it("トークン切れは再ログインを促す", async () => {
    currentUser.value = { uid: "u1" };
    callable.mockRejectedValue(
      new FirebaseError("functions/unauthenticated", "ログインが必要です"),
    );

    const { aiSuggest } = await importClient();
    await expect(aiSuggest(SUGGEST_PAYLOAD)).rejects.toThrow(/再度ログイン/);
  });

  it("メール未確認などはサーバーの文言をそのまま伝える", async () => {
    currentUser.value = { uid: "u1" };
    callable.mockRejectedValue(
      new FirebaseError(
        "functions/permission-denied",
        "メールアドレスの確認が完了していません",
      ),
    );

    const { aiReview } = await importClient();
    await expect(aiReview({ theme: "t", nodes: [] })).rejects.toThrow(
      "メールアドレスの確認が完了していません",
    );
  });

  it("Functions 未デプロイは開発中だけ旧経路に落とす", async () => {
    currentUser.value = { uid: "u1" };
    callable.mockRejectedValue(
      new FirebaseError("functions/not-found", "not found"),
    );
    const fetchMock = mockFetchOk({ suggestions: ["案"] });

    const { aiSuggest } = await importClient();
    await expect(aiSuggest(SUGGEST_PAYLOAD)).resolves.toEqual({
      suggestions: ["案"],
    });
    expect(fetchMock).toHaveBeenCalled();
  });
});
