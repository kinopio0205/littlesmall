import { defineConfig } from 'vitest/config';

// 測試會連到本機 Firestore Emulator（由 `npm test` 透過 firebase emulators:exec 啟動），不碰正式資料。
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 90000,
    hookTimeout: 60000,
  },
});
