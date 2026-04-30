import { test, expect } from '@playwright/test';

test.describe('login', () => {
  test('login page shows form and rejects invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: /admin login/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();

    await page.getByLabel(/email/i).fill('wrong@test.local');
    await page.getByLabel(/password/i).fill('wrong');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByText(/invalid/i).or(page.getByText(/error/i)).or(page.locator('.error'))).toBeVisible({
      timeout: 5000,
    });
  });

  test('login with test admin and see logout on home', async ({ page }) => {
    const email = process.env.TEST_ADMIN_EMAIL;
    const password = process.env.TEST_ADMIN_PASSWORD;
    if (!email || !password) {
      test.skip();
      return;
    }

    await page.goto('/login');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/$/, { timeout: 10000 });
    await expect(page.getByRole('button', { name: 'logout' }).first()).toBeVisible({
      timeout: 5000,
    });
  });
});
