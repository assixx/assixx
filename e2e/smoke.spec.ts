import { expect, test } from '@playwright/test';

test.describe('Smoke: Dashboard', () => {
  test('shows root dashboard with stats', async ({ page }) => {
    await page.goto('/root-dashboard');

    /*
     * Scope to #dashboard-data instead of <main>: the word "Mitarbeiter"
     * also appears as a role badge in #activity-logs (role=employee →
     * "Mitarbeiter"-Label), which triggered a strict-mode violation on
     * 2026-04-23 when an employee activity showed up in the log. The
     * intent of this smoke test is to verify the stat cards, so the
     * stat-cards container is the right scope.
     */
    const stats = page.locator('#dashboard-data');
    await expect(stats.getByText('Admins')).toBeVisible();
    await expect(stats.getByText('Mitarbeiter')).toBeVisible();
    await expect(stats.getByText('Gesamte Benutzer')).toBeVisible();
  });

  test('shows activity log table', async ({ page }) => {
    await page.goto('/root-dashboard');

    await expect(page.getByText('Aktivitätsverlauf')).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
  });
});

test.describe('Smoke: Sidebar Navigation', () => {
  test('sidebar contains all main modules', async ({ page }) => {
    await page.goto('/root-dashboard');

    const nav = page.getByRole('complementary').getByRole('navigation');
    /* Some items are links, some are expandable buttons */
    await expect(nav.getByRole('button', { name: /Schwarzes Brett/ })).toBeVisible();
    await expect(nav.getByRole('link', { name: /Kalender/ })).toBeVisible();
    await expect(nav.getByRole('button', { name: /Urlaub/ })).toBeVisible();
    await expect(nav.getByRole('button', { name: /Dokumente/ })).toBeVisible();
    await expect(nav.getByRole('button', { name: /LEAN-Management/ })).toBeVisible();
    await expect(nav.getByRole('link', { name: /Chat/ })).toBeVisible();
    await expect(nav.getByRole('link', { name: /Module/ })).toBeVisible();
  });

  /*
   * Navigation assertions use `page.waitForURL()` (30 s default navigation
   * timeout) instead of `expect(page).toHaveURL()` (5 s expect timeout).
   *
   * WHY: ADR-049 added `/domains/verification-status` to the per-navigation
   * fetch fan-out in (app)/+layout.server.ts. Combined with the 6 parallel
   * API calls in calendar/+page.server.ts (dashboard / recently-added /
   * departments / teams / areas / users) a click-driven client navigation
   * to /calendar can exceed 5 s on a cold Vite dev-server that Playwright
   * just spawned (reuseExistingServer: false). SvelteKit only flips the URL
   * AFTER all server loads resolve, so `toHaveURL` with its expect-timeout
   * flakes before navigation completes. `waitForURL` inherits the 30 s
   * navigation timeout — the idiomatic Playwright pattern for post-click
   * navigation waits.
   */
  test('navigates to calendar', async ({ page }) => {
    await page.goto('/root-dashboard');

    /*
     * Promise.all + waitUntil: 'commit' required because:
     * - Vanilla `expect(page).toHaveURL()` uses the 5 s expect-timeout and
     *   flakes when (app)/+layout.server.ts + calendar/+page.server.ts fan
     *   out to ~13 parallel API calls (ADR-049 added /verification-status
     *   to the layout fetch set) on a cold Vite dev-server. SvelteKit only
     *   flips the URL after all load functions resolve.
     * - `waitForURL()` with the default `waitUntil: 'load'` was ALSO seen
     *   to time out at 30 s because the calendar page's Svelte 5 reactive
     *   init (shift-indicators + vacation-indicators + 4 state facades)
     *   can delay the `load` event beyond the test timeout while the URL
     *   itself already committed.
     * - `waitUntil: 'commit'` returns as soon as the URL commits, which is
     *   the semantic we actually want for a "sidebar navigates to X" test.
     * - Registering `waitForURL` BEFORE the click (Promise.all) avoids the
     *   micro-race where a fast synchronous navigation fires between click
     *   and the await line.
     *
     * This is the official Playwright idiom for nav-triggering clicks.
     */
    await Promise.all([
      page.waitForURL(/\/calendar/, { waitUntil: 'commit' }),
      page.getByRole('complementary').getByRole('link', { name: 'Kalender' }).click(),
    ]);
  });

  test('navigates to addons', async ({ page }) => {
    await page.goto('/root-dashboard');

    /* Same idiom as /calendar above — `waitUntil: 'commit'` captures the
     * URL change as soon as it commits, without blocking on the target
     * page's `load` event (which can be slow for pages with heavy Svelte 5
     * reactive init). Consistent pattern across all sidebar-nav smoke tests. */
    await Promise.all([
      page.waitForURL(/\/addons/, { waitUntil: 'commit' }),
      page.getByRole('complementary').getByRole('link', { name: 'Module' }).click(),
    ]);
  });
});

test.describe('Smoke: Header', () => {
  test('shows user name and logout button', async ({ page }) => {
    await page.goto('/root-dashboard');

    await expect(page.locator('#user-name')).toHaveText('Admin Test');
    await expect(page.getByRole('button', { name: 'Abmelden' })).toBeVisible();
  });

  test('theme toggle is available', async ({ page }) => {
    await page.goto('/root-dashboard');

    await expect(page.getByRole('button', { name: /Light Mode|Dark Mode/ })).toBeVisible();
  });
});

test.describe('Smoke: Key Pages Load', () => {
  const pages = [
    { path: '/calendar', title: /Assixx/ },
    { path: '/addons', title: /Assixx/ },
    { path: '/logs', title: /Assixx/ },
    { path: '/chat', title: /Assixx/ },
    { path: '/inventory', title: /Assixx/ },
    { path: '/manage-approvals', title: /Assixx/ },
    { path: '/surveys', title: /Assixx/ },
    { path: '/manage-surveys', title: /Assixx/ },
  ];

  for (const { path, title } of pages) {
    test(`${path} loads without error`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      const response = await page.goto(path);

      expect(response?.status()).toBeLessThan(400);
      await expect(page).toHaveTitle(title);

      const criticalErrors = consoleErrors.filter(
        (e) =>
          !e.includes('favicon') &&
          !e.includes('stylesheet') &&
          !e.includes('409') &&
          !e.includes('the server responded with a status of') &&
          // ADR-022 Phase A: E2E init fails closed (no silent key rotation) when
          // local IndexedDB is empty but the server holds a key from a previous
          // run. Playwright always creates a fresh context (empty IndexedDB) but
          // reuses the assixx storageState (persistent server-side E2E key), so
          // this mismatch is the steady-state of the test harness, not a page-
          // load regression. The race is only visible on pages slow enough for
          // the async init to finish before the title check (/manage-approvals
          // loads 46 approvals → ~1.8s, enough time).
          !e.includes('E2eState'),
      );
      expect(criticalErrors).toHaveLength(0);
    });
  }
});
