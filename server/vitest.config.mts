import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    clearMocks:false,
    maxWorkers:2,
    testTimeout:15000,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
