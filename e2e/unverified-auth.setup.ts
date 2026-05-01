/**
 * Unverified-tenant auth setup — logs in ONCE as the `unverified-e2e` seeded root
 * and persists cookies to `e2e/.auth/unverified.json`.
 *
 * WHY: every test in the "unverified-tenant static state" describe previously
 * ran its own fresh-context login. 4 logins × same user within seconds hits the
 * login rate-limiter (ADR-001) → tests 2-N fail with "Zu viele Anmeldeversuche".
 * Mirrors `auth.setup.ts` (assixx test tenant) — one login per suite, storageState reused.
 *
 * Prerequisite: `/etc/hosts` entry `127.0.0.1 unverified-e2e.localhost`
 * (ADR-050 Session 12c — see docs/how-to/HOW-TO-LOCAL-SUBDOMAINS.md).
 *
 * 2FA note: `test@unverified-e2e.test` has `tfa_enrolled_at = NULL` at first
 * E2E run (verified 2026-05-01 via psql probe). Backend issues a 2FA challenge
 * regardless (FEAT_2FA_EMAIL_MASTERPLAN DD-10 removed → mandatory on every
 * password login, no opt-out). After the first successful verify the column is
 * stamped, subsequent runs follow the identical path. Same Mailpit dance
 * applies — see `complete2faChallenge` in `./helpers`.
 */
import { expect, test as setup } from '@playwright/test';

import { complete2faChallenge } from './helpers';

const UNVERIFIED_FILE = 'e2e/.auth/unverified.json';

/**
 * Per-test timeout — 60 s, same rationale as `auth.setup.ts`. The Turnstile
 * budget is wider here (30 s vs. 15 s, see comment below) because this setup
 * runs on a different origin (`unverified-e2e.localhost`) than `auth.setup.ts`
 * (`assixx.localhost`); the Turnstile script cache is cold per origin.
 *
 * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md §Phase 5 + §Spec Deviations D5
 */
setup.setTimeout(60_000);

// Override the project-level baseURL: the `unverified-e2e` tenant only
// authenticates on its own subdomain so `hostSlug === user.subdomain` and
// the apex-handoff branch short-circuits (ADR-050 Session 12c).
setup.use({ baseURL: 'http://unverified-e2e.localhost:5174' });

setup('authenticate as unverified root', async ({ page }) => {
  await page.goto('/login');

  await page.getByRole('textbox', { name: 'E-Mail' }).fill('test@unverified-e2e.test');
  await page.getByRole('textbox', { name: 'Passwort' }).fill('Unverified12345!');

  // Turnstile budget: 30 s (not 15 s like auth.setup.ts). This setup runs on
  // `unverified-e2e.localhost:5174` while `auth.setup.ts` runs on
  // `assixx.localhost:5174` — different origin means the Turnstile iframe
  // cache is cold, and the fresh challenge script takes ~10 s + buffer to
  // unlock the submit button even with the official test keys
  // (HOW-TO-CLOUDFLARE-TURNSTILE.md: "sofort" auto-resolve only applies once
  // the challenge script is already loaded; the first-origin load is not
  // instant).
  const submitButton = page.getByRole('button', { name: 'Anmelden', exact: true });
  await expect(submitButton).toBeEnabled({ timeout: 30_000 });

  // Capture mail-poll lower bound BEFORE the submit click — see auth.setup.ts
  // for the cross-clock rationale (Docker shares the host kernel clock).
  const loginStartedAt = new Date();
  await submitButton.click();

  // Mandatory email-based 2FA per ADR-054 — same dance as auth.setup.ts but
  // for the unverified-e2e tenant root. The user's `tfa_enrolled_at = NULL`
  // state at first run does NOT alter the flow: the challenge issuance is
  // gated on "is this a password login?", not on prior enrollment (DD-10
  // removed → mandatory). After the first verify the column is stamped;
  // subsequent runs are identical.
  await complete2faChallenge(page, 'test@unverified-e2e.test', loginStartedAt);

  await page.waitForURL('**/root-dashboard');
  await expect(page).toHaveTitle(/Assixx/);

  await page.context().storageState({ path: UNVERIFIED_FILE });
});
