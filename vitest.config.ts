import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'tests/buildTransaction.test.ts', 'test/**/*'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['tools/**/*.ts', 'lib/**/*.ts', 'utils/**/*.ts'],
      exclude: [
        'node_modules',
        'dist',
        '**/*.d.ts',
        '**/*.config.ts',
        'tests',
      ],
    },
  },
});
