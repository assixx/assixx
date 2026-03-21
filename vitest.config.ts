/// <reference types="vitest/config" />
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// ESM uses import.meta.dirname (Node 20.11+) instead of CommonJS __dirname
const rootDir = import.meta.dirname;

/**
 * Vitest Configuration for Assixx
 *
 * Four projects:
 *   - unit:          backend/src + shared/src (fast, isolated, mocked)
 *   - permission:    security-critical permission/access tests (subset of unit)
 *   - frontend-unit: frontend/src utils (pure functions, mocked SvelteKit env)
 *   - api:           backend/test (real HTTP against Docker backend)
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
    // For faster local runs: pnpm vitest run --coverage --coverage.changed=main
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['backend/src/**/*.ts', 'shared/src/**/*.ts'],
      exclude: [
        // Test files
        'backend/src/**/*.test.ts',
        'backend/src/**/*.spec.ts',
        'shared/src/**/*.test.ts',
        'shared/src/**/*.spec.ts',

        // NestJS infrastructure (DI wiring, HTTP layer)
        'backend/src/**/*.module.ts',
        'backend/src/**/*.controller.ts',
        'backend/src/**/*.guard.ts',
        'backend/src/**/main.ts',
        'backend/src/**/index.ts',

        // Pure type definitions (zero runtime logic)
        'backend/src/types/**',
        'backend/src/**/*.types.ts',
        'shared/src/types/**',

        // Barrel exports
        'shared/src/**/index.ts',

        // Permission constants + DI registrars (declarative, no logic)
        'backend/src/**/*.permissions.ts',
        'backend/src/**/*-permission.registrar.ts',

        // Pure interfaces (no runtime code)
        'backend/src/nest/common/interfaces/**',

        // Decorators (SetMetadata / createParamDecorator wrappers)
        'backend/src/nest/common/decorators/**',

        // Infrastructure (transport/bootstrap, not unit-testable)
        'backend/src/websocket.ts',
        'backend/src/nest/instrument.ts',
        'backend/src/utils/email-service.ts',
        'backend/src/utils/event-bus.ts',
        'backend/src/workers/deletion-worker.ts',
      ],
      thresholds: {
        lines: 83,
        functions: 83,
        branches: 76,
        statements: 83,
      },
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
            '@assixx/shared/constants': resolve(rootDir, './shared/src/constants/index.ts'),
            '@assixx/shared/helpers': resolve(rootDir, './shared/src/helpers/index.ts'),
            '@assixx/shared/types': resolve(rootDir, './shared/src/types/index.ts'),
            '@assixx/shared': resolve(rootDir, './shared/src/index.ts'),
          },
        },
        test: {
          name: 'unit',
          environment: 'node',
          globals: true,
          include: ['backend/src/**/*.{test,spec}.ts', 'shared/src/**/*.{test,spec}.ts'],
          exclude: ['**/node_modules/**', '**/dist/**', '**/coverage/**', 'frontend/**'],
          testTimeout: 10_000,
          setupFiles: ['./vitest.setup.ts'],
          // Unique groupOrder required when projects have different maxWorkers
          sequence: { groupOrder: 1 },
        },
      },

      // ── Permission/Security Tests: CRITICAL access control (subset of unit) ──
      {
        resolve: {
          alias: {
            '@': resolve(rootDir, './backend/src'),
            '@nest': resolve(rootDir, './backend/src/nest'),
            '@schemas': resolve(rootDir, './backend/src/schemas'),
            '@services': resolve(rootDir, './backend/src/services'),
            '@utils': resolve(rootDir, './backend/src/utils'),
            '@shared': resolve(rootDir, './shared/src'),
            '@assixx/shared/constants': resolve(rootDir, './shared/src/constants/index.ts'),
            '@assixx/shared/helpers': resolve(rootDir, './shared/src/helpers/index.ts'),
            '@assixx/shared/types': resolve(rootDir, './shared/src/types/index.ts'),
            '@assixx/shared': resolve(rootDir, './shared/src/index.ts'),
          },
        },
        test: {
          name: { label: 'permission', color: 'red' },
          environment: 'node',
          globals: true,
          include: [
            'backend/src/nest/admin-permissions/**/*.test.ts',
            'backend/src/nest/user-permissions/**/*.test.ts',
            'backend/src/nest/common/guards/permission.guard.test.ts',
            'backend/src/nest/common/guards/roles.guard.test.ts',
            'backend/src/nest/common/guards/jwt-auth.guard.test.ts',
            'backend/src/nest/common/decorators/require-permission.decorator.test.ts',
            'backend/src/nest/common/permission-registry/**/*.test.ts',
            'backend/src/nest/hierarchy-permission/**/*.test.ts',
            'backend/src/nest/calendar/calendar-permission.service.test.ts',
            'backend/src/nest/blackboard/blackboard-access.service.test.ts',
            'backend/src/nest/surveys/survey-access.service.test.ts',
            'backend/src/nest/auth/auth.service.test.ts',
            'backend/src/nest/roles/roles.service.test.ts',
            'backend/src/nest/role-switch/role-switch.service.test.ts',
            'backend/src/nest/documents/document-access.service.test.ts',
          ],
          testTimeout: 10_000,
          setupFiles: ['./vitest.setup.ts'],
          sequence: { groupOrder: 4 },
        },
      },

      // ── Frontend Unit Tests: pure utility functions ─────────────────────
      {
        resolve: {
          alias: {
            '$app/environment': resolve(rootDir, './frontend/test/mocks/app-environment.ts'),
            $lib: resolve(rootDir, './frontend/src/lib'),
            '@assixx/shared/constants': resolve(rootDir, './shared/src/constants/index.ts'),
            '@assixx/shared/helpers': resolve(rootDir, './shared/src/helpers/index.ts'),
            '@assixx/shared/types': resolve(rootDir, './shared/src/types/index.ts'),
            '@assixx/shared': resolve(rootDir, './shared/src/index.ts'),
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
          include: ['backend/test/**/*.api.test.ts'],
          globalSetup: ['backend/test/global-teardown.ts'],
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
