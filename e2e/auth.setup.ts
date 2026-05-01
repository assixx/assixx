import { expect, test as setup } from '@playwright/test';

import { complete2faChallenge } from './helpers';

const ADMIN_FILE = 'e2e/.auth/admin.json';

/**
 * Per-test timeout — bumped from Playwright's default 30s to 60s.
 *
 * Budget breakdown (worst case, cold Vite + cold caches):
 *   - Turnstile script handshake + token mint:           ~10–15 s
 *   - SvelteKit form action → backend → 303 → reload:    ~0.5–1 s
 *   - Mailpit poll for 2FA code:                         ~0.2–10 s
 *   - 6-box OTP fill + Bestätigen click + redirect:      ~0.5–1 s
 *   - Final navigation to /root-dashboard:               ~0.2–0.5 s
 *
 * 30 s left no headroom for cold-Vite scenarios. 60 s preserves the fail-fast
 * intent for genuine breakage (e.g. SMTP outage) while protecting the happy
 * path from Playwright-default timeout flakes.
 *
 * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md §Phase 5 + §Spec Deviations D5
 */
setup.setTimeout(60_000);

setup('authenticate as admin', async ({ page }) => {
  await page.goto('/login');

  await page.getByRole('textbox', { name: 'E-Mail' }).fill('info@assixx.com');
  await page.getByRole('textbox', { name: 'Passwort' }).fill('ApiTest12345!');

  // Wait for Turnstile token before clicking — fail fast with a clear message
  // if the test keys ever stop populating the token (instead of a 30 s click
  // timeout). 15 s budget covers cold Vite + cold Turnstile-CDN handshakes
  // (HOW-TO-CLOUDFLARE-TURNSTILE.md says test keys "lösen sofort auf", but
  // "sofort" assumes the script is already cached).
  const submitButton = page.getByRole('button', { name: 'Anmelden', exact: true });
  await expect(submitButton).toBeEnabled({ timeout: 15_000 });

  // Capture mail-poll lower bound BEFORE the submit click. The Mailpit `since`
  // filter in `complete2faChallenge` uses this to distinguish THIS challenge's
  // mail from any stale prior-run leftover. Docker containers share the host
  // kernel clock → sub-ms drift between this `Date.now()` and Mailpit's
  // `Created` timestamp; safe to compare directly.
  const loginStartedAt = new Date();
  await submitButton.click();

  // Mandatory email-based 2FA per ADR-054 (FEAT_2FA_EMAIL_MASTERPLAN Phase 2
  // Step 2.4, DONE 2026-04-29): backend mints `challengeToken` httpOnly cookie
  // → 303 reloads /login → load() returns `stage: 'verify'` → page renders
  // inline TwoFactorVerifyForm. Helper polls Mailpit, fills the 6-box OTP,
  // clicks "Bestätigen". The verify action then issues access/refresh cookies
  // + 303 to /root-dashboard. Audit row #4 (line 2141 of the masterplan)
  // mistakenly assumed Phase 5 frontend changes covered Playwright — they
  // don't, because Playwright IS the user. Hence this explicit step.
  await complete2faChallenge(page, 'info@assixx.com', loginStartedAt);

  await page.waitForURL('**/root-dashboard');
  await expect(page).toHaveTitle(/Assixx/);

  await page.context().storageState({ path: ADMIN_FILE });
});
