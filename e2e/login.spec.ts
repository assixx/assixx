import { expect, test } from '@playwright/test';

import { complete2faChallenge } from './helpers';

/* Login-Tests nutzen KEINE gespeicherte Auth — sie testen den Login selbst */
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Login Flow', () => {
  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login');

    await expect(page).toHaveTitle(/Anmelden|Login/);
    await expect(page.getByRole('textbox', { name: 'E-Mail' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Passwort' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Anmelden', exact: true })).toBeVisible();
  });

  test('login button is disabled with empty fields', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('button', { name: 'Anmelden', exact: true })).toBeDisabled();
  });

  test('successful login redirects to dashboard', async ({ page }) => {
    // Bumped from default 30 s — same budget breakdown as auth.setup.ts
    // (Turnstile + 2FA dance + redirects). See FEAT_2FA_EMAIL_MASTERPLAN
    // §Spec Deviations D5 for the audit-row-#4 miss this test had to absorb.
    test.setTimeout(60_000);

    await page.goto('/login');

    await page.getByRole('textbox', { name: 'E-Mail' }).fill('info@assixx.com');
    await page.getByRole('textbox', { name: 'Passwort' }).fill('ApiTest12345!');

    const submitButton = page.getByRole('button', { name: 'Anmelden', exact: true });
    await expect(submitButton).toBeEnabled({ timeout: 15_000 });

    // Capture mail-poll lower bound BEFORE submit (Mailpit `since`-filter).
    const loginStartedAt = new Date();
    await submitButton.click();

    // Mandatory email-based 2FA per ADR-054 — same dance as auth.setup.ts.
    await complete2faChallenge(page, 'info@assixx.com', loginStartedAt);

    await page.waitForURL('**/root-dashboard');
    await expect(page.locator('#user-name')).toHaveText('Admin Test');
  });

  test('invalid credentials show error', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('textbox', { name: 'E-Mail' }).fill('wrong@test.de');
    await page.getByRole('textbox', { name: 'Passwort' }).fill('WrongPass123!');

    // The submit button is gated by `isFormValid` which includes the Turnstile
    // token (`turnstileEnabled && turnstileToken !== ''`). On a cold Vite +
    // cold Turnstile-CDN handshake the token can take ~10 s to populate, well
    // beyond the 5 s expect-timeout the test below uses for the error toast.
    // Wait for the button explicitly with the same 15 s budget as auth.setup.ts.
    const submitButton = page.getByRole('button', { name: 'Anmelden', exact: true });
    await expect(submitButton).toBeEnabled({ timeout: 15_000 });
    await submitButton.click();

    await expect(
      page.getByText(/fehlgeschlagen|ungültig|falsch|error|Anmeldung/i).first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/root-dashboard');

    await expect(page).toHaveURL(/\/login/);
  });
});

/* Logout uses separate describe WITHOUT storageState reset — reuses saved auth */
test.describe('Logout Flow', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });

  test('logout redirects to login page', async ({ page }) => {
    await page.goto('/root-dashboard');
    await expect(page.locator('#user-name')).toHaveText('Admin Test');

    /* Ausloggen — Header-Button öffnet Bestätigungs-Modal */
    await page.locator('#logout-btn').click({ delay: 500 });

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 5_000 });
    await modal.getByRole('button', { name: 'Abmelden' }).click();

    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
