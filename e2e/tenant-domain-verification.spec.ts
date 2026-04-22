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

    // Page header + table render. Use the German UI string for the heading
    // to lock in the user-visible contract; use the data-testid for the FAB
    // because the page renders TWO buttons with the accessible name "Domain
    // hinzufügen" — the FAB (always present) AND the empty-state button
    // (only when domains.length === 0). Role-by-name would trip strict-mode
    // duplicate-match if the empty-state ever rendered, so target the
    // canonical FAB testid that always exists.
    await expect(page.getByRole('heading', { name: 'Firmen-Domains' })).toBeVisible();
    await expect(page.getByTestId('add-domain-btn')).toBeVisible();

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

test.describe('Tenant Domain Verification — unverified-tenant static state', () => {
  // Shared auth via `unverified-auth.setup.ts` — one login per suite, storageState
  // reused across all tests. Replaces the previous login-per-test pattern which
  // tripped the login rate-limiter (ADR-001) after ~2 attempts.
  //
  // Session 12c (ADR-050): override the project-level `apitest.localhost:5174`
  // baseURL so `page.goto('/manage-admins')` etc. stay on the UNVERIFIED tenant's
  // origin. Cookies in `unverified.json` are scoped to `unverified-e2e.localhost`,
  // so without the baseURL override relative `page.goto()` would jump back to
  // apitest where the user has no cookies.
  //
  // Prerequisite: `/etc/hosts` entry `127.0.0.1 unverified-e2e.localhost`.
  // See docs/how-to/HOW-TO-LOCAL-SUBDOMAINS.md.
  test.use({
    storageState: 'e2e/.auth/unverified.json',
    baseURL: 'http://unverified-e2e.localhost:5174',
  });

  test('unverified root sees UnverifiedDomainBanner on the dashboard', async ({ page }) => {
    await page.goto('/root-dashboard');

    // Banner shows when `data.tenantVerified === false` AND role is root/admin
    // per (app)/+layout.svelte:435. German string from UnverifiedDomainBanner.svelte.
    const banner = page.locator('#unverified-domain-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Domain nicht verifiziert');
    await expect(banner.getByRole('link', { name: 'Jetzt verifizieren' })).toHaveAttribute(
      'href',
      /\/settings\/company-profile\/domains/,
    );
  });

  test('unverified root sees SingleRootWarningBanner HIDDEN (banner-priority-fix 2026-04-19)', async ({
    page,
  }) => {
    await page.goto('/root-dashboard');

    // (app)/+layout.svelte:426 was changed 2026-04-19 to suppress the single-
    // root banner while the tenant is unverified (creating a 2nd root routes
    // through RootService.insertRootUserRecord → assertVerified() → 403, so
    // the banner's CTA would drive the user into a guaranteed failure). This
    // test locks that priority contract in.
    await expect(page.locator('#single-root-warning-banner')).not.toBeVisible();
  });

  test('on /manage-admins the "Administrator hinzufügen" FAB is disabled with tooltip', async ({
    page,
  }) => {
    await page.goto('/manage-admins');

    // The floating action button is the canonical unlocked-gate target. When
    // the tenant is unverified, `disabled={!data.tenantVerified}` on it must
    // flip to true AND the title attribute carries the German remediation
    // message (manage-admins/+page.svelte:554).
    const fab = page.locator('.btn-float');
    await expect(fab).toBeVisible();
    await expect(fab).toBeDisabled();
    await expect(fab).toHaveAttribute(
      'title',
      /Verifiziere zuerst Deine Firmen-Domain unter \/settings\/company-profile\/domains/,
    );
  });

  test('domains page lists the pending row with a Verify button', async ({ page }) => {
    await page.goto('/settings/company-profile/domains');

    await expect(page.getByRole('heading', { name: 'Firmen-Domains' })).toBeVisible();
    const row = page.locator('[data-testid="domain-row"]').first();
    await expect(row).toBeVisible();
    await expect(row).toContainText('unverified-e2e.test');
    // Pending rows render a Verify button. Target by data-testid, not by
    // accessible name — the button text "Jetzt verifizieren" (DomainRow.svelte)
    // doesn't match the previous case-sensitive `/Verifizieren|Verify/` regex
    // (lowercase "v" after the space). The testid contract is also more
    // resilient to UI-string tweaks across the i18n surface.
    await expect(row.getByTestId('verify-btn')).toBeVisible();
  });
});

test.describe('Tenant Domain Verification — verify-success → invalidateAll (STILL DEFERRED)', () => {
  // Unblocked by the unverified-e2e seed above for the static-state tests, but
  // the verify-CLICK flow remains deferred because the DNS lookup the backend
  // performs inside POST /api/v2/domains/:id/verify is a REAL resolver call
  // against `_assixx-verify.unverified-e2e.test`, which NXDOMAINs (RFC 2606
  // reserved `.test` TLD never resolves). So even if Playwright intercepts
  // the client POST, the backend returns `status: 'pending'` and the UI
  // stays unchanged. Fully exercising the invalidateAll() + SSR-refetch flow
  // would need either (a) a test-only domain we control with a real TXT
  // record, or (b) an orchestration that flips `tenant_domains.status` to
  // 'verified' via direct DB mid-test while intercepting the verify POST.
  // (b) is feasible but out of scope for the seed-addition delta.
  test.skip('click Verify → toast + banner disappears in-tab + FAB unlocks (v0.3.0 S4)', () => {
    /* Original §5.4.3 walk-through — see file header. */
  });
});
