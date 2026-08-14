import { describe, expect, it } from "vitest";
import {
  MFA_SESSION_MS,
  hasFreshVerification,
  isCompleteCode,
  isTwoFactorEnabled,
  needsTwoFactor,
  normalizeCode,
  resendWaitSeconds,
} from "./two-factor";

const NOW = 1_800_000_000_000;

describe("needsTwoFactor", () => {
  it("有効にしていない人には求めない", () => {
    expect(needsTwoFactor({}, NOW)).toBe(false);
    expect(needsTwoFactor({ mfaRequired: false }, NOW)).toBe(false);
  });

  it("有効にしていて、まだ一度も通していなければ求める", () => {
    expect(needsTwoFactor({ mfaRequired: true }, NOW)).toBe(true);
  });

  it("直近に通していれば求めない", () => {
    expect(
      needsTwoFactor({ mfaRequired: true, mfa: NOW - 1000 }, NOW),
    ).toBe(false);
  });

  it("期限を過ぎていれば、また求める", () => {
    expect(
      needsTwoFactor(
        { mfaRequired: true, mfa: NOW - MFA_SESSION_MS - 1 },
        NOW,
      ),
    ).toBe(true);
  });

  it("期限のちょうど境目では、まだ通っている扱いにする", () => {
    expect(
      needsTwoFactor({ mfaRequired: true, mfa: NOW - MFA_SESSION_MS + 1 }, NOW),
    ).toBe(false);
    expect(
      needsTwoFactor({ mfaRequired: true, mfa: NOW - MFA_SESSION_MS }, NOW),
    ).toBe(true);
  });
});

describe("hasFreshVerification", () => {
  it("数値でないクレームは «通っていない» 扱いにする", () => {
    // クレームは Admin SDK でしか付けられないが、
    // 型まで保証されるわけではない。文字列を通すと期限の比較が壊れる
    for (const bad of ["123", null, undefined, true, {}, NaN, Infinity]) {
      expect(
        hasFreshVerification({ mfa: bad as unknown }, NOW),
      ).toBe(false);
    }
  });

  it("未来の時刻は通さない", () => {
    // 端末の時計がずれている場合などに «無期限に通る» 状態を作らせない
    expect(hasFreshVerification({ mfa: NOW + 60_000 }, NOW)).toBe(false);
  });
});

describe("isTwoFactorEnabled", () => {
  it("true 以外は有効と見なさない", () => {
    expect(isTwoFactorEnabled({ mfaRequired: true })).toBe(true);
    for (const v of ["true", 1, null, undefined, {}]) {
      expect(isTwoFactorEnabled({ mfaRequired: v as unknown })).toBe(false);
    }
  });
});

describe("normalizeCode", () => {
  it("メールから貼り付けた余計な文字を落とす", () => {
    expect(normalizeCode("123 456")).toBe("123456");
    expect(normalizeCode("123-456")).toBe("123456");
    expect(normalizeCode(" 123456\n")).toBe("123456");
  });

  it("桁数を超えた分は切り捨てる", () => {
    expect(normalizeCode("1234567890")).toBe("123456");
  });

  it("数字が無ければ空になる", () => {
    expect(normalizeCode("abc")).toBe("");
  });
});

describe("isCompleteCode", () => {
  it("6桁そろったときだけ送れる", () => {
    expect(isCompleteCode("123456")).toBe(true);
    expect(isCompleteCode("12345")).toBe(false);
    expect(isCompleteCode("1234567")).toBe(false);
    expect(isCompleteCode("")).toBe(false);
    expect(isCompleteCode("12345a")).toBe(false);
  });
});

describe("resendWaitSeconds", () => {
  it("まだ送っていなければ、すぐ送れる", () => {
    expect(resendWaitSeconds(null, NOW)).toBe(0);
  });

  it("送った直後は待たせる", () => {
    expect(resendWaitSeconds(NOW, NOW, 60_000)).toBe(60);
    expect(resendWaitSeconds(NOW - 30_000, NOW, 60_000)).toBe(30);
  });

  it("間隔を過ぎたら送れる", () => {
    expect(resendWaitSeconds(NOW - 60_000, NOW, 60_000)).toBe(0);
    expect(resendWaitSeconds(NOW - 90_000, NOW, 60_000)).toBe(0);
  });

  it("端数は切り上げる（0秒と出たのに送れない、を避ける）", () => {
    expect(resendWaitSeconds(NOW - 59_500, NOW, 60_000)).toBe(1);
  });
});
