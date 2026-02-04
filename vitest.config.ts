/// <reference types="vitest/config" />
import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

// ESM uses import.meta.dirname (Node 20.11+) instead of CommonJS __dirname
const rootDir = import.meta.dirname;

/**
 * Vitest Configuration for Assixx
 *
 * Scope: backend/src + shared/src (unit tests)
 * Frontend: separate config in frontend/vitest.config.ts (Phase 7)
 *
 * @see https://vitest.dev/config/
 * @see docs/VITEST-UNIT-TEST-PLAN.md
 */
export default defineConfig({
  test: {
    // API port for Vitest UI (avoid conflict with dev server on 5173)
    api: {
      port: 5175,
    },

    // Test environment for Node.js backend
    environment: 'node',

    // Enable global test APIs (describe, it, expect, etc.)
    globals: true,

    // Include patterns for test files
    include: [
      'backend/src/**/*.{test,spec}.ts',
      'shared/src/**/*.{test,spec}.ts',
    ],

    // Exclude patterns
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'frontend/**',
    ],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: [
        'backend/src/**/*.ts',
        'shared/src/**/*.ts',
      ],
      exclude: [
        'backend/src/**/*.test.ts',
        'backend/src/**/*.spec.ts',
        'shared/src/**/*.test.ts',
        'shared/src/**/*.spec.ts',
        'backend/src/**/*.module.ts',     // NestJS Module definitions (DI wiring only)
        'backend/src/**/*.controller.ts', // Controllers = HTTP layer (integration tests)
        'backend/src/**/main.ts',         // NestJS bootstrap
        'backend/src/**/index.ts',        // Barrel exports
        'backend/src/types/**',           // Pure type definitions
      ],
    },

    // Timeout for async tests (ms)
    testTimeout: 10_000,

    // Setup files run before each test file
    setupFiles: ['./vitest.setup.ts'],

    // Reporter configuration
    reporters: ['default'],

    // Watch mode configuration
    watch: false,

    // Root directory (absolute path to avoid ERR_INVALID_FILE_URL_HOST bug)
    // @see https://github.com/vitest-dev/vitest/issues/8579
    root: rootDir,
  },

  resolve: {
    alias: {
      '@': resolve(rootDir, './backend/src'),
      '@nest': resolve(rootDir, './backend/src/nest'),
      '@schemas': resolve(rootDir, './backend/src/schemas'),
      '@services': resolve(rootDir, './backend/src/services'),
      '@utils': resolve(rootDir, './backend/src/utils'),
      '@shared': resolve(rootDir, './shared/src'),
    },
  },
});
