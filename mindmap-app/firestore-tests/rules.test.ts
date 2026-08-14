/**
 * Firestore セキュリティルール（firestore.rules）のユニットテスト（REL-07）。
 *
 * Firestore エミュレータが必要なため、ローカルでJavaが無い環境では実行できない。
 * CI（REL-08）で `firebase emulators:exec --only firestore "npm run test:rules"`
 * として実行する前提で書いている。
 *
 * ローカルで実行する場合:
 *   npm run test:rules
 * （事前に `firebase emulators:start --only firestore` を別ターミナルで起動しておくか、
 *   firebase-tools を使って emulators:exec でラップすること）
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const PROJECT_ID = "mindmap-rules-test";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(resolve(__dirname, "../firestore.rules"), "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

const now = () => Date.now();

function verifiedCtx(uid: string, extra: Record<string, unknown> = {}) {
  return testEnv.authenticatedContext(uid, {
    email: `${uid}@example.com`,
    email_verified: true,
    ...extra,
  });
}

function unverifiedCtx(uid: string) {
  return testEnv.authenticatedContext(uid, {
    email: `${uid}@example.com`,
    email_verified: false,
  });
}

function adminCtx(uid: string) {
  return testEnv.authenticatedContext(uid, {
    email: `${uid}@example.com`,
    email_verified: true,
    admin: true,
  });
}

function validUserDoc(uid: string, overrides: Record<string, unknown> = {}) {
  return {
    uid,
    email: `${uid}@example.com`,
    displayName: "テストユーザー",
    age: 20,
    role: "user",
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  };
}

// ---------- users/{uid} ----------
describe("users/{uid}", () => {
  it("未認証は読み書きできない", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(db.doc("users/u1").set(validUserDoc("u1")));
    await assertFails(db.doc("users/u1").get());
  });

  it("本人は自分のプロフィールを作成できる", async () => {
    const db = verifiedCtx("u1").firestore();
    await assertSucceeds(db.doc("users/u1").set(validUserDoc("u1")));
  });

  it("他人のプロフィールは作成できない", async () => {
    const db = verifiedCtx("u1").firestore();
    await assertFails(db.doc("users/u2").set(validUserDoc("u2")));
  });

  it("メール未確認ユーザーは書き込めない", async () => {
    const db = unverifiedCtx("u1").firestore();
    await assertFails(db.doc("users/u1").set(validUserDoc("u1")));
  });

  it("authトークンと異なるemailは拒否される", async () => {
    const db = verifiedCtx("u1").firestore();
    await assertFails(
      db.doc("users/u1").set(validUserDoc("u1", { email: "other@example.com" })),
    );
  });

  it("作成時に自分をadminへ昇格できない", async () => {
    const db = verifiedCtx("u1").firestore();
    await assertFails(
      db.doc("users/u1").set(validUserDoc("u1", { role: "admin" })),
    );
  });

  it("更新時にroleを変更できない", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc("users/u1").set(validUserDoc("u1"));
    });
    const db = verifiedCtx("u1").firestore();
    await assertFails(
      db.doc("users/u1").set(validUserDoc("u1", { role: "admin" })),
    );
  });

  it("誕生日は2回までしか自己変更できない", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx
        .firestore()
        .doc("users/u1")
        .set(
          validUserDoc("u1", { birthDate: "2000-01-01", birthDateEdits: 0 }),
        );
    });
    const db = verifiedCtx("u1").firestore();
    // 1回目の変更: 許可
    await assertSucceeds(
      db
        .doc("users/u1")
        .set(
          validUserDoc("u1", { birthDate: "2000-01-02", birthDateEdits: 1 }),
        ),
    );
    // 2回目の変更: 許可
    await assertSucceeds(
      db
        .doc("users/u1")
        .set(
          validUserDoc("u1", { birthDate: "2000-01-03", birthDateEdits: 2 }),
        ),
    );
    // 3回目の変更: 拒否
    await assertFails(
      db
        .doc("users/u1")
        .set(
          validUserDoc("u1", { birthDate: "2000-01-04", birthDateEdits: 3 }),
        ),
    );
  });

  it("既存の誕生日を削除することはできない", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx
        .firestore()
        .doc("users/u1")
        .set(
          validUserDoc("u1", { birthDate: "2000-01-01", birthDateEdits: 0 }),
        );
    });
    const db = verifiedCtx("u1").firestore();
    await assertFails(db.doc("users/u1").set(validUserDoc("u1")));
  });

  it("管理者は他人のプロフィールを読み書きできる", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc("users/u1").set(validUserDoc("u1"));
    });
    const db = adminCtx("admin1").firestore();
    await assertSucceeds(db.doc("users/u1").get());
    await assertSucceeds(
      db.doc("users/u1").set(validUserDoc("u1", { role: "admin" })),
    );
  });

  it("private サブコレクションはクライアントから完全に遮断される", async () => {
    const db = verifiedCtx("u1").firestore();
    await assertFails(db.doc("users/u1/private/usage").get());
    await assertFails(
      db.doc("users/u1/private/usage").set({ hourCount: 1 }),
    );
  });
});

// ---------- maps/{mapId} ----------
describe("maps/{mapId}", () => {
  function validMapDoc(mapId: string, ownerId: string, overrides = {}) {
    return {
      id: mapId,
      theme: "テーマ",
      nodes: [],
      edges: [],
      currentTurn: "user",
      turnCount: 0,
      aiGauge: 0,
      ownerId,
      visibility: "private",
      sharedWith: {},
      createdAt: now(),
      updatedAt: now(),
      ...overrides,
    };
  }

  it("所有者はマップを作成できる", async () => {
    const db = verifiedCtx("u1").firestore();
    await assertSucceeds(db.doc("maps/m1").set(validMapDoc("m1", "u1")));
  });

  it("ownerIdが自分と異なると作成できない", async () => {
    const db = verifiedCtx("u1").firestore();
    await assertFails(db.doc("maps/m1").set(validMapDoc("m1", "u2")));
  });

  it("privateマップは他人から読めない", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc("maps/m1").set(validMapDoc("m1", "u1"));
    });
    const db = verifiedCtx("u2").firestore();
    await assertFails(db.doc("maps/m1").get());
  });

  it("publicマップは他の検証済みユーザーが読める", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx
        .firestore()
        .doc("maps/m1")
        .set(validMapDoc("m1", "u1", { visibility: "public" }));
    });
    const db = verifiedCtx("u2").firestore();
    await assertSucceeds(db.doc("maps/m1").get());
  });

  it("共有editorはノードを編集できるがownerId等は変更できない", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx
        .firestore()
        .doc("maps/m1")
        .set(
          validMapDoc("m1", "u1", {
            visibility: "shared",
            sharedWith: { u2: "editor" },
          }),
        );
    });
    const db = verifiedCtx("u2").firestore();
    await assertSucceeds(
      db.doc("maps/m1").set(
        validMapDoc("m1", "u1", {
          visibility: "shared",
          sharedWith: { u2: "editor" },
          turnCount: 1,
        }),
      ),
    );
    await assertFails(
      db.doc("maps/m1").set(
        validMapDoc("m1", "u2", {
          visibility: "shared",
          sharedWith: { u2: "editor" },
        }),
      ),
    );
  });

  it("共有viewerは編集できない", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx
        .firestore()
        .doc("maps/m1")
        .set(
          validMapDoc("m1", "u1", {
            visibility: "shared",
            sharedWith: { u2: "viewer" },
          }),
        );
    });
    const db = verifiedCtx("u2").firestore();
    await assertFails(
      db.doc("maps/m1").set(
        validMapDoc("m1", "u1", {
          visibility: "shared",
          sharedWith: { u2: "viewer" },
          turnCount: 1,
        }),
      ),
    );
  });

  it("所有者以外は削除できない", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc("maps/m1").set(validMapDoc("m1", "u1"));
    });
    const db = verifiedCtx("u2").firestore();
    await assertFails(db.doc("maps/m1").delete());
  });
});

// ---------- posts / comments ----------
describe("posts/{postId}", () => {
  function validPostDoc(postId: string, authorUid: string, overrides = {}) {
    return {
      id: postId,
      authorUid,
      authorName: null,
      theme: "テーマ",
      rootLabel: "ルート",
      nodes: [{ label: "ルート", role: "root" }],
      edges: [],
      commentCount: 0,
      createdAt: now(),
      ...overrides,
    };
  }

  async function seedProfile(uid: string, age: number) {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`users/${uid}`).set(validUserDoc(uid, { age }));
    });
  }

  it("15歳以上は投稿できる", async () => {
    await seedProfile("u1", 20);
    const db = verifiedCtx("u1").firestore();
    await assertSucceeds(db.doc("posts/p1").set(validPostDoc("p1", "u1")));
  });

  it("15歳未満は投稿できない", async () => {
    await seedProfile("u1", 12);
    const db = verifiedCtx("u1").firestore();
    await assertFails(db.doc("posts/p1").set(validPostDoc("p1", "u1")));
  });

  it("authorNameは自分の表示名か匿名(null)のみ許可される", async () => {
    await seedProfile("u1", 20);
    const db = verifiedCtx("u1").firestore();
    await assertFails(
      db
        .doc("posts/p1")
        .set(validPostDoc("p1", "u1", { authorName: "なりすまし" })),
    );
  });

  it("投稿本体の更新はcommentCountの±1以外を拒否する", async () => {
    await seedProfile("u1", 20);
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc("posts/p1").set(validPostDoc("p1", "u1"));
    });
    const db = verifiedCtx("u1").firestore();
    await assertSucceeds(
      db.doc("posts/p1").set(
        { ...validPostDoc("p1", "u1"), commentCount: 1 },
        { merge: true },
      ),
    );
    await assertFails(
      db.doc("posts/p1").set(
        { ...validPostDoc("p1", "u1"), theme: "書き換え" },
        { merge: true },
      ),
    );
  });

  it("投稿者本人は削除できるが他人はできない", async () => {
    await seedProfile("u1", 20);
    await seedProfile("u2", 20);
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc("posts/p1").set(validPostDoc("p1", "u1"));
    });
    const other = verifiedCtx("u2").firestore();
    await assertFails(other.doc("posts/p1").delete());
    const owner = verifiedCtx("u1").firestore();
    await assertSucceeds(owner.doc("posts/p1").delete());
  });

  it("コメントは匿名でも本人IDは偽装できない", async () => {
    await seedProfile("u1", 20);
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc("posts/p1").set(validPostDoc("p1", "u1"));
    });
    const db = verifiedCtx("u1").firestore();
    await assertFails(
      db.doc("posts/p1/comments/c1").set({
        id: "c1",
        authorUid: "someone-else",
        authorName: null,
        text: "コメント",
        createdAt: now(),
      }),
    );
  });

  it("コメントは編集できない（管理者以外）", async () => {
    await seedProfile("u1", 20);
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc("posts/p1").set(validPostDoc("p1", "u1"));
      await ctx.firestore().doc("posts/p1/comments/c1").set({
        id: "c1",
        authorUid: "u1",
        authorName: null,
        text: "元のコメント",
        createdAt: now(),
      });
    });
    const db = verifiedCtx("u1").firestore();
    await assertFails(
      db.doc("posts/p1/comments/c1").set(
        { text: "改ざん" },
        { merge: true },
      ),
    );
  });

  it("投稿の作者は他人のコメントも削除できる（連鎖削除対応）", async () => {
    await seedProfile("u1", 20);
    await seedProfile("u2", 20);
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc("posts/p1").set(validPostDoc("p1", "u1"));
      await ctx.firestore().doc("posts/p1/comments/c1").set({
        id: "c1",
        authorUid: "u2",
        authorName: null,
        text: "他人のコメント",
        createdAt: now(),
      });
    });
    const db = verifiedCtx("u1").firestore();
    await assertSucceeds(db.doc("posts/p1/comments/c1").delete());
  });
});

// ---------- inquiries ----------
describe("inquiries/{id}", () => {
  function validInquiry(id: string, uid: string, overrides = {}) {
    return {
      id,
      category: "bug",
      email: `${uid}@example.com`,
      message: "問い合わせ内容",
      submittedByUid: uid,
      status: "new",
      createdAt: now(),
      updatedAt: now(),
      ...overrides,
    };
  }

  it("メール未確認でもログインしていれば送信できる", async () => {
    const db = unverifiedCtx("u1").firestore();
    await assertSucceeds(db.doc("inquiries/i1").set(validInquiry("i1", "u1")));
  });

  it("他人になりすまして送信できない", async () => {
    const db = verifiedCtx("u1").firestore();
    await assertFails(
      db.doc("inquiries/i1").set(validInquiry("i1", "u2")),
    );
  });

  it("一般ユーザーは自分の問い合わせも読めない（管理者専用）", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc("inquiries/i1").set(validInquiry("i1", "u1"));
    });
    const db = verifiedCtx("u1").firestore();
    await assertFails(db.doc("inquiries/i1").get());
  });

  it("管理者は問い合わせを読める", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc("inquiries/i1").set(validInquiry("i1", "u1"));
    });
    const db = adminCtx("admin1").firestore();
    await assertSucceeds(db.doc("inquiries/i1").get());
  });
});

// ---------- 完全遮断コレクション ----------
describe("Cloud Functions専用コレクション（invites / aiCache / system）", () => {
  it("invitesはクライアントから読み書きできない", async () => {
    const db = verifiedCtx("u1").firestore();
    await assertFails(db.doc("invites/token1").get());
    await assertFails(db.doc("invites/token1").set({ mapId: "m1" }));
  });

  it("aiCacheはクライアントから読み書きできない", async () => {
    const db = verifiedCtx("u1").firestore();
    await assertFails(db.doc("aiCache/key1").get());
    await assertFails(db.doc("aiCache/key1").set({ text: "x" }));
  });

  it("systemはクライアントから読み書きできない（管理者も含む・REL-06）", async () => {
    const userDb = verifiedCtx("u1").firestore();
    await assertFails(userDb.doc("system/aiUsage").get());
    await assertFails(userDb.doc("system/aiUsage").set({ dayCount: 1 }));

    const adminDb = adminCtx("admin1").firestore();
    await assertFails(adminDb.doc("system/aiUsage").get());
  });
});

/**
 * 2要素認証（MFA-01）。
 *
 * 画面で隠すだけでは意味がない（IDトークンを直接使えば Firestore を叩ける）ので、
 * ここで «ルールが実際に止めているか» を確かめる。
 */
describe("2要素認証", () => {
  /** 2要素認証を有効にしていて、最後に通したのが sinceMs 前のトークン */
  function mfaCtx(uid: string, sinceMs: number | null) {
    return verifiedCtx(uid, {
      mfaRequired: true,
      ...(sinceMs === null ? {} : { mfa: now() - sinceMs }),
    });
  }

  const DAY = 24 * 60 * 60 * 1000;

  it("有効にしていない人には何も課さない", async () => {
    // 希望者のみの機能。使っていない大多数の邪魔をしてはいけない
    const ctx = verifiedCtx("plain");
    await assertSucceeds(
      ctx.firestore().doc("users/plain").set(validUserDoc("plain")),
    );
  });

  it("有効にしていて、まだ一度も通していなければ拒否する", async () => {
    const ctx = mfaCtx("mfa1", null);
    await assertFails(
      ctx.firestore().doc("users/mfa1").set(validUserDoc("mfa1")),
    );
  });

  it("直近に通していれば通常どおり操作できる", async () => {
    const ctx = mfaCtx("mfa2", 60 * 1000);
    await assertSucceeds(
      ctx.firestore().doc("users/mfa2").set(validUserDoc("mfa2")),
    );
  });

  it("30日を過ぎた検証では拒否する", async () => {
    const ctx = mfaCtx("mfa3", 31 * DAY);
    await assertFails(
      ctx.firestore().doc("users/mfa3").set(validUserDoc("mfa3")),
    );
  });

  it("29日前の検証はまだ通る", async () => {
    const ctx = mfaCtx("mfa4", 29 * DAY);
    await assertSucceeds(
      ctx.firestore().doc("users/mfa4").set(validUserDoc("mfa4")),
    );
  });

  it("マップの読み書きも止まる（プロフィールだけの話ではない）", async () => {
    // マップの中身こそ守りたいもの。ここが素通りしては意味がない
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc("maps/m1").set({
        id: "m1",
        ownerId: "mfa5",
        theme: "テーマ",
        nodes: [],
        edges: [],
        createdAt: now(),
        updatedAt: now(),
        visibility: "private",
        sharedWith: {},
      });
    });
    const stale = mfaCtx("mfa5", 31 * DAY);
    await assertFails(stale.firestore().doc("maps/m1").get());
    await assertFails(
      stale.firestore().doc("maps/m1").update({ theme: "書き換え" }),
    );

    const fresh = mfaCtx("mfa5", 60 * 1000);
    await assertSucceeds(fresh.firestore().doc("maps/m1").get());
  });

  it("mfa クレームが数値でなければ通っていない扱いにする", async () => {
    // 型まで保証されるわけではない。文字列で比較が壊れて素通りしないこと
    const ctx = verifiedCtx("mfa6", { mfaRequired: true, mfa: "9999999999999" });
    await assertFails(
      ctx.firestore().doc("users/mfa6").set(validUserDoc("mfa6")),
    );
  });

  it("有効／無効の設定は本人でも書き換えられない", async () => {
    // 書けてしまうと、パスワードを盗んだ相手が自分で無効化して締め出しを解ける
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc("users/mfa7").set(
        validUserDoc("mfa7", { twoFactorEnabled: true, twoFactorEnabledAt: now() }),
      );
    });
    const ctx = mfaCtx("mfa7", 60 * 1000);
    await assertFails(
      ctx.firestore().doc("users/mfa7").update({ twoFactorEnabled: false }),
    );
    // 項目ごと落として消すのも禁止（プロフィール保存は全置換なので起こりうる）
    await assertFails(
      ctx.firestore().doc("users/mfa7").set(validUserDoc("mfa7")),
    );
    // 同じ値をそのまま送り返すのは許す（全置換の保存が通らないと困る）
    await assertSucceeds(
      ctx.firestore().doc("users/mfa7").set(
        validUserDoc("mfa7", {
          twoFactorEnabled: true,
          twoFactorEnabledAt: (
            await ctx.firestore().doc("users/mfa7").get()
          ).data()!.twoFactorEnabledAt,
          displayName: "名前だけ変える",
        }),
      ),
    );
  });

  it("新規作成のときに「有効」を名乗れない", async () => {
    const ctx = verifiedCtx("mfa8");
    await assertFails(
      ctx
        .firestore()
        .doc("users/mfa8")
        .set(validUserDoc("mfa8", { twoFactorEnabled: true })),
    );
  });

  it("コードの置き場はクライアントから一切触れない", async () => {
    const ctx = verifiedCtx("mfa9");
    await assertFails(ctx.firestore().doc("twoFactorChallenges/mfa9").get());
    await assertFails(
      ctx.firestore().doc("twoFactorChallenges/mfa9").set({ codeHash: "x" }),
    );
  });
});
