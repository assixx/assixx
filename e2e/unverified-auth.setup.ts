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

  // Mirror auth.setup.ts — wait for Turnstile token (15s budget covers cold
  // CDN on first suite run; `auth.setup.ts` warms the iframe cache but this
  // setup may land on a fresh Turnstile context since it's a different origin).
  const submitButton = page.getByRole('button', { name: 'Anmelden', exact: true });
  await expect(submitButton).toBeEnabled({ timeout: 15000 });
  await submitButton.click();

  await page.waitForURL('**/root-dashboard');
  await expect(page).toHaveTitle(/Assixx/);

  await page.context().storageState({ path: UNVERIFIED_FILE });
});
