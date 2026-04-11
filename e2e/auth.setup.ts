import { expect, test as setup } from '@playwright/test';

const ADMIN_FILE = 'e2e/.auth/admin.json';

setup('authenticate as admin', async ({ page }) => {
  await page.goto('/login');

  await page.getByRole('textbox', { name: 'E-Mail' }).fill('admin@apitest.de');
  await page.getByRole('textbox', { name: 'Passwort' }).fill('ApiTest12345!');
  await page.getByRole('button', { name: 'Anmelden' }).click();

  await page.waitForURL('**/root-dashboard');
  await expect(page).toHaveTitle(/Assixx/);

  await page.context().storageState({ path: ADMIN_FILE });
});
