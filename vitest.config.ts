/// <reference types="vitest/config" />
import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

// ESM uses import.meta.dirname (Node 20.11+) instead of CommonJS __dirname
const rootDir = import.meta.dirname;

/**
 * Vitest Configuration for Assixx
 *
 * Three projects:
 *   - unit:          backend/src + shared/src (fast, isolated, mocked)
 *   - frontend-unit: frontend/src utils (pure functions, mocked SvelteKit env)
 *   - api:           api-tests/vitest (real HTTP against Docker backend)
 *
 * Vitest 4: uses `projects` array (vitest.workspace.ts is deprecated since v3.2)
 *
 * @see https://vitest.dev/guide/workspace
 * @see docs/VITEST-UNIT-TEST-PLAN.md
 */
export default defineConfig({
  test: {
    // Vitest UI server port (avoid conflict with dev server on 5173)
    api: {
      port: 5175,
    },

    // Coverage configuration (unit tests only via include patterns)
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: ['backend/src/**/*.ts', 'shared/src/**/*.ts'],
      exclude: [
        'backend/src/**/*.test.ts',
        'backend/src/**/*.spec.ts',
        'shared/src/**/*.test.ts',
        'shared/src/**/*.spec.ts',
        'backend/src/**/*.module.ts', // NestJS Module definitions (DI wiring only)
        'backend/src/**/*.controller.ts', // Controllers = HTTP layer (integration tests)
        'backend/src/**/main.ts', // NestJS bootstrap
        'backend/src/**/index.ts', // Barrel exports
        'backend/src/types/**', // Pure type definitions
      ],
    },

    reporters: ['default'],
    watch: false,
    root: rootDir,

    // ── Project definitions ──────────────────────────────────────────────────
    projects: [
      // ── Unit Tests: backend/src + shared/src ──────────────────────────────
      {
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
        test: {
          name: 'unit',
          environment: 'node',
          globals: true,
          include: [
            'backend/src/**/*.{test,spec}.ts',
            'shared/src/**/*.{test,spec}.ts',
          ],
          exclude: [
            '**/node_modules/**',
            '**/dist/**',
            '**/coverage/**',
            'frontend/**',
          ],
          testTimeout: 10_000,
          setupFiles: ['./vitest.setup.ts'],
          // Unique groupOrder required when projects have different maxWorkers
          sequence: { groupOrder: 1 },
        },
      },

      // ── Frontend Unit Tests: pure utility functions ─────────────────────
      {
        resolve: {
          alias: {
            '$app/environment': resolve(
              rootDir,
              './vitest.mocks/app-environment.ts',
            ),
            $lib: resolve(rootDir, './frontend/src/lib'),
          },
        },
        test: {
          name: 'frontend-unit',
          environment: 'node',
          globals: true,
          include: ['frontend/src/**/*.{test,spec}.ts'],
          exclude: ['**/node_modules/**', '**/dist/**'],
          testTimeout: 10_000,
          setupFiles: ['./vitest.frontend-setup.ts'],
          sequence: { groupOrder: 3 },
        },
      },

      // ── API Integration Tests: real HTTP against Docker ───────────────────
      {
        test: {
          name: 'api',
          environment: 'node',
          globals: true,
          include: ['api-tests/vitest/**/*.api.test.ts'],
          testTimeout: 30_000,
          hookTimeout: 30_000,
          // Sequential execution: tests depend on shared state (auth tokens, resource IDs)
          pool: 'forks',
          maxWorkers: 1,
          isolate: false,
          // Unique groupOrder required when projects have different maxWorkers
          sequence: { groupOrder: 2 },
        },
      },
    ],
  },
});
