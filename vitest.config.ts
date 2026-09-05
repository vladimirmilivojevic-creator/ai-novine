import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/src/**/*.test.ts', 'apps/pipeline/src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'apps/web/**'],
  },
});
