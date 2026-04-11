import { expect, test } from '@playwright/test';

test.describe('Smoke: Dashboard', () => {
  test('shows root dashboard with stats', async ({ page }) => {
    await page.goto('/root-dashboard');

    const main = page.getByRole('main');
    await expect(main.getByText('Admins')).toBeVisible();
    await expect(main.getByText('Mitarbeiter')).toBeVisible();
    await expect(main.getByText('Gesamte Benutzer')).toBeVisible();
  });

  test('shows activity log table', async ({ page }) => {
    await page.goto('/root-dashboard');

    await expect(page.getByText('Aktivitätsverlauf')).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
  });
});

test.describe('Smoke: Sidebar Navigation', () => {
  test('sidebar contains all main modules', async ({ page }) => {
    await page.goto('/root-dashboard');

    const nav = page.getByRole('complementary').getByRole('navigation');
    /* Some items are links, some are expandable buttons */
    await expect(nav.getByRole('button', { name: /Schwarzes Brett/ })).toBeVisible();
    await expect(nav.getByRole('link', { name: /Kalender/ })).toBeVisible();
    await expect(nav.getByRole('button', { name: /Urlaub/ })).toBeVisible();
    await expect(nav.getByRole('button', { name: /Dokumente/ })).toBeVisible();
    await expect(nav.getByRole('button', { name: /LEAN-Management/ })).toBeVisible();
    await expect(nav.getByRole('link', { name: /Chat/ })).toBeVisible();
    await expect(nav.getByRole('link', { name: /Module/ })).toBeVisible();
  });

  test('navigates to calendar', async ({ page }) => {
    await page.goto('/root-dashboard');

    await page.getByRole('complementary').getByRole('link', { name: 'Kalender' }).click();

    await expect(page).toHaveURL(/\/calendar/);
  });

  test('navigates to addons', async ({ page }) => {
    await page.goto('/root-dashboard');

    await page.getByRole('complementary').getByRole('link', { name: 'Module' }).click();

    await expect(page).toHaveURL(/\/addons/);
  });
});

test.describe('Smoke: Header', () => {
  test('shows user name and logout button', async ({ page }) => {
    await page.goto('/root-dashboard');

    await expect(page.locator('#user-name')).toHaveText('Admin Test');
    await expect(page.getByRole('button', { name: 'Abmelden' })).toBeVisible();
  });

  test('theme toggle is available', async ({ page }) => {
    await page.goto('/root-dashboard');

    await expect(page.getByRole('button', { name: /Light Mode|Dark Mode/ })).toBeVisible();
  });
});

test.describe('Smoke: Key Pages Load', () => {
  const pages = [
    { path: '/calendar', title: /Assixx/ },
    { path: '/addons', title: /Assixx/ },
    { path: '/logs', title: /Assixx/ },
    { path: '/chat', title: /Assixx/ },
    { path: '/inventory', title: /Assixx/ },
    { path: '/manage-approvals', title: /Assixx/ },
  ];

  for (const { path, title } of pages) {
    test(`${path} loads without error`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      const response = await page.goto(path);

      expect(response?.status()).toBeLessThan(400);
      await expect(page).toHaveTitle(title);

      const criticalErrors = consoleErrors.filter(
        (e) =>
          !e.includes('favicon') &&
          !e.includes('stylesheet') &&
          !e.includes('409') &&
          !e.includes('the server responded with a status of'),
      );
      expect(criticalErrors).toHaveLength(0);
    });
  }
});
