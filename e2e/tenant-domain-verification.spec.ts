/**
 * Tenant Domain Verification — E2E Tests
 *
 * Per masterplan §5.4.3, the canonical test here is a happy-path walk-through:
 * unverified-root logs in → sees banner → clicks verify → toast + banner
 * disappears in same tab (the `invalidateAll()` contract per v0.3.0 S4) →
 * user-creation buttons unlock → actually creates a user.
 *
 * **Why the banner-specific flow is `test.skip()`:**
 *
 * The banner is gated by `data.tenantVerified === false` which is set by
 * `(app)/+layout.server.ts` based on `GET /api/v2/domains/verification-status`.
 * That fetch happens INSIDE the SvelteKit Node server (SSR), NOT in the
 * browser, so Playwright's `page.route()` cannot intercept it. The current
 * `apitest` test-tenant seed (Phase 1 Step 1.3) is pre-verified, so any E2E
 * logging in as apitest sees the banner-hidden state by default.
 *
 * Two paths to unblock the full E2E — both are out of scope for Step 5.4.3:
 *
 * (A) **Add an unverified test-tenant to Phase 1's seed** (`unverified-e2e`
 *     subdomain, root user, NO verified `tenant_domains` row). This is what
 *     §5.4.3's "Dependency" line explicitly calls out: "Phase 1 must also
 *     seed one unverified test tenant". Touching Phase 1 here would be
 *     scope-creep across phases.
 *
 * (B) **Toggle apitest.de verified→pending in Playwright `globalSetup`,
 *     restore in `globalTeardown`.** Functional but destructive: any other
 *     test in the suite that relies on apitest being verified (and most
 *     do — the API tests for users/admins all require it) breaks during the
 *     E2E window.
 *
 * **Coverage in the meantime:** the verify-success → invalidateAll → banner
 * disappears contract is exercised at the unit level via `state-data.svelte.ts`
 * mutations (Phase 4 API tests confirm the underlying server behavior, and
 * the page-level `+page.svelte` calls `invalidateAll()` after verify-success).
 * The full browser-level proof is the gap.
 *
 * The minimal smoke below validates the page is reachable + the existing
 * verified domain renders correctly — this catches any regression in the
 * basic page-mount flow without needing the unverified-tenant seed.
 *
 * @see masterplan §5.4.3, §5.4 DoD
 * @see e2e/auth.setup.ts (storageState pattern, apitest credentials)
 */
import { expect, test } from '@playwright/test';

// Use the saved auth from auth.setup.ts (apitest root user — pre-verified
// per Phase 1 Step 1.3 seed).
test.use({ storageState: 'e2e/.auth/admin.json' });

test.describe('Tenant Domain Verification — page-mount smoke', () => {
  test('root can navigate to /settings/company-profile/domains and see the verified domain', async ({
    page,
  }) => {
    await page.goto('/settings/company-profile/domains');

    // Page header + table render. Use the German UI strings from
    // +page.svelte to lock in the user-visible contract.
    await expect(page.getByRole('heading', { name: 'Firmen-Domains' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Domain hinzufügen' })).toBeVisible();

    // The pre-seeded apitest.de domain renders as a row.
    await expect(page.locator('[data-testid="domain-row"]').first()).toBeVisible();
  });

  test('breadcrumb chain renders [Home → System → Firmenprofil → Domains]', async ({ page }) => {
    await page.goto('/settings/company-profile/domains');

    // The Firmenprofil parent crumb is a link (intermediate); the Domains
    // leaf is the active span. The leaf assertion alone is enough to prove
    // the breadcrumb-config wiring (Step 5.1 follow-up).
    await expect(
      page.locator('.breadcrumb__item--active').filter({ hasText: 'Domains' }),
    ).toBeVisible();
  });
});

test.describe('Tenant Domain Verification — unverified-tenant happy path (DEFERRED)', () => {
  // See file header for the full deferral rationale (SSR fetch can't be
  // intercepted by Playwright; needs unverified test-tenant seed).
  test.skip('unverified root sees banner → verifies → banner disappears + button unlocks (v0.3.0 S4)', () => {
    // Original §5.4.3 walk-through:
    //   (1) Log in as the unverified test-tenant root → Dashboard
    //   (2) Assert UnverifiedDomainBanner is visible (locator with text
    //       matching "Domain nicht verifiziert")
    //   (3) Navigate to /manage-admins
    //   (4) Assert "Administrator hinzufügen" submit button is disabled
    //       + title contains "Verifiziere zuerst Deine Firmen-Domain"
    //   (5) Navigate to /settings/company-profile/domains
    //   (6) Click "Jetzt verifizieren" on the seeded pending row.
    //       MOCK DNS via Playwright `page.route()` on
    //       POST /api/v2/domains/:id/verify → return verified row.
    //   (7) Assert success toast contains "verifiziert"
    //   (8) Assert banner disappears WITHOUT a manual reload
    //       (this IS the v0.3.0 S4 invalidateAll() contract)
    //   (9) Navigate back to /manage-admins
    //   (10) Assert "Administrator hinzufügen" is now ENABLED + tooltip gone
    //   (11) Optional: actually create a user (form submit → 201)
  });

  test.skip('cross-browser: same flow runs green in Chromium + WebKit (Svelte-5 layout-invalidation parity)', () => {
    // Per §5.4.3: "Run in both Chromium and WebKit (Firefox optional) to
    // catch Safari-specific layout-invalidation bugs in Svelte-5 state
    // propagation." Same blocker as above + Playwright project config
    // would need a `webkit` entry in playwright.config.ts.
  });
});
