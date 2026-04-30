import { test, expect } from '@playwright/test';

function getAdminCredentials() {
  const email = process.env.TEST_ADMIN_EMAIL;
  const password = process.env.TEST_ADMIN_PASSWORD;
  return email && password ? { email, password } : null;
}

async function loginAsAdmin(page: import('@playwright/test').Page) {
  const creds = getAdminCredentials();
  if (!creds) {
    throw new Error('TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD must be set for admin E2E (e2e-ci creates them)');
  }
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(creds.email);
  await page.getByLabel(/password/i).fill(creds.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 10000 });
}

test.describe('admin delete and edit', () => {
  test.beforeEach(async ({ page }) => {
    const creds = getAdminCredentials();
    if (!creds) test.skip();
  });

  test('admin can edit an entry', async ({ page }) => {
    await loginAsAdmin(page);

    const row = page.getByRole('cell', { name: 'E2E Test Limo' }).first();
    await expect(row).toBeVisible({ timeout: 5000 }).catch(() => {});

    const tableRow = row.locator('..');
    const menuTrigger = tableRow.getByRole('button', { name: 'Admin menu' });
    await menuTrigger.click();

    await page.getByRole('button', { name: 'Edit' }).click();

    const modal = page.getByRole('heading', { name: 'edit lemonade' });
    await expect(modal).toBeVisible();

    const nameInput = page.getByLabel(/lemonade name/i);
    await nameInput.fill('E2E Test Limo (edited)');
    await page.getByRole('button', { name: 'save changes' }).click();

    await expect(modal).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('cell', { name: 'E2E Test Limo (edited)' }).first()).toBeVisible({ timeout: 5000 });
  });

  test('admin can delete an entry', async ({ page }) => {
    await loginAsAdmin(page);

    const row = page.getByRole('cell', { name: 'E2E Test Limo (edited)' }).first();
    await expect(row).toBeVisible({ timeout: 5000 });

    const tableRow = row.locator('..');
    const menuTrigger = tableRow.getByRole('button', { name: 'Admin menu' });
    await expect(menuTrigger).toBeVisible();
    await menuTrigger.click();

    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Delete' }).click();

    await expect(row).not.toBeVisible({ timeout: 5000 });
  });
});
