/// <reference types="node" />
import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Configuration — Tier 3 in the Assixx Test Pyramid
 *
 * Tier 1:  Unit Tests (Vitest, 6477 tests, no Docker)
 * Tier 1a: Permission Tests (Vitest, 430 tests, security-critical)
 * Tier 1b: Frontend Unit Tests (Vitest, 399 tests)
 * Tier 2:  API Integration Tests (Vitest + fetch, 753 tests, Docker required)
 * Tier 3:  E2E Browser Tests (Playwright, this config, Docker + Dev Server required)
 *
 * Prerequisites: Docker containers must be running (backend, postgres, redis).
 * The SvelteKit dev server is auto-started via webServer config below.
 *
 * @see https://svelte.dev/docs/cli/playwright
 * @see https://svelte.dev/docs/svelte/testing
 * @see docs/infrastructure/adr/ADR-018-testing-strategy.md
 */
export default defineConfig({
  globalSetup: './e2e/global-setup.ts',
  testDir: './e2e',
  outputDir: './e2e/test-results',

  /* Fail CI on test.only */
  forbidOnly: Boolean(process.env['CI']),

  /* Retry on CI only */
  retries: process.env['CI'] !== undefined ? 2 : 0,

  /* Sequential — E2E tests share browser state via storageState */
  workers: 1,

  /* Reporter */
  reporter: process.env['CI'] !== undefined ? 'html' : 'list',

  /* Auto-start SvelteKit dev server (Svelte best practice) */
  webServer: {
    command: 'pnpm run dev:svelte',
    url: 'http://localhost:5173',
    reuseExistingServer: process.env['CI'] === undefined,
    stdout: 'ignore',
    stderr: 'pipe',
    /* Disable Turnstile in E2E — the widget can't solve in headless browsers */
    env: {
      PUBLIC_TURNSTILE_SITE_KEY: '',
    },
  },

  /* Shared settings for all projects */
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  /* Setup project: authenticates and saves storageState */
  projects: [
    {
      name: 'auth-setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
      dependencies: ['auth-setup'],
    },
  ],
});
