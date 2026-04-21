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

  /* Auto-start SvelteKit dev server on a dedicated E2E port (5174) so tests
   * can run in parallel with a manual dev-server on the default port (5173).
   * @see docs/how-to/HOW-TO-CLOUDFLARE-TURNSTILE.md — E2E section
   *
   * Env-vars are set INLINE in the shell command (not via webServer.env) because
   * `pnpm exec` strips/rewrites parts of the inherited env in Playwright's shell
   * context and the override silently fails to reach `vite dev`. Inline Bash-style
   * assignments have guaranteed precedence over .env files (verified manually).
   *
   * Cloudflare official test keys — always pass siteverify, work in headless.
   * @see https://developers.cloudflare.com/turnstile/troubleshooting/testing/ */
  webServer: {
    command:
      'cd frontend && PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA pnpm exec vite dev --port 5174 --strictPort',
    // Health-check stays on plain `localhost` — the Vite server listens on all
    // `*.localhost` via `allowedHosts: ['.localhost']` (Session 12c), but the
    // loopback readiness probe doesn't need a routed subdomain.
    url: 'http://localhost:5174',
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'pipe',
  },

  /* Shared settings for all projects
   *
   * baseURL uses `apitest.localhost:5174` instead of plain `localhost:5174`
   * so that `auth.setup.ts` and every subsequent E2E test operates on the
   * tenant's own origin — `locals.hostSlug === user.subdomain ('apitest')` →
   * the Session 12c apex-handoff branch short-circuits → cookies land on
   * the subdomain → `window.location.href = '/root-dashboard'` stays on the
   * same origin → `waitForURL('**\/root-dashboard')` matches without a
   * cross-origin detour through `/signup/oauth-complete?token=...`.
   *
   * Prerequisite: `/etc/hosts` contains `127.0.0.1 apitest.localhost`.
   * On dev machines: one-time `echo "127.0.0.1 apitest.localhost" | sudo tee -a /etc/hosts`.
   * On CI (future): dedicated setup step — tracked as follow-up.
   *
   * @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md §"Local Dev"
   * @see docs/how-to/HOW-TO-LOCAL-SUBDOMAINS.md
   */
  use: {
    baseURL: 'http://apitest.localhost:5174',
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
