/**
 * Unverified-tenant auth setup — logs in ONCE as the `unverified-e2e` seeded root
 * and persists cookies to `e2e/.auth/unverified.json`.
 *
 * WHY: every test in the "unverified-tenant static state" describe previously
 * ran its own fresh-context login. 4 logins × same user within seconds hits the
 * login rate-limiter (ADR-001) → tests 2-N fail with "Zu viele Anmeldeversuche".
 * Mirrors `auth.setup.ts` (apitest) — one login per suite, storageState reused.
 *
 * Prerequisite: `/etc/hosts` entry `127.0.0.1 unverified-e2e.localhost`
 * (ADR-050 Session 12c — see docs/how-to/HOW-TO-LOCAL-SUBDOMAINS.md).
 */
import { expect, test as setup } from '@playwright/test';

const UNVERIFIED_FILE = 'e2e/.auth/unverified.json';

// Override the project-level baseURL: the `unverified-e2e` tenant only
// authenticates on its own subdomain so `hostSlug === user.subdomain` and
// the apex-handoff branch short-circuits (ADR-050 Session 12c).
setup.use({ baseURL: 'http://unverified-e2e.localhost:5174' });

setup('authenticate as unverified root', async ({ page }) => {
  await page.goto('/login');

  await page.getByRole('textbox', { name: 'E-Mail' }).fill('test@unverified-e2e.test');
  await page.getByRole('textbox', { name: 'Passwort' }).fill('Unverified12345!');

  // Turnstile budget: 30s (not 15s like auth.setup.ts). This setup runs on
  // `unverified-e2e.localhost:5174` while `auth.setup.ts` runs on
  // `apitest.localhost:5174` — different origin means the Turnstile iframe
  // cache is cold, and the fresh challenge script takes ~10 s + buffer to
  // unlock the submit button even with the official test keys (HOW-TO-CLOUDFLARE-TURNSTILE.md:
  // "sofort" auto-resolve only applies once the challenge script is already
  // loaded; the first-origin load is not instant).
  const submitButton = page.getByRole('button', { name: 'Anmelden', exact: true });
  await expect(submitButton).toBeEnabled({ timeout: 30000 });
  await submitButton.click();

  await page.waitForURL('**/root-dashboard');
  await expect(page).toHaveTitle(/Assixx/);

  await page.context().storageState({ path: UNVERIFIED_FILE });
});
