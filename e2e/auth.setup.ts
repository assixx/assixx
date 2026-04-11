import { expect, test as setup } from '@playwright/test';

const ADMIN_FILE = 'e2e/.auth/admin.json';

setup('authenticate as admin', async ({ page }) => {
  await page.goto('/login');

  await page.getByRole('textbox', { name: 'E-Mail' }).fill('admin@apitest.de');
  await page.getByRole('textbox', { name: 'Passwort' }).fill('ApiTest12345!');

  // Wait for Turnstile token before clicking — fail fast with a clear message
  // if the test keys ever stop populating the token (instead of a 30s click timeout).
  const submitButton = page.getByRole('button', { name: 'Anmelden' });
  await expect(submitButton).toBeEnabled({ timeout: 5000 });
  await submitButton.click();

  await page.waitForURL('**/root-dashboard');
  await expect(page).toHaveTitle(/Assixx/);

  await page.context().storageState({ path: ADMIN_FILE });
});
