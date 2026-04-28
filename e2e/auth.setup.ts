import { expect, test as setup } from '@playwright/test';

const ADMIN_FILE = 'e2e/.auth/admin.json';

setup('authenticate as admin', async ({ page }) => {
  await page.goto('/login');

  await page.getByRole('textbox', { name: 'E-Mail' }).fill('info@assixx.com');
  await page.getByRole('textbox', { name: 'Passwort' }).fill('ApiTest12345!');

  // Wait for Turnstile token before clicking — fail fast with a clear message
  // if the test keys ever stop populating the token (instead of a 30s click timeout).
  // Budget: 15s, not 5s. The lower budget flaked on cold Vite + cold Turnstile-CDN
  // handshakes (HOW-TO-CLOUDFLARE-TURNSTILE.md says test keys "lösen sofort auf",
  // but "sofort" assumes the script is already cached — the first run after a
  // fresh `pnpm run dev` reliably exceeded 5s). 15s is still half the original
  // 30s click-timeout, so the fail-fast intent stays intact for the genuine
  // "test keys broke" scenario this assertion guards against.
  const submitButton = page.getByRole('button', { name: 'Anmelden', exact: true });
  await expect(submitButton).toBeEnabled({ timeout: 15000 });
  await submitButton.click();

  await page.waitForURL('**/root-dashboard');
  await expect(page).toHaveTitle(/Assixx/);

  await page.context().storageState({ path: ADMIN_FILE });
});
