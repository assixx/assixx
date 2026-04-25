import { expect, test } from '@playwright/test';

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
    await page.goto('/login');

    await page.getByRole('textbox', { name: 'E-Mail' }).fill('admin@apitest.de');
    await page.getByRole('textbox', { name: 'Passwort' }).fill('ApiTest12345!');
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click();

    await page.waitForURL('**/root-dashboard');
    await expect(page.locator('#user-name')).toHaveText('Admin Test');
  });

  test('invalid credentials show error', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('textbox', { name: 'E-Mail' }).fill('wrong@test.de');
    await page.getByRole('textbox', { name: 'Passwort' }).fill('WrongPass123!');
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click();

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
