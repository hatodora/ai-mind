import { defineConfig } from "vitest/config";

// Firestore rules のテスト専用設定（REL-07）。
// エミュレータ起動が前提のため、通常の `npm test`（vitest.config.ts）とは分離する。
export default defineConfig({
  test: {
    environment: "node",
    include: ["firestore-tests/**/*.test.ts"],
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
