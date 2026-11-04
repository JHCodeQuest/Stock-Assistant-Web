import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
    // All files share one test database and truncate it between tests, so run them one at a time.
    fileParallelism: false,
    testTimeout: 15000,
  },
});
