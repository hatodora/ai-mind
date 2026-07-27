import { afterEach, describe, expect, it, vi } from "vitest";
import { scrubEvent, sentryEnvironment, tracesSampleRate } from "./observability";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("scrubEvent", () => {
  it("リクエストボディを落とす（マップ本文の流出を防ぐ）", () => {
    const event = {
      request: {
        data: { theme: "転職について考えたい", nodes: ["本音", "年収"] },
      },
    };
    const result = scrubEvent(event);
    expect(result.request?.data).toBeUndefined();
  });

  it("Cookieとクエリ文字列を落とす", () => {
    const event = {
      request: {
        cookies: { session: "secret-token" },
        query_string: "token=secret",
      },
    };
    const result = scrubEvent(event);
    expect(result.request?.cookies).toBeUndefined();
    expect(result.request?.query_string).toBeUndefined();
  });

  it("安全なヘッダだけを残し、認証情報を含むヘッダは落とす", () => {
    const event = {
      request: {
        headers: {
          "user-agent": "Mozilla/5.0",
          referer: "https://example.com/map/1",
          "content-type": "application/json",
          authorization: "Bearer secret",
          cookie: "session=secret",
          "x-forwarded-for": "203.0.113.1",
        },
      },
    };
    const result = scrubEvent(event);
    expect(result.request?.headers).toEqual({
      "user-agent": "Mozilla/5.0",
      referer: "https://example.com/map/1",
      "content-type": "application/json",
    });
  });

  it("ヘッダ名の大文字小文字を問わず判定する", () => {
    const event = {
      request: {
        headers: { "User-Agent": "Mozilla/5.0", Authorization: "Bearer x" },
      },
    };
    const result = scrubEvent(event);
    expect(result.request?.headers).toEqual({ "User-Agent": "Mozilla/5.0" });
  });

  it("メールアドレスとIPアドレスを落とし、uidは残す", () => {
    const event = {
      user: {
        id: "uid-123",
        email: "user@example.com",
        ip_address: "203.0.113.1",
      },
    };
    const result = scrubEvent(event);
    expect(result.user?.id).toBe("uid-123");
    expect(result.user?.email).toBeUndefined();
    expect(result.user?.ip_address).toBeUndefined();
  });

  it("パンくずに載ったリクエストボディも落とす", () => {
    const event = {
      breadcrumbs: [
        { data: { url: "/api/ai/suggest", body: "利用者の思考内容" } },
        { data: { input: ["秘密"] } },
      ],
    };
    const result = scrubEvent(event);
    expect(result.breadcrumbs?.[0].data?.body).toBeUndefined();
    expect(result.breadcrumbs?.[0].data?.url).toBe("/api/ai/suggest");
    expect(result.breadcrumbs?.[1].data?.input).toBeUndefined();
  });

  it("該当フィールドが無いイベントでも壊れない", () => {
    expect(() => scrubEvent({})).not.toThrow();
    expect(scrubEvent({})).toEqual({});
  });
});

describe("sentryEnvironment", () => {
  it("明示指定が最優先される", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_ENVIRONMENT", "staging");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(sentryEnvironment()).toBe("staging");
  });

  it("Vercelの環境変数を拾う", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_ENVIRONMENT", "");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(sentryEnvironment()).toBe("preview");
  });
});

describe("tracesSampleRate", () => {
  it("環境変数の指定値を使う", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE", "0.5");
    expect(tracesSampleRate()).toBe(0.5);
  });

  it("0〜1の範囲外は無視して既定に落とす", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE", "5");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_ENVIRONMENT", "development");
    expect(tracesSampleRate()).toBe(0);
  });

  it("本番の既定は無料枠を守るため低めに保つ", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE", "");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_ENVIRONMENT", "production");
    expect(tracesSampleRate()).toBe(0.1);
  });
});
