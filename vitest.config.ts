/// <reference types="vitest/config" />
import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

// ESM uses import.meta.dirname (Node 20.11+) instead of CommonJS __dirname
const rootDir = import.meta.dirname;

/**
 * Vitest Configuration for Assixx Backend
 *
 * @see https://vitest.dev/config/
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
    include: ['backend/src/**/*.{test,spec}.ts'],

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
      include: ['backend/src/**/*.ts'],
      exclude: [
        'backend/src/**/*.test.ts',
        'backend/src/**/*.spec.ts',
        'backend/src/types/**',
        'backend/src/nest/**', // NestJS has own test system
      ],
    },

    // Timeout for async tests (ms)
    testTimeout: 10000,

    // Setup files run before each test file
    setupFiles: ['./vitest.setup.ts'],

    // Reporter configuration
    reporters: ['default'],

    // Watch mode configuration
    watch: false,

    // Root directory
    root: '.',
  },

  resolve: {
    alias: {
      '@': resolve(rootDir, './backend/src'),
      '@controllers': resolve(rootDir, './backend/src/controllers'),
      '@models': resolve(rootDir, './backend/src/models'),
      '@middleware': resolve(rootDir, './backend/src/middleware'),
      '@services': resolve(rootDir, './backend/src/services'),
      '@utils': resolve(rootDir, './backend/src/utils'),
      '@types': resolve(rootDir, './backend/src/types'),
    },
  },
});
